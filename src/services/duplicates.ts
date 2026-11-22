import type { DuplicateFile, DuplicateGroup, DuplicateProgress, FileEntryRecord } from '../types'

interface RawDuplicateResult {
  id: string
  certainty: 'confirmed' | 'probable'
  hash: string
  fileIds: string[]
  size: number
}

type WorkerMessage =
  | {
      type: 'progress'
      phase: 'sampling' | 'full'
      processed: number
      total: number
    }
  | {
      type?: 'result'
      ok: boolean
      results?: RawDuplicateResult[]
      error?: string
    }

export interface FindDuplicatesOptions {
  maxCandidates?: number
  onProgress?: (progress: DuplicateProgress) => void
  signal?: AbortSignal
}

export interface FindDuplicatesOutput {
  groups: DuplicateGroup[]
  skippedCount: number
}

const COPY_NOISE_NAME_RE = /(?:副本|复制|copy|backup|bak|temp|tmp|duplicate|\(\d+\))/iu
const COPY_NOISE_PATH_RE = /(?:archive|legacy|backup|temp|scratch|trash|old)/iu
const CHUNK_SIZE = 64 * 1024
const FULL_HASH_LIMIT = 128 * 1024 * 1024

function scoreKeepPriority(entry: FileEntryRecord): { penalty: number; reason: string } {
  let penalty = 0
  const reasons: string[] = []
  const hasCopyName = COPY_NOISE_NAME_RE.test(entry.name)
  const hasCopyPath = COPY_NOISE_PATH_RE.test(entry.parentPath)

  if (hasCopyName) {
    penalty += 45
  } else {
    reasons.push('原始规范命名')
  }

  if (hasCopyPath) {
    penalty += 22
  } else {
    reasons.push('位于主干目录')
  }

  penalty += entry.depth * 3 + Math.min(20, entry.relativePath.length * 0.08)
  return {
    penalty,
    reason: reasons.length ? reasons.join(' · ') : '层级较浅且路径简洁',
  }
}

export function annotateRecommendedKeep(files: DuplicateFile[]): {
  files: DuplicateFile[]
  recommendedKeepId?: string
} {
  if (!files.length) return { files }
  const scored = files.map((file) => ({
    file,
    ...scoreKeepPriority(file),
  }))

  scored.sort((a, b) => {
    if (a.penalty !== b.penalty) return a.penalty - b.penalty
    if (a.file.lastModified && b.file.lastModified && a.file.lastModified !== b.file.lastModified) {
      return a.file.lastModified - b.file.lastModified
    }
    return a.file.relativePath.localeCompare(b.file.relativePath, 'zh-CN')
  })

  const winnerId = scored[0].file.id
  const winnerReason = scored[0].reason

  return {
    recommendedKeepId: winnerId,
    files: files.map((file) =>
      file.id === winnerId
        ? { ...file, isRecommendedKeep: true, keepReason: winnerReason }
        : { ...file, isRecommendedKeep: false },
    ),
  }
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function computeSingleFileSha256(
  file: File,
): Promise<{ hash: string; mode: 'full' | 'sample' }> {
  if (file.size <= FULL_HASH_LIMIT) {
    const buf = await file.arrayBuffer()
    return {
      hash: toHex(await crypto.subtle.digest('SHA-256', buf)),
      mode: 'full',
    }
  }
  const middle = Math.max(0, Math.floor(file.size / 2 - CHUNK_SIZE / 2))
  const sampleBlob = new Blob([
    file.slice(0, CHUNK_SIZE),
    file.slice(middle, middle + CHUNK_SIZE),
    file.slice(Math.max(0, file.size - CHUNK_SIZE)),
  ])
  return {
    hash: toHex(await crypto.subtle.digest('SHA-256', await sampleBlob.arrayBuffer())),
    mode: 'sample',
  }
}

async function runFallbackInThread(
  candidates: Array<{ id: string; size: number; file: File }>,
  options: FindDuplicatesOptions,
): Promise<RawDuplicateResult[]> {
  const sampleGroups = new Map<string, Array<{ id: string; size: number; file: File; sampleHash: string }>>()
  for (let i = 0; i < candidates.length; i += 1) {
    if (options.signal?.aborted) throw new DOMException('检测已取消', 'AbortError')
    const item = candidates[i]
    const middle = Math.max(0, Math.floor(item.size / 2 - CHUNK_SIZE / 2))
    const sampleBlob =
      item.size <= CHUNK_SIZE * 3
        ? item.file
        : new Blob([
            item.file.slice(0, CHUNK_SIZE),
            item.file.slice(middle, middle + CHUNK_SIZE),
            item.file.slice(Math.max(0, item.size - CHUNK_SIZE)),
          ])
    const sampleHash = toHex(await crypto.subtle.digest('SHA-256', await sampleBlob.arrayBuffer()))
    const key = `${item.size}:${sampleHash}`
    const bucket = sampleGroups.get(key) ?? []
    bucket.push({ ...item, sampleHash })
    sampleGroups.set(key, bucket)
    options.onProgress?.({ phase: 'sampling', processed: i + 1, total: candidates.length })
  }

  const results: RawDuplicateResult[] = []
  for (const group of sampleGroups.values()) {
    if (group.length < 2) continue
    if (group[0].size > FULL_HASH_LIMIT) {
      results.push({
        id: crypto.randomUUID(),
        certainty: 'probable',
        hash: group[0].sampleHash,
        fileIds: group.map((item) => item.id),
        size: group[0].size,
      })
      continue
    }
    const fullMap = new Map<string, string[]>()
    for (const item of group) {
      if (options.signal?.aborted) throw new DOMException('检测已取消', 'AbortError')
      const fullHash =
        item.size <= CHUNK_SIZE * 3
          ? item.sampleHash
          : toHex(await crypto.subtle.digest('SHA-256', await item.file.arrayBuffer()))
      const ids = fullMap.get(fullHash) ?? []
      ids.push(item.id)
      fullMap.set(fullHash, ids)
    }
    for (const [hash, fileIds] of fullMap) {
      if (fileIds.length >= 2) {
        results.push({
          id: crypto.randomUUID(),
          certainty: 'confirmed',
          hash,
          fileIds,
          size: group[0].size,
        })
      }
    }
  }
  return results
}

export async function findDuplicatesWithSummary(
  entries: FileEntryRecord[],
  fileMap: Map<string, File>,
  options: FindDuplicatesOptions = {},
): Promise<FindDuplicatesOutput> {
  const maxCandidates = options.maxCandidates ?? 5000
  const sizeGroups = new Map<number, FileEntryRecord[]>()
  for (const entry of entries) {
    if (entry.kind !== 'file' || entry.size === 0 || !fileMap.has(entry.id)) continue
    const group = sizeGroups.get(entry.size) ?? []
    group.push(entry)
    sizeGroups.set(entry.size, group)
  }

  // Prioritize largest files first so high-value space savings are never truncated by the cap!
  const allSameSizeEntries = [...sizeGroups.values()]
    .filter((group) => group.length > 1)
    .sort((a, b) => b[0].size - a[0].size)
    .flat()

  const skippedCount = Math.max(0, allSameSizeEntries.length - maxCandidates)
  const candidates = allSameSizeEntries
    .slice(0, maxCandidates)
    .map((entry) => ({ id: entry.id, size: entry.size, file: fileMap.get(entry.id)! }))

  if (!candidates.length) return { groups: [], skippedCount: 0 }
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]))

  let rawResults: RawDuplicateResult[]
  if (typeof window === 'undefined' || !('Worker' in window)) {
    rawResults = await runFallbackInThread(candidates, options)
  } else {
    rawResults = await new Promise<RawDuplicateResult[]>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/hash.worker.ts', import.meta.url), { type: 'module' })

      const handleAbort = () => {
        worker.terminate()
        reject(new DOMException('检测已取消', 'AbortError'))
      }

      if (options.signal?.aborted) {
        handleAbort()
        return
      }
      options.signal?.addEventListener('abort', handleAbort, { once: true })

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data
        if (data.type === 'progress') {
          options.onProgress?.({
            phase: data.phase,
            processed: data.processed,
            total: data.total,
          })
          return
        }
        options.signal?.removeEventListener('abort', handleAbort)
        worker.terminate()
        if (!data.ok) {
          reject(new Error(data.error || '重复文件检测失败'))
          return
        }
        resolve(data.results ?? [])
      }
      worker.onerror = (event) => {
        options.signal?.removeEventListener('abort', handleAbort)
        worker.terminate()
        reject(new Error(event.message))
      }
      worker.postMessage({ candidates })
    })
  }

  const groups = rawResults
    .map((result) => {
      const baseFiles: DuplicateFile[] = result.fileIds
        .map((id) => entryMap.get(id))
        .filter((entry): entry is FileEntryRecord => Boolean(entry))
        .map((entry) => ({ ...entry, certainty: result.certainty, hash: result.hash }))
      const annotated = annotateRecommendedKeep(baseFiles)
      return {
        id: result.id,
        size: result.size,
        reclaimableSize: result.size * Math.max(0, annotated.files.length - 1),
        certainty: result.certainty,
        recommendedKeepId: annotated.recommendedKeepId,
        files: annotated.files,
      }
    })
    .filter((group) => group.files.length > 1)
    .sort((a, b) => b.reclaimableSize - a.reclaimableSize)

  return { groups, skippedCount }
}

export async function findDuplicates(
  entries: FileEntryRecord[],
  fileMap: Map<string, File>,
  options: FindDuplicatesOptions = {},
): Promise<DuplicateGroup[]> {
  const { groups } = await findDuplicatesWithSummary(entries, fileMap, options)
  return groups
}

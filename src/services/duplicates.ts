import type { DuplicateGroup, FileEntryRecord } from '../types'

interface WorkerResult {
  ok: boolean
  results?: Array<{
    id: string
    certainty: 'confirmed' | 'probable'
    hash: string
    fileIds: string[]
    size: number
  }>
  error?: string
}

export async function findDuplicates(
  entries: FileEntryRecord[],
  fileMap: Map<string, File>,
): Promise<DuplicateGroup[]> {
  const sizeGroups = new Map<number, FileEntryRecord[]>()
  for (const entry of entries) {
    if (entry.kind !== 'file' || entry.size === 0 || !fileMap.has(entry.id)) continue
    const group = sizeGroups.get(entry.size) ?? []
    group.push(entry)
    sizeGroups.set(entry.size, group)
  }

  const candidates = [...sizeGroups.values()]
    .filter((group) => group.length > 1)
    .flat()
    .slice(0, 5000)
    .map((entry) => ({ id: entry.id, size: entry.size, file: fileMap.get(entry.id)! }))

  if (!candidates.length) return []
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]))

  const workerResult = await new Promise<WorkerResult>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/hash.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      resolve(event.data)
      worker.terminate()
    }
    worker.onerror = (event) => {
      reject(new Error(event.message))
      worker.terminate()
    }
    worker.postMessage({ candidates })
  })

  if (!workerResult.ok) throw new Error(workerResult.error || '重复文件检测失败')
  return (workerResult.results ?? [])
    .map((result) => {
      const files = result.fileIds
        .map((id) => entryMap.get(id))
        .filter((entry): entry is FileEntryRecord => Boolean(entry))
        .map((entry) => ({ ...entry, certainty: result.certainty, hash: result.hash }))
      return {
        id: result.id,
        size: result.size,
        reclaimableSize: result.size * Math.max(0, files.length - 1),
        certainty: result.certainty,
        files,
      }
    })
    .filter((group) => group.files.length > 1)
    .sort((a, b) => b.reclaimableSize - a.reclaimableSize)
}

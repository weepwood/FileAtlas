/// <reference lib="webworker" />

interface HashCandidate {
  id: string
  file: File
  size: number
}

interface HashedCandidate extends HashCandidate {
  sampleHash: string
  fullHash?: string
}

const FULL_HASH_LIMIT = 128 * 1024 * 1024
const CHUNK_SIZE = 64 * 1024

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function digest(parts: BlobPart[]): Promise<string> {
  const blob = new Blob(parts)
  return toHex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
}

async function sampleHash(file: File): Promise<string> {
  if (file.size <= CHUNK_SIZE * 3) return digest([file])
  const middle = Math.max(0, Math.floor(file.size / 2 - CHUNK_SIZE / 2))
  return digest([
    file.slice(0, CHUNK_SIZE),
    file.slice(middle, middle + CHUNK_SIZE),
    file.slice(Math.max(0, file.size - CHUNK_SIZE)),
  ])
}

async function fullHash(file: File): Promise<string | undefined> {
  if (file.size > FULL_HASH_LIMIT) return undefined
  return toHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
}

self.onmessage = async (event: MessageEvent<{ candidates: HashCandidate[] }>) => {
  try {
    const sampled: HashedCandidate[] = []
    for (const candidate of event.data.candidates) {
      sampled.push({ ...candidate, sampleHash: await sampleHash(candidate.file) })
    }

    const sampleGroups = new Map<string, HashedCandidate[]>()
    for (const item of sampled) {
      const key = `${item.size}:${item.sampleHash}`
      const group = sampleGroups.get(key) ?? []
      group.push(item)
      sampleGroups.set(key, group)
    }

    const results: Array<{
      id: string
      certainty: 'confirmed' | 'probable'
      hash: string
      fileIds: string[]
      size: number
    }> = []

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

      const fullGroups = new Map<string, HashedCandidate[]>()
      for (const item of group) {
        item.fullHash = await fullHash(item.file)
        if (!item.fullHash) continue
        const matches = fullGroups.get(item.fullHash) ?? []
        matches.push(item)
        fullGroups.set(item.fullHash, matches)
      }
      for (const [hash, matches] of fullGroups) {
        if (matches.length < 2) continue
        results.push({
          id: crypto.randomUUID(),
          certainty: 'confirmed',
          hash,
          fileIds: matches.map((item) => item.id),
          size: matches[0].size,
        })
      }
    }
    self.postMessage({ ok: true, results })
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

import type { FileEntryRecord } from '../types'

export interface SimilarNameGroup {
  id: string
  score: number
  files: FileEntryRecord[]
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  const current = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}

function similarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length)
  return maxLength ? 1 - levenshtein(a, b) / maxLength : 1
}

export function findSimilarNames(entries: FileEntryRecord[]): SimilarNameGroup[] {
  const files = entries.filter((entry) => entry.kind === 'file').slice(0, 3000)
  const buckets = new Map<string, FileEntryRecord[]>()
  for (const file of files) {
    const key = `${file.extension}:${file.normalizedName.slice(0, 2)}`
    const bucket = buckets.get(key) ?? []
    bucket.push(file)
    buckets.set(key, bucket)
  }

  const used = new Set<string>()
  const groups: SimilarNameGroup[] = []
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      const base = bucket[i]
      if (used.has(base.id)) continue
      const matches = [base]
      let scoreTotal = 0
      for (let j = i + 1; j < bucket.length; j += 1) {
        const candidate = bucket[j]
        if (used.has(candidate.id)) continue
        const score = similarity(base.normalizedName, candidate.normalizedName)
        if (score >= 0.78) {
          matches.push(candidate)
          scoreTotal += score
        }
      }
      if (matches.length > 1) {
        matches.forEach((file) => used.add(file.id))
        groups.push({
          id: crypto.randomUUID(),
          score: scoreTotal / (matches.length - 1),
          files: matches,
        })
      }
    }
  }
  return groups.sort((a, b) => b.score - a.score)
}

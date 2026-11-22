import type { FileEntryRecord, Snapshot, SnapshotDiff, ScanStatistics } from '../types'

export function createSnapshot(
  rootName: string,
  entries: FileEntryRecord[],
  statistics: ScanStatistics,
  customLabel?: string,
): Snapshot {
  const trimmed = customLabel?.trim()
  return {
    id: crypto.randomUUID(),
    name: trimmed || `${rootName} · ${new Date().toLocaleString('zh-CN')}`,
    rootName,
    createdAt: Date.now(),
    statistics,
    entries: entries.map((entry) => ({ ...entry })),
  }
}

export function compareSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const beforeMap = new Map(before.entries.map((entry) => [entry.relativePath, entry]))
  const afterMap = new Map(after.entries.map((entry) => [entry.relativePath, entry]))
  const rawAdded: FileEntryRecord[] = []
  const rawRemoved: FileEntryRecord[] = []
  const modified: Array<{ before: FileEntryRecord; after: FileEntryRecord }> = []
  let unchanged = 0

  for (const [path, next] of afterMap) {
    const previous = beforeMap.get(path)
    if (!previous) {
      rawAdded.push(next)
      continue
    }
    if (previous.kind !== next.kind) {
      modified.push({ before: previous, after: next })
    } else if (
      next.kind === 'file' &&
      (previous.size !== next.size || previous.lastModified !== next.lastModified)
    ) {
      modified.push({ before: previous, after: next })
    } else {
      unchanged += 1
    }
  }

  for (const [path, previous] of beforeMap) {
    if (!afterMap.has(path)) rawRemoved.push(previous)
  }

  // Detect moved / renamed non-empty files between rawRemoved and rawAdded
  const moved: Array<{ before: FileEntryRecord; after: FileEntryRecord }> = []
  const matchedRemovedIds = new Set<string>()
  const matchedAddedIds = new Set<string>()

  // Pass 1: Exact non-zero size + lastModified + extension match
  const exactBucket = new Map<string, FileEntryRecord[]>()
  for (const rem of rawRemoved) {
    if (rem.kind !== 'file' || rem.size <= 0 || rem.lastModified <= 0) continue
    const key = `${rem.size}:${rem.lastModified}:${rem.extension}`
    const list = exactBucket.get(key) ?? []
    list.push(rem)
    exactBucket.set(key, list)
  }

  for (const add of rawAdded) {
    if (add.kind !== 'file' || add.size <= 0 || add.lastModified <= 0) continue
    const key = `${add.size}:${add.lastModified}:${add.extension}`
    const candidates = exactBucket.get(key)
    const match = candidates?.find((item) => !matchedRemovedIds.has(item.id))
    if (match) {
      matchedRemovedIds.add(match.id)
      matchedAddedIds.add(add.id)
      moved.push({ before: match, after: add })
    }
  }

  // Pass 2: Non-trivial files (>= 1 KB) with identical size + normalizedName + extension
  const stemBucket = new Map<string, FileEntryRecord[]>()
  for (const rem of rawRemoved) {
    if (matchedRemovedIds.has(rem.id) || rem.kind !== 'file' || rem.size < 1024 || !rem.normalizedName) continue
    const key = `${rem.size}:${rem.extension}:${rem.normalizedName}`
    const list = stemBucket.get(key) ?? []
    list.push(rem)
    stemBucket.set(key, list)
  }

  for (const add of rawAdded) {
    if (matchedAddedIds.has(add.id) || add.kind !== 'file' || add.size < 1024 || !add.normalizedName) continue
    const key = `${add.size}:${add.extension}:${add.normalizedName}`
    const candidates = stemBucket.get(key)
    const match = candidates?.find((item) => !matchedRemovedIds.has(item.id))
    if (match) {
      matchedRemovedIds.add(match.id)
      matchedAddedIds.add(add.id)
      moved.push({ before: match, after: add })
    }
  }

  const added = rawAdded.filter((item) => !matchedAddedIds.has(item.id))
  const removed = rawRemoved.filter((item) => !matchedRemovedIds.has(item.id))

  return {
    added,
    removed,
    modified,
    moved,
    unchanged,
    totalSizeDelta: after.statistics.totalSize - before.statistics.totalSize,
  }
}

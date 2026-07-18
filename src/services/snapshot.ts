import type { FileEntryRecord, Snapshot, SnapshotDiff, ScanStatistics } from '../types'

export function createSnapshot(rootName: string, entries: FileEntryRecord[], statistics: ScanStatistics): Snapshot {
  return {
    id: crypto.randomUUID(),
    name: `${rootName} · ${new Date().toLocaleString('zh-CN')}`,
    rootName,
    createdAt: Date.now(),
    statistics,
    entries: entries.map((entry) => ({ ...entry })),
  }
}

export function compareSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const beforeMap = new Map(before.entries.map((entry) => [entry.relativePath, entry]))
  const afterMap = new Map(after.entries.map((entry) => [entry.relativePath, entry]))
  const added: FileEntryRecord[] = []
  const removed: FileEntryRecord[] = []
  const modified: Array<{ before: FileEntryRecord; after: FileEntryRecord }> = []
  let unchanged = 0

  for (const [path, next] of afterMap) {
    const previous = beforeMap.get(path)
    if (!previous) {
      added.push(next)
      continue
    }
    if (
      previous.kind !== next.kind ||
      previous.size !== next.size ||
      previous.lastModified !== next.lastModified
    ) {
      modified.push({ before: previous, after: next })
    } else {
      unchanged += 1
    }
  }

  for (const [path, previous] of beforeMap) {
    if (!afterMap.has(path)) removed.push(previous)
  }

  return {
    added,
    removed,
    modified,
    unchanged,
    totalSizeDelta: after.statistics.totalSize - before.statistics.totalSize,
  }
}

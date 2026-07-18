import { describe, expect, it } from 'vitest'
import { compareSnapshots } from '../services/snapshot'
import { calculateStatistics, normalizeFileName } from '../utils/file'
import type { FileEntryRecord, Snapshot } from '../types'

const makeFile = (path: string, size: number): FileEntryRecord => ({
  id: `file:${path}`,
  name: path.split('/').at(-1) ?? path,
  normalizedName: normalizeFileName(path),
  relativePath: path,
  parentPath: path.split('/').slice(0, -1).join('/'),
  kind: 'file', extension: 'txt', mimeType: '', size, lastModified: size, depth: 1,
})

const snapshot = (id: string, entries: FileEntryRecord[]): Snapshot => ({
  id, name: id, rootName: 'root', createdAt: 1, entries, statistics: calculateStatistics(entries),
})

describe('snapshot diff', () => {
  it('finds additions, removals and modifications', () => {
    const before = snapshot('before', [makeFile('root/a.txt', 1), makeFile('root/b.txt', 2)])
    const after = snapshot('after', [makeFile('root/a.txt', 3), makeFile('root/c.txt', 4)])
    const diff = compareSnapshots(before, after)
    expect(diff.added).toHaveLength(1)
    expect(diff.removed).toHaveLength(1)
    expect(diff.modified).toHaveLength(1)
    expect(diff.totalSizeDelta).toBe(4)
  })
})

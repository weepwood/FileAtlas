import { describe, expect, it } from 'vitest'
import { compareSnapshots } from '../services/snapshot'
import { calculateStatistics, hydrateDirectoryAggregates, normalizeFileName } from '../utils/file'
import type { FileEntryRecord, Snapshot } from '../types'

const makeFile = (path: string, size: number, lastModified = size): FileEntryRecord => ({
  id: `file:${path}`,
  name: path.split('/').at(-1) ?? path,
  normalizedName: normalizeFileName(path.split('/').at(-1) ?? path),
  relativePath: path,
  parentPath: path.split('/').slice(0, -1).join('/'),
  kind: 'file',
  extension: 'txt',
  mimeType: '',
  size,
  lastModified,
  depth: path.split('/').length - 1,
})

const makeDir = (path: string): FileEntryRecord => ({
  id: `directory:${path}`,
  name: path.split('/').at(-1) ?? path,
  normalizedName: normalizeFileName(path.split('/').at(-1) ?? path),
  relativePath: path,
  parentPath: path.split('/').slice(0, -1).join('/'),
  kind: 'directory',
  extension: '',
  mimeType: '',
  size: 0,
  lastModified: 0,
  depth: path.split('/').length - 1,
})

const snapshot = (id: string, entries: FileEntryRecord[]): Snapshot => {
  const hydrated = hydrateDirectoryAggregates(entries)
  return {
    id,
    name: id,
    rootName: 'root',
    createdAt: 1,
    entries: hydrated,
    statistics: calculateStatistics(hydrated),
  }
}

describe('snapshot diff', () => {
  it('finds additions, removals and modifications without marking ancestor directories modified', () => {
    const before = snapshot('before', [makeDir('root'), makeFile('root/a.txt', 1), makeFile('root/b.txt', 2)])
    const after = snapshot('after', [makeDir('root'), makeFile('root/a.txt', 3), makeFile('root/c.txt', 4)])
    const diff = compareSnapshots(before, after)
    expect(diff.added).toHaveLength(1)
    expect(diff.removed).toHaveLength(1)
    expect(diff.modified).toHaveLength(1)
    expect(diff.moved).toHaveLength(0)
    expect(diff.totalSizeDelta).toBe(4)
  })

  it('recognizes moved or renamed files instead of false remove+add pairs', () => {
    const before = snapshot('before', [
      makeDir('root'),
      makeFile('root/drafts/quarterly-spec.txt', 4096, 1700000000),
    ])
    const after = snapshot('after', [
      makeDir('root'),
      makeFile('root/archive/2026-quarterly-spec.txt', 4096, 1700000000),
    ])
    const diff = compareSnapshots(before, after)
    expect(diff.moved).toHaveLength(1)
    expect(diff.moved[0].before.relativePath).toBe('root/drafts/quarterly-spec.txt')
    expect(diff.moved[0].after.relativePath).toBe('root/archive/2026-quarterly-spec.txt')
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
  })
})

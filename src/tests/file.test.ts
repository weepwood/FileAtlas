import { describe, expect, it } from 'vitest'
import { calculateStatistics, formatBytes, normalizeFileName } from '../utils/file'
import type { FileEntryRecord } from '../types'

const file = (name: string, size: number): FileEntryRecord => ({
  id: `file:${name}`,
  name,
  normalizedName: normalizeFileName(name),
  relativePath: `root/${name}`,
  parentPath: 'root',
  kind: 'file',
  extension: name.split('.').at(-1) ?? '',
  mimeType: '',
  size,
  lastModified: 1,
  depth: 1,
})

describe('file utilities', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('normalizes copy suffixes', () => {
    expect(normalizeFileName('项目报告-副本.docx')).toBe('项目报告')
    expect(normalizeFileName('Report final 2.PDF')).toBe('report')
  })

  it('aggregates scan statistics', () => {
    const stats = calculateStatistics([file('a.txt', 10), file('b.txt', 0)])
    expect(stats.fileCount).toBe(2)
    expect(stats.totalSize).toBe(10)
    expect(stats.emptyFileCount).toBe(1)
  })
})

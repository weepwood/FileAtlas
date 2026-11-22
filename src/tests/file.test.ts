import { describe, expect, it } from 'vitest'
import {
  calculateHealthScore,
  calculateStatistics,
  detectJunkReason,
  formatBytes,
  getAgeBucket,
  hydrateDirectoryAggregates,
  normalizeFileName,
  validateFileNameSafety,
} from '../utils/file'
import type { FileEntryRecord } from '../types'

const file = (name: string, size: number, relativePath = `root/${name}`, lastModified = 1): FileEntryRecord => {
  const segments = relativePath.split('/')
  return {
    id: `file:${relativePath}`,
    name,
    normalizedName: normalizeFileName(name),
    relativePath,
    parentPath: segments.slice(0, -1).join('/'),
    kind: 'file',
    extension: name.includes('.') ? name.split('.').at(-1) ?? '' : '无扩展名',
    mimeType: '',
    size,
    lastModified,
    depth: segments.length - 1,
  }
}

const dir = (relativePath: string): FileEntryRecord => {
  const segments = relativePath.split('/')
  const name = segments.at(-1) ?? relativePath
  return {
    id: `directory:${relativePath}`,
    name,
    normalizedName: normalizeFileName(name),
    relativePath,
    parentPath: segments.length > 1 ? segments.slice(0, -1).join('/') : '',
    kind: 'directory',
    extension: '',
    mimeType: '',
    size: 0,
    lastModified: 0,
    depth: segments.length - 1,
  }
}

describe('file utilities', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('normalizes copy suffixes', () => {
    expect(normalizeFileName('项目报告-副本.docx')).toBe('项目报告')
    expect(normalizeFileName('Report final 2.PDF')).toBe('report')
  })

  it('aggregates scan statistics including cold/hot age buckets', () => {
    const now = 1_700_000_000_000
    const recent = file('a.txt', 100, 'root/a.txt', now - 2 * 86_400_000)
    const cold = file('b.txt', 0, 'root/b.txt', now - 400 * 86_400_000)
    const stats = calculateStatistics([recent, cold], now)
    expect(stats.fileCount).toBe(2)
    expect(stats.totalSize).toBe(100)
    expect(stats.emptyFileCount).toBe(1)
    expect(getAgeBucket(recent.lastModified, now)).toBe('7 天内')
    expect(stats.ageBuckets['7 天内']).toEqual({ count: 1, size: 100 })
    expect(stats.ageBuckets['1 年以上']).toEqual({ count: 1, size: 0 })
  })

  it('hydrates recursive directory sizes, file counts, and latest modified timestamps', () => {
    const entries = hydrateDirectoryAggregates([
      dir('root'),
      dir('root/sub'),
      file('one.bin', 1000, 'root/one.bin', 100),
      file('two.bin', 2500, 'root/sub/two.bin', 500),
    ])
    const rootDir = entries.find((item) => item.relativePath === 'root')!
    const subDir = entries.find((item) => item.relativePath === 'root/sub')!
    expect(rootDir.size).toBe(3500)
    expect(rootDir.childFileCount).toBe(2)
    expect(rootDir.childDirectoryCount).toBe(1)
    expect(rootDir.lastModified).toBe(500)
    expect(subDir.size).toBe(2500)
    expect(subDir.childFileCount).toBe(1)
  })

  it('detects system metadata junk, lock files, and cross-platform unsafe names', () => {
    expect(detectJunkReason(file('.DS_Store', 6148))).toBe('系统元数据残留')
    expect(detectJunkReason(file('~$Budget.xlsx', 162))).toBe('临时锁文件')
    expect(detectJunkReason(file('cache.tmp', 12))).toContain('临时/备份文件')
    expect(detectJunkReason(file('clean-doc.md', 512))).toBeNull()

    expect(validateFileNameSafety('CON.txt')).toContain('Windows 系统保留设备名')
    expect(validateFileNameSafety('bad:name.txt')).toContain('非法字符')
    expect(validateFileNameSafety('trailing-dot.')).toContain('末尾包含空格或句点')
    expect(validateFileNameSafety('2026-clean-report.pdf')).toBeNull()

    const score = calculateHealthScore({
      totalEntries: 50,
      emptyFileCount: 1,
      emptyDirCount: 0,
      deepCount: 0,
      longNameCount: 0,
      junkCount: 1,
    })
    expect(score.score).toBeGreaterThanOrEqual(90)
    expect(score.grade).toBe('优秀')
  })
})

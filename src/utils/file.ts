import type { FileEntryRecord, ScanStatistics } from '../types'

export const SIZE_BUCKETS = [
  '0 B',
  '1 B – 10 KB',
  '10 KB – 1 MB',
  '1 MB – 10 MB',
  '10 MB – 100 MB',
  '100 MB – 1 GB',
  '> 1 GB',
] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export function normalizeFileName(name: string): string {
  return name
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/(?:副本|复制|copy|backup|final|最终版|最新版|new)[-_\s]*(\d+)?$/giu, '')
    .replace(/[\s_-]+/g, ' ')
    .trim()
}

export function getExtension(name: string): string {
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(index + 1).toLocaleLowerCase() : '无扩展名'
}

export function getSizeBucket(size: number): string {
  if (size === 0) return SIZE_BUCKETS[0]
  if (size <= 10 * 1024) return SIZE_BUCKETS[1]
  if (size <= 1024 ** 2) return SIZE_BUCKETS[2]
  if (size <= 10 * 1024 ** 2) return SIZE_BUCKETS[3]
  if (size <= 100 * 1024 ** 2) return SIZE_BUCKETS[4]
  if (size <= 1024 ** 3) return SIZE_BUCKETS[5]
  return SIZE_BUCKETS[6]
}

export function emptyStatistics(): ScanStatistics {
  return {
    fileCount: 0,
    directoryCount: 0,
    totalSize: 0,
    averageFileSize: 0,
    emptyFileCount: 0,
    emptyDirectoryCount: 0,
    maxDepth: 0,
    typeCounts: {},
    sizeBuckets: Object.fromEntries(SIZE_BUCKETS.map((bucket) => [bucket, 0])),
    largestFiles: [],
  }
}

export function calculateStatistics(entries: FileEntryRecord[]): ScanStatistics {
  const stats = emptyStatistics()
  const files = entries.filter((entry) => entry.kind === 'file')
  const directories = entries.filter((entry) => entry.kind === 'directory')

  stats.fileCount = files.length
  stats.directoryCount = directories.length
  stats.totalSize = files.reduce((sum, file) => sum + file.size, 0)
  stats.averageFileSize = stats.fileCount ? stats.totalSize / stats.fileCount : 0
  stats.emptyFileCount = files.filter((file) => file.size === 0).length
  stats.emptyDirectoryCount = directories.filter((directory) => directory.isEmptyDirectory).length
  stats.maxDepth = entries.reduce((max, entry) => Math.max(max, entry.depth), 0)

  for (const file of files) {
    const extension = file.extension || '无扩展名'
    const current = stats.typeCounts[extension] ?? { count: 0, size: 0 }
    stats.typeCounts[extension] = { count: current.count + 1, size: current.size + file.size }
    stats.sizeBuckets[getSizeBucket(file.size)] += 1
  }

  stats.largestFiles = [...files].sort((a, b) => b.size - a.size).slice(0, 20)
  return stats
}

export function createEntryId(path: string, kind: 'file' | 'directory'): string {
  return `${kind}:${path}`
}

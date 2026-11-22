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

export const AGE_BUCKETS = [
  '7 天内',
  '8–30 天',
  '1–6 个月',
  '6–12 个月',
  '1 年以上',
] as const

const DAY_MS = 86_400_000

const SYSTEM_JUNK_NAMES = new Set([
  '.ds_store',
  'thumbs.db',
  'ehthumbs.db',
  'desktop.ini',
  '.spotlight-v100',
  '.trashes',
])

const TEMP_EXTENSIONS = new Set([
  'tmp',
  'temp',
  'bak',
  'old',
  'swp',
  'swo',
  'dmp',
  'crdownload',
  'part',
  'orig',
])

const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
const ILLEGAL_FILENAME_CHARS_RE = /[<>:"/\\|?*]/

export function nowTimestamp(): number {
  return Date.now()
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export function formatRelativeAge(lastModified: number, now = Date.now()): string {
  if (!lastModified || lastModified <= 0) return '未知时间'
  const diffDays = Math.max(0, Math.floor((now - lastModified) / DAY_MS))
  if (diffDays === 0) return '今天'
  if (diffDays < 30) return `${diffDays} 天前`
  if (diffDays < 365) return `${Math.max(1, Math.floor(diffDays / 30))} 个月前`
  return `${(diffDays / 365).toFixed(1)} 年前`
}

export function normalizeFileName(name: string): string {
  return name
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/(?:副本|复制|copy|backup|final|最终版|最新版|new)[-_\s]*(\d+)?$/giu, '')
    .replace(/\(\d+\)$/g, '')
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

export function getAgeBucket(lastModified: number, now = Date.now()): string {
  if (!lastModified || lastModified <= 0) return AGE_BUCKETS[4]
  const ageDays = Math.max(0, (now - lastModified) / DAY_MS)
  if (ageDays <= 7) return AGE_BUCKETS[0]
  if (ageDays <= 30) return AGE_BUCKETS[1]
  if (ageDays <= 180) return AGE_BUCKETS[2]
  if (ageDays <= 365) return AGE_BUCKETS[3]
  return AGE_BUCKETS[4]
}

export function detectJunkReason(entry: FileEntryRecord): string | null {
  if (entry.kind !== 'file') return null
  const lower = entry.name.toLocaleLowerCase()
  if (entry.name !== entry.name.trim()) return '首尾含空白字符'
  if (SYSTEM_JUNK_NAMES.has(lower)) return '系统元数据残留'
  if (lower.startsWith('~$') || lower.startsWith('.~lock.') || entry.name.endsWith('~')) {
    return '临时锁文件'
  }
  const ext = entry.extension.toLocaleLowerCase()
  if (TEMP_EXTENSIONS.has(ext)) return `.${ext} 临时/备份文件`
  return null
}

export function validateFileNameSafety(name: string): string | null {
  if (!name) return '文件名不能为空'
  if (name === '.' || name === '..') return '不能使用保留目录名 . 或 ..'
  const hasControlChar = [...name].some((ch) => ch.charCodeAt(0) < 32)
  if (ILLEGAL_FILENAME_CHARS_RE.test(name) || hasControlChar) {
    return '包含跨平台非法字符 (< > : " / \\ | ? *)'
  }
  if (/[. ]$/.test(name)) return '文件名末尾包含空格或句点，在 Windows 下会导致异常'
  if (WINDOWS_RESERVED_RE.test(name)) return '命中 Windows 系统保留设备名 (CON/PRN/NUL 等)'
  if (name.length >= 255) return '单文件名超过 255 字符文件系统上限'
  return null
}

export function hydrateDirectoryAggregates(entries: FileEntryRecord[]): FileEntryRecord[] {
  const dirAgg = new Map<string, { size: number; files: number; dirs: number; latestMtime: number }>()

  for (const entry of entries) {
    if (entry.kind === 'directory') {
      if (!dirAgg.has(entry.relativePath)) {
        dirAgg.set(entry.relativePath, { size: 0, files: 0, dirs: 0, latestMtime: entry.lastModified || 0 })
      }
    }
  }

  for (const entry of entries) {
    let parent = entry.parentPath
    while (parent) {
      let agg = dirAgg.get(parent)
      if (!agg) {
        agg = { size: 0, files: 0, dirs: 0, latestMtime: 0 }
        dirAgg.set(parent, agg)
      }
      if (entry.kind === 'file') {
        agg.size += entry.size
        agg.files += 1
        if (entry.lastModified > agg.latestMtime) {
          agg.latestMtime = entry.lastModified
        }
      } else {
        agg.dirs += 1
      }
      const slashIdx = parent.lastIndexOf('/')
      parent = slashIdx > 0 ? parent.slice(0, slashIdx) : ''
    }
  }

  return entries.map((entry) => {
    if (entry.kind !== 'directory') return entry
    const agg = dirAgg.get(entry.relativePath)
    if (!agg) return entry
    return {
      ...entry,
      size: agg.size,
      lastModified: entry.lastModified || agg.latestMtime,
      childFileCount: agg.files,
      childDirectoryCount: agg.dirs,
    }
  })
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
    ageBuckets: Object.fromEntries(AGE_BUCKETS.map((bucket) => [bucket, { count: 0, size: 0 }])),
    largestFiles: [],
  }
}

export function calculateStatistics(entries: FileEntryRecord[], now = Date.now()): ScanStatistics {
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

    const ageBucket = getAgeBucket(file.lastModified, now)
    const currentAge = stats.ageBuckets[ageBucket] ?? { count: 0, size: 0 }
    stats.ageBuckets[ageBucket] = {
      count: currentAge.count + 1,
      size: currentAge.size + file.size,
    }
  }

  stats.largestFiles = [...files].sort((a, b) => b.size - a.size).slice(0, 20)
  return stats
}

export function calculateHealthScore(params: {
  totalEntries: number
  emptyFileCount: number
  emptyDirCount: number
  deepCount: number
  longNameCount: number
  junkCount: number
}): { score: number; grade: '优秀' | '良好' | '一般' | '需治理' } {
  if (params.totalEntries <= 0) return { score: 100, grade: '优秀' }
  const penalty =
    Math.min(18, params.emptyFileCount * 2.5) +
    Math.min(16, params.emptyDirCount * 2.5) +
    Math.min(20, params.deepCount * 1.8) +
    Math.min(18, params.longNameCount * 4) +
    Math.min(22, params.junkCount * 2.5)
  const score = Math.max(25, Math.round(100 - penalty))
  const grade = score >= 90 ? '优秀' : score >= 75 ? '良好' : score >= 60 ? '一般' : '需治理'
  return { score, grade }
}

export function createEntryId(path: string, kind: 'file' | 'directory'): string {
  return `${kind}:${path}`
}

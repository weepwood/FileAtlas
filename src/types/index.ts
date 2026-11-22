export type EntryKind = 'file' | 'directory'

export interface FileEntryRecord {
  id: string
  name: string
  normalizedName: string
  relativePath: string
  parentPath: string
  kind: EntryKind
  extension: string
  mimeType: string
  size: number
  lastModified: number
  depth: number
  isEmptyDirectory?: boolean
  childFileCount?: number
  childDirectoryCount?: number
}

export interface ScanProgress {
  files: number
  directories: number
  totalSize: number
  currentPath: string
}

export interface ScanConfig {
  ignoreDefaults: boolean
  customIgnores: string[]
  skipHidden: boolean
  maxDepth: number | null
}

export interface ScanStatistics {
  fileCount: number
  directoryCount: number
  totalSize: number
  averageFileSize: number
  emptyFileCount: number
  emptyDirectoryCount: number
  maxDepth: number
  typeCounts: Record<string, { count: number; size: number }>
  sizeBuckets: Record<string, number>
  ageBuckets: Record<string, { count: number; size: number }>
  largestFiles: FileEntryRecord[]
}

export interface DuplicateProgress {
  phase: 'sampling' | 'full'
  processed: number
  total: number
}

export interface DuplicateFile extends FileEntryRecord {
  certainty: 'confirmed' | 'probable'
  hash: string
  isRecommendedKeep?: boolean
  keepReason?: string
}

export interface DuplicateGroup {
  id: string
  size: number
  reclaimableSize: number
  certainty: 'confirmed' | 'probable'
  recommendedKeepId?: string
  files: DuplicateFile[]
}

export interface Snapshot {
  id: string
  name: string
  rootName: string
  createdAt: number
  statistics: ScanStatistics
  entries: FileEntryRecord[]
}

export interface SnapshotDiff {
  added: FileEntryRecord[]
  removed: FileEntryRecord[]
  modified: Array<{ before: FileEntryRecord; after: FileEntryRecord }>
  moved: Array<{ before: FileEntryRecord; after: FileEntryRecord }>
  unchanged: number
  totalSizeDelta: number
}

export interface BrowserCapabilities {
  directoryPicker: boolean
  webkitDirectory: boolean
  indexedDB: boolean
  webWorker: boolean
  webCrypto: boolean
}

export interface RecentDirectoryRecord {
  id: string
  name: string
  lastScannedAt: number
  fileCount: number
  totalSize: number
  handle?: FileSystemDirectoryHandle
}

export interface ScanResult {
  rootName: string
  entries: FileEntryRecord[]
  files: Map<string, File>
  statistics: ScanStatistics
}

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
}

export interface ScanProgress {
  files: number
  directories: number
  totalSize: number
  currentPath: string
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
  largestFiles: FileEntryRecord[]
}

export interface DuplicateFile extends FileEntryRecord {
  certainty: 'confirmed' | 'probable'
  hash: string
}

export interface DuplicateGroup {
  id: string
  size: number
  reclaimableSize: number
  certainty: 'confirmed' | 'probable'
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

export interface ScanResult {
  rootName: string
  entries: FileEntryRecord[]
  files: Map<string, File>
  statistics: ScanStatistics
}

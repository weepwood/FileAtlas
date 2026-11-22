import { create } from 'zustand'
import type { DuplicateGroup, DuplicateProgress, FileEntryRecord, ScanProgress, ScanStatistics } from '../types'
import { emptyStatistics } from '../utils/file'

interface FileAtlasState {
  rootName: string
  entries: FileEntryRecord[]
  files: Map<string, File>
  statistics: ScanStatistics
  progress: ScanProgress
  status: 'idle' | 'scanning' | 'complete' | 'error'
  error: string
  duplicates: DuplicateGroup[]
  duplicateStatus: 'idle' | 'running' | 'complete' | 'error'
  duplicateProgress: DuplicateProgress | null
  duplicateSkippedCount: number
  setScanning: () => void
  setProgress: (progress: ScanProgress) => void
  setResult: (rootName: string, entries: FileEntryRecord[], files: Map<string, File>, statistics: ScanStatistics) => void
  setError: (message: string) => void
  setDuplicates: (duplicates: DuplicateGroup[], skippedCount?: number) => void
  setDuplicateStatus: (status: FileAtlasState['duplicateStatus']) => void
  setDuplicateProgress: (progress: DuplicateProgress | null) => void
  reset: () => void
}

const initialProgress: ScanProgress = { files: 0, directories: 0, totalSize: 0, currentPath: '' }

export const useFileAtlasStore = create<FileAtlasState>((set) => ({
  rootName: '',
  entries: [],
  files: new Map(),
  statistics: emptyStatistics(),
  progress: initialProgress,
  status: 'idle',
  error: '',
  duplicates: [],
  duplicateStatus: 'idle',
  duplicateProgress: null,
  duplicateSkippedCount: 0,
  setScanning: () =>
    set({
      status: 'scanning',
      error: '',
      duplicates: [],
      duplicateStatus: 'idle',
      duplicateProgress: null,
      duplicateSkippedCount: 0,
      progress: initialProgress,
    }),
  setProgress: (progress) => set({ progress }),
  setResult: (rootName, entries, files, statistics) =>
    set({
      rootName,
      entries,
      files,
      statistics,
      status: 'complete',
      progress: {
        files: statistics.fileCount,
        directories: statistics.directoryCount,
        totalSize: statistics.totalSize,
        currentPath: rootName,
      },
    }),
  setError: (message) => set({ status: 'error', error: message }),
  setDuplicates: (duplicates, skippedCount = 0) =>
    set({
      duplicates,
      duplicateStatus: 'complete',
      duplicateProgress: null,
      duplicateSkippedCount: skippedCount,
    }),
  setDuplicateStatus: (duplicateStatus) => set({ duplicateStatus }),
  setDuplicateProgress: (duplicateProgress) => set({ duplicateProgress }),
  reset: () =>
    set({
      rootName: '',
      entries: [],
      files: new Map(),
      statistics: emptyStatistics(),
      progress: initialProgress,
      status: 'idle',
      error: '',
      duplicates: [],
      duplicateStatus: 'idle',
      duplicateProgress: null,
      duplicateSkippedCount: 0,
    }),
}))

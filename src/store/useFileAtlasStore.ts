import { create } from 'zustand'
import type { DuplicateGroup, FileEntryRecord, ScanProgress, ScanStatistics } from '../types'
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
  setScanning: () => void
  setProgress: (progress: ScanProgress) => void
  setResult: (rootName: string, entries: FileEntryRecord[], files: Map<string, File>, statistics: ScanStatistics) => void
  setError: (message: string) => void
  setDuplicates: (duplicates: DuplicateGroup[]) => void
  setDuplicateStatus: (status: FileAtlasState['duplicateStatus']) => void
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
  setScanning: () => set({ status: 'scanning', error: '', duplicates: [], duplicateStatus: 'idle', progress: initialProgress }),
  setProgress: (progress) => set({ progress }),
  setResult: (rootName, entries, files, statistics) => set({
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
  setDuplicates: (duplicates) => set({ duplicates, duplicateStatus: 'complete' }),
  setDuplicateStatus: (duplicateStatus) => set({ duplicateStatus }),
  reset: () => set({
    rootName: '',
    entries: [],
    files: new Map(),
    statistics: emptyStatistics(),
    progress: initialProgress,
    status: 'idle',
    error: '',
    duplicates: [],
    duplicateStatus: 'idle',
  }),
}))

import { create } from 'zustand'
import type { ScanConfig } from '../types'

export type ThemeMode = 'dark' | 'light'
export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  title: string
  message?: string
  tone: ToastTone
}

export const DEFAULT_IGNORE_NAMES = [
  'node_modules',
  '.git',
  '.idea',
  '.vscode',
  'dist',
  'build',
  'target',
  '.next',
  '.cache',
]

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  ignoreDefaults: true,
  customIgnores: [],
  skipHidden: false,
  maxDepth: null,
}

interface UiState {
  theme: ThemeMode
  isDemo: boolean
  toasts: ToastItem[]
  previewEntryId: string | null
  commandPaletteOpen: boolean
  scanConfig: ScanConfig
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setIsDemo: (isDemo: boolean) => void
  pushToast: (toast: Omit<ToastItem, 'id'>, durationMs?: number) => void
  dismissToast: (id: string) => void
  openPreview: (entryId: string) => void
  closePreview: () => void
  setCommandPaletteOpen: (open: boolean) => void
  updateScanConfig: (patch: Partial<ScanConfig>) => void
  resetScanConfig: () => void
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    const saved = window.localStorage.getItem('fileatlas-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Ignore storage access errors in restricted sandbox contexts
  }
  return 'dark'
}

function getInitialScanConfig(): ScanConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_SCAN_CONFIG }
  try {
    const raw = window.localStorage.getItem('fileatlas-scan-config')
    if (!raw) return { ...DEFAULT_SCAN_CONFIG }
    const parsed = JSON.parse(raw) as Partial<ScanConfig>
    return {
      ignoreDefaults: typeof parsed.ignoreDefaults === 'boolean' ? parsed.ignoreDefaults : true,
      customIgnores: Array.isArray(parsed.customIgnores)
        ? parsed.customIgnores.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        : [],
      skipHidden: typeof parsed.skipHidden === 'boolean' ? parsed.skipHidden : false,
      maxDepth: typeof parsed.maxDepth === 'number' && parsed.maxDepth > 0 ? parsed.maxDepth : null,
    }
  } catch {
    return { ...DEFAULT_SCAN_CONFIG }
  }
}

function persistScanConfig(config: ScanConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem('fileatlas-scan-config', JSON.stringify(config))
  } catch {
    // Ignore storage access errors
  }
}

function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#060c18' : '#f4f7fb')
  }
}

const initialTheme = getInitialTheme()
applyThemeToDocument(initialTheme)

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme,
  isDemo: false,
  toasts: [],
  previewEntryId: null,
  commandPaletteOpen: false,
  scanConfig: getInitialScanConfig(),
  setTheme: (theme) => {
    applyThemeToDocument(theme)
    try {
      window.localStorage.setItem('fileatlas-theme', theme)
    } catch {
      // Ignore storage access errors
    }
    set({ theme })
  },
  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
  setIsDemo: (isDemo) => set({ isDemo }),
  pushToast: (toast, durationMs = 3600) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { ...toast, id }],
    }))
    if (durationMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
      }, durationMs)
    }
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
  openPreview: (entryId) => set({ previewEntryId: entryId }),
  closePreview: () => set({ previewEntryId: null }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  updateScanConfig: (patch) => {
    const next: ScanConfig = { ...get().scanConfig, ...patch }
    persistScanConfig(next)
    set({ scanConfig: next })
  },
  resetScanConfig: () => {
    const next = { ...DEFAULT_SCAN_CONFIG }
    persistScanConfig(next)
    set({ scanConfig: next })
  },
}))

import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light'
export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  title: string
  message?: string
  tone: ToastTone
}

interface UiState {
  theme: ThemeMode
  isDemo: boolean
  toasts: ToastItem[]
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setIsDemo: (isDemo: boolean) => void
  pushToast: (toast: Omit<ToastItem, 'id'>, durationMs?: number) => void
  dismissToast: (id: string) => void
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
}))

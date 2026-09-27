import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'context-theme'

function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* private mode — ignore */
  }
  return 'dark'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readStoredTheme()
  applyTheme(initial)
  return {
    theme: initial,
    setTheme: (theme) => {
      applyTheme(theme)
      set({ theme })
    },
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      set({ theme: next })
    },
  }
})

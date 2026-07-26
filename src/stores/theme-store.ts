import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

const applyTheme = (theme: Theme) => {
  const actualTheme = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(actualTheme)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      toggleTheme: () => {
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light'
          applyTheme(newTheme)
          return { theme: newTheme }
        })
      },
    }),
    {
      name: 'ai_monitor_theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
          // Listen for system theme changes if theme is 'system'
          if (state.theme === 'system' && typeof window !== 'undefined') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            const handler = () => applyTheme('system')
            mediaQuery.addEventListener('change', handler)
          }
        } else {
          applyTheme('light')
        }
      },
    }
  )
)

// Listen for system theme changes when theme is 'system'
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    const store = useThemeStore.getState()
    if (store.theme === 'system') {
      applyTheme('system')
    }
  })
}

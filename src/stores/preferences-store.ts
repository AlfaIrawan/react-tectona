import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'id'
export type LandingPage = 'dashboard' | 'projects'
export type AccentColor = 'gradient' | 'deep-cosmic' | 'indigo-command' | 'frosted-steel' | 'blue-granite'

interface Preferences {
  language: Language
  defaultLandingPage: LandingPage
  fontSize: number
  animationSpeed: number
  accentColor: AccentColor
  sidebarFixed: boolean
  sidebarMini: boolean
  enterpriseNavTitlesOnly: boolean
  enterpriseNavSimpleList: boolean
  boxedLayout: boolean
  fluidContainer: boolean
  reduceAnimations: boolean
  highContrast: boolean
}

interface PreferencesState {
  preferences: Preferences
  setLanguage: (language: Language) => void
  setDefaultLandingPage: (page: LandingPage) => void
  updatePreferences: (preferences: Partial<Preferences>) => void
}

const defaultPreferences: Preferences = {
  language: 'en',
  defaultLandingPage: 'dashboard',
  fontSize: 14,
  animationSpeed: 300,
  accentColor: 'gradient',
  sidebarFixed: false,
  sidebarMini: true,
  enterpriseNavTitlesOnly: false,
  enterpriseNavSimpleList: false,
  boxedLayout: false,
  fluidContainer: true,
  reduceAnimations: false,
  highContrast: false,
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      setLanguage: (language) => {
        set((state) => ({
          preferences: { ...state.preferences, language },
        }))
      },
      setDefaultLandingPage: (defaultLandingPage) => {
        set((state) => ({
          preferences: { ...state.preferences, defaultLandingPage },
        }))
      },
      updatePreferences: (newPreferences) => {
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        }))
      },
    }),
    {
      name: 'ai_monitor_preferences',
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return
        }
        // Migrate removed themes to default
        const accent = state.preferences?.accentColor as string
        const validAccents = ['gradient', 'deep-cosmic', 'indigo-command', 'frosted-steel', 'blue-granite']
        if (accent && !validAccents.includes(accent)) {
          usePreferencesStore.getState().updatePreferences({ accentColor: 'gradient' })
        }
        if (state.preferences?.fontSize) {
          document.documentElement.style.fontSize = `${state.preferences.fontSize}px`
        }
      },
    }
  )
)

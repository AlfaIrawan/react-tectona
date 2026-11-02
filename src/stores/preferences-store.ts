import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeAccent, type AccentColor } from '@/lib/tectonaThemes'
export type { AccentColor } from '@/lib/tectonaThemes'

export type Language = 'en' | 'id'
export type LandingPage = 'dashboard' | 'projects'

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
          preferences: { ...state.preferences, ...newPreferences, accentColor: normalizeAccent(newPreferences.accentColor ?? state.preferences.accentColor) },
        }))
      },
    }),
    {
      name: 'ai_monitor_preferences',
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return
        }
        // Retain user intent when migrating the four retired palettes.
        state.preferences.accentColor = normalizeAccent(state.preferences?.accentColor)
        if (state.preferences?.fontSize) {
          document.documentElement.style.fontSize = `${state.preferences.fontSize}px`
        }
      },
    }
  )
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Active Project Store
 * 
 * Manages the currently active/selected project across the application.
 * This is the root context for all project-scoped operations.
 * 
 * Project-First Enforcement:
 * - All lifecycle entities (Connectors, Runs, Models, Deployments) must belong to a Project
 * - No creation actions are allowed without an active project
 * - The active project is persisted in session storage
 */
interface ActiveProjectState {
  activeProjectId: string | null
  setActiveProject: (projectId: string | null) => void
  clearActiveProject: () => void
  hasActiveProject: () => boolean
}

export const useActiveProjectStore = create<ActiveProjectState>()(
  persist(
    (set, get) => ({
      activeProjectId: null,

      setActiveProject: (projectId) => {
        set({ activeProjectId: projectId })
      },

      clearActiveProject: () => {
        set({ activeProjectId: null })
      },

      hasActiveProject: () => {
        return get().activeProjectId !== null
      },
    }),
    {
      name: 'active-project-storage',
    }
  )
)

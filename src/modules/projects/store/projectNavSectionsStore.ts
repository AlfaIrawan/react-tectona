import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_PROJECT_NAV_SECTIONS,
  type ProjectPanelKey,
  resolveProjectNavSections,
} from '../lib/projectPanelCatalog'

interface ProjectNavSectionsState {
  sectionsByProject: Record<string, ProjectPanelKey[]>
  getSections: (projectId: string) => ProjectPanelKey[]
  addSection: (projectId: string, key: ProjectPanelKey) => void
  removeSection: (projectId: string, key: ProjectPanelKey) => void
  reorderSections: (projectId: string, orderedKeys: ProjectPanelKey[]) => void
}

export const useProjectNavSectionsStore = create<ProjectNavSectionsState>()(
  persist(
    (set, get) => ({
      sectionsByProject: {},

      getSections: (projectId) => resolveProjectNavSections(get().sectionsByProject[projectId]),

      addSection: (projectId, key) => {
        set((state) => {
          const current = resolveProjectNavSections(state.sectionsByProject[projectId])
          if (current.includes(key)) return state
          return {
            sectionsByProject: {
              ...state.sectionsByProject,
              [projectId]: [...current, key],
            },
          }
        })
      },

      removeSection: (projectId, key) => {
        if (key === 'summary') return
        set((state) => {
          const current = resolveProjectNavSections(state.sectionsByProject[projectId])
          return {
            sectionsByProject: {
              ...state.sectionsByProject,
              [projectId]: current.filter((entry) => entry !== key),
            },
          }
        })
      },

      reorderSections: (projectId, orderedKeys) => {
        set((state) => {
          const current = resolveProjectNavSections(state.sectionsByProject[projectId])
          // Keep only keys that were already present, in the caller's new order — never lets
          // reordering silently add or drop a section.
          const currentSet = new Set(current)
          const next = orderedKeys.filter((key) => currentSet.has(key))
          if (next.length !== current.length) return state
          return {
            sectionsByProject: {
              ...state.sectionsByProject,
              [projectId]: next,
            },
          }
        })
      },
    }),
    { name: 'project-nav-sections' },
  ),
)

export { DEFAULT_PROJECT_NAV_SECTIONS }

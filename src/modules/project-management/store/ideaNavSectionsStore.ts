import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type IdeaPanelKey,
  resolveIdeaNavSections,
} from '@/modules/project-management/lib/ideaPanelCatalog'

interface IdeaNavSectionsState {
  sectionsByIdea: Record<string, IdeaPanelKey[]>
  getSections: (ideaId: string) => IdeaPanelKey[]
  reorderSections: (ideaId: string, orderedKeys: IdeaPanelKey[]) => void
}

export const useIdeaNavSectionsStore = create<IdeaNavSectionsState>()(
  persist(
    (set, get) => ({
      sectionsByIdea: {},

      getSections: (ideaId) => resolveIdeaNavSections(get().sectionsByIdea[ideaId]),

      reorderSections: (ideaId, orderedKeys) => {
        set((state) => {
          const current = resolveIdeaNavSections(state.sectionsByIdea[ideaId])
          const currentSet = new Set(current)
          const next = orderedKeys.filter((key) => currentSet.has(key))
          if (next.length !== current.length) return state
          return {
            sectionsByIdea: {
              ...state.sectionsByIdea,
              [ideaId]: next,
            },
          }
        })
      },
    }),
    { name: 'idea-nav-sections' },
  ),
)

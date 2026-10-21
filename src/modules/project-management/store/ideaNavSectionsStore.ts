import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  visibleIdeaNavSections,
  type IdeaPanelKey,
  resolveIdeaNavSections,
} from '@/modules/project-management/lib/ideaPanelCatalog'

const IDEA_NAV_SECTIONS_STORAGE_KEY = 'idea-nav-sections'

/** Top saved section for this idea, read before the store finishes hydrating. */
export function readPersistedIdeaNavTop(ideaId: string): IdeaPanelKey {
  try {
    const raw = localStorage.getItem(IDEA_NAV_SECTIONS_STORAGE_KEY)
    if (!raw) return 'summary'
    const parsed = JSON.parse(raw) as { state?: { sectionsByIdea?: Record<string, IdeaPanelKey[]> } }
    return visibleIdeaNavSections(parsed.state?.sectionsByIdea?.[ideaId], {})[0] ?? 'summary'
  } catch {
    return 'summary'
  }
}

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
    { name: IDEA_NAV_SECTIONS_STORAGE_KEY },
  ),
)

import { create } from 'zustand'

/** Rich page snapshot published by active route (tab, entity, filters). */
export type TectonaPageContextSnapshot = {
  /** Override the module/page label derived from the URL — for surfaces that aren't a real
   * route change (e.g. the OnlyOffice document editor opens as a full-screen overlay on top of
   * whatever page was already active, so the URL alone can't tell the chat "you're now editing
   * this specific document" instead of "you're on the Idea Detail page"). */
  module_label?: string | null
  page_title?: string | null
  view_label?: string | null
  entity_type?: string | null
  entity_id?: string | null
  entity_title?: string | null
  entity_status?: string | null
  workspace_code?: string | null
  workspace_name?: string | null
  project_id?: string | null
  filters_summary?: string | null
  selection_summary?: string | null
  /** Live KPI / counts from the active page (for Gen AI factual answers). */
  data_summary?: string | null
  notes?: string[]
}

type TectonaPageContextState = {
  routeKey: string | null
  snapshot: TectonaPageContextSnapshot | null
  setPageContext: (routeKey: string, snapshot: TectonaPageContextSnapshot) => void
  clearPageContext: (routeKey: string) => void
}

export const useTectonaPageContextStore = create<TectonaPageContextState>((set, get) => ({
  routeKey: null,
  snapshot: null,
  setPageContext: (routeKey, snapshot) => {
    set({ routeKey, snapshot })
  },
  clearPageContext: (routeKey) => {
    const current = get()
    if (current.routeKey === routeKey) {
      set({ routeKey: null, snapshot: null })
    }
  },
}))

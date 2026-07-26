import { create } from 'zustand'

export type SettingsPanelType = 'theme' | 'todo' | null

export interface TodoPanelContext {
  projectId?: string
  projectName?: string
}

interface SettingsPanelState {
  panel: SettingsPanelType
  todoContext: TodoPanelContext | null
  setPanel: (panel: SettingsPanelType) => void
  openTodoPanel: (context?: TodoPanelContext | null) => void
  openThemePanel: () => void
  closePanel: () => void
  clearTodoContext: () => void
}

export const useSettingsPanelStore = create<SettingsPanelState>((set) => ({
  panel: null,
  todoContext: null,
  setPanel: (panel) => set({ panel, todoContext: null }),
  openTodoPanel: (context = null) => set({ panel: 'todo', todoContext: context ?? null }),
  openThemePanel: () => set({ panel: 'theme', todoContext: null }),
  closePanel: () => set({ panel: null, todoContext: null }),
  clearTodoContext: () => set({ todoContext: null }),
}))

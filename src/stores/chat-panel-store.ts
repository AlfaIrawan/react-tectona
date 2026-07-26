import { create } from 'zustand'

const DEFAULT_WIDTH_PCT = 20
const MIN_WIDTH_PCT = 20
const MAX_WIDTH_PCT = 30

interface ChatPanelState {
  open: boolean
  /** Panel width as % of the main content row (below topbar). */
  widthPct: number
  setOpen: (open: boolean) => void
  toggle: () => void
  setWidthPct: (pct: number) => void
  clampWidthPct: (pct: number) => number
}

export function clampChatWidthPct(pct: number): number {
  return Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, pct))
}

export const useChatPanelStore = create<ChatPanelState>((set, get) => ({
  open: false,
  widthPct: DEFAULT_WIDTH_PCT,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
  setWidthPct: (pct) => set({ widthPct: clampChatWidthPct(pct) }),
  clampWidthPct: clampChatWidthPct,
}))

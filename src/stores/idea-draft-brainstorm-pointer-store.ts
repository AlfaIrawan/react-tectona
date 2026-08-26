import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Idea Draft Brainstorm Pointer Store
 *
 * Holds a lightweight pointer (job id + title) to the currently active
 * "Generate Draft" brainstorm chat, so the persistent chat panel can show a
 * resumable session for it even after the Create Idea modal is closed or
 * the user navigates away. The full conversation itself stays server-side
 * (idea-draft-job) and in the Idea Backlog page's local state — this store
 * never carries messages, only enough to re-find and reopen the job.
 */
export type IdeaDraftBrainstormPointer = {
  jobId: string
  title: string
  updatedAt: number
}

type IdeaDraftBrainstormPointerState = {
  pointer: IdeaDraftBrainstormPointer | null
  setPointer: (pointer: IdeaDraftBrainstormPointer) => void
  clearPointer: (jobId?: string) => void
}

export const useIdeaDraftBrainstormPointerStore = create<IdeaDraftBrainstormPointerState>()(
  persist(
    (set, get) => ({
      pointer: null,
      setPointer: (pointer) => set({ pointer }),
      clearPointer: (jobId) => {
        const current = get().pointer
        if (jobId && current?.jobId !== jobId) return
        set({ pointer: null })
      },
    }),
    {
      name: 'idea-draft-brainstorm-pointer-storage',
    },
  ),
)

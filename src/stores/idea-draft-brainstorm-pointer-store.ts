import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'

/**
 * Idea Draft Brainstorm Pointer Store
 *
 * Holds a pointer to the currently active "Generate Draft" brainstorm chat, so
 * the persistent chat panel can show a resumable session for it even after the
 * Create Idea modal is closed or the user navigates away.
 *
 * It also carries a recovery snapshot of the conversation. That is not
 * redundancy: idea-draft jobs live in the agent runtime's memory and can be
 * evicted (IDEA_DRAFT_JOB_NOT_FOUND), so a job id on its own is not enough to
 * resume — without the messages, reopening an evicted session could only fail
 * and drop the entry, which is exactly how the session appeared to vanish when
 * clicked. With the snapshot, the resume path can rebuild the job through
 * restoreIdeaDraftBrainstormSession, the same recovery the composer already
 * performs on send.
 */
export type IdeaDraftBrainstormPointer = {
  jobId: string
  title: string
  updatedAt: number
  /** Recovery snapshot — everything restoreIdeaDraftBrainstormSession needs. */
  tags?: string[]
  workspaceId?: string | null
  sessionId?: string | null
  messages?: IdeaDraftBrainstormMessage[]
  remainingGaps?: string[]
  readyToContinue?: boolean
}

/**
 * localStorage is a shared, size-limited budget, and a long brainstorm is the
 * only thing here that grows without bound. The tail is what recovery needs.
 */
const MAX_SNAPSHOT_MESSAGES = 80

function trimPointer(pointer: IdeaDraftBrainstormPointer): IdeaDraftBrainstormPointer {
  const messages = pointer.messages
  if (!messages || messages.length <= MAX_SNAPSHOT_MESSAGES) return pointer
  return { ...pointer, messages: messages.slice(-MAX_SNAPSHOT_MESSAGES) }
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
      setPointer: (pointer) => set({ pointer: trimPointer(pointer) }),
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

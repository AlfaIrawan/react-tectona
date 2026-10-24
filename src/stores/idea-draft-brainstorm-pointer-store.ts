import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'

/**
 * Idea Draft Brainstorm Pointer Store
 *
 * Holds independent pointers to saved "Generate Draft" brainstorm chats, so
 * the persistent chat panel can show a resumable session for it even after the
 * Create Idea modal is closed or the user navigates away.
 *
 * It also carries a recovery snapshot of the conversation. That is not
 * redundancy: persistence can be unavailable and runtime jobs can be
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
  ownerId?: string
  ideaId?: string | null
  pendingIdeaLink?: boolean
  status?: string
  composerDraft?: string
  form?: { description: string; html?: string; type: string; reviewer: string }
  /** Recovery snapshot — everything restoreIdeaDraftBrainstormSession needs. */
  tags?: string[]
  workspaceId?: string | null
  workspaceName?: string | null
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
  pointers: IdeaDraftBrainstormPointer[]
  removedJobIds: string[]
  setPointer: (pointer: IdeaDraftBrainstormPointer) => void
  retainPointer: (status: string, pointer: IdeaDraftBrainstormPointer) => void
  mergePointers: (pointers: IdeaDraftBrainstormPointer[]) => void
  replacePointer: (jobId: string, pointer: IdeaDraftBrainstormPointer) => void
  markCreated: (jobId: string, ideaId: string, pendingLink?: boolean) => void
  clearPointer: (jobId?: string) => void
}

function upsert(pointers: IdeaDraftBrainstormPointer[], pointer: IdeaDraftBrainstormPointer) {
  return [...pointers.filter((item) => item.jobId !== pointer.jobId), trimPointer(pointer)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export const useIdeaDraftSaveStatusStore = create<{ status: 'saved' | 'failed' }> (() => ({ status: 'saved' }))

export const useIdeaDraftBrainstormPointerStore = create<IdeaDraftBrainstormPointerState>()(
  persist(
    (set, get) => ({
      pointer: null,
      pointers: [],
      removedJobIds: [],
      setPointer: (pointer) => set((state) => ({ pointer: trimPointer(pointer), pointers: upsert(state.pointers, pointer) })),
      retainPointer: (status, pointer) => {
        const current = get().pointers.find((item) => item.jobId === pointer.jobId)
        if (status === 'cancelled') {
          get().clearPointer(pointer.jobId)
          return
        }
        // Generation and failed requests must not discard the recovery snapshot.
        const previous = current?.jobId === pointer.jobId ? current : null
        if (!pointer.messages?.length && !previous && status !== 'awaiting_input' && status !== 'completed') return
        get().setPointer({
          ...previous,
          ...pointer,
          messages: pointer.messages?.length ? pointer.messages : previous?.messages,
        })
      },
      mergePointers: (incoming) => set((state) => {
        let pointers = state.pointers
        for (const pointer of incoming) {
          if (state.removedJobIds.includes(pointer.jobId)) continue
          const previous = pointers.find((item) => item.jobId === pointer.jobId)
          // Server list metadata must never discard the local recovery transcript.
          pointers = upsert(pointers, previous && previous.updatedAt > pointer.updatedAt
            ? { ...pointer, ...previous, ideaId: pointer.ideaId || previous.ideaId }
            : { ...previous, ...pointer, ideaId: pointer.ideaId || previous?.ideaId })
        }
        return { pointers }
      }),
      replacePointer: (jobId, pointer) => set((state) => ({
        pointer: trimPointer(pointer),
        pointers: upsert(state.pointers.filter((item) => item.jobId !== jobId), pointer),
        removedJobIds: [...new Set([...state.removedJobIds, jobId])],
      })),
      markCreated: (jobId, ideaId, pendingLink = false) => set((state) => ({
        pointers: state.pointers.map((item) => item.jobId === jobId ? { ...item, ideaId, pendingIdeaLink: pendingLink } : item),
        pointer: state.pointer?.jobId === jobId ? { ...state.pointer, ideaId, pendingIdeaLink: pendingLink } : state.pointer,
      })),
      clearPointer: (jobId) => {
        if (!jobId) { set({ pointer: null, pointers: [], removedJobIds: [] }); return }
        set((state) => ({
          pointer: state.pointer?.jobId === jobId ? null : state.pointer,
          pointers: state.pointers.filter((item) => item.jobId !== jobId),
          removedJobIds: [...new Set([...state.removedJobIds, jobId])],
        }))
      },
    }),
    {
      name: 'idea-draft-brainstorm-pointer-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
          try {
            // Merge independent drafts written by another tab before replacing the index.
            const incoming = JSON.parse(value)
            const previous = JSON.parse(localStorage.getItem(name) ?? 'null')
            if (incoming.state.pointers.length || incoming.state.removedJobIds.length) {
              const removed = new Set<string>([...incoming.state.removedJobIds, ...(previous?.state?.removedJobIds ?? [])])
              let pointers: IdeaDraftBrainstormPointer[] = previous?.state?.pointers ?? []
              for (const pointer of incoming.state.pointers as IdeaDraftBrainstormPointer[]) {
                const old = pointers.find((item) => item.jobId === pointer.jobId)
                pointers = upsert(pointers, old && old.updatedAt > pointer.updatedAt ? old : pointer)
              }
              incoming.state.pointers = pointers.filter((pointer) => !removed.has(pointer.jobId))
              incoming.state.removedJobIds = [...removed]
              if (incoming.state.pointer && removed.has(incoming.state.pointer.jobId)) incoming.state.pointer = null
            }
            localStorage.setItem(name, JSON.stringify(incoming))
            useIdeaDraftSaveStatusStore.setState({ status: 'saved' })
            queueMicrotask(() => { void useIdeaDraftBrainstormPointerStore.persist.rehydrate() })
          } catch {
            useIdeaDraftSaveStatusStore.setState({ status: 'failed' })
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      version: 1,
      migrate: (persisted) => {
        const previous = persisted as Partial<IdeaDraftBrainstormPointerState>
        return { pointer: previous.pointer ?? null, pointers: previous.pointers ?? (previous.pointer ? [previous.pointer] : []), removedJobIds: [] }
      },
    },
  ),
)

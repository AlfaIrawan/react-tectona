import { create } from 'zustand'

import type { VoiceRecordRequestRealtimePayload } from '@/lib/api/collaborationContextApi'

export type PendingVoiceRecordRequest = {
  fromUserId: string
  targetUserId: string
  noteHint?: string | null
  requestedAt?: string
  workspaceId?: string
  appId?: string
}

export type OutboundVoiceInviteStatus = 'pending' | 'joined'

type VoiceRecordRequestState = {
  pending: PendingVoiceRecordRequest | null
  /** DKM watches this to open the Voice drawer after Accept / notification click. */
  shouldOpenVoiceRecorder: boolean
  openNoteHint: string | null
  /** Requester-side invite status keyed by target user id. */
  outboundByTargetId: Record<string, OutboundVoiceInviteStatus>
  setPendingFromRealtime: (payload: VoiceRecordRequestRealtimePayload) => void
  dismiss: () => void
  accept: (noteHint?: string | null) => void
  /** Open Voice drawer without showing modal (e.g. notification click). */
  requestOpenVoiceRecorder: (noteHint?: string | null) => void
  clearShouldOpenVoiceRecorder: () => void
  markOutboundPending: (targetUserId: string) => void
  markOutboundJoined: (targetUserId: string) => void
  applyAcceptedFromRealtime: (payload: VoiceRecordRequestRealtimePayload, currentUserId: string) => void
  clearOutbound: () => void
  clear: () => void
}

export const useVoiceRecordRequestStore = create<VoiceRecordRequestState>((set, get) => ({
  pending: null,
  shouldOpenVoiceRecorder: false,
  openNoteHint: null,
  outboundByTargetId: {},
  setPendingFromRealtime: (payload) =>
    set({
      pending: {
        fromUserId: payload.from_user_id,
        targetUserId: payload.target_user_id,
        noteHint: payload.note_hint ?? null,
        requestedAt: payload.requested_at,
        workspaceId: payload.workspace_id,
        appId: payload.app_id,
      },
    }),
  dismiss: () => set({ pending: null }),
  accept: (noteHint) =>
    set((state) => ({
      pending: null,
      shouldOpenVoiceRecorder: true,
      openNoteHint:
        (typeof noteHint === 'string' ? noteHint.trim() : null)
        || state.pending?.noteHint?.trim()
        || null,
    })),
  requestOpenVoiceRecorder: (noteHint) =>
    set({
      pending: null,
      shouldOpenVoiceRecorder: true,
      openNoteHint: noteHint?.trim() || null,
    }),
  clearShouldOpenVoiceRecorder: () =>
    set({ shouldOpenVoiceRecorder: false, openNoteHint: null }),
  markOutboundPending: (targetUserId) => {
    if (!targetUserId) return
    set((state) => {
      if (state.outboundByTargetId[targetUserId] === 'joined') return state
      return {
        outboundByTargetId: { ...state.outboundByTargetId, [targetUserId]: 'pending' },
      }
    })
  },
  markOutboundJoined: (targetUserId) => {
    if (!targetUserId) return
    set((state) => ({
      outboundByTargetId: { ...state.outboundByTargetId, [targetUserId]: 'joined' },
    }))
  },
  applyAcceptedFromRealtime: (payload, currentUserId) => {
    const targetId = payload.target_user_id?.trim()
    if (!targetId) return
    const state = get()
    const isRequester = Boolean(currentUserId && payload.from_user_id === currentUserId)
    const waitingForTarget = state.outboundByTargetId[targetId] === 'pending'
    if (!isRequester && !waitingForTarget) return
    set({
      outboundByTargetId: { ...state.outboundByTargetId, [targetId]: 'joined' },
    })
  },
  clearOutbound: () => set({ outboundByTargetId: {} }),
  clear: () =>
    set({
      pending: null,
      shouldOpenVoiceRecorder: false,
      openNoteHint: null,
      outboundByTargetId: {},
    }),
}))

import { getSession } from '@/auth/authService'
import {
  acceptRemoteVoiceRecord,
  TECTONA_CHAT_WORKSPACE_ID,
} from '@/lib/api/collaborationContextApi'
import { resolveChatContactName } from '@/lib/chat/chatContactDirectory'
import { emitNotificationsUpdated } from '@/lib/chat/chatRealtimeEvents'
import { createNotification, TECTONA_APP_ID } from '@/lib/api/notificationApi'
import { useVoiceRecordRequestStore } from '@/stores/voice-record-request-store'

const DKM_PATH = '/document-knowledge-management'

export type VoiceRecordRequestNotifyParams = {
  fromUserId: string
  targetUserId: string
  noteHint?: string | null
  workspaceId?: string
}

/**
 * Persist a panel notification for the target user after a successful remote record request.
 * Caller is the requester (creates notification for the peer).
 */
export function notifyRemoteVoiceRecordRequested(params: VoiceRecordRequestNotifyParams): void {
  const session = getSession()
  if (!session?.user?.id) return
  if (params.targetUserId === session.user.id) return

  const fromName = session.user.name?.trim() || resolveChatContactName(params.fromUserId)
  const title = `${fromName} asks you to record a meeting voice`
  const body = params.noteHint?.trim()
    ? `Suggested title: ${params.noteHint.trim()}`
    : 'Open Voice record in Document & Knowledge Management to capture your side.'

  createNotification({
    app_id: TECTONA_APP_ID,
    user_id: params.targetUserId,
    type_code: 'project',
    title,
    body,
    link_url: DKM_PATH,
    metadata: {
      action: 'voice.record_request',
      from_user_id: params.fromUserId,
      target_user_id: params.targetUserId,
      note_hint: params.noteHint ?? null,
      workspace_id: params.workspaceId ?? null,
    },
    created_from: 'tectona-voice-record-request',
  })
    .then(() => emitNotificationsUpdated())
    .catch(() => {})
}

/** Handle notification panel click for voice.record_request. */
export function openVoiceRecordFromNotificationMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata || metadata.action !== 'voice.record_request') return false
  const noteHint = typeof metadata.note_hint === 'string' ? metadata.note_hint : null
  const fromUserId = typeof metadata.from_user_id === 'string' ? metadata.from_user_id : ''
  const workspaceId =
    typeof metadata.workspace_id === 'string' && metadata.workspace_id.trim()
      ? metadata.workspace_id
      : TECTONA_CHAT_WORKSPACE_ID

  if (fromUserId) {
    void acceptRemoteVoiceRecord(workspaceId, fromUserId, {
      noteHint: noteHint || undefined,
    }).catch(() => undefined)
  }

  useVoiceRecordRequestStore.getState().requestOpenVoiceRecorder(noteHint)
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith(DKM_PATH)) {
    window.dispatchEvent(
      new CustomEvent('tectona:navigate', {
        detail: { pathname: DKM_PATH },
      }),
    )
  }
  return true
}

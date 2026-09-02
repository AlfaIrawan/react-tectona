import { peopleChatPreview } from '@/lib/chat/peopleChatMessagePayload'
import { getSession } from '@/auth/authService'
import { resolveChatContactName } from '@/lib/chat/chatContactDirectory'
import { emitNotificationsUpdated } from '@/lib/chat/chatRealtimeEvents'
import { createNotification, TECTONA_APP_ID } from '@/lib/api/notificationApi'
import { pushGlobalToast } from '@/components/ui/toast'
import { useChatPanelStore } from '@/stores/chat-panel-store'
import { useChatNotificationTargetStore } from '@/stores/chat-notification-target-store'
import { requestOpenChatThread } from '@/stores/chat-navigation-store'
import { playChatMessageNotificationSound } from '@/lib/notifications/chatMessageNotificationSound'
import {
  ensureDesktopNotificationPermission,
  showDesktopNotification,
} from './desktopNotification'

export type IncomingChatMessageNotifyParams = {
  channelId: string
  senderUserId: string
  body: string
  messageId?: string
  channelType?: string
  channelTitle?: string | null
}

const recentNotificationKeys = new Map<string, number>()

export function claimIncomingChatNotificationKey(key: string, windowMs = 8_000): boolean {
  const now = Date.now()
  const prev = recentNotificationKeys.get(key)
  if (prev != null && now - prev < windowMs) return false
  recentNotificationKeys.set(key, now)
  if (recentNotificationKeys.size > 200) {
    for (const [item, at] of recentNotificationKeys) {
      if (now - at > windowMs) recentNotificationKeys.delete(item)
    }
  }
  return true
}

function resolveThreadTitle(params: IncomingChatMessageNotifyParams): string {
  if (params.channelType === 'group' && params.channelTitle?.trim()) {
    return params.channelTitle.trim()
  }
  return resolveChatContactName(params.senderUserId)
}

/** Sound / OS notification only — in-app toast still shows so the alert is visible. */
function shouldSuppressBackgroundAlert(channelId: string): boolean {
  const chatOpen = useChatPanelStore.getState().open
  if (!chatOpen) return false
  const { activeChannelId } = useChatNotificationTargetStore.getState()
  return activeChannelId != null && activeChannelId === channelId
}

function openThreadFromNotification(params: IncomingChatMessageNotifyParams): void {
  requestOpenChatThread({
    channelId: params.channelId,
    senderUserId: params.senderUserId,
    channelType: params.channelType,
    channelTitle: params.channelTitle,
  })
}

/**
 * Toast + OS notification + in-app notification panel entry for an incoming chat message.
 */
export function notifyIncomingChatMessage(params: IncomingChatMessageNotifyParams): void {
  const session = getSession()
  if (!session?.user?.id) return
  if (!params.senderUserId || params.senderUserId === session.user.id) return

  const dedupeKey =
    params.messageId?.trim() ||
    `${params.channelId}:${params.senderUserId}:${peopleChatPreview(params.body, 80)}`
  if (!claimIncomingChatNotificationKey(dedupeKey)) return

  const senderName = resolveChatContactName(params.senderUserId)
  const threadTitle = resolveThreadTitle(params)
  const bodyPreview = peopleChatPreview(params.body, 120) || 'New message'
  const title =
    params.channelType === 'group' ? `${senderName} in ${threadTitle}` : `Message from ${senderName}`

  pushGlobalToast({
    variant: 'default',
    title,
    description: bodyPreview,
    onClick: () => openThreadFromNotification(params),
  })

  const suppressBackground = shouldSuppressBackgroundAlert(params.channelId)
  if (!suppressBackground) {
    playChatMessageNotificationSound()

    const tabHidden = document.visibilityState === 'hidden' || !document.hasFocus()
    const chatOpen = useChatPanelStore.getState().open
    const viewingOtherThread =
      chatOpen && useChatNotificationTargetStore.getState().activeChannelId !== params.channelId
    if (tabHidden || !chatOpen || viewingOtherThread) {
      void ensureDesktopNotificationPermission().then((permission) => {
        if (permission !== 'granted') return
        showDesktopNotification({
          title,
          body: bodyPreview,
          tag: `tectona-chat-${params.channelId}`,
          onClick: () => openThreadFromNotification(params),
        })
      })
    }
  }

  createNotification({
    app_id: TECTONA_APP_ID,
    user_id: session.user.id,
    type_code: 'project',
    title,
    body: bodyPreview,
    metadata: {
      module: 'chat',
      channel_id: params.channelId,
      sender_user_id: params.senderUserId,
      channel_type: params.channelType ?? 'direct',
      channel_title: params.channelTitle ?? null,
    },
    created_from: 'tectona-chat',
  })
    .then(() => emitNotificationsUpdated())
    .catch(() => {})
}

export function openChatFromNotificationMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || metadata.module !== 'chat') return false
  const channelId = typeof metadata.channel_id === 'string' ? metadata.channel_id : ''
  if (!channelId) return false
  requestOpenChatThread({
    channelId,
    senderUserId: typeof metadata.sender_user_id === 'string' ? metadata.sender_user_id : undefined,
    channelType: typeof metadata.channel_type === 'string' ? metadata.channel_type : undefined,
    channelTitle:
      typeof metadata.channel_title === 'string'
        ? metadata.channel_title
        : metadata.channel_title === null
          ? null
          : undefined,
  })
  return true
}

import { pushGlobalToast } from '@/components/ui/toast'

export type NotificationCreatedRealtimePayload = {
  notification_id?: string
  app_id?: string
  user_id?: string
  type_code?: string
  title?: string
  body?: string | null
  link_url?: string | null
  metadata?: Record<string, unknown> | null
}

function toastVariantForPayload(
  payload: NotificationCreatedRealtimePayload,
): 'default' | 'success' | 'error' | 'info' | 'warning' {
  const event = typeof payload.metadata?.event === 'string' ? payload.metadata.event : ''
  if (event === 'access_request.approved') return 'success'
  if (event === 'access_request.rejected') return 'error'
  if (event === 'access_request.submitted') return 'warning'

  return toastVariantForType(payload.type_code)
}

function toastVariantForType(typeCode: string | undefined): 'default' | 'success' | 'error' | 'info' | 'warning' {
  switch (typeCode) {
    case 'workspace_access':
    case 'connector':
      return 'warning'
    case 'dataset':
      return 'success'
    default:
      return 'info'
  }
}

function navigateToLink(linkUrl: string): void {
  const trimmed = linkUrl.trim()
  if (!trimmed) return
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    window.location.assign(trimmed)
    return
  }
  window.location.assign(trimmed.startsWith('/') ? trimmed : `/${trimmed}`)
}

/** Show an in-app toast when notification-service pushes notification.created over WebSocket. */
export function showNotificationCreatedToast(payload: NotificationCreatedRealtimePayload): void {
  const title = payload.title?.trim() || 'New notification'
  const description = payload.body?.trim() || undefined
  const link = payload.link_url?.trim()

  pushGlobalToast({
    variant: toastVariantForPayload(payload),
    title,
    description,
    onClick: link ? () => navigateToLink(link) : undefined,
  })
}

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck, Loader2, AlertCircle, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationApi,
} from '@/lib/api/notificationApi'
import { openChatFromNotificationMetadata } from '@/lib/notifications/notifyChatMessage'
import { openVoiceRecordFromNotificationMetadata } from '@/lib/notifications/notifyVoiceRecordRequest'
import { NOTIFICATIONS_UPDATED_EVENT } from '@/lib/chat/chatRealtimeEvents'
import { cn } from '@/lib/utils'

interface NotificationPanelProps {
  open: boolean
  appId: string
  userId: string
  onOpenChange?: (open: boolean) => void
  onUnreadCountChange?: (count: number) => void
}

function formatNotificationTime(createdAt: string): string {
  try {
    const d = new Date(createdAt)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  } catch {
    return createdAt
  }
}

function typeColor(type: NotificationApi['type']): string {
  switch (type) {
    case 'success':
      return 'bg-green-500/10 text-green-700 dark:text-green-400'
    case 'warning':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
    case 'error':
      return 'bg-red-500/10 text-red-700 dark:text-red-400'
    default:
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
  }
}

function typeIcon(type: NotificationApi['type']) {
  switch (type) {
    case 'success':
      return CheckCircle2
    case 'warning':
      return AlertTriangle
    case 'error':
      return XCircle
    default:
      return Info
  }
}

export function NotificationPanel({
  open,
  appId,
  userId,
  onOpenChange,
  onUnreadCountChange,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationApi[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNotifications = useCallback(async () => {
    if (!appId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchNotifications({ app_id: appId, user_id: userId, page: 1, page_size: 20 })
      setNotifications(res.notifications)
      setUnreadCount(res.unread_count)
      onUnreadCountChange?.(res.unread_count)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load notifications'
      const isUnavailable = msg === 'Failed to fetch' || msg.toLowerCase().includes('network')
      setError(
        isUnavailable
          ? 'Notification service is unavailable. Start the Notification Service (port 8700) to enable this feature.'
          : msg
      )
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [appId, userId, onUnreadCountChange])

  const loadUnreadCount = useCallback(async () => {
    if (!appId || !userId) return
    try {
      const res = await fetchUnreadCount({ app_id: appId, user_id: userId })
      setUnreadCount(res.unread_count)
      onUnreadCountChange?.(res.unread_count)
    } catch {
      // ignore
    }
  }, [appId, userId, onUnreadCountChange])

  useEffect(() => {
    if (open) {
      loadNotifications()
    }
  }, [open, loadNotifications])

  useEffect(() => {
    const onUpdated = () => {
      if (open) void loadNotifications()
      else void loadUnreadCount()
    }
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated)
  }, [open, loadNotifications, loadUnreadCount])

  const handleMarkRead = async (id: string) => {
    if (!appId || !userId) return
    try {
      await markNotificationRead(id, { app_id: appId, user_id: userId })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
      onUnreadCountChange?.(unreadCount - 1)
    } catch {
      // ignore
    }
  }

  const handleMarkAllRead = async () => {
    if (!appId || !userId) return
    try {
      await markAllNotificationsRead({ app_id: appId, user_id: userId })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      onUnreadCountChange?.(0)
    } catch {
      // ignore
    }
  }

  const content = (
    <div className="notification-panel-content w-[360px] max-h-[400px] flex flex-col bg-white dark:bg-slate-900 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80">
        <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Info className="h-10 w-10 text-slate-400 mb-2" />
            <p className="text-sm text-slate-600">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={loadNotifications}
            >
              Retry
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell className="h-10 w-10 text-slate-500 mb-2" />
            <p className="text-sm text-slate-600">No notifications yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/80">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={cn(
                  'px-4 py-3 hover:bg-slate-100/80 transition-colors cursor-pointer',
                  !n.read && 'bg-primary/5'
                )}
                onClick={() => {
                  const openedChat = openChatFromNotificationMetadata(n.metadata ?? null)
                  const openedVoice = openVoiceRecordFromNotificationMetadata(n.metadata ?? null)
                  if (openedChat || openedVoice) {
                    onOpenChange?.(false)
                  }
                  if (!n.read) handleMarkRead(n.id)
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'shrink-0 mt-0.5 w-2 h-2 rounded-full',
                      n.read ? 'bg-transparent' : 'bg-primary'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const Icon = typeIcon(n.type)
                        return <Icon className={cn('h-4 w-4', typeColor(n.type))} />
                      })()}
                      <span
                        className={cn(
                          'text-xs font-medium px-1.5 py-0.5 rounded',
                          typeColor(n.type)
                        )}
                      >
                        {n.type}
                      </span>
                      <span className="text-xs text-slate-600">
                        {formatNotificationTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-0.5 truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMarkRead(n.id)
                      }}
                      aria-label="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  return content
}

export function useNotificationUnreadCount(appId: string, userId: string): {
  unreadCount: number
  refresh: () => Promise<void>
} {
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!appId || !userId) {
      setUnreadCount(0)
      return
    }
    try {
      const res = await fetchUnreadCount({ app_id: appId, user_id: userId })
      setUnreadCount(res.unread_count)
    } catch {
      setUnreadCount(0)
    }
  }, [appId, userId])

  return { unreadCount, refresh }
}

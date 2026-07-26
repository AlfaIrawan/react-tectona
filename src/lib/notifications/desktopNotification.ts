const DESKTOP_CHAT_PREF_KEY = 'tectona:desktop-chat-notifications'

export function isDesktopChatNotificationEnabled(): boolean {
  try {
    const raw = localStorage.getItem(DESKTOP_CHAT_PREF_KEY)
    if (raw === null) return true
    return raw !== 'false'
  } catch {
    return true
  }
}

export function setDesktopChatNotificationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DESKTOP_CHAT_PREF_KEY, enabled ? 'true' : 'false')
  } catch {
    // ignore
  }
}

export function canUseDesktopNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function ensureDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!canUseDesktopNotifications()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export type ShowDesktopNotificationOptions = {
  title: string
  body?: string
  tag?: string
  onClick?: () => void
}

/** Show a native OS notification when permission is granted and chat desktop alerts are enabled. */
export function showDesktopNotification(options: ShowDesktopNotificationOptions): void {
  if (!canUseDesktopNotifications()) return
  if (!isDesktopChatNotificationEnabled()) return
  if (Notification.permission !== 'granted') return

  try {
    const n = new Notification(options.title, {
      body: options.body,
      tag: options.tag,
      icon: '/images/logo.png',
    })
    n.onclick = () => {
      window.focus()
      options.onClick?.()
      n.close()
    }
  } catch {
    // ignore
  }
}

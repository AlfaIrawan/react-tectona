import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, Settings, Bell, Circle, Command, Palette, ListTodo, Mail, MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getSession, logoutAsync } from '@/auth/authService'
import { normalizeUserDisplayName } from '@/lib/userDisplayName'
import { buildLoginPathAfterSignOut } from '@/auth/loginRedirect'
import type { Session } from '@/auth/authService'
import { PresenceDot } from '@/lib/chat/presenceUi'
import { onSessionActive } from '@/auth/sessionEvents'
import { useMyPresenceStore } from '@/stores/my-presence-store'
import { fetchUnreadCount, TECTONA_APP_ID } from '@/lib/api/notificationApi'
import { NOTIFICATIONS_UPDATED_EVENT } from '@/lib/chat/chatRealtimeEvents'
import { AppLauncher } from './AppLauncher'
import { NotificationPanel } from './NotificationPanel'
import { Tooltip } from '@/components/ui/tooltip'
import { useChatPanelStore } from '@/stores/chat-panel-store'
import { useEmailPanelStore } from '@/stores/email-panel-store'
import { PlatformHealthBadge } from './PlatformHealthBadge'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { useTopbarTenantLabel } from '../hooks/useTopbarTenantLabel'
import { WorkspaceManagementGuideTopbarButton } from '@/modules/workspace-management/components/WorkspaceManagementGuideTopbarButton'
import { useModuleAccess } from '@/auth/useModuleAccess'
import { useWorkspaceNavigate } from '@/hooks/useWorkspaceNavigate'

interface TopbarProps {
  sidebarCollapsed: boolean
  accentColor?: string
  onToggleThemeSettings?: () => void
  onToggleTodoPanel?: () => void
}

export function Topbar({ sidebarCollapsed, accentColor, onToggleThemeSettings, onToggleTodoPanel }: TopbarProps) {
  const navigate = useNavigate()
  const workspaceNavigate = useWorkspaceNavigate()
  const moduleAccess = useModuleAccess()
  const chatOpen = useChatPanelStore((s) => s.open)
  const toggleChat = useChatPanelStore((s) => s.toggle)
  const setChatOpen = useChatPanelStore((s) => s.setOpen)
  const emailOpen = useEmailPanelStore((s) => s.open)
  const toggleEmail = useEmailPanelStore((s) => s.toggle)
  const setEmailOpen = useEmailPanelStore((s) => s.setOpen)
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  const myPresence = useMyPresenceStore((s) => s.status)

  // Load session on mount + after login
  useEffect(() => {
    setSession(getSession())
    return onSessionActive(() => setSession(getSession()))
  }, [])

  // Load notification unread count when session is available (for badge)
  const refreshNotificationUnreadCount = useCallback(async () => {
    const current = getSession()
    if (!current?.user?.id) return
    try {
      const res = await fetchUnreadCount({ app_id: TECTONA_APP_ID, user_id: current.user.id })
      setNotificationUnreadCount(res.unread_count)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void refreshNotificationUnreadCount()
    return onSessionActive(() => void refreshNotificationUnreadCount())
  }, [session, refreshNotificationUnreadCount])

  useEffect(() => {
    const onUpdated = () => void refreshNotificationUnreadCount()
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated)
    const intervalId = window.setInterval(() => void refreshNotificationUnreadCount(), 30_000)
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated)
      window.clearInterval(intervalId)
    }
  }, [refreshNotificationUnreadCount])

  const environment =
    (import.meta.env.VITE_APP_ENV as string | undefined)?.trim().toLowerCase() ||
    (import.meta.env.PROD ? 'production' : 'development')
  const userName = normalizeUserDisplayName(session?.user.name || session?.user.email || 'User')
  const { label: topbarTenantLabel, loading: topbarTenantLabelLoading } = useTopbarTenantLabel()

  const handleLogout = () => {
    void logoutAsync().finally(() => {
      navigate(buildLoginPathAfterSignOut(), { replace: true })
    })
  }
  return (
    <header
      className={cn(
        'absolute top-0 right-0 left-0 z-[60] h-12 overflow-visible transition-all duration-300',
        'glass-topbar',
        'left-0'
      )}
    >
      <div className="flex items-center justify-between h-full px-2 gap-2">
        {/* Left Side: Logo + pembatas + nama tenant */}
        <div className="flex items-center gap-3">
          <img
            src={accentColor === 'deep-cosmic' || accentColor === 'blue-granite' ? '/images/logo-white.png' : '/images/logo.png'}
            alt="Tectona"
            className="h-12 w-auto object-contain"
          />
          <div
            className="topbar-tenant-sep h-6 w-px flex-shrink-0 bg-slate-300"
            aria-hidden
          />
          <span
            className="topbar-tenant-name text-base font-medium text-slate-700 whitespace-nowrap max-w-[min(20rem,calc(100vw-24rem))] truncate"
            title={topbarTenantLabelLoading ? undefined : topbarTenantLabel}
          >
            {topbarTenantLabelLoading ? 'Loading…' : topbarTenantLabel}
          </span>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Global Search - wrapper satu blok supaya background seragam (Deep Cosmic) */}
          <div className="topbar-search relative h-8 rounded-md overflow-hidden flex items-center">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none z-[1]">
              <Command className="h-4 w-4 text-slate-500 topbar-search-icon" />
              <span className="text-xs text-slate-500 topbar-search-shortcut">Q</span>
            </div>
            <Input
              type="search"
              placeholder="Search projects, idea backlog, schedules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="topbar-search-input pl-14 pr-2 h-8 w-56 bg-transparent border-0 text-slate-800 placeholder:text-slate-500 focus:ring-0 focus-visible:ring-0 transition-all text-xs rounded-md"
            />
          </div>

          <WorkspaceSwitcher compact menuAlign="end" />

          {/* Environment Indicator - class agar teks tetap gelap di tema topbar gelap */}
          <div className="environment-indicator flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-sm">
            <Circle className={cn(
              'h-2 w-2 shrink-0',
              environment === 'production' 
                ? 'text-red-500 fill-red-500' 
                : 'text-green-500 fill-green-500'
            )} />
            <span className="text-xs font-medium text-slate-800 capitalize">
              {environment}
            </span>
          </div>

          <PlatformHealthBadge />

          <WorkspaceManagementGuideTopbarButton />

          <Tooltip content="Chat" side="bottom" size="compact" sideOffset={6}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'topbar-action-btn hover:bg-gray-100',
                chatOpen && 'bg-gray-100 ring-1 ring-slate-300/80'
              )}
              aria-label="Open chat"
              aria-pressed={chatOpen}
              onClick={() => {
                if (!chatOpen && emailOpen) {
                  setEmailOpen(false)
                }
                toggleChat()
              }}
            >
              <MessageSquare className="h-4 w-4 text-gray-600 topbar-action-icon" />
            </Button>
          </Tooltip>

          <Tooltip content="Email" side="bottom" size="compact" sideOffset={6}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'topbar-action-btn hover:bg-gray-100',
                emailOpen && 'bg-gray-100 ring-1 ring-slate-300/80'
              )}
              aria-label="Open email"
              aria-pressed={emailOpen}
              onClick={() => {
                if (!emailOpen && chatOpen) {
                  setChatOpen(false)
                }
                toggleEmail()
              }}
            >
              <Mail className="h-4 w-4 text-gray-600 topbar-action-icon" />
            </Button>
          </Tooltip>

          {/* Notifications - integrated with python-notification-service-fastapi */}
          <DropdownMenu open={notificationOpen} onOpenChange={setNotificationOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="topbar-action-btn relative hover:bg-gray-100"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-gray-600 topbar-action-icon" />
                {notificationUnreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="p-0 w-auto z-[100] !bg-transparent border-0 shadow-none">
              <NotificationPanel
                open={notificationOpen}
                appId={TECTONA_APP_ID}
                userId={session?.user?.id ?? ''}
                onOpenChange={setNotificationOpen}
                onUnreadCountChange={setNotificationUnreadCount}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Todo List */}
          <Tooltip content="Todo list" side="bottom" size="compact" sideOffset={6}>
            <Button
              variant="ghost"
              size="icon"
              className="topbar-action-btn hover:bg-gray-100"
              aria-label="Todo list"
              onClick={onToggleTodoPanel}
            >
              <ListTodo className="h-4 w-4 text-gray-600 topbar-action-icon" />
            </Button>
          </Tooltip>

          {/* Theme Settings */}
          <Tooltip content="Theme Settings" side="bottom" size="compact" sideOffset={6}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleThemeSettings || (() => {})}
              className="topbar-action-btn hover:bg-gray-100"
              aria-label="Open theme settings"
            >
              <Palette className="h-4 w-4 text-gray-600 topbar-action-icon" />
            </Button>
          </Tooltip>

          {/* App Launcher - Before Account */}
          <AppLauncher />

          {/* User Menu */}
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="topbar-action-btn flex items-center gap-2 px-2 h-8 hover:bg-gray-100"
              >
                <div className="relative h-7 w-7 shrink-0">
                  <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  {session && myPresence !== 'offline' ? (
                    <PresenceDot status={myPresence} size="sm" />
                  ) : null}
                </div>
                <span className="text-xs font-medium hidden sm:inline-block text-gray-700 topbar-action-icon">
                  {userName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              {moduleAccess.isPlatformAdmin ? (
                <DropdownMenuItem onClick={() => workspaceNavigate('/platform-settings-administration')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Platform Settings &amp; Administration
                </DropdownMenuItem>
              ) : null}
              <div className="border-t border-border/40 my-1" />
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

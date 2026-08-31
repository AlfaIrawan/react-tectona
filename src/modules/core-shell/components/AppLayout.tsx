import { useState, useEffect, useCallback, useRef } from 'react'
import { Topbar } from './Topbar'
import { useThemeStore } from '@/stores/theme-store'
import { useSettingsPanelStore } from '@/stores/settings-panel-store'
import { usePreferencesStore } from '@/stores/preferences-store'
import { useChatPanelStore, clampChatWidthPct } from '@/stores/chat-panel-store'
import { useEmailPanelStore, clampEmailWidthPct } from '@/stores/email-panel-store'
import { useUiOverlayStore } from '@/stores/ui-overlay-store'
import { useRightDrawerStore } from '@/stores/right-drawer-store'
import { cn } from '@/lib/utils'
import { Outlet, useLocation } from 'react-router-dom'
import ThemeSettingsPanel from '@/components/settings/ThemeSettingsPanel'
import { TodoListPanel } from './TodoListPanel'
import { publishOfflinePresenceOnPageHide } from '@/auth/authService'
import { useTectonaChatRoleSync } from '@/lib/chat/tectonaChatRoleContext'
import { useCollaborationPresenceRealtime } from '@/lib/chat/useCollaborationPresenceRealtime'
import { usePresenceAfkTracker } from '@/lib/chat/usePresenceAfkTracker'
import { useCollaborationPresenceStore } from '@/stores/collaboration-presence-store'
import { ChatSidebarPanel } from './ChatSidebarPanel'
import { EmailSidebarPanel } from './EmailSidebarPanel'
import { LayoutDebugIndicator, useLayoutDebugMetrics } from './LayoutDebugIndicator'
import { WorkSyncConflictHost } from './WorkSyncConflictHost'
import { VoiceRecordRequestPrompt } from './VoiceRecordRequestPrompt'
import { RequestJoinWorkspaceDrawer } from '@/modules/workspace-management/components/RequestJoinWorkspaceDrawer'
import { useRequestJoinWorkspaceStore } from '@/stores/request-join-workspace-store'
import { useToast } from '@/components/ui/toast'
import { X, ListTodo, Palette, GripHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type { SettingsPanelType } from '@/stores/settings-panel-store'

interface AppLayoutProps {
  children?: React.ReactNode
}

const LAST_ROUTE_STORAGE_KEY = 'tectona:last-route'

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const chatOpen = useChatPanelStore((s) => s.open)
  const chatWidthPct = useChatPanelStore((s) => s.widthPct)
  const setChatWidthPct = useChatPanelStore((s) => s.setWidthPct)
  const setChatOpen = useChatPanelStore((s) => s.setOpen)
  const emailOpen = useEmailPanelStore((s) => s.open)
  const emailWidthPct = useEmailPanelStore((s) => s.widthPct)
  const setEmailWidthPct = useEmailPanelStore((s) => s.setWidthPct)
  const setEmailOpen = useEmailPanelStore((s) => s.setOpen)
  const layoutRowRef = useRef<HTMLDivElement>(null)
  const mainBodyRef = useRef<HTMLDivElement>(null)
  const commPanelRef = useRef<HTMLDivElement>(null)
  const [commResizing, setCommResizing] = useState(false)

  const floatingPanelRef = useRef<HTMLDivElement>(null)
  const floatingDragStateRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const [floatingChatPosition, setFloatingChatPosition] = useState<{ x: number; y: number } | null>(null)

  const { panel: settingsPanel, closePanel } = useSettingsPanelStore()
  const { theme } = useThemeStore()
  const { addToast } = useToast()
  const requestJoinOpen = useRequestJoinWorkspaceStore((s) => s.open)
  const closeRequestJoin = useRequestJoinWorkspaceStore((s) => s.closePanel)
  const rawAccent = usePreferencesStore((s) => s.preferences?.accentColor)
  const validAccents = ['gradient', 'deep-cosmic', 'indigo-command', 'frosted-steel', 'blue-granite']
  const accentColor = validAccents.includes(rawAccent as string) ? rawAccent : 'gradient'

  const themeSettingsOpen = settingsPanel === 'theme'
  const todoPanelOpen = settingsPanel === 'todo'
  const activeCommPanel: 'chat' | 'email' | null = emailOpen ? 'email' : chatOpen ? 'chat' : null
  const isChatCommPanel = activeCommPanel === 'chat'
  const commPanelOpen = activeCommPanel !== null
  // A right-side detail panel (Project/Idea menu, Workspace Details drawer, etc.) would cover a
  // docked chat — float the chat while it's open; it returns to docked when the panel closes.
  const rightDrawerOpen = useRightDrawerStore((s) => s.open)
  const rightDrawerWidth = useRightDrawerStore((s) => s.width)
  const useFloatingChatPanel =
    activeCommPanel === 'chat' && (rightDrawerOpen || requestJoinOpen)
  const commPanelDockedOpen = commPanelOpen && !useFloatingChatPanel
  const commPanelWidthPct = activeCommPanel === 'email' ? emailWidthPct : chatWidthPct
  const hideCommResizeLine = useUiOverlayStore((s) => s.blockingOverlayCount > 0)
  const [panelContentEl, setPanelContentEl] = useState<HTMLElement | null>(null)
  const setPanelContentRef = useCallback((el: HTMLDivElement | null) => setPanelContentEl(el), [])

  const clampFloatingChatPosition = useCallback((candidate: { x: number; y: number }) => {
    const panelRect = floatingPanelRef.current?.getBoundingClientRect()
    const panelWidth = panelRect?.width ?? 544
    const panelHeight = panelRect?.height ?? 704
    const maxX = Math.max(8, window.innerWidth - panelWidth - 8)
    const maxY = Math.max(56, window.innerHeight - panelHeight - 8)
    return {
      x: Math.min(maxX, Math.max(8, candidate.x)),
      y: Math.min(maxY, Math.max(56, candidate.y)),
    }
  }, [])

  const initializeFloatingChatPosition = useCallback(() => {
    const panelRect = floatingPanelRef.current?.getBoundingClientRect()
    const panelWidth = panelRect?.width ?? 544
    const panelHeight = panelRect?.height ?? 704
    const x = Math.max(8, window.innerWidth - panelWidth - 16)
    const y = Math.max(56, window.innerHeight - panelHeight - 16)
    setFloatingChatPosition({ x, y })
  }, [])

  const onFloatingHandlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const panel = floatingPanelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    floatingDragStateRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // pointer capture is a best-effort affordance; dragging still works without it
    }
  }, [])

  const onFloatingHandlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const dragState = floatingDragStateRef.current
      if (!dragState || dragState.pointerId !== e.pointerId) return
      const next = clampFloatingChatPosition({
        x: e.clientX - dragState.offsetX,
        y: e.clientY - dragState.offsetY,
      })
      setFloatingChatPosition(next)
    },
    [clampFloatingChatPosition]
  )

  const onFloatingHandlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = floatingDragStateRef.current
    if (!dragState || dragState.pointerId !== e.pointerId) return
    floatingDragStateRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  // Apply accent/theme data attribute for CSS (e.g. Deep Cosmic Enterprise)
  useEffect(() => {
    if (accentColor) {
      document.documentElement.dataset.accent = accentColor
    } else {
      delete document.documentElement.dataset.accent
    }
  }, [accentColor])

  // Initialize theme on mount
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
  }, [theme])

  // Ensure panel is closed on mount
  useEffect(() => {
    closePanel()
  }, [closePanel])

  const applyPresenceRealtime = useCollaborationPresenceStore((s) => s.applyRealtimeUpdate)
  useCollaborationPresenceRealtime(applyPresenceRealtime)
  usePresenceAfkTracker()
  useTectonaChatRoleSync()

  useEffect(() => {
    const onPageHide = () => publishOfflinePresenceOnPageHide()
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  useEffect(() => {
    if (chatOpen) {
      setChatWidthPct(useChatPanelStore.getState().widthPct)
    }
  }, [chatOpen, setChatWidthPct])

  useEffect(() => {
    if (emailOpen) {
      setEmailWidthPct(useEmailPanelStore.getState().widthPct)
    }
  }, [emailOpen, setEmailWidthPct])

  useEffect(() => {
    if (!useFloatingChatPanel) {
      setFloatingChatPosition(null)
      return
    }

    setFloatingChatPosition((prev) => {
      if (!prev) {
        const panelRect = floatingPanelRef.current?.getBoundingClientRect()
        const panelWidth = panelRect?.width ?? 544
        const panelHeight = panelRect?.height ?? 704
        // When a right-side drawer is open, park the chat to the LEFT of it so it doesn't
        // cover the drawer — reserve exactly as much width as that caller registered.
        const drawerReserve = rightDrawerOpen ? rightDrawerWidth : 0
        const x = Math.max(8, window.innerWidth - panelWidth - 16 - drawerReserve)
        const y = Math.max(56, window.innerHeight - panelHeight - 16)
        return { x, y }
      }

      const clamped = clampFloatingChatPosition(prev)
      if (clamped.x === prev.x && clamped.y === prev.y) return prev
      return clamped
    })
  }, [useFloatingChatPanel, clampFloatingChatPosition, rightDrawerOpen, rightDrawerWidth])

  useEffect(() => {
    if (!useFloatingChatPanel) return
    const onResize = () => {
      setFloatingChatPosition((prev) => {
        if (!prev) return prev
        return clampFloatingChatPosition(prev)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [useFloatingChatPanel, clampFloatingChatPosition])

  // ESC key: close chat first, then email, then settings panel
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (chatOpen) {
        setChatOpen(false)
        return
      }
      if (emailOpen) {
        setEmailOpen(false)
        return
      }
      if (settingsPanel) {
        closePanel()
      }
    }

    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [settingsPanel, closePanel, chatOpen, setChatOpen, emailOpen, setEmailOpen])

  const onCommResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setCommResizing(true)
      const panelAtStart = useFloatingChatPanel ? null : activeCommPanel

      if (!panelAtStart) {
        setCommResizing(false)
        return
      }

      const onMove = (ev: PointerEvent) => {
        const row = layoutRowRef.current
        if (!row) return
        const rect = row.getBoundingClientRect()
        const panelWidthPx = rect.right - ev.clientX
        const pct = (panelWidthPx / rect.width) * 100
        if (panelAtStart === 'email') {
          setEmailWidthPct(clampEmailWidthPct(pct))
        } else {
          setChatWidthPct(clampChatWidthPct(pct))
        }
      }

      const onUp = (ev: PointerEvent) => {
        setCommResizing(false)
        el.releasePointerCapture(ev.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [activeCommPanel, setChatWidthPct, setEmailWidthPct, useFloatingChatPanel]
  )

  // Disable native browser/Windows right-click context menu so only app custom menus show
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  // Persist last visited protected route so home can restore user's latest page.
  useEffect(() => {
    const route = `${location.pathname}${location.search}${location.hash}`
    if (!route || route === '/' || route.startsWith('/login')) return
    try {
      localStorage.setItem(LAST_ROUTE_STORAGE_KEY, route)
    } catch {
      // ignore
    }
  }, [location.pathname, location.search, location.hash])

  const toggleThemeSettings = () => {
    useSettingsPanelStore.getState().panel === 'theme' ? closePanel() : useSettingsPanelStore.getState().openThemePanel()
  }

  const toggleTodoPanel = () => {
    const store = useSettingsPanelStore.getState()
    store.panel === 'todo' ? store.closePanel() : store.openTodoPanel()
  }

  const layoutDebugMetrics = useLayoutDebugMetrics({
    rowRef: layoutRowRef,
    bodyRef: mainBodyRef,
    panelRef: commPanelRef,
    panelOpen: commPanelOpen,
    panelKind: activeCommPanel,
    panelPctStore: commPanelWidthPct,
    remeasureKey: commPanelOpen ? commPanelWidthPct : 0,
  })

  // Re-clamp at RENDER time, not just reactively in effects. `floatingChatPosition` can go stale
  // relative to the CURRENT viewport in ways the effects above don't all catch — e.g. it was
  // computed on an earlier, wider window (or a previous SPA navigation where the panel was also
  // floating) and the viewport later shrank (DevTools docking to a side panel, browser resize)
  // without a `resize` event arriving in time to correct it. Rendering the raw stored value
  // directly (as before) could place the panel fully outside the visible viewport — appearing as
  // "the chat button does nothing" since nothing on-screen ever changes. Clamping here guarantees
  // the panel is always within bounds of whatever the viewport is *right now*, regardless of how
  // the stored position became stale.
  const renderedFloatingChatPosition =
    useFloatingChatPanel && floatingChatPosition ? clampFloatingChatPosition(floatingChatPosition) : floatingChatPosition

  return (
    <div className="relative flex h-[var(--app-vh,100dvh)] min-h-0 flex-col pt-12">
      <Topbar
        sidebarCollapsed={false}
        accentColor={accentColor}
        onToggleThemeSettings={toggleThemeSettings}
        onToggleTodoPanel={toggleTodoPanel}
      />
      <div
        ref={layoutRowRef}
        className="flex min-h-0 flex-1 overflow-hidden overflow-x-hidden transition-[padding] duration-200"
      >
        <div ref={mainBodyRef} data-app-main-body className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-auto scrollbar-hide">
          <main className="relative flex min-h-full flex-1 flex-col">
            <div className="relative mx-auto flex w-full min-h-full max-w-[1920px] flex-1 flex-col px-10 py-3">
              {children || <Outlet />}
            </div>
          </main>
        </div>
        <div
          ref={(el) => {
            commPanelRef.current = el
            // While floating, the same element IS the floating panel (single instance — the
            // chat keeps its active session instead of remounting to Home).
            floatingPanelRef.current = useFloatingChatPanel ? el : floatingPanelRef.current
          }}
          className={cn(
            'relative flex min-h-0 overflow-hidden',
            isChatCommPanel ? 'liquid-glass-chat-panel' : 'bg-card',
            useFloatingChatPanel
              ? 'fixed z-[1150] rounded-2xl border border-border/80 opacity-100 shadow-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08]'
              : cn(
                  'shrink-0 rounded-l-2xl',
                  commPanelDockedOpen && 'h-[calc(var(--app-vh,100vh)-3rem)] max-h-[calc(var(--app-vh,100vh)-3rem)] self-start',
                  commPanelDockedOpen &&
                    (isChatCommPanel
                      ? 'border border-white/45 shadow-[-14px_0_36px_-12px_rgba(15,23,42,0.14)] dark:border-white/12 dark:shadow-[-14px_0_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/20 dark:ring-white/[0.06]'
                      : 'border border-border/70 shadow-[-14px_0_36px_-12px_rgba(15,23,42,0.12),-1px_0_0_rgba(15,23,42,0.04)] dark:border-border dark:shadow-[-14px_0_40px_-12px_rgba(0,0,0,0.55),inset_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-black/[0.03] dark:ring-white/[0.06]'),
                  !commPanelDockedOpen && 'border border-transparent shadow-none ring-0',
                  !commResizing &&
                    'motion-safe:transition-[flex-basis,max-width,opacity] motion-safe:duration-320 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]',
                  commPanelDockedOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                )
          )}
          style={
            useFloatingChatPanel
              ? {
                  // `.liquid-glass-chat-panel` (index.css) hardcodes `position: relative` for its
                  // own glass-effect layering (needed in docked mode, where no Tailwind position
                  // utility is applied) and — depending on CSS layer/source order — that rule can
                  // win over the `fixed` utility class applied here for floating mode. When that
                  // happens the browser renders this element as `position: relative` instead of
                  // `fixed`, so `left`/`top` (computed as viewport-fixed coordinates) get applied
                  // as an offset from the element's normal in-flow position instead — landing the
                  // panel far outside the visible viewport with no visual sign it's "open" at all.
                  // An inline `position` always wins over any class regardless of cascade order,
                  // so pin it explicitly here rather than relying on the `fixed` utility class.
                  position: 'fixed',
                  left: renderedFloatingChatPosition?.x ?? 0,
                  top: renderedFloatingChatPosition?.y ?? 0,
                  width: 'min(34rem, calc(100vw - 1rem))',
                  height: 'min(44rem, calc(var(--app-vh, 100dvh) - 4rem))',
                }
              : {
                  // Docked mode (always used for email; used for chat whenever no right-side
                  // drawer forces floating) is a plain flex sibling with no stacking elevation of
                  // its own — a same-page `fixed` fullscreen panel (e.g. an idea's Summary/Scoring
                  // view) has no reason to know this exists and will simply paint over it. A
                  // small explicit z-index (well below true modals/drawers at 1050+, but above a
                  // typical page-level fullscreen panel's z-50) keeps it visible without fighting
                  // the flex layout — `position: relative` doesn't affect flex sizing at all.
                  position: 'relative',
                  zIndex: 55,
                  flexGrow: 0,
                  flexShrink: 0,
                  flexBasis: commPanelDockedOpen ? `${commPanelWidthPct}%` : '0%',
                  maxWidth: commPanelDockedOpen ? '30%' : '0%',
                  minWidth: 0,
                }
          }
          aria-hidden={!useFloatingChatPanel && !commPanelDockedOpen}
        >
          {useFloatingChatPanel ? (
            <button
              type="button"
              aria-label="Drag chat panel"
              className="absolute left-1/2 top-2 z-10 -translate-x-1/2 cursor-move rounded-full border border-border/70 bg-background/95 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur"
              // `.liquid-glass-chat-panel > *` (index.css) forces every direct child of this panel
              // to `position: relative; z-index: 1` (so panel content stacks above the decorative
              // glass-shine ::before layer) — which breaks this handle's intended `absolute`
              // positioning AND its `z-10` elevation: no longer taken out of flow, it becomes a
              // normal flex item stretched to the panel's full height, and its z-index is capped at
              // 1 — tying it with the sibling `<aside>` content below, which then wins the paint
              // order (later in DOM) and swallows every pointer event meant for this button. Pin
              // both `position` and `zIndex` inline, which always win over any class regardless of
              // cascade order.
              style={{ position: 'absolute', zIndex: 10 }}
              onPointerDown={onFloatingHandlePointerDown}
              onPointerMove={onFloatingHandlePointerMove}
              onPointerUp={onFloatingHandlePointerUp}
              onPointerCancel={onFloatingHandlePointerUp}
            >
              <span className="inline-flex items-center gap-1">
                <GripHorizontal className="h-3.5 w-3.5" aria-hidden />
                Drag chat panel
              </span>
            </button>
          ) : (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize communication panel"
              className={cn(
                'group absolute inset-y-0 left-0 z-[2] cursor-col-resize select-none touch-none',
                'w-3 sm:w-3.5',
                'bg-transparent',
                'transition-[background] duration-200',
                'hover:bg-muted/20 dark:hover:bg-muted/15',
                !commPanelDockedOpen && 'pointer-events-none'
              )}
              // Same `.liquid-glass-chat-panel > *` cascade issue as the floating drag handle above
              // — pin `position: absolute` and `zIndex` inline so this resize strip is actually
              // taken out of flow, pinned to the panel's left edge, and stacked above the sibling
              // `<aside>` content instead of losing the z-index tie to it (both would otherwise be
              // capped at z-index: 1 by the class rule).
              style={{ position: 'absolute', zIndex: 10 }}
              onPointerDown={onCommResizePointerDown}
            >
              <div className="pointer-events-none absolute inset-y-0 right-0 flex w-px items-stretch justify-center py-24">
                <div
                  className={cn(
                    'h-full w-px rounded-full',
                    'bg-gradient-to-b from-transparent via-border/90 to-transparent',
                    'shadow-[0_0_0_1px_rgba(255,255,255,0.55)]',
                    'dark:via-border dark:shadow-[0_0_0_1px_rgba(0,0,0,0.35)]',
                    'transition-all duration-200',
                    'group-hover:via-primary/55 dark:group-hover:via-primary/50',
                    hideCommResizeLine && 'opacity-0'
                  )}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 left-1 flex flex-col items-center justify-center gap-1.5 py-20"
                aria-hidden
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 w-1 rounded-full bg-white',
                      'shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
                      'ring-1 ring-black/[0.08]',
                      'opacity-95 transition-all duration-200',
                      'group-hover:opacity-100 group-hover:shadow-[0_1px_3px_rgba(0,0,0,0.22)]',
                      'dark:bg-white dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)] dark:ring-white/20'
                    )}
                  />
                ))}
              </div>
            </div>
          )}
          <aside
            className={cn(
              'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
              isChatCommPanel ? 'bg-transparent' : 'bg-card',
              useFloatingChatPanel && 'pt-8',
              !commResizing &&
                'motion-safe:transition-transform motion-safe:duration-280 motion-safe:ease-out',
              commPanelDockedOpen || useFloatingChatPanel
                ? 'translate-x-0 motion-safe:delay-[55ms]'
                : '-translate-x-3 motion-safe:delay-0'
            )}
          >
            {activeCommPanel === 'chat' ? <ChatSidebarPanel /> : null}
            {activeCommPanel === 'email' ? <EmailSidebarPanel /> : null}
          </aside>
        </div>
      </div>

      {import.meta.env.DEV ? <LayoutDebugIndicator metrics={layoutDebugMetrics} /> : null}

      {/* Overlay when any settings panel is open */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 backdrop-blur-sm z-[1050] transition-opacity',
          settingsPanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closePanel}
        aria-hidden="true"
        role="button"
        tabIndex={-1}
      />

      {/* Right panel: Theme Settings or Todo List (same drawer) */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full transform z-[1100] transition-all duration-300',
          'bg-white dark:bg-slate-900 shadow-2xl',
          todoPanelOpen ? 'w-[480px]' : 'w-80',
          settingsPanel ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        )}
        style={{
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-border backdrop-blur-sm">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              {themeSettingsOpen && <Palette className="h-5 w-5 text-muted-foreground" aria-hidden />}
              {todoPanelOpen && <ListTodo className="h-5 w-5 text-muted-foreground" aria-hidden />}
              {themeSettingsOpen ? 'Theme Settings' : todoPanelOpen ? 'Todo List' : ''}
            </h2>
            {themeSettingsOpen && (
              <p className="text-xs text-muted-foreground leading-snug max-w-[320px]">
                Customize accent color, font size, and animation speed to match your preference.
              </p>
            )}
            {todoPanelOpen && (
              <p className="text-xs text-muted-foreground leading-snug max-w-[320px]">
                Add tasks, set due dates and priorities, organize by category, and filter by status to stay on top of your work.
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePanel}
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div
          ref={setPanelContentRef}
          className="relative p-4 overflow-y-auto h-[calc(100%-4rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {themeSettingsOpen && <ThemeSettingsPanel />}
          {todoPanelOpen && <TodoListPanel panelContainerEl={panelContentEl} />}
        </div>
      </div>
      <WorkSyncConflictHost />
      <VoiceRecordRequestPrompt />
      <RequestJoinWorkspaceDrawer
        open={requestJoinOpen}
        onClose={closeRequestJoin}
        onSubmitted={(info) => {
          addToast({
            variant: 'success',
            title: 'Join request sent',
            description: `Your request to join ${info.displayName} is pending admin approval.`,
          })
        }}
      />
    </div>
  )
}

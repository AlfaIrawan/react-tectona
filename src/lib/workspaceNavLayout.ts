import { getUiLayoutScale } from '@/lib/uiScale'
import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

/**
 * Tambahan tinggi (px) untuk panel Enterprise Navigation dan area konten sejajar (overview scroll, dll.).
 * Dipakai di calc() Tailwind dan harus selaras dengan penjumlahan piksel di WorkspaceManagementPage.
 */
export const WORKSPACE_NAV_PANEL_HEIGHT_BOOST_PX = 20

/** Padding bawah saat menghitung tinggi panel utama dari viewport. */
export const WORKSPACE_MAIN_PANEL_VIEWPORT_BOTTOM_PAD_PX = 66

/** Tambahan tinggi pasangan panel Enterprise Navigation + panel konten utama. */
export const WORKSPACE_PANEL_PAIR_EXTRA_HEIGHT_PX = 15

export function computeWorkspaceMainPanelViewportHeightPx(panelTopPx: number): number {
  const scale = getUiLayoutScale()
  const viewportH = window.innerHeight / scale
  const stickyTopPx = 48
  const effectiveTop = Math.max(panelTopPx / scale, stickyTopPx)
  const raw = Math.floor(viewportH - effectiveTop - WORKSPACE_MAIN_PANEL_VIEWPORT_BOTTOM_PAD_PX)
  return Math.max(240, raw) + WORKSPACE_NAV_PANEL_HEIGHT_BOOST_PX + WORKSPACE_PANEL_PAIR_EXTRA_HEIGHT_PX
}

/** Samakan tinggi Enterprise Navigation dengan kolom konten (filter + panel utama). */
export function measureEnterpriseNavHeightFromMainPanel(navEl: HTMLElement, mainPanelEl: HTMLElement): number {
  const scale = getUiLayoutScale()
  const navTop = navEl.getBoundingClientRect().top
  const mainBottom = mainPanelEl.getBoundingClientRect().bottom
  const span = Math.floor((mainBottom - navTop) / scale)
  return Math.max(220, span)
}

export function resolveWorkspacePanelHeightStyle(
  viewportPx: number | null,
  alignedPx: number | null,
  maxPx: number | null,
  navDocked: boolean,
): CSSProperties | undefined {
  const resolved =
    viewportPx ?? (alignedPx != null ? alignedPx : !navDocked && maxPx != null ? maxPx : null)
  if (resolved == null) return undefined
  return { height: resolved, maxHeight: resolved, minHeight: resolved }
}

export function workspaceMainPanelViewportHeightStyle(viewportPx: number | null): CSSProperties | undefined {
  if (viewportPx == null) return undefined
  return {
    height: viewportPx,
    maxHeight: viewportPx,
    // Locked to the same value as height/maxHeight (not 0): these panels are flex children with
    // flex-basis:0% (Tailwind's flex-1), so without an explicit minHeight the flexbox algorithm
    // shrinks them to fit their content instead of holding the computed viewport height — the
    // panel would hug a short list instead of filling down to match Document Repository's frame.
    minHeight: viewportPx,
  }
}

/** When Theme Settings → Fixed Sidebar is off, Enterprise nav docks to the left viewport edge (rail), like a classic app sidebar. */
export function isWorkspaceNavDocked(sidebarFixed: boolean) {
  return !sidebarFixed
}

export type WorkspaceNavWidthVariant = 'default' | 'compact' | 'ultra'

function dockedInsetClass(widthVariant: WorkspaceNavWidthVariant) {
  if (widthVariant === 'ultra') return 'xl:pl-[220px]'
  if (widthVariant === 'compact') return 'xl:pl-[260px]'
  return 'xl:pl-[300px]'
}

function dockedWidthClass(widthVariant: WorkspaceNavWidthVariant) {
  if (widthVariant === 'ultra') return 'xl:w-[220px]'
  if (widthVariant === 'compact') return 'xl:w-[260px]'
  return 'xl:w-[300px]'
}

/** Lebar panel Enterprise Navigation saat collapse (icon rail). */
export const WORKSPACE_NAV_COLLAPSED_WIDTH_PX = 56

export function workspaceDockedContentInsetClass(
  docked: boolean,
  isCollapsed: boolean,
  widthVariant: WorkspaceNavWidthVariant = 'default'
) {
  if (!docked) return ''
  return cn(isCollapsed ? 'xl:pl-[56px]' : dockedInsetClass(widthVariant))
}

export function workspaceMainColumnClass(
  docked: boolean,
  isCollapsed: boolean,
  widthVariant: WorkspaceNavWidthVariant = 'default'
) {
  if (!docked) return 'min-w-0 w-full max-w-full space-y-4'
  return cn(
    'min-w-0 w-full max-w-full space-y-4',
    workspaceDockedContentInsetClass(docked, isCollapsed, widthVariant)
  )
}

export function workspaceAsideClass(
  docked: boolean,
  isCollapsed: boolean,
  widthVariant: WorkspaceNavWidthVariant = 'default'
) {
  return cn(
    'space-y-4',
    // Fixed Sidebar (non-docked): sel di grid tidak meregang setinggi kolom konten utama (mencegah panel nav “memanjang”).
    !docked && 'self-start',
    docked &&
      cn(
        // Docked rail: selalu dibatasi viewport. Pada <xl gunakan sticky, pada xl gunakan fixed (top+bottom) agar pasti tidak melewati layar.
        'min-h-0 overflow-hidden xl:flex xl:flex-col',
        // <xl: stick di bawah topbar (h-12) dan batasi tinggi sesuai offset itu
        'max-xl:sticky max-xl:top-12 max-xl:max-h-[calc(var(--app-vh,100vh)-3rem+10px)]',
        // xl: tinggi eksplisit (+ WORKSPACE_NAV_PANEL_HEIGHT_BOOST_PX) — kelas harus literal agar Tailwind JIT mengenali
        'xl:fixed xl:left-[var(--app-main-canvas-left,0px)] xl:top-12 xl:z-30 xl:min-h-0 xl:h-[calc(var(--app-vh,100dvh)-3rem+10px)] xl:max-h-[calc(var(--app-vh,100dvh)-3rem+10px)] xl:h-[calc(var(--app-vh,100vh)-3rem+10px)] xl:max-h-[calc(var(--app-vh,100vh)-3rem+10px)]',
        'xl:pb-0 xl:pr-1 xl:pl-0 xl:pt-0',
        isCollapsed ? 'xl:w-[56px]' : dockedWidthClass(widthVariant)
      )
  )
}

/** Hanya untuk daftar item menu Enterprise Navigation — flex-1 + min-h-0 agar scroll internal bekerja */
export function workspaceNavMenuScrollClass() {
  return cn(
    'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1.5',
    // Hide scrollbar (tetap bisa scroll)
    '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
  )
}

export function workspaceNavInnerClass(docked: boolean, _sidebarFixed: boolean, isCollapsed: boolean) {
  return cn(
    'liquid-glass-enterprise-nav rounded-[28px] border p-3 transition-all duration-200',
    'max-xl:shrink-0',
    // Selalu jadikan panel sebagai flex column + overflow hidden agar hanya area menu yang scroll
    'flex min-h-0 flex-col overflow-hidden',
    // Mode non-docked (Fixed Sidebar = true): batasi tinggi panel agar tidak melebihi viewport
    !docked &&
      'max-h-[calc(var(--app-vh,100dvh)-3rem+10px)] max-h-[calc(var(--app-vh,100vh)-3rem+10px)]',
    docked &&
      cn(
        'liquid-glass-enterprise-nav--docked p-2 max-xl:max-h-[calc(var(--app-vh,100vh)-4rem+10px)] xl:flex-1 xl:h-full xl:max-h-full xl:rounded-r-[28px] xl:rounded-l-none xl:border-r-0',
      ),
    // Fixed Sidebar (non-docked): tinggi diset via JS agar selaras panel utama — jangan pakai sticky + h viewport penuh.
    isCollapsed ? 'w-[56px] p-1.5' : 'w-full'
  )
}

export function workspaceOuterGridClass(sidebarFixed: boolean, isCollapsed: boolean, widthVariant: WorkspaceNavWidthVariant = 'default') {
  if (!sidebarFixed) return 'relative w-full min-w-0'
  // items-start: kolom nav tidak meregang mengikuti tinggi konten utama (mencegah panel setinggi halaman) di semua lebar grid.
  return cn(
    'grid w-full min-w-0 gap-4 items-start',
    isCollapsed
      ? 'xl:grid-cols-[56px_1fr]'
      : widthVariant === 'ultra'
        ? 'xl:grid-cols-[220px_1fr]'
        : widthVariant === 'compact'
          ? 'xl:grid-cols-[260px_1fr]'
          : 'xl:grid-cols-[300px_1fr]'
  )
}

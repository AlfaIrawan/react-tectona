export { PlatformLoadingBackdrop, PlatformLoadingCard } from './PlatformLoadingBackdrop'

/** A) Page/route load — fullscreen gradient + violet spinner card (own visual language). */
export { PlatformRouteLoadingFallback } from './PlatformRouteLoadingFallback'
export type { PlatformRouteLoadingFallbackProps } from './PlatformRouteLoadingFallback'

/** A-alt) Fullscreen shell init overlay (rare). Do not use for API fetch. */
export { PlatformPageLoadingOverlay } from './PlatformPageLoadingOverlay'
export type { PlatformPageLoadingOverlayProps } from './PlatformPageLoadingOverlay'

/** B) Data/API load — enterprise glass card inside page content. */
export { PlatformServiceLoadingPanel } from './PlatformServiceLoadingPanel'
export type { PlatformServiceLoadingPanelProps } from './PlatformServiceLoadingPanel'

/** B-alt) Centered data-loading state (topbar stays); wraps Service panel. */
export { PlatformDataLoadingState } from './PlatformDataLoadingState'
export type { PlatformDataLoadingStateProps } from './PlatformDataLoadingState'

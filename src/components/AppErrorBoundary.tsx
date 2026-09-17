import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { isStaleChunkError, reloadOnceForStaleChunk, clearStaleChunkReloadFlag } from '@/lib/lazyWithReload'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Catches rejected React.lazy() imports. Suspense only covers the pending state;
 * a 404 on a hashed chunk otherwise unmounts the app to a blank page.
 */
class AppErrorBoundaryHost extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
    if (isStaleChunkError(error)) {
      reloadOnceForStaleChunk(error)
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    const stale = isStaleChunkError(this.state.error)
    const detail = this.state.error.message?.trim()
    return (
      <div className="flex h-[var(--app-vh,100dvh)] min-h-[var(--app-vh,100dvh)] w-full items-center justify-center bg-transparent px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/55 bg-white/55 p-6 text-center shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          <h1 className="text-base font-semibold text-foreground">
            {stale ? 'This page needs a refresh' : 'This page could not be shown'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {stale
              ? 'A newer version of Tectona was deployed, so this tab still pointed at files that no longer exist. Reload to load the current build.'
              : 'An unexpected error stopped this screen. Reload and try again. If it keeps happening, stay on this page and tell support.'}
          </p>
          {!stale && detail ? (
            <p className="mt-3 break-words rounded-lg bg-white/50 px-3 py-2 text-left font-mono text-[11px] leading-5 text-slate-700">
              {detail}
            </p>
          ) : null}
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              clearStaleChunkReloadFlag()
              window.location.reload()
            }}
          >
            Reload page
          </Button>
        </div>
      </div>
    )
  }
}

export function AppErrorBoundary({ children }: Props) {
  const { pathname, search } = useLocation()
  return <AppErrorBoundaryHost key={`${pathname}${search}`}>{children}</AppErrorBoundaryHost>
}

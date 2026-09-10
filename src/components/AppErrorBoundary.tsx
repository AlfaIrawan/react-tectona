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
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-foreground">
            {stale ? 'This page needs a refresh' : 'This page could not be shown'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {stale
              ? 'A newer version of Tectona was deployed, so this tab still pointed at files that no longer exist. Reload to load the current build.'
              : 'An unexpected error stopped this screen. Reload and try again. If it keeps happening, stay on this page and tell support.'}
          </p>
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

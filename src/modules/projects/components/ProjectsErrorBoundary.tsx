import type { ReactNode } from 'react'
import { Component } from 'react'
import { EmptyState } from './EmptyState'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  message?: string
}

export class ProjectsErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: unknown): State {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { hasError: true, message }
  }

  componentDidCatch(err: unknown, info: unknown) {
    // Keep logging for dev debugging
    // eslint-disable-next-line no-console
    console.error('[ProjectsErrorBoundary] Caught error:', err, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card rounded-2xl p-10">
          <EmptyState
            title="Projects page error"
            description={
              this.state.message ??
              'Terjadi error saat menampilkan halaman Projects. Silakan refresh atau coba lagi.'
            }
          />
        </div>
      )
    }
    return this.props.children
  }
}


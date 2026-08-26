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
        <div className="liquid-glass-enterprise-panel rounded-2xl p-10">
          <EmptyState
            title="Projects page error"
            description={
              this.state.message ??
              'An error occurred while displaying the Projects page. Please refresh or try again.'
            }
          />
        </div>
      )
    }
    return this.props.children
  }
}


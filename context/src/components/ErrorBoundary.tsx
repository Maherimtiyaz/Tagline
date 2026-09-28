import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Catches render-time errors so the demo degrades gracefully
 * instead of showing a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep it quiet in the console; no external reporting in a frontend-only demo.
    console.error('Context hit an unexpected error:', error, info)
  }

  private handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
              Something interrupted the page
            </p>
            <h1 className="mt-3 text-xl font-medium tracking-tight text-ink">
              Context ran into an unexpected error.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Your thoughts are saved locally. Try reloading — if the problem
              persists, reset the demo from Settings.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Reload
              </button>
              <button
                onClick={this.handleReset}
                className="h-9 rounded-md border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

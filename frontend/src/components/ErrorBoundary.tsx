import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-navy mb-1">Terjadi kesalahan</h2>
          <p className="text-sm text-ink-muted max-w-xs mb-6">
            Aplikasi mengalami gangguan. Coba muat ulang halaman.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary text-sm px-5 py-2"
            >
              Muat ulang
            </button>
            <Link to="/" className="btn-ghost text-sm px-5 py-2" onClick={() => this.setState({ hasError: false, error: null })}>
              Beranda
            </Link>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

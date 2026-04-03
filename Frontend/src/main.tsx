import { Component, type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App'

// Always start light before React runs; App applies saved dark theme only after the user is logged in.
document.documentElement.setAttribute('data-theme', 'light')

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: 32,
            fontFamily: 'Inter, system-ui, sans-serif',
            background: '#F8FAFC',
            color: '#0F172A',
            boxSizing: 'border-box',
          }}
        >
          <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>The app failed to load</h1>
          <p style={{ margin: '0 0 16px', color: '#475569', maxWidth: 560, lineHeight: 1.5 }}>
            A runtime error stopped the UI from rendering. Try clearing site data for this origin or open the
            browser console (F12) for details.
          </p>
          <pre
            style={{
              padding: 16,
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 13,
              maxWidth: '100%',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 8,
              border: 'none',
              background: '#1A56DB',
              color: '#fff',
            }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)

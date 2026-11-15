import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string; stack: string }> {
  state = { hasError: false, message: '', stack: '' }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 4).join('\n') : '',
    }
  }

  componentDidCatch(error: unknown) {
    console.error('[DVM] render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e1b17', color: '#f5eee6', fontFamily: 'Space Mono, monospace', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>DVM-900 — DISPLAY FAULT</h1>
          <p style={{ maxWidth: '32rem', lineHeight: 1.6, marginBottom: '1rem', fontSize: '0.75rem', opacity: 0.85, whiteSpace: 'pre-wrap' }}>{this.state.message}</p>
          {this.state.stack && <pre style={{ maxWidth: '36rem', fontSize: '0.65rem', opacity: 0.6, whiteSpace: 'pre-wrap', marginBottom: '1.25rem' }}>{this.state.stack}</pre>}
          <button onClick={() => window.location.reload()} style={{ padding: '0.75rem 2rem', border: '2px solid #f5eee6', background: 'transparent', color: 'inherit', fontFamily: 'inherit', letterSpacing: '0.1em', cursor: 'pointer' }}>RELOAD TERMINAL</button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

import { Component, ReactNode } from 'react'

/** a failure inside the game (or its lazy chunk) closes only the game, never the app */
export class GameBoundary extends Component<{ onExit: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 26, background: 'var(--paper)', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="h3">თამაში ამჯერად ვერ ჩაირთო.</div>
          <button className="pill-btn btn-primary" onClick={this.props.onExit}>უკან გზაზე</button>
        </div>
      </div>
    )
  }
}

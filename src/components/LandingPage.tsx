import { useState, useEffect } from 'react'
import './LandingPage.css'

export function LandingPage() {
  const [glitch, setGlitch] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true)
      setTimeout(() => setGlitch(false), 150)
    }, 4000 + Math.random() * 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="landing">
      <div className="scanline" />
      <div className="landing-grid" />

      <div className="landing-content">
        {/* Hero */}
        <header className="landing-hero">
          <div className="landing-logo-row">
            <div className="landing-logo-icon">⟐</div>
            <h1 className={`landing-title ${glitch ? 'glitch' : ''}`}>
              <span className="title-claw">Claw</span><span className="title-tabs">Tabs</span>
            </h1>
          </div>
          <p className="landing-tagline">Multi-session chat UI for <span className="hl">OpenClaw</span></p>
          <div className="landing-status-bar">
            <span className="status-dot pulse" /> <span className="status-text">SYSTEM READY</span>
          </div>
        </header>

        {/* Screenshot */}
        <section className="landing-screenshot-section">
          <div className="landing-screenshot-frame">
            <div className="frame-header">
              <span className="frame-dot red" /><span className="frame-dot yellow" /><span className="frame-dot green" />
              <span className="frame-title">clawtabs://preview</span>
            </div>
            <img src="/screenshot.png" alt="ClawTabs UI" className="landing-screenshot" />
          </div>
        </section>

        {/* Features */}
        <section className="landing-features">
          <h2 className="section-header"><span className="section-marker">▸</span> CAPABILITIES</h2>
          <div className="features-grid">
            {[
              ['⚡', 'Multi-Session', 'Run multiple chat sessions simultaneously with tabbed navigation'],
              ['🔌', 'Real-time Streaming', 'WebSocket-powered live streaming of AI responses'],
              ['🎛️', 'Ops Panel', 'Monitor sub-agents, cron jobs, and background workers'],
              ['🔍', 'Session Search', 'Instantly search across all sessions and messages'],
              ['⌨️', 'Keyboard Shortcuts', 'Ctrl+N, Ctrl+W, Ctrl+Tab — power-user workflow'],
              ['🎨', 'Cyberpunk UI', 'Terminal-inspired aesthetic with scanline effects'],
              ['📎', 'File Attachments', 'Drag & drop files and images into conversations'],
              ['📝', 'Markdown Rendering', 'Full markdown with syntax-highlighted code blocks'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="feature-card">
                <div className="feature-icon">{icon}</div>
                <div className="feature-title">{title}</div>
                <div className="feature-desc">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Get Started */}
        <section className="landing-getstarted">
          <h2 className="section-header"><span className="section-marker">▸</span> GET STARTED</h2>
          <div className="install-steps">
            <div className="install-step">
              <span className="step-num">01</span>
              <div className="step-content">
                <div className="step-title">Install OpenClaw</div>
                <code className="step-code">npm install -g openclaw</code>
              </div>
            </div>
            <div className="install-step">
              <span className="step-num">02</span>
              <div className="step-content">
                <div className="step-title">Start the Gateway</div>
                <code className="step-code">openclaw gateway start</code>
              </div>
            </div>
            <div className="install-step">
              <span className="step-num">03</span>
              <div className="step-content">
                <div className="step-title">Clone & Run ClawTabs</div>
                <code className="step-code">git clone https://github.com/marty-mcbyte/ClawTabs<br/>cd ClawTabs && npm install && npm run dev</code>
              </div>
            </div>
            <div className="install-step">
              <span className="step-num">04</span>
              <div className="step-content">
                <div className="step-title">Connect</div>
                <code className="step-code">Open http://localhost:5173?gateway=ws://localhost:18789&token=YOUR_TOKEN</code>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="landing-cta">
          <a href="https://github.com/marty-mcbyte/ClawTabs" target="_blank" rel="noopener noreferrer" className="cta-button">
            <span className="cta-icon">⟐</span> View on GitHub
          </a>
          <p className="landing-footnote">Open source · MIT License · Built for OpenClaw operators</p>
        </section>
      </div>
    </div>
  )
}

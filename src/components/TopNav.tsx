import { motion } from 'framer-motion'

const navItems = [
  { id: 'home', label: 'Home', icon: '◈' },
  { id: 'ops', label: 'Ops', icon: '◉' },
  { id: 'agents', label: 'Agents', icon: '◆' },
  { id: 'chat', label: 'Chat', icon: '◊' },
  { id: 'content', label: 'Content', icon: '○' },
  { id: 'comms', label: 'Comms', icon: '⚡' },
  { id: 'knowledge', label: 'Knowledge', icon: '◐' },
  { id: 'code', label: 'Code', icon: '◯' },
] as const

export type NavTabType = 'home' | 'ops' | 'agents' | 'chat' | 'content' | 'comms' | 'knowledge' | 'code' | 'legacy'

interface TopNavProps {
  activeTab: string
  onTabChange: (tab: NavTabType) => void
  connectedCount?: number
  totalCount?: number
}

export function TopNav({ activeTab, onTabChange, connectedCount = 0, totalCount = 0 }: TopNavProps) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  })

  return (
    <header className="top-nav">
      <div className="top-nav-brand">
        <div className="brand-logo">
          <img src="/mascot.jpg" alt="ClawTabs" className="brand-mascot" />
          <span className="brand-name">CLAWTABS</span>
          <span className="brand-version">v0.6</span>
        </div>
      </div>

      <nav className="top-nav-menu">
        {navItems.map((item) => (
          <motion.button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'nav-item-active' : ''}`}
            onClick={() => onTabChange(item.id as NavTabType)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {activeTab === item.id && (
              <motion.div
                className="nav-indicator"
                layoutId="nav-indicator"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </nav>

      <div className="top-nav-status">
        <div className="status-pill">
          <span className="status-dot connected" />
          <span className="status-text">{connectedCount}/{totalCount}</span>
        </div>
        <div className="time-display">{timeStr}</div>
      </div>
    </header>
  )
}

interface MobileNavProps {
  activeTab: string
  onTabChange: (tab: NavTabType) => void
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`mobile-nav-item ${activeTab === item.id ? 'mobile-nav-active' : ''}`}
          onClick={() => onTabChange(item.id as NavTabType)}
        >
          <span className="mobile-nav-icon">{item.icon}</span>
          <span className="mobile-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

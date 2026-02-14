import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  hover?: boolean
  onClick?: () => void
}

export function GlassCard({ children, className = '', style, hover = false, onClick }: GlassCardProps) {
  return (
    <motion.div
      className={`glass-card ${className} ${hover ? 'glass-card-hover' : ''} ${onClick ? 'glass-card-clickable' : ''}`}
      style={style}
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  )
}

interface StatusCardProps {
  title: string
  value: string | number
  subtitle?: string
  status: 'healthy' | 'warning' | 'critical' | 'neutral'
  icon?: ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
}

export function StatusCard({ title, value, subtitle, status, icon, trend, trendValue }: StatusCardProps) {
  const statusColors = {
    healthy: 'var(--status-healthy)',
    warning: 'var(--status-warning)',
    critical: 'var(--status-critical)',
    neutral: 'var(--text-secondary)'
  }

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→'
  }

  return (
    <GlassCard className="status-card" hover>
      <div className="status-card-header">
        <span className="status-card-title">{title}</span>
        {icon && <span className="status-card-icon">{icon}</span>}
      </div>
      <div className="status-card-value" style={{ color: statusColors[status] }}>
        {value}
      </div>
      {subtitle && <div className="status-card-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`status-card-trend status-card-trend-${trend}`}>
          <span className="trend-icon">{trendIcons[trend]}</span>
          {trendValue && <span className="trend-value">{trendValue}</span>}
        </div>
      )}
    </GlassCard>
  )
}

interface LiveIndicatorProps {
  interval?: string
}

export function LiveIndicator({ interval = '15S' }: LiveIndicatorProps) {
  return (
    <div className="live-indicator">
      <span className="live-dot" />
      <span className="live-text">LIVE</span>
      <span className="live-interval">AUTO {interval}</span>
    </div>
  )
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Session } from '../types'
import './CommandPalette.css'

interface Command {
  id: string
  label: string
  shortcut?: string
  icon: string
  category: 'session' | 'view' | 'help'
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  sessions: Session[]
  activeSessionId: string
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onCloseSession: (id: string) => void
  onToggleSplit: () => void
  isSplit: boolean
}

function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()
  
  // Exact match gets highest score
  if (lowerText === lowerQuery) return { match: true, score: 100 }
  
  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return { match: true, score: 90 }
  
  // Contains query as substring
  if (lowerText.includes(lowerQuery)) return { match: true, score: 70 }
  
  // Fuzzy match - all characters in order
  let queryIdx = 0
  let consecutiveBonus = 0
  let lastMatchIdx = -1
  
  for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      if (lastMatchIdx === i - 1) consecutiveBonus += 5
      lastMatchIdx = i
      queryIdx++
    }
  }
  
  if (queryIdx === lowerQuery.length) {
    const score = 50 + consecutiveBonus - (lastMatchIdx - lowerQuery.length)
    return { match: true, score: Math.max(10, Math.min(score, 69)) }
  }
  
  return { match: false, score: 0 }
}

export function CommandPalette({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onCloseSession,
  onToggleSplit,
  isSplit
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Build command list
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
      {
        id: 'new-session',
        label: 'New Session',
        shortcut: 'Ctrl+N',
        icon: '✧',
        category: 'session',
        action: () => { onCreateSession(); onClose() }
      },
      {
        id: 'toggle-split',
        label: isSplit ? 'Close Split View' : 'Toggle Split View',
        shortcut: 'Ctrl+\\',
        icon: '⫿',
        category: 'view',
        action: () => { onToggleSplit(); onClose() }
      },
      {
        id: 'close-session',
        label: 'Close Current Session',
        shortcut: 'Ctrl+W',
        icon: '✕',
        category: 'session',
        action: () => { onCloseSession(activeSessionId); onClose() }
      },
      {
        id: 'shortcuts',
        label: 'Show Keyboard Shortcuts',
        shortcut: '?',
        icon: '⌘',
        category: 'help',
        action: () => setShowShortcuts(true)
      }
    ]

    // Add session switching commands
    sessions.forEach((session, idx) => {
      cmds.push({
        id: `switch-${session.id}`,
        label: `Switch to: ${session.name}`,
        shortcut: idx < 9 ? `Ctrl+${idx + 1}` : undefined,
        icon: session.id === activeSessionId ? '●' : '○',
        category: 'session',
        action: () => { onSelectSession(session.id); onClose() }
      })
    })

    return cmds
  }, [sessions, activeSessionId, isSplit, onCreateSession, onToggleSplit, onCloseSession, onSelectSession, onClose])

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands

    return commands
      .map(cmd => ({ cmd, ...fuzzyMatch(query, cmd.label) }))
      .filter(item => item.match)
      .sort((a, b) => b.score - a.score)
      .map(item => item.cmd)
  }, [commands, query])

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredCommands.length, query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setShowShortcuts(false)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector('.cp-item-selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const executeSelected = useCallback(() => {
    if (filteredCommands[selectedIndex]) {
      filteredCommands[selectedIndex].action()
    }
  }, [filteredCommands, selectedIndex])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        executeSelected()
        break
      case 'Escape':
        e.preventDefault()
        if (showShortcuts) {
          setShowShortcuts(false)
        } else {
          onClose()
        }
        break
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
        } else {
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
        }
        break
    }
  }, [filteredCommands.length, executeSelected, onClose, showShortcuts])

  if (!isOpen) return null

  const shortcuts = [
    { key: 'Ctrl+K / ⌘K', desc: 'Open command palette' },
    { key: 'Ctrl+N', desc: 'New session' },
    { key: 'Ctrl+W', desc: 'Close current session' },
    { key: 'Ctrl+\\', desc: 'Toggle split view' },
    { key: 'Ctrl+Tab', desc: 'Next session' },
    { key: 'Ctrl+Shift+Tab', desc: 'Previous session' },
    { key: 'Ctrl+1-9', desc: 'Switch to session 1-9' },
    { key: '↑/↓', desc: 'Navigate commands' },
    { key: 'Enter', desc: 'Execute command' },
    { key: 'Escape', desc: 'Close palette' }
  ]

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-container" onClick={e => e.stopPropagation()}>
        <div className="cp-header">
          <span className="cp-icon">▣</span>
          <input
            ref={inputRef}
            className="cp-input"
            type="text"
            placeholder={showShortcuts ? 'Keyboard Shortcuts' : 'Type a command or search...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={showShortcuts}
          />
          <span className="cp-hint">ESC to close</span>
        </div>

        {showShortcuts ? (
          <div className="cp-shortcuts">
            <div className="cp-shortcuts-title">
              <span className="cp-shortcuts-icon">⌘</span>
              KEYBOARD SHORTCUTS
            </div>
            <div className="cp-shortcuts-list">
              {shortcuts.map(({ key, desc }) => (
                <div key={key} className="cp-shortcut-row">
                  <span className="cp-shortcut-key">{key}</span>
                  <span className="cp-shortcut-desc">{desc}</span>
                </div>
              ))}
            </div>
            <div className="cp-shortcuts-footer">
              Press <span className="cp-key">ESC</span> to go back
            </div>
          </div>
        ) : (
          <div className="cp-list" ref={listRef}>
            {filteredCommands.length === 0 ? (
              <div className="cp-empty">
                <span className="cp-empty-icon">∅</span>
                <span>No commands found</span>
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => (
                <div
                  key={cmd.id}
                  className={`cp-item ${idx === selectedIndex ? 'cp-item-selected' : ''} cp-item-${cmd.category}`}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="cp-item-icon">{cmd.icon}</span>
                  <span className="cp-item-label">{cmd.label}</span>
                  {cmd.shortcut && (
                    <span className="cp-item-shortcut">{cmd.shortcut}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="cp-footer">
          <span className="cp-footer-hint">
            <span className="cp-key">↑↓</span> navigate
          </span>
          <span className="cp-footer-hint">
            <span className="cp-key">↵</span> select
          </span>
          <span className="cp-footer-hint">
            <span className="cp-key">esc</span> close
          </span>
        </div>
      </div>
    </div>
  )
}

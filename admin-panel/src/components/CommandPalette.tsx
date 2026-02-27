'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface CommandItem {
  id: string
  label: string
  shortcut?: string
  action: () => void
  icon?: string
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

const staticCommands: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', action: () => {} },
  { id: 'live', label: 'Canlı Akış', icon: '🔴', action: () => {} },
  { id: 'users', label: 'Kullanıcılar', icon: '👥', action: () => {} },
  { id: 'identity', label: 'Kimlik & Pasaport', icon: '🪪', action: () => {} },
  { id: 'payments', label: 'Paketler & Ödemeler', icon: '💳', action: () => {} },
  { id: 'kbs', label: 'Tesis/KBS Talepleri', icon: '🏢', action: () => {} },
  { id: 'notifications', label: 'Bildirim Gönder', icon: '📢', action: () => {} },
  { id: 'audit', label: 'Audit Log', icon: '📋', action: () => {} },
]

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo(() => {
    const withAction = staticCommands.map((c) => ({
      ...c,
      action: () => {
        onClose()
        const path =
          c.id === 'dashboard' ? '/' : c.id === 'kbs' ? '/tesisler' : `/${c.id === 'notifications' ? 'notifications' : c.id}`
        router.push(path)
      },
    }))
    if (!query.trim()) return withAction
    const q = query.toLowerCase().trim()
    return withAction.filter((c) => c.label.toLowerCase().includes(q))
  }, [query, router, onClose])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => (s < commands.length - 1 ? s + 1 : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => (s > 0 ? s - 1 : commands.length - 1))
        return
      }
      if (e.key === 'Enter' && commands[selected]) {
        e.preventDefault()
        commands[selected].action()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, commands, selected, onClose])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  return (
    <div className="admin-cmd-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Komut paleti">
      <div className="admin-cmd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-cmd-input-wrap">
          <span className="admin-cmd-icon" aria-hidden>⌘</span>
          <input
            type="text"
            placeholder="Komut veya sayfa ara… (User: 905…, Freeze, Send notice…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="admin-cmd-input"
            autoFocus
            autoComplete="off"
            aria-label="Komut ara"
          />
        </div>
        <div className="admin-cmd-list" ref={listRef}>
          {commands.length === 0 ? (
            <div className="admin-cmd-empty">Sonuç yok</div>
          ) : (
            commands.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                data-index={i}
                className={`admin-cmd-item ${i === selected ? 'selected' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => cmd.action()}
              >
                {cmd.icon && <span className="admin-cmd-item-icon" aria-hidden>{cmd.icon}</span>}
                <span>{cmd.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

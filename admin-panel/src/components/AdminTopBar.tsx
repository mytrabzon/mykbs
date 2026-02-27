'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AdminTopBarProps {
  onOpenCommandPalette: () => void
}

export default function AdminTopBar({ onOpenCommandPalette }: AdminTopBarProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const q = search.trim()
      if (q) router.push(`/users?search=${encodeURIComponent(q)}`)
    },
    [search, router]
  )

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    router.push('/login')
  }

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        <form onSubmit={handleSearch} className="admin-topbar-search-wrap">
          <input
            type="search"
            placeholder="Kullanıcı ara (telefon, email, isim…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-topbar-search"
            aria-label="Arama"
          />
        </form>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="admin-topbar-cmd"
          title="Komut paleti (Ctrl+K)"
        >
          <kbd>Ctrl</kbd>+<kbd>K</kbd>
        </button>
      </div>
      <div className="admin-topbar-right">
        <button type="button" onClick={handleLogout} className="admin-topbar-logout">
          Çıkış
        </button>
      </div>
    </header>
  )
}

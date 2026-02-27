'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'
import AdminTopBar from '@/components/AdminTopBar'
import CommandPalette from '@/components/CommandPalette'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const token = localStorage.getItem('admin_token')
    if (!token || token.length === 0) {
      router.push('/login')
      return
    }
  }, [mounted, router, pathname])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  if (!mounted || !token) {
    return (
      <div className="kbs-loading">
        <div className="kbs-loading-inner">
          <div className="kbs-loading-spinner" />
          <p className="kbs-loading-text">Yönlendiriliyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-main-wrap">
        <AdminTopBar onOpenCommandPalette={() => setCmdOpen(true)} />
        <main className="admin-content">{children}</main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}

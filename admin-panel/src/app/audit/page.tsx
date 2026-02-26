'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { callEdgeFunction, getSupabaseToken } from '@/services/supabaseEdge'

interface AuditRow {
  id: string
  user_id: string | null
  action: string
  entity: string
  entity_id: string | null
  meta_json: Record<string, unknown> | null
  created_at: string
}

export default function AuditPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getSupabaseToken()) {
      router.push('/login')
      return
    }
    load()
  }, [router])

  const load = async () => {
    try {
      const res = await callEdgeFunction<{ logs: AuditRow[] }>('admin_audit_list', { limit: 100 })
      setLogs(res.logs || [])
    } catch (e: unknown) {
      toast.error((e as Error).message)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="kbs-loading">
        <div className="kbs-loading-inner">
          <div className="kbs-loading-spinner" />
          <p className="kbs-loading-text">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="kbs-lobby">
      <div className="kbs-bg-canvas">
        <div className="kbs-bg-gradient" />
        <div className="kbs-bg-blobs">
          <div className="kbs-blob kbs-blob--1" aria-hidden />
          <div className="kbs-blob kbs-blob--2" aria-hidden />
          <div className="kbs-blob kbs-blob--3" aria-hidden />
        </div>
        <div className="kbs-bg-grid" />
      </div>
      <nav className="kbs-nav">
        <div className="kbs-nav-inner">
          <Link href="/" className="kbs-logo">
            <span className="kbs-logo-dot" />
            MyKBS
          </Link>
          <div className="kbs-nav-links">
            <Link href="/tesisler" className="kbs-nav-link">Tesisler</Link>
            <Link href="/users" className="kbs-nav-link">Kullanıcılar</Link>
            <Link href="/community" className="kbs-nav-link">Topluluk</Link>
            <Link href="/kbs-notifications" className="kbs-nav-link">KBS Bildirimleri</Link>
            <Link href="/audit" className="kbs-nav-link" style={{ color: 'var(--kbs-accent)' }}>Audit</Link>
          </div>
        </div>
      </nav>
      <main className="kbs-main">
        <h1 className="kbs-page-title">Audit Log</h1>
        <p className="kbs-page-sub">Sistem işlem kayıtları</p>
        <div className="kbs-card">
          <div className="kbs-table-wrap">
            <table className="kbs-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>İşlem</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Meta</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleString('tr-TR')}</td>
                    <td>{l.action}</td>
                    <td>{l.entity} {l.entity_id ? `#${l.entity_id.slice(0, 8)}` : ''}</td>
                    <td>{l.user_id ? l.user_id.slice(0, 8) : '-'}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--kbs-text-muted)', textAlign: 'left' }}>
                      {l.meta_json ? JSON.stringify(l.meta_json) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 0 && <p className="kbs-card-empty-text" style={{ padding: '1.25rem' }}>Kayıt yok.</p>}
        </div>
      </main>
    </div>
  )
}

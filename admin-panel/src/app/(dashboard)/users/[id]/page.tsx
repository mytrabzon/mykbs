'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface AuditRow {
  id: string
  user_id: string | null
  action: string
  entity: string
  entity_id: string | null
  meta_json: Record<string, unknown> | null
  created_at: string
}

export default function UserDetayPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.id as string
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    load()
  }, [userId])

  const load = async () => {
    try {
      const res = await api.get<{ logs: AuditRow[] }>(`/app-admin/audit?target_user_id=${encodeURIComponent(userId)}`)
      setLogs(res.data.logs || [])
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
      else toast.error('Aktiviteler yüklenemedi')
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
    <div className="admin-page admin-page-detail">
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/users" className="kbs-page-back" style={{ color: 'var(--kbs-accent)', textDecoration: 'none', fontSize: '0.95rem' }}>
          ← Kullanıcılar
        </Link>
      </div>
      <h1 className="kbs-page-title">Kullanıcı aktiviteleri</h1>
      <p className="kbs-page-sub">
        User ID: <code style={{ background: 'var(--kbs-surface)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>{userId}</code>
      </p>

      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem</th>
                <th>Entity</th>
                <th>Meta</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString('tr-TR')}</td>
                  <td>{l.action}</td>
                  <td>{l.entity} {l.entity_id ? `#${String(l.entity_id).slice(0, 8)}` : ''}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--kbs-text-muted)', textAlign: 'left', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.meta_json ? JSON.stringify(l.meta_json) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && (
          <p className="kbs-card-empty-text" style={{ padding: '1.25rem' }}>
            Bu kullanıcıya ait kayıt yok.
          </p>
        )}
      </div>
    </div>
  )
}

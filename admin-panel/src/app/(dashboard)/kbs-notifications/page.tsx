'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { callEdgeFunction, getSupabaseToken } from '@/services/supabaseEdge'

interface NotifRow {
  id: string
  status: string
  payload: { title?: string; body?: string }
  last_error: string | null
  created_at: string
}

export default function KBSNotificationsPage() {
  const router = useRouter()
  const [list, setList] = useState<NotifRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!getSupabaseToken()) { router.push('/login'); return }
    load()
  }, [router])

  const load = async (statusFilter?: string) => {
    try {
      const body = statusFilter ? { status: statusFilter } : {}
      const res = await callEdgeFunction<{ notifications: NotifRow[] }>('admin_kbs_notifications', body)
      setList(res.notifications || [])
    } catch (e: unknown) {
      toast.error((e as Error).message)
      setList([])
    } finally {
      setLoading(false)
    }
  }

  const onFilterChange = (v: string) => {
    setFilter(v)
    setLoading(true)
    load(v)
  }

  if (loading && list.length === 0) {
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
    <div className="admin-page">
      <h1 className="kbs-page-title">Push / KBS Bildirim Kuyruğu</h1>
      <p className="kbs-page-sub">notification_outbox: queued / sent / failed.</p>
      <div style={{ marginBottom: '1.25rem' }}>
        <select aria-label="Bildirim durumu filtresi" value={filter} onChange={(e) => onFilterChange(e.target.value)} className="kbs-select">
          <option value="">Tümü</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Durum</th>
                <th>Başlık</th>
                <th>Hata</th>
              </tr>
            </thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.id}>
                  <td>{new Date(n.created_at).toLocaleString('tr-TR')}</td>
                  <td>
                    <span className={`kbs-badge kbs-badge--${n.status === 'sent' ? 'sent' : n.status === 'failed' ? 'failed' : 'queued'}`}>{n.status}</span>
                  </td>
                  <td>{n.payload?.title || '-'}</td>
                  <td style={{ color: 'var(--kbs-danger)', fontSize: '0.85rem', textAlign: 'left' }}>{n.last_error || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && !loading && <p className="kbs-card-empty-text" style={{ padding: '1.25rem' }}>Kayıt yok.</p>}
      </div>
    </div>
  )
}

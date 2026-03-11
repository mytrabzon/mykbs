'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { callEdgeFunction } from '@/services/supabaseEdge'

interface NotifRow {
  id: string
  status: string
  payload: { title?: string; body?: string }
  last_error: string | null
  created_at: string
}

export default function KBSNotificationsPage() {
  const [list, setList] = useState<NotifRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [configRequired, setConfigRequired] = useState(false)

  const load = async (statusFilter?: string) => {
    try {
      setConfigRequired(false)
      const body = statusFilter ? { status: statusFilter } : {}
      const res = await callEdgeFunction<{ notifications: NotifRow[] }>('admin_kbs_notifications', body)
      setList(res.notifications || [])
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (msg.includes('Supabase') || msg.includes('NEXT_PUBLIC')) {
        setConfigRequired(true)
        setList([])
      } else {
        toast.error(msg)
        setList([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onFilterChange = (v: string) => {
    setFilter(v)
    setLoading(true)
    load(v)
  }

  if (loading && list.length === 0 && !configRequired) {
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
      <p className="admin-page-breadcrumb">
        <Link href="/" className="kbs-page-back">← Ana sayfa</Link>
        <span className="kbs-page-back-sep"> · </span>
        <span className="kbs-page-back-current">KBS Bildirim Kuyruğu</span>
      </p>
      <h1 className="kbs-page-title">Push / KBS Bildirim Kuyruğu</h1>
      <p className="kbs-page-sub">notification_outbox: queued / sent / failed.</p>
      {configRequired && (
        <div className="kbs-card admin-kbs-config">
          <p className="kbs-card-empty-text">
            Bu sayfa Supabase Edge Functions kullanır. Kullanmak için <code>NEXT_PUBLIC_SUPABASE_URL</code> ve <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> değerlerini admin paneli <code>.env</code> dosyasına ekleyin.
          </p>
        </div>
      )}
      <div className="admin-kbs-filter-wrap">
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
                  <td className="admin-kbs-error-cell">{n.last_error || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && !loading && <p className="kbs-card-empty-text admin-kbs-empty">Kayıt yok.</p>}
      </div>
    </div>
  )
}

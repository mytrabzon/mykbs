'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function AuditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filterUserId = searchParams.get('user_id') || undefined
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterUserId) params.set('target_user_id', filterUserId)
      const res = await api.get<{ logs: AuditRow[]; total: number }>(`/app-admin/audit?${params.toString()}`)
      setLogs(res.data.logs || [])
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
      else toast.error('Audit log yüklenemedi')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [filterUserId, router])

  useEffect(() => {
    load()
  }, [load])

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
    <div className="admin-page">
      <h1 className="kbs-page-title">Audit Log</h1>
      <p className="kbs-page-sub">
        Sistem işlem kayıtları. {filterUserId && (
          <span>
            Kullanıcı filtresi: <code className="kbs-code-inline">{filterUserId}</code>
            {' '}<Link href="/audit" className="kbs-link-accent">Filtreyi kaldır</Link>
          </span>
        )}
        {!filterUserId && 'Tüm kullanıcıların işlemleri listelenir.'}
      </p>
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
              {logs.map((l, i) => (
                <tr key={l.id || `row-${i}`}>
                  <td>{new Date(l.created_at).toLocaleString('tr-TR')}</td>
                  <td>{l.action}</td>
                  <td>{l.entity} {l.entity_id ? `#${String(l.entity_id).slice(0, 8)}` : ''}</td>
                  <td>
                    {l.user_id ? (
                      <Link href={`/users/${l.user_id}`} className="admin-audit-link" title="Kullanıcı aktiviteleri">
                        {l.user_id.slice(0, 8)}…
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="admin-audit-meta-cell">
                    {l.meta_json ? JSON.stringify(l.meta_json) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && <p className="kbs-card-empty-text admin-audit-empty">Kayıt yok.</p>}
      </div>
    </div>
  )
}

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
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı')
      return
    }
    if (password !== passwordConfirm) {
      toast.error('Şifre ve tekrarı eşleşmiyor')
      return
    }
    setSavingPassword(true)
    try {
      await api.post(`/app-admin/users/${userId}/set-password`, { password, passwordConfirm })
      toast.success('Şifre güncellendi. Kullanıcı bir dahaki girişte bu şifreyi kullanacak.')
      setPassword('')
      setPasswordConfirm('')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || 'Şifre güncellenemedi')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!confirm('Bu kullanıcıyı kalıcı olarak silmek istediğinize emin misiniz? Oturumu derhal sonlanır; giriş denemelerinde "Hesabınız silindi" mesajı ve otomatik destek talebi oluşturulur.')) return
    setDeleting(true)
    try {
      await api.post(`/app-admin/users/${userId}/delete`)
      toast.success('Kullanıcı silindi')
      router.push('/users')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || 'Silinemedi')
      setDeleting(false)
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
      <div className="admin-detail-back">
        <Link href="/users" className="kbs-page-back">
          ← Kullanıcılar
        </Link>
      </div>
      <h1 className="kbs-page-title">Kullanıcı aktiviteleri</h1>
      <p className="kbs-page-sub">
        User ID: <code className="admin-detail-code">{userId}</code>
      </p>

      <div className="kbs-card admin-form-max" style={{ marginBottom: '1.5rem' }}>
        <h2 className="kbs-card-title">Şifre değiştir</h2>
        <p className="kbs-page-sub">Kullanıcı bir dahaki girişte bu şifreyi kullanacak.</p>
        <form onSubmit={handleSetPassword} className="kbs-form-grid" style={{ maxWidth: '400px' }}>
          <label className="kbs-field-label">
            Yeni şifre (en az 6 karakter)
            <input type="password" className="kbs-input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="kbs-field-label">
            Şifre tekrar
            <input type="password" className="kbs-input" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          <button type="submit" className="kbs-btn-primary" disabled={savingPassword}>
            {savingPassword ? 'Kaydediliyor...' : 'Şifreyi güncelle'}
          </button>
        </form>
      </div>

      <div className="kbs-card admin-user-danger-zone" style={{ marginBottom: '1.5rem' }}>
        <h2 className="kbs-card-title admin-danger-title">Hesabı sil</h2>
        <p className="admin-tesis-summary-sm">
          Bu kullanıcıyı kalıcı siler. Oturumu derhal sonlanır (lobiye döner). Giriş yapmaya çalışırsa &quot;Hesabınız silindi&quot; mesajı gösterilir ve otomatik destek talebi açılır.
        </p>
        <button type="button" className="admin-btn secondary" style={{ background: '#c53030', color: '#fff', border: 'none' }} onClick={handleDeleteUser} disabled={deleting}>
          {deleting ? 'Siliniyor...' : 'Kullanıcıyı kalıcı sil'}
        </button>
      </div>

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
                  <td className="admin-detail-meta">
                    {l.meta_json ? JSON.stringify(l.meta_json) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && (
          <p className="kbs-card-empty-text kbs-card-empty-pad">
            Bu kullanıcıya ait kayıt yok.
          </p>
        )}
      </div>
    </div>
  )
}

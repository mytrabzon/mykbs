'use client'

import { useEffect, useState, useMemo } from 'react'
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

interface UserDetail {
  id: string
  email: string | null
  phone: string | null
  created_at: string
  last_sign_in_at: string | null
  profile: {
    is_disabled?: boolean
    display_name?: string
    approval_status?: string
    rejected_reason?: string | null
    role?: string
    branch_id?: string
  } | null
  notification_count?: number
}

export default function UserDetayPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.id as string
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [logFilter, setLogFilter] = useState<'all' | 'errors'>('all')

  const errorLikeActions = useMemo(() => {
    const lower = (s: string) => s.toLowerCase()
    return (logs as AuditRow[]).filter(
      (l) =>
        lower(l.action).includes('fail') ||
        lower(l.action).includes('error') ||
        lower(l.action).includes('reject') ||
        lower(l.action).includes('hatalı')
    )
  }, [logs])

  const displayedLogs = logFilter === 'errors' ? errorLikeActions : logs

  useEffect(() => {
    if (!userId) return
    load()
  }, [userId])

  const load = async () => {
    setLoading(true)
    try {
      const [auditRes, userRes] = await Promise.all([
        api.get<{ logs: AuditRow[] }>(`/app-admin/audit?target_user_id=${encodeURIComponent(userId)}`).catch(() => ({ data: { logs: [] as AuditRow[] } })),
        api.get<UserDetail>(`/app-admin/users/${userId}`).catch(() => ({ data: null })),
      ])
      setLogs(auditRes.data?.logs ?? [])
      setUserDetail(userRes.data ?? null)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
      else toast.error('Veriler yüklenemedi')
      setLogs([])
      setUserDetail(null)
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

  const handleDisable = async () => {
    if (!confirm('Bu kullanıcıyı devre dışı bırakmak (ban) istediğinize emin misiniz? Giriş yapamaz.')) return
    setDisabling(true)
    try {
      await api.post(`/app-admin/users/${userId}/disable`)
      toast.success('Kullanıcı devre dışı bırakıldı')
      load()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || 'Devre dışı bırakılamadı')
    } finally {
      setDisabling(false)
    }
  }

  const handleEnable = async () => {
    setEnabling(true)
    try {
      await api.post(`/app-admin/users/${userId}/enable`)
      toast.success('Kullanıcı tekrar etkinleştirildi')
      load()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || 'Etkinleştirilemedi')
    } finally {
      setEnabling(false)
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
      <h1 className="kbs-page-title">Kullanıcı detayı</h1>
      <p className="kbs-page-sub">
        User ID: <code className="admin-detail-code">{userId}</code>
      </p>

      {/* Kullanıcı özeti */}
      {userDetail && (
        <div className="kbs-card admin-form-max admin-user-summary-card">
          <h2 className="kbs-card-title">Kullanıcı özeti</h2>
          <dl className="admin-tesis-dl admin-user-dl">
            <dt className="admin-tesis-info-dt">E-posta</dt>
            <dd className="admin-tesis-info-dd">{userDetail.email ? <a href={`mailto:${userDetail.email}`}>{userDetail.email}</a> : '—'}</dd>
            <dt className="admin-tesis-info-dt">Telefon</dt>
            <dd className="admin-tesis-info-dd">{userDetail.phone ? <a href={`tel:${userDetail.phone}`}>{userDetail.phone}</a> : '—'}</dd>
            <dt className="admin-tesis-info-dt">Görünen ad</dt>
            <dd className="admin-tesis-info-dd">{userDetail.profile?.display_name || '—'}</dd>
            <dt className="admin-tesis-info-dt">Kayıt tarihi</dt>
            <dd className="admin-tesis-info-dd">{userDetail.created_at ? new Date(userDetail.created_at).toLocaleString('tr-TR') : '—'}</dd>
            <dt className="admin-tesis-info-dt">Son giriş</dt>
            <dd className="admin-tesis-info-dd">{userDetail.last_sign_in_at ? new Date(userDetail.last_sign_in_at).toLocaleString('tr-TR') : '—'}</dd>
            <dt className="admin-tesis-info-dt">Onay durumu</dt>
            <dd className="admin-tesis-info-dd">
              {userDetail.profile?.approval_status === 'pending' && <span className="admin-badge-warn">Beklemede</span>}
              {userDetail.profile?.approval_status === 'approved' && <span className="admin-badge-ok">Onaylı</span>}
              {userDetail.profile?.approval_status === 'rejected' && <span className="admin-badge-danger">Reddedildi</span>}
              {(!userDetail.profile?.approval_status || !['pending', 'approved', 'rejected'].includes(userDetail.profile.approval_status)) && '—'}
              {userDetail.profile?.rejected_reason && ` (${userDetail.profile.rejected_reason})`}
            </dd>
            <dt className="admin-tesis-info-dt">Hesap durumu</dt>
            <dd className="admin-tesis-info-dd">
              {userDetail.profile?.is_disabled ? <span className="admin-badge-danger">Devre dışı (banlı)</span> : <span className="admin-badge-ok">Aktif</span>}
            </dd>
            <dt className="admin-tesis-info-dt">Bildirim sayısı</dt>
            <dd className="admin-tesis-info-dd">{typeof userDetail.notification_count === 'number' ? userDetail.notification_count : '—'}</dd>
            <dt className="admin-tesis-info-dt">Rol</dt>
            <dd className="admin-tesis-info-dd">{userDetail.profile?.role || '—'}</dd>
          </dl>
        </div>
      )}

      {userDetail && (
        <div className="kbs-card admin-form-max">
          <h2 className="kbs-card-title">Hesap yönetimi</h2>
          <p className="kbs-page-sub">
            Kullanıcıyı devre dışı bırakın (ban) veya tekrar etkinleştirin.
          </p>
          <div className="admin-btn-row-wrap">
            {userDetail.profile?.is_disabled ? (
              <button type="button" className="kbs-btn-primary" onClick={handleEnable} disabled={enabling}>
                {enabling ? 'Yapılıyor...' : 'Ban kaldır (tekrar etkinleştir)'}
              </button>
            ) : (
              <button type="button" className="admin-btn admin-btn-warn" onClick={handleDisable} disabled={disabling}>
                {disabling ? 'Yapılıyor...' : 'Devre dışı bırak (ban)'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="kbs-card admin-form-max">
        <h2 className="kbs-card-title">Şifre değiştir</h2>
        <p className="kbs-page-sub">Kullanıcı bir dahaki girişte bu şifreyi kullanacak.</p>
        <form onSubmit={handleSetPassword} className="kbs-form-grid admin-form-password">
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

      <div className="kbs-card admin-user-danger-zone">
        <h2 className="kbs-card-title admin-danger-title">Hesabı sil</h2>
        <p className="admin-tesis-summary-sm">
          Bu kullanıcıyı kalıcı siler. Oturumu derhal sonlanır (lobiye döner). Giriş yapmaya çalışırsa &quot;Hesabınız silindi&quot; mesajı gösterilir ve otomatik destek talebi açılır.
        </p>
        <button type="button" className="admin-btn admin-btn-danger" onClick={handleDeleteUser} disabled={deleting}>
          {deleting ? 'Siliniyor...' : 'Kullanıcıyı kalıcı sil'}
        </button>
      </div>

      {/* Hata aldığı durumlar özeti */}
      {errorLikeActions.length > 0 && (
        <div className="kbs-card">
          <h2 className="kbs-card-title">Hata / başarısız işlemler ({errorLikeActions.length})</h2>
          <p className="kbs-page-sub">Bu kullanıcının hata veya red içeren işlem kayıtları.</p>
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
                {errorLikeActions.slice(0, 20).map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleString('tr-TR')}</td>
                    <td>{l.action}</td>
                    <td>{l.entity} {l.entity_id ? `#${String(l.entity_id).slice(0, 8)}` : ''}</td>
                    <td className="admin-detail-meta">{l.meta_json ? JSON.stringify(l.meta_json) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errorLikeActions.length > 20 && <p className="kbs-page-sub">Son 20 kayıt gösteriliyor. Tümü için aşağıdaki tabloda &quot;Sadece hatalar&quot; filtresini kullanın.</p>}
        </div>
      )}

      {/* İşlem logları (Audit) */}
      <div className="kbs-card">
        <h2 className="kbs-card-title">İşlem logları (Audit)</h2>
        <p className="kbs-page-sub">Tüm işlem kayıtları. Hata içerenleri filtreleyebilirsiniz.</p>
        <div className="admin-log-filter">
          <button type="button" className={logFilter === 'all' ? 'kbs-btn-primary' : 'admin-btn secondary'} onClick={() => setLogFilter('all')}>
            Tümü ({logs.length})
          </button>
          <button type="button" className={logFilter === 'errors' ? 'kbs-btn-primary' : 'admin-btn secondary'} onClick={() => setLogFilter('errors')}>
            Sadece hatalar ({errorLikeActions.length})
          </button>
        </div>
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
              {displayedLogs.map((l) => (
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
        {displayedLogs.length === 0 && (
          <p className="kbs-card-empty-text kbs-card-empty-pad">
            {logFilter === 'errors' ? 'Hata içeren kayıt yok.' : 'Bu kullanıcıya ait kayıt yok.'}
          </p>
        )}
      </div>
    </div>
  )
}

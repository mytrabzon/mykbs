'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface PendingUser {
  user_id: string
  branch_id: string
  role: string
  display_name: string | null
  approval_status: string
  created_at: string
  email: string | null
  phone: string | null
  last_sign_in_at: string | null
}

export default function PendingUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ userId: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = async () => {
    try {
      const res = await api.get<{ users: PendingUser[] }>('/app-admin/pending-users')
      setUsers(res.data.users || [])
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
      else toast.error('Bekleyen kullanıcılar yüklenemedi')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleApprove = async (userId: string) => {
    setActing(userId)
    try {
      await api.post(`/app-admin/users/${userId}/approve`)
      toast.success('Kullanıcı onaylandı')
      setUsers((prev) => prev.filter((u) => u.user_id !== userId))
    } catch (e) {
      toast.error('Onay işlemi başarısız')
    } finally {
      setActing(null)
    }
  }

  const handleReject = async () => {
    if (!rejectModal) return
    const userId = rejectModal.user_id
    setActing(userId)
    try {
      await api.post(`/app-admin/users/${userId}/reject`, { reason: rejectReason || undefined })
      toast.success('Kullanıcı reddedildi')
      setUsers((prev) => prev.filter((u) => u.user_id !== userId))
      setRejectModal(null)
      setRejectReason('')
    } catch (e) {
      toast.error('Red işlemi başarısız')
    } finally {
      setActing(null)
    }
  }

  const handleDisable = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı devre dışı bırakmak istediğinize emin misiniz?')) return
    setActing(userId)
    try {
      await api.post(`/app-admin/users/${userId}/disable`)
      toast.success('Kullanıcı devre dışı bırakıldı')
      setUsers((prev) => prev.filter((u) => u.user_id !== userId))
    } catch (e) {
      toast.error('İşlem başarısız')
    } finally {
      setActing(null)
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
    <div className="admin-page">
      <h1 className="kbs-page-title">Onay Bekleyen Kullanıcılar</h1>
      <p className="kbs-page-sub">
        Yeni kayıt olan kullanıcılar onaylanana kadar topluluk paylaşımı ve bazı işlemler yapamaz. Buradan onaylayabilir veya reddedebilirsiniz.
      </p>
      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>Ad / Görünen ad</th>
                <th>Email / Telefon</th>
                <th>Kayıt</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.display_name || '—'}</td>
                  <td>
                    {u.email || '—'}
                    {u.phone ? ` / ${u.phone}` : ''}
                  </td>
                  <td className="admin-pending-date">{new Date(u.created_at).toLocaleString('tr-TR')}</td>
                  <td>
                    <div className="admin-pending-btns">
                      <button
                        type="button"
                        className="kbs-btn-primary admin-pending-btn-pri"
                        disabled={acting !== null}
                        onClick={() => handleApprove(u.user_id)}
                      >
                        {acting === u.user_id ? '…' : 'Onayla'}
                      </button>
                      <button
                        type="button"
                        className="kbs-btn-secondary admin-pending-btn-sec"
                        disabled={acting !== null}
                        onClick={() => setRejectModal({ userId: u.user_id, name: u.display_name || u.email || u.phone || u.user_id })}
                      >
                        Reddet
                      </button>
                      <button
                        type="button"
                        className="kbs-btn-secondary admin-pending-btn-danger"
                        disabled={acting !== null}
                        onClick={() => handleDisable(u.user_id)}
                      >
                        Devre dışı bırak
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <p className="kbs-card-empty-text kbs-card-empty-pad">
            Onay bekleyen kullanıcı yok.
          </p>
        )}
      </div>

      {rejectModal && (
        <div className="admin-modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reddet: {rejectModal.name}</h3>
            <p className="admin-modal-reject-p">İsteğe bağlı red nedeni:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Örn: Eksik bilgi"
              rows={3}
              className="admin-modal-reject-textarea"
            />
            <div className="admin-modal-reject-actions">
              <button type="button" className="kbs-btn-secondary" onClick={() => setRejectModal(null)}>
                İptal
              </button>
              <button
                type="button"
                className="kbs-btn-primary admin-reject-btn-danger"
                disabled={acting !== null}
                onClick={handleReject}
              >
                {acting === rejectModal.user_id ? '…' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

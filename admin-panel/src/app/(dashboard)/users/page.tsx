'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { callEdgeFunction, getSupabaseToken } from '@/services/supabaseEdge'

interface UserRow {
  user_id: string
  branch_id: string
  role: string
  display_name: string | null
  title: string | null
  is_disabled: boolean
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getSupabaseToken()) { router.push('/login'); return }
    load()
  }, [router])

  const load = async () => {
    try {
      const res = await callEdgeFunction<{ users: UserRow[] }>('admin_user_list', {})
      setUsers(res.users || [])
    } catch (e: unknown) {
      toast.error((e as Error).message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const setRole = async (userId: string, role: string) => {
    try {
      await callEdgeFunction('admin_user_set_role', { user_id: userId, role })
      toast.success('Rol güncellendi')
      load()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }

  const setDisabled = async (userId: string, disabled: boolean) => {
    try {
      await callEdgeFunction('admin_user_disable', { user_id: userId, disabled })
      toast.success(disabled ? 'Kullanıcı devre dışı' : 'Kullanıcı tekrar açıldı')
      load()
    } catch (e: unknown) {
      toast.error((e as Error).message)
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
      <h1 className="kbs-page-title">Kullanıcılar</h1>
      <p className="kbs-page-sub">Rol ve durum yönetimi</p>
      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.display_name || u.user_id.slice(0, 8)}</td>
                  <td>
                    <select aria-label={`${u.display_name || u.user_id} rolü`} value={u.role} onChange={(e) => setRole(u.user_id, e.target.value)} className="kbs-select" style={{ marginBottom: 0, padding: '0.4rem 0.6rem', width: 'auto' }}>
                      <option value="admin">Admin</option>
                      <option value="moderator">Moderator</option>
                      <option value="operator">Operator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td>{u.is_disabled ? 'Devre dışı' : 'Aktif'}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button type="button" onClick={() => setDisabled(u.user_id, !u.is_disabled)} className="kbs-btn-primary" style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.85rem', background: u.is_disabled ? 'linear-gradient(135deg, var(--kbs-success), #10b981)' : 'linear-gradient(135deg, var(--kbs-warning), #f59e0b)' }}>
                      {u.is_disabled ? 'Aç' : 'Devre dışı bırak'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="kbs-card-empty-text" style={{ padding: '1.25rem' }}>Kullanıcı bulunamadı.</p>}
      </div>
    </div>
  )
}

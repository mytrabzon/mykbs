'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface UserRow {
  id: string
  email: string | null
  phone: string | null
  created_at: string
  last_sign_in_at: string | null
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const res = await api.get<{ users: UserRow[] }>('/app-admin/users')
      setUsers(res.data.users || [])
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
      else toast.error('Kullanıcılar yüklenemedi')
      setUsers([])
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
    <div className="admin-page">
      <div className="kbs-admin-mb-16">
        <Link href="/" className="kbs-page-back">← Ana sayfa</Link>
      </div>
      <h1 className="kbs-page-title">Kullanıcılar</h1>
      <p className="kbs-page-sub">Supabase Auth kullanıcı listesi. Detaya tıklayarak kullanıcı bilgilerini görebilirsiniz.</p>
      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Telefon</th>
                <th>Son giriş</th>
                <th>Kayıt</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="admin-table-id">{u.id.slice(0, 8)}…</td>
                  <td>{u.email || '—'}</td>
                  <td>{u.phone || '—'}</td>
                  <td className="admin-user-table-date">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('tr-TR') : '—'}</td>
                  <td className="admin-table-date-cell">{new Date(u.created_at).toLocaleString('tr-TR')}</td>
                  <td>
                    <Link href={`/users/${u.id}`} className="kbs-btn-primary admin-users-link">
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="kbs-card-empty-text kbs-card-empty-pad">Kullanıcı bulunamadı.</p>}
      </div>
    </div>
  )
}

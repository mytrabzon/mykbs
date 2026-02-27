'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { callEdgeFunction, getSupabaseToken } from '@/services/supabaseEdge'

interface PostRow {
  id: string
  title: string | null
  body: string
  type: string
  category: string
  is_deleted: boolean
  is_pinned: boolean
  created_at: string
}

export default function CommunityPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<PostRow[]>([])
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
      const res = await callEdgeFunction<{ posts: PostRow[] }>('community_post_list', { include_deleted: true, limit: 100 })
      setPosts(res.posts || [])
    } catch (e: unknown) {
      toast.error((e as Error).message)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const restore = async (postId: string) => {
    try {
      await callEdgeFunction('community_post_restore', { post_id: postId })
      toast.success('Geri alındı')
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
      <h1 className="kbs-page-title">Topluluk Moderation</h1>
      <p className="kbs-page-sub">Soft delete yapılan paylaşımları geri alabilirsiniz.</p>
      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Başlık / Önizleme</th>
                <th>Tip</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleString('tr-TR')}</td>
                  <td>{p.title || p.body.slice(0, 50)}...</td>
                  <td>{p.type} / {p.category}</td>
                  <td>{p.is_deleted ? 'Silindi' : 'Yayında'}</td>
                  <td style={{ textAlign: 'left' }}>
                    {p.is_deleted && (
                      <button type="button" onClick={() => restore(p.id)} className="kbs-btn-primary" style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--kbs-success), #10b981)' }}>
                        Geri al
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {posts.length === 0 && <p className="kbs-card-empty-text" style={{ padding: '1.25rem' }}>Paylaşım yok.</p>}
      </div>
    </div>
  )
}

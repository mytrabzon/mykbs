'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

export default function NotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Başlık gerekli')
      return
    }
    setSending(true)
    try {
      const res = await api.post<{ sent: number; message?: string }>('/app-admin/broadcast', {
        title: title.trim(),
        body: body.trim(),
        image_url: imageUrl.trim() || undefined,
        link: link.trim() || undefined,
      })
      const sent = res.data?.sent ?? 0
      toast.success(sent > 0 ? `${sent} kullanıcıya bildirim gönderildi. Push bildirimleri iletildi.` : (res.data?.message ?? 'Gönderildi'))
      setTitle('')
      setBody('')
      setImageUrl('')
      setLink('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string }; status?: number } })?.response?.data?.message
        ?? (err as Error).message
      toast.error(msg || 'Gönderim başarısız')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin-page">
      <p className="admin-page-breadcrumb">
        <Link href="/" className="kbs-page-back">← Ana sayfa</Link>
        <span className="kbs-page-back-sep"> · </span>
        <span className="kbs-page-back-current">Bildirim & Duyurular</span>
      </p>
      <h1 className="kbs-page-title">Tüm Kullanıcılara Bildirim</h1>
      <p className="kbs-page-sub">
        Bu bildirim tüm (aktif) kullanıcılara uygulama içi ve push olarak gider. Resim ve link ekleyebilirsiniz; kullanıcı bildirime tıklayınca okundu işaretlenir ve uyarı kalkar.
      </p>

      <form onSubmit={handleSubmit} className="kbs-card admin-broadcast-form" style={{ maxWidth: 560, marginBottom: 24 }}>
        <div className="admin-form-group">
          <label htmlFor="broadcast-title">Başlık *</label>
          <input
            id="broadcast-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Yeni güncelleme"
            maxLength={200}
            className="kbs-input"
            required
          />
        </div>
        <div className="admin-form-group">
          <label htmlFor="broadcast-body">Metin</label>
          <textarea
            id="broadcast-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Bildirim metni (isteğe bağlı)"
            rows={4}
            maxLength={2000}
            className="kbs-input"
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="admin-form-group">
          <label htmlFor="broadcast-image">Resim URL (isteğe bağlı)</label>
          <input
            id="broadcast-image"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="kbs-input"
          />
        </div>
        <div className="admin-form-group">
          <label htmlFor="broadcast-link">Tıklanacak link (isteğe bağlı)</label>
          <input
            id="broadcast-link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            className="kbs-input"
          />
        </div>
        <div className="admin-broadcast-actions">
          <button type="submit" className="kbs-btn kbs-btn-primary admin-broadcast-submit" disabled={sending}>
            {sending ? 'Gönderiliyor…' : 'Bildirim Gönder'}
          </button>
        </div>
      </form>

      <div className="kbs-card">
        <p className="kbs-card-empty-text admin-notifications-empty">
          KBS (Jandarma/Polis) bildirim kuyruğu için{' '}
          <Link href="/kbs-notifications" className="admin-notifications-inline-link">KBS Bildirimleri</Link> sayfasını kullanabilirsiniz.
        </p>
      </div>
    </div>
  )
}

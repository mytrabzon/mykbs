'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'

interface Ticket {
  id: string
  tesisId: string | null
  tesisAdi: string | null
  authorUserId: string | null
  authorName: string
  authorEmail: string | null
  subject: string
  message: string
  status: string
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_OPTIONS = [
  { value: 'acik', label: 'Açık' },
  { value: 'isleme_alindi', label: 'İşleme alındı' },
  { value: 'cevaplandi', label: 'Sorun çözüldü / Cevaplandı' },
  { value: 'kapatildi', label: 'Kapatıldı' },
]

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}

export default function DestekTicketDetayPage() {
  const params = useParams()
  const id = params?.id as string
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const fetchTicket = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ ticket: Ticket }>(`/app-admin/support/${id}`)
      const t = res.data?.ticket
      setTicket(t ?? null)
      if (t) {
        setStatus(t.status)
        setAdminNote(t.adminNote ?? '')
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
        (e as Error)?.message ??
        'Talep alınamadı'
      setError(msg)
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  const handleSave = async () => {
    if (!id || saving) return
    setSaving(true)
    setSaveMessage(null)
    try {
      await api.patch(`/app-admin/support/${id}`, { status, adminNote: adminNote.trim() || undefined })
      setSaveMessage('Kaydedildi. Kullanıcıya bildirim gitti (varsa push token).')
      const res = await api.get<{ ticket: Ticket }>(`/app-admin/support/${id}`)
      const t = res.data?.ticket
      if (t) {
        setTicket(t)
        setAdminNote(t.adminNote ?? '')
        setStatus(t.status)
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
        (e as Error)?.message ??
        'Kaydedilemedi'
      setSaveMessage(`Hata: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !ticket) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Yükleniyor...</p>
      </div>
    )
  }
  if (error || !ticket) {
    const displayError = (error ?? 'Geçersiz id').replace(/\s*SMS ile oluştur[^.]*\.?\s*/gi, '').trim() || 'Geçersiz id'
    return (
      <div className="admin-page">
        <header className="admin-page-header">
          <h1 className="admin-page-title">Talep bulunamadı</h1>
          <p className="admin-muted">{displayError}</p>
        </header>
        <Link href="/destek" className="admin-btn secondary">
          ← Listeye dön
        </Link>
      </div>
    )
  }

  return (
    <div className="admin-page destek-detail-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Destek #{ticket.id.slice(-8)}</h1>
        <Link href="/destek" className="admin-btn secondary">
          ← Listeye dön
        </Link>
      </header>

      <div className="admin-card destek-detail-card">
        <h2 className="destek-detail-subject">{ticket.subject}</h2>
        <div className="destek-detail-meta">
          <span>{ticket.authorName}</span>
          {ticket.authorEmail && <span>{ticket.authorEmail}</span>}
          {ticket.tesisAdi && <span>Tesis: {ticket.tesisAdi}</span>}
          <span>{formatDate(ticket.createdAt)}</span>
        </div>
        <div className="destek-detail-message">
          <strong>Mesaj:</strong>
          <pre>{ticket.message}</pre>
        </div>
      </div>

      <div className="admin-card destek-actions-card">
        <h3 className="destek-actions-title">Talep işleme</h3>
        <p className="admin-muted destek-actions-hint">
          Durum veya not kaydettiğinizde, talebi açan kullanıcıya (uygulamada push token varsa) bildirim gider.
        </p>
        <div className="destek-form-group">
          <label htmlFor="destek-status-select" className="destek-label">Durum</label>
          <select
            id="destek-status-select"
            className="destek-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Talep durumu"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="destek-form-group">
          <label className="destek-label">Admin notu (kullanıcıya gösterilir / bildirimde yer alır)</label>
          <textarea
            className="destek-textarea"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={4}
            placeholder="Örn: Sorununuz çözüldü. Yeni giriş deneyebilirsiniz."
          />
        </div>
        <div className="destek-form-actions">
          <button
            type="button"
            className="admin-btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet ve bildirim gönder'}
          </button>
        </div>
        {saveMessage && (
          <p className={saveMessage.startsWith('Hata') ? 'destek-error' : 'admin-muted destek-save-message'}>
            {saveMessage}
          </p>
        )}
      </div>
    </div>
  )
}

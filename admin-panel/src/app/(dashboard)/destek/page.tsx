'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/services/api'

interface Ticket {
  id: string
  tesisId: string | null
  tesisAdi: string | null
  authorName: string
  authorEmail: string | null
  subject: string
  message: string
  status: string
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

const POLL_INTERVAL_MS = 5000

function formatDate(s: string) {
  try {
    const d = new Date(s)
    return d.toLocaleString('tr-TR', {
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

function statusLabel(status: string) {
  switch (status) {
    case 'acik':
      return { text: 'Açık', className: 'destek-status-acik' }
    case 'isleme_alindi':
      return { text: 'İşleme alındı', className: 'destek-status-isleme_alindi' }
    case 'cevaplandi':
      return { text: 'Cevaplandı', className: 'destek-status-cevaplandi' }
    case 'kapatildi':
      return { text: 'Kapatıldı', className: 'destek-status-kapatildi' }
    default:
      return { text: status, className: '' }
  }
}

export default function DestekPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.get<{ tickets: Ticket[] }>('app-admin/support')
      setTickets(res.data?.tickets ?? [])
      setError(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string }; status?: number }; message?: string })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Liste alınamadı'
      setError(msg)
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Anında düşsün: her 5 saniyede bir yenile
  useEffect(() => {
    const t = setInterval(fetchTickets, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [fetchTickets])

  return (
    <div className="admin-page destek-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Destek talepleri</h1>
        <p className="admin-page-sub">
          Mobil uygulama hamburger menüsünden gönderilen talepler. Liste her 5 saniyede yenilenir.
        </p>
      </header>

      {loading && tickets.length === 0 ? (
        <div className="admin-card">
          <p className="admin-muted">Yükleniyor...</p>
        </div>
      ) : error && tickets.length === 0 ? (
        <div className="admin-card">
          <p className="destek-error">{error}</p>
          <button type="button" className="admin-btn secondary destek-retry-btn" onClick={fetchTickets}>
            Tekrar dene
          </button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="admin-card">
          <p className="admin-muted">Henüz destek talebi yok. Mobil uygulama → Menü → Destek üzerinden gelen talepler burada listelenir.</p>
        </div>
      ) : (
        <div className="destek-list">
          {tickets.map((t) => {
            const sl = statusLabel(t.status)
            return (
              <div key={t.id} className="destek-card">
                <div className="destek-card-header">
                  <span className="destek-card-id">#{t.id.slice(-8)}</span>
                  <span className={`destek-badge ${sl.className}`}>{sl.text}</span>
                  <span className="destek-card-date">{formatDate(t.createdAt)}</span>
                </div>
                <h3 className="destek-card-subject">{t.subject}</h3>
                <div className="destek-card-meta">
                  {t.tesisAdi && <span className="destek-meta-item">Tesis: {t.tesisAdi}</span>}
                  <span className="destek-meta-item">{t.authorName}</span>
                  {t.authorEmail && <span className="destek-meta-item">{t.authorEmail}</span>}
                </div>
                <p className="destek-card-message">{t.message}</p>
                {t.adminNote && (
                  <div className="destek-admin-note">
                    <strong>Admin notu:</strong> {t.adminNote}
                  </div>
                )}
                <Link href={`/destek/ticket/${t.id}`} className="admin-link destek-link">
                  Detay →
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

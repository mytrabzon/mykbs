'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface TesisDetay {
  id: string
  tesisAdi: string
  tesisKodu: string
  yetkiliAdSoyad: string
  telefon: string
  email: string
  il: string
  adres: string | null
  paket: string
  kota: number
  kullanilanKota: number
  kbsTuru: string | null
  durum: string
  createdAt: string
  _count?: { odalar: number; bildirimler: number; kullanicilar: number }
}

export default function TesisDetayPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [tesis, setTesis] = useState<TesisDetay | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  const load = async () => {
    try {
      const response = await api.get(`/admin/tesis/${id}`)
      setTesis(response.data.tesis)
    } catch (error: unknown) {
      toast.error('Tesis yüklenemedi')
      const err = error as { response?: { status?: number } }
      if (err.response?.status === 404) {
        setTesis(null)
      }
      if (err.response?.status === 401) router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleOnayla = async () => {
    if (!tesis) return
    try {
      const response = await api.post(`/admin/tesis/${tesis.id}/onayla`)
      const { aktivasyonBilgileri } = response.data
      navigator.clipboard.writeText(aktivasyonBilgileri.mesaj)
      toast.success('Aktivasyon bilgileri panoya kopyalandı!')
      load()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Onaylama başarısız')
    }
  }

  const handleYeniSifre = async () => {
    if (!tesis) return
    try {
      const response = await api.post(`/admin/tesis/${tesis.id}/yeni-sifre`)
      const { aktivasyonBilgileri } = response.data
      navigator.clipboard.writeText(aktivasyonBilgileri.mesaj)
      toast.success('Yeni şifre panoya kopyalandı!')
      load()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Şifre oluşturulamadı')
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

  if (!tesis) {
    return (
      <div className="admin-page">
        <p className="kbs-page-sub">Tesis bulunamadı.</p>
        <Link href="/tesisler" className="kbs-btn-primary" style={{ display: 'inline-block', width: 'auto', padding: '0.6rem 1.2rem', textDecoration: 'none', color: '#0b0f1a' }}>
          ← Tesis listesine dön
        </Link>
      </div>
    )
  }

  const counts = tesis._count || { odalar: 0, bildirimler: 0, kullanicilar: 0 }

  return (
    <div className="admin-page admin-page-detail">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Link href="/tesisler" className="kbs-page-back" style={{ color: 'var(--kbs-accent)', textDecoration: 'none', fontSize: '0.95rem' }}>
          ← Tesisler
        </Link>
      </div>
      <h1 className="kbs-page-title">{tesis.tesisAdi}</h1>
      <p className="kbs-page-sub">
        {tesis.tesisKodu} · {tesis.durum}
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tesis.durum === 'incelemede' && (
          <button type="button" onClick={handleOnayla} className="kbs-btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
            Onayla
          </button>
        )}
        {(tesis.durum === 'onaylandi' || tesis.durum === 'aktif') && (
          <button type="button" onClick={handleYeniSifre} className="kbs-btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', background: 'var(--kbs-surface-elevated)', color: 'var(--kbs-accent)' }}>
            Yeni aktivasyon şifresi
          </button>
        )}
      </div>

      <div className="kbs-card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="kbs-card-title">Bilgiler</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1.5rem', margin: 0 }}>
          <dt style={{ color: 'var(--kbs-text-muted)' }}>Yetkili</dt>
          <dd style={{ margin: 0 }}>{tesis.yetkiliAdSoyad}</dd>
          <dt style={{ color: 'var(--kbs-text-muted)' }}>Telefon</dt>
          <dd style={{ margin: 0 }}><a href={`tel:${tesis.telefon}`} style={{ color: 'var(--kbs-accent)' }}>{tesis.telefon}</a></dd>
          <dt style={{ color: 'var(--kbs-text-muted)' }}>E-posta</dt>
          <dd style={{ margin: 0 }}><a href={`mailto:${tesis.email}`} style={{ color: 'var(--kbs-accent)' }}>{tesis.email}</a></dd>
          <dt style={{ color: 'var(--kbs-text-muted)' }}>İl</dt>
          <dd style={{ margin: 0 }}>{tesis.il}</dd>
          {tesis.adres && (
            <>
              <dt style={{ color: 'var(--kbs-text-muted)' }}>Adres</dt>
              <dd style={{ margin: 0 }}>{tesis.adres}</dd>
            </>
          )}
          <dt style={{ color: 'var(--kbs-text-muted)' }}>Paket</dt>
          <dd style={{ margin: 0 }}>{tesis.paket}</dd>
          <dt style={{ color: 'var(--kbs-text-muted)' }}>Kota</dt>
          <dd style={{ margin: 0 }}>{tesis.kullanilanKota} / {tesis.kota}</dd>
          <dt style={{ color: 'var(--kbs-text-muted)' }}>KBS Türü</dt>
          <dd style={{ margin: 0 }}>{tesis.kbsTuru || '-'}</dd>
          <dt style={{ color: 'var(--kbs-text-muted)' }}>Kayıt</dt>
          <dd style={{ margin: 0 }}>{new Date(tesis.createdAt).toLocaleString('tr-TR')}</dd>
        </dl>
      </div>

      <div className="kbs-card">
        <h2 className="kbs-card-title">Özet</h2>
        <p style={{ color: 'var(--kbs-text-muted)', marginBottom: '1rem' }}>
          Oda: <strong style={{ color: 'var(--kbs-text)' }}>{counts.odalar}</strong> ·
          Bildirim: <strong style={{ color: 'var(--kbs-text)' }}>{counts.bildirimler}</strong> ·
          Kullanıcı: <strong style={{ color: 'var(--kbs-text)' }}>{counts.kullanicilar}</strong>
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--kbs-text-muted)' }}>
          Log ve hata listesi backend API üzerinden: <code style={{ background: 'var(--kbs-bg)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>GET /api/admin/tesis/{tesis.id}/loglar</code> ve <code style={{ background: 'var(--kbs-bg)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>GET /api/admin/tesis/{tesis.id}/hatalar</code>
        </p>
      </div>
    </div>
  )
}

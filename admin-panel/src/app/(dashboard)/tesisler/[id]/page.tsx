'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface TesisKullanici {
  id: string
  adSoyad: string
  telefon: string
  email: string | null
  rol: string
  createdAt: string
}

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
  const [kullanicilar, setKullanicilar] = useState<TesisKullanici[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  const load = async () => {
    try {
      const [tesisRes, kullanicilarRes] = await Promise.all([
        api.get(`/admin/tesis/${id}`),
        api.get<{ kullanicilar: TesisKullanici[] }>(`/app-admin/tesis/${id}/kullanicilar`).catch(() => ({ data: { kullanicilar: [] } })),
      ])
      setTesis(tesisRes.data.tesis)
      setKullanicilar(kullanicilarRes.data?.kullanicilar ?? [])
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
        <Link href="/tesisler" className="kbs-btn-primary admin-detail-link">
          ← Tesis listesine dön
        </Link>
      </div>
    )
  }

  const counts = tesis._count || { odalar: 0, bildirimler: 0, kullanicilar: 0 }

  return (
    <div className="admin-page admin-page-detail">
      <div className="admin-tesis-detail-back">
        <Link href="/tesisler" className="kbs-page-back">
          ← Tesisler
        </Link>
      </div>
      <h1 className="kbs-page-title">{tesis.tesisAdi}</h1>
      <p className="kbs-page-sub">
        {tesis.tesisKodu} · {tesis.durum}
      </p>

      <div className="admin-tesis-detail-bar">
        {tesis.durum === 'incelemede' && (
          <button type="button" onClick={handleOnayla} className="kbs-btn-primary admin-tesis-detail-btn">
            Onayla
          </button>
        )}
        {(tesis.durum === 'onaylandi' || tesis.durum === 'aktif') && (
          <button type="button" onClick={handleYeniSifre} className="kbs-btn-primary admin-tesis-detail-btn-alt">
            Yeni aktivasyon şifresi
          </button>
        )}
      </div>

      <div className="kbs-card admin-tesis-info-card">
        <h2 className="kbs-card-title">Bilgiler</h2>
        <dl className="admin-tesis-dl">
          <dt className="admin-tesis-info-dt">Yetkili</dt>
          <dd className="admin-tesis-info-dd">{tesis.yetkiliAdSoyad}</dd>
          <dt className="admin-tesis-info-dt">Telefon</dt>
          <dd className="admin-tesis-info-dd"><a href={`tel:${tesis.telefon}`}>{tesis.telefon}</a></dd>
          <dt className="admin-tesis-info-dt">E-posta</dt>
          <dd className="admin-tesis-info-dd"><a href={`mailto:${tesis.email}`}>{tesis.email}</a></dd>
          <dt className="admin-tesis-info-dt">İl</dt>
          <dd className="admin-tesis-info-dd">{tesis.il}</dd>
          {tesis.adres && (
            <>
              <dt className="admin-tesis-info-dt">Adres</dt>
              <dd className="admin-tesis-info-dd">{tesis.adres}</dd>
            </>
          )}
          <dt className="admin-tesis-info-dt">Paket</dt>
          <dd className="admin-tesis-info-dd">{tesis.paket}</dd>
          <dt className="admin-tesis-info-dt">Kota</dt>
          <dd className="admin-tesis-info-dd">{tesis.kullanilanKota} / {tesis.kota}</dd>
          <dt className="admin-tesis-info-dt">KBS Türü</dt>
          <dd className="admin-tesis-info-dd">{tesis.kbsTuru || '-'}</dd>
          <dt className="admin-tesis-info-dt">Kayıt</dt>
          <dd className="admin-tesis-info-dd">{new Date(tesis.createdAt).toLocaleString('tr-TR')}</dd>
        </dl>
      </div>

      <div className="kbs-card">
        <h2 className="kbs-card-title">Özet</h2>
        <p className="admin-tesis-summary">
          Oda: <strong className="admin-detail-strong">{counts.odalar}</strong> ·
          Bildirim: <strong className="admin-detail-strong">{counts.bildirimler}</strong> ·
          Kullanıcı: <strong className="admin-detail-strong">{counts.kullanicilar}</strong>
        </p>
        <p className="admin-tesis-summary-sm" style={{ marginTop: '0.5rem' }}>
          <Link href={`/tesisler/${id}/odalar`} className="kbs-link-accent">Odalar listesi →</Link>
        </p>
        <p className="admin-tesis-summary-sm">
          Log ve hata listesi backend API üzerinden: <code>GET /api/admin/tesis/{tesis.id}/loglar</code> ve <code>GET /api/admin/tesis/{tesis.id}/hatalar</code>
        </p>
      </div>

      <div className="kbs-card">
        <div className="admin-tesis-users-header">
          <h2 className="kbs-card-title">Misafir girişleri (tanıma / e-posta atama)</h2>
          <Link href={`/tesisler/${id}/misafirler`} className="kbs-btn-primary kbs-btn-sm-alt">
            Misafirler listesi →
          </Link>
        </div>
        <p className="kbs-page-sub" style={{ marginTop: 8 }}>
          Giriş yapan misafirlere e-posta atayarak admin tarafında tanıyabilirsiniz. Listede giriş tarihine göre sıralı gösterilir.
        </p>
      </div>

      <div className="kbs-card">
        <div className="admin-tesis-users-header">
          <h2 className="kbs-card-title">Tesis kullanıcıları (tesis sahipleri)</h2>
          <Link href={`/tesisler/${id}/kullanicilar`} className="kbs-btn-primary kbs-btn-sm-alt">
            Tüm kullanıcılar →
          </Link>
        </div>
        {kullanicilar.length === 0 ? (
          <p className="kbs-card-empty-text kbs-card-empty-pad">Bu tesise ait kullanıcı yok.</p>
        ) : (
          <div className="kbs-table-wrap">
            <table className="kbs-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Rol</th>
                  <th>Telefon</th>
                  <th>Kayıt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {kullanicilar.map((k) => (
                  <tr
                    key={k.id}
                    className="kbs-table-row-clickable"
                    onClick={() => router.push(`/kullanicilar/${k.id}`)}
                  >
                    <td className="kbs-table-cell-link">{k.adSoyad}</td>
                    <td>{k.rol}</td>
                    <td>{k.telefon}</td>
                    <td>{new Date(k.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link href={`/kullanicilar/${k.id}`} className="kbs-btn-primary kbs-btn-sm-alt">
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

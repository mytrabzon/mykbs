'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface Kullanici {
  id: string
  tesisId: string
  adSoyad: string
  telefon: string
  email: string | null
  rol: string
  biyometriAktif: boolean
  checkInYetki: boolean
  odaDegistirmeYetki: boolean
  bilgiDuzenlemeYetki: boolean
  girisOnaylandi: boolean
  girisTalepAt: string | null
  hasPin: boolean
  hasSifre: boolean
  displayName: string | null
  title: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  tesis?: { id: string; tesisAdi: string; tesisKodu: string; paket?: string; trialEndsAt?: string | null; createdAt?: string }
}

const ROL_OPTIONS = [
  { value: 'resepsiyon', label: 'Resepsiyon' },
  { value: 'yonetici', label: 'Yönetici' },
  { value: 'sahip', label: 'Sahip' },
]

export default function KullaniciDuzenlePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [k, setK] = useState<Kullanici | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    adSoyad: '',
    telefon: '',
    email: '',
    rol: 'resepsiyon',
    biyometriAktif: false,
    checkInYetki: true,
    odaDegistirmeYetki: true,
    bilgiDuzenlemeYetki: true,
    girisOnaylandi: false,
    pin: '',
  })

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  const load = async () => {
    setLoadError(null)
    try {
      const res = await api.get<{ kullanici: Kullanici }>(`/app-admin/kullanicilar/${id}`)
      const u = res.data.kullanici
      setK(u)
      setForm({
        adSoyad: u.adSoyad || '',
        telefon: u.telefon || '',
        email: u.email ?? '',
        rol: u.rol || 'resepsiyon',
        biyometriAktif: u.biyometriAktif ?? false,
        checkInYetki: u.checkInYetki ?? true,
        odaDegistirmeYetki: u.odaDegistirmeYetki ?? true,
        bilgiDuzenlemeYetki: u.bilgiDuzenlemeYetki ?? true,
        girisOnaylandi: u.girisOnaylandi ?? false,
        pin: '',
      })
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } }; message?: string }
      if (err.response?.status === 401) {
        router.push('/login')
        return
      }
      const msg = err.response?.status === 404
        ? 'Kullanıcı bulunamadı'
        : (err.response?.data?.message || (err as Error).message || 'Yüklenemedi')
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        adSoyad: form.adSoyad.trim(),
        telefon: form.telefon.trim(),
        email: form.email.trim() || null,
        rol: form.rol,
        biyometriAktif: form.biyometriAktif,
        checkInYetki: form.checkInYetki,
        odaDegistirmeYetki: form.odaDegistirmeYetki,
        bilgiDuzenlemeYetki: form.bilgiDuzenlemeYetki,
        girisOnaylandi: form.girisOnaylandi,
      }
      if (form.pin.trim()) body.pin = form.pin
      await api.patch(`/app-admin/kullanicilar/${id}`, body)
      toast.success('Kullanıcı güncellendi')
      setForm((f) => ({ ...f, pin: '' }))
      load()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key: keyof typeof form, value?: boolean) => {
    if (key === 'biyometriAktif' || key === 'checkInYetki' || key === 'odaDegistirmeYetki' || key === 'bilgiDuzenlemeYetki' || key === 'girisOnaylandi') {
      setForm((f) => ({ ...f, [key]: value !== undefined ? value : !f[key] }))
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

  if (!k) {
    return (
      <div className="admin-page">
        <div className="kbs-admin-mb-16">
          <Link href="/tesisler" className="kbs-page-back">← Tesis listesi</Link>
        </div>
        <div className="kbs-card kbs-form-max">
          <p className="kbs-card-empty-text">{loadError || 'Kullanıcı yüklenemedi.'}</p>
          <button type="button" className="kbs-btn-primary admin-retry-btn" onClick={() => load()}>
            Tekrar dene
          </button>
        </div>
      </div>
    )
  }

  const tesisPaket = k.tesis?.paket ?? '—'
  const trialBitis = k.tesis?.trialEndsAt ? new Date(k.tesis.trialEndsAt).toLocaleDateString('tr-TR') : null
  const tesisKayit = k.tesis?.createdAt ? new Date(k.tesis.createdAt).toLocaleDateString('tr-TR') : null

  return (
    <div className="admin-page">
      <div className="kbs-admin-mb-16">
        <Link href={k.tesisId ? `/tesisler/${k.tesisId}/kullanicilar` : '/tesisler'} className="kbs-page-back">
          ← Kullanıcı listesi
        </Link>
      </div>

      {/* Profil özeti */}
      <div className="kbs-card admin-user-profile-card">
        <div className="admin-user-profile-header">
          <div className="admin-user-avatar-wrap">
            {k.avatarUrl ? (
              <img src={k.avatarUrl} alt="" className="admin-user-avatar" />
            ) : (
              <div className="admin-user-avatar-placeholder">
                {(k.adSoyad || k.displayName || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="admin-user-profile-meta">
            <h1 className="kbs-page-title admin-page-title-no-mb">{k.displayName || k.adSoyad}</h1>
            {k.title && <p className="kbs-page-sub admin-user-sub-mt">{k.title}</p>}
            <p className="admin-user-dates">
              Kayıt: <strong>{new Date(k.createdAt).toLocaleString('tr-TR')}</strong>
              {' · '}
              Son güncelleme: <strong>{new Date(k.updatedAt).toLocaleString('tr-TR')}</strong>
            </p>
          </div>
        </div>
        <dl className="admin-tesis-dl admin-user-dl">
          <dt className="admin-tesis-info-dt">E-posta</dt>
          <dd className="admin-tesis-info-dd">{k.email ? <a href={`mailto:${k.email}`}>{k.email}</a> : '—'}</dd>
          <dt className="admin-tesis-info-dt">Telefon</dt>
          <dd className="admin-tesis-info-dd"><a href={`tel:${k.telefon}`}>{k.telefon}</a></dd>
          <dt className="admin-tesis-info-dt">Tesis</dt>
          <dd className="admin-tesis-info-dd">
            {k.tesisId ? <Link href={`/tesisler/${k.tesisId}`} className="kbs-link-accent">{k.tesis?.tesisAdi || k.tesisId}</Link> : '—'}
          </dd>
          <dt className="admin-tesis-info-dt">Tesis paketi</dt>
          <dd className="admin-tesis-info-dd">{tesisPaket}</dd>
          {trialBitis && (
            <>
              <dt className="admin-tesis-info-dt">Deneme bitişi</dt>
              <dd className="admin-tesis-info-dd">{trialBitis}</dd>
            </>
          )}
          {tesisKayit && (
            <>
              <dt className="admin-tesis-info-dt">Tesis kayıt tarihi</dt>
              <dd className="admin-tesis-info-dd">{tesisKayit}</dd>
            </>
          )}
          <dt className="admin-tesis-info-dt">Rol</dt>
          <dd className="admin-tesis-info-dd">{k.rol}</dd>
          <dt className="admin-tesis-info-dt">Giriş talebi</dt>
          <dd className="admin-tesis-info-dd">{k.girisTalepAt ? new Date(k.girisTalepAt).toLocaleString('tr-TR') : '—'}</dd>
        </dl>
      </div>

      <h2 className="kbs-card-title admin-form-section-title">Düzenle</h2>
      <p className="kbs-page-sub admin-form-section-sub">Ad soyad, yetkiler ve giriş onayı</p>

      <form onSubmit={handleSubmit} className="kbs-card kbs-form-max">
        <div className="kbs-form-grid">
          <label className="kbs-field-label">
            Ad Soyad
            <input type="text" className="kbs-input" value={form.adSoyad} onChange={(e) => setForm((f) => ({ ...f, adSoyad: e.target.value }))} required />
          </label>
          <label className="kbs-field-label">
            Telefon
            <input type="text" className="kbs-input" value={form.telefon} onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))} required />
          </label>
          <label className="kbs-field-label">
            E-posta (opsiyonel)
            <input type="email" className="kbs-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <label className="kbs-field-label">
            Rol
            <select className="kbs-select" value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}>
              {ROL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="kbs-field-label">
            Yeni PIN (değiştirmek için doldurun, boş bırakırsanız mevcut PIN kalır)
            <input type="password" className="kbs-input" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} autoComplete="new-password" />
          </label>
        </div>

        <fieldset className="kbs-fieldset-box">
          <legend className="kbs-fieldset-legend">Yetkiler (kutucuklar)</legend>
          <div className="kbs-flex-col-gap">
            <label className="kbs-checkbox-row">
              <input type="checkbox" checked={form.checkInYetki} onChange={() => toggle('checkInYetki')} />
              <span>Check-in yetkisi</span>
            </label>
            <label className="kbs-checkbox-row">
              <input type="checkbox" checked={form.odaDegistirmeYetki} onChange={() => toggle('odaDegistirmeYetki')} />
              <span>Oda değiştirme yetkisi</span>
            </label>
            <label className="kbs-checkbox-row">
              <input type="checkbox" checked={form.bilgiDuzenlemeYetki} onChange={() => toggle('bilgiDuzenlemeYetki')} />
              <span>Bilgi düzenleme yetkisi</span>
            </label>
            <label className="kbs-checkbox-row">
              <input type="checkbox" checked={form.biyometriAktif} onChange={() => toggle('biyometriAktif')} />
              <span>Biyometri aktif</span>
            </label>
            <label className="kbs-checkbox-row">
              <input type="checkbox" checked={form.girisOnaylandi} onChange={() => toggle('girisOnaylandi')} />
              <span>Giriş onaylı (tesis kodu + PIN ile giriş yapabilsin)</span>
            </label>
          </div>
        </fieldset>

        <div className="kbs-form-hint">
          Yetkiler <strong>true</strong> (işaretli) = yetkili, <strong>false</strong> (işaretsiz) = yetkisiz. Giriş onaylı işaretli olan kullanıcılar tesis kodu + PIN ile giriş yapabilir.
        </div>

        <button type="submit" className="kbs-btn-primary" disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>

      <div className="kbs-card admin-user-danger-zone">
        <h2 className="kbs-card-title admin-danger-title">Tehlikeli işlemler</h2>
        <p className="admin-tesis-summary-sm">
          Bu kullanıcıyı devre dışı bırakmak (ban) veya tesis kullanıcı listesinden kaldırmak için backend API kullanılır.
          Paylaşım sayısı, bildirilen kimlik/pasaport sayısı ve son konum bilgisi mobil uygulama / topluluk modülü üzerinden takip edilir.
        </p>
      </div>
    </div>
  )
}

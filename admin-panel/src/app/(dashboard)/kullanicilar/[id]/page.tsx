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
  createdAt: string
  updatedAt: string
  tesis?: { id: string; tesisAdi: string; tesisKodu: string }
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
          <button type="button" className="kbs-btn-primary" style={{ marginTop: 16 }} onClick={() => load()}>
            Tekrar dene
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="kbs-admin-mb-16">
        <Link href={k.tesisId ? `/tesisler/${k.tesisId}/kullanicilar` : '/tesisler'} className="kbs-page-back">
          ← Kullanıcı listesi
        </Link>
      </div>
      <h1 className="kbs-page-title">Kullanıcı düzenle</h1>
      <p className="kbs-page-sub">{k.tesis?.tesisAdi ? `${k.tesis.tesisAdi}` : ''} — Ad soyad, yetkiler ve giriş onayı</p>

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
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface OkutulanBelgeOzeti {
  toplam: number
  bildirildi: number
  bildirilmedi: number
}

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
  okutulanBelgeOzeti?: OkutulanBelgeOzeti
  tesis?: { id: string; tesisAdi: string; tesisKodu: string; paket?: string; trialEndsAt?: string | null; createdAt?: string; kbsTuru?: string | null }
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
  const [activityOpen, setActivityOpen] = useState(false)
  const [activity, setActivity] = useState<{
    loglar: Array<{ id: string; islem: string; detay: string | null; basarili: boolean; createdAt: string }>
    hatalar: Array<{ id: string; hataTipi: string; hataMesaji: string; durum: string; createdAt: string }>
  } | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
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
    sifre: '',
    sifreTekrar: '',
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
        sifre: '',
        sifreTekrar: '',
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
      if (form.sifre.trim()) {
        if (form.sifre !== form.sifreTekrar) {
          toast.error('Şifre ve tekrarı eşleşmiyor')
          return
        }
        body.sifre = form.sifre
        body.sifreTekrar = form.sifreTekrar
      }
      await api.patch(`/app-admin/kullanicilar/${id}`, body)
      toast.success('Kullanıcı güncellendi')
      setForm((f) => ({ ...f, pin: '', sifre: '', sifreTekrar: '' }))
      load()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const loadActivity = async () => {
    if (!id) return
    setActivityLoading(true)
    try {
      const res = await api.get<{ loglar: unknown[]; hatalar: unknown[] }>(`/app-admin/kullanicilar/${id}/activity`)
      setActivity({ loglar: res.data.loglar as NonNullable<typeof activity>['loglar'], hatalar: res.data.hatalar as NonNullable<typeof activity>['hatalar'] })
      setActivityOpen(true)
    } catch (e) {
      toast.error('Aktivite yüklenemedi')
    } finally {
      setActivityLoading(false)
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
  const kbsTuru = k.tesis?.kbsTuru ? (k.tesis.kbsTuru === 'polis' ? 'Polis' : k.tesis.kbsTuru === 'jandarma' ? 'Jandarma' : k.tesis.kbsTuru) : '—'
  const ob = k.okutulanBelgeOzeti

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
          <dt className="admin-tesis-info-dt">Görünen ad</dt>
          <dd className="admin-tesis-info-dd">{k.displayName || '—'}</dd>
          <dt className="admin-tesis-info-dt">Ünvan</dt>
          <dd className="admin-tesis-info-dd">{k.title || '—'}</dd>
          <dt className="admin-tesis-info-dt">Rol</dt>
          <dd className="admin-tesis-info-dd">{k.rol}</dd>
          <dt className="admin-tesis-info-dt">Otel / Tesis adı</dt>
          <dd className="admin-tesis-info-dd">
            {k.tesisId ? <Link href={`/tesisler/${k.tesisId}`} className="kbs-link-accent">{k.tesis?.tesisAdi || k.tesisId}</Link> : '—'}
          </dd>
          <dt className="admin-tesis-info-dt">Tesis kodu</dt>
          <dd className="admin-tesis-info-dd">{k.tesis?.tesisKodu ?? '—'}</dd>
          <dt className="admin-tesis-info-dt">KBS türü</dt>
          <dd className="admin-tesis-info-dd">{kbsTuru}</dd>
          <dt className="admin-tesis-info-dt">Kimlik / pasaport (okutulan)</dt>
          <dd className="admin-tesis-info-dd">
            {ob ? (
              <span>Toplam: <strong>{ob.toplam}</strong>, KBS’ye bildirildi: <strong>{ob.bildirildi}</strong>, bildirilmedi: <strong>{ob.bildirilmedi}</strong></span>
            ) : '—'}
          </dd>
          <dt className="admin-tesis-info-dt">Son giriş</dt>
          <dd className="admin-tesis-info-dd">{k.girisTalepAt ? new Date(k.girisTalepAt).toLocaleString('tr-TR') : '—'}</dd>
          <dt className="admin-tesis-info-dt">Telefon işletim sistemi</dt>
          <dd className="admin-tesis-info-dd">Cihaz bilgisi push kaydı ile gelir; bu kullanıcı için ayrıca gösterilmiyor.</dd>
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
          <dt className="admin-tesis-info-dt">Giriş talebi (son)</dt>
          <dd className="admin-tesis-info-dd">{k.girisTalepAt ? new Date(k.girisTalepAt).toLocaleString('tr-TR') : '—'}</dd>
        </dl>
        <div className="kbs-card" style={{ marginTop: '1rem' }}>
          <h3 className="kbs-card-title">Aktivite &amp; hata logu</h3>
          <p className="kbs-page-sub">Bu kullanıcının yaptığı işlemler (başarılı/başarısız) ve tesise ait hatalar.</p>
          <button type="button" className="kbs-btn-primary" onClick={loadActivity} disabled={activityLoading}>
            {activityLoading ? 'Yükleniyor...' : 'Log / Aktivite aç'}
          </button>
        </div>
        {activityOpen && activity && (
          <div className="kbs-card" style={{ marginTop: '1rem' }}>
            <h3 className="kbs-card-title">İşlem logları (son 100)</h3>
            <div className="kbs-table-wrap">
              <table className="kbs-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>İşlem</th>
                    <th>Detay</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.loglar.length === 0 && <tr><td colSpan={4}>Kayıt yok.</td></tr>}
                  {activity.loglar.map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.createdAt).toLocaleString('tr-TR')}</td>
                      <td>{l.islem}</td>
                      <td>{l.detay || '—'}</td>
                      <td>{l.basarili ? 'Başarılı' : 'Hata'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="kbs-card-title" style={{ marginTop: '1.5rem' }}>Hatalar (tesis, son 50)</h3>
            <div className="kbs-table-wrap">
              <table className="kbs-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tip</th>
                    <th>Mesaj</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.hatalar.length === 0 && <tr><td colSpan={4}>Kayıt yok.</td></tr>}
                  {activity.hatalar.map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.createdAt).toLocaleString('tr-TR')}</td>
                      <td>{h.hataTipi}</td>
                      <td>{h.hataMesaji}</td>
                      <td>{h.durum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="admin-btn secondary" style={{ marginTop: '0.5rem' }} onClick={() => setActivityOpen(false)}>Kapat</button>
          </div>
        )}
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
          <label className="kbs-field-label">
            Yeni şifre (e-posta/telefon ile girişte kullanılır; değiştirmek için her iki alanı doldurun)
            <input type="password" className="kbs-input" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} placeholder="En az 6 karakter" autoComplete="new-password" />
          </label>
          <label className="kbs-field-label">
            Yeni şifre tekrar
            <input type="password" className="kbs-input" value={form.sifreTekrar} onChange={(e) => setForm((f) => ({ ...f, sifreTekrar: e.target.value }))} placeholder="Aynı şifreyi yazın" autoComplete="new-password" />
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

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface DashboardStats {
  toplamTesis: number
  aktifTesis: number
  paketDagilimi: Record<string, number>
  gunlukBildirim: number
  gunlukHata: number
  kotaAsimi: Array<{
    id: string
    tesisAdi: string
    paket: string
    kota: number
    kullanilanKota: number
  }>
}

/** Saate göre kısa karşılama metni */
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

const QUICK_LINKS = [
  { href: '/tesisler', label: 'Tesisler', icon: '🏢' },
  { href: '/pending-users', label: 'Onay Bekleyenler', icon: '⏳' },
  { href: '/notifications', label: 'Bildirimler', icon: '📢' },
  { href: '/payments', label: 'Ödemeler', icon: '💳' },
] as const

const IconBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
  </svg>
)

const IconActivity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
)

const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
)

const IconChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 17V9M13 17V5M8 17v-3" />
  </svg>
)

interface DashboardProps {
  /** Admin layout içinde kullanıldığında nav ve tam sayfa arka planı gizlenir */
  embedLayout?: boolean
}

export default function Dashboard({ embedLayout = false }: DashboardProps) {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const emptyStats: DashboardStats = {
    toplamTesis: 0,
    aktifTesis: 0,
    paketDagilimi: {},
    gunlukBildirim: 0,
    gunlukHata: 0,
    kotaAsimi: [],
  }

  const loadDashboard = async () => {
    setLoadError(null)
    try {
      const response = await api.get<DashboardStats>('/admin/dashboard')
      const raw = response?.data
      const data = raw && typeof raw === 'object' && 'toplamTesis' in raw ? raw : (raw as { data?: DashboardStats })?.data
      const resolved = (data && typeof data === 'object' ? data : null) as DashboardStats | null
      setStats({
        toplamTesis: Number(resolved?.toplamTesis) || 0,
        aktifTesis: Number(resolved?.aktifTesis) || 0,
        paketDagilimi: (resolved?.paketDagilimi && typeof resolved.paketDagilimi === 'object') ? resolved.paketDagilimi : {},
        gunlukBildirim: Number(resolved?.gunlukBildirim) || 0,
        gunlukHata: Number(resolved?.gunlukHata) || 0,
        kotaAsimi: Array.isArray(resolved?.kotaAsimi) ? resolved.kotaAsimi : [],
      })
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } } }
      const msg = err.response?.data?.message
      const is401 = err.response?.status === 401
      if (is401) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
        const isPanelSecret = typeof token === 'string' && token.length > 10 && (token.match(/\./g)?.length ?? 0) < 2
        toast.error(
          isPanelSecret
            ? 'Yetkisiz. Panel şifresi ile giriş yaptıysanız backend .env içindeki ADMIN_SECRET, admin panel .env.local içindeki NEXT_PUBLIC_ADMIN_SECRET ile aynı olmalı.'
            : msg || 'Yetkisiz'
        )
        router.push('/login')
      } else {
        setLoadError(msg || 'Dashboard verileri yüklenemedi')
        setStats(emptyStats)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="kbs-loading">
        <div className="kbs-loading-inner">
          <div className="kbs-loading-spinner" />
          <p className="kbs-loading-text">KBS yükleniyor...</p>
        </div>
      </div>
    )
  }

  const content = (
    <>
      <header className="kbs-dash-header">
        <p className="kbs-dash-greeting">{getGreeting()}</p>
        <h1 className="kbs-dash-title">Kontrol Merkezi</h1>
        <p className="kbs-dash-sub">Özet, paket dağılımı ve kota durumu</p>
        {loadError && (
          <div className="kbs-dash-error" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoadError(null); loadDashboard() }} className="kbs-btn-primary">
              Yenile
            </button>
          </div>
        )}
      </header>

      {/* Hızlı erişim */}
      <section className="kbs-dash-quick">
        <h2 className="kbs-dash-quick-title">Hızlı Erişim</h2>
        <div className="kbs-dash-quick-grid">
          {QUICK_LINKS.map(({ href, label, icon }) => (
            <Link key={href} href={href} className="kbs-dash-quick-link">
              <span className="kbs-dash-quick-icon" aria-hidden>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {stats && (
        <section className="kbs-stats kbs-stats--compact">
          <article className="kbs-stat-card kbs-stat-card--compact kbs-stat-card--total kbs-stat-card--d0">
            <div className="kbs-stat-icon kbs-stat-icon--sm">
              <IconBuilding />
            </div>
            <div className="kbs-stat-body">
              <span className="kbs-stat-label">Toplam Tesis</span>
              <span className="kbs-stat-value kbs-stat-value--sm">{stats.toplamTesis}</span>
            </div>
          </article>
          <article className="kbs-stat-card kbs-stat-card--compact kbs-stat-card--active kbs-stat-card--d1">
            <div className="kbs-stat-icon kbs-stat-icon--sm">
              <IconActivity />
            </div>
            <div className="kbs-stat-body">
              <span className="kbs-stat-label">Aktif Tesis</span>
              <span className="kbs-stat-value kbs-stat-value--sm">{stats.aktifTesis}</span>
            </div>
          </article>
          <article className="kbs-stat-card kbs-stat-card--compact kbs-stat-card--notif kbs-stat-card--d2">
            <div className="kbs-stat-icon kbs-stat-icon--sm">
              <IconBell />
            </div>
            <div className="kbs-stat-body">
              <span className="kbs-stat-label">Günlük Bildirim</span>
              <span className="kbs-stat-value kbs-stat-value--sm">{stats.gunlukBildirim}</span>
            </div>
          </article>
          <article className="kbs-stat-card kbs-stat-card--compact kbs-stat-card--error kbs-stat-card--d3">
            <div className="kbs-stat-icon kbs-stat-icon--sm">
              <IconAlert />
            </div>
            <div className="kbs-stat-body">
              <span className="kbs-stat-label">Günlük Hata</span>
              <span className="kbs-stat-value kbs-stat-value--sm">{stats.gunlukHata}</span>
            </div>
          </article>
        </section>
      )}

      {/* Paket dağılımı */}
      {stats && Object.keys(stats.paketDagilimi).length > 0 && (
        <section className="kbs-section kbs-dash-paket">
          <div className="kbs-card kbs-card--compact">
            <h2 className="kbs-card-title kbs-card-title--sm">
              <IconChart />
              Paket Dağılımı
            </h2>
            <div className="kbs-dash-paket-list">
              {Object.entries(stats.paketDagilimi).map(([paket, count]) => (
                <div key={paket} className="kbs-dash-paket-item">
                  <span className="kbs-dash-paket-name">{paket}</span>
                  <span className="kbs-dash-paket-count">{count} tesis</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {stats && stats.kotaAsimi.length > 0 && (
        <section className="kbs-section">
          <div className="kbs-card kbs-card--compact">
            <h2 className="kbs-card-title kbs-card-title--sm">
              <IconChart />
              Kota Aşımı
            </h2>
            <div className="kbs-table-wrap">
              <table className="kbs-table kbs-table--sm">
                <thead>
                  <tr>
                    <th>Tesis</th>
                    <th>Paket</th>
                    <th>Kullanılan / Kota</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.kotaAsimi.map((tesis) => (
                    <tr key={tesis.id}>
                      <td>{tesis.tesisAdi}</td>
                      <td>{tesis.paket}</td>
                      <td>{tesis.kullanilanKota} / {tesis.kota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {stats && stats.kotaAsimi.length === 0 && (
        <section className="kbs-section">
          <div className="kbs-card kbs-card--compact">
            <h2 className="kbs-card-title kbs-card-title--sm">
              <IconChart />
              Kota Aşımı
            </h2>
            <p className="kbs-card-empty-text kbs-card-empty-text--sm">Kota aşımı yok.</p>
          </div>
        </section>
      )}
    </>
  )

  if (embedLayout) {
    return <div className="admin-dashboard-embed">{content}</div>
  }

  return (
    <div className="kbs-lobby">
      <div className="kbs-bg-canvas">
        <div className="kbs-bg-gradient" />
        <div className="kbs-bg-blobs">
          <div className="kbs-blob kbs-blob--1" aria-hidden />
          <div className="kbs-blob kbs-blob--2" aria-hidden />
          <div className="kbs-blob kbs-blob--3" aria-hidden />
        </div>
        <div className="kbs-bg-grid" />
      </div>
      <nav className="kbs-nav">
        <div className="kbs-nav-inner">
          <Link href="/" className="kbs-logo">
            <span className="kbs-logo-dot" />
            KBS Prime
          </Link>
          <div className="kbs-nav-links">
            <Link href="/tesisler" className="kbs-nav-link">Tesisler</Link>
            <Link href="/users" className="kbs-nav-link">Kullanıcılar</Link>
            <Link href="/kbs-notifications" className="kbs-nav-link">KBS Bildirimleri</Link>
            <Link href="/audit" className="kbs-nav-link">Audit</Link>
            <button type="button" onClick={() => { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_supabase_token'); localStorage.removeItem('admin_supabase_refresh_token'); router.push('/login') }} className="kbs-btn-logout">
              Çıkış
            </button>
          </div>
        </div>
      </nav>
      <main className="kbs-main">{content}</main>
    </div>
  )
}

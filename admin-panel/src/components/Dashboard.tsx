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

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await api.get('/admin/dashboard')
      setStats(response.data)
    } catch (error: unknown) {
      toast.error('Dashboard verileri yüklenemedi')
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as { response?: { status?: number } }
        if (err.response?.status === 401) router.push('/login')
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
      <header className="kbs-hero">
          <div className="kbs-hero-wrap">
            <div className="kbs-hero-border" aria-hidden />
            <div className="kbs-hero-badge">
              <span className="kbs-hero-badge-dot" />
              Canlı Kontrol Paneli
            </div>
          </div>
          <h1 className="kbs-hero-title">KBS Kontrol Merkezi</h1>
          <p className="kbs-hero-sub">
            Tesisler, bildirimler ve sistem durumunu tek ekrandan yönetin
          </p>
        </header>

        {stats && (
          <section className="kbs-stats">
            <article className="kbs-stat-card kbs-stat-card--total kbs-stat-card--d0">
              <div className="kbs-stat-header">
                <span className="kbs-stat-label">Toplam Tesis</span>
                <div className="kbs-stat-icon">
                  <IconBuilding />
                </div>
              </div>
              <p className="kbs-stat-value">{stats.toplamTesis}</p>
            </article>
            <article className="kbs-stat-card kbs-stat-card--active kbs-stat-card--d1">
              <div className="kbs-stat-header">
                <span className="kbs-stat-label">Aktif Tesis</span>
                <div className="kbs-stat-icon">
                  <IconActivity />
                </div>
              </div>
              <p className="kbs-stat-value">{stats.aktifTesis}</p>
            </article>
            <article className="kbs-stat-card kbs-stat-card--notif kbs-stat-card--d2">
              <div className="kbs-stat-header">
                <span className="kbs-stat-label">Günlük Bildirim</span>
                <div className="kbs-stat-icon">
                  <IconBell />
                </div>
              </div>
              <p className="kbs-stat-value">{stats.gunlukBildirim}</p>
            </article>
            <article className="kbs-stat-card kbs-stat-card--error kbs-stat-card--d3">
              <div className="kbs-stat-header">
                <span className="kbs-stat-label">Günlük Hata</span>
                <div className="kbs-stat-icon">
                  <IconAlert />
                </div>
              </div>
              <p className="kbs-stat-value">{stats.gunlukHata}</p>
            </article>
          </section>
        )}

        {stats && stats.kotaAsimi.length > 0 && (
          <section className="kbs-section">
            <div className="kbs-card">
              <h2 className="kbs-card-title">
                <IconChart />
                Kota Aşımı Olan Tesisler
              </h2>
              <div className="kbs-table-wrap">
                <table className="kbs-table">
                  <thead>
                    <tr>
                      <th>Tesis Adı</th>
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
            <div className="kbs-card">
              <h2 className="kbs-card-title">
                <IconChart />
                Kota Aşımı
              </h2>
              <p className="kbs-card-empty-text">Kota aşımı bulunan tesis yok.</p>
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
            MyKBS
          </Link>
          <div className="kbs-nav-links">
            <Link href="/tesisler" className="kbs-nav-link">Tesisler</Link>
            <Link href="/users" className="kbs-nav-link">Kullanıcılar</Link>
            <Link href="/community" className="kbs-nav-link">Topluluk</Link>
            <Link href="/kbs-notifications" className="kbs-nav-link">KBS Bildirimleri</Link>
            <Link href="/audit" className="kbs-nav-link">Audit</Link>
            <button type="button" onClick={() => { localStorage.removeItem('admin_token'); router.push('/login') }} className="kbs-btn-logout">
              Çıkış
            </button>
          </div>
        </div>
      </nav>
      <main className="kbs-main">{content}</main>
    </div>
  )
}

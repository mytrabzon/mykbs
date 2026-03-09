'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface MisafirKisa {
  id: string
  ad: string
  soyad: string
}

interface OdaItem {
  id: string
  odaNumarasi: string
  odaTipi: string
  kapasite: number
  durum: string
  fotograf: string | null
  not: string | null
  _count: { misafirler: number }
  misafirler: MisafirKisa[]
}

interface OdalarResponse {
  tesis: { id: string; tesisAdi: string; tesisKodu: string }
  odalar: OdaItem[]
  ozet: { toplam: number; dolu: number; bos: number }
}

type FiltreDurum = 'tum' | 'dolu' | 'bos'

export default function TesisOdalarPage() {
  const params = useParams()
  const router = useRouter()
  const tesisId = params?.id as string
  const [data, setData] = useState<OdalarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<FiltreDurum>('tum')

  useEffect(() => {
    if (!tesisId) return
    load()
  }, [tesisId])

  const load = async () => {
    try {
      const res = await api.get<OdalarResponse>(`/admin/tesis/${tesisId}/odalar`)
      setData(res.data)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
      else if (err.response?.status === 404) toast.error('Tesis bulunamadı')
      else toast.error('Odalar yüklenemedi')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="kbs-loading">
        <div className="kbs-loading-inner">
          <div className="kbs-loading-spinner" />
          <p className="kbs-loading-text">Odalar yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="admin-page">
        <p className="kbs-page-sub">Veri yüklenemedi.</p>
        <Link href={`/tesisler/${tesisId}`} className="kbs-btn-primary admin-detail-link">
          ← Tesis detayına dön
        </Link>
      </div>
    )
  }

  const { tesis, odalar, ozet } = data
  const filtrelenmis = filtre === 'tum'
    ? odalar
    : filtre === 'dolu'
      ? odalar.filter(o => o.durum === 'dolu')
      : odalar.filter(o => o.durum === 'bos')

  return (
    <div className="admin-page odalar-page">
      <nav className="odalar-breadcrumb" aria-label="Breadcrumb">
        <Link href="/tesisler" className="odalar-breadcrumb-link">Tesisler</Link>
        <span className="odalar-breadcrumb-sep">/</span>
        <Link href={`/tesisler/${tesisId}`} className="odalar-breadcrumb-link">{tesis.tesisAdi}</Link>
        <span className="odalar-breadcrumb-sep">/</span>
        <span className="odalar-breadcrumb-current">Odalar</span>
      </nav>

      <header className="odalar-header">
        <div>
          <h1 className="kbs-page-title odalar-title">Odalar</h1>
          <p className="kbs-page-sub odalar-sub">{tesis.tesisAdi} · {tesis.tesisKodu}</p>
        </div>
        <Link href={`/tesisler/${tesisId}/misafirler`} className="odalar-btn-misafir">
          Misafirler →
        </Link>
      </header>

      <section className="odalar-ozet">
        <div className="odalar-ozet-card odalar-ozet--toplam">
          <span className="odalar-ozet-label">Toplam</span>
          <span className="odalar-ozet-value">{ozet.toplam}</span>
        </div>
        <div className="odalar-ozet-card odalar-ozet--dolu">
          <span className="odalar-ozet-label">Dolu</span>
          <span className="odalar-ozet-value">{ozet.dolu}</span>
        </div>
        <div className="odalar-ozet-card odalar-ozet--bos">
          <span className="odalar-ozet-label">Boş</span>
          <span className="odalar-ozet-value">{ozet.bos}</span>
        </div>
      </section>

      <div className="odalar-filtre">
        {(['tum', 'dolu', 'bos'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`odalar-filtre-btn ${filtre === key ? 'active' : ''}`}
            onClick={() => setFiltre(key)}
          >
            {key === 'tum' ? 'Tümü' : key === 'dolu' ? 'Dolu' : 'Boş'}
          </button>
        ))}
      </div>

      <section className="odalar-grid" role="list">
        {filtrelenmis.length === 0 ? (
          <div className="odalar-empty">
            <p>Bu filtreye uygun oda yok.</p>
          </div>
        ) : (
          filtrelenmis.map((oda) => {
            const misafir = oda.misafirler[0]
            return (
              <article
                key={oda.id}
                className={`odalar-card odalar-card--${oda.durum}`}
                role="listitem"
              >
                <div className="odalar-card-num">{oda.odaNumarasi}</div>
                <div className="odalar-card-meta">
                  <span className="odalar-card-tip">{oda.odaTipi || '—'}</span>
                  <span className="odalar-card-kapasite">Kapasite: {oda.kapasite}</span>
                </div>
                <div className="odalar-card-badge" data-durum={oda.durum}>
                  {oda.durum === 'dolu' ? 'Dolu' : 'Boş'}
                </div>
                {misafir && (
                  <p className="odalar-card-misafir">
                    {misafir.ad} {misafir.soyad}
                  </p>
                )}
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}

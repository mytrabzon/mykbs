'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface Tesis {
  id: string
  tesisAdi: string
  yetkiliAdSoyad: string
  telefon: string
  email: string
  il: string
  paket: string
  kota: number
  kullanilanKota: number
  kbsTuru: string | null
  durum: string
  createdAt: string
}

export default function TesislerPage() {
  const router = useRouter()
  const [tesisler, setTesisler] = useState<Tesis[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState({ paket: '', durum: '' })

  useEffect(() => {
    loadTesisler()
  }, [filtre])

  const loadTesisler = async () => {
    try {
      const params = new URLSearchParams()
      if (filtre.paket) params.append('paket', filtre.paket)
      if (filtre.durum) params.append('durum', filtre.durum)
      const response = await api.get(`/admin/tesisler?${params.toString()}`)
      setTesisler(Array.isArray(response.data?.tesisler) ? response.data.tesisler : [])
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string }
      if (err.response?.status === 401) router.push('/login')
      else toast.error(err.response?.data?.message || err.message || 'Tesisler yüklenemedi')
      setTesisler([])
    } finally {
      setLoading(false)
    }
  }

  const handleOnayla = async (tesisId: string) => {
    try {
      const response = await api.post(`/admin/tesis/${tesisId}/onayla`)
      const { aktivasyonBilgileri } = response.data
      navigator.clipboard.writeText(aktivasyonBilgileri.mesaj)
      toast.success('Aktivasyon bilgileri panoya kopyalandı!')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Onaylama başarısız')
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

  return (
    <div className="admin-page">
      <h1 className="kbs-page-title">Tesisler</h1>
      <p className="kbs-page-sub">KBS tesis listesi ve onay</p>
      <div className="admin-filters-bar">
        <select aria-label="Paket filtresi" value={filtre.paket} onChange={(e) => setFiltre({ ...filtre, paket: e.target.value })} className="kbs-select admin-select-inline">
          <option value="">Tüm Paketler</option>
          <option value="deneme">Deneme</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select aria-label="Durum filtresi" value={filtre.durum} onChange={(e) => setFiltre({ ...filtre, durum: e.target.value })} className="kbs-select admin-select-inline">
          <option value="">Tüm Durumlar</option>
          <option value="incelemede">İncelemede</option>
          <option value="onaylandi">Onaylandı</option>
          <option value="aktif">Aktif</option>
          <option value="pasif">Pasif</option>
        </select>
      </div>
      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>Tesis Adı</th>
                <th>Yetkili</th>
                <th>Telefon</th>
                <th>İl</th>
                <th>Paket</th>
                <th>Kota</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {tesisler.map((tesis) => {
                const detailHref = `/tesisler/${tesis.id}`
                return (
                  <tr
                    key={tesis.id}
                    className="kbs-table-row-clickable"
                    onClick={() => router.push(detailHref)}
                  >
                    <td className="kbs-table-cell-link">{tesis.tesisAdi}</td>
                    <td className="kbs-table-cell-link">{tesis.yetkiliAdSoyad}</td>
                    <td>{tesis.telefon}</td>
                    <td>{tesis.il}</td>
                    <td>{tesis.paket}</td>
                    <td>{tesis.kullanilanKota} / {tesis.kota}</td>
                    <td>
                      <span className={`kbs-badge ${tesis.durum === 'aktif' ? 'kbs-badge--sent' : tesis.durum === 'onaylandi' ? 'kbs-badge--queued' : tesis.durum === 'incelemede' ? 'kbs-badge--queued' : 'kbs-badge--failed'}`}>
                        {tesis.durum}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {tesis.durum === 'incelemede' && (
                        <button type="button" onClick={() => handleOnayla(tesis.id)} className="kbs-btn-primary kbs-btn-sm kbs-btn-sm-mr">
                          Onayla
                        </button>
                      )}
                      <Link href={`/tesisler/${tesis.id}/kullanicilar`} className="kbs-btn-primary kbs-btn-sm-alt" style={{ marginRight: 6 }} onClick={(e) => e.stopPropagation()}>
                        Kullanıcılar
                      </Link>
                      <Link href={detailHref} className="kbs-btn-primary kbs-btn-sm-alt" onClick={(e) => e.stopPropagation()}>
                        Detay
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {tesisler.length === 0 && (
          <p className="kbs-card-empty-text kbs-card-empty-pad">
            Tesis bulunamadı. Filtreleri temizleyip tekrar deneyin veya backend ve veritabanının çalıştığından emin olun.
          </p>
        )}
      </div>
    </div>
  )
}

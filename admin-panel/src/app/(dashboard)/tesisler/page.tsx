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
      setTesisler(response.data.tesisler)
    } catch (error: unknown) {
      toast.error('Tesisler yüklenemedi')
      const err = error as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
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
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
        <select value={filtre.paket} onChange={(e) => setFiltre({ ...filtre, paket: e.target.value })} className="kbs-select" style={{ marginBottom: 0, width: 'auto' }}>
          <option value="">Tüm Paketler</option>
          <option value="deneme">Deneme</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={filtre.durum} onChange={(e) => setFiltre({ ...filtre, durum: e.target.value })} className="kbs-select" style={{ marginBottom: 0, width: 'auto' }}>
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
              {tesisler.map((tesis) => (
                <tr key={tesis.id}>
                  <td>{tesis.tesisAdi}</td>
                  <td>{tesis.yetkiliAdSoyad}</td>
                  <td>{tesis.telefon}</td>
                  <td>{tesis.il}</td>
                  <td>{tesis.paket}</td>
                  <td>{tesis.kullanilanKota} / {tesis.kota}</td>
                  <td>
                    <span className={`kbs-badge ${tesis.durum === 'aktif' ? 'kbs-badge--sent' : tesis.durum === 'onaylandi' ? 'kbs-badge--queued' : tesis.durum === 'incelemede' ? 'kbs-badge--queued' : 'kbs-badge--failed'}`}>
                      {tesis.durum}
                    </span>
                  </td>
                  <td>
                    {tesis.durum === 'incelemede' && (
                      <button type="button" onClick={() => handleOnayla(tesis.id)} className="kbs-btn-primary" style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.85rem', marginRight: '8px' }}>
                        Onayla
                      </button>
                    )}
                    <Link href={`/tesisler/${tesis.id}`} className="kbs-btn-primary" style={{ width: 'auto', padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'inline-block', textDecoration: 'none', background: 'var(--kbs-surface-elevated)', color: 'var(--kbs-accent)' }}>
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tesisler.length === 0 && <p className="kbs-card-empty-text" style={{ padding: '1.25rem' }}>Tesis bulunamadı.</p>}
      </div>
    </div>
  )
}

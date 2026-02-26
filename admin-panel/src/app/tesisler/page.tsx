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
  const [filtre, setFiltre] = useState({
    paket: '',
    durum: ''
  })

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
    } catch (error: any) {
      toast.error('Tesisler yüklenemedi')
      if (error.response?.status === 401) {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOnayla = async (tesisId: string) => {
    try {
      const response = await api.post(`/admin/tesis/${tesisId}/onayla`)
      const { aktivasyonBilgileri } = response.data

      // Mesajı panoya kopyala
      navigator.clipboard.writeText(aktivasyonBilgileri.mesaj)
      toast.success('Aktivasyon bilgileri panoya kopyalandı!')
      
      // WhatsApp veya email ile gönderme seçeneği sunulabilir
      console.log('Aktivasyon Bilgileri:', aktivasyonBilgileri)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Onaylama başarısız')
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Yükleniyor...</div>
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <nav style={{
        backgroundColor: '#fff',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <Link href="/" style={{ color: '#007AFF', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <h1 style={{ margin: 0 }}>Tesisler</h1>
          <div></div>
        </div>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <select
            value={filtre.paket}
            onChange={(e) => setFiltre({ ...filtre, paket: e.target.value })}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">Tüm Paketler</option>
            <option value="deneme">Deneme</option>
            <option value="standart">Standart</option>
            <option value="pro">Pro</option>
          </select>
          <select
            value={filtre.durum}
            onChange={(e) => setFiltre({ ...filtre, durum: e.target.value })}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">Tüm Durumlar</option>
            <option value="incelemede">İncelemede</option>
            <option value="onaylandi">Onaylandı</option>
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
          </select>
        </div>

        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Tesis Adı</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Yetkili</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Telefon</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>İl</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Paket</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Kota</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Durum</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {tesisler.map((tesis) => (
                <tr key={tesis.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{tesis.tesisAdi}</td>
                  <td style={{ padding: '12px' }}>{tesis.yetkiliAdSoyad}</td>
                  <td style={{ padding: '12px' }}>{tesis.telefon}</td>
                  <td style={{ padding: '12px' }}>{tesis.il}</td>
                  <td style={{ padding: '12px' }}>{tesis.paket}</td>
                  <td style={{ padding: '12px' }}>
                    {tesis.kullanilanKota} / {tesis.kota}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor:
                        tesis.durum === 'aktif' ? '#e8f5e9' :
                        tesis.durum === 'onaylandi' ? '#e3f2fd' :
                        tesis.durum === 'incelemede' ? '#fff3e0' : '#ffebee',
                      color: '#333'
                    }}>
                      {tesis.durum}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {tesis.durum === 'incelemede' && (
                      <button
                        onClick={() => handleOnayla(tesis.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '8px'
                        }}
                      >
                        Onayla
                      </button>
                    )}
                    <Link
                      href={`/tesisler/${tesis.id}`}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#007AFF',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}
                    >
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface Kullanici {
  id: string
  adSoyad: string
  telefon: string
  email: string | null
  kontor?: number
  rol: string
  biyometriAktif: boolean
  checkInYetki: boolean
  odaDegistirmeYetki: boolean
  bilgiDuzenlemeYetki: boolean
  girisOnaylandi: boolean
  girisTalepAt: string | null
  createdAt: string
  updatedAt: string
}

export default function TesisKullanicilarPage() {
  const router = useRouter()
  const params = useParams()
  const tesisId = params?.id as string
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([])
  const [loading, setLoading] = useState(true)
  const [tesisAdi, setTesisAdi] = useState('')

  useEffect(() => {
    if (!tesisId) return
    load()
  }, [tesisId])

  const load = async () => {
    try {
      const [kRes, tRes] = await Promise.all([
        api.get<{ kullanicilar: Kullanici[] }>(`/app-admin/tesis/${tesisId}/kullanicilar`),
        api.get<{ tesis: { tesisAdi: string } }>(`/admin/tesis/${tesisId}`).catch(() => ({ data: { tesis: { tesisAdi: '' } } })),
      ])
      setKullanicilar(kRes.data.kullanicilar || [])
      setTesisAdi(tRes.data?.tesis?.tesisAdi || '')
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
      else toast.error('Kullanıcılar yüklenemedi')
      setKullanicilar([])
    } finally {
      setLoading(false)
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
      <div className="kbs-admin-mb-16">
        <Link href="/tesisler" className="kbs-page-back">← Tesisler</Link>
      </div>
      <h1 className="kbs-page-title">Tesis kullanıcıları</h1>
      <p className="kbs-page-sub">{tesisAdi ? `${tesisAdi} — yetkileri buradan düzenleyebilirsiniz.` : `Tesis ID: ${tesisId}`}</p>
      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Kontör</th>
                <th>Rol</th>
                <th>Check-in</th>
                <th>Oda değişim</th>
                <th>Bilgi düzenleme</th>
                <th>Giriş onaylı</th>
                <th>İşlem</th>
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
                  <td>{k.telefon}</td>
                  <td>{k.email || '—'}</td>
                  <td>{k.kontor ?? 0}</td>
                  <td>{k.rol}</td>
                  <td>{k.checkInYetki ? 'Evet' : 'Hayır'}</td>
                  <td>{k.odaDegistirmeYetki ? 'Evet' : 'Hayır'}</td>
                  <td>{k.bilgiDuzenlemeYetki ? 'Evet' : 'Hayır'}</td>
                  <td>{k.girisOnaylandi ? 'Evet' : 'Hayır'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Link href={`/kullanicilar/${k.id}`} className="kbs-btn-primary admin-users-link">
                      Detay / Düzenle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {kullanicilar.length === 0 && <p className="kbs-card-empty-text kbs-card-empty-pad">Bu tesise ait kullanıcı yok.</p>}
      </div>
    </div>
  )
}

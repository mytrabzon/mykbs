'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface Oda {
  id: string
  odaNumarasi: string
  odaTipi: string
}

interface Misafir {
  id: string
  ad: string
  ad2: string | null
  soyad: string
  kimlikNo: string | null
  pasaportNo: string | null
  dogumTarihi: string
  uyruk: string
  misafirTipi: string | null
  girisTarihi: string
  cikisTarihi: string | null
  email: string | null
  oda: Oda
  createdAt: string
}

export default function TesisMisafirlerPage() {
  const router = useRouter()
  const params = useParams()
  const tesisId = params?.id as string
  const [misafirler, setMisafirler] = useState<Misafir[]>([])
  const [loading, setLoading] = useState(true)
  const [tesisAdi, setTesisAdi] = useState('')
  const [showCikisYapmis, setShowCikisYapmis] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')

  useEffect(() => {
    if (!tesisId) return
    load()
  }, [tesisId, showCikisYapmis])

  const load = async () => {
    try {
      const [mRes, tRes] = await Promise.all([
        api.get<{ misafirler: Misafir[] }>(
          `/app-admin/tesis/${tesisId}/misafirler?cikisYapmis=${showCikisYapmis ? 'true' : 'false'}`
        ),
        api.get<{ tesis: { tesisAdi: string } }>(`/admin/tesis/${tesisId}`).catch(() => ({ data: { tesis: { tesisAdi: '' } } })),
      ])
      setMisafirler(mRes.data.misafirler || [])
      setTesisAdi(tRes.data?.tesis?.tesisAdi || '')
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) router.push('/login')
      else toast.error('Misafirler yüklenemedi')
      setMisafirler([])
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (m: Misafir) => {
    setEditingId(m.id)
    setEditEmail(m.email || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditEmail('')
  }

  const saveEmail = async (misafirId: string) => {
    try {
      await api.patch(`/app-admin/tesis/${tesisId}/misafirler/${misafirId}`, {
        email: editEmail.trim() || null,
      })
      toast.success('E-posta güncellendi')
      setEditingId(null)
      setEditEmail('')
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Güncellenemedi')
    }
  }

  const formatDate = (d: string) => (d ? new Date(d).toLocaleString('tr-TR') : '—')

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
        <span className="kbs-page-back-sep">·</span>
        <Link href={`/tesisler/${tesisId}`} className="kbs-page-back">{tesisAdi || 'Tesis'}</Link>
      </div>
      <h1 className="kbs-page-title">Misafir girişleri</h1>
      <p className="kbs-page-sub">
        {tesisAdi ? `${tesisAdi} — giriş yapan misafirlere e-posta atayarak tanıyabilirsiniz. Liste giriş tarihine göre sıralıdır.` : `Tesis ID: ${tesisId}`}
      </p>

      <div className="kbs-card" style={{ marginBottom: 16 }}>
        <label className="kbs-checkbox-row">
          <input
            type="checkbox"
            checked={showCikisYapmis}
            onChange={(e) => setShowCikisYapmis(e.target.checked)}
          />
          <span>Çıkış yapmış misafirleri de göster</span>
        </label>
      </div>

      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Ad Soyad</th>
                <th>Oda</th>
                <th>Giriş tarihi</th>
                <th>Çıkış tarihi</th>
                <th>E-posta (tanıma)</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {misafirler.length === 0 ? (
                <tr>
                  <td colSpan={7} className="kbs-table-empty">
                    Bu tesise ait {showCikisYapmis ? 'hiç misafir' : 'aktif misafir'} kaydı yok.
                  </td>
                </tr>
              ) : (
                misafirler.map((m, index) => (
                  <tr key={m.id}>
                    <td>{index + 1}</td>
                    <td>{[m.ad, m.ad2, m.soyad].filter(Boolean).join(' ')}</td>
                    <td>Oda {m.oda?.odaNumarasi ?? '—'}</td>
                    <td>{formatDate(m.girisTarihi)}</td>
                    <td>{formatDate(m.cikisTarihi || '')}</td>
                    <td>
                      {editingId === m.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="E-posta"
                            className="kbs-input"
                            style={{ minWidth: 180 }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveEmail(m.id)}
                            className="kbs-btn-primary kbs-btn-sm"
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="kbs-btn-primary kbs-btn-sm-alt"
                          >
                            İptal
                          </button>
                        </div>
                      ) : (
                        <span>{m.email || '—'}</span>
                      )}
                    </td>
                    <td>
                      {editingId === m.id ? null : (
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="kbs-btn-primary kbs-btn-sm-alt"
                        >
                          {m.email ? 'E-posta düzenle' : 'E-posta ata'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

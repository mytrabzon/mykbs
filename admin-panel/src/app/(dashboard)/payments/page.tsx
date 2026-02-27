'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

interface TesisInfo {
  id: string
  tesisAdi: string
  tesisKodu: string
  paket: string
  kota: number
}

interface SiparisRow {
  id: string
  siparisNo: string
  tesisId: string
  paket: string
  tutarTL: number
  kredi: number
  durum: string
  odemeAt: string | null
  adminNot: string | null
  createdAt: string
  tesis: TesisInfo
}

export default function PaymentsPage() {
  const [siparisler, setSiparisler] = useState<SiparisRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState({ durum: '', paket: '' })
  const [actingId, setActingId] = useState<string | null>(null)
  const [adminNot, setAdminNot] = useState('')

  const load = async () => {
    try {
      const params = new URLSearchParams()
      if (filtre.durum) params.set('durum', filtre.durum)
      if (filtre.paket) params.set('paket', filtre.paket)
      const res = await api.get<{ siparisler: SiparisRow[]; total: number }>(`/app-admin/satislar?${params.toString()}`)
      setSiparisler(res.data.siparisler || [])
      setTotal(res.data.total ?? 0)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 401) return
      toast.error('Satışlar yüklenemedi')
      setSiparisler([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filtre.durum, filtre.paket])

  const handleOdendi = async (id: string) => {
    setActingId(id)
    try {
      await api.post(`/app-admin/satislar/${id}/odendi`, { adminNot: adminNot || undefined })
      toast.success('Ödeme kaydedildi, paket tesisine atandı.')
      setAdminNot('')
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'İşlem başarısız')
    } finally {
      setActingId(null)
    }
  }

  const handleIptal = async (id: string) => {
    if (!confirm('Bu siparişi iptal etmek istediğinize emin misiniz?')) return
    setActingId(id)
    try {
      await api.post(`/app-admin/satislar/${id}/iptal`)
      toast.success('Sipariş iptal edildi.')
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'İptal başarısız')
    } finally {
      setActingId(null)
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
      <h1 className="kbs-page-title">Paketler & Ödemeler</h1>
      <p className="kbs-page-sub">
        Satış listesi: mobil &quot;Satın Al&quot; ile oluşturulan siparişler. Ödeme alındığında <strong>Ödeme alındı + Paket ata</strong> ile tesis paketi güncellenir.
      </p>

      <div className="kbs-card" style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.9rem' }}>
            Ödeme notu (havale ref vb. — &quot;Ödeme alındı&quot; tıklandığında gönderilir):
            <input
              type="text"
              placeholder="Opsiyonel"
              value={adminNot}
              onChange={(e) => setAdminNot(e.target.value)}
              className="kbs-input"
              style={{ marginLeft: '0.5rem', width: 240, padding: '0.4rem 0.6rem' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label>
            Durum:
            <select
              value={filtre.durum}
              onChange={(e) => setFiltre({ ...filtre, durum: e.target.value })}
              className="kbs-select"
              style={{ marginLeft: '0.5rem', width: 'auto' }}
            >
              <option value="">Tümü</option>
              <option value="pending">Bekliyor</option>
              <option value="odendi">Ödendi</option>
              <option value="iptal">İptal</option>
            </select>
          </label>
          <label>
            Paket:
            <select
              value={filtre.paket}
              onChange={(e) => setFiltre({ ...filtre, paket: e.target.value })}
              className="kbs-select"
              style={{ marginLeft: '0.5rem', width: 'auto' }}
            >
              <option value="">Tümü</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>
          <button type="button" onClick={() => load()} className="kbs-btn-primary" style={{ padding: '0.45rem 0.9rem' }}>
            Yenile
          </button>
        </div>
      </div>

      <div className="kbs-card">
        <div className="kbs-table-wrap">
          <table className="kbs-table">
            <thead>
              <tr>
                <th>Sipariş no</th>
                <th>Tesis</th>
                <th>Paket</th>
                <th>Tutar</th>
                <th>Kredi</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {siparisler.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'monospace' }}>{s.siparisNo}</td>
                  <td>
                    {s.tesis?.tesisAdi ?? '—'} <span style={{ color: 'var(--kbs-text-muted)', fontSize: '0.85rem' }}>({s.tesis?.tesisKodu})</span>
                  </td>
                  <td>{s.paket}</td>
                  <td>{s.tutarTL.toLocaleString('tr-TR')} ₺</td>
                  <td>{s.kredi}</td>
                  <td>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        fontSize: '0.85rem',
                        background:
                          s.durum === 'odendi'
                            ? 'var(--kbs-success-bg, #dcfce7)'
                            : s.durum === 'iptal'
                              ? 'var(--kbs-surface-elevated)'
                              : 'var(--kbs-warning-bg, #fef3c7)',
                        color:
                          s.durum === 'odendi' ? 'var(--kbs-success, #16a34a)' : s.durum === 'iptal' ? 'var(--kbs-text-muted)' : 'var(--kbs-warning, #b45309)',
                      }}
                    >
                      {s.durum === 'pending' ? 'Bekliyor' : s.durum === 'odendi' ? 'Ödendi' : 'İptal'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.9rem' }}>{new Date(s.createdAt).toLocaleString('tr-TR')}</td>
                  <td>
                    {s.durum === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOdendi(s.id)}
                          disabled={actingId !== null}
                          className="kbs-btn-primary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem', marginRight: 4 }}
                        >
                          {actingId === s.id ? '...' : 'Ödeme alındı + Paket ata'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIptal(s.id)}
                          disabled={actingId !== null}
                          className="kbs-btn-secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                        >
                          İptal
                        </button>
                      </>
                    )}
                    {s.durum === 'odendi' && s.odemeAt && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--kbs-text-muted)' }}>
                        Ödeme: {new Date(s.odemeAt).toLocaleString('tr-TR')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {siparisler.length === 0 && (
          <p className="kbs-card-empty-text" style={{ padding: '1.25rem' }}>
            Sipariş bulunamadı. Mobil uygulamada &quot;Satın Al&quot; ile sipariş oluşturulduğunda burada listelenir.
          </p>
        )}
      </div>
    </div>
  )
}

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

      <div className="kbs-card admin-payments-note-card">
        <div className="admin-payments-note-row">
          <label className="admin-payments-label">
            Ödeme notu (havale ref vb. — &quot;Ödeme alındı&quot; tıklandığında gönderilir):
            <input
              type="text"
              placeholder="Opsiyonel"
              value={adminNot}
              onChange={(e) => setAdminNot(e.target.value)}
              className="kbs-input admin-payments-note-input"
            />
          </label>
        </div>
        <div className="admin-payments-filters-row">
          <label>
            Durum:
            <select
              aria-label="Sipariş durumu filtresi"
              value={filtre.durum}
              onChange={(e) => setFiltre({ ...filtre, durum: e.target.value })}
              className="kbs-select admin-payments-select-inline"
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
              aria-label="Paket filtresi"
              value={filtre.paket}
              onChange={(e) => setFiltre({ ...filtre, paket: e.target.value })}
              className="kbs-select admin-payments-select-inline"
            >
              <option value="">Tümü</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>
          <button type="button" onClick={() => load()} className="kbs-btn-primary admin-payments-refresh-btn">
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
                  <td className="admin-siparis-no">{s.siparisNo}</td>
                  <td>
                    {s.tesis?.tesisAdi ?? '—'} <span className="admin-tesis-code">({s.tesis?.tesisKodu})</span>
                  </td>
                  <td>{s.paket}</td>
                  <td>{s.tutarTL.toLocaleString('tr-TR')} ₺</td>
                  <td>{s.kredi}</td>
                  <td>
                    <span
                      className={
                        s.durum === 'odendi' ? 'kbs-badge-odendi' : s.durum === 'iptal' ? 'kbs-badge-iptal' : 'kbs-badge-pending'
                      }
                    >
                      {s.durum === 'pending' ? 'Bekliyor' : s.durum === 'odendi' ? 'Ödendi' : 'İptal'}
                    </span>
                  </td>
                  <td className="admin-table-date">{new Date(s.createdAt).toLocaleString('tr-TR')}</td>
                  <td>
                    {s.durum === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOdendi(s.id)}
                          disabled={actingId !== null}
                          className="kbs-btn-primary admin-btn-row"
                        >
                          {actingId === s.id ? '...' : 'Ödeme alındı + Paket ata'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIptal(s.id)}
                          disabled={actingId !== null}
                          className="kbs-btn-secondary admin-btn-iptal"
                        >
                          İptal
                        </button>
                      </>
                    )}
                    {s.durum === 'odendi' && s.odemeAt && (
                      <span className="admin-odeme-date">
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
          <p className="kbs-card-empty-text kbs-card-empty-pad">
            Sipariş bulunamadı. Mobil uygulamada &quot;Satın Al&quot; ile sipariş oluşturulduğunda burada listelenir.
          </p>
        )}
      </div>
    </div>
  )
}

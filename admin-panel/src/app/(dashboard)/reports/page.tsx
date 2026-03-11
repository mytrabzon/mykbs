'use client'

import { useState } from 'react'

function formatDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ReportsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return formatDateInput(d)
  })
  const [to, setTo] = useState(() => formatDateInput(new Date()))
  const [loading, setLoading] = useState<'pdf' | 'excel' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/api\/?$/, '')
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const handlePdf = async () => {
    setLoading('pdf')
    setError(null)
    try {
      const url = `${baseUrl}/api/rapor/maliye/html?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      const res = await fetch(url, { headers: authHeaders })
      if (!res.ok) throw new Error(res.statusText || 'Rapor alınamadı')
      const html = await res.text()
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(html)
        w.document.close()
      } else {
        setError('Açılır pencere engellendi. Lütfen izin verin.')
      }
    } catch (e) {
      setError((e as Error)?.message || 'PDF açılamadı')
    } finally {
      setLoading(null)
    }
  }

  const handleExcel = async () => {
    setLoading('excel')
    setError(null)
    try {
      const url = `${baseUrl}/api/rapor/maliye/export?format=xlsx&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      const res = await fetch(url, { headers: authHeaders })
      if (!res.ok) throw new Error(res.statusText || 'Rapor alınamadı')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Maliye_Raporu_${from.replace(/-/g, '')}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setError((e as Error)?.message || 'Excel indirilemedi')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="admin-page">
      <h1 className="kbs-page-title">Raporlar</h1>
      <p className="kbs-page-sub">Özet raporlar ve Maliye Bakanlığı evrakları.</p>

      <div className="kbs-card" style={{ maxWidth: 560 }}>
        <h2 className="kbs-card-title">Maliye Bakanlığı Raporları</h2>
        <p className="kbs-page-sub" style={{ marginBottom: 16 }}>
          Giriş-çıkış defteri, doluluk, KBS bildirim özeti ve vergi raporu (A4 / Excel).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 100 }}>Başlangıç</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="kbs-input"
              style={{ flex: 1, maxWidth: 180 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 100 }}>Bitiş</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="kbs-input"
              style={{ flex: 1, maxWidth: 180 }}
            />
          </label>
        </div>
        {error && <p style={{ color: 'var(--kbs-error)', marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="kbs-btn kbs-btn-primary"
            onClick={handlePdf}
            disabled={!!loading}
          >
            {loading === 'pdf' ? 'Yükleniyor...' : 'PDF / Yazdır'}
          </button>
          <button
            type="button"
            className="kbs-btn"
            onClick={handleExcel}
            disabled={!!loading}
            style={{ background: '#22c55e', color: '#fff' }}
          >
            {loading === 'excel' ? 'Yükleniyor...' : 'Excel İndir'}
          </button>
        </div>
      </div>
    </div>
  )
}

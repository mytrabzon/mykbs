'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface TenantRow {
  id: string
  otel_adi: string
  yetkili_adi?: string
  yetkili_email?: string
  paket_tipi: string
  durum: string
  oda_sayisi: number
  lisans_bitis?: string
}

export default function MusterilerPage() {
  const [list, setList] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: API'den tenant listesi çek (GET /api/admin/tenants veya Supabase tenants)
    setList([])
    setLoading(false)
  }, [])

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Müşteriler (B2B)</h1>
        <Link href="/musteriler/yeni" className="admin-btn primary">
          Yeni müşteri
        </Link>
      </header>
      {loading ? (
        <p className="admin-muted">Yükleniyor...</p>
      ) : list.length === 0 ? (
        <div className="admin-card">
          <p className="admin-muted">Henüz müşteri yok. Tenant tablosu ile entegrasyon sonrası liste burada görünecek.</p>
          <Link href="/musteriler/yeni" className="admin-btn secondary" style={{ marginTop: 12 }}>
            İlk müşteriyi ekle
          </Link>
        </div>
      ) : (
        <div className="admin-card overflow-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Otel</th>
                <th>Yetkili</th>
                <th>Paket</th>
                <th>Durum</th>
                <th>Oda</th>
                <th>Lisans bitiş</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td>{row.otel_adi}</td>
                  <td>{row.yetkili_adi || '—'}</td>
                  <td>{row.paket_tipi}</td>
                  <td>{row.durum}</td>
                  <td>{row.oda_sayisi}</td>
                  <td>{row.lisans_bitis || '—'}</td>
                  <td>
                    <Link href={`/musteriler/${row.id}`} className="admin-link">Detay</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

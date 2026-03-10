'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function MusteriDetayPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [tenant, setTenant] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    // TODO: GET /api/admin/tenants/[id]
    setTenant(null)
    setLoading(false)
  }, [id])

  if (loading) return <p className="admin-muted">Yükleniyor...</p>
  if (!tenant) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Müşteri bulunamadı.</p>
        <Link href="/musteriler" className="admin-link">← Müşteri listesine dön</Link>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Müşteri detay</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/musteriler/${id}/duzenle`} className="admin-btn secondary">Düzenle</Link>
          <Link href={`/musteriler/${id}/raporlar`} className="admin-btn secondary">Raporlar</Link>
          <button type="button" className="admin-btn secondary" onClick={() => router.back()}>Geri</button>
        </div>
      </header>
      <div className="admin-card">
        <pre style={{ fontSize: 13 }}>{JSON.stringify(tenant, null, 2)}</pre>
      </div>
    </div>
  )
}

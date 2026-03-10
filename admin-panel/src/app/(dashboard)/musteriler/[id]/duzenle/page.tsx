'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function MusteriDuzenlePage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    // TODO: PATCH /api/admin/tenants/[id]
    setSaving(false)
    router.push(`/musteriler/${id}`)
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Müşteri düzenle</h1>
        <button type="button" className="admin-btn secondary" onClick={() => router.back()}>İptal</button>
      </header>
      <div className="admin-card">
        <form onSubmit={handleSubmit} className="admin-form">
          <input type="hidden" name="id" value={id} />
          <label>Otel adı * <input type="text" name="otel_adi" required /></label>
          <label>Yetkili e-posta <input type="email" name="yetkili_email" /></label>
          <label>Paket <select name="paket_tipi"><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option></select></label>
          <label>Durum <select name="durum"><option value="aktif">Aktif</option><option value="pasif">Pasif</option></select></label>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn primary" disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

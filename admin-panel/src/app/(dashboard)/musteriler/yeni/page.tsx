'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function MusteriYeniPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    // TODO: POST /api/admin/tenants
    setSaving(false)
    router.push('/musteriler')
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Yeni müşteri</h1>
        <button type="button" className="admin-btn secondary" onClick={() => router.back()}>
          İptal
        </button>
      </header>
      <div className="admin-card">
        <form onSubmit={handleSubmit} className="admin-form">
          <label>
            Otel adı *
            <input type="text" name="otel_adi" required placeholder="Otel adı" />
          </label>
          <label>
            Yetkili adı
            <input type="text" name="yetkili_adi" placeholder="Yetkili adı soyadı" />
          </label>
          <label>
            Yetkili e-posta
            <input type="email" name="yetkili_email" placeholder="yetkili@otel.com" />
          </label>
          <label>
            Yetkili telefon
            <input type="tel" name="yetkili_telefon" placeholder="+90 5XX XXX XX XX" />
          </label>
          <label>
            Paket
            <select name="paket_tipi" defaultValue="bronze">
              <option value="trial">Deneme</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
            </select>
          </label>
          <label>
            Durum
            <select name="durum" defaultValue="aktif">
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
              <option value="deneme">Deneme</option>
            </select>
          </label>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn primary" disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

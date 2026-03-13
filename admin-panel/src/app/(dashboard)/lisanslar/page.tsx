'use client'

import Link from 'next/link'

export default function LisanslarPage() {
  return (
    <div className="admin-page">
      <div className="kbs-admin-mb-16">
        <Link href="/" className="kbs-page-back">← Ana sayfa</Link>
      </div>
      <header className="admin-page-header">
        <h1 className="admin-page-title">Lisans yönetimi</h1>
      </header>
      <div className="admin-card grid-2">
        <Link href="/lisanslar/paketler" className="admin-card-link">
          <h3>Paketler</h3>
          <p className="admin-muted">Bronze, Silver, Gold paket tanımları ve fiyatlar.</p>
        </Link>
        <Link href="/lisanslar/odemeler" className="admin-card-link">
          <h3>Ödemeler</h3>
          <p className="admin-muted">Ödeme takibi ve faturalandırma.</p>
        </Link>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'

export default function PaketlerPage() {
  return (
    <div className="admin-page">
      <div className="kbs-admin-mb-16">
        <Link href="/lisanslar" className="kbs-page-back">← Lisans yönetimi</Link>
      </div>
      <header className="admin-page-header">
        <h1 className="admin-page-title">Paket tanımları</h1>
      </header>
      <div className="admin-card">
        <p className="admin-muted">trial, bronze, silver, gold paketleri ve kota/özellik matrisi burada yönetilecek.</p>
      </div>
    </div>
  )
}

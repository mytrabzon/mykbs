'use client'

import Link from 'next/link'

export default function DestekPage() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Destek talepleri</h1>
      </header>
      <div className="admin-card">
        <p className="admin-muted">Müşteri destek talepleri (ticket) listesi burada görüntülenecek.</p>
        <Link href="/destek/ticket/yeni" className="admin-btn secondary" style={{ marginTop: 12 }}>Yeni ticket (placeholder)</Link>
      </div>
    </div>
  )
}

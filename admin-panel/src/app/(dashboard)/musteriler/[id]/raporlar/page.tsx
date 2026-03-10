'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function MusteriRaporlarPage() {
  const params = useParams()
  const id = params?.id as string

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Müşteri raporları</h1>
        <Link href={`/musteriler/${id}`} className="admin-btn secondary">← Detaya dön</Link>
      </header>
      <div className="admin-card">
        <p className="admin-muted">Bu müşteriye özel doluluk, gelir ve belge tarama raporları burada listelenecek.</p>
      </div>
    </div>
  )
}

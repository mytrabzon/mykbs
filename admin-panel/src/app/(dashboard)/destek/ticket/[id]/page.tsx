'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function DestekTicketDetayPage() {
  const params = useParams()
  const id = params?.id as string

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Ticket #{id}</h1>
        <Link href="/destek" className="admin-btn secondary">← Listeye dön</Link>
      </header>
      <div className="admin-card">
        <p className="admin-muted">Ticket detayı ve mesaj geçmişi.</p>
      </div>
    </div>
  )
}

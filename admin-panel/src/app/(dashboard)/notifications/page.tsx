'use client'

import Link from 'next/link'

export default function NotificationsPage() {
  return (
    <div className="admin-page">
      <h1 className="kbs-page-title">Bildirim & Duyurular</h1>
      <p className="kbs-page-sub">Push, in-app inbox, zorunlu duyuru. Composer + okundu sayacı.</p>
      <div className="kbs-card">
        <p className="kbs-card-empty-text admin-notifications-empty">
          Bildirim bölümü kullanıma açıktır. KBS bildirim kuyruğu için{' '}
          <Link href="/kbs-notifications" className="admin-notifications-inline-link">KBS Bildirimleri</Link> sayfasını kullanabilirsiniz.
        </p>
      </div>
    </div>
  )
}

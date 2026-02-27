'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/live', label: 'Canlı Akış', icon: '🔴' },
  { href: '/users', label: 'Kullanıcılar', icon: '👥' },
  { href: '/identity', label: 'Kimlik & Pasaport', icon: '🪪' },
  { href: '/payments', label: 'Paketler & Ödemeler', icon: '💳' },
  { href: '/tesisler', label: 'Tesis Listesi', icon: '🏢' },
  { href: '/notifications', label: 'Bildirim & Duyurular', icon: '📢' },
  { href: '/reports', label: 'Raporlar', icon: '📈' },
  { href: '/settings', label: 'Ayarlar', icon: '⚙️' },
  { href: '/audit', label: 'Audit Log', icon: '📋' },
] as const

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-inner">
        <Link href="/" className="admin-sidebar-logo">
          <span className="admin-sidebar-logo-dot" />
          MyKBS
        </Link>
        <nav className="admin-sidebar-nav">
          {navItems.map(({ href, label, icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`admin-sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="admin-sidebar-link-icon" aria-hidden>{icon}</span>
                <span className="admin-sidebar-link-label">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

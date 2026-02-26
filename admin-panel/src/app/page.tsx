'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    // Hem admin şifresi hem Supabase JWT ile giriş kabul
    if (token && token.length > 0) {
      setAuthenticated(true)
    } else {
      router.push('/login')
    }
  }, [router])

  if (!authenticated) {
    return (
      <div className="kbs-loading">
        <div className="kbs-loading-inner">
          <div className="kbs-loading-spinner" />
          <p className="kbs-loading-text">Yönlendiriliyor...</p>
        </div>
      </div>
    )
  }

  return <Dashboard />
}


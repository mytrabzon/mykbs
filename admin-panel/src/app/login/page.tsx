'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { setSupabaseToken } from '@/services/supabaseEdge'
import { callEdgeFunction } from '@/services/supabaseEdge'

export default function LoginPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'secret' | 'supabase'>('secret')
  const [loading, setLoading] = useState(false)

  const handleSecretLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || 'admin-secret-key'
    if (secret === adminSecret) {
      localStorage.setItem('admin_token', secret)
      toast.success('Giriş başarılı')
      router.push('/')
    } else {
      toast.error('Geçersiz şifre')
      setLoading(false)
    }
  }

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      toast.error('Supabase yapılandırılmamış')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const token = data.session?.access_token
      if (!token) throw new Error('Oturum alınamadı')
      setSupabaseToken(token)
      const me = await callEdgeFunction<{ role: string }>('me', {})
      if (!['admin', 'moderator'].includes(me?.role || '')) {
        supabase.auth.signOut()
        toast.error('Bu hesap admin/moderator değil')
        setLoading(false)
        return
      }
      setSupabaseToken(token)
      localStorage.setItem('admin_token', token)
      toast.success('Giriş başarılı')
      router.push('/')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Giriş başarısız')
      setLoading(false)
    }
  }

  return (
    <div className="kbs-lobby-login">
      <div className="kbs-bg-canvas">
        <div className="kbs-bg-gradient" />
        <div className="kbs-bg-blobs">
          <div className="kbs-blob kbs-blob--1" aria-hidden />
          <div className="kbs-blob kbs-blob--2" aria-hidden />
          <div className="kbs-blob kbs-blob--3" aria-hidden />
        </div>
        <div className="kbs-bg-grid" />
      </div>
      <div className="kbs-login-card">
        <h1 className="kbs-login-title">MyKBS Admin</h1>
        <div className="kbs-login-tabs">
          <button type="button" onClick={() => setMode('secret')} className={`kbs-login-tab ${mode === 'secret' ? 'active' : ''}`}>Şifre</button>
          <button type="button" onClick={() => setMode('supabase')} className={`kbs-login-tab ${mode === 'supabase' ? 'active' : ''}`}>Supabase</button>
        </div>
        {mode === 'secret' ? (
          <form onSubmit={handleSecretLogin}>
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Admin Şifresi" className="kbs-input" />
            <button type="submit" disabled={loading} className="kbs-btn-primary">{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
          </form>
        ) : (
          <form onSubmit={handleSupabaseLogin}>
            <input type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="kbs-input" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" required className="kbs-input" />
            <button type="submit" disabled={loading} className="kbs-btn-primary">{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
          </form>
        )}
      </div>
    </div>
  )
}


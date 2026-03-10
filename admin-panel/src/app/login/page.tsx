'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { setSupabaseToken } from '@/services/supabaseEdge'
import { callEdgeFunction } from '@/services/supabaseEdge'
import { api } from '@/services/api'

export default function LoginPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'secret' | 'supabase' | 'backend'>('secret')
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

  /** Backend (Prisma) e-posta + şifre — aynı hesap mobilde de kullanılır. ADMIN_KULLANICI_ID ile admin yetkisi verilir. */
  const handleBackendLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const em = (email || '').trim().toLowerCase()
    const sifre = (password || '').trim()
    if (!em || !sifre || sifre.length < 6) {
      toast.error('E-posta ve en az 6 karakter şifre girin')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; kullanici?: { id: number }; tesis?: unknown }>('/auth/giris/yeni', {
        email: em,
        sifre,
      })
      const token = data?.token
      if (!token) {
        toast.error('Giriş başarısız')
        setLoading(false)
        return
      }
      localStorage.setItem('admin_token', token)
      toast.success('Giriş başarılı')
      router.push('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || (err as Error).message || 'Giriş başarısız')
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
      const msg = (err as Error).message || 'Giriş başarısız'
      toast.error(msg === 'Invalid login credentials' ? 'Supabase: E-posta veya şifre hatalı. Panel Şifresi sekmesini deneyin.' : msg)
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
        <h1 className="kbs-login-title">KBS Prime Admin</h1>
        <div className="kbs-login-tabs">
          <button type="button" onClick={() => setMode('secret')} className={`kbs-login-tab ${mode === 'secret' ? 'active' : ''}`}>Panel Şifresi</button>
          <button type="button" onClick={() => setMode('backend')} className={`kbs-login-tab ${mode === 'backend' ? 'active' : ''}`}>E-posta + Şifre</button>
          <button type="button" onClick={() => setMode('supabase')} className={`kbs-login-tab ${mode === 'supabase' ? 'active' : ''}`}>Supabase</button>
        </div>
        {mode === 'secret' ? (
          <form onSubmit={handleSecretLogin}>
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Panel şifresi (.env.local NEXT_PUBLIC_ADMIN_SECRET)" className="kbs-input" autoComplete="off" />
            <button type="submit" disabled={loading} className="kbs-btn-primary">{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
            <p className="kbs-login-hint">Backend veya Supabase gerekmez. Şifre: admin-panel/.env.local içindeki NEXT_PUBLIC_ADMIN_SECRET.</p>
          </form>
        ) : mode === 'backend' ? (
          <form onSubmit={handleBackendLogin}>
            <input type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta (admin hesabı)" required className="kbs-input" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" required minLength={6} className="kbs-input" />
            <button type="submit" disabled={loading} className="kbs-btn-primary">{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
            <p className="kbs-login-hint">Mobil uygulamada da aynı e-posta ve şifre ile giriş yapabilirsiniz.</p>
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


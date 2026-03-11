'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { setSupabaseSession } from '@/services/supabaseEdge'
import { callEdgeFunction } from '@/services/supabaseEdge'
import { api } from '@/services/api'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [secret, setSecret] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'secret' | 'supabase' | 'backend'>('supabase')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_supabase_token')
      localStorage.removeItem('admin_supabase_refresh_token')
      toast('Oturum süreniz doldu. Lütfen tekrar giriş yapın.', { icon: '⏱️' })
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  const handleSecretLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const adminSecret = (process.env.NEXT_PUBLIC_ADMIN_SECRET || '').trim()
    const trimmedSecret = (secret || '').trim()
    if (trimmedSecret && trimmedSecret === adminSecret) {
      localStorage.setItem('admin_token', trimmedSecret)
      toast.success('Giriş başarılı')
      router.push('/')
    } else {
      toast.error('Geçersiz şifre. Backend .env ADMIN_SECRET ile panel .env.local NEXT_PUBLIC_ADMIN_SECRET aynı olmalı.')
      setLoading(false)
    }
  }

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
      const axErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string }
      const msg = axErr.response?.data?.message
      toast.error(msg || (axErr as Error).message || 'Giriş başarısız')
      setLoading(false)
    }
  }

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      toast.error('Supabase yapılandırılmamış. .env.local içinde NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlayın.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const token = data.session?.access_token
      const refreshToken = data.session?.refresh_token ?? null
      if (!token) throw new Error('Oturum alınamadı')
      setSupabaseSession(token, refreshToken)
      const me = await callEdgeFunction<{ role?: string; is_admin?: boolean }>('me', {})
      const allowed = ['admin', 'moderator', 'super_admin'].includes(me?.role || '') || me?.is_admin === true
      if (!allowed) {
        supabase.auth.signOut()
        toast.error('Bu hesap admin yetkisine sahip değil. Veritabanında profiles.is_admin veya user_profiles.role=admin olmalı.')
        setLoading(false)
        return
      }
      setSupabaseSession(token, refreshToken)
      toast.success('Giriş başarılı')
      router.push('/')
    } catch (err: unknown) {
      const e = err as Error & { message?: string }
      const msg = e?.message || 'Giriş başarısız'
      const friendly = msg === 'Invalid login credentials' ? 'E-posta veya şifre hatalı' : msg
      if (msg.includes('Kullanici profili bulunamadi') || msg.includes('NO_PROFILE')) {
        toast.error('Bu kullanıcı için user_profiles kaydı yok. Supabase SQL Editor\'de docs/fix_admin_user.sql çalıştırın.')
      } else {
        toast.error(friendly)
      }
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
          <button type="button" onClick={() => setMode('supabase')} className={`kbs-login-tab ${mode === 'supabase' ? 'active' : ''}`}>E-posta + Şifre</button>
          <button type="button" onClick={() => setMode('backend')} className={`kbs-login-tab ${mode === 'backend' ? 'active' : ''}`}>Backend JWT</button>
          <button type="button" onClick={() => setMode('secret')} className={`kbs-login-tab ${mode === 'secret' ? 'active' : ''}`}>Özel Giriş</button>
        </div>
        {mode === 'secret' ? (
          <form onSubmit={handleSecretLogin}>
            <p className="kbs-login-note">Bu alan kullanıcı girişi için değildir; sadece yetkili personel içindir.</p>
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Özel giriş şifresi" className="kbs-input" autoComplete="off" />
            <button type="submit" disabled={loading} className="kbs-btn-primary">{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
          </form>
        ) : mode === 'backend' ? (
          <form onSubmit={handleBackendLogin}>
            <input type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta (admin hesabı)" required className="kbs-input" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" required minLength={6} className="kbs-input" />
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


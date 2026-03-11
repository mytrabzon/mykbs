const KEY = 'admin_supabase_token'
const KEY_REFRESH = 'admin_supabase_refresh_token'

export function getSupabaseToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEY)
}

export function getSupabaseRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEY_REFRESH)
}

export function setSupabaseToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(KEY, token)
  else localStorage.removeItem(KEY)
}

export function setSupabaseSession(accessToken: string | null, refreshToken: string | null): void {
  if (typeof window === 'undefined') return
  if (accessToken) localStorage.setItem(KEY, accessToken)
  else localStorage.removeItem(KEY)
  if (refreshToken) localStorage.setItem(KEY_REFRESH, refreshToken)
  else localStorage.removeItem(KEY_REFRESH)
  if (accessToken) localStorage.setItem('admin_token', accessToken)
  else localStorage.removeItem('admin_token')
}

/** Supabase ile giriş yapıldıysa session'dan güncel token alır; süresi dolmuşsa refresh dener. */
export async function getValidSupabaseToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const { supabase } = await import('./supabase')
  if (!supabase) return getSupabaseToken()
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      setSupabaseSession(session.access_token, session.refresh_token ?? null)
      return session.access_token
    }
  } catch (_) {}
  const storedAccess = getSupabaseToken()
  const refresh = getSupabaseRefreshToken()
  if (refresh) {
    try {
      await supabase.auth.setSession({
        access_token: storedAccess || refresh,
        refresh_token: refresh,
      })
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data?.session?.access_token) {
        setSupabaseSession(data.session.access_token, data.session.refresh_token ?? null)
        return data.session.access_token
      }
    } catch (_) {}
  }
  return storedAccess
}

export async function callEdgeFunction<T = unknown>(name: string, body?: Record<string, unknown>): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const token = await getValidSupabaseToken()
  if (!url || !anonKey) throw new Error('Bu özellik için Supabase yapılandırması gereklidir. .env dosyasında NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlayın.')
  if (!token) throw new Error('Oturum gerekli')
  const fnUrl = `${url.replace(/\/$/, '')}/functions/v1/${name}`
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': anonKey },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    const refreshed = await getValidSupabaseToken()
    if (refreshed && refreshed !== token) {
      return callEdgeFunction<T>(name, body)
    }
  }
  if (!res.ok) {
    const err = data as { error?: string; message?: string }
    throw new Error(err?.message || err?.error || res.statusText)
  }
  return data as T
}

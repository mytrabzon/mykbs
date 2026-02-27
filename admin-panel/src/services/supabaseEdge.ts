const KEY = 'admin_supabase_token'

export function getSupabaseToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEY)
}

export function setSupabaseToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(KEY, token)
  else localStorage.removeItem(KEY)
}

export async function callEdgeFunction<T = unknown>(name: string, body?: Record<string, unknown>): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const token = getSupabaseToken()
  if (!url || !anonKey) throw new Error('Bu özellik için Supabase yapılandırması gereklidir. .env dosyasında NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlayın.')
  if (!token) throw new Error('Oturum gerekli')
  const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': anonKey },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText)
  return data as T
}

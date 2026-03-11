import axios, { type InternalAxiosRequestConfig } from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - Add admin token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor: 401'de Supabase token ise önce refresh dene; başarısızsa çıkış yap
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('admin_token')
      const isJwt = typeof token === 'string' && (token.match(/\./g)?.length ?? 0) >= 2
      if (isJwt) {
        try {
          const { getValidSupabaseToken } = await import('@/services/supabaseEdge')
          const newToken = await getValidSupabaseToken()
          if (newToken && newToken !== token) {
            const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
            if (!config._retry) {
              config._retry = true
              config.headers.Authorization = `Bearer ${newToken}`
              return api.request(config)
            }
          }
        } catch (_) {
          // refresh failed
        }
        localStorage.removeItem('admin_token')
        const { setSupabaseSession } = await import('@/services/supabaseEdge')
        setSupabaseSession(null, null)
        window.location.href = '/login?expired=1'
      }
    }
    return Promise.reject(error)
  }
)


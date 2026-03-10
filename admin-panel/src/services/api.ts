import axios from 'axios'

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

// Response interceptor: 401'de sadece JWT token ise çıkış yap (Panel Şifresi ile girişte backend 401 dönebilir, token silinmemeli)
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('admin_token')
      // JWT genelde "xxx.yyy.zzz" formatında; panel şifresi düz metin. Sadece JWT ise çıkış yap.
      const isJwt = typeof token === 'string' && (token.match(/\./g)?.length ?? 0) >= 2
      if (isJwt) {
        localStorage.removeItem('admin_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)


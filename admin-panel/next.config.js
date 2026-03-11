/** @type {import('next').NextConfig} */
// Gerekli env: .env.local içinde NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_ADMIN_SECRET (veya ADMIN_SECRET)
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH ? `${process.env.NEXT_PUBLIC_BASE_PATH}/` : '',
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    API_URL: process.env.API_URL || 'http://localhost:3000/api',
    ADMIN_SECRET: process.env.ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_SECRET || '',
  },
}

module.exports = nextConfig


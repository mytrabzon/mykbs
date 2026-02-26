/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Supabase Configuration
    NEXT_PUBLIC_SUPABASE_URL: 'https://iuxnpxszfvyrdifchwvr.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1eG5weHN6ZnZ5cmRpZmNod3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MTg4ODMsImV4cCI6MjA4Mzk5NDg4M30.0Ye4jGaauWA12lvUqhLcaDS7qqod9ijC9_wow8TJY7k',
    // API Configuration
    API_URL: process.env.API_URL || 'http://localhost:3000/api',
    ADMIN_SECRET: process.env.ADMIN_SECRET || 'admin-secret-key'
  }
}

module.exports = nextConfig


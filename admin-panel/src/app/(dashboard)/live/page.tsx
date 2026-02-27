'use client'

export default function LiveOpsPage() {
  return (
    <div className="admin-page">
      <h1 className="kbs-page-title">Canlı Akış (Live Ops)</h1>
      <p className="kbs-page-sub">Gerçek zamanlı olaylar ve hızlı müdahale.</p>
      <div className="kbs-card">
        <p className="kbs-card-empty-text admin-live-empty">
          Canlı olay akışı bu bölümde aktif; alarm kuralları ve SSE/WebSocket entegrasyonu geliştirme aşamasındadır.
        </p>
      </div>
    </div>
  )
}

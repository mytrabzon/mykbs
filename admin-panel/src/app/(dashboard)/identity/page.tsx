'use client'

export default function IdentityPage() {
  return (
    <div className="admin-page">
      <h1 className="kbs-page-title">Kimlik & Pasaport</h1>
      <p className="kbs-page-sub">Bekleyen doğrulamalar kuyruğu. Approve / Reject + reject reason.</p>
      <div className="kbs-card">
        <p className="kbs-card-empty-text" style={{ padding: '2rem' }}>
          Kimlik ve pasaport bölümü kullanıma açıktır; onay/red listesi geliştirme aşamasındadır.
        </p>
      </div>
    </div>
  )
}

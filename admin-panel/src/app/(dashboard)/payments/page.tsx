'use client'

export default function PaymentsPage() {
  return (
    <div className="admin-page">
      <h1 className="kbs-page-title">Paketler & Ödemeler</h1>
      <p className="kbs-page-sub">Transaction listesi, abonelikler, refund / chargeback izleme.</p>
      <div className="kbs-card">
        <p className="kbs-card-empty-text" style={{ padding: '2rem' }}>
          Paketler ve ödemeler bölümü kullanıma açıktır; detaylı FinOps ekranları geliştirme aşamasındadır.
        </p>
      </div>
    </div>
  )
}

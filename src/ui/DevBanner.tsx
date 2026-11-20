import './devBanner.css'

// Geliştirme aşaması uyarısı: ilgili sayfaların EN ÜSTÜNDE kırmızı bant.
// (En İyi Hamle, Soru Maratonu, Doğru Hamle mi?, Zamana Karşı, Küp Kararı, Tek Can)
export function DevBanner() {
  return (
    <div className="dev-banner" role="note">
      ⚠ Bu sayfa ürün geliştirme ve modelleme aşamasındadır.
    </div>
  )
}

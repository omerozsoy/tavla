// Magaza coin paketleri — gercek para (TL) ile satin alma.
// Fiyatlandirma: coin basi kademeli iskonto (buyuk paket = ucuz coin).
export interface CoinPackage {
  id: string
  name: string // TR marka adi (ceviri yok)
  gc: number // verilen coin
  price: number // TL
  discount: number // avantaj yuzdesi (coin basi indirim); 0 = yok
  popular?: boolean // "EN POPULER" (Kasa)
}

// coin basi = price / gc  → Baslangic 1,00 · Kese 0,95 · Sandik 0,90 · Hazine 0,85
//                           · Kasa 0,80 · Servet 0,75 TL
export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'baslangic', name: 'Başlangıç', gc: 100, price: 100, discount: 0 },
  { id: 'kese', name: 'Kese', gc: 500, price: 475, discount: 5 },
  { id: 'sandik', name: 'Sandık', gc: 1000, price: 900, discount: 10 },
  { id: 'hazine', name: 'Hazine', gc: 2500, price: 2125, discount: 15 },
  { id: 'kasa', name: 'Kasa', gc: 5000, price: 4000, discount: 20, popular: true },
  { id: 'servet', name: 'Servet', gc: 10000, price: 7500, discount: 25 },
]

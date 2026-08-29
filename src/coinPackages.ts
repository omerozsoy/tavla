// Magaza coin (jeton) paketleri — gercek para ile satin alma.
// tone: rarityColors ile ayni kademe renk kimligi (ikon halkasi + vurgu).
export interface CoinPackage {
  id: string
  name: string // urun adi (marka; ceviri yok)
  gc: number // verilen jeton (Game Coin)
  price: number // USD
  tone: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
  popular?: boolean // "EN POPULER" rozeti
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pile', name: 'Pile of Coins', gc: 500, price: 0.99, tone: 'common' },
  { id: 'capsule', name: 'Capsule of Coins', gc: 5000, price: 4.99, tone: 'common' },
  { id: 'comet', name: 'Comet of Coins', gc: 15000, price: 9.99, tone: 'rare' },
  { id: 'planet', name: 'Planet of Coins', gc: 50000, price: 19.99, tone: 'rare', popular: true },
  { id: 'galaxy', name: 'Galaxy of Coins', gc: 200000, price: 49.99, tone: 'epic', popular: true },
  { id: 'supernova', name: 'Coin Supernova', gc: 450000, price: 99.99, tone: 'legendary' },
  { id: 'universe', name: 'Universe of Coins', gc: 1250000, price: 249.99, tone: 'mythic' },
]

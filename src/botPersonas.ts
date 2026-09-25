// YZ (bot) KARAKTERLERİ — belirli zorluk seviyeleri için isim + avatar.
//
// En üst iki seviye kişilik kazandı: oyun-içi panelde ve maç kurulum ekranında robot ikonu
// yerine gerçek karakter adı + avatar görseli gösterilir. Diğer seviyeler eskisi gibi
// jenerik "Bilgisayar (Seviye N)" + robot ikonu kalır (persona === undefined).
//
// difficulty (1-12) -> persona. Kaynak tek yer: hem App.tsx (oyun-içi panel + sonuç ekranı)
// hem MatchSetup.tsx (seviye seçimi) buradan okur.

import sesbesSevket from './assets/bots/sesbes-sevket.jpg'
import oklavaliNaciye from './assets/bots/oklavali-naciye.jpg'

export interface BotPersona {
  name: string // oyuncu paneli/sonuç ekranında görünen ad
  avatar: string // bundle'lanmış avatar görseli (import URL)
}

// Level 11 = Grandmaster -> Oklavalı Naciye; Level 12 = Ultimate -> Şeşbeş Şevket.
export const BOT_PERSONAS: Record<number, BotPersona> = {
  11: { name: 'Oklavalı Naciye', avatar: oklavaliNaciye },
  12: { name: 'Şeşbeş Şevket', avatar: sesbesSevket },
}

export function botPersona(difficulty: number | undefined | null): BotPersona | undefined {
  return difficulty ? BOT_PERSONAS[difficulty] : undefined
}

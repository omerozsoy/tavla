// KIZ TAVLASI — basit ama GEÇERLİ yapay zekâ rakip. Kız Tavlası bir şans oyunudur; anlamlı
// strateji minimaldir (haneler bağımsız, sıralama sonucu değiştirmez). Yine de AI DAİMA yalnız
// yasal hamle oynar: oynanabilir zar-slot'larından birini seçer. Kural motorunu (engine) kullanır.
import { playableSlots, type KizState } from './engine'

/**
 * Sıradaki oynanacak zar-slot index'i (veya null = oynanacak hamle yok -> tur biter).
 * Politika: en YÜKSEK değerli zarı önce oyna (kozmetik; sonucu etkilemez ama tutarlı/okunur).
 */
export function aiNextSlot(s: KizState): number | null {
  const slots = playableSlots(s)
  if (slots.length === 0) return null
  // En yüksek zar değerine sahip slot'u seç.
  return slots.reduce((best, i) => (s.dice[i] > s.dice[best] ? i : best), slots[0])
}

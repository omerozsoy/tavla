// Premium yıllık fiyatını panelden (Mağaza > Coin ve Premium) CANLI çeken hook. Admin değiştirince
// site anında yansır (deploy/rebuild yok). İlk render'da statik PLANS fiyatıyla açılır (fallback),
// fetch dönünce günceller. Modül-düzeyi cache -> tek istek, tüm tüketiciler paylaşır (useCoinPackages gibi).
import { useEffect, useState } from 'react'
import { getMembershipPrice } from './api'
import { PLANS } from './plans'

const FALLBACK_TL = PLANS.find((p) => p.id === 'premium')?.yearly ?? 499

let cache: number | null = null
let inflight: Promise<number | null> | null = null

export function useMembershipPrice(): number {
  const [price, setPrice] = useState<number>(cache ?? FALLBACK_TL)
  useEffect(() => {
    if (cache != null) {
      return
    }
    let alive = true
    inflight = inflight ?? getMembershipPrice()
    inflight.then((tl) => {
      if (tl == null) {
        return
      }
      cache = tl
      if (alive) {
        setPrice(tl)
      }
    })
    return () => {
      alive = false
    }
  }, [])
  return price
}

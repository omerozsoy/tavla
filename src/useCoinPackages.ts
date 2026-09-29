// Coin paketlerini panelden (Mağaza > Coin Paketleri) CANLI çeken hook. Fiyat/paket admin'de
// değişince site anında yansır (deploy/rebuild yok). İlk render'da statik COIN_PACKAGES ile açılır
// (fallback), fetch dönünce günceller. Modül-düzeyi cache -> tek istek, tüm tüketiciler paylaşır.
import { useEffect, useState } from 'react'
import { getCoinPackages } from './api'
import { COIN_PACKAGES, type CoinPackage } from './coinPackages'

let cache: CoinPackage[] | null = null
let inflight: Promise<CoinPackage[]> | null = null

export function useCoinPackages(): CoinPackage[] {
  const [pkgs, setPkgs] = useState<CoinPackage[]>(cache ?? COIN_PACKAGES)
  useEffect(() => {
    if (cache) {
      return
    }
    let alive = true
    inflight = inflight ?? getCoinPackages()
    inflight.then((list) => {
      cache = list
      if (alive) {
        setPkgs(list)
      }
    })
    return () => {
      alive = false
    }
  }, [])
  return pkgs
}

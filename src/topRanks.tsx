/**
 * TopRanksProvider — site geneli "top-3 rozet" haritasını TEK yerden yükler.
 * PR sıralamasında ilk 3 (madalya) + Rating sıralamasında ilk 3 (kupa) oyuncunun
 * id→rank eşlemesi. İsimlerin yanındaki <TopRankBadge> bu haritayı okur; böylece
 * her çağrı yeri ayrı ayrı istek atmaz (tek fetch, periyodik tazeleme).
 *
 * Kullanım: <TopRanksProvider> ile sarmalanır (main.tsx), sonra herhangi bir yerde
 * useTopRank(userId) -> { prRank?, ratingRank? }.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { topRanks, type TopRanks } from './api'

export interface UserTopRank {
  /** PR sıralamasındaki sıra (1..3) veya yok. */
  prRank?: number
  /** Rating sıralamasındaki sıra (1..3) veya yok. */
  ratingRank?: number
}

interface Ctx {
  /** id -> { prRank?, ratingRank? } */
  map: Map<number, UserTopRank>
}

const TopRanksContext = createContext<Ctx>({ map: new Map() })

// 3 dakikada bir tazele (top-3 sık değişmez; backend zaten 120s cache'liyor).
const REFRESH_MS = 3 * 60 * 1000

export function TopRanksProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TopRanks | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      topRanks()
        .then((d) => alive && setData(d))
        .catch(() => {
          /* rozetler kritik değil — hata olursa sessizce rozetsiz devam et */
        })
    }
    load()
    const iv = window.setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(iv)
    }
  }, [])

  const map = useMemo(() => {
    const m = new Map<number, UserTopRank>()
    if (data) {
      for (const e of data.pr) {
        const cur = m.get(e.id) ?? {}
        cur.prRank = e.rank
        m.set(e.id, cur)
      }
      for (const e of data.rating) {
        const cur = m.get(e.id) ?? {}
        cur.ratingRank = e.rank
        m.set(e.id, cur)
      }
    }
    return m
  }, [data])

  return <TopRanksContext.Provider value={{ map }}>{children}</TopRanksContext.Provider>
}

/** Bir oyuncunun top-3 rozet durumunu döndürür (yoksa boş obje). */
export function useTopRank(userId?: number | null): UserTopRank {
  const { map } = useContext(TopRanksContext)
  if (userId == null) return {}
  return map.get(userId) ?? {}
}

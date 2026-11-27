/**
 * RanksProvider — site geneli "efektif rütbe" (yeni sistem: rating+PR+EP) haritası.
 * İsim altındaki rütbe rozeti (<PlayerIdentity userId>) bunu okur; böylece lobby, canlı
 * maçlar, turnuva, arkadaşlar, mesajlar — HER yerde rozet 3-kritere göre gösterilir ve
 * her liste endpoint'ine ayrı ayrı rank_key eklemek gerekmez.
 *
 * roles/presence'ten FARKI: tüm kullanıcıları yüklemez (çok büyük) — ekranda GÖRÜNEN
 * userId'leri talep üzerine toplar, 50ms debounce ile TEK /ranks?ids=... isteğinde çeker.
 * Sistem KAPALIysa sunucu boş döner -> rozet rating'e düşer (sıfır değişiklik).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchRanks } from './api'

interface Ctx {
  map: Map<number, string | null>
  request: (id: number) => void
}

const RanksContext = createContext<Ctx>({ map: new Map(), request: () => {} })

// Bilinen id'leri periyodik tazele (maç sonrası rütbe değişebilir). Rütbe nadir değişir -> 60sn.
const REFRESH_MS = 60 * 1000

export function RanksProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Map<number, string | null>>(new Map())
  const pending = useRef<Set<number>>(new Set())
  const known = useRef<Set<number>>(new Set()) // çekildi veya uçuşta
  const timer = useRef<number | undefined>(undefined)

  const merge = useCallback((ids: number[], res: Record<number, string>) => {
    setMap((prev) => {
      const next = new Map(prev)
      for (const id of ids) next.set(id, res[id] ?? null)
      return next
    })
  }, [])

  const flush = useCallback(() => {
    const ids = [...pending.current]
    pending.current.clear()
    if (!ids.length) return
    ids.forEach((id) => known.current.add(id))
    fetchRanks(ids)
      .then((res) => merge(ids, res))
      .catch(() => ids.forEach((id) => known.current.delete(id))) // hata -> tekrar denenebilir
  }, [merge])

  const request = useCallback(
    (id: number) => {
      if (known.current.has(id) || pending.current.has(id)) return
      pending.current.add(id)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, 50)
    },
    [flush],
  )

  // Bilinen id'leri periyodik tazele (maç sonrası güncel kalsın).
  useEffect(() => {
    const iv = window.setInterval(() => {
      const ids = [...known.current]
      if (!ids.length) return
      fetchRanks(ids)
        .then((res) => merge(ids, res))
        .catch(() => {})
    }, REFRESH_MS)
    return () => window.clearInterval(iv)
  }, [merge])

  const value = useMemo<Ctx>(() => ({ map, request }), [map, request])
  return <RanksContext.Provider value={value}>{children}</RanksContext.Provider>
}

/**
 * Bir oyuncunun efektif rütbe anahtarı (div.*). undefined = henüz bilinmiyor/istek dışı;
 * null = sistem kapalı veya veri yok (rozet rating'e düşer); string = otoriter rütbe.
 */
export function useRank(userId?: number | null): string | null | undefined {
  const { map, request } = useContext(RanksContext)
  useEffect(() => {
    if (userId != null) request(userId)
  }, [userId, request])
  return userId != null ? map.get(userId) : undefined
}

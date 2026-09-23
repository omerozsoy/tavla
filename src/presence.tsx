/**
 * PresenceProvider — site geneli "çevrimiçi kullanıcı" haritasını TEK yerden yükler.
 * İsimlerin başındaki yeşil (online, yanıp sönen) / kırmızı (offline) durum noktası
 * (<PlayerIdentity> içindeki nokta) bu haritayı okur; her çağrı yeri ayrı istek atmaz.
 *
 * Kaynak: GET /online-ids (son 70sn görülmüş, 'offline' değil, sistem hesapları hariç
 * kullanıcı id'leri; backend 10sn cache'ler). Burada periyodik olarak (25sn) tazelenir.
 *
 * Kullanım: <PresenceProvider> ile sarmalanır (main.tsx), sonra useOnline(userId).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onlineIds } from './api'

interface Ctx {
  online: Set<number>
  /** İlk fetch tamamlandı mı? (Yüklenmeden nokta gösterme -> kısa "kırmızı flaş" olmasın.) */
  loaded: boolean
}

const PresenceContext = createContext<Ctx>({ online: new Set(), loaded: false })

// 25sn'de bir tazele. Backend 10sn cache + 70sn online penceresi -> nokta ~gerçek-zamanlı.
const REFRESH_MS = 25 * 1000

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>({ online: new Set(), loaded: false })

  useEffect(() => {
    let alive = true
    const load = () => {
      onlineIds()
        .then((ids) => alive && setState({ online: new Set(ids), loaded: true }))
        .catch(() => {
          /* durum noktası kritik değil — hata olursa sessizce devam et */
        })
    }
    load()
    const iv = window.setInterval(load, REFRESH_MS)
    // Sekme tekrar öne gelince hemen tazele (uzun süre arka planda kalmış olabilir).
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <PresenceContext.Provider value={state}>{children}</PresenceContext.Provider>
}

/**
 * Bir oyuncunun çevrimiçi durumu. `known` yalnız ilk fetch tamamlanınca ve userId geçerliyse
 * true olur (o zamana kadar nokta çizilmez). online=true -> yeşil, false -> kırmızı.
 */
export function useOnline(userId?: number | null): { online: boolean; known: boolean } {
  const { online, loaded } = useContext(PresenceContext)
  if (userId == null || !loaded) return { online: false, known: false }
  return { online: online.has(userId), known: true }
}

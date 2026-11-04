/**
 * TeamTagsProvider — site geneli "takım etiketi" haritasını TEK yerden yükler (userId → etiket).
 * İsimlerin yanındaki <TeamTag userId> bu haritayı okur; böylece lobi/maç/profil dahil userId
 * gösterilen her yerde etiket çıkar — ayrı ayrı serializasyon gerekmez (RolesProvider deseni, [[roles.tsx]]).
 *
 * Kullanım: <TeamTagsProvider> ile sarmalanır (main.tsx), sonra useTeamTag(userId) -> string | null.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { teamTags as fetchTeamTags } from './api'

const TeamTagsContext = createContext<Map<number, string>>(new Map())

// 3 dakikada bir tazele (üyelik nadir değişir; backend 60s cache'liyor).
const REFRESH_MS = 3 * 60 * 1000

export function TeamTagsProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    const load = () => {
      fetchTeamTags()
        .then((d) => alive && setTags(d.tags ?? {}))
        .catch(() => {
          /* etiketler kritik değil — hata olursa sessizce etiketsiz devam et */
        })
    }
    load()
    const iv = window.setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(iv)
    }
  }, [])

  const value = useMemo(() => {
    const m = new Map<number, string>()
    for (const [k, v] of Object.entries(tags)) m.set(Number(k), v)
    return m
  }, [tags])

  return <TeamTagsContext.Provider value={value}>{children}</TeamTagsContext.Provider>
}

/** Bir oyuncunun takım etiketi (yoksa null). */
export function useTeamTag(userId?: number | null): string | null {
  const map = useContext(TeamTagsContext)
  if (userId == null) return null
  return map.get(userId) ?? null
}

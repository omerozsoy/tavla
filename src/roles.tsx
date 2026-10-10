/**
 * RolesProvider — site geneli "rol rozeti" haritasını TEK yerden yükler.
 * Yönetici (is_admin) + Destek (is_support) kullanıcı id'leri. İsimlerin yanındaki
 * <RoleBadge userId> bu haritayı okur; böylece PREMIUM gösterilen her yerde (userId
 * ile) kalkan çıkar — ayrı ayrı serializasyon/istek gerekmez. [[topRanks.tsx]] deseni.
 *
 * Kullanım: <RolesProvider> ile sarmalanır (main.tsx), sonra useRole(userId) ->
 * { admin, support }.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { roles as fetchRoles, type Roles } from './api'

export interface UserRole {
  admin: boolean
  support: boolean
}

interface Ctx {
  admins: Set<number>
  support: Set<number>
}

const RolesContext = createContext<Ctx>({ admins: new Set(), support: new Set() })

// 3 dakikada bir tazele (roller nadir değişir; backend zaten 120s cache'liyor).
const REFRESH_MS = 3 * 60 * 1000

export function RolesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Roles | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetchRoles()
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

  const value = useMemo<Ctx>(
    () => ({
      admins: new Set(data?.admins ?? []),
      support: new Set(data?.support ?? []),
    }),
    [data],
  )

  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>
}

/** Bir oyuncunun rol durumunu döndürür (yoksa ikisi de false). */
export function useRole(userId?: number | null): UserRole {
  const { admins, support } = useContext(RolesContext)
  if (userId == null) return { admin: false, support: false }
  return { admin: admins.has(userId), support: support.has(userId) }
}

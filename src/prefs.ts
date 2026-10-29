// Cihazdan-bağımsız kullanıcı tercihleri (tahta, tema, ses, dil, animasyon, oto-zar...).
// KAYNAK = localStorage (tüm mevcut init-from-localStorage mantığı aynen çalışır); giriş
// yapılıysa değişiklik sunucuya (users.prefs JSON) debounce ile yansıtılır ve BAŞKA cihazda
// girişte geri yüklenir (hydrate). Böylece web ↔ app aynı görünür. 'checker' gibi hesaba
// bağlı ama 10 kolon yerine tek JSON + tek /me/prefs merge endpoint.
import { getToken, savePrefs as apiSavePrefs } from './api'

// Senkronlanan anahtarlar (backend whitelist ile BİREBİR aynı olmalı).
export const PREF_KEYS = [
  'tavla.board',
  'tavla.boarddir',
  'tavla.swapstones',
  'tavla.theme',
  'tavla.soundoff',
  'tavla.soundvol',
  'tavla.animoff',
  'tavla.autoRoll',
  'tavla.lang',
  'tavla.learn',
] as const

let pending: Record<string, string> = {}
let timer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  timer = null
  const batch = pending
  pending = {}
  if (Object.keys(batch).length) void apiSavePrefs(batch)
}

// localStorage'a yaz + (giriş varsa) sunucuya debounce'lu sync. null = sil (yalnız yerel).
// Mevcut localStorage.setItem('tavla.xxx', v) çağrılarının birebir yerine geçer.
export function setPref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* kota/private-mode: yoksay */
  }
  if (value === null || !getToken()) return // misafir ya da silme: yalnız yerel
  pending[key] = value
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, 600)
}

// Sunucudan gelen prefs'i localStorage'a yaz (hydrate'in 1. adımı; React state'leri App uygular).
export function writePrefsToStorage(prefs: Record<string, string> | null | undefined): void {
  if (!prefs) return
  for (const k of PREF_KEYS) {
    const v = prefs[k]
    if (typeof v !== 'string') continue
    try {
      localStorage.setItem(k, v)
    } catch {
      /* yoksay */
    }
  }
}

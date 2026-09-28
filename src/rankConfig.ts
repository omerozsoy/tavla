/**
 * Rutbe rating esiklerinin sunucudan hidrasyonu.
 *
 * Esikler yonetim panelinden (Ayarlar > Rating Ayar) duzenlenir; SPA bunlari
 * /api/rank-divisions ucundan okur -> esik degisikligi YENI FRONTEND BUILD GEREKTIRMEZ.
 *
 * IKI ASAMA (ilk boyamada yanlis rutbe gosterilmesin diye):
 *  1) applyCachedRankThresholds(): localStorage'daki son bilinen degerleri SENKRON uygular
 *     (render'dan ONCE, main.tsx). Onbellek yoksa koddaki varsayilanlar kullanilir.
 *  2) initRankThresholds(): arkaplanda ucu cagirir; deger DEGISMISSE onbellege yazar ve
 *     abonelere haber verir -> acik sayfa yeniden render olur (useRankThresholdsVersion).
 *
 * Bozuk/artan-olmayan ayar applyRankThresholds() tarafindan reddedilir -> site varsayilanda kalir.
 */
import { applyRankThresholds, rankThresholds } from './badges'
import { getRankDivisions } from './api'

const CACHE_KEY = 'tavla.rankDivisions.v1'

let version = 0
const listeners = new Set<() => void>()

function emit(): void {
  version++
  for (const fn of listeners) fn()
}

/** Onbellekteki esikleri SENKRON uygula (render oncesi; sessizce basarisiz olur). */
export function applyCachedRankThresholds(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') applyRankThresholds(parsed as Record<string, unknown>)
  } catch {
    /* localStorage kapali / bozuk JSON -> varsayilan esikler kalir */
  }
}

/** Sunucudaki esikleri cek, uygula, onbellege yaz. Hata olursa sessizce mevcut degerlerde kalir. */
export async function initRankThresholds(): Promise<void> {
  let mins: Record<string, unknown>
  try {
    mins = await getRankDivisions()
  } catch {
    return // uc erisilemez -> onbellek/varsayilan gecerli
  }
  if (!mins || typeof mins !== 'object') return
  const before = JSON.stringify(rankThresholds())
  if (!applyRankThresholds(mins)) return // bozuk (artan degil) ayar -> yok say
  const after = JSON.stringify(rankThresholds())
  try {
    localStorage.setItem(CACHE_KEY, after)
  } catch {
    /* kota/gizli mod -> onbelleksiz devam */
  }
  if (after !== before) emit() // acik ekranlardaki rutbeleri tazele
}

/** React aboneligi: esikler degisince bileseni yeniden render eder. */
export function subscribeRankThresholds(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function rankThresholdsVersion(): number {
  return version
}

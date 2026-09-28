/**
 * Rutbe esiklerinin (rating + PR) sunucudan hidrasyonu.
 *
 * IKI esik de yonetim panelinden (Ayarlar > Rating Ayar) duzenlenir ve /api/rank-divisions
 * ucundan gelir -> esik degisikligi YENI FRONTEND BUILD GEREKTIRMEZ:
 *   - divisions : rating ALT esigi (kesin artan)
 *   - prMax     : PR UST esigi (kesin azalan; PR dusuk = iyi)
 *
 * IKI ASAMA (ilk boyamada yanlis rutbe gosterilmesin diye):
 *  1) applyCachedRankThresholds(): localStorage'daki son bilinen degerleri SENKRON uygular
 *     (render'dan ONCE, main.tsx). Onbellek yoksa koddaki varsayilanlar kullanilir.
 *  2) initRankThresholds(): arkaplanda ucu cagirir; deger DEGISMISSE onbellege yazar ve
 *     abonelere haber verir -> acik sayfa yeniden render olur (useRankThresholdsVersion).
 *
 * Bozuk siralanmis ayar apply*Thresholds() tarafindan REDDEDILIR -> o taraf varsayilanda kalir.
 */
import { applyPrThresholds, applyRankThresholds, prThresholds, rankThresholds } from './badges'
import { getRankDivisions, type RankDivisionCfg } from './api'

const CACHE_KEY = 'tavla.rankDivisions.v2' // v2: PR ust esikleri de onbellekte

let version = 0
const listeners = new Set<() => void>()

function emit(): void {
  version++
  for (const fn of listeners) fn()
}

// Onbellek bicimi: { divisions, prMax }. Ikisi BAGIMSIZ uygulanir -> biri bozuksa digeri
// yine de gecerli olur (kismi bozulma tum tabloyu varsayilana dusurmesin).
interface CachedCfg {
  divisions?: Record<string, unknown>
  prMax?: Record<string, unknown>
}

function snapshot(): string {
  return JSON.stringify({ divisions: rankThresholds(), prMax: prThresholds() })
}

/** Onbellekteki esikleri SENKRON uygula (render oncesi; sessizce basarisiz olur). */
export function applyCachedRankThresholds(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    const cfg = parsed as CachedCfg
    if (cfg.divisions) applyRankThresholds(cfg.divisions)
    if (cfg.prMax) applyPrThresholds(cfg.prMax)
  } catch {
    /* localStorage kapali / bozuk JSON -> varsayilan esikler kalir */
  }
}

/** Sunucudaki esikleri cek, uygula, onbellege yaz. Hata olursa sessizce mevcut degerlerde kalir. */
export async function initRankThresholds(): Promise<void> {
  let cfg: RankDivisionCfg
  try {
    cfg = await getRankDivisions()
  } catch {
    return // uc erisilemez -> onbellek/varsayilan gecerli
  }
  const before = snapshot()
  // Bozuk (artan/azalan olmayan) taraf yok sayilir; digeri yine de uygulanir.
  applyRankThresholds(cfg.divisions)
  applyPrThresholds(cfg.prMax)
  const after = snapshot()
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

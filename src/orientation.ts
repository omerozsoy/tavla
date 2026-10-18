// Native kabukta (Capacitor) ekran yonunu kontrol eder: OYUNDA yatay kilit, oyun disinda dikey.
// ONEMLI (bkz push.ts): @capacitor/core'u BUNDLE ETMEYIZ (canli-site WebView'de cift-baslatma ->
// beyaz ekran). Bu yuzden plugin'e enjekte kopruden erisiriz; tarayici/PWA'da window.Capacitor
// yok -> no-op (sitede serbest yon / CSS responsive korunur).
//
// ⚠ KOK DUZELTME 2026-10-19: Eskiden `Capacitor.Plugins.ScreenOrientation` okunuyordu AMA remote-load'da
// (server.url=canli site) Capacitor.Plugins @capacitor/core tarafindan DOLDURULUR; core bundle
// edilmediginden Plugins.ScreenOrientation UNDEFINED -> lock SESSIZCE no-op (oyun yatay donmezdi).
// Enjekte native-bridge DAIMA `Capacitor.nativePromise(pluginName, method, opts)` low-level cagriyi
// saglar (bridge kendisi de CapacitorHttp'yi boyle cagirir). Plugin native tarafta kayitli (APK)
// oldugundan nativePromise dogrudan calisir.

interface CapGlobal {
  isNativePlatform?: () => boolean
  nativePromise?: (pluginName: string, methodName: string, options?: unknown) => Promise<unknown>
  Plugins?: { ScreenOrientation?: { lock(o: { orientation: string }): Promise<void>; unlock(): Promise<void> } }
}

function cap(): CapGlobal | undefined {
  const c = (globalThis as unknown as { Capacitor?: CapGlobal }).Capacitor
  if (!c?.isNativePlatform?.()) return undefined // yalniz native app
  return c
}

// ScreenOrientation plugin cagrisi: once kopru nativePromise (remote-load guvenli), yoksa Plugins proxy
// (bundle'li kurulumlar icin fallback). Ikisi de yoksa no-op (tarayici/PWA).
function call(method: 'lock' | 'unlock', options?: { orientation: string }): Promise<unknown> | undefined {
  const c = cap()
  if (!c) return undefined
  if (c.nativePromise) return c.nativePromise('ScreenOrientation', method, options ?? {})
  const p = c.Plugins?.ScreenOrientation
  if (!p) return undefined
  return method === 'lock' ? p.lock(options as { orientation: string }) : p.unlock()
}

// Istenen yonu tekrar-cagri'ya karsi hatirla (her render'da kopruyu dovmeyelim).
let desired: 'landscape' | 'portrait' | null = null

/** OYUN ekrani: yatay'a kilitle. */
export function lockLandscape(): void {
  if (desired === 'landscape') return
  if (!cap()) return
  desired = 'landscape'
  const r = call('lock', { orientation: 'landscape' })
  if (r) r.catch(() => { desired = null })
}

/** Oyun DISI (lobi/menu/sayfalar): dikey'e kilitle (mobil tasarim dikey). */
export function lockPortrait(): void {
  if (desired === 'portrait') return
  if (!cap()) return
  desired = 'portrait'
  const r = call('lock', { orientation: 'portrait' })
  if (r) r.catch(() => { desired = null; call('unlock') })
}

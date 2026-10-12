// Native kabukta (Capacitor) ekran yonunu kontrol eder: OYUNDA yatay kilit, oyun disinda dikey.
// ONEMLI (bkz push.ts): @capacitor/core'u BUNDLE ETMEYIZ (canli-site WebView'de cift-baslatma ->
// beyaz ekran). Bu yuzden plugin'e YALNIZCA enjekte kopruden (window.Capacitor.Plugins.ScreenOrientation)
// erisiriz; tarayici/PWA'da window.Capacitor yok -> no-op (sitede serbest yon / CSS responsive korunur).

interface OrientationPlugin {
  lock(opts: { orientation: string }): Promise<void>
  unlock(): Promise<void>
}
interface CapGlobal {
  isNativePlatform?: () => boolean
  Plugins?: { ScreenOrientation?: OrientationPlugin }
}

function plugin(): OrientationPlugin | undefined {
  const cap = (globalThis as unknown as { Capacitor?: CapGlobal }).Capacitor
  if (!cap?.isNativePlatform?.()) return undefined // yalniz native app
  return cap.Plugins?.ScreenOrientation
}

// Istenen yonu tekrar-cagri'ya karsi hatirla (her render'da plugin'i dovmeyelim).
let desired: 'landscape' | 'portrait' | null = null

/** OYUN ekrani: yatay'a kilitle. */
export function lockLandscape(): void {
  if (desired === 'landscape') return
  const p = plugin()
  if (!p) return
  desired = 'landscape'
  p.lock({ orientation: 'landscape' }).catch(() => {
    desired = null
  })
}

/** Oyun DISI (lobi/menu/sayfalar): dikey'e kilitle (mobil tasarim dikey). lock desteklenmezse serbest birak. */
export function lockPortrait(): void {
  if (desired === 'portrait') return
  const p = plugin()
  if (!p) return
  desired = 'portrait'
  p.lock({ orientation: 'portrait' }).catch(() => {
    desired = null
    p.unlock().catch(() => {})
  })
}

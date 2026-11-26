// Android donanım "geri" tuşu -> web "geri" (uygulama ANINDA kapanmasın; sayfa açıksa
// history.back(), ana sayfadaysa uygulamayı arka plana al). @capacitor/core BUNDLE EDİLMEZ
// (remote-load WebView'de çift-başlatma -> beyaz ekran) -> enjekte köprü üzerinden, push.ts/
// orientation.ts ile AYNI desen: olay dinleme `Capacitor.addListener('App','backButton',cb)`,
// metot çağrısı `Capacitor.nativePromise('App','minimizeApp')`. iOS'ta donanım-geri YOK -> no-op
// (orada görünür buton iş görür).
interface CapBridge {
  Plugins?: { App?: { addListener?: (e: string, cb: () => void) => unknown; minimizeApp?: () => void } }
  nativePromise?: (pluginName: string, methodName: string, options?: unknown) => Promise<unknown>
  addListener?: (pluginName: string, eventName: string, cb: (data: unknown) => void) => unknown
}

let registered = false

// onBack(): sayfayı geri aldıysa true döndür (history.back). false ise ana sayfadayız ->
// uygulamayı arka plana al (çıkış değil, native "home" davranışı).
export function registerNativeBack(onBack: () => boolean): void {
  if (registered) return
  const cap = (globalThis as unknown as { Capacitor?: CapBridge }).Capacitor
  if (!cap || (!cap.addListener && !cap.Plugins?.App)) return // köprü/App eklentisi yok (web/PWA)
  registered = true
  const handler = () => {
    if (onBack()) return
    if (cap.nativePromise) void cap.nativePromise('App', 'minimizeApp').catch(() => {})
    else cap.Plugins?.App?.minimizeApp?.()
  }
  if (cap.addListener) cap.addListener('App', 'backButton', handler)
  else cap.Plugins?.App?.addListener?.('backButton', handler)
}

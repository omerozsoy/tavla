// Kurulu TavlaTV app WebView'ında mıyız?
// - Android (remote-load): native köprü enjekte OLMAZ / geç gelir -> window.Capacitor GÜVENİLMEZ,
//   doğru sinyal Android WebView UA'sı 'wv' (FB/IG/Google in-app tarayıcıları HARİÇ — onlar bizim app değil).
// - iOS (Capacitor): UA'da 'wv' YOK, gerçek Safari'den UA ile ayrışmaz. Ama iOS native köprü
//   (window.Capacitor) document-start'ta enjekte edilir (Android'in aksine güvenilir/erken) -> getPlatform==='ios'.
// Tarayıcı/masaüstü/PWA = false. Kullanım: BottomNav GÖSTER, footer + SEO + hide_in_app reklam GİZLE (app sadeleştirme).
export function isIOSNativeApp(): boolean {
  try {
    const c = (globalThis as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
    return c?.getPlatform?.() === 'ios'
  } catch {
    return false
  }
}

export const IS_NATIVE_APP =
  (typeof navigator !== 'undefined' &&
    /;\s*wv\)/i.test(navigator.userAgent) &&
    !/FBAN|FBAV|FB_IAB|Instagram|GSA\//i.test(navigator.userAgent)) ||
  isIOSNativeApp()

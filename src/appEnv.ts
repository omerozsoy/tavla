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

// App-sadeleştirilmiş arayüz (5'erli listeler + toplist/liderlik/SEO gizleme). Kurulu uygulamada
// AKTİF; tarayıcıda ÖNİZLEME için `?appui=1` ile zorlanabilir (DevTools'ta doğrulama). Üretimde
// Googlebot/normal ziyaretçi bu param'ı eklemez -> IS_NATIVE_APP'e eşittir (davranış + SEO korunur).
export const APP_UI =
  IS_NATIVE_APP || (typeof location !== 'undefined' && /[?&]appui=1\b/.test(location.search))

// Sadeleştirilmiş görünümü MOBİL TARAYICIYA da uygula (kullanıcı direktifi): Hemen Oyna paneli,
// 5'erli listeler, toplist/liderlik gizleme -> uygulama VEYA mobil ekran (≤1024px). AMA SEO metni
// (SeoContent) buna DAHİL DEĞİL -> o APP_UI'de kalır (yalnız uygulamada gizli). Çünkü Google
// mobil-öncelikli indeksler; SEO metnini mobil webde gizlemek sıralamayı düşürür. Yük anında
// ölçülür (cihaz genişliği sabit -> yeniden-değerlendirme gerekmez; masaüstü dar-pencere nadir).
export const MOBILE_UI =
  APP_UI || (typeof matchMedia !== 'undefined' && matchMedia('(max-width: 1024px)').matches)

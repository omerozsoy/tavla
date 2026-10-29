// Kurulu TavlaTV APK WebView'ında mıyız? (remote-load; native Capacitor köprüsü enjekte OLMAZ, o yüzden
// window.Capacitor'e GÜVENİLMEZ — bkz nativeGoogle. Doğru sinyal Android WebView UA'sı: 'wv'.)
// Facebook/Instagram/Google in-app tarayıcıları HARİÇ (onlar bizim app değil). Tarayıcı/masaüstü = false.
// Kullanım: alt gezinme çubuğu (BottomNav) GÖSTER, footer + SEO içerikleri GİZLE (app'e özgü sadeleştirme).
export const IS_NATIVE_APP =
  typeof navigator !== 'undefined' &&
  /;\s*wv\)/i.test(navigator.userAgent) &&
  !/FBAN|FBAV|FB_IAB|Instagram|GSA\//i.test(navigator.userAgent)

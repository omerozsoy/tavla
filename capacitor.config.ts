import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tavlatv.app',
  appName: 'TavlaTv',
  // Capacitor fallback webDir. server.url canli siteyi yukledigi icin uygulama acilista
  // dogrudan tavlatv.com'u gosterir; bu klasor sadece minimal acilis kabugu (markali
  // "yukleniyor" ekrani). dist'i (26MB WASM) GOMMUYORUZ -> APK ~58MB'den ~birkac MB'a duser.
  webDir: 'android-shell',
  server: {
    // Kabuk CANLI siteyi yukler -> siteyi guncelle, uygulama otomatik guncellenir (TWA gibi).
    // ONEMLI: www KANONIK (tavlatv.com -> 301 -> www.tavlatv.com). server.url'u direkt www yap,
    // yoksa WebView ilk yuklemede baska host'a (www) yonlenir, Capacitor bunu "dis" sayip
    // sayfayi HARICI tarayicida acar (uygulama ici beyaz/Chrome). allowNavigation iki host'u da
    // uygulama ICINDE tutar.
    url: 'https://www.tavlatv.com',
    allowNavigation: ['tavlatv.com', 'www.tavlatv.com'],
    cleartext: false,
  },
}

export default config

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
    // iOS'a gecip native push/OTA eklenince bu strateji tekrar degerlendirilecek.
    // ponytail: canli-URL kabugu, offline-shell/OTA ancak App Store 4.2 veya cevrimdisi gerekirse
    url: 'https://tavlatv.com',
    cleartext: false,
  },
}

export default config

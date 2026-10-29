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
    // ONEMLI: non-www KANONIK. GERCEK: www.tavlatv.com -> 301 -> tavlatv.com (Cloudflare+nginx).
    // server.url www olursa WebView www origin'inde kalir (eski SW pin'ler) ve /api POST'lari
    // www -> 301 yer; Fetch standardi 301'de POST'u GET'e cevirip govdeyi atar -> sunucuya bos
    // login/sifre gider -> "sifre hatali". Bu yuzden server.url DOGRUDAN non-www olmali (hic 301
    // yok, web ile ayni origin). allowNavigation iki host'u da uygulama ICINDE tutar.
    url: 'https://tavlatv.com',
    allowNavigation: ['tavlatv.com', 'www.tavlatv.com'],
    cleartext: false,
  },
}

export default config

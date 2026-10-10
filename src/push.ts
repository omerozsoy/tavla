// Capacitor native uygulama (TavlaTV Android/iOS kabugu) icin push bildirimi kaydi.
// Uygulama server.url ile canli siteyi WebView'de yukler; Capacitor koprusu window.Capacitor'i
// enjekte eder, boylece bu kod native push eklentisini cagirabilir. TARAYICI/PWA'da no-op
// (web-push ayri bir is; isNativePlatform guard ile tamamen atlanir).
import { Capacitor } from '@capacitor/core'
import { registerPushToken } from './api'

let started = false

// Giris yapildiktan SONRA cagir (token gerekli). Birden cok cagri guvenli (started guard).
export async function initPush(): Promise<void> {
  if (started) return
  if (!Capacitor?.isNativePlatform?.()) return // sadece native uygulama
  started = true

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    // Izin: verilmemisse iste. Kullanici reddederse sessizce vazgec.
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') {
      started = false // ileride tekrar denenebilsin
      return
    }

    // FCM token geldiginde sunucuya kaydet.
    await PushNotifications.addListener('registration', (token) => {
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
      registerPushToken(token.value, platform).catch(() => {
        /* gecici hata: bir sonraki acilista tekrar kaydolur */
      })
    })
    await PushNotifications.addListener('registrationError', () => {
      /* FCM kaydi basarisiz (google-services.json/ag) -> sessiz */
    })

    await PushNotifications.register()
  } catch {
    started = false // eklenti yok / native hata -> sonra tekrar denenebilir
  }
}

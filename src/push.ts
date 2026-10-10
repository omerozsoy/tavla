// Capacitor native kabukta (server.url ile CANLI site WebView'de yuklenir) native kopru
// window.Capacitor'i enjekte eder. ONEMLI: @capacitor/core'u BUNDLE ETMEYIZ -> remote-load'da
// bundled core + enjekte native-bridge CIFT-BASLATILIR ve "Cannot read properties of undefined
// (reading 'triggerEvent')" ile beyaz ekrana yol acar. Bu yuzden plugin'e yalnizca enjekte
// kopruden (window.Capacitor.Plugins) erisiriz; tarayici/PWA'da window.Capacitor yok -> no-op.
import { registerPushToken } from './api'

interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>
  requestPermissions(): Promise<{ receive: string }>
  register(): Promise<void>
  addListener(event: string, cb: (data: { value: string }) => void): Promise<unknown>
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  Plugins?: { PushNotifications?: PushPlugin }
}

function capacitor(): CapacitorGlobal | undefined {
  return (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
}

let started = false

// Giris yapildiktan SONRA cagir (token gerekli). Birden cok cagri guvenli (started guard).
export async function initPush(): Promise<void> {
  if (started) return
  const cap = capacitor()
  if (!cap?.isNativePlatform?.()) return // sadece native uygulama (tarayici/PWA'da no-op)
  const pn = cap.Plugins?.PushNotifications
  if (!pn) return // native push eklentisi yuklu degil
  started = true

  try {
    // Izin: verilmemisse iste. Kullanici reddederse sessizce vazgec.
    let perm = await pn.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await pn.requestPermissions()
    }
    if (perm.receive !== 'granted') {
      started = false // ileride tekrar denenebilsin
      return
    }

    // FCM token geldiginde sunucuya kaydet.
    await pn.addListener('registration', (token) => {
      const platform = cap.getPlatform?.() === 'ios' ? 'ios' : 'android'
      registerPushToken(token.value, platform).catch(() => {
        /* gecici hata: bir sonraki acilista tekrar kaydolur */
      })
    })
    await pn.addListener('registrationError', () => {
      /* FCM kaydi basarisiz (google-services.json/ag) -> sessiz */
    })

    await pn.register()
  } catch {
    started = false // native hata -> sonra tekrar denenebilir
  }
}

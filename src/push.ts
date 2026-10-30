// Capacitor native kabukta (server.url ile CANLI site WebView'de yuklenir) native kopru
// window.Capacitor'i enjekte eder. ONEMLI: @capacitor/core'u BUNDLE ETMEYIZ -> remote-load'da
// bundled core + enjekte native-bridge CIFT-BASLATILIR ve beyaz ekrana yol acar.
//
// ⚠ KOK DUZELTME 2026-10-19: Eskiden `Capacitor.Plugins.PushNotifications` okunuyordu AMA remote-load'da
// Capacitor.Plugins @capacitor/core tarafindan DOLDURULUR; core bundle edilmediginden Plugins.X
// UNDEFINED -> push HIC baslamiyordu (bildirim gelmiyordu). Enjekte native-bridge DAIMA low-level
// `Capacitor.nativePromise(pluginName, method, opts)` (metot cagrisi) + `Capacitor.addListener(
// pluginName, eventName, cb)` (olay) saglar; plugin native tarafta kayitli (APK). Bunlari kullaniyoruz;
// bundle'li kurulumlar icin Plugins proxy fallback korundu. (Bkz orientation.ts ayni desen.)
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
  nativePromise?: (pluginName: string, methodName: string, options?: unknown) => Promise<unknown>
  addListener?: (pluginName: string, eventName: string, cb: (data: unknown) => void) => unknown
  Plugins?: { PushNotifications?: PushPlugin }
}

function capacitor(): CapacitorGlobal | undefined {
  const c = (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  if (!c?.isNativePlatform?.()) return undefined // sadece native uygulama (tarayici/PWA'da no-op)
  return c
}

// Metot cagrisi: once kopru nativePromise (remote-load guvenli), yoksa Plugins proxy fallback.
function callPush<T>(cap: CapacitorGlobal, method: string, options?: unknown): Promise<T> | undefined {
  if (cap.nativePromise) return cap.nativePromise('PushNotifications', method, options ?? {}) as Promise<T>
  const pn = cap.Plugins?.PushNotifications as unknown as Record<string, () => Promise<T>> | undefined
  return pn?.[method]?.()
}

// Olay dinleme: once kopru addListener, yoksa Plugins proxy addListener.
function onPush(cap: CapacitorGlobal, event: string, cb: (data: unknown) => void): void {
  if (cap.addListener) {
    cap.addListener('PushNotifications', event, cb)
    return
  }
  cap.Plugins?.PushNotifications?.addListener(event, cb as (d: { value: string }) => void)
}

let started = false

// Giris yapildiktan SONRA cagir (token gerekli). Birden cok cagri guvenli (started guard).
export async function initPush(): Promise<void> {
  if (started) return
  const cap = capacitor()
  if (!cap) return
  if (!cap.nativePromise && !cap.Plugins?.PushNotifications) return // kopru/eklenti yok
  started = true

  try {
    // Izin: verilmemisse iste. Kullanici reddederse sessizce vazgec.
    let perm = await callPush<{ receive: string }>(cap, 'checkPermissions')
    if (perm && (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale')) {
      perm = await callPush<{ receive: string }>(cap, 'requestPermissions')
    }
    if (!perm || perm.receive !== 'granted') {
      started = false // ileride tekrar denenebilsin
      return
    }

    // FCM token geldiginde sunucuya kaydet.
    onPush(cap, 'registration', (data) => {
      const token = (data as { value?: string })?.value
      if (!token) return
      const platform = cap.getPlatform?.() === 'ios' ? 'ios' : 'android'
      registerPushToken(token, platform).catch(() => {
        /* gecici hata: bir sonraki acilista tekrar kaydolur */
      })
    })
    onPush(cap, 'registrationError', () => {
      /* FCM kaydi basarisiz (google-services.json/ag) -> sessiz */
    })

    await callPush(cap, 'register')
  } catch {
    started = false // native hata -> sonra tekrar denenebilir
  }
}

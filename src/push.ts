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
import { registerPushToken, diagPush } from './api'

// GEÇİCİ TANI: yalnız Android WebView app'ten beacon at (web tarayıcıyı boğma). WebView UA'sı "; wv)" taşır.
const isWebViewApp = typeof navigator !== 'undefined' && /;\s*wv\)/.test(navigator.userAgent)
function diag(ev: string, d: Record<string, unknown> = {}): void {
  if (isWebViewApp) diagPush(ev, d)
}

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
  const g = (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  diag('init', {
    hasCap: !!g,
    isNative: !!g?.isNativePlatform?.(),
    platform: g?.getPlatform?.() ?? '',
    hasNativePromise: !!g?.nativePromise,
    hasPluginsProxy: !!g?.Plugins?.PushNotifications,
  })
  const cap = capacitor()
  if (!cap) { diag('exit', { why: 'no-capacitor' }); return }
  if (!cap.nativePromise && !cap.Plugins?.PushNotifications) { diag('exit', { why: 'no-bridge-no-plugin' }); return } // kopru/eklenti yok
  started = true

  try {
    // Izin: verilmemisse iste. Kullanici reddederse sessizce vazgec.
    let perm = await callPush<{ receive: string }>(cap, 'checkPermissions')
    diag('perm-check', { receive: perm?.receive ?? 'null' })
    if (perm && (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale')) {
      perm = await callPush<{ receive: string }>(cap, 'requestPermissions')
      diag('perm-request', { receive: perm?.receive ?? 'null' })
    }
    if (!perm || perm.receive !== 'granted') {
      diag('exit', { why: 'perm-not-granted', receive: perm?.receive ?? 'null' })
      started = false // ileride tekrar denenebilsin
      return
    }

    // FCM token geldiginde sunucuya kaydet.
    onPush(cap, 'registration', (data) => {
      const token = (data as { value?: string })?.value
      diag('registration', { tokenLen: token?.length ?? 0 })
      if (!token) return
      const platform = cap.getPlatform?.() === 'ios' ? 'ios' : 'android'
      registerPushToken(token, platform)
        .then(() => diag('token-saved', { platform }))
        .catch((e) => {
          diag('token-save-fail', { err: String((e as Error)?.message ?? e) })
          /* gecici hata: bir sonraki acilista tekrar kaydolur */
        })
    })
    onPush(cap, 'registrationError', (data) => {
      diag('registration-error', { err: JSON.stringify(data)?.slice(0, 60) ?? '' })
      /* FCM kaydi basarisiz (google-services.json/ag) -> sessiz */
    })

    diag('register-call')
    await callPush(cap, 'register')
    diag('register-called-ok')
  } catch (e) {
    diag('exit', { why: 'exception', err: String((e as Error)?.message ?? e) })
    started = false // native hata -> sonra tekrar denenebilir
  }
}

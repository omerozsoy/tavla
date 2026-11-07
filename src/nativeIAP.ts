// RevenueCat uygulama-içi satın alma (YALNIZ kurulu Android/iOS APK). Google Play dijital mal
// (Premium üyelik) satışını Play Billing üzerinden RevenueCat ile yapar. Web'de NO-OP.
//
// ⚠ REMOTE-LOAD TUZAĞI (bkz nativeGoogle.ts / push.ts): kabuk canlı siteyi WebView'da yükler,
// @capacitor/core BUNDLE EDİLMEZ -> `import { Purchases }` / registerPlugin PROXY'si native'i
// ÇAĞIRMAZ (sessiz no-op). Bu yüzden RevenueCat JS SDK'sını IMPORT ETMİYORUZ; native plugin APK'ya
// derlenir (npm paketi dependency olarak durur + `npx cap sync android`), web tarafı enjekte köprü
// `window.Capacitor.nativePromise('Purchases'|'RevenueCatUI', method, opts)` ile DOĞRUDAN çağırır.
//
// Plugin kayıt adları (node_modules'tan teyit): registerPlugin('Purchases') + registerPlugin('RevenueCatUI').
import { isNativeApp } from './nativeGoogle'

// RevenueCat Android public SDK anahtarı. Frontend'de (dist) yaşar -> deploy ile güncellenir, yeni
// APK gerekmez. ⚠ Şu an TEST anahtarı; canlıda RC panel > Project > API keys > Android ('goog_...').
const RC_ANDROID_KEY = 'test_nHecQlWjmcwCtpCuBtxTNhwMfQD'
// Premium = bu entitlement aktifse. RC panelinde lifetime/yearly/monthly ürünleri buna bağlı.
export const RC_PREMIUM_ENTITLEMENT = 'tavlatv_premium'

type PaywallResult = 'PURCHASED' | 'RESTORED' | 'CANCELLED' | 'ERROR' | 'NOT_PRESENTED'

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  nativePromise?: (pluginName: string, methodName: string, options?: unknown) => Promise<unknown>
  PluginHeaders?: Array<{ name?: string }>
}
function cap(): CapacitorGlobal | undefined {
  return (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
}
function call<T>(plugin: string, method: string, opts?: unknown): Promise<T> {
  const c = cap()
  if (!c?.nativePromise) throw new Error('RevenueCat native bridge yok')
  return c.nativePromise(plugin, method, opts ?? {}) as Promise<T>
}

/**
 * IAP KULLANILABILIR mi? = native APK VE Purchases eklentisi DERLENMIŞ. PluginHeaders authoritative
 * (derlenmiş her plugin burada); enjekte edilmemişse iyimser davran (eski APK'da çağrı "bridge yok"
 * fırlatır, UI web akışına düşer). Web/PWA -> false (satın alma butonu gizli, sepet akışı gösterilir).
 */
export function iapAvailable(): boolean {
  try {
    if (!isNativeApp()) return false
    const headers = cap()?.PluginHeaders
    if (Array.isArray(headers) && headers.length > 0) {
      return headers.some((h) => h?.name === 'Purchases')
    }
    return true
  } catch {
    return false
  }
}

let configuredFor: string | null = null

/**
 * RevenueCat'i YAPILANDIR + kullanıcıyı tanıt (appUserID = bizim user id). Böylece satın alma bu
 * kullanıcıya bağlanır ve RC webhook/REST sync app_user_id ile bizim kullanıcıyı bulur. Aynı kullanıcı
 * için tekrar çağrı güvenli (guard). Giriş SONRASI, satın alma/paywall ÖNCESİ çağır.
 */
export async function iapIdentify(userId: number | string): Promise<void> {
  const uid = String(userId)
  if (configuredFor === uid) return
  if (configuredFor === null) {
    await call<void>('Purchases', 'configure', { apiKey: RC_ANDROID_KEY, appUserID: uid })
  } else {
    // Zaten yapılandırıldı ama farklı/anonim kullanıcı -> yeniden tanıt.
    await call<void>('Purchases', 'logIn', { appUserID: uid })
  }
  configuredFor = uid
}

/** Oturum kapanınca RC kullanıcısını da anonimleştir (bir sonraki kullanıcı karışmasın). */
export async function iapLogout(): Promise<void> {
  if (configuredFor === null) return
  try {
    await call<void>('Purchases', 'logOut', {})
  } catch {
    /* yoksay */
  }
  configuredFor = null
}

/** RevenueCat NATIVE paywall'ı aç (lifetime/yearly/monthly). Satın alma native tarafta tamamlanır. */
export async function iapPresentPaywall(): Promise<PaywallResult> {
  const r = await call<{ result?: PaywallResult }>('RevenueCatUI', 'presentPaywall', {})
  return r?.result ?? 'ERROR'
}

/** Müşteri Merkezi (abonelik yönetimi/iptal/iade) native ekranı. */
export async function iapCustomerCenter(): Promise<void> {
  await call<void>('RevenueCatUI', 'presentCustomerCenter', {})
}

interface CustomerInfoResp {
  customerInfo?: { entitlements?: { active?: Record<string, unknown> } }
}
function hasPremium(ci: CustomerInfoResp): boolean {
  return !!ci?.customerInfo?.entitlements?.active?.[RC_PREMIUM_ENTITLEMENT]
}

/** Client-tarafı entitlement kontrolü (anlık UI geri bildirimi). Sunucu-otoritesi: /iap sync. */
export async function iapHasPremium(): Promise<boolean> {
  try {
    return hasPremium(await call<CustomerInfoResp>('Purchases', 'getCustomerInfo', {}))
  } catch {
    return false
  }
}

/** Satın almaları geri yükle (cihaz değişimi / yeniden kurulum). Entitlement aktif mi döner. */
export async function iapRestore(): Promise<boolean> {
  return hasPremium(await call<CustomerInfoResp>('Purchases', 'restorePurchases', {}))
}

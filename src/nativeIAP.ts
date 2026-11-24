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

// RevenueCat public SDK anahtarları (platform başına AYRI). Frontend'de (dist) yaşar -> deploy ile
// güncellenir, yeni APK/IPA gerekmez. Public key, paylaşımı güvenli.
// Android: RC panel > Project > API keys > TavlaTV Android ('goog_...').
const RC_ANDROID_KEY = 'goog_QsEcmrzVzYhdINaNbMfhiVXJNLo'
// iOS: RC panelde App Store app'i eklenince verilen public key ('appl_...'). TODO: RC panelden al, doldur.
// Boş kaldığı sürece iOS'ta iapIdentify guard'ı configure'u ATLAR (iOS satın alma kapalı; Android/web etkilenmez).
const RC_IOS_KEY = ''
// Premium = bu entitlement aktifse. RC panelinde lifetime/yearly/monthly ürünleri buna bağlı.
export const RC_PREMIUM_ENTITLEMENT = 'tavlatv_premium'

// Aktif platforma uygun RC public anahtarı. iOS appl_ anahtarı henüz girilmemişse '' döner.
function rcApiKey(): string {
  return cap()?.getPlatform?.() === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY
}

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
    if (!rcApiKey()) return false // bu platform için RC anahtarı yok (iOS appl_ henüz girilmemiş) -> IAP kapalı
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
  const key = rcApiKey()
  if (!key) return // iOS appl_ anahtarı henüz yok -> configure etme (iapAvailable zaten false, buton gizli)
  if (configuredFor === null) {
    await call<void>('Purchases', 'configure', { apiKey: key, appUserID: uid })
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

/**
 * Tüketilir coin paketi satın al (Play Billing). productId = Play ürün ID ('coin_baslangic' ...).
 * Satın alma native tarafta tamamlanır; BAŞARILIYSA true döner. İptal/hata EXCEPTION fırlatır
 * (çağıran yakalar). Kaç coin verileceğini SUNUCU belirler (RC REST non_subscriptions) — client
 * sadece "bu ürün alındı" der, backend /iap/revenuecat/coins ile kredilendirir.
 */
export async function iapPurchaseCoin(productId: string): Promise<boolean> {
  const got = await call<{ products?: unknown[] }>('Purchases', 'getProducts', {
    productIdentifiers: [productId],
    type: 'INAPP',
  })
  const product = got?.products?.[0]
  if (!product) throw new Error('Ürün bulunamadı: ' + productId)
  await call<unknown>('Purchases', 'purchaseStoreProduct', { product })
  return true
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

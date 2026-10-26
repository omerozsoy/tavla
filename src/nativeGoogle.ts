// Native Google Sign-In (YALNIZ kurulu APK / Capacitor). Google, gomulu WebView'da GIS/OAuth'u
// engeller (disallowed_useragent) -> web'deki `google.accounts.id` akisi app icinde ID-token'i
// geri dondurmez, kullanici "Gmail sectim ama iceri almiyor" diye takilir. Cozum: Android'in
// NATIVE hesap secicisi (Play Services / Credential Manager) ile ID-token al, AYNI backend
// endpoint'ine (/auth/google, api.googleLogin) gonder -> backend degismez (zaten ID-token dogrular).
//
// webClientId = api.GOOGLE_CLIENT_ID (Web OAuth istemcisi). Native taraf bunu "serverClientId"
// olarak kullanir -> donen ID-token'in aud'si Web client ID olur -> backend config('services.google
// .client_id') ile ESLESIR. (Google Cloud'da ayrica package com.tavlatv.app + SHA-1'li ANDROID
// OAuth istemcisi gerekir; bkz docs/native-google-signin.md.)
//
// ⚠ KOK DUZELTME 2026-10-26: @capacitor/core'u BUNDLE ETMEYIZ (remote-load'da cift-init/beyaz ekran;
// bkz push.ts/orientation.ts) + bundled core'un registerPlugin PROXY'si remote-load'da native'i
// CAGIRMAZ -> plugin import edip `SocialLogin.login()` cagirinca "hicbir aksiyon olmuyor". Enjekte
// native-bridge `window.Capacitor.nativePromise('SocialLogin', method, opts)` native metodu DOGRUDAN
// cagirir (plugin APK'da kayitli). push.ts ile AYNI desen. Hic @capacitor/core / plugin import'u YOK.

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  nativePromise?: (pluginName: string, methodName: string, options?: unknown) => Promise<unknown>
  PluginHeaders?: Array<{ name?: string }>
}

function cap(): CapacitorGlobal | undefined {
  return (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
}

export function isNativeApp(): boolean {
  try {
    return cap()?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

/**
 * Native Google KULLANILABILIR mi? = native platform VE kurulu APK'da SocialLogin eklentisi
 * DERLENMIS. Native-enjekte kopru `window.Capacitor.PluginHeaders` AUTHORITATIVE: derlenmis her
 * plugin burada listelenir (@CapacitorPlugin name="SocialLogin"). Eski APK (plugin yok) -> false ->
 * UI "uygulamayi guncelle" notu gosterir. PluginHeaders enjekte edilmemisse (kopru farkli): iyimser
 * davran (butonu goster) -> gercekten eksikse nativeGoogleSignIn "not implemented" firlatir, UI not'a duser.
 */
export function isNativeGoogleAvailable(): boolean {
  try {
    const c = cap()
    if (!c?.isNativePlatform?.()) return false
    const headers = c.PluginHeaders
    if (Array.isArray(headers) && headers.length > 0) {
      return headers.some((h) => h?.name === 'SocialLogin')
    }
    return true
  } catch {
    return false
  }
}

let initialized = false

/** Native Google hesap secicisini ac, ID-token (JWT credential) dondur. Web'de CAGIRMA. */
export async function nativeGoogleSignIn(webClientId: string): Promise<string> {
  const c = cap()
  if (!c?.nativePromise) throw new Error('SocialLogin not implemented (native bridge yok)')

  if (!initialized) {
    // Native SocialLoginPlugin.initialize({ google: { webClientId } }) -> google provider'i kaydeder.
    await c.nativePromise('SocialLogin', 'initialize', { google: { webClientId } })
    initialized = true
  }

  // options BOS: ozel scope istemek plugin'de Authorization akisini tetikler ve MainActivity'de
  // onActivityResult ister ("You CANNOT use scopes without modifying the main activity"). Bize yalniz
  // KIMLIK (ID-token) lazim; email+profile zaten token'da gelir -> bos options ile Credential Manager
  // ID-token akisi calisir, activity degisikligi gerekmez.
  const res = await c.nativePromise('SocialLogin', 'login', { provider: 'google', options: {} })
  // Native resolve: { provider:'google', result:{ idToken, accessToken, profile } } (GoogleProvider.java).
  const result = (res as { result?: { idToken?: string | null } })?.result
  const idToken = result?.idToken
  if (!idToken) throw new Error('Google ID-token alinamadi')
  return idToken
}

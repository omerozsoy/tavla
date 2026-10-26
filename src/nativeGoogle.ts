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
// Plugin SADECE native'de dinamik import edilir -> web bundle'ini sismez, web build etkilenmez.

import { Capacitor } from '@capacitor/core'

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * Native Google KULLANILABILIR mi? = native platform VE kurulu APK'da SocialLogin eklentisi
 * DERLENMIS. Eski APK'lar (plugin eklenmeden once build edilmis) icin false doner -> UI butonu
 * yerine "uygulamayi guncelle" notu gosterir ("plugin is not implemented on android" hatasini
 * kullaniciya gostermeden onler). Eklenti native kod -> dist deploy ile GELMEZ, yeni APK gerekir.
 */
export function isNativeGoogleAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SocialLogin')
  } catch {
    return false
  }
}

let initialized = false

/** Native Google hesap secicisini ac, ID-token (JWT credential) dondur. Web'de CAGIRMA. */
export async function nativeGoogleSignIn(webClientId: string): Promise<string> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  if (!initialized) {
    await SocialLogin.initialize({ google: { webClientId } })
    initialized = true
  }
  // options.scopes GECME: ozel scope istemek plugin'de Authorization akisini tetikler ve
  // MainActivity'de onActivityResult/handleGoogleLoginIntent ister ("You CANNOT use scopes
  // without modifying the main activity" hatasi). Bize yalniz KIMLIK (ID-token) lazim; email+
  // profile zaten token'da gelir (init varsayilan scope'lari openid/profile/email) -> bos options
  // ile Credential Manager ID-token akisi calisir, activity degisikligi gerekmez.
  const res = await SocialLogin.login({
    provider: 'google',
    options: {},
  })
  // Google sonucu: { provider:'google', result:{ idToken, accessToken, profile } }
  const result = (res as { result?: { idToken?: string | null } })?.result
  const idToken = result?.idToken
  if (!idToken) throw new Error('Google ID-token alinamadi')
  return idToken
}

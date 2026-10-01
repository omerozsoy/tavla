// BAYAT BUNDLE ÇÖZÜMÜ: yeni bir deploy algılandığında kullanıcıyı HABERSİZ yenilemek YERİNE
// "sitenin yeni sürümü var, lütfen güncelleyin" banner'ı gösterilir (UpdateBanner). Reload yalnız
// kullanıcı "Güncelle"ye dokununca olur. Böylece "durup dururken sayfa yenilendi" (özellikle iOS
// Safari arka plana atınca görünmez reload) şikâyeti biter. Banner, aktif maç / hassas rota (ödeme)
// / metin seçimi / bilgi okuma sayfası varken GÖSTERİLMEZ -> güvenli ana ertelenir.
//
// Tespit: açılıştaki bundle giriş hash'i (assets/index-XXXX.js) ile sunucudaki /index.html'in giriş
// hash'i kıyaslanır. Frontend içerik-hash'li olduğundan backend-only deploy hash'i DEĞİŞTİRMEZ ->
// banner çıkmaz; yalnız frontend gerçekten değiştiğinde çıkar. "Maçtayım" tespiti DOM'dan
// (.app.game-view) -> React state'e bağımlılık yok.

import { reloadWithCause } from './reloadDiag'

// Banner'ın KESİNLİKLE gösterilmeyeceği hassas rotalar (form/ödeme akışı bölünmesin).
const SENSITIVE = ['/sepet', '/odeme', '/checkout', '/cart', '/uyelik', '/payment', '/magaza']

function entryOf(text: string): string | null {
  const m = text.match(/index-[A-Za-z0-9_-]+\.js/)
  return m ? m[0] : null
}
function currentEntry(): string | null {
  for (const s of Array.from(document.querySelectorAll('script[type="module"][src]'))) {
    const e = entryOf((s as HTMLScriptElement).getAttribute('src') || '')
    if (e) return e
  }
  for (const l of Array.from(document.querySelectorAll('link[rel="modulepreload"][href]'))) {
    const e = entryOf((l as HTMLLinkElement).getAttribute('href') || '')
    if (e) return e
  }
  return null
}
async function deployedEntry(): Promise<string | null> {
  try {
    // Cache-bust query ŞART: service worker /index.html'i stale-while-revalidate ile BAYAT
    // dönebilir. Benzersiz query -> SW cache miss -> daima ağdan taze HTML.
    const res = await fetch('/index.html?_v=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    return entryOf(await res.text())
  } catch {
    return null
  }
}

// Banner'ı GÖSTERMEK güvenli mi? Aktif maç / hassas rota / metin seçimi / okuma sayfası -> ERTELE.
function unsafeToPrompt(): boolean {
  if (document.querySelector('.app.game-view')) return true // maç/oyun görünümü -> dikkat dağıtma
  const p = (window.location.pathname || '').toLowerCase()
  if (p.startsWith('/bilgi/')) return true // okuma sayfası
  if (window.getSelection()?.toString()) return true // metin seçili
  return SENSITIVE.some((s) => p.includes(s))
}

let pendingTarget: string | null = null // algılanan yeni sürüm (hash)
let notified = false // banner bu oturumda gösterildi mi (tekrar tetikleme)
let listener: (() => void) | null = null // UpdateBanner aboneliği

function maybeNotify(): void {
  if (!pendingTarget || notified || !listener) return
  if (unsafeToPrompt()) return // güvenli ana ertele (interval tekrar dener)
  notified = true
  listener()
}

/** UpdateBanner buna abone olur; yeni sürüm güvenli anda algılanınca çağrılır. */
export function onUpdateAvailable(cb: () => void): void {
  listener = cb
  maybeNotify()
}

/** Banner "Güncelle" butonu -> yeni bundle'ı yükle (reload nedenini damgalayarak). */
export function applyUpdate(): void {
  reloadWithCause('autoupdate')
}

/** main.tsx'ten bir kez. Deploy izler; yeni sürümü güvenli anda banner ile BİLDİRİR (reload etmez). */
export function installAutoUpdate(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const mine = currentEntry()
  if (!mine) return // giriş hash'i saptanamadı -> güvenli taraf: hiçbir şey yapma

  const check = async () => {
    const dep = await deployedEntry()
    if (dep && dep !== mine) pendingTarget = dep // yeni sürüm bulundu (frontend değişti)
    maybeNotify()
  }

  check()
  window.setInterval(check, 5 * 60 * 1000) // 5 dk: yeni deploy tara
  window.setInterval(maybeNotify, 15000) // güvenli ana geçince (maçtan çıkınca vb.) banner'ı sun
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
}

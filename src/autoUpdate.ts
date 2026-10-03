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
export function unsafeToPrompt(): boolean {
  if (document.querySelector('.app.game-view')) return true // maç/oyun görünümü -> dikkat dağıtma
  const p = (window.location.pathname || '').toLowerCase()
  if (p.startsWith('/bilgi/')) return true // okuma sayfası
  if (window.getSelection()?.toString()) return true // metin seçili
  return SENSITIVE.some((s) => p.includes(s))
}

let pendingTarget: string | null = null // algılanan yeni sürüm (hash)
let notified = false // banner bu oturumda gösterildi mi (tekrar tetikleme)
let autoApplied = false // PWA oto-güncellemesi tetiklendi mi (tek sefer)
let listener: (() => void) | null = null // UpdateBanner aboneliği

// Kurulu PWA (standalone) mı? iOS Safari eski `navigator.standalone` + standart display-mode.
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// SONSUZ OTO-RELOAD KALKANI: autoApplied YALNIZ bu oturum için (reload'da sıfırlanır). Reload yeni
// bundle'ı GERÇEKTEN getiremezse (SW bayat kabuğu döndü / o an çevrimdışı / tarayıcı HTTP cache)
// açılış yine eski hash'i görür -> tekrar reload -> "Yükleniyor…"da takılı sonsuz reload döngüsü +
// başlık/URL titremesi (saha vakası: turnuvaya girerken). Son denemeyi sessionStorage'a damgala;
// AYNI hedef için ~60sn içinde zaten denediysek bir daha RELOAD ETME -> banner'a düş (kullanıcı
// elle güncelleyebilir / en azından uygulama kullanılır kalır). Farklı (yeni) deploy = farklı hash
// -> kalkan onu engellemez. (ErrorBoundary'nin chunk-reload kalkanıyla aynı desen.)
const AUTO_KEY = 'tavla.autoUpdateReloadAt'
function recentlyAutoApplied(target: string): boolean {
  try {
    const raw = sessionStorage.getItem(AUTO_KEY)
    if (!raw) return false
    const o = JSON.parse(raw) as { h?: string; t?: number }
    return o.h === target && !!o.t && Date.now() - o.t < 60_000
  } catch {
    return false
  }
}

// Kurulu PWA'da yeni sürümü GÜVENLİ ANDA (maç/ödeme/okuma/seçim yokken) banner beklemeden
// otomatik uygula. Neden: PWA nadiren tamamen kapandığından ve güncelleme kullanıcı-onaylı
// olduğundan PWA kullanıcıları eski bundle'da TAKILIP kalıyordu (ör. turnuva oto-giriş çalışmaz).
// Tarayıcıda yapılmaz (orada banner yeter + "habersiz reload" şikâyeti PWA dışıydı). unsafeToPrompt
// maç (.app.game-view / sonuç ekranı) ve hassas rotaları dışlar -> maç ortasında ASLA reload etmez.
function maybeAutoApply(): void {
  if (!pendingTarget || autoApplied) return
  if (!isStandalone()) return
  if (unsafeToPrompt()) return // güvenli ana ertele (interval/visibility tekrar dener)
  if (recentlyAutoApplied(pendingTarget)) {
    maybeNotify() // döngü kalkanı: reload işe yaramadı -> banner'a düş (sonsuz reload YOK)
    return
  }
  autoApplied = true
  try {
    sessionStorage.setItem(AUTO_KEY, JSON.stringify({ h: pendingTarget, t: Date.now() }))
  } catch {
    /* storage yoksa yine de tek reload dene (kalkansız) */
  }
  reloadWithCause('autoupdate-pwa')
}

function maybeNotify(): void {
  if (!pendingTarget || notified || !listener) return
  if (unsafeToPrompt()) return // güvenli ana ertele (interval tekrar dener)
  notified = true
  listener()
}

/** UpdateBanner buna abone olur; yeni sürüm güvenli anda algılanınca çağrılır. */
export function onUpdateAvailable(cb: () => void): void {
  listener = cb
  maybeAutoApply() // PWA + zaten bekleyen sürüm + güvenli -> banner yerine oto-uygula
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

  // Yeni sürüm algılandıysa: PWA'da güvenli anda oto-uygula, yoksa banner sun.
  const settle = () => {
    maybeAutoApply()
    maybeNotify()
  }

  const check = async () => {
    const dep = await deployedEntry()
    if (dep && dep !== mine) pendingTarget = dep // yeni sürüm bulundu (frontend değişti)
    settle()
  }

  check()
  window.setInterval(check, 5 * 60 * 1000) // 5 dk: yeni deploy tara
  window.setInterval(settle, 15000) // güvenli ana geçince (maçtan çıkınca vb.) oto-uygula/banner
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
}

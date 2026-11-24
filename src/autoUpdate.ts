// ADMIN-TETİKLİ GÜNCELLEME: güncelleme istemi OTOMATİK çıkmaz. Admin panelden "Güncelleme Bildir"e
// basınca sunucudaki update_nonce artar; açık istemciler bunu /realtime-config'ten görüp "yeni sürüm
// var, güncelleyin" banner'ı gösterir (UpdateBanner). Reload yalnız kullanıcı "Güncelle"ye dokununca
// olur. Kurulu PWA'da (standalone) güvenli bir anda sessizce otomatik uygulanır.
//
// Tespit: boot'ta görülen nonce baz alınır; sonraki yoklamalarda nonce ARTINCA (= admin bildirince)
// tetiklenir. Böylece deploy'da kendiliğinden banner ÇIKMAZ — kontrol tamamen admin'de. Banner,
// aktif maç / hassas rota (ödeme) / metin seçimi / bilgi okuma sayfası varken GÖSTERİLMEZ ->
// güvenli ana ertelenir. "Maçtayım" tespiti DOM'dan (.app.game-view) -> React state'e bağımlılık yok.


// Banner'ın KESİNLİKLE gösterilmeyeceği hassas rotalar (form/ödeme akışı bölünmesin).
const SENSITIVE = ['/sepet', '/odeme', '/checkout', '/cart', '/uyelik', '/payment', '/magaza']

// Sunucudaki admin-tetikli güncelleme sinyali (update_nonce). Boot değeri baz; artınca güncelle de.
async function serverNonce(): Promise<number | null> {
  try {
    // Cache-bust ŞART: SW/HTTP cache bayat dönebilir. Benzersiz query -> daima taze.
    const res = await fetch('/api/realtime-config?_v=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const j = (await res.json()) as { updateNonce?: unknown }
    const n = Number(j?.updateNonce)
    return Number.isFinite(n) ? n : null
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

let bootNonce: number | null = null // açılışta görülen nonce (baz). null = henüz okunmadı.
let pendingTarget: number | null = null // admin bildirdiği yeni nonce (artış algılandı)
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
// bundle'ı GERÇEKTEN getiremezse açılış yine eski durumu görür -> tekrar reload riski. Son denemeyi
// sessionStorage'a damgala; AYNI hedef (nonce) için ~60sn içinde zaten denediysek bir daha RELOAD
// ETME -> banner'a düş. Farklı (daha yüksek) nonce = yeni bildirim -> kalkan onu engellemez.
const AUTO_KEY = 'tavla.autoUpdateReloadAt'
function recentlyAutoApplied(target: number): boolean {
  try {
    const raw = sessionStorage.getItem(AUTO_KEY)
    if (!raw) return false
    const o = JSON.parse(raw) as { h?: string; t?: number }
    return o.h === String(target) && !!o.t && Date.now() - o.t < 60_000
  } catch {
    return false
  }
}

// Kurulu PWA'da yeni sürümü GÜVENLİ ANDA (maç/ödeme/okuma/seçim yokken) banner beklemeden otomatik
// uygula. Tarayıcıda yapılmaz (orada banner yeter). unsafeToPrompt maç ve hassas rotaları dışlar.
function maybeAutoApply(): void {
  if (pendingTarget == null || autoApplied) return
  if (!isStandalone()) return
  if (unsafeToPrompt()) return // güvenli ana ertele (interval/visibility tekrar dener)
  if (recentlyAutoApplied(pendingTarget)) {
    maybeNotify() // döngü kalkanı: reload işe yaramadı -> banner'a düş (sonsuz reload YOK)
    return
  }
  autoApplied = true
  try {
    sessionStorage.setItem(AUTO_KEY, JSON.stringify({ h: String(pendingTarget), t: Date.now() }))
  } catch {
    /* storage yoksa yine de tek reload dene (kalkansız) */
  }
  window.location.reload()
}

function maybeNotify(): void {
  if (pendingTarget == null || notified || !listener) return
  if (unsafeToPrompt()) return // güvenli ana ertele (interval tekrar dener)
  notified = true
  listener()
}

/** UpdateBanner buna abone olur; admin güncelleme bildirince güvenli anda çağrılır. */
export function onUpdateAvailable(cb: () => void): void {
  listener = cb
  maybeAutoApply() // PWA + zaten bekleyen sürüm + güvenli -> banner yerine oto-uygula
  maybeNotify()
}

/** Banner "Güncelle" butonu -> yeni bundle'ı yükle. */
export function applyUpdate(): void {
  window.location.reload()
}

/** main.tsx'ten bir kez. update_nonce izler; admin bildirince güvenli anda banner ile BİLDİRİR. */
export function installAutoUpdate(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const settle = () => {
    maybeAutoApply()
    maybeNotify()
  }

  const check = async () => {
    const n = await serverNonce()
    if (n == null) return // sunucuya ulaşılamadı -> güvenli taraf: hiçbir şey yapma
    if (bootNonce == null) {
      bootNonce = n // ilk okuma: baz al (bu oturum için "güncel" sayılır -> banner çıkmaz)
      return
    }
    if (n > bootNonce) pendingTarget = n // admin güncelleme bildirdi (nonce arttı)
    settle()
  }

  check()
  window.setInterval(check, 5 * 60 * 1000) // 5 dk: yeni bildirim tara
  window.setInterval(settle, 15000) // güvenli ana geçince (maçtan çıkınca vb.) oto-uygula/banner
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
}

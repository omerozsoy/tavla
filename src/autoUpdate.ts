// BAYAT BUNDLE KALICI ÇÖZÜM: yeni bir deploy algılandığında istemciyi GÜVENLİ bir anda
// (aktif maç / ödeme akışı DIŞINDA) TEK SEFER otomatik yeniler. Böylece kullanıcılar eski
// koddaki hatalarla (ör. maç-sonu desync / yanlış senkron uçları) maça girmez — deploy edilen
// düzeltmeler kullanıcıya HIZLA ulaşır.
//
// Nasıl çalışır:
//  - Açılışta çalışan bundle'ın ana giriş hash'ini (assets/index-XXXX.js) DOM'dan yakalar.
//  - Periyodik + sekmeye dönünce + odakta /index.html'i no-store çeker, oradaki giriş hash'iyle
//    kıyaslar. Deploy additive olduğu için index.html her deploy'da YENİ hash'e döner -> fark =
//    yeni sürüm.
//  - Yeni sürüm varsa: GÜVENLİ an gelince (aktif maç EKRANINDA DEĞİL + ödeme/sepet rotasında
//    DEĞİL) location.reload(). sessionStorage kalkanı reload döngüsünü önler.
//
// TASARIM İLKESİ: aktif maçı ASLA bölme (oyun kaybı/desync olmasın). Yalnız lobi/gezinme
// sırasında yenile. "Maçtayım" tespiti DOM'dan (.app.game-view) yapılır -> React state'e
// bağımlılık yok, App.tsx'e dokunulmaz.

const RELOAD_KEY = 'tavla:autoupdate:target'
// Reload'ın kesinlikle YAPILMAYACAĞI hassas rotalar (form/ödeme akışı yarıda kalmasın).
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
    // Cache-bust query ŞART: service worker /index.html'i stale-while-revalidate ile
    // cache'den (BAYAT) dönebilir. Benzersiz query -> SW cache miss -> daima ağdan taze HTML.
    const res = await fetch('/index.html?_v=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    return entryOf(await res.text())
  } catch {
    return null
  }
}
// GÜVENLİ Mİ? Aktif maç ekranı (.app.game-view) açıkken VEYA hassas bir rotadayken reload etme.
function unsafeToReload(): boolean {
  if (document.querySelector('.app.game-view')) return true // maç/oyun görünümü -> bölme
  const p = (window.location.pathname || '').toLowerCase()
  return SENSITIVE.some((s) => p.includes(s))
}

/** main.tsx'ten bir kez çağrılır. Deploy izleyip güvenli anda otomatik yeniler. */
export function installAutoUpdate() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const mine = currentEntry()
  if (!mine) return // giriş hash'i saptanamadı -> güvenli taraf: hiçbir şey yapma

  let target: string | null = null

  const tryReload = () => {
    if (!target || unsafeToReload()) return
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === target) return // bu sürüme zaten reload denendi
      sessionStorage.setItem(RELOAD_KEY, target)
    } catch {
      /* gizli mod / storage yok -> yine de reload et (bu hedefe ilk denemedir) */
    }
    window.location.reload()
  }

  const check = async () => {
    const dep = await deployedEntry()
    if (dep && dep !== mine) target = dep // yeni sürüm bulundu (deploy oldu)
    tryReload()
  }

  check()
  window.setInterval(check, 5 * 60 * 1000) // 5 dk: yeni deploy tara
  window.setInterval(tryReload, 4000) // güvenli an (lobiye dönüş vb.) gelince hemen uygula
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  window.addEventListener('focus', check)
}

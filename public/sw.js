// Tavla PWA service worker.
// Strateji: gezinme (HTML) -> network-first (bayat paket servis etmez, deploy guvenli).
// Ayni-kaynak GET varliklar (hash'li js/css, wasm, onnx) -> stale-while-revalidate
// (cevrimdisi calisir, arka planda guncellenir). API istekleri ASLA cache'lenmez.
// ONEMLI: respondWith'e HER ZAMAN gecerli bir Response donmeli; undefined donersen
// tarayici "Failed to convert value to 'Response'" atar (fetch VEYA cache.put reddettiginde
// eski surumde iki caches.match da bos olunca bu oluyordu -> asagida her yol Response garanti).
const CACHE = 'tavla-cache-v10'
const CACHE_PREFIX = 'tavla-cache-' // yalniz KENDI surumlu cache'lerimizi temizle; baskasina dokunma

// Son care cevrimdisi yaniti -> YALNIZ gezinme (sayfa) isteklerinde. Tek-kullanimlik body
// oldugundan her cagride YENI uret.
function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Çevrimdışı</title>' +
      '<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">' +
      'İnternet bağlantınız yok. Online tavla oynamak için yeniden bağlanın.</body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

// Varlik (js/css/wasm) istegi cevrimdisi basarisiz olursa HTML cevrimdisi sayfasi DONME ->
// aksi halde bir <script>/<img> HTML metni alir ve "Unexpected token '<'" hatasi uretir.
function assetErrorResponse() {
  return new Response('', { status: 504, statusText: 'Offline' })
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Uygulama kabugunu (index.html = '/') onceden cache'le -> ilk cevrimdisi de calissin.
      try {
        const cache = await caches.open(CACHE)
        await cache.add('/')
      } catch {
        /* install cache basarisiz olsa da SW yuklensin */
      }
      // skipWaiting YOK: yeni SW, tum sekmeler kapanana kadar BEKLER. Boylece acik bir mac
      // sirasinda surum zorla degismez (eski ve yeni varliklar karismaz). Surum guncellemesi
      // zaten icerik-hash'li paket + UpdateBanner ("yeni surum hazir") ile kullanici onayina bagli.
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // YALNIZ kendi eski surumlu cache'lerimizi temizle (tavla-cache-*), baska cache'lere dokunma.
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== CACHE && k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)),
      )
      // clients.claim YOK: acik sayfalari zorla devralma -> suren mac mevcut SW/varliklarla devam etsin.
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // API, SW'nin kendisi VE SUNUCU-RENDER BACKEND ROTALARI (Filament admin, Livewire, ödeme)
  // service worker'dan GEÇMEZ -> tarayıcı doğrudan sunucudan çeker. Aksi halde SW gezinme
  // network-first'ünde bu sayfaları SPA kabuğu ('/index.html') ile karıştırır / bayat servis eder
  // ve "/admin açılmıyor" olur (Filament yerine React kabuğu döner). API gibi tamamen dışarıda tut.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/admin' ||
    url.pathname.startsWith('/admin/') ||
    url.pathname === '/panel' ||
    url.pathname.startsWith('/panel/') ||
    url.pathname.startsWith('/livewire/')
  )
    return

  const isNavigation = req.mode === 'navigate'

  if (isNavigation) {
    // Network-first: guncel index.html; cevrimdisi ise uygulama kabugu ('/'); yoksa offline.
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          // Kabuğu YALNIZ gerçek kök ('/') gezinmesinde güncelle. Önceden HER gezinme yanıtı
          // '/' altına yazılıyordu -> kabuk cache'i son ziyaret edilen sayfayla (ör. /online-tavla
          // veya bir 302) KİRLENİYORDU. Yalnız kök + redirect olmayan başarılı yanıt cache'lensin.
          // Basarili (redirect olmayan) HTML yanitlari KENDI URL'i altinda saklanir; kok '/'
          // ayrica uygulama kabugu olarak tazelenir. Eskiden yalniz '/' guncelleniyordu: kullanici
          // hep bir alt sayfadan (/online-turnuvalar, PWA start_url disi derin link) girerse
          // cevrimdisi kabuk BAYAT kaliyordu. Her URL kendi yanitini tuttugu icin '/' kirlenmez.
          // Sorgu parametreli URL'ler (sifre sifirlama tokeni vb.) saklanmaz.
          if (fresh.ok && !fresh.redirected && !url.search && (fresh.headers.get('content-type') || '').includes('text/html')) {
            try {
              const cache = await caches.open(CACHE)
              await cache.put(req, fresh.clone())
              if (url.pathname === '/') await cache.put('/', fresh.clone())
            } catch {
              /* cache.put reddetse bile taze yaniti dondur */
            }
          }
          return fresh
        } catch {
          return (
            (await caches.match(req)) ||
            (await caches.match('/')) ||
            (await caches.match('/index.html')) ||
            offlineResponse()
          )
        }
      })(),
    )
    return
  }

  // Stale-while-revalidate: hemen cache, arka planda yenile. Her yol bir Response dondurur.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone())
          return res
        })
        .catch(() => undefined)
      // Varlik yolu: cevrimdisi basarisizlikta HTML DEGIL, bos 504 don (yanlis MIME'i onle).
      return cached || (await network) || assetErrorResponse()
    })(),
  )
})

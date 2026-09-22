// Tavla PWA service worker.
// Strateji: gezinme (HTML) -> network-first (bayat paket servis etmez, deploy guvenli).
// Ayni-kaynak GET varliklar (hash'li js/css, wasm, onnx) -> stale-while-revalidate
// (cevrimdisi calisir, arka planda guncellenir). API istekleri ASLA cache'lenmez.
// ONEMLI: respondWith'e HER ZAMAN gecerli bir Response donmeli; undefined donersen
// tarayici "Failed to convert value to 'Response'" atar (fetch VEYA cache.put reddettiginde
// eski surumde iki caches.match da bos olunca bu oluyordu -> asagida her yol Response garanti).
const CACHE = 'tavla-cache-v7'

// Son care cevrimdisi yaniti (tek-kullanimlik body -> her cagride YENI uret).
function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Çevrimdışı</title>' +
      '<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">' +
      'Bağlantı kurulamadı. İnternet bağlantını kontrol edip sayfayı yenile.</body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
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
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
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
          if (url.pathname === '/' && fresh.ok && !fresh.redirected) {
            try {
              const cache = await caches.open(CACHE)
              await cache.put('/', fresh.clone())
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
      return cached || (await network) || offlineResponse()
    })(),
  )
})

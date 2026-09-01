// Tavla PWA service worker.
// Strateji: gezinme (HTML) -> network-first (bayat paket servis etmez, deploy guvenli).
// Ayni-kaynak GET varliklar (hash'li js/css, wasm, onnx) -> stale-while-revalidate
// (cevrimdisi calisir, arka planda guncellenir). API istekleri ASLA cache'lenmez.
const CACHE = 'tavla-cache-v5'

self.addEventListener('install', () => {
  self.skipWaiting()
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
  // API ve service worker'in kendisi cache'lenmez
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return

  const isNavigation = req.mode === 'navigate'

  if (isNavigation) {
    // Network-first: her zaman guncel index.html, cevrimdisi ise cache'ten
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(CACHE)
          cache.put(req, fresh.clone())
          return fresh
        } catch {
          const cached = await caches.match(req)
          return cached || caches.match('/')
        }
      })(),
    )
    return
  }

  // Stale-while-revalidate: hemen cache, arka planda yenile
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone())
          return res
        })
        .catch(() => cached)
      return cached || network
    })(),
  )
})

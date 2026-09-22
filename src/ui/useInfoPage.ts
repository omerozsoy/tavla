/**
 * useInfoPageBody — bir SEO/bilgi sayfasinin admin-duzenlenebilir HTML govdesini
 * (/api/info-pages) getirir. DB'de body varsa onu; yoksa null doner (frontend null'da
 * mevcut hardcoded fallback icerigi gosterir -> sayfa asla bos kalmaz).
 *
 * Tum sayfalar tek istekle gelir; modul-cache ile bir kez cekilip paylasilir (birden
 * fazla bilesen ayni anda cagirsa da tek fetch olur). Hata/bos durumda sessizce null.
 */

import { useEffect, useState } from 'react'
import { listInfoPages, type InfoPage } from '../api'

// Modul-seviyesi cache: ilk cagirici fetch'i baslatir, digerleri ayni promise'i paylasir.
let cache: Map<string, string> | null = null
let inFlight: Promise<Map<string, string>> | null = null

async function loadInfoPages(): Promise<Map<string, string>> {
  if (cache) return cache
  if (!inFlight) {
    inFlight = listInfoPages()
      .then((pages: InfoPage[]) => {
        const m = new Map<string, string>()
        for (const p of pages) {
          const body = (p.body ?? '').trim()
          if (body) m.set(p.slug, body)
        }
        cache = m
        return m
      })
      .catch(() => {
        // Hata: bos cache dondur (fallback icerik gosterilir). Tekrar denemeye izin ver.
        inFlight = null
        return new Map<string, string>()
      })
  }
  return inFlight
}

/** Verilen slug icin DB body'sini (HTML) veya null (fallback) dondurur. */
export function useInfoPageBody(slug: string | null): string | null {
  const [body, setBody] = useState<string | null>(() =>
    cache && slug ? (cache.get(slug) ?? null) : null,
  )

  useEffect(() => {
    if (!slug) {
      setBody(null)
      return
    }
    let alive = true
    loadInfoPages().then((m) => {
      if (alive) setBody(m.get(slug) ?? null)
    })
    return () => {
      alive = false
    }
  }, [slug])

  return body
}

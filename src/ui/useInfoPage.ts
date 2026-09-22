/**
 * useInfoPage / useInfoPageBody — bir SEO/bilgi sayfasinin admin-duzenlenebilir
 * icerigini (/api/info-pages) getirir. Tam sayfa (body + galeriler) cache'lenir;
 * useInfoPageBody yalnizca HTML govdeyi (veya null), useInfoPage ise tam InfoPage'i
 * (galeri token'lari <resimgalerisi>/<ad> icin sart) dondurur.
 *
 * Tum sayfalar tek istekle gelir; modul-cache ile bir kez cekilip paylasilir (birden
 * fazla bilesen ayni anda cagirsa da tek fetch olur). Hata/bos durumda sessizce null.
 */

import { useEffect, useState } from 'react'
import { listInfoPages, type InfoPage } from '../api'

// Modul-seviyesi cache: ilk cagirici fetch'i baslatir, digerleri ayni promise'i paylasir.
// TAM sayfayi (body + gallery + galleries) saklar -> galeri token'lari da render edilebilir.
let cache: Map<string, InfoPage> | null = null
let inFlight: Promise<Map<string, InfoPage>> | null = null

async function loadInfoPages(): Promise<Map<string, InfoPage>> {
  if (cache) return cache
  if (!inFlight) {
    inFlight = listInfoPages()
      .then((pages: InfoPage[]) => {
        const m = new Map<string, InfoPage>()
        for (const p of pages) m.set(p.slug, p)
        cache = m
        return m
      })
      .catch(() => {
        // Hata: bos cache dondur (fallback icerik gosterilir). Tekrar denemeye izin ver.
        inFlight = null
        return new Map<string, InfoPage>()
      })
  }
  return inFlight
}

/** Verilen slug icin TAM InfoPage'i (body + galeriler) veya null dondurur. */
export function useInfoPage(slug: string | null): InfoPage | null {
  const [page, setPage] = useState<InfoPage | null>(() =>
    cache && slug ? (cache.get(slug) ?? null) : null,
  )

  useEffect(() => {
    if (!slug) {
      setPage(null)
      return
    }
    let alive = true
    loadInfoPages().then((m) => {
      if (alive) setPage(m.get(slug) ?? null)
    })
    return () => {
      alive = false
    }
  }, [slug])

  return page
}

/** Verilen slug icin DB body'sini (HTML) veya null (fallback) dondurur. */
export function useInfoPageBody(slug: string | null): string | null {
  const page = useInfoPage(slug)
  const body = (page?.body ?? '').trim()
  return body ? body : null
}

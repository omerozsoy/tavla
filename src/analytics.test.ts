import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// A-25: Google etiketi onaysız yükleniyor ve tam URL'yi (şifre sıfırlama token'ı dahil) gönderiyordu.
vi.mock('./api', () => ({ getSiteTags: vi.fn(async () => ({ gtag: { enabled: true, id: 'G-TEST' } })) }))

let storage: Map<string, string>
let appended: Array<{ src: string }>
let win: { dataLayer?: unknown[]; gtag?: unknown; location: { origin: string; pathname: string; search: string } }

beforeEach(() => {
  vi.resetModules()
  storage = new Map()
  appended = []
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  })
  win = {
    location: { origin: 'https://tavla.test', pathname: '/sifre-sifirla', search: '?token=GIZLI&email=a@b.c' },
  }
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', {
    createElement: () => ({}) as { src: string },
    head: { appendChild: (el: { src: string }) => appended.push(el) },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('does not load the Google tag without analytics consent', async () => {
  const { initGoogleTag } = await import('./analytics')
  await initGoogleTag()
  expect(appended).toHaveLength(0)
  expect(win.gtag).toBeUndefined()
})

it('with consent sends only origin + path (no reset token/email)', async () => {
  storage.set('tavla.cookieConsent', JSON.stringify({ consentVersion: 1, analytics: true }))
  const { initGoogleTag } = await import('./analytics')
  await initGoogleTag()
  expect(appended).toHaveLength(1)
  const calls = (win.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>))
  const config = calls.find((c) => c[0] === 'config')
  expect(config?.[1]).toBe('G-TEST')
  expect(config?.[2]).toEqual({ page_location: 'https://tavla.test/sifre-sifirla' })
  expect(JSON.stringify(calls)).not.toContain('GIZLI')
})

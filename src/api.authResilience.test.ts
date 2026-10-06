import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isAuthRejected, meWithRetry } from './api'

// Internet kopup gelince login'e atma bug'i: yalniz GERCEK 401 oturumu dusurur.
let storage: Map<string, string>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  storage = new Map([['tavla.token', 'synthetic-account-token']])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

it('network error is not an auth rejection and retries until the server answers', async () => {
  fetchMock
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    .mockResolvedValueOnce(json(200, { user: { id: 7 } }))
  const p = meWithRetry(() => false)
  await vi.runAllTimersAsync()
  await expect(p).resolves.toEqual({ id: 7 })
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(storage.get('tavla.token')).toBe('synthetic-account-token')
})

it('gives up after the retry budget without classifying the error as a 401', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  const p = meWithRetry(() => false).catch((e) => e)
  await vi.runAllTimersAsync()
  const err = await p
  expect(isAuthRejected(err)).toBe(false)
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it('401 on an invalid token is rejected immediately', async () => {
  fetchMock.mockResolvedValue(json(401, { message: 'Unauthenticated.' }))
  const err = await meWithRetry(() => false).catch((e) => e)
  expect(isAuthRejected(err)).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('site-gate 401 does not count as an invalid session', async () => {
  fetchMock.mockResolvedValue(json(401, { gate: true }))
  const err = await meWithRetry(() => false, 1).catch((e) => e)
  expect(isAuthRejected(err)).toBe(false)
})

// Acilis takilmasi (PWA "Yükleniyor…" ebediyen): sunucu TCP'yi kabul edip HIC cevap vermezse
// /me timeout'u abort etmeli -> meWithRetry sonsuza beklememeli, butce bitince FIRLATMALI (401
// degil), boylece finish()/authChecked ilerler.
it('a hung /me (accepted but no response) aborts via timeout instead of hanging forever', async () => {
  fetchMock.mockImplementation(
    (_url: string, opts: RequestInit) =>
      new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      }),
  )
  const p = meWithRetry(() => false).catch((e) => e)
  await vi.runAllTimersAsync()
  const err = await p
  expect(isAuthRejected(err)).toBe(false)
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

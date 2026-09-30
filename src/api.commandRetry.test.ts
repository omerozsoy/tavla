import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isAuthRejected, isTransientError, serverMove } from './api'

// Turnuvada "hamle yaptım, Sunucuya ulaşılamadı" (deploy sırasında PHP-FPM reload -> nginx 502 HTML):
// otoriter komutlar geçici hatada AYNI command_id ile tekrar denenir.
let storage: Map<string, string>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  storage = new Map([['tavla.playerToken', 'synthetic-room-token']])
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
const steps = [{ from: 24, to: 18, die: 6 }] as unknown as Parameters<typeof serverMove>[1]
const commandIds = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).command_id)

it('retries a move through a 502 HTML page and a network drop with the same command_id', async () => {
  fetchMock
    .mockResolvedValueOnce(new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(json(200, { state: {}, version: 8, winner: null }))
  const p = serverMove('ROOM1', steps, 7)
  await vi.runAllTimersAsync()
  await expect(p).resolves.toMatchObject({ version: 8 })
  expect(fetchMock).toHaveBeenCalledTimes(3)
  const ids = commandIds()
  expect(new Set(ids).size).toBe(1)
  expect(ids[0]).toBeTruthy()
})

it('aborts a hung request and retries the move with the same command_id', async () => {
  // Sunucu TCP'yi kabul edip HIC cevap vermezse fetch asili kalir: abort sinyali gelince
  // reject et (gercek fetch davranisi). 8sn zaman asimi -> gecici -> ayni command_id ile yeniden.
  const hang = (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
  fetchMock
    .mockImplementationOnce(hang)
    .mockResolvedValueOnce(json(200, { state: {}, version: 9, winner: null }))
  const p = serverMove('ROOM1', steps, 7)
  await vi.runAllTimersAsync()
  await expect(p).resolves.toMatchObject({ version: 9 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(new Set(commandIds()).size).toBe(1)
})

it('does not retry application errors (422 illegal move)', async () => {
  fetchMock.mockResolvedValue(json(422, { message: 'Geçersiz hamle.' }))
  const err = await serverMove('ROOM1', steps, 7).catch((e) => e)
  expect(err).toMatchObject({ status: 422, message: 'Geçersiz hamle.' })
  expect(isTransientError(err)).toBe(false)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('gives up after the retry budget with a transient error', async () => {
  fetchMock.mockImplementation(async () => new Response('<html>504 Gateway Timeout</html>', { status: 504 }))
  const p = serverMove('ROOM1', steps, 7).catch((e) => e)
  await vi.runAllTimersAsync()
  const err = await p
  expect(isTransientError(err)).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it('a non-JSON 401 page is not treated as an invalid session', async () => {
  fetchMock.mockImplementation(async () => new Response('<html>401</html>', { status: 401 }))
  const p = serverMove('ROOM1', steps, 7).catch((e) => e)
  await vi.runAllTimersAsync()
  expect(isAuthRejected(await p)).toBe(false)
})

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { logout, showRoom } from './api'

let storage: Map<string, string>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  storage = new Map([
    ['tavla.token', 'synthetic-account-token'],
    ['tavla.playerToken', 'synthetic-room-token'],
    ['tavla.gate', 'synthetic-gate'],
  ])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

it('poll sends credentials in headers and keeps them out of the URL', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ room: { code: 'SAFE1' } })))
  await expect(showRoom('SAFE1', 42)).resolves.toEqual({ code: 'SAFE1' })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('since=42')
  expect(url).not.toContain('token')
  expect(url).not.toContain('synthetic')
  expect(init.headers).toMatchObject({
    Authorization: 'Bearer synthetic-account-token',
    'X-Room-Token': 'synthetic-room-token',
    'X-Site-Gate': 'synthetic-gate',
  })
})

it('preserves unchanged poll responses', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  await expect(showRoom('SAFE1')).resolves.toBeNull()
})

it('surfaces rejected credentials without retrying as a guest', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
  await expect(showRoom('SAFE1')).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('logout removes the account credential from later room polls', async () => {
  fetchMock.mockResolvedValue(new Response('{}'))
  await logout()
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  await showRoom('SAFE1')
  const headers = fetchMock.mock.calls[1][1].headers
  expect(headers).not.toHaveProperty('Authorization')
  expect(headers['X-Room-Token']).toBe('synthetic-room-token')
})

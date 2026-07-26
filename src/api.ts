// Laravel API istemcisi (token tabanli auth)
import type { Profile } from './storage'

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api')

const TOKEN_KEY = 'tavla.token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* yok */
  }
}

export interface ServerUser {
  id: number
  first_name: string
  last_name: string
  country: string
  nickname: string
  email: string
  game_state?: unknown
}

// Sunucu kullanicisini frontend Profile'ina cevir
export function toProfile(u: ServerUser): Profile {
  return {
    firstName: u.first_name,
    lastName: u.last_name,
    country: u.country,
    nickname: u.nickname,
    email: u.email,
  }
}

class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new ApiError(res.status, data.message || 'Hata', data.errors)
  }
  return data as T
}

export { ApiError }

export async function register(input: Profile & { password: string }): Promise<ServerUser> {
  const data = await req<{ user: ServerUser; token: string }>('/register', {
    method: 'POST',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      country: input.country,
      nickname: input.nickname,
      email: input.email,
      password: input.password,
    }),
  })
  setToken(data.token)
  return data.user
}

export async function login(loginId: string, password: string): Promise<ServerUser> {
  const data = await req<{ user: ServerUser; token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginId, password }),
  })
  setToken(data.token)
  return data.user
}

export async function me(): Promise<ServerUser> {
  const data = await req<{ user: ServerUser }>('/me')
  return data.user
}

export async function updateProfile(input: Profile): Promise<ServerUser> {
  const data = await req<{ user: ServerUser }>('/profile', {
    method: 'PUT',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      country: input.country,
      nickname: input.nickname,
      email: input.email,
    }),
  })
  return data.user
}

export async function logout(): Promise<void> {
  try {
    await req('/logout', { method: 'POST' })
  } catch {
    /* yoksay */
  }
  setToken(null)
}

export async function nicknameAvailable(nickname: string): Promise<boolean> {
  const data = await req<{ available: boolean }>(
    `/nickname-available?nickname=${encodeURIComponent(nickname)}`,
  )
  return data.available
}

export async function loadServerGame(): Promise<unknown | null> {
  const data = await req<{ game: unknown }>('/game')
  return data.game ?? null
}

export async function saveServerGame(game: unknown): Promise<void> {
  await req('/game', { method: 'PUT', body: JSON.stringify({ game }) })
}

export function isApiConfigured(): boolean {
  return true
}

// ---- Multiplayer odalari ----
const PLAYER_TOKEN_KEY = 'tavla.playerToken'

// Bu istemci icin kalici rastgele token (hesap gerekmez)
export function playerToken(): string {
  try {
    let t = localStorage.getItem(PLAYER_TOKEN_KEY)
    if (!t) {
      t = 'p_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      localStorage.setItem(PLAYER_TOKEN_KEY, t)
    }
    return t
  } catch {
    return 'p_' + Math.random().toString(36).slice(2)
  }
}

export type Slot = 'p1' | 'p2'
export interface ChatMsg {
  slot: Slot
  name: string
  text: string
  id: string
}
export interface RoomView {
  code: string
  p1_name: string
  p2_name: string | null
  state: unknown
  messages: ChatMsg[]
  version: number
  status: 'waiting' | 'playing' | 'finished'
}

export async function createRoom(name: string): Promise<{ room: RoomView; slot: Slot }> {
  return req('/rooms', {
    method: 'POST',
    body: JSON.stringify({ token: playerToken(), name }),
  })
}

export async function joinRoom(code: string, name: string): Promise<{ room: RoomView; slot: Slot }> {
  return req(`/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify({ token: playerToken(), name }),
  })
}

// Poll: since verilirse degismemisse null doner
export async function showRoom(code: string, since?: number): Promise<RoomView | null> {
  const token = getToken()
  const q = since !== undefined ? `?since=${since}` : ''
  const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(code)}${q}`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (res.status === 204) return null
  if (!res.ok) throw new ApiError(res.status, 'Oda hatası')
  const data = await res.json()
  return data.room as RoomView
}

export async function updateRoom(
  code: string,
  state: unknown,
  status?: 'playing' | 'finished',
): Promise<{ version: number; status: string }> {
  return req(`/rooms/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: JSON.stringify({ token: playerToken(), state, status }),
  })
}

// Sohbet mesaji gonder -> guncel mesaj listesini doner
export async function sendChat(code: string, text: string): Promise<{ messages: ChatMsg[] }> {
  return req(`/rooms/${encodeURIComponent(code)}/chat`, {
    method: 'POST',
    body: JSON.stringify({ token: playerToken(), text }),
  })
}

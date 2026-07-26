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

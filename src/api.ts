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
  avatar?: string | null
  birth_date?: string | null
  rating?: number
  coins?: number
  unlocks?: string[]
  avatar_frame?: string | null
  wins?: number
  losses?: number
  games_played?: number
  is_admin?: boolean
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
    avatar: u.avatar ?? undefined,
    birthDate: u.birth_date ?? undefined,
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
      avatar: input.avatar ?? null,
      birth_date: input.birthDate || null,
      nickname: input.nickname,
      email: input.email,
      password: input.password,
    }),
  })
  setToken(data.token)
  return data.user
}

// Google Sign-In istemci kimligi (gizli degil)
export const GOOGLE_CLIENT_ID =
  '306143287506-u64icc2893q517phi6oi7089eicru801.apps.googleusercontent.com'

// Google ID token'i ile giris/kayit. isNew=true ise takma isim secmesi istenir.
export async function googleLogin(
  credential: string,
): Promise<{ user: ServerUser; isNew: boolean }> {
  const data = await req<{ user: ServerUser; token: string; isNew: boolean }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  })
  setToken(data.token)
  return { user: data.user, isNew: data.isNew }
}

export async function login(loginId: string, password: string): Promise<ServerUser> {
  const data = await req<{ user: ServerUser; token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginId, password }),
  })
  setToken(data.token)
  return data.user
}

// Sifremi unuttum -> sifirlama linki gonder
export async function forgotPassword(email: string): Promise<void> {
  await req('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
}

// Sifreyi sifirla (link'teki token + yeni sifre)
export async function resetPassword(
  email: string,
  token: string,
  password: string,
): Promise<void> {
  await req('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, token, password }),
  })
}

export async function me(): Promise<ServerUser> {
  const data = await req<{ user: ServerUser }>('/me')
  return data.user
}

export interface MyStats {
  user: ServerUser
  rank: number
  total: number
}

export async function myStats(): Promise<MyStats> {
  const data = await req<{ user: ServerUser; rank: number; total_players: number }>('/me')
  return { user: data.user, rank: data.rank, total: data.total_players }
}

export async function updateProfile(input: Profile): Promise<ServerUser> {
  const data = await req<{ user: ServerUser }>('/profile', {
    method: 'PUT',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      country: input.country,
      avatar: input.avatar ?? null,
      birth_date: input.birthDate || null,
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

// Hesabi kalici olarak sil
export async function deleteAccount(): Promise<void> {
  try {
    await req('/account', { method: 'DELETE' })
  } finally {
    setToken(null)
  }
}

export async function nicknameAvailable(nickname: string): Promise<boolean> {
  const data = await req<{ available: boolean }>(
    `/nickname-available?nickname=${encodeURIComponent(nickname)}`,
  )
  return data.available
}

export interface LeaderRow {
  rank: number
  name: string
  avatar?: string | null
  frame?: string | null
  country?: string | null
  rating: number
  coins?: number
  wins: number
  losses: number
  games: number
}

export interface ShopState {
  catalog: Record<string, number>
  unlocks: string[]
  avatar_frame: string | null
  coins: number
}
export async function getShop(): Promise<ShopState> {
  return req('/shop')
}
export async function buyItem(id: string): Promise<{ unlocks: string[]; coins: number }> {
  return req('/shop/buy', { method: 'POST', body: JSON.stringify({ id }) })
}
export async function selectFrame(id: string | null): Promise<{ avatar_frame: string | null }> {
  return req('/shop/frame', { method: 'POST', body: JSON.stringify({ id: id ?? 'none' }) })
}

export async function leaderboard(limit = 100, by: 'rating' | 'coins' = 'rating'): Promise<LeaderRow[]> {
  const data = await req<{ players: LeaderRow[] }>(`/leaderboard?limit=${limit}&by=${by}`)
  return data.players
}

export async function claimDaily(): Promise<{ claimed: boolean; reward?: number; coins: number }> {
  return req('/shop/daily', { method: 'POST' })
}

export interface Friend {
  id: number
  name: string
  avatar?: string | null
  frame?: string | null
  rating: number
  online?: boolean
}

export async function getFriends(): Promise<{ friends: Friend[]; incoming: Friend[] }> {
  return req('/friends')
}

export interface GameInvite {
  id: number
  code: string
  from: string
  avatar?: string | null
}
export interface TournNotice {
  tid: number
  tname: string
  match: string
  oppId: number
  oppName: string
}
export async function ping(): Promise<{
  invites: GameInvite[]
  tournament_matches: TournNotice[]
  reward_ready: boolean
  coins: number
}> {
  return req('/ping', { method: 'POST' })
}
export async function inviteFriend(userId: number): Promise<{ code: string }> {
  return req(`/friends/${userId}/invite`, { method: 'POST' })
}
export async function respondInvite(id: number, accept: boolean): Promise<{ code: string | null }> {
  return req(`/invites/${id}/respond`, { method: 'POST', body: JSON.stringify({ accept }) })
}

export async function requestFriend(nickname: string): Promise<{ status: string }> {
  return req('/friends/request', { method: 'POST', body: JSON.stringify({ nickname }) })
}

export async function acceptFriend(userId: number): Promise<void> {
  await req(`/friends/${userId}/accept`, { method: 'POST' })
}

export async function removeFriend(userId: number): Promise<void> {
  await req(`/friends/${userId}`, { method: 'DELETE' })
}

// ---- Turnuvalar ----
export interface TPlayer {
  id: number
  name: string
  rating: number
  avatar?: string | null
}
export interface TMatch {
  key: string
  p1: TPlayer | null
  p2: TPlayer | null
  winner: number | null
}
export interface Tournament {
  id: number
  name: string
  size: number
  status: 'open' | 'running' | 'finished'
  count: number
  prize_coins?: number
  prize_desc?: string | null
  entry_fee?: number
  players?: TPlayer[]
  bracket?: TMatch[][]
  champion_id?: number | null
}

export async function listTournaments(): Promise<Tournament[]> {
  const d = await req<{ tournaments: Tournament[] }>('/tournaments')
  return d.tournaments
}

// ---- Yonetim paneli (admin) ----
export interface AdminUser {
  id: number
  name: string
  email: string
  country?: string | null
  rating: number
  coins: number
  wins: number
  losses: number
  games: number
  last_seen?: string | null
  created_at?: string | null
  is_admin: boolean
  banned: boolean
}
export interface AdminUsersResp {
  users: AdminUser[]
  total: number
  page: number
  last_page: number
}
export async function adminListUsers(q = '', page = 1): Promise<AdminUsersResp> {
  const params = new URLSearchParams({ page: String(page) })
  if (q) params.set('q', q)
  return req<AdminUsersResp>(`/admin/users?${params.toString()}`)
}
export async function adminUpdateUser(
  id: number,
  patch: { coins?: number; is_admin?: boolean; banned?: boolean },
): Promise<AdminUser> {
  const d = await req<{ user: AdminUser }>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return d.user
}
export interface AdminMatch {
  won: boolean
  opponent_rating: number
  rating_before: number
  rating_after: number
  delta: number
  created_at: string
}
export async function adminUserMatches(id: number): Promise<AdminMatch[]> {
  const d = await req<{ matches: AdminMatch[] }>(`/admin/users/${id}/matches`)
  return d.matches
}
export async function finishTournament(id: number): Promise<Tournament> {
  const d = await req<{ tournament: Tournament }>(`/tournaments/${id}/finish`, { method: 'POST' })
  return d.tournament
}
export async function deleteTournament(id: number): Promise<void> {
  await req(`/tournaments/${id}`, { method: 'DELETE' })
}
export async function showTournament(id: number): Promise<Tournament> {
  const d = await req<{ tournament: Tournament }>(`/tournaments/${id}`)
  return d.tournament
}
export async function createTournament(
  name: string,
  size: number,
  prizeCoins = 0,
  prizeDesc = '',
  entryFee = 0,
): Promise<Tournament> {
  const d = await req<{ tournament: Tournament }>('/tournaments', {
    method: 'POST',
    body: JSON.stringify({
      name,
      size,
      prize_coins: prizeCoins,
      prize_desc: prizeDesc || null,
      entry_fee: entryFee,
    }),
  })
  return d.tournament
}
export async function joinTournament(id: number): Promise<Tournament> {
  const d = await req<{ tournament: Tournament }>(`/tournaments/${id}/join`, { method: 'POST' })
  return d.tournament
}
export async function reportTournament(
  id: number,
  matchKey: string,
  winnerId: number,
): Promise<Tournament> {
  const d = await req<{ tournament: Tournament }>(`/tournaments/${id}/report`, {
    method: 'POST',
    body: JSON.stringify({ match: matchKey, winner_id: winnerId }),
  })
  return d.tournament
}

// Turnuva maci icin paylasimli oda kodu al (iki oyuncu ayni koda girer)
export async function tournamentMatchRoom(id: number, matchKey: string): Promise<string> {
  const d = await req<{ code: string }>(`/tournaments/${id}/match-room`, {
    method: 'POST',
    body: JSON.stringify({ match: matchKey }),
  })
  return d.code
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
  p1_rating: number | null
  p1_avatar: string | null
  p2_name: string | null
  p2_rating: number | null
  p2_avatar: string | null
  state: unknown
  messages: ChatMsg[]
  version: number
  status: 'waiting' | 'mm_waiting' | 'playing' | 'finished'
}

export async function createRoom(
  name: string,
  rating?: number,
  avatar?: string,
): Promise<{ room: RoomView; slot: Slot }> {
  return req('/rooms', {
    method: 'POST',
    body: JSON.stringify({ token: playerToken(), name, rating: rating ?? null, avatar: avatar ?? null }),
  })
}

export async function joinRoom(
  code: string,
  name: string,
  rating?: number,
  avatar?: string,
): Promise<{ room: RoomView; slot: Slot }> {
  return req(`/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify({ token: playerToken(), name, rating: rating ?? null, avatar: avatar ?? null }),
  })
}

// Belirli kodla odaya gir (yoksa olustur, varsa katil). Turnuva maclari icin.
export async function enterRoom(
  code: string,
  name: string,
  rating?: number,
  avatar?: string,
): Promise<{ room: RoomView; slot: Slot }> {
  return req(`/rooms/${encodeURIComponent(code)}/enter`, {
    method: 'POST',
    body: JSON.stringify({ token: playerToken(), name, rating: rating ?? null, avatar: avatar ?? null }),
  })
}

// Hizli eslesme: bekleyen biriyle esle ya da havuza gir. matched=true -> hemen basla.
export async function matchmake(
  name: string,
  rating?: number,
  avatar?: string,
  stake?: number,
  userId?: number,
): Promise<{ room: RoomView; slot: Slot; matched: boolean }> {
  return req('/matchmaking', {
    method: 'POST',
    body: JSON.stringify({
      token: playerToken(),
      name,
      rating: rating ?? null,
      avatar: avatar ?? null,
      stake: stake ?? 0,
      user_id: userId ?? null,
    }),
  })
}
// Bahisli online mac coin transferi (mac bitince cagrilir)
export async function settleRoom(
  code: string,
  won: boolean,
): Promise<{ ok: boolean; coins?: number; stake?: number; won?: boolean }> {
  return req(`/rooms/${code}/settle`, {
    method: 'POST',
    body: JSON.stringify({ token: playerToken(), won }),
  })
}

export async function cancelMatchmake(): Promise<void> {
  await req('/matchmaking/cancel', {
    method: 'POST',
    body: JSON.stringify({ token: playerToken() }),
  })
}

// Oyun sonucu -> Elo puani guncelle (rakip puanina gore). Guncel puani doner.
export async function reportRating(
  won: boolean,
  opponentRating: number,
): Promise<{ rating: number }> {
  return req('/rating/report', {
    method: 'POST',
    body: JSON.stringify({ won, opponent_rating: opponentRating }),
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

// Laravel API istemcisi (token tabanli auth)
import type { Profile } from './storage'
import type { GameState, Step } from './engine/types'
import { normalizeCountry } from './countries'

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
  province?: string | null
  nickname: string
  email: string
  avatar?: string | null
  birth_date?: string | null
  rating?: number
  coins?: number
  unlocks?: string[]
  avatar_frame?: string | null
  badges?: string[]
  plan?: string
  plan_active?: 'free' | 'star' | 'starpro'
  plan_until?: string | null
  plan_since?: string | null
  auto_renew?: boolean
  trial_used?: boolean
  wins?: number
  losses?: number
  games_played?: number
  is_admin?: boolean
  email_verified_at?: string | null
  game_state?: unknown
}

// Sunucu kullanicisini frontend Profile'ina cevir
export function toProfile(u: ServerUser): Profile {
  return {
    firstName: u.first_name,
    lastName: u.last_name,
    country: normalizeCountry(u.country),
    province: u.province ?? '',
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

export async function register(
  input: Profile & { password: string; start_rating?: number },
): Promise<ServerUser> {
  const data = await req<{ user: ServerUser; token: string }>('/register', {
    method: 'POST',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      country: input.country,
      province: input.province ?? null,
      avatar: input.avatar ?? null,
      birth_date: input.birthDate || null,
      nickname: input.nickname,
      email: input.email,
      password: input.password,
      start_rating: input.start_rating ?? null,
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

// E-posta dogrulama linkini tekrar gonder (giris yapmis kullanici)
export async function resendVerification(): Promise<void> {
  await req('/email/resend', { method: 'POST' })
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
      province: input.province ?? null,
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
  id?: number
  name: string
  avatar?: string | null
  frame?: string | null
  country?: string | null
  rating: number
  coins?: number
  wxp?: number
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

export async function leaderboard(limit = 100, by: 'rating' | 'coins' | 'wxp' = 'rating'): Promise<LeaderRow[]> {
  const data = await req<{ players: LeaderRow[] }>(`/leaderboard?limit=${limit}&by=${by}`)
  return data.players
}

// ---- Kulupler & Lig ----
export interface ClubSummary {
  id: number
  name: string
  tag: string | null
  description: string | null
  members_count: number
  points: number
}
export interface ClubMemberRow {
  user_id: number
  nickname: string
  avatar?: string | null
  rating: number
  role: 'owner' | 'member'
  points: number
  wins: number
  losses: number
}
export interface ClubFull extends ClubSummary {
  owner_id: number
  table: ClubMemberRow[]
}
export async function listClubs(): Promise<ClubSummary[]> {
  const d = await req<{ clubs: ClubSummary[] }>('/clubs')
  return d.clubs
}
export async function getClub(id: number): Promise<ClubFull> {
  const d = await req<{ club: ClubFull }>(`/clubs/${id}`)
  return d.club
}
export async function myClub(): Promise<ClubFull | null> {
  const d = await req<{ club: ClubFull | null }>('/me/club')
  return d.club
}
export async function createClub(input: {
  name: string
  tag?: string
  description?: string
}): Promise<ClubFull> {
  const d = await req<{ club: ClubFull }>('/clubs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return d.club
}
export async function joinClub(id: number): Promise<ClubFull> {
  const d = await req<{ club: ClubFull }>(`/clubs/${id}/join`, { method: 'POST' })
  return d.club
}
export async function leaveClub(): Promise<void> {
  await req('/clubs/leave', { method: 'POST' })
}

// Mac gecmisi (giris yapan kullanici)
export interface MyMatch {
  id: number
  has_log?: boolean
  won: boolean
  opponent_rating: number
  opponent_name?: string | null
  opponent_pr?: number | null
  rating_before: number
  rating_after: number
  delta: number
  match_length?: number | null
  pr?: number | null
  coins_after?: number | null
  luck?: number | null
  score_self?: number | null
  score_opp?: number | null
  created_at?: string | null
}
export async function myMatches(): Promise<MyMatch[]> {
  const data = await req<{ matches: MyMatch[] }>('/me/matches')
  return data.matches
}

// Profil analizi (grafikler)
export interface ByLength {
  length: number
  games: number
  wins: number
  win_pct: number
  avg_pr: number | null
}
export interface Analytics {
  rating_history: number[]
  coins_history: number[]
  by_length: ByLength[]
  wxp: number
  games: number
  wins: number
  losses: number
}
export async function myAnalytics(): Promise<Analytics> {
  return req<Analytics>('/me/analytics')
}

// 7 gunluk ucretsiz deneme baslat
export async function startTrial(plan: 'star' | 'starpro'): Promise<{ user: ServerUser }> {
  return req('/membership/trial', { method: 'POST', body: JSON.stringify({ plan }) })
}

// Otomatik yenilemeyi ac/kapat (kapaliysa plan_until'da biter, tekrar tahsilat olmaz)
export async function setAutoRenew(enabled: boolean): Promise<{ user: ServerUser }> {
  return req('/membership/auto-renew', { method: 'POST', body: JSON.stringify({ enabled }) })
}

// Abonelik odemesi baslat (Garanti 3D). Kart sayfasi URL'si doner.
export async function subscribe(
  plan: 'star' | 'starpro',
  period: 'yearly' | 'monthly',
): Promise<{ url: string }> {
  return req('/subscribe', { method: 'POST', body: JSON.stringify({ plan, period }) })
}

// Herkese acik oyuncu profili
export interface PublicProfile {
  id: number
  name: string
  avatar?: string | null
  frame?: string | null
  country?: string | null
  rating: number
  coins: number
  wins: number
  losses: number
  games: number
  rank: number
  form: boolean[] // en yeni once, true=galibiyet
  badges?: string[]
}
export async function userProfile(id: number): Promise<PublicProfile> {
  return req<PublicProfile>(`/users/${id}/profile`)
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
export interface AppNotification {
  id: number
  title: string
  body?: string | null
  icon?: string | null
  read: boolean
  created_at?: string | null
}
export async function ping(): Promise<{
  invites: GameInvite[]
  tournament_matches: TournNotice[]
  reward_ready: boolean
  reward_seconds?: number
  coins: number
  notifications?: AppNotification[]
  unread?: number
}> {
  return req('/ping', { method: 'POST' })
}
// Bildirimleri okundu isaretle (id verilmezse hepsi)
export async function markNotificationsRead(ids?: number[]): Promise<void> {
  await req('/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  })
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
  /** Siralamaya gore odul tablosu: index 0 = 1.lik. Turnuva bitince otomatik odenir. */
  prizes?: { coins: number; desc?: string | null }[]
  entry_fee?: number
  /** Son katilim tarihi (ISO); bu andan 1dk sonra otomatik baslar. */
  register_until?: string | null
  /** Otomatik baslama zamani (ISO) = register_until + 1dk. Geri sayim bunu kullanir. */
  starts_at?: string | null
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
// ---- Icerik (hizmet / blog / haber / etkinlik / kulup) ----
export type ContentType = 'service' | 'blog' | 'news' | 'event' | 'club' | 'ad' | 'quiz' | 'magazine'
export interface Content {
  id: number
  type: ContentType
  title: string
  body?: string | null
  organizer?: string | null
  place?: string | null
  province?: string | null
  contact?: string | null
  contacts?: { name: string; phone: string }[] | null
  image?: string | null
  gallery?: string[] | null
  video_id?: string | null
  event_at?: string | null
  sort: number
  published: boolean
}
export async function listContents(type: ContentType): Promise<Content[]> {
  const d = await req<{ items: Content[] }>(`/contents?type=${encodeURIComponent(type)}`)
  return d.items
}
export async function adminListContents(type?: ContentType): Promise<Content[]> {
  const q = type ? `?type=${encodeURIComponent(type)}` : ''
  const d = await req<{ items: Content[] }>(`/admin/contents${q}`)
  return d.items
}
export async function createContent(data: Partial<Content>): Promise<Content> {
  const d = await req<{ item: Content }>('/admin/contents', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return d.item
}
export async function updateContent(id: number, data: Partial<Content>): Promise<Content> {
  const d = await req<{ item: Content }>(`/admin/contents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return d.item
}
export async function deleteContent(id: number): Promise<void> {
  await req(`/admin/contents/${id}`, { method: 'DELETE' })
}

// ---- Hata gunlugu (blunder log) ----
export interface BlunderEntry {
  loss: number
  played: string
  best: string
  pos?: string | null // JSON: hamle oncesi GameState
  steps?: string | null // JSON: en iyi hamlenin Step[]
  player?: string | null
  // Mac baglami (hangi mac / kiminle / kac kac) — eski kayitlarda null
  opp?: string | null // insan rakip adi (AI ise null)
  ai_level?: number | null // AI zorluk 1..10 (insan ise null)
  score_me?: number | null
  score_opp?: number | null
  won?: boolean | null
  created_at?: string
}
export async function listBlunders(): Promise<BlunderEntry[]> {
  const d = await req<{ blunders: BlunderEntry[] }>('/blunders')
  return d.blunders
}
export async function saveBlunders(
  items: {
    loss: number
    played: string
    best: string
    pos?: string
    steps?: string
    player?: string
    opp?: string | null
    ai_level?: number | null
    score_me?: number | null
    score_opp?: number | null
    won?: boolean | null
  }[],
): Promise<void> {
  if (items.length === 0) return
  await req('/blunders', { method: 'POST', body: JSON.stringify({ items }) })
}
export async function finishTournament(id: number): Promise<Tournament> {
  const d = await req<{ tournament: Tournament }>(`/tournaments/${id}/finish`, { method: 'POST' })
  return d.tournament
}

// ---- Hata Gunlugu (Error Journal) ----
// Backend sunucu-taraflı analiz (17 kategori sınıflandırma + günlük toplama).
// Frontend equity/PR/classification TEKRAR HESAPLAMAZ; bu ciktiyi gosterir.
export type EJSeverity = 'inaccuracy' | 'mistake' | 'blunder'
export type EJPeriod = 'today' | 'yesterday' | '7d' | '30d' | 'all'
export interface EJCategoryStat {
  category: string
  decisions: number
  errors: number
  errorRate: number // 0..1
  equityLoss: number
}
export interface EJSummary {
  gamesAnalyzed: number
  decisionsAnalyzed: number
  totalErrors: number
  inaccuracies: number
  mistakes: number
  blunders: number
  totalEquityLoss: number
  averageEquityLoss: number
  categories: EJCategoryStat[]
}
export interface EJEntry {
  id: string
  matchId: string
  playedAt: string | null
  moveNumber: number
  category: string
  tags: string[]
  severity: EJSeverity
  equityLoss: number
  playedMove: string | null
  bestMove: string | null
  playedEquity: number | null
  bestEquity: number | null
  dice: [number, number] | null
  player: string | null
  myPip: number | null
  opponentPip: number | null
  position: GameState | null
  bestSteps: Step[]
  playedSteps: Step[]
  alternatives: { notation: string; equity: number }[]
}
export interface EJResponse {
  period: string
  from: string | null
  to: string | null
  summary: EJSummary
  entries: EJEntry[]
  categoryOrder: string[]
  insights: { topWeakness: EJCategoryStat | null; biggestLoss: EJCategoryStat | null }
}
export async function errorJournal(
  period: EJPeriod = 'today',
  category?: string | null,
  limit = 50,
): Promise<EJResponse> {
  const p = new URLSearchParams({ period, limit: String(limit) })
  if (category) p.set('category', category)
  return req<EJResponse>(`/me/error-journal?${p.toString()}`)
}
export async function startTournament(id: number): Promise<Tournament> {
  const d = await req<{ tournament: Tournament }>(`/tournaments/${id}/start`, { method: 'POST' })
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
  p1_frame?: string | null
  p2_name: string | null
  p2_rating: number | null
  p2_avatar: string | null
  p2_frame?: string | null
  state: unknown
  messages: ChatMsg[]
  version: number
  status: 'waiting' | 'mm_waiting' | 'playing' | 'finished'
  target?: number | null
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
  minRating?: number,
  betPct?: number,
  targets?: number[],
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
      min_rating: minRating ?? 0,
      bet_pct: betPct ?? 0,
      targets: targets ?? [1],
    }),
  })
}
// Bahisli online mac coin transferi (mac bitince cagrilir)
export async function settleRoom(
  code: string,
  won: boolean,
): Promise<{ ok: boolean; pending?: boolean; coins?: number; stake?: number; won?: boolean }> {
  return req(`/rooms/${code}/settle`, {
    method: 'POST',
    body: JSON.stringify({ token: playerToken(), won }),
  })
}

// Settle'i odenene kadar birkac kez dene: sunucu kazanani iki tarafli mutabakat
// veya senkron mac durumundan cozer; rakip beyani/durum gec gelirse 'pending' doner.
export async function settleRoomConfirmed(
  code: string,
  won: boolean,
): Promise<{ ok: boolean; pending?: boolean; coins?: number; stake?: number; won?: boolean }> {
  let last: Awaited<ReturnType<typeof settleRoom>> = { ok: false }
  for (let i = 0; i < 4; i++) {
    try {
      last = await settleRoom(code, won)
    } catch {
      /* gecici hata -> yeniden dene */
    }
    if (last.ok || !last.pending) return last
    await new Promise((r) => setTimeout(r, 1200))
  }
  return last
}

export async function cancelMatchmake(): Promise<void> {
  await req('/matchmaking/cancel', {
    method: 'POST',
    body: JSON.stringify({ token: playerToken() }),
  })
}

// Canli maclar (izlenebilir odalar)
export interface LiveMatch {
  code: string
  p1_name: string
  p1_rating?: number | null
  p1_avatar?: string | null
  p2_name: string
  p2_rating?: number | null
  p2_avatar?: string | null
  stake: number
  bet_pct: number
  target?: number | null
  mode?: 'ranked' | 'friendly'
}
export async function liveMatches(): Promise<LiveMatch[]> {
  const data = await req<{ matches: LiveMatch[] }>('/live-matches')
  return data.matches
}

// Devam eden (playing) online maclarim -> geri donebilmek icin
export interface ActiveRoom {
  code: string
  slot: 'p1' | 'p2'
  opp_name: string | null
  opp_rating: number | null
  opp_avatar: string | null
  target: number | null
  score: { white: number; black: number } | null
}
export async function myActiveRooms(): Promise<ActiveRoom[]> {
  const data = await req<{ rooms: ActiveRoom[] }>('/me/active-rooms')
  return data.rooms
}

// Oyun sonucu -> Elo puani guncelle (rakip puanina gore). Guncel puani doner.
export async function reportRating(
  won: boolean,
  opponentRating: number,
  matchLength?: number,
  pr?: number | null,
  luck?: number | null,
  scoreSelf?: number | null,
  scoreOpp?: number | null,
  opponentName?: string | null,
  opponentPr?: number | null,
  log?: string | null,
  ranked = true,
  matchType: 'coin' | 'match' = 'match', // Jeton (coin bahsi) vs N-puanlik mac
  roomCode?: string | null, // online oda kodu -> backend friendly odayi kesin puansiz yapar
): Promise<{ rating: number }> {
  return req('/rating/report', {
    method: 'POST',
    body: JSON.stringify({
      won,
      opponent_rating: opponentRating,
      match_length: matchLength ?? null,
      match_type: matchType,
      pr: pr ?? null,
      luck: luck ?? null,
      score_self: scoreSelf ?? null,
      score_opp: scoreOpp ?? null,
      opponent_name: opponentName ?? null,
      opponent_pr: opponentPr ?? null,
      log: log ?? null,
      ranked,
      room_code: roomCode ?? null,
    }),
  })
}

// Profil performans istatistikleri: Medyan Hata Orani (kategori bazli) + WXP/G/M/Kaz%.
export type MedianFilter = 'all' | '7d' | '30d' | '90d' | '1y'
export interface MedianCategory {
  label: string
  median_pr: number | null
  sample_count: number
}
export interface PerformanceStats {
  median_error_rate: {
    filter: MedianFilter
    categories: Record<string, MedianCategory> // coin,1,3,5,7
  }
  wxp: {
    total: number
    wins: number
    losses: number
    total_matches: number
    win_rate: number
  }
}
export async function performanceStats(period: MedianFilter = 'all'): Promise<PerformanceStats> {
  return req<PerformanceStats>(`/me/performance-stats?period=${period}`)
}

// WXP kategori kirilimi (yalniz kendi): coin/1/3/5/7 -> kazanilan mac + mac basina WXP + toplam.
export interface WxpBreakdownCat {
  key: string // 'coin' | '1' | '3' | '5' | '7'
  wins: number
  per: number // mac basina WXP
  wxp: number // kategori toplam WXP
}
export interface WxpBreakdown {
  total: number
  categories: WxpBreakdownCat[]
}
export async function wxpBreakdown(): Promise<WxpBreakdown> {
  return req<WxpBreakdown>('/me/wxp-breakdown')
}

// Bir macin tam analiz log'u (JSON string; { hc, log } yapisi). Yoksa null.
export async function matchLogById(id: number): Promise<string | null> {
  const data = await req<{ log: string | null }>(`/me/matches/${id}/log`)
  return data.log
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

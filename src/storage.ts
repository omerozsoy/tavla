// Yerel depolama (localStorage): uye profili + oyun kaydi (yarim kalmasin).
import type { GameState, Step, Player } from './engine/types'
import type { MatchState } from './engine/match'

// Oyun-sonu analiz hamlesi (online'da rakip hamleleri de senkronlanir)
export interface MoveLogEntry {
  notation: string
  best: string
  loss: number
  pos?: GameState
  steps?: Step[]
  player?: Player
  dice?: number[]
  playedSteps?: Step[]
  cands?: { notation: string; equity: number; steps: Step[] }[]
  probs?: number[]
  seq?: number
  // XG-style PR denetim alanları (src/analysis/pr). countsForPR=false -> zorunlu/obvious (PR paydası
  // dışı). prAdjustedEquityLoss = 1-puanlık maçta ×1.5 uygulanmış equity kaybı. Backend bunları toplar.
  countsForPR?: boolean
  prAdjustedEquityLoss?: number
  // Kup (cube) karari kaydi (taş oyunu degil). Varsa bu bir kup satiridir.
  cube?: {
    win: number // karar aninda kazanma %
    equity: number
    recommended: string // 'double-take'|'double-pass'|'no-double'|'too-good'|'take'|'drop'
    chosen: string // 'double'|'no-double'|'take'|'drop'
    correct: boolean
  }
}

const PROFILE_KEY = 'tavla.profile'
const GAME_KEY = 'tavla.game'
const NICKS_KEY = 'tavla.nicknames'

export interface Profile {
  firstName: string
  lastName: string
  country: string
  province?: string // Turkiye ili (yalnizca ulke Turkiye ise)
  nickname: string
  email: string
  avatar?: string // profil fotografi (kucultulmus data URL)
  birthDate?: string // dogum tarihi (YYYY-MM-DD)
}

export interface SavedGame {
  mode: 'pvp' | 'pvb' | 'online'
  difficulty: number | 'neural' | 'heuristic' // 1..10 (eski kayitlar string olabilir)
  match: MatchState
  starter: 'white' | 'black'
  turnsPlayed: number
  turnStart: GameState
  played: Step[]
  // Saat: hamle gecikmesi + oyuncu-basi rezerv bankasi (white/black). over eski format (geri uyumluluk).
  clock?: { delay: number; over?: number; white?: number; black?: number }
  gameEnd?: {
    winner: 'white' | 'black'
    points: number
    mult: number
    dropped: boolean
    timeout?: boolean
    resigned?: boolean
  } | null
  // Bekleyen kup teklifi (online senkron icin): teklif eden oyuncu, yoksa null
  cubePending?: 'white' | 'black' | null
  // PR + Sans (online senkron icin): her istemci kendi rengini doldurur; karsi taraf
  // rakibin rengini bu alandan alir -> mac sonu ekraninda iki PR/Sans da gorunur.
  pr?: { white: { loss: number; decisions: number }; black: { loss: number; decisions: number } }
  luck?: { white: number; black: number }
  // Analiz hamleleri (online): her istemci kendi hamlelerini gonderir, karsi taraf
  // rakip renkli olanlari alir -> analiz ekraninda iki tarafin hamleleri gorunur.
  moves?: MoveLogEntry[]
  // Kayit aninda kullanici OYUN gorunumunde miydi? refresh'te ana sayfadan oyuna
  // ZORLA sokmamak icin (aktif oyun "Devam Et" ile erisilebilir kalir). undefined
  // (eski kayit) -> ana sayfada kal.
  inGame?: boolean
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* depolama yoksa sessizce gec */
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(PROFILE_KEY)
  } catch {
    /* yok */
  }
}

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    return raw ? (JSON.parse(raw) as SavedGame) : null
  } catch {
    return null
  }
}

export function saveGame(g: SavedGame): void {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(g))
  } catch {
    /* yok */
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(GAME_KEY)
  } catch {
    /* yok */
  }
}

// ---- Bekleyen maç-sonu raporu/settle (dayanıklılık) ----
// reportRating/settle ağ hatasıyla başarısız olursa payload'ı sakla; açılışta/yeniden-bağlanınca
// tekrar dene. Backend idempotent (oda+kullanıcı tek satır; settle atomik) -> çift-sayma yok.
// Böylece düşen istemcinin rating + analiz satırı + coin'i kaybolmaz.
const PENDING_REPORT_KEY = 'tavla.pendingReport'
const PENDING_SETTLE_KEY = 'tavla.pendingSettle'
const PENDING_MAX_AGE = 3 * 24 * 60 * 60 * 1000 // 3 gün sonra vazgeç

export interface PendingReport {
  args: unknown[] // api.reportRating pozisyonel argümanları (serializable)
  ts: number
}
export interface PendingSettle {
  code: string
  won: boolean
  ts: number
}

function readPending<T extends { ts: number }>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const v = JSON.parse(raw) as T
    if (!v || typeof v.ts !== 'number' || Date.now() - v.ts > PENDING_MAX_AGE) {
      localStorage.removeItem(key)
      return null
    }
    return v
  } catch {
    return null
  }
}

export function savePendingReport(args: unknown[]): void {
  try {
    localStorage.setItem(PENDING_REPORT_KEY, JSON.stringify({ args, ts: Date.now() }))
  } catch {
    /* yok */
  }
}
export function loadPendingReport(): PendingReport | null {
  return readPending<PendingReport>(PENDING_REPORT_KEY)
}
export function clearPendingReport(): void {
  try {
    localStorage.removeItem(PENDING_REPORT_KEY)
  } catch {
    /* yok */
  }
}

export function savePendingSettle(code: string, won: boolean): void {
  try {
    localStorage.setItem(PENDING_SETTLE_KEY, JSON.stringify({ code, won, ts: Date.now() }))
  } catch {
    /* yok */
  }
}
export function loadPendingSettle(): PendingSettle | null {
  return readPending<PendingSettle>(PENDING_SETTLE_KEY)
}
export function clearPendingSettle(): void {
  try {
    localStorage.removeItem(PENDING_SETTLE_KEY)
  } catch {
    /* yok */
  }
}

// ---- Takma isim kaydi (yerel benzersizlik kontrolu) ----
export function loadNicknames(): string[] {
  try {
    const raw = localStorage.getItem(NICKS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function addNickname(nickname: string): void {
  const n = nickname.trim()
  if (!n) return
  const list = loadNicknames()
  if (!list.some((x) => x.toLowerCase() === n.toLowerCase())) {
    list.push(n)
    try {
      localStorage.setItem(NICKS_KEY, JSON.stringify(list))
    } catch {
      /* yok */
    }
  }
}

// nickname alinmis mi? (exclude: kendi mevcut ismi, duzenlemede serbest)
export function isNicknameTaken(nickname: string, exclude?: string): boolean {
  const n = nickname.trim().toLowerCase()
  if (!n) return false
  const ex = (exclude ?? '').trim().toLowerCase()
  return loadNicknames().some((x) => x.toLowerCase() === n && x.toLowerCase() !== ex)
}

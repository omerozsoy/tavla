// Yerel depolama (localStorage): uye profili + oyun kaydi (yarim kalmasin).
import type { GameState, Step } from './engine/types'
import type { MatchState } from './engine/match'

const PROFILE_KEY = 'tavla.profile'
const GAME_KEY = 'tavla.game'
const NICKS_KEY = 'tavla.nicknames'

export interface Profile {
  firstName: string
  lastName: string
  country: string
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

// GNU Backgammon Position ID + Match ID çözücü -> XGID gibi {state, dice}.
// GNU forumlari/timothychow pozisyonlari "Position ID: xxx" + "Match ID: yyy" formatinda verir
// (XGID degil). Bu parser onlari bizim GameState'e cevirir (parseXgid'in GNU karsiligi).
//
// Position ID: board'u 10 byte'a bit-paketler, standart base64 (14 karakter). Bit akisi: 2 oyuncu x
// 25 nokta, her nokta = (tas sayisi kadar 1-bit) + (1 ayrac 0-bit), LSB-first. anBoard[0]=sirasi gelen.
// Match ID: zar/kup/sira/skor (9 byte, base64 12 karakter) — biz yalniz ZAR + SIRA alanlarini kullaniriz.

import type { GameState } from './types'

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function diceExpand(d: [number, number]): number[] {
  return d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [d[0], d[1]]
}

function b64ToBytes(s: string): Uint8Array | null {
  const clean = s.trim().replace(/=+$/, '')
  const bits: number[] = []
  for (const ch of clean) {
    const v = B64.indexOf(ch)
    if (v < 0) return null
    for (let b = 5; b >= 0; b--) bits.push((v >> b) & 1)
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte |= bits[i * 8 + b] << (7 - b)
    bytes[i] = byte
  }
  return bytes
}

// LSB-first bit okuma (GNU board bit siralamasi).
function bitAt(bytes: Uint8Array, n: number): number {
  return (bytes[n >> 3] >> (n & 7)) & 1
}

// Position ID -> anBoard[2][25] (0=sirasi gelen, 1=rakip; [0..23]=noktalar, [24]=bar).
function decodePositionId(id: string): number[][] | null {
  const bytes = b64ToBytes(id)
  if (!bytes || bytes.length < 10) return null
  const board = [new Array(25).fill(0), new Array(25).fill(0)]
  let bit = 0
  for (let player = 0; player < 2; player++) {
    for (let point = 0; point < 25; point++) {
      let count = 0
      while (bit < 80 && bitAt(bytes, bit) === 1) {
        count++
        bit++
      }
      bit++ // ayrac 0-bit'i atla
      board[player][point] = count
    }
  }
  // 15+15 saglamasi
  const s0 = board[0].reduce((a, b) => a + b, 0)
  const s1 = board[1].reduce((a, b) => a + b, 0)
  if (s0 !== 15 || s1 !== 15) return null
  return board
}

// Match ID -> { turn (0=player0 on roll), dice:[d1,d2]|null }. GNU Match ID bit alanlari (LSB-first):
// cubeLog2(4) cubeOwner(2) dice-owner/turn(1) crawford(1) gameState(3) turnOwner(1) doubled(1) resign(2)
// dice1(3) dice2(3) matchLen(15) score0(15) score1(15). Biz yalniz turnOwner + dice lazim.
function decodeMatchId(id: string): { onRoll: number; dice: [number, number] | null } | null {
  const bytes = b64ToBytes(id)
  if (!bytes) return null
  const bit = (n: number) => (n >> 3 < bytes.length ? (bytes[n >> 3] >> (n & 7)) & 1 : 0)
  const field = (start: number, len: number) => {
    let v = 0
    for (let i = 0; i < len; i++) v |= bit(start + i) << i
    return v
  }
  // offsetler: cube(4)+owner(2)=6, diceOwner(1)@6, crawford(1)@7, gameState(3)@8, turnOwner(1)@11,
  // doubled(1)@12, resign(2)@13, dice1(3)@15, dice2(3)@18
  const turnOwner = field(11, 1) // 0 = player0 (Position ID'deki sirasi gelen) hamle sirasinda
  const d1 = field(15, 3)
  const d2 = field(18, 3)
  const dice: [number, number] | null = d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6 ? [d1, d2] : null
  return { onRoll: turnOwner, dice }
}

export interface GnuResult {
  state: GameState
  dice: [number, number] | null
}

// GNU Position ID + Match ID -> {state (beyaz oynayacak sekilde), dice}. parseXgid gibi.
// anBoard[0] = Position ID'nin "sirasi gelen" oyuncusu. Bizim trainer'da oynayan BEYAZ olmali ->
// sirasi gelen oyuncuyu BEYAZ olarak yerlestir (noktalar onun perspektifinden: nokta j -> 24-j mutlak).
export function parseGnuId(positionId: string, matchId: string): GnuResult | null {
  const board = decodePositionId(positionId)
  if (!board) return null
  const m = decodeMatchId(matchId)
  const dice = m?.dice ?? null

  // Sirasi gelen (board[0]) = BEYAZ (alt, 24->1 oynar). board[0][j] = beyazin (j+1)-noktasindaki tasi.
  // Bizim points[]: index 0 = 1-nokta ... index 23 = 24-nokta (beyaz +, siyah -).
  const points = new Array(24).fill(0)
  let barW = 0
  let barB = 0
  for (let j = 0; j < 24; j++) points[j] += board[0][j] // beyaz: kendi j+1 noktasi = index j
  barW += board[0][24]
  for (let j = 0; j < 24; j++) points[23 - j] -= board[1][j] // siyah: kendi j+1 = beyazin 24-j noktasi
  barB += board[1][24]

  const whiteOn = points.reduce((a, x) => a + (x > 0 ? x : 0), 0) + barW
  const blackOn = points.reduce((a, x) => a + (x < 0 ? -x : 0), 0) + barB
  const state: GameState = {
    points,
    bar: { white: barW, black: barB },
    off: { white: 15 - whiteOn, black: 15 - blackOn },
    turn: 'white',
    dice: dice ? diceExpand(dice) : [],
    diceUsed: dice ? diceExpand(dice).map(() => false) : [],
  }
  if (state.off.white < 0 || state.off.black < 0) return null
  return { state, dice }
}

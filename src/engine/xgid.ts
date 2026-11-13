// XGID (eXtreme Gammon pozisyon ID) -> yerel GameState cozucu.
// XGID format: XGID=<26 hane>:<kup>:<kupSahibi>:<sira>:<zar>:<skorX>:<skorO>:<crawford>:<macBoyu>:<maxKup>
//
// 26 hanelik pozisyon dizisi: index 1..24 tahta haneleri (SIRADAKI oyuncunun = X perspektifi;
// hane P = 25 - index). index 0 ve 25 = bar. Kucuk harf a..p = X (1..16 tas), BUYUK harf A..P = O.
// X asagi dogru oynar (24->1, ev 1-6) = bizim "white"; O = "black". Dogrulama: standart acilis XGID
// -> initialState() ile birebir (src/engine/xgid.test.ts).

import type { GameState } from './types'

function charVal(ch: string): { count: number; white: boolean } | null {
  if (ch >= 'a' && ch <= 'z') return { count: ch.charCodeAt(0) - 96, white: true }
  if (ch >= 'A' && ch <= 'Z') return { count: ch.charCodeAt(0) - 64, white: false }
  return null // '-' veya gecersiz
}

function diceExpand(d: [number, number]): number[] {
  return d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [d[0], d[1]]
}

export interface XgidResult {
  state: GameState // beyaz (siradaki oyuncu) oynar, zar atilmis
  dice: [number, number] | null // null -> kup karari (zar yok)
  cube: number
}

export function parseXgid(xgid: string): XgidResult | null {
  const raw = xgid.trim().replace(/^XGID=/i, '')
  const parts = raw.split(':')
  if (parts.length < 5) return null
  const pos = parts[0]
  if (pos.length !== 26) return null

  const points = new Array(24).fill(0)
  let barW = 0
  let barB = 0
  for (let i = 0; i < 26; i++) {
    const v = charVal(pos[i])
    if (!v) continue
    if (i === 0 || i === 25) {
      if (v.white) barW += v.count
      else barB += v.count
      continue
    }
    const p = 25 - i // tahta hanesi 1..24 (beyaz perspektifi)
    points[p - 1] += v.white ? v.count : -v.count
  }

  const whiteOn = points.reduce((a, x) => a + (x > 0 ? x : 0), 0) + barW
  const blackOn = points.reduce((a, x) => a + (x < 0 ? -x : 0), 0) + barB
  const offW = 15 - whiteOn
  const offB = 15 - blackOn
  if (offW < 0 || offB < 0) return null // 15'ten fazla tas -> gecersiz

  const turn = parts[3] // '1' = X (beyaz) sirada, '-1' = O (siyah)
  const dstr = parts[4] || '00'
  const d1 = Number(dstr[0])
  const d2 = Number(dstr[1])
  const dice: [number, number] | null =
    d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6 ? [d1, d2] : null

  let state: GameState = {
    points,
    bar: { white: barW, black: barB },
    off: { white: offW, black: offB },
    turn: 'white',
    dice: dice ? diceExpand(dice) : [],
    diceUsed: dice ? diceExpand(dice).map(() => false) : [],
  }

  // O (siyah) sirada ise: tahtayi aynala (renkleri takas + hane sirasini ters cevir) ->
  // siradaki oyuncu "beyaz" olarak sunulur. Bizim 10 unlu pozisyonun hepsi turn='1' (gerek yok).
  if (turn === '-1') {
    const mp = new Array(24).fill(0)
    for (let i = 0; i < 24; i++) mp[i] = -points[23 - i]
    state = {
      ...state,
      points: mp,
      bar: { white: barB, black: barW },
      off: { white: offB, black: offW },
    }
  }

  const cube = Number(parts[1]) || 1
  return { state, dice, cube }
}

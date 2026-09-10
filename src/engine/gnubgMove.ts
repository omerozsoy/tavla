// gnubg hamle notasyonunu ("13/7*(2) 24/18") yerel Move'a GÜVENLİ eşle. gnubg en iyi hamleyi
// notasyon string olarak verir (steps DEĞİL); botu gnubg ile oynatmak için Move (steps) gerekir.
//
// GÜVENLİK: yalnızca TEK bir yasal Move gnubg notasyonuyla eşleşirse onu döndürür; belirsiz/eşleşmez
// ise null (çağıran wildbg'ye düşer). Böylece bot ASLA yanlış/geçersiz hamle oynamaz.
//
// Eşleme anahtarı = NET yolculuklar (from>to) çoklu-kümesi. Bir taşın ardışık sıçramaları (13/10 10/7)
// birleştirilir (13/7). Net from/to, hamlenin sonucunu (varan konum) tekil belirler; ara nokta/zar
// kullanımı önemsiz. gnubg ile bizim numaralandırma AYNI perspektif (sıradaki oyuncu) olmalıdır.

import type { GameState, Move, Player } from './types'
import { generateMoves } from './moves'
import { WHITE } from './board'

// İç index (0-23) / bar / off -> oyuncu perspektifli nokta adı (1-24 / 'bar' / 'off').
function locName(loc: number | 'bar' | 'off', player: Player): string {
  if (loc === 'bar') return 'bar'
  if (loc === 'off') return 'off'
  return String(player === WHITE ? loc + 1 : 24 - loc)
}

type Leg = { from: string; to: string }

// Ardışık sıçramaları birleştir: a.to === b.from ise a->b'yi a.to=b.to yaparak zincirle.
function netLegs(legs: Leg[]): Leg[] {
  const js = legs.map((l) => ({ ...l }))
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < js.length; i++) {
      if (js[i].to === 'off' || js[i].to === 'bar') continue
      for (let j = 0; j < js.length; j++) {
        if (i !== j && js[i].to === js[j].from) {
          js[i].to = js[j].to
          js.splice(j, 1)
          changed = true
          break outer
        }
      }
    }
  }
  return js
}

function keyOf(legs: Leg[]): string {
  return legs
    .map((l) => `${l.from}>${l.to}`)
    .sort()
    .join(',')
}

// Bir Move'un net-yolculuk anahtarı (oyuncu perspektifli).
function moveKey(move: Move, mover: Player): string {
  const legs: Leg[] = move.steps.map((s) => ({ from: locName(s.from, mover), to: locName(s.to, mover) }))
  return keyOf(netLegs(legs))
}

// gnubg notasyonunu net-yolculuk anahtarına çevir. "13/7*(2) 24/18" -> {13>7 x2, 24>18}.
// Anlaşılamayan token -> null (güvenli: eşleşme olmaz, wildbg fallback).
export function gnubgNotationKey(notation: string): string | null {
  const toks = notation.trim().split(/\s+/).filter(Boolean)
  if (toks.length === 0) return null
  const legs: Leg[] = []
  for (const tok of toks) {
    // from/to '*' (vuruş, yok say) opsiyonel '(n)'
    const m = tok.match(/^(bar|\d+)\/(off|\d+)\*?(?:\((\d+)\))?$/i)
    if (!m) return null
    const from = m[1].toLowerCase()
    const to = m[2].toLowerCase()
    const n = m[3] ? parseInt(m[3], 10) : 1
    if (!Number.isFinite(n) || n < 1 || n > 4) return null
    for (let k = 0; k < n; k++) legs.push({ from, to })
  }
  return keyOf(netLegs(legs))
}

/**
 * gnubg'nin en iyi hamlesini (notasyon) yerel bir Move'a eşle. TEK eşleşme varsa onu, yoksa/belirsizse
 * null döndür (çağıran wildbg'ye düşer -> bot asla geçersiz hamle oynamaz).
 */
export function matchGnubgMove(state: GameState, mover: Player, notation: string): Move | null {
  const target = gnubgNotationKey(notation)
  if (target === null) return null
  const legal = generateMoves(state)
  const hits = legal.filter((m) => moveKey(m, mover) === target)
  return hits.length === 1 ? hits[0] : null
}

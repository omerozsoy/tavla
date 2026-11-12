// Tavla Egitimi mufredati — 3 seviye: KOLAY / ORTA / ZOR, her biri 10 soru.
// Her soru SABIT bir pozisyon + zar. Dogru hamleyi motor (wildbg) anlik hesaplar; aciklama da
// motorun sectigi hamleden (explainMove) uretilir -> aciklama her zaman cevapla tutarli.
//
// KOLAY = 10 klasik acilis zari (standart dizilis + zar) — authored ipucu metinli.
// ORTA / ZOR = tohumlanmis (deterministik) kendi-kendine-oyun ile uretilmis sabit ara/gec oyun
// pozisyonlari (seed sabit -> her yuklemede AYNI 10 soru). Karar olmasi icin >=N farkli legal hamle sarti.

import type { GameState, Move } from '../engine/types'
import { initialState } from '../engine/board'
import { generateMoves, hasNoMove } from '../engine/moves'
import { applyMove, newTurn } from '../engine/game'
import { HeuristicBot } from '../engine/engine'

export type LessonLevel = 'easy' | 'medium' | 'hard'

export interface Question {
  state: GameState // zari atilmis, beyaz oynayacak pozisyon
  intro?: string // opsiyonel authored ipucu (acilislarda). Yoksa aciklama motordan uretilir.
}

export interface Lesson {
  id: LessonLevel
  level: LessonLevel
  titleKey: string
  descKey: string
  questions: Question[]
}

// --- Deterministik RNG (mulberry32) -> ORTA/ZOR pozisyonlari her yuklemede ayni ---
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const heur = new HeuristicBot()

function diceOf(d: [number, number]): number[] {
  return d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [d[0], d[1]]
}

function seededRoll(rng: () => number): [number, number] {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)]
}

// Rakip (ve ara) hamleleri sezgisel botla oyna + sirayi cevir (tohumlanmis zar).
function seededAdvance(state: GameState, rng: () => number): GameState {
  const s = newTurn(state, diceOf(seededRoll(rng)))
  const moves = generateMoves(s)
  const mv: Move = moves.length ? (heur.chooseMove(s) ?? moves[0]) : { steps: [], resultKey: '' }
  return applyMove(s, mv)
}

// Beyazin karar verecegi, >=minMoves farkli legal hamlesi olan `count` pozisyon uret (deterministik).
function genQuestions(seed: number, minPlies: number, maxPlies: number, minMoves: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const out: Question[] = []
  let guard = 0
  while (out.length < count && guard++ < 5000) {
    let s = initialState()
    const plies = minPlies + Math.floor(rng() * (maxPlies - minPlies + 1))
    for (let i = 0; i < plies; i++) s = seededAdvance(s, rng)
    if (s.turn !== 'white') s = seededAdvance(s, rng)
    const st = newTurn(s, diceOf(seededRoll(rng)))
    const moves = generateMoves(st)
    if (hasNoMove(moves)) continue
    if (new Set(moves.map((m) => m.resultKey)).size >= minMoves) out.push({ state: st })
  }
  return out
}

// --- KOLAY: 10 klasik acilis zari (standart dizilis) + authored ipucu ---
const OPENINGS: { dice: [number, number]; intro: string }[] = [
  { dice: [3, 1], intro: 'Altin nokta: ev tahtandaki 5 hanesini yap. Erken nokta kurmak rakibin bardan girisini zorlastirir.' },
  { dice: [4, 2], intro: '4 hanesini yap. Ev tahtanda ikinci guvenli noktani kurarak blok olusturmaya basla.' },
  { dice: [6, 1], intro: 'Bogaz noktasini (7 hanesi) yap. Rakibin arka taslarini hapsetmek icin guclu bir engel.' },
  { dice: [5, 3], intro: '3 hanesini yap. Ev tahtanda bir nokta daha kapat.' },
  { dice: [2, 1], intro: 'Kucuk zar: 5 hanesine builder getirip bol ya da arka tasini ilerlet. Esnek gelisim.' },
  { dice: [6, 5], intro: 'Arka tasini kacir (lovers leap). Tek hamlede rakibin bolgesinden kurtulmak guvenlidir.' },
  { dice: [6, 4], intro: 'Arka tasini ilerlet / kac ve builder getir. Geride sikismamak icin one cik.' },
  { dice: [6, 3], intro: 'Arka tasini kacirmaya basla ve bir builder indir — cifte amacli gelisim.' },
  { dice: [5, 4], intro: 'Ileri capaya (20) oyna ya da builder getir. 20 capasi rakip evinde guclu bekleme saglar.' },
  { dice: [4, 3], intro: 'Arka tasini bol ve builder indir — hem guvenlik hem gelisim.' },
]

function openingQuestions(): Question[] {
  return OPENINGS.map((o) => ({ state: newTurn(initialState(), diceOf(o.dice)), intro: o.intro }))
}

export const LESSONS: Lesson[] = [
  { id: 'easy', level: 'easy', titleKey: 'tr.lesson.easy', descKey: 'tr.lesson.easyDesc', questions: openingQuestions() },
  { id: 'medium', level: 'medium', titleKey: 'tr.lesson.medium', descKey: 'tr.lesson.mediumDesc', questions: genQuestions(0x5eed01, 5, 11, 3, 10) },
  { id: 'hard', level: 'hard', titleKey: 'tr.lesson.hard', descKey: 'tr.lesson.hardDesc', questions: genQuestions(0x5eed02, 13, 24, 4, 10) },
]

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

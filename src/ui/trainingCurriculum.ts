// Tavla Egitimi mufredati — 10 ZORLUK SEVIYESI (isimler satranc unvanlari gibi, iki dilde ayni).
// Her seviye 10 soru. Dogru hamleyi motor (wildbg) anlik hesaplar; aciklama motorun hamlesinden uretilir.
//
// SEVIYE 1 (Beginner) = 10 klasik acilis zari (standart dizilis + zar) — authored ipucu metinli.
// SEVIYE 2..10 = tohumlanmis (deterministik) kendi-kendine-oyun ile uretilmis sabit pozisyonlar.
//   Zorluk ply-derinligi + karar dallanmasi ile kademeli artar. Sorular DERS ACILINCA uretilir
//   (modul yuku hafif) ve onbellege alinir -> her acilista AYNI 10 soru.

import type { GameState, Move } from '../engine/types'
import { initialState } from '../engine/board'
import { generateMoves, hasNoMove } from '../engine/moves'
import { applyMove, newTurn } from '../engine/game'
import { HeuristicBot } from '../engine/engine'

export interface Question {
  state: GameState // zari atilmis, beyaz oynayacak pozisyon
  intro?: string // opsiyonel authored ipucu (acilislarda). Yoksa aciklama motordan uretilir.
}

export interface Lesson {
  id: string
  title: string // dogrudan gosterilen seviye adi (iki dilde ayni)
  descKey: string
  count: number
}

// --- Deterministik RNG (mulberry32) -> SEVIYE pozisyonlari her yuklemede ayni ---
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

function seededAdvance(state: GameState, rng: () => number): GameState {
  const s = newTurn(state, diceOf(seededRoll(rng)))
  const moves = generateMoves(s)
  const mv: Move = moves.length ? (heur.chooseMove(s) ?? moves[0]) : { steps: [], resultKey: '' }
  return applyMove(s, mv)
}

// Beyazin karar verecegi `count` pozisyon uret (deterministik). minMoves saglanamazsa gevset (>=2).
function genQuestions(seed: number, minPlies: number, maxPlies: number, minMoves: number, count: number): Question[] {
  for (let mm = minMoves; mm >= 2; mm--) {
    const rng = mulberry32(seed)
    const out: Question[] = []
    let guard = 0
    while (out.length < count && guard++ < 6000) {
      let s = initialState()
      const plies = minPlies + Math.floor(rng() * (maxPlies - minPlies + 1))
      for (let i = 0; i < plies; i++) s = seededAdvance(s, rng)
      if (s.turn !== 'white') s = seededAdvance(s, rng)
      const st = newTurn(s, diceOf(seededRoll(rng)))
      const moves = generateMoves(st)
      if (hasNoMove(moves)) continue
      if (new Set(moves.map((m) => m.resultKey)).size >= mm) out.push({ state: st })
    }
    if (out.length >= count) return out.slice(0, count)
  }
  // Son care: acilislarla doldur (pratikte ulasilmaz)
  return openingQuestions().slice(0, count)
}

// --- SEVIYE 1: 10 klasik acilis zari (standart dizilis) + authored ipucu ---
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

// Seviye tanimlari: id, ad, uretim parametreleri (l1 = acilislar). Zorluk ply + dallanma ile artar.
interface Spec {
  id: string
  title: string
  seed?: number
  min?: number
  max?: number
  mv?: number
  openings?: boolean
}
const SPECS: Spec[] = [
  { id: 'lvl1', title: 'Beginner', openings: true },
  { id: 'lvl2', title: 'Developing', seed: 0x5e02, min: 3, max: 7, mv: 2 },
  { id: 'lvl3', title: 'Intermediate', seed: 0x5e03, min: 5, max: 10, mv: 3 },
  { id: 'lvl4', title: 'Advanced', seed: 0x5e04, min: 8, max: 13, mv: 3 },
  { id: 'lvl5', title: 'Master', seed: 0x5e05, min: 10, max: 16, mv: 3 },
  { id: 'lvl6', title: 'Grandmaster', seed: 0x5e06, min: 12, max: 18, mv: 3 },
  { id: 'lvl7', title: 'Super Grandmaster', seed: 0x5e07, min: 14, max: 20, mv: 4 },
  { id: 'lvl8', title: 'Ultimate Grandmaster', seed: 0x5e08, min: 16, max: 22, mv: 4 },
  { id: 'lvl9', title: 'Legendary Grandmaster', seed: 0x5e09, min: 18, max: 24, mv: 4 },
  { id: 'lvl10', title: 'Lord of the Dice', seed: 0x5e0a, min: 20, max: 28, mv: 4 },
]

const cache = new Map<string, Question[]>()

// Bir dersin sorularini uret (ilk cagrida; sonra onbellekten). DERS ACILINCA cagrilir.
export function getQuestions(id: string): Question[] {
  const hit = cache.get(id)
  if (hit) return hit
  const s = SPECS.find((x) => x.id === id)
  const qs = !s ? [] : s.openings ? openingQuestions() : genQuestions(s.seed!, s.min!, s.max!, s.mv!, 10)
  cache.set(id, qs)
  return qs
}

export const LESSONS: Lesson[] = SPECS.map((s) => ({ id: s.id, title: s.title, descKey: 'tr.lesson.desc', count: 10 }))

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

// Tavla Egitimi mufredati — 10 ZORLUK SEVIYESI + 1 KUP KARARLARI modulu.
// Her seviye 10 soru. Dogru hamleyi/kup aksiyonunu motor (wildbg) anlik hesaplar.
//
// SEVIYE 1 (Beginner) = 10 klasik acilis zari. 2..10 = uretilmis pozisyonlar — ZORLUK = temas +
// dallanma + sezgisel equity farki (ply-derinligi DEGIL: derin oyun = yaris = kolaydi).
// Intermediate (lvl3) + Ultimate Grandmaster (lvl8) = GERCEK UNLU pozisyonlar (XGID) + referanslar.
// Cube Decisions = ZAR ATMADAN "katla mi?" (5 money + 5 mac, motor cubeAdvice/matchCube ile puanlar).

import type { GameState, Move } from '../engine/types'
import { initialState, winner, cloneState } from '../engine/board'
import { generateMoves, hasNoMove, applyStep } from '../engine/moves'
import { applyMove, newTurn } from '../engine/game'
import { HeuristicBot } from '../engine/engine'
import { evaluatePosition } from '../engine/evaluate'
import { parseXgid } from '../engine/xgid'
import { matchGnubgMove } from '../engine/gnubgMove'

export interface Question {
  state: GameState // zari atilmis, beyaz oynayacak pozisyon (kup sorularinda zar YOK)
  intro?: string // opsiyonel authored ipucu (acilislarda). Yoksa aciklama motordan uretilir.
  answer?: Move // OTORITER dogru hamle (unlu pozisyonlarda XG cevabi). Varsa buna gore puanlanir.
  title?: string // unlu pozisyon adi (oyun sirasinda gosterilir, or. "UBC 2023 Finali — banana split")
  cube?: 'offer' | 'respond' // KUP karari sorusu: 'offer'=katla/katlama, 'respond'=al/birak. Motor puanlar.
  score?: { my: number; opp: number; to: number } // MAC kupu: skor baglami (varsa mac-equity ile puanlanir)
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

// TEMAS var mi (yoksa yaris = kolay)? Beyazin en-geri tasi, siyahin en-geri tasindan ileride mi.
function hasContact(s: GameState): boolean {
  let whiteMax = s.bar.white > 0 ? 24 : -1
  let blackMin = s.bar.black > 0 ? -1 : 24
  for (let i = 0; i < 24; i++) {
    if (s.points[i] > 0) whiteMax = Math.max(whiteMax, i)
    if (s.points[i] < 0) blackMin = Math.min(blackMin, i)
  }
  return whiteMax > blackMin
}

// Sezgisel equity farki: en iyi ile 2. en iyi hamle arasi. KUCUK gap = ince/zor karar.
function moveGap(s: GameState, moves: Move[]): number {
  if (moves.length < 2) return Infinity
  const evals = moves
    .map((m) => {
      const c = cloneState(s)
      for (const st of m.steps) applyStep(c, st, s.turn)
      return evaluatePosition(c, s.turn)
    })
    .sort((a, b) => b - a)
  return evals[0] - evals[1]
}

// ZORLUK-BANTLI uretim (deterministik): temas + dallanma sartli POOL uret, sezgisel gap'e gore
// sirala; hardness 0=kolay (bariz en-iyi, buyuk gap) ... 1=zor (ince karar, kucuk gap) penceresi al.
function genQuestions(seed: number, minMoves: number, contact: boolean, hardness: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const pool: { state: GameState; gap: number }[] = []
  let guard = 0
  const POOL = Math.max(count * 4, 40)
  while (pool.length < POOL && guard++ < 25000) {
    let s = initialState()
    const plies = 5 + Math.floor(rng() * 10) // orta oyun (temas korunur, yarisa dusmez)
    for (let i = 0; i < plies; i++) s = seededAdvance(s, rng)
    if (s.turn !== 'white') s = seededAdvance(s, rng)
    const st = newTurn(s, diceOf(seededRoll(rng)))
    if (contact && !hasContact(st)) continue
    const moves = generateMoves(st)
    if (hasNoMove(moves)) continue
    if (new Set(moves.map((m) => m.resultKey)).size < minMoves) continue
    pool.push({ state: st, gap: moveGap(st, moves) })
  }
  if (pool.length <= count) return pool.map((p) => ({ state: p.state }))
  pool.sort((a, b) => a.gap - b.gap) // artan: en zor (kucuk gap) basta
  const start = Math.round((pool.length - count) * (1 - hardness))
  return pool.slice(start, start + count).map((p) => ({ state: p.state }))
}

// KUP kararlari (money): ara-oyun pozisyonu uret, ZAR ATMADAN "katla mi?" sor (offer).
function genCubeQuestions(seed: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const out: Question[] = []
  let guard = 0
  while (out.length < count && guard++ < 6000) {
    let s = initialState()
    const plies = 8 + Math.floor(rng() * 20)
    for (let i = 0; i < plies; i++) s = seededAdvance(s, rng)
    if (s.turn !== 'white') s = seededAdvance(s, rng)
    if (winner(s)) continue
    const wp = s.points.reduce((a, x) => a + (x > 0 ? x : 0), 0) + s.bar.white
    const bp = s.points.reduce((a, x) => a + (x < 0 ? -x : 0), 0) + s.bar.black
    if (wp < 4 || bp < 4) continue
    out.push({ state: { ...s, dice: [], diceUsed: [] }, cube: 'offer' })
  }
  return out
}

// MAC kupu: ayni sekilde pozisyon + MAC SKORU baglamı (away 2..6). Degerlendirme matchCube.ts (match-equity).
function genMatchCubeQuestions(seed: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const out: Question[] = []
  let guard = 0
  while (out.length < count && guard++ < 6000) {
    let s = initialState()
    const plies = 8 + Math.floor(rng() * 20)
    for (let i = 0; i < plies; i++) s = seededAdvance(s, rng)
    if (s.turn !== 'white') s = seededAdvance(s, rng)
    if (winner(s)) continue
    const wp = s.points.reduce((a, x) => a + (x > 0 ? x : 0), 0) + s.bar.white
    const bp = s.points.reduce((a, x) => a + (x < 0 ? -x : 0), 0) + s.bar.black
    if (wp < 4 || bp < 4) continue
    const myAway = 2 + Math.floor(rng() * 5)
    const oppAway = 2 + Math.floor(rng() * 5)
    const to = Math.max(myAway, oppAway) + 1 + Math.floor(rng() * 4)
    out.push({ state: { ...s, dice: [], diceUsed: [] }, cube: 'offer', score: { my: to - myAway, opp: to - oppAway, to } })
  }
  return out
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

// --- Elle (authored) referans pozisyonu kurucu. Mutlak 1-24 hane (beyaz +, siyah -). ---
function pos(
  w: Record<number, number>,
  b: Record<number, number>,
  dice: [number, number],
  intro: string,
  extra?: { barW?: number; barB?: number; offW?: number; offB?: number },
): Question {
  const points = new Array(24).fill(0)
  for (const k in w) points[+k - 1] += w[+k]
  for (const k in b) points[+k - 1] -= b[+k]
  const d = diceOf(dice)
  return {
    state: {
      points,
      bar: { white: extra?.barW ?? 0, black: extra?.barB ?? 0 },
      off: { white: extra?.offW ?? 0, black: extra?.offB ?? 0 },
      turn: 'white',
      dice: d,
      diceUsed: d.map(() => false),
    },
    intro,
  }
}

// KLASIK REFERANS — ORTA (vurus + nokta yapma + capa). Hepsi beyaz oynar.
const REF_MED: Question[] = [
  pos({ 6: 4, 8: 3, 13: 4, 24: 2, 9: 1, 10: 1 }, { 1: 2, 12: 4, 17: 3, 19: 5, 5: 1 }, [4, 1],
    'Kafadan vur: rakibin ev tahtandaki acik tasini vururken 5 noktasini yap.'),
  pos({ 6: 5, 8: 3, 13: 3, 24: 2, 9: 1, 11: 1 }, { 1: 2, 12: 5, 17: 3, 19: 5 }, [6, 2],
    'Bogaz noktasini (7) yap: rakibin arka taslarini hapseden guclu engel.'),
  pos({ 6: 4, 8: 4, 13: 4, 24: 2, 10: 1 }, { 1: 2, 12: 5, 17: 3, 19: 5 }, [4, 2],
    'Ev tahtanda 4 noktasini yap: blogu buyut.'),
  pos({ 6: 5, 8: 3, 13: 4, 24: 2, 11: 1 }, { 1: 2, 12: 4, 17: 3, 19: 5, 10: 1 }, [3, 1],
    'Dis sahada vur ve nokta yap (10 hanesi): hem tempo hem blok.'),
  pos({ 24: 2, 13: 5, 8: 3, 6: 4, 22: 1 }, { 1: 2, 12: 5, 17: 3, 19: 5 }, [4, 2],
    'Altin capayi (20) yap: rakip ev tahtasinda guclu bekleme saglar.'),
  pos({ 6: 4, 8: 3, 13: 4, 24: 2, 10: 2 }, { 1: 2, 12: 4, 17: 3, 19: 4, 3: 1, 5: 1 }, [3, 1],
    'Cifte vurus: iki acik tasi birden bara gonder, blitzi baslat.'),
]

// KLASIK REFERANS — ZOR (prime + temasli toplama + back game + blitz).
const REF_HARD: Question[] = [
  pos({ 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 13: 3, 24: 2 }, { 1: 3, 12: 4, 17: 3, 19: 5 }, [6, 3],
    '5li primini koru ve builder getir: rakibin arka taslarini hapiste tut.'),
  pos({ 6: 4, 5: 3, 4: 3, 3: 3, 2: 2 }, { 1: 2, 12: 4, 17: 3, 19: 4, 24: 2 }, [6, 1],
    'Temasli toplama: rakibin 1 capasina ACIK (blot) verme — guvenli topla.'),
  pos({ 20: 2, 22: 2, 13: 4, 8: 3, 6: 4 }, { 1: 2, 12: 5, 17: 3, 19: 3, 24: 2 }, [5, 2],
    'Cifte capali back game: zamanlamani koru, on yapini erken kirma.'),
  pos({ 6: 3, 8: 3, 13: 4, 24: 2, 5: 1, 4: 2 }, { 1: 2, 12: 4, 17: 3, 19: 4, 2: 1, 3: 1 }, [2, 1],
    'Ev tahtanda cifte vurus: rakibi geriye at ve blitzi surdur.'),
]

const REFS: Record<string, Question[]> = { lvl3: REF_MED, lvl8: REF_HARD }

// --- UNLU / GERCEK POzISYONLAR (forum/XG kaynakli, XGID birebir). Cevabi dogrulanabilenlerde
// XG cevabina (answer) gore puanlanir; dogrulanmayanlarda motora birakilir. ---
interface Famous {
  xgid: string
  answer: string // XG en iyi hamle notasyonu ("5/1 5/4*"); cozulurse otoriter
  title: string // unlu pozisyon adi (oyun sirasinda gosterilir)
  concept: string
}
const FAMOUS_MED: Famous[] = [
  { xgid: 'XGID=-a-aBBC-A---cE-a-bbe----B-:0:0:1:52:0:0:3:0:10', answer: '8/3* 3/1*',
    title: 'Para oyunu — cifte vurus', concept: 'Kurulu tahtada iki kez vurmak ortmekten iyi.' },
  { xgid: 'XGID=-b-B--DBA---cD---aadb--bB-:0:0:1:42:0:0:3:0:10', answer: '8/4 6/4',
    title: 'Ic nokta mi, gevsek vurus mu?', concept: 'Nokta yapmak gevsek vurustan iyidir (24/18* bir hataydi).' },
  { xgid: 'XGID=-FBEa--A--A--------cbbcbb-:0:0:1:42:0:0:0:1:10', answer: '10/4*',
    title: 'Vur-vurma karari', concept: 'Esit sut olsa da vur: bosa giden ev tahtasi ikinci sut birakmani onler.' },
  { xgid: 'XGID=-bB-BBC-A--AcB---bAbbb--bA:0:0:1:21:0:0:3:0:10', answer: '',
    title: 'Para oyunu — bogaz slot', concept: 'Bogaz noktasini slot la, primi uzat.' },
  { xgid: 'XGID=-bB-CBC-AC-Aa-a--babbbb---:1:-1:1:61:0:0:3:0:10', answer: '',
    title: 'Michy — arka tas stratejisi', concept: 'Arka tas stratejisi (Michy): fazla sut birakma.' },
]
const FAMOUS_HARD: Famous[] = [
  { xgid: 'XGID=-ABCaBC-----bB-a--Bcbacb--:1:-1:1:41:0:0:0:7:10', answer: '5/1 5/4*',
    title: 'UBC 2023 Finali — banana split', concept: 'Sander-Mochy: dogal 6/1 yerine agresif vurus ("banana split").' },
  { xgid: 'XGID=-a-B--EaC---dC--ac-cb---B-:0:0:1:22:0:0:0:7:10', answer: '',
    title: 'Benzer ikili #1', concept: 'Neredeyse ayni gorunen pozisyonda agresif oyun kazanir.' },
  { xgid: 'XGID=-a-B-aE-C---dC--ac-cb---B-:0:0:1:22:0:0:0:7:10', answer: '',
    title: 'Benzer ikili #2', concept: 'Cok benzer ama cevap tersine doner — sessiz yapi kazanir.' },
  { xgid: 'XGID=-CFCA--a-B----a----abcbcb-:0:0:1:42:6:3:1:7:10', answer: '',
    title: 'Vur-vurma karari (ileri)', concept: 'Her zaman vurmak dogru degil; guvenlik de bir secenek.' },
]

function famousToQuestion(f: Famous): Question | null {
  const r = parseXgid(f.xgid)
  if (!r || !r.dice) return null
  const mv = f.answer ? matchGnubgMove(r.state, 'white', f.answer) : null
  return { state: r.state, intro: f.concept, answer: mv ?? undefined, title: f.title }
}
const FAMOUS: Record<string, Famous[]> = { lvl3: FAMOUS_MED, lvl8: FAMOUS_HARD }

// Bir dersin 10 sorusu: once UNLU pozisyonlar, sonra REFERANS, sonra uretilmis (zorluk-bantli).
function buildLesson(s: Spec): Question[] {
  if (s.openings) return openingQuestions()
  if (s.cube) return [...genCubeQuestions(s.seed!, 5), ...genMatchCubeQuestions(s.seed! + 1, 5)]
  const famous = (FAMOUS[s.id] ?? []).map(famousToQuestion).filter((q): q is Question => q !== null)
  const ref = REFS[s.id] ?? []
  const need = 10 - famous.length - ref.length
  const gen = need > 0 ? genQuestions(s.seed!, s.mv ?? 2, s.contact ?? false, s.hardness ?? 0, need) : []
  return [...famous, ...ref, ...gen].slice(0, 10)
}

// Seviye tanimlari: zorluk = TEMAS + dallanma (mv) + hardness (sezgisel gap penceresi). ply DEGIL.
interface Spec {
  id: string
  title: string
  seed?: number
  mv?: number // minMoves (farkli legal hamle alt siniri = dallanma)
  contact?: boolean // temas sartli (yaris pozisyonlarini ele)
  hardness?: number // 0..1 (sezgisel gap penceresi: 0 buyuk-gap/kolay, 1 kucuk-gap/zor)
  openings?: boolean
  cube?: boolean
}
const SPECS: Spec[] = [
  { id: 'lvl1', title: 'Beginner', openings: true },
  { id: 'lvl2', title: 'Developing', seed: 0x5e02, mv: 2, contact: false, hardness: 0.0 },
  { id: 'lvl3', title: 'Intermediate', seed: 0x5e03, mv: 3, contact: false, hardness: 0.15 },
  { id: 'lvl4', title: 'Advanced', seed: 0x5e04, mv: 3, contact: true, hardness: 0.28 },
  { id: 'lvl5', title: 'Master', seed: 0x5e05, mv: 3, contact: true, hardness: 0.42 },
  { id: 'lvl6', title: 'Grandmaster', seed: 0x5e06, mv: 4, contact: true, hardness: 0.55 },
  { id: 'lvl7', title: 'Super Grandmaster', seed: 0x5e07, mv: 4, contact: true, hardness: 0.68 },
  { id: 'lvl8', title: 'Ultimate Grandmaster', seed: 0x5e08, mv: 4, contact: true, hardness: 0.8 },
  { id: 'lvl9', title: 'Legendary Grandmaster', seed: 0x5e09, mv: 4, contact: true, hardness: 0.92 },
  { id: 'lvl10', title: 'Lord of the Dice', seed: 0x5e0a, mv: 5, contact: true, hardness: 1.0 },
  { id: 'cube', title: 'Cube Decisions', seed: 0x5ecb, cube: true },
]

// Aday havuzu: temas + dallanma sartli `count` pozisyon (ZORLUK siralamasi NOTRAL motorla
// LessonView'da yapilir — sezgisel gap yetersizdi). Ders acilinca bir kez puanlanir + onbellek.
export function genPool(seed: number, minMoves: number, contact: boolean, count: number): GameState[] {
  const rng = mulberry32(seed)
  const out: GameState[] = []
  let guard = 0
  while (out.length < count && guard++ < 30000) {
    let s = initialState()
    const plies = 5 + Math.floor(rng() * 10)
    for (let i = 0; i < plies; i++) s = seededAdvance(s, rng)
    if (s.turn !== 'white') s = seededAdvance(s, rng)
    const st = newTurn(s, diceOf(seededRoll(rng)))
    if (contact && !hasContact(st)) continue
    const moves = generateMoves(st)
    if (hasNoMove(moves)) continue
    if (new Set(moves.map((m) => m.resultKey)).size < minMoves) continue
    out.push(st)
  }
  return out
}

export interface LessonPlan {
  direct?: Question[] // openings/cube: dogrudan sorular (notral siralama yok)
  base: Question[] // famous + ref (zaten zor/authored)
  pool: GameState[] // aday pozisyonlar (LessonView notral equity-gap ile siralar)
  need: number // base'den sonra kac uretilmis gerek
  hardness: number // 0..1 (notral gap penceresi)
}
// Dersin planini ver: direct (openings/cube) ya da base + aday havuzu (notral siralanacak).
export function lessonPlan(id: string): LessonPlan {
  const s = SPECS.find((x) => x.id === id)
  if (!s) return { base: [], pool: [], need: 0, hardness: 0 }
  if (s.openings) return { direct: openingQuestions(), base: [], pool: [], need: 0, hardness: 0 }
  if (s.cube)
    return { direct: [...genCubeQuestions(s.seed!, 5), ...genMatchCubeQuestions(s.seed! + 1, 5)], base: [], pool: [], need: 0, hardness: 0 }
  const base = [
    ...(FAMOUS[id] ?? []).map(famousToQuestion).filter((q): q is Question => q !== null),
    ...(REFS[id] ?? []),
  ]
  const need = Math.max(0, 10 - base.length)
  const pool = genPool(s.seed!, s.mv ?? 2, s.contact ?? false, Math.max(need * 3, 24))
  return { base, pool, need, hardness: s.hardness ?? 0 }
}

const cache = new Map<string, Question[]>()

// Bir dersin sorularini uret (ilk cagrida; sonra onbellekten). DERS ACILINCA cagrilir.
export function getQuestions(id: string): Question[] {
  const hit = cache.get(id)
  if (hit) return hit
  const s = SPECS.find((x) => x.id === id)
  const qs = s ? buildLesson(s) : []
  cache.set(id, qs)
  return qs
}

export const LESSONS: Lesson[] = SPECS.map((s) => ({ id: s.id, title: s.title, descKey: 'tr.lesson.desc', count: 10 }))

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

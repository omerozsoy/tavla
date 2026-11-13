// Tavla Egitimi mufredati — 10 ZORLUK SEVIYESI + 1 KUP KARARLARI modulu.
// Her seviye 10 soru. Dogru hamleyi/kup aksiyonunu motor (wildbg) anlik hesaplar.
//
// SEVIYE 1 (Beginner) = 10 klasik acilis zari. 2..10 = tohumlanmis (deterministik) uretilmis pozisyonlar.
// Intermediate (lvl3) + Ultimate Grandmaster (lvl8) = GERCEK UNLU pozisyonlar (XGID) + klasik referanslar.
// Cube Decisions = ZAR ATMADAN "katla mi?" karari (motor cubeAdvice ile puanlar).

import type { GameState, Move } from '../engine/types'
import { initialState, winner } from '../engine/board'
import { generateMoves, hasNoMove } from '../engine/moves'
import { applyMove, newTurn } from '../engine/game'
import { HeuristicBot } from '../engine/engine'
import { parseXgid } from '../engine/xgid'
import { matchGnubgMove } from '../engine/gnubgMove'

export interface Question {
  state: GameState // zari atilmis, beyaz oynayacak pozisyon (kup sorularinda zar YOK)
  intro?: string // opsiyonel authored ipucu (acilislarda). Yoksa aciklama motordan uretilir.
  answer?: Move // OTORITER dogru hamle (unlu pozisyonlarda XG cevabi). Varsa buna gore puanlanir.
  title?: string // unlu pozisyon adi (oyun sirasinda gosterilir, or. "UBC 2023 Finali — banana split")
  cube?: 'offer' | 'respond' // KUP karari sorusu: 'offer'=katla/katlama, 'respond'=al/birak. Motor puanlar.
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
  return openingQuestions().slice(0, count)
}

// KUP kararlari: ara-oyun pozisyonu uret, ZAR ATMADAN beyaza "katla mi?" sor (offer). Motor
// (evalPosition -> cubeAdvice) dogru aksiyonu belirler; oyun bitmis/asiri-uc pozisyonlar elenir.
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
    if (wp < 4 || bp < 4) continue // biri neredeyse topladi -> kup anlamsiz
    out.push({ state: { ...s, dice: [], diceUsed: [] }, cube: 'offer' })
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

// Bir dersin 10 sorusu: once UNLU pozisyonlar, sonra REFERANS, sonra uretilmis (deterministik).
function buildLesson(s: Spec): Question[] {
  if (s.openings) return openingQuestions()
  if (s.cube) return genCubeQuestions(s.seed!, 10)
  const famous = (FAMOUS[s.id] ?? []).map(famousToQuestion).filter((q): q is Question => q !== null)
  const ref = REFS[s.id] ?? []
  const need = 10 - famous.length - ref.length
  const gen = need > 0 ? genQuestions(s.seed!, s.min!, s.max!, s.mv!, need) : []
  return [...famous, ...ref, ...gen].slice(0, 10)
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
  cube?: boolean // KUP kararlari modulu (zar yok, katla/katlama)
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
  { id: 'cube', title: 'Cube Decisions', seed: 0x5ecb, cube: true },
]

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

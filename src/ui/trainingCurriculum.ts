// Tavla Egitimi mufredati — 10 ZORLUK SEVIYESI + 1 KUP KARARLARI modulu.
// Her seviye 10 soru. Dogru hamleyi/kup aksiyonunu motor (wildbg) anlik hesaplar.
//
// SEVIYE 1 (Beginner) = 10 klasik acilis zari. 2..10 = uretilmis pozisyonlar — ZORLUK = temas +
// dallanma + sezgisel equity farki (ply-derinligi DEGIL: derin oyun = yaris = kolaydi).
// Intermediate (lvl3) + Ultimate Grandmaster (lvl8) = GERCEK UNLU pozisyonlar (XGID) + referanslar.
// Cube Decisions = ZAR ATMADAN "katla mi?" (5 money + 5 mac, motor cubeAdvice/matchCube ile puanlar).

import type { GameState, Move } from '../engine/types'
import { initialState, winner, cloneState } from '../engine/board'
import { generateMoves, hasNoMove, applyStep, boardKey } from '../engine/moves'
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
  const seen = new Set<string>() // board + zar: tekrar eden ayni soru gelmesin
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
    const key = boardKey(st) + '|' + [...st.dice].sort().join('-')
    if (seen.has(key)) continue
    seen.add(key)
    pool.push({ state: st, gap: moveGap(st, moves) })
  }
  if (pool.length <= count) return pool.map((p) => ({ state: p.state }))
  pool.sort((a, b) => a.gap - b.gap) // artan: en zor (kucuk gap) basta
  const start = Math.round((pool.length - count) * (1 - hardness))
  return pool.slice(start, start + count).map((p) => ({ state: p.state }))
}

// KUP kararlari (money): ara-oyun pozisyonu uret, ZAR ATMADAN "katla mi?" sor (offer).
function genCubeQuestions(seed: number, count: number, seen = new Set<string>()): Question[] {
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
    const k = boardKey(s) // kup: zar yok -> board bazli dedup (tekrar eden kup pozisyonu gelmesin)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ state: { ...s, dice: [], diceUsed: [] }, cube: 'offer' })
  }
  return out
}

// MAC kupu: ayni sekilde pozisyon + MAC SKORU baglamı (away 2..6). Degerlendirme matchCube.ts (match-equity).
function genMatchCubeQuestions(seed: number, count: number, seen = new Set<string>()): Question[] {
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
    const k = boardKey(s) // board bazli dedup (money-kup ile de cakismasin: paylasilan seen)
    if (seen.has(k)) continue
    seen.add(k)
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

// Gercek/unlu pozisyonlar (forum+kitap kaynakli, XGID birebir), NÖRAL trap-zorluguna gore KOLAY->ZOR sirali.
// Cevabi cozulen otoriter; digerleri motora birakilir (famousToQuestion). 94 pozisyon. Agent harvest'i.
const REAL_POSITIONS: Famous[] = [
  { xgid: 'XGID=-acBBBBBB---------bebaBaA-:1:-1:1:42:6:7:0:11:10', answer: '', title: 'Oops, sorry about your prime (JLee vs Duquense, USBGF 2025)', concept: 'Keeping a prime together' },
  { xgid: 'XGID=-a-a--E-C-A-cD---cbe--B---:0:0:1:43:1:0:0:5:10', answer: '13/10 6/2', title: 'Awkward 43 to play', concept: 'Make the 10-point and unstack the 6' },
  { xgid: 'XGID=-a----E-CA-adD---d-e-A--A-:0:0:1:52:1:3:0:5:10', answer: '13/11* 6/1*', title: 'Hit once or twice? (gammon-go)', concept: 'At gammon-go, double-hit for gammons' },
  { xgid: 'XGID=--a-BCB---A-bBb-Cc-dc-B---:1:1:1:53:5:0:0:13:10', answer: '', title: 'Chris Bray 2020-31', concept: 'Attack lone back checker then builder' },
  { xgid: 'XGID=-cabBBCBB--A-A----bcbbB---:1:-1:1:54:0:0:3:0:10', answer: '', title: 'Chris Bray 2021-196', concept: 'Vs back games: leap the prime, hit with idle spare' },
  { xgid: 'XGID=-BfBBBB-B----A-B----acbba-:1:-1:1:11:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-222', concept: 'Double 1s: keep flexibility to hit escapers' },
  { xgid: 'XGID=-a----E-C---fE---c-e----B-:0:0:1:62:3:5:0:7:10', answer: '13/11 13/7', title: 'Chris Bray 2024-18', concept: 'Score dictates priming/blitz aim' },
  { xgid: 'XGID=-aa--BCBB---cD---d-db-A-A-:0:0:1:53:1:0:0:3:10', answer: '24/16', title: 'Chris Bray 2021-147', concept: 'Activate rear checkers, keep connectivity' },
  { xgid: 'XGID=a--BB-B--aBBAA----ccAcBbb-:1:-1:1:32:4:6:0:7:10', answer: '', title: 'Chris Bray 2022-143', concept: 'Joker avoidance with 2 on bar' },
  { xgid: 'XGID=-B-Bb-C-A---dE--ac-e----B-:1:1:1:64:0:0:3:0:10', answer: '', title: 'Chris Bray 2022-190', concept: 'Connected vs disconnected play' },
  { xgid: 'XGID=-aBBa-CDA---bC-----bbbabb-:1:-1:1:53:1:2:0:5:10', answer: '', title: 'Chris Bray 2022-110', concept: 'Score dictates gammon-go play' },
  { xgid: 'XGID=-a-B-BBbB-B-cCa--c-e-B----:0:0:1:64:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-12', concept: 'Build a 4-prime before escaping' },
  { xgid: 'XGID=c--cBcCBBBB--A-----bbAb---:1:-1:1:43:0:0:3:0:10', answer: '', title: 'Chris Bray 2019-231', concept: 'Build a full prime vs shuffling blots' },
  { xgid: 'XGID=-BBBaBB-A--A-Ac--bAbcbbA--:1:1:1:21:4:4:0:7:10', answer: '', title: 'Chris Bray 2019-221', concept: 'Aggressive for closeout+gammon' },
  { xgid: 'XGID=---cCCCBB----B---------dh-:1:-1:1:52:0:0:3:0:10', answer: '', title: 'Chris Bray 2019-5', concept: 'Strengthen board, let White escape with a 4' },
  { xgid: 'XGID=-BBaBDE---------------b---:1:1:1:11:0:0:3:0:10', answer: '', title: 'A pretty pair (4-aces A)', concept: 'Bear-off contact double 1s: hit and bear off' },
  { xgid: 'XGID=-BBaBDD---------------b---:1:1:1:11:0:0:3:0:10', answer: '', title: 'A pretty pair (4-aces B)', concept: 'Spare lower shifts best play' },
  { xgid: 'XGID=a--AABBcC-a--B-b-AddC-----:1:-1:1:32:5:4:0:9:10', answer: '', title: 'A point is a point', concept: 'Make a point' },
  { xgid: 'XGID=aB-BBBB-A-----AA---cdbcbB-:0:0:1:62:2:6:1:7:10', answer: '', title: 'Zorunlu kacis (26 vurulma)', concept: 'Forced escape' },
  { xgid: 'XGID=----BBB-B----A-A-A-A--agC-:1:1:1:42:0:0:3:0:10', answer: '', title: 'Containment Checker Play (bgonline)', concept: 'Hit and cover the bar for board control.' },
  { xgid: 'XGID=--a-CCDBB-------a---bAbbg-:1:1:1:62:0:0:3:0:10', answer: '', title: 'RO and comments (bgonline)', concept: 'Pointing on the deuce wins the most games.' },
  { xgid: 'XGID=----bBCBA---dE--ac-e----B-:0:0:1:63:0:1:1:2:10', answer: '', title: 'Fourth Roll 63 Gammon-Go (bgonline)', concept: 'Gammon-go: escape a back checker, keep builders active.' },
  { xgid: 'XGID=--BCBBBb-----D-----c-bbbd-:0:0:1:32:6:0:0:25:10', answer: '', title: 'Risk the hit or switch? (bgonline)', concept: 'Consolidating one checker beats switching points.' },
  { xgid: 'XGID=-CBBBB------bB-----cBbcad-:0:0:1:53:0:0:0:1:10', answer: '', title: 'Should I stay or go (bgonline)', concept: 'Build strength with the 8-point run.' },
  { xgid: 'XGID=-b--CBD-B--Ac--b-b-cbB-aA-:0:0:1:21:0:0:0:0:10', answer: '24/22 6/5', title: 'Chow\'s Challenge #3 — P9', concept: 'Split back checkers and slot the 5pt (21).' },
  { xgid: 'XGID=-BCBB-B---------AA-cb-cBc-:1:1:1:66:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P24', concept: 'Double 6s in a bear-off race.' },
  { xgid: 'XGID=---B-CCC--a-cBa--cbe--A-A-:0:0:1:32:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P44', concept: '32 point-making vs flexibility.' },
  { xgid: 'XGID=aEDBB---A-------b--cbbAcb-:1:1:1:21:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P59', concept: '21 bear-in; minimize wastage.' },
  { xgid: 'XGID=---b-BC-C-A-aC-b-cbeB-A---:0:0:1:43:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P148', concept: '43 distribution decision midgame.' },
  { xgid: 'XGID=-CbCD-B--------a---cbbbab-:1:1:1:31:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P16', concept: '31 bearing in a race.' },
  { xgid: 'XGID=---a-aD-CAB-dB---c-d-Bb--A:0:0:1:41:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P30', concept: '41 split-vs-build early middlegame.' },
  { xgid: 'XGID=--Ba--C-Ba-bcC-A-cBcb--A-A:0:0:1:31:0:0:0:1:10', answer: '', title: '31 to play at DMP (bgonline)', concept: 'From the bar at DMP, enter on 24 and run 18/15.' },
  { xgid: 'XGID=aa-aBBBBAAA-b-AaaaAc-bAbA-:1:-1:1:42:0:0:3:0:10', answer: '', title: 'PotD Bet ya hit something (bgonline)', concept: 'Blitz double-hit to flood opp home board, deny anchor.' },
  { xgid: 'XGID=a-a-BaC-E---cC--a--bbbbB--:0:0:1:54:0:0:3:0:10', answer: '', title: 'Chris Bray 2023-107', concept: 'Run rear checker while opp on bar' },
  { xgid: 'XGID=---a-BD-CA--eBa--c-cb--BA-:0:0:1:11:0:0:0:0:10', answer: '', title: 'Double ones does three jobs (bgonline)', concept: 'Clean a blot, make a 4-prime, split the back.' },
  { xgid: 'XGID=-a--BAB-C---fD---c-d-a--BA:0:0:1:64:0:0:1:0:10', answer: '', title: '501 Essential #32 (main)', concept: 'Enter hitting then make bar' },
  { xgid: 'XGID=--eCBCCC----A------bbbaab-:0:0:1:41:2:3:0:19:10', answer: '', title: 'A lot of checkers on your anchor (USBGF Masters 2025)', concept: 'Play 41 with five on the anchor' },
  { xgid: 'XGID=-A-a-aE-BBB-dC---b-c-bb---:0:0:1:22:4:0:0:7:10', answer: '', title: 'Chow\'s Challenge #3 — P4', concept: 'Double 2s making two prime points.' },
  { xgid: 'XGID=-BD-Cb--A---c--Bbc-eB----A:1:-1:1:55:0:0:0:5:10', answer: '', title: 'Ev tahtasini guclendir (55)', concept: 'Strengthen home board' },
  { xgid: 'XGID=-a-B-AB-C---fD---c-d-a--BA:0:0:1:64:0:0:1:0:10', answer: '', title: '501 Essential #32 (variant)', concept: 'Variant shifts best 64' },
  { xgid: 'XGID=---BBACbCB---B---aadabbaa-:0:0:1:11:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P103', concept: 'Double 1s close prime-vs-prime.' },
  { xgid: 'XGID=----aAD-B--abC--cc-eC-A-A-:0:0:1:21:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P5', concept: 'Small 21; builder/slot distribution.' },
  { xgid: 'XGID=---a-CCbBB--dC---b-ccA--A-:0:0:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P73', concept: '51 blocking game; slot vs safe.' },
  { xgid: 'XGID=-bBBBBBAB---b----bbbB-aca-:0:0:1:45:2:1:0:5:10', answer: '', title: 'Didn\'t roll a 1 (Chicago Open blitz)', concept: 'Build toward bar-point over flashy play' },
  { xgid: 'XGID=-aa---E-C---cE-A-cbe----A-:0:0:1:62:0:0:0:0:10', answer: '24/16', title: 'Fourth roll 62 features', concept: 'Strip midpoint, stay out of blitz range' },
  { xgid: 'XGID=-aABBCBA--A-cB-aAc-cbb----:1:-1:1:32:1:0:0:5:10', answer: '', title: 'Chow\'s Challenge #3 — P6', concept: 'Quiet single-point play preserving structure.' },
  { xgid: 'XGID=-aBBBbBB----b-BA-b-ccBb---:1:-1:1:64:0:0:0:0:10', answer: '', title: 'Chow\'s Challenge #3 — P7', concept: 'Run a single checker 64 to safety.' },
  { xgid: 'XGID=-BbBCBCC----a--aabab-bba--:1:-1:1:42:2:2:0:11:10', answer: '', title: 'Bearing in against a 2-point anchor', concept: 'Leave a blot bearing in (+0.841)' },
  { xgid: 'XGID=---a-AE-C--AbE--ac-ea--b--:0:0:1:41:0:0:0:0:10', answer: '13/9 6/5', title: 'Chow\'s Challenge #3 — P1', concept: 'Slot the 5pt while advancing a back builder (41).' },
  { xgid: 'XGID=----BbD-C--abB-a---dcBb-AA:0:0:1:21:0:0:3:0:10', answer: '', title: 'Chris Bray 2019-234', concept: 'Steer for a 2-4 back game' },
  { xgid: 'XGID=---aa-D-C-A-dDa--c-cbB---A:0:0:1:42:1:0:0:11:10', answer: '', title: 'Aggressive or button up? (USBGF)', concept: 'Hit 6/4* vs 10/8 button up' },
  { xgid: 'XGID=--aB-CC-B---dBb--b-eB--a-A:0:0:1:32:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-6', concept: 'Enter hitting then 23/20 for flexibility' },
  { xgid: 'XGID=-a--CcC-C---bDb--bBbab----:0:0:1:64:0:0:0:5:10', answer: '13/3', title: 'Festive edition follow-up 21', concept: 'Slot 3-point for racing efficiency' },
  { xgid: 'XGID=---B-bEbD---bB-Baaabaab---:0:0:1:61:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P135', concept: '61 holding game; make a point or run.' },
  { xgid: 'XGID=-a----F-F--Cb-----ccbb-b--:1:1:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P84', concept: '51 high-anchor bear-in race.' },
  { xgid: 'XGID=-a--a-E-C--BdCa--bBd--b---:0:0:1:65:0:0:3:0:10', answer: '13/2', title: 'Tricky 65 in the Early Game', concept: 'Run 13/2 to minimize shots with race lead' },
  { xgid: 'XGID=--BBBCBA--------b--fbcCb--:1:1:1:42:0:0:3:0:10', answer: '', title: 'Chris Bray 2023-173', concept: 'Maximise contact on White\'s bad roll' },
  { xgid: 'XGID=-b-aBBCA----cE---bad---bAA:0:0:1:65:8:0:0:11:10', answer: '', title: 'Primenin arkasinda tut (buyuk lead)', concept: 'Hold behind the prime' },
  { xgid: 'XGID=--a-B-B-B--abB-Acb-dCAbA-A:0:0:1:55:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P6', concept: 'Double 5s in a mutual-holding position.' },
  { xgid: 'XGID=-----bEC----cD-b-b-bCbb---:0:0:1:44:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P49', concept: 'Double 4s near-pure race; clearing order.' },
  { xgid: 'XGID=---b-BC-D--AcD---c-db---aA:0:0:1:44:0:0:0:0:10', answer: '', title: 'Chow\'s Challenge #3 — P5', concept: 'Enter with 44 and distribute builders.' },
  { xgid: 'XGID=-aaABCBBBb---A-A-cbbb-Ab--:2:-1:1:61:4:4:0:7:10', answer: '', title: 'Son arka tasi kacir (DMP)', concept: 'DMP escape last back checker' },
  { xgid: 'XGID=-CFCA--a-B----a----abcbcb-:0:0:1:63:6:3:1:7:10', answer: '', title: 'How do I choose whether to hit? #2', concept: 'Safety beats the hit here' },
  { xgid: 'XGID=--BBAABaBB-----A-cbbbbBab-:1:1:1:41:3:5:0:11:10', answer: '8/7* 8/4', title: 'Chris Bray 2023-203', concept: 'Complications favour at the score' },
  { xgid: 'XGID=-B-bBBBC---Cc--a--bc-bb-A-:1:-1:1:41:0:0:0:5:10', answer: '', title: 'How can we best escape this checker?', concept: 'Keep an escape even if opp makes 5-point' },
  { xgid: 'XGID=--bbbbG-DB------b--baAb-A-:0:0:1:61:0:0:0:7:10', answer: '', title: 'Chris Bray 2021-25', concept: 'Bot-level choice: 24/17 tied with 24/18 8/7' },
  { xgid: 'XGID=-BBB--BA-Ab-bDb--d-cAb----:0:0:1:22:0:0:0:11:10', answer: '', title: 'Lots of choices for these ducks (JLee)', concept: 'Advance trailing checker and make a point' },
  { xgid: 'XGID=-ba---EaCA--cB-A-c-cbA--B-:0:0:1:66:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P18', concept: 'Big double 6s; distribution subtlety.' },
  { xgid: 'XGID=-a-aBBEA----aBa-bbBe--b--A:0:0:1:61:6:0:0:13:10', answer: '', title: 'A lot of choices for the six', concept: '61 with competing priorities' },
  { xgid: 'XGID=-b---BD-CA--cC---c-c-bb-B-:0:0:1:64:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P10', concept: '64 clearing in a holding game.' },
  { xgid: 'XGID=--a---EBB-BabB---bBb--cbb-:0:0:1:61:0:0:0:0:10', answer: '', title: 'Chow\'s Challenge #3 — P2', concept: 'Run a builder and slot the 5pt.' },
  { xgid: 'XGID=-----bEBB---dD-A-c-db-A---:0:0:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P37', concept: '51 in a holding game; timing.' },
  { xgid: 'XGID=------EbC---bBbA-c-eB-aB--:0:0:1:55:0:0:0:0:10', answer: '', title: 'Chow\'s Challenge #3 — P3', concept: 'Double 5s: escape back men and make an inner point.' },
  { xgid: 'XGID=-cB-bBEB-AB-aA---cae------:1:-1:1:31:0:2:0:7:10', answer: '13/12* 6/3', title: 'Chris Bray 2024-28', concept: 'Develop 3-pt early vs weak board' },
  { xgid: 'XGID=---bCBC-B---bC---c-d-dAA--:0:0:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P8', concept: 'Double 3s point-making vs priming.' },
  { xgid: 'XGID=-----bDaD--BAA-Abc-e-b--B-:1:1:1:11:0:0:0:0:10', answer: '', title: 'Chow\'s Challenge #3 — P10', concept: 'Double 1s: hit on bar point and make a point.' },
  { xgid: 'XGID=-aBCB-B-B---bB-B-bbbbbb---:0:0:1:63:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P92', concept: '63 breaking a full board without crunching.' },
  { xgid: 'XGID=-a-B-BDAB-B-a-a---bcc-bBb-:1:-1:1:43:0:0:3:0:10', answer: '', title: 'Chris Bray 2022-20', concept: 'Priming the back checker' },
  { xgid: 'XGID=----BbD-B--BeC-----d-bb-AA:0:0:1:55:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P1', concept: 'Double 5s in a priming/race position.' },
  { xgid: 'XGID=-BB-a-CB----cCBaa-bc-b-bA-:1:1:1:22:2:1:0:5:10', answer: '', title: 'Chris Bray 2021-199', concept: 'Double 2s: hit and make the 5-pt' },
  { xgid: 'XGID=-BabC-CAD--a-----bbcbbAA--:1:1:1:11:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P66', concept: 'Double 1s; small-number point-making.' },
  { xgid: 'XGID=-BaEBCB-A---a-b-cc-e------:1:-1:1:64:0:0:0:0:10', answer: '8/2* 6/2', title: 'It\'s been a while (bgonline)', concept: 'Accept a rear shot to fill the gap (+1.18).' },
  { xgid: 'XGID=-A-a-BE-B--adBB--abbbb--A-:1:1:1:65:0:0:0:0:10', answer: '8/2 6/1', title: 'Chow\'s Challenge #3 — P8', concept: 'Bury checkers to clear stacks bearing in.' },
  { xgid: 'XGID=-B-BbBC-A---cC-a-d-e----B-:1:-1:1:61:0:0:3:0:10', answer: '', title: 'Boot Camp blitz 61 (bgonline)', concept: 'Advance a back checker aggressively with the 6.' },
  { xgid: 'XGID=-a--B-CBC--AdB-a-c-db---B-:0:0:1:32:0:0:3:0:10', answer: '', title: 'Chris Bray 2022-209', concept: 'Make golden point and slot bar' },
  { xgid: 'XGID=-B-BbBC-A---cC-a-d-e----B-:1:-1:1:41:0:0:3:0:10', answer: '', title: 'Boot Camp blitz 41 (bgonline)', concept: 'Activate back checkers while building home board.' },
  { xgid: 'XGID=-b---BD-CA--cD-aaa-cbb--A-:0:0:1:66:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P122', concept: 'Double 6s vs multi-point board; escape vs build.' },
  { xgid: 'XGID=-a-BBBBB----bC---dacb-bB--:0:0:1:63:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P21', concept: '63 with a near-complete prime; break safely.' },
  { xgid: 'XGID=----b-E-C--AbC-BbcAcb-a---:0:0:1:63:4:9:0:11:10', answer: '', title: 'Not So Obvious 63 Blunder', concept: 'Safety over making the 5-point' },
  { xgid: 'XGID=--aBaBBCA-B-bB---bbcbb-A--:0:0:1:11:10:5:1:11:10', answer: '', title: 'Chris Bray 2024-135', concept: 'Escaping the trapped checker over tempo' },
  { xgid: 'XGID=--aBBBCBA----B-a-bbcbbb-A-:1:1:1:54:0:0:3:0:10', answer: '', title: 'PotD PvP Checker (bgonline)', concept: 'Aggressive hit on the deuce narrowly beats quiet building.' },
  { xgid: 'XGID=-aBBBBB-C--Ab----bbbbca--A:2:-1:1:42:0:0:0:7:10', answer: '', title: 'UBC 2023 Final — Mochy banana split', concept: 'banana split' },
  { xgid: 'XGID=-aB-CBBB-B--b---bc-c-bbB--:1:-1:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P3', concept: '51 in a prime-vs-prime money position.' },
  { xgid: 'XGID=--BbB-BAB--BcBb--c-d-B-a--:0:0:1:66:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P110', concept: 'Double 6s in a blockade.' },
]

// "Gercek Pozisyonlar": ISIM/MARKA bazli gruplar (Chris Bray, Mochy, Euler, Chow, Forum...) -> her usta/
// kaynak bir DERS, adiyla gorunur. Her grup, uyelerinin nöral-zorluk medyanina gore BIR katmana (tier)
// yerlesir (REAL_POSITIONS kolay->zor sirali, index = zorluk rank). Acilislar en kolay katmanda.
function authorOf(p: Famous): { key: string; title: string } {
  const t = p.title.toLowerCase()
  if (t.includes('chris bray')) return { key: 'bray', title: 'Chris Bray — Haftanın Pozisyonu' }
  if (t.includes('euler')) return { key: 'euler', title: 'Euler — Günlük Hatalar' }
  if (t.includes('chow')) return { key: 'chow', title: 'Chow’un Dama Sınavı' }
  if (t.includes('marc olsen')) return { key: 'olsen', title: 'Marc Olsen' }
  if (t.includes('ian terry')) return { key: 'terry', title: 'Ian Terry' }
  if (t.includes('wilkinson')) return { key: 'wilk', title: 'Sebastian Wilkinson' }
  if (t.includes('barget')) return { key: 'barget', title: 'Simon Barget' }
  if (/o.?hagan/.test(t)) return { key: 'ohagan', title: 'John O’Hagan' }
  if (/mochy|michy|kageyama|banana split|ubc|usbgf|masters|bgwc|monte carlo|\b501\b|essential|chicago|festive|jlee|boot camp|falafel/.test(t))
    return { key: 'champ', title: 'Mochy & Şampiyonlar' }
  return { key: 'forum', title: 'Forum Klasikleri' }
}

export interface RealLesson {
  id: string
  title: string
  questions: Question[]
}
export interface RealTier {
  label: string
  lessons: RealLesson[]
}

// Her usta/kaynak hangi zorluk katmaninda (0=Baslangic,1=Orta,2=Ileri) — ustanin tipik seviyesine gore
// (bir usta zorluga yayildigi icin ortalama hep ortada cikar; elle atama daha anlamli). Bilinmeyen -> Orta.
const AUTHOR_TIER: Record<string, number> = {
  euler: 0,
  forum: 1, olsen: 1, terry: 1, wilk: 1, barget: 1, ohagan: 1,
  chow: 2, bray: 2, champ: 2,
}
export const REAL_TIERS: RealTier[] = (() => {
  const items = REAL_POSITIONS.map((p) => ({ q: famousToQuestion(p), au: authorOf(p) })).filter(
    (x): x is { q: Question; au: { key: string; title: string } } => x.q !== null,
  )
  const byAuthor = new Map<string, { title: string; qs: Question[] }>()
  for (const it of items) {
    const g = byAuthor.get(it.au.key) ?? { title: it.au.title, qs: [] }
    g.qs.push(it.q)
    byAuthor.set(it.au.key, g)
  }
  const tiers: RealTier[] = [
    { label: 'BAŞLANGIÇ', lessons: [{ id: 'rg-open', title: 'Açılış Zarları', questions: openingQuestions() }] },
    { label: 'ORTA', lessons: [] },
    { label: 'İLERİ', lessons: [] },
  ]
  // Alfabetik-stabil sira (deterministik) -> her grup tipik katmanina.
  for (const [key, g] of [...byAuthor.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    tiers[AUTHOR_TIER[key] ?? 1].lessons.push({ id: `ra-${key}`, title: g.title, questions: g.qs })
  }
  return tiers
})()

const REAL_LESSON_MAP: Record<string, RealLesson> = {}
for (const tier of REAL_TIERS) for (const l of tier.lessons) REAL_LESSON_MAP[l.id] = l

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
// "Bariz" (acgozlu/sezgisel) hamlenin resultKey'i — zorluk icin: nöral en-iyi ile BARIZ hamle
// arasindaki equity farki BUYUKSE pozisyon bir TUZAK (bariz oynayan hata yapar) = ogretici/zor.
export function obviousMoveKey(s: GameState): string {
  return heur.chooseMove(s).resultKey
}

export function genPool(seed: number, minMoves: number, contact: boolean, count: number): GameState[] {
  const rng = mulberry32(seed)
  const out: GameState[] = []
  const seen = new Set<string>() // board + zar: ayni puzzle iki kez gelmesin (tekrar eden soru bug'i)
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
    const key = boardKey(st) + '|' + [...st.dice].sort().join('-')
    if (seen.has(key)) continue
    seen.add(key)
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
  const rl = REAL_LESSON_MAP[id]
  if (rl) return { direct: rl.questions, base: [], pool: [], need: 0, hardness: 0 }
  if (!s) return { base: [], pool: [], need: 0, hardness: 0 }
  if (s.openings) return { direct: openingQuestions(), base: [], pool: [], need: 0, hardness: 0 }
  if (s.cube) {
    const cubeSeen = new Set<string>() // money + match kup ayni board'u paylasmasin
    return { direct: [...genCubeQuestions(s.seed!, 5, cubeSeen), ...genMatchCubeQuestions(s.seed! + 1, 5, cubeSeen)], base: [], pool: [], need: 0, hardness: 0 }
  }
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
  const rl = REAL_LESSON_MAP[id]
  if (rl) return rl.questions
  const s = SPECS.find((x) => x.id === id)
  const qs = s ? buildLesson(s) : []
  cache.set(id, qs)
  return qs
}

// Seviye listesi = uretilmis zorluk dersleri (Gercek Pozisyonlar AYRI: REAL_TIERS).
export const LESSONS: Lesson[] = SPECS.map((s) => ({ id: s.id, title: s.title, descKey: 'tr.lesson.desc', count: 10 }))

export function lessonById(id: string): Lesson | undefined {
  const rl = REAL_LESSON_MAP[id]
  if (rl) return { id: rl.id, title: rl.title, descKey: 'tr.lesson.desc', count: rl.questions.length }
  return LESSONS.find((l) => l.id === id)
}

// BIRLESIK USTALIK YOLU: uretilmis zorluk dersleri + gercek-pozisyon tema dersleri TEK yapida,
// kolay->zor (3 zorluk katmani). Uretilmis seviyeler zorluga gore katmanlara eslenir (lvl1=Beginner
// acilis, "Acilis Zarlari" ile cakistigi icin HARIC). cube -> Ileri.
const GEN_TIER: Record<string, number> = {
  lvl2: 0, lvl3: 0,
  lvl4: 1, lvl5: 1, lvl6: 1, lvl7: 1,
  lvl8: 2, lvl9: 2, lvl10: 2, cube: 2,
}
export interface MasteryLesson {
  id: string
  title: string
  count: number
}
export interface MasteryTier {
  label: string
  lessons: MasteryLesson[]
}
export const MASTERY_TIERS: MasteryTier[] = REAL_TIERS.map((tier, i) => {
  const real = tier.lessons.map((l) => ({ id: l.id, title: l.title, count: l.questions.length }))
  const gen = LESSONS.filter((l) => GEN_TIER[l.id] === i).map((l) => ({ id: l.id, title: l.title, count: l.count }))
  return { label: tier.label, lessons: [...real, ...gen] }
})
export const TOTAL_QUESTIONS = MASTERY_TIERS.reduce((a, t) => a + t.lessons.reduce((b, l) => b + l.count, 0), 0)

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
import { parseGnuId } from '../engine/gnubgId'
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
  xgid?: string // XGID (ya bu ya da gnuPos)
  gnuPos?: string // GNU Position ID (XGID yoksa; GNU-format forum/timothychow pozisyonlari)
  gnuMatch?: string // GNU Match ID (zar/sira)
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
  const r = f.gnuPos ? parseGnuId(f.gnuPos, f.gnuMatch ?? '') : f.xgid ? parseXgid(f.xgid) : null
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
  { xgid: 'XGID=-aBB-CBBB---b----bcbcB-b--:1:1:1:61:5:5:0:7:10', answer: '8/7 8/2', title: 'Chris Bray 2023-64', concept: 'Keep a broken five-prime rather than hitting loose.' },
  { xgid: 'XGID=-b--B-D-C---bD-aac-cc--AA-:0:0:1:33:5:2:0:9:10', answer: '8/5(2) 6/3(2)', title: 'Chris Bray 2022-172', concept: 'Build the rack with a big double.' },
  { xgid: 'XGID=-b-a-BD-B--AdE--ab-c--b-A-:0:0:1:63:2:1:0:5:10', answer: '24/15', title: 'Chris Bray 2021-194', concept: 'Run the back checker to safety.' },
  { xgid: 'XGID=-a-aC-D-D-A--A---f-c-bB-b-:0:0:1:43:0:0:3:0:10', answer: '', title: 'Chris Bray 2021-160', concept: 'Quiet building beats the loose hit.' },
  { xgid: 'XGID=--aBcaCBCB-A---bbb-bbB----:1:1:1:52:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-198', concept: 'Aggressive double-hit (double tiger).' },
  { xgid: 'XGID=--aa-bDBC-B-cB---b-cAAab--:1:1:1:33:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-20', concept: 'Free the back checker over 7/4(2) 6/3(2)*.' },
  { xgid: 'XGID=-b-Bb-E-C---bC--abBca-b---:0:0:1:44:0:0:3:0:10', answer: '13/5(2)', title: 'Chris Bray 2020-75', concept: 'Falafel\'s Law: short-term risk, long-term gain.' },
  { xgid: 'XGID=-a--B-D--B--da-B-cbbbABAA-:1:-1:1:66:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-214', concept: 'Keep checkers communicating.' },
  { xgid: 'XGID=bB-aA-B-D--AdB---cAe---AA-:0:0:1:64:7:2:0:11:10', answer: '', title: 'Chris Bray 2023-167', concept: 'Fix the four then apply pressure.' },
  { xgid: 'XGID=a-bbBBCBB---bAB--bacb-A---:0:0:1:32:2:0:1:3:10', answer: '', title: 'Chris Bray 2023-24', concept: 'Slot the back of the prime.' },
  { xgid: 'XGID=-aaBB-B-B--AbE---c-c-bab-A:0:0:1:41:8:5:0:11:10', answer: '', title: 'Chris Bray 2023-168', concept: 'Avoid inviting a blitz; keep blots safe.' },
  { xgid: 'XGID=-a-B-ACaC--adB---b-bbBB-b-:1:1:1:44:10:9:0:11:10', answer: '', title: 'Chris Bray 2023-169', concept: 'At DMP preserve communication.' },
  { xgid: 'XGID=--a-bCDABB-AbB--a--daca---:1:-1:1:52:0:0:3:0:10', answer: '', title: 'Chris Bray 2022-45', concept: 'Exploit board blots; ease clearance.' },
  { xgid: 'XGID=---BBABbBB---B-----cBbccb-:0:0:1:31:1:1:0:7:10', answer: '', title: 'Chris Bray 2022-196', concept: 'Make the home board over reflex 9/8 9/6.' },
  { xgid: 'XGID=-a--BBB-BBA-dB-b-c-c--bAA-:1:-1:1:51:0:0:3:0:10', answer: '', title: 'Chris Bray 2022-181', concept: 'Keep the 24-pt checker safe.' },
  { xgid: 'XGID=-b-bBbDBB-B--B--ababa---bA:0:0:1:54:3:0:0:5:10', answer: '', title: 'Chris Bray 2021-119', concept: 'Simple safe development.' },
  { xgid: 'XGID=---bBBD-C----B-aacbd-b-B--:0:0:1:62:0:0:3:0:10', answer: '', title: 'Chris Bray 2021-180', concept: 'Prime-vs-prime; slot the bar.' },
  { xgid: 'XGID=-Ba-BCB--A--bB--bcbcBb--A-:1:1:1:55:12:6:0:13:10', answer: '13/3(2)', title: 'Chris Bray 2021-90', concept: 'Preserve the golden anchor.' },
  { xgid: 'XGID=----b-E-D--BcBb--bBdb-----:0:0:1:33:0:0:3:0:10', answer: '', title: 'Chris Bray 2021-168', concept: 'Buy clearing time to bring the prime home.' },
  { xgid: 'XGID=-aDBC-------aa--a-bbcbb--A:0:0:1:21:4:4:0:5:10', answer: '', title: 'Chris Bray 2021-79', concept: 'At DMP take the ~3% equity by hitting.' },
  { xgid: 'XGID=---BBBB-B---b----cAcBbBbc-:0:0:1:62:0:0:3:0:10', answer: '', title: 'Chris Bray 2023-39', concept: 'Keep pressure on the mid-point.' },
  { xgid: 'XGID=-DbcDBBAB---a-------bbbba-:1:-1:1:21:0:0:0:7:10', answer: '', title: 'Chris Bray 2023-32', concept: 'Make a key point with the small roll.' },
  { xgid: 'XGID=aaBBBBC---A-----bbAbBcb-b-:0:0:1:22:10:0:1:11:10', answer: '', title: 'Chris Bray 2022-115', concept: 'Anchor with two twos, then hit.' },
  { xgid: 'XGID=aBBbbBCB----ACb--bac-b----:0:0:1:41:0:0:2:0:10', answer: '', title: 'Chris Bray 2022-62', concept: 'Flexible builder play.' },
  { xgid: 'XGID=--a-B-C-B-AA-A---b-ccdbBC-:1:1:1:55:0:0:0:7:10', answer: '', title: 'Chris Bray 2022-94', concept: 'Keep the back game alive.' },
  { xgid: 'XGID=----cBCBBBC-b----a-bbbc-A-:0:0:1:44:0:0:3:0:10', answer: '', title: 'Chris Bray 2021-103', concept: 'Force a big number to escape; buy timing.' },
  { xgid: 'XGID=---BdCBCB---A----b-ccBba--:1:-1:1:54:0:0:2:0:10', answer: '21/12', title: 'Chris Bray 2021-58', concept: 'Must run now.' },
  { xgid: 'XGID=-aBBBBB----AAA-d---cbBcb--:0:0:1:51:6:5:1:7:10', answer: '', title: 'Chris Bray 2020-84', concept: 'XG prefers 12/7 11/10.' },
  { xgid: 'XGID=-ABBABB--a---B-----ccCccb-:1:1:1:31:0:0:3:0:10', answer: '', title: 'Chris Bray 2023-18', concept: 'Simplest route to victory; accept gammon risk.' },
  { xgid: 'XGID=--a-BCBbBB--cBB--abbbb----:1:-1:1:21:0:0:3:0:10', answer: '', title: 'Michy’s Lesson — Kageyama', concept: 'Michy’nin arka tas stratejisi: 21’i oyna.' },
  { xgid: 'XGID=-BCBbBBBB---------abcbbba-:1:-1:1:51:0:0:3:0:10', answer: '', title: 'Michy Proverb 17 — Kageyama', concept: 'Michy atasözü 17: prime/arka tas 51 karari.' },
  { xgid: 'XGID=------EbC---bE-A-bde----A-:0:0:1:32:0:0:0:7:10', answer: '', title: 'Mochy & Sander — UBC Final Açılışı', concept: 'UBC finali acilis 32.' },
  { xgid: 'XGID=--bCBBCaCA------ab-bbAb-c-:1:-1:1:65:4:6:3:0:10', answer: '', title: 'Falafel Quiz #2', concept: '65 kacis/toplama karari (Falafel quiz).' },
  { xgid: 'XGID=-ABBABCbB----B---a-bb-eba-:1:-1:1:62:6:12:3:0:10', answer: '', title: 'Falafel Quiz #4', concept: '62 tas hamlesi (Falafel quiz).' },
  { xgid: 'XGID=-aCBC-CbA-B-----ab-cbbbA--:2:1:-1:63:26:26:3:0:10', answer: '', title: 'Falafel Quiz #7', concept: '63 toplama/kacis karari (Falafel quiz).' },
  { xgid: 'XGID=--a-a-EAB---dD---c-e-a--BA:0:0:1:51:0:0:0:5:10', answer: '', title: 'Chris Bray — Make the Prime First', concept: 'Kacmadan once prime’i kur.' },
  { xgid: 'XGID=-dB-B-DC---B---bba-bbBb---:1:-1:1:53:0:0:2:0:10', answer: '', title: 'Chris Bray — Hold that Anchor', concept: '53’te capayi koru.' },
  { xgid: 'XGID=-a-bBBBaC----AA--cBbbbbAA-:1:-1:1:53:0:0:0:7:10', answer: '', title: 'Chris Bray — The Ultimate Duplication Play', concept: '53’te duplikasyon oyunu.' },
  { xgid: 'XGID=-B-BCBBB-b---a-a-bcb--Bbb-:0:0:1:32:9:7:0:13:10', answer: '', title: 'Chris Bray — Is it Time to Go', concept: '32: kos mu tut mu karari.' },
  { xgid: 'XGID=--a-C-CBC--AbB----bcc-Abb-:0:0:1:21:1:0:0:7:10', answer: '', title: 'Chris Bray — Complex Question', concept: '21 karmasik ara-oyun karari.' },
  { xgid: 'XGID=-ba-B-D-B-A-cDAa-c-cb---A-:0:0:1:53:5:8:0:11:10', answer: '', title: 'Chris Bray 2024-144', concept: '53 tas hamlesi.' },
  { xgid: 'XGID=-aBaB-D-B---cC---bBb-bbb--:0:0:1:52:0:0:3:0:10', answer: '', title: 'Chris Bray 2024-145', concept: '52 agresif vurus.' },
  { xgid: 'XGID=-bbC-BD-B---aB--acAcb-a--A:1:-1:1:43:5:6:0:7:10', answer: '', title: 'Chris Bray 2024-62', concept: '43 ara-oyun karari.' },
  { xgid: 'XGID=a-A--DDbBB--bB----ab-bcaa-:0:0:1:22:6:5:1:7:10', answer: '', title: 'Chris Bray 2024-151', concept: 'Cift 2 tas hamlesi.' },
  { xgid: 'XGID=-a-B--D-C---bD---cdeA---A-:0:0:1:11:5:4:0:7:10', answer: '', title: 'Chris Bray 2024-21', concept: 'Cift 1 tas hamlesi.' },
  { xgid: 'XGID=-a--aaEAA---cE-Aac-e----AA:0:0:1:43:0:1:3:0:10', answer: '', title: 'Four-Score Position (bgonline)', concept: 'Dort-skor 43 tas hamlesi.' },
  { xgid: 'XGID=-DA-bBB-BB---------bbccBc-:1:1:1:52:2:2:0:5:10', answer: '', title: 'Chris Bray 2025-2', concept: '52 tas hamlesi.' },
  { xgid: 'XGID=-BAA-BB-ba--bD--Cbbbbb----:1:1:1:44:6:2:0:13:10', answer: '', title: 'Chris Bray 2025-4', concept: 'Cift 4 tas hamlesi.' },
  { xgid: 'XGID=-a---CC-Ba-A-D-b---bBbbbc-:0:0:1:65:4:4:0:5:10', answer: '', title: 'Chris Bray 2025-6', concept: '65 tas hamlesi.' },
  { xgid: 'XGID=----abDBB-B-cB----Cbcb-b--:0:0:1:21:6:7:0:9:10', answer: '', title: 'Chris Bray 2025-3', concept: '21 tas hamlesi.' },
  { xgid: 'XGID=aBBBDBBA---------------aa-:5:1:1:21:0:0:3:0:10', answer: '', title: 'Hit once or twice (backgammonforums)', concept: 'Bear off keeping White trapped behind the five-prime.' },
  { xgid: 'XGID=-BB-aaE-AA--dC---dAe------:0:0:1:61:4:0:0:7:10', answer: '', title: 'Chris Bray 2024-114', concept: 'Ahead in match, play safe — minimize shots.' },
  { xgid: 'XGID=-c---CC-BAa-bCA--dbcA---A-:1:-1:1:51:0:0:3:0:10', answer: '', title: 'Chris Bray 2023-184', concept: 'Make a point to trap rather than run.' },
  { xgid: 'XGID=aDBBBaB----------b-c-cc-b-:1:-1:1:31:0:3:0:5:10', answer: '', title: 'Chris Bray 2022-11', concept: 'Bear-in vs broken board.' },
  { xgid: 'XGID=a-AbBBCBBaA------AbcbcaA--:2:1:1:21:2:0:0:5:10', answer: '', title: 'Chris Bray 2021-34', concept: 'Hit the blot that steals the most timing.' },
  { xgid: 'XGID=-aBC-bC-BBA--B--ba-bbbba--:1:-1:1:32:0:0:3:0:10', answer: '', title: 'Chris Bray — Pay me now (2021-10)', concept: 'Attacking play beats passive safety.' },
  { xgid: 'XGID=---aBBBBB----A---A--AdeeB-:1:-1:1:53:0:0:3:0:10', answer: '', title: 'Chris Bray 2021-147b', concept: 'Improve outfield without breaking prime.' },
  { xgid: 'XGID=-a--aAD-CA--dD---a-c-abAbA:1:1:1:53:6:7:0:11:10', answer: '', title: 'Chris Bray 2021-139', concept: 'Secure the golden point offensively.' },
  { xgid: 'XGID=--A-BCBa----cD--A--ccb-cB-:1:1:1:53:0:2:0:5:10', answer: '13/8 5/2', title: 'Chris Bray 2021-43', concept: 'Bold outfield play at the score.' },
  { xgid: 'XGID=--DBBaC-----bB---bbcBbc---:0:0:1:42:2:0:1:3:10', answer: '6/2 3/1', title: 'Chris Bray 2020-138b', concept: 'Close race — play safe.' },
  { xgid: 'XGID=-a-aBBC-CBA-b--a--bbbbb-B-:0:0:1:41:0:2:0:5:10', answer: '24/23 10/6', title: 'Chris Bray 2021-79b', concept: 'Creep to the prime edge, stay safe.' },
  { xgid: 'XGID=--abB-C-DB-AbB-a---cbbb-A-:0:0:1:64:0:0:3:0:10', answer: '', title: 'Chris Bray 2021-50', concept: 'When ahead in the race, race.' },
  { xgid: 'XGID=-caCEB-----a---------bcbc-:1:-1:1:31:2:0:0:5:10', answer: '', title: 'Chris Bray 2020-217', concept: 'Pointing wins extra gammons.' },
  { xgid: 'XGID=-a---BEbBB---B---c-dBaca--:0:0:1:54:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-88b', concept: 'Strengthen home board over running.' },
  { xgid: 'XGID=-cBaBbC-BB---C--Abbbba----:1:-1:1:54:4:5:0:7:10', answer: '', title: 'Chris Bray 2020-204', concept: 'Hit the 3-point to deny the anchor.' },
  { xgid: 'XGID=-a-C-bC-C-D-bB---a-cbaba--:0:0:1:65:0:0:3:0:10', answer: '13/8 13/7', title: 'Chris Bray 2022-172b', concept: 'Clear the awkward point via duplication.' },
  { xgid: 'XGID=-BA-aCBbB--C-Ba-aa-d-bc---:0:0:1:65:3:1:0:9:10', answer: '', title: 'Chris Bray 2024-59', concept: 'Improve board, start clearing mid.' },
  { xgid: 'XGID=aaABBCB-C-----a--cbcbbB---:0:0:1:64:7:6:0:9:10', answer: '', title: 'Chris Bray 2024-PoW1', concept: 'Escape with six, hit with four (tempo).' },
  { xgid: 'XGID=-BC--AC-C--Ad---ab-bbbBb--:0:0:1:42:4:0:1:5:10', answer: '', title: 'Chris Bray 2020-136', concept: 'Hit when gammon loss is irrelevant.' },
  { xgid: 'XGID=--b-B-E-C-a-aBa--Abbbbb--B:0:0:1:11:6:5:1:7:10', answer: '', title: 'Chris Bray 2021-16', concept: 'Make the 5-point (counter-prime).' },
  { xgid: 'XGID=---aBDBB--C--B-b--bbbbbb--:0:0:1:44:0:0:0:7:10', answer: '', title: 'Chris Bray 2022-144', concept: 'Hit while clearing mid/10 for structure.' },
  { xgid: 'XGID=-a--B-BBBB--dB-a-b-d--cAAA:0:0:1:52:8:7:0:11:10', answer: '', title: 'Chris Bray 2022-52', concept: 'Gammon save: take the anchor.' },
  { xgid: 'XGID=---BCBBABA--ba---ccdb-AA--:1:1:1:62:0:0:3:0:10', answer: '', title: 'Chris Bray 2022-118', concept: 'Duplication play starts the hit.' },
  { xgid: 'XGID=-bBBcBCBBB---------bbcba--:1:-1:1:63:0:0:3:0:10', answer: '', title: 'Chris Bray 2022-166', concept: 'Clear from the rear.' },
  { xgid: 'XGID=-B-CabBBBB-------bbbbbBb--:0:0:1:62:0:0:3:0:10', answer: '', title: 'Chris Bray 2022-181b', concept: 'Keep checkers active.' },
  { xgid: 'XGID=--a--aEBBBAa-------b-ccBdA:1:1:1:21:9:5:0:11:10', answer: '', title: 'Chris Bray 2025-PoW8', concept: 'Match-play 2-1 with a big lead.' },
  { xgid: 'XGID=--a-A-EBB---cBb--a-cb-BabA:1:1:1:41:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-206', concept: 'Develop back checkers, keep flexibility.' },
  { xgid: 'XGID=-B-a-BBbG--Bb--a-a-bb-bb--:0:0:1:41:0:0:3:0:10', answer: '6/5 6/2', title: 'Chris Bray 2020-78', concept: 'Ugly play to avoid a fatal shot later.' },
  { xgid: 'XGID=-DCBBBb-----B------bbbcbb-:1:-1:1:31:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-146', concept: 'Avoid 5/1 which leaves a 5-point liability.' },
  { xgid: 'XGID=-aCBaCC----B-Ba-a--cbbbb--:1:-1:1:31:5:5:0:7:10', answer: '', title: 'Chris Bray 2020-231', concept: 'Double hit at DMP.' },
  { xgid: 'XGID=-bBbBCEB-a---A---aabbbb---:2:1:1:31:2:2:0:5:10', answer: '', title: 'Chris Bray 2021-141', concept: 'At DMP, damage opp timing.' },
  { xgid: 'XGID=-b----E-C--AdD---badbA--A-:0:0:1:31:1:2:0:5:10', answer: '8/5 6/5', title: 'Chris Bray 2021-86', concept: 'Falafel\'s Law — make the 5-point.' },
  { xgid: 'XGID=-aCBCBC-B---a----c-ebc----:1:-1:1:41:0:3:0:5:10', answer: '', title: 'Chris Bray 2022-91', concept: 'Hit because a gammon reaches Crawford.' },
  { xgid: 'XGID=-DBCAC--------aA--cbcbbAb-:1:1:1:41:4:0:0:7:10', answer: '', title: 'Chris Bray 2020-140', concept: 'Gammon save: reduce gammon risk.' },
  { xgid: 'XGID=--aab-EBB-C-bB-b-a--bbb--A:1:1:1:42:10:8:0:11:10', answer: '', title: 'Chris Bray 2020-198b', concept: 'Race ahead with one blot not two.' },
  { xgid: 'XGID=a-a-BBC-AB--fC-----cb-b-B-:0:0:1:11:0:0:0:7:10', answer: '', title: 'Chris Bray 2020-12b', concept: 'Near-equal 1-1 plays; style dependent.' },
  { xgid: 'XGID=-aa---E-C--AdD--ab-d-b-AA-:0:0:1:43:0:4:0:11:10', answer: '24/20 23/20', title: 'Chris Bray 2020-8', concept: 'Make the golden anchor over a toothless hit.' },
  { xgid: 'XGID=---B--EbB---bCb-baBbbb-A--:0:0:1:33:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-6b', concept: 'Preserve connectivity, keep an escape.' },
  { xgid: 'XGID=---b-BD-C---dBA--c-c-BAab-:0:0:1:43:1:1:0:5:10', answer: '', title: 'Chris Bray 2021-198', concept: 'Pay-me-later: avoid giving 17 hitting numbers.' },
  { xgid: 'XGID=-aBBBBBBA--A----a-bbcbbbA-:1:1:1:51:0:0:3:0:10', answer: '', title: 'Chris Bray 2020-198c', concept: 'Keep a playable six-point.' },
  { xgid: 'XGID=-a-B--D-Da--bCb--c-cc-B---:0:0:1:65:5:3:0:7:10', answer: '13/2', title: 'Chris Bray 2020-214b', concept: 'Keep the anchor to deny cube chances.' },
  { xgid: 'XGID=-aa-B-C-C--BbCaa-d-e----B-:0:0:1:42:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P2', concept: 'zar 4-2, checker play' },
  { xgid: 'XGID=-a----E-C-a-dDA--bbcb--B--:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P4', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=----a-E-CB--dD---cbe----A-:0:0:1:53:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P7', concept: 'zar 5-3, checker play' },
  { xgid: 'XGID=---BCbC----acC---d-cbB--AA:0:0:1:54:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P9', concept: 'zar 5-4, checker play' },
  { xgid: 'XGID=-a---BD-C---cC-a-d-db--AB-:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P11', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-aaaBBBAB---bB-A-cdc-BA---:1:-1:1:42:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P12', concept: 'zar 4-2, checker play' },
  { xgid: 'XGID=-a--BBC-B-bA-B-B-bacbb-bA-:1:-1:1:64:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P13', concept: 'zar 6-4, checker play' },
  { xgid: 'XGID=-aBb--C-CAA-dC---bbbbA-A--:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P14', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-a---bEaCB--aB---bbdb-B--A:0:0:1:41:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P15', concept: 'zar 4-1, checker play' },
  { xgid: 'XGID=-a---BDBC---bB--acce----AA:0:0:1:53:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P17', concept: 'zar 5-3, checker play' },
  { xgid: 'XGID=-cB-BaEB----c--A-c-cbA--B-:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P19', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-a-a-CD-C---bD-b-b-bcA-b--:0:0:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P20', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=aa-BCBBCB-------bb-cbbbA--:1:-1:1:41:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P22', concept: 'zar 4-1, checker play' },
  { xgid: 'XGID=---aaCD-Ca--AA--abcdb--B-A:0:0:1:21:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P23', concept: 'zar 2-1, checker play' },
  { xgid: 'XGID=-a---BFbB----DAb---bbbb-b-:0:0:1:53:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P25', concept: 'zar 5-3, checker play' },
  { xgid: 'XGID=-a---BD-B---dD--bc-e---AB-:0:0:1:63:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P26', concept: 'zar 6-3, checker play' },
  { xgid: 'XGID=---ABBCAB---dB---b-cAbAbb-:1:1:1:65:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P27', concept: 'zar 6-5, checker play' },
  { xgid: 'XGID=---bBBC-BBA--B---bccb-c-A-:0:0:1:61:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P28', concept: 'zar 6-1, checker play' },
  { xgid: 'XGID=--B-BBDAAA-----bBaacb-cab-:0:0:1:55:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P29', concept: 'zar 5-5, checker play' },
  { xgid: 'XGID=--aa-AC-C-B-dB---c-bbCb-A-:0:0:1:53:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P31', concept: 'zar 5-3, checker play' },
  { xgid: 'XGID=a--B-AB-B---cBa--cabbCbBA-:0:0:1:65:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P32', concept: 'zar 6-5, checker play' },
  { xgid: 'XGID=aaBBBBBA----dC---b-cb--b-A:1:1:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P33', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=-a--AaE-C---dDa--c-da---B-:0:0:1:31:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P34', concept: 'zar 3-1, checker play' },
  { xgid: 'XGID=-b--B-E-B---dD---c-db---B-:0:0:1:32:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P35', concept: 'zar 3-2, checker play' },
  { xgid: 'XGID=-a--C-DaC-A-bB--bc-ccB----:0:0:1:65:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P36', concept: 'zar 6-5, checker play' },
  { xgid: 'XGID=--Ca-aDBC--abB--a--bcbb--A:1:-1:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P38', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-AC--bCBC--a-Ba-b--bcb-b-A:2:1:1:61:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P39', concept: 'zar 6-1, checker play' },
  { xgid: 'XGID=-ACAaBB-B----Ba-cb-ccbB---:0:0:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P40', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=-ECCB-----------a-abccBcb-:1:1:1:44:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P41', concept: 'zar 4-4, checker play' },
  { xgid: 'XGID=---aB-DaC----Da--a-bcbbBb-:1:1:1:44:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P42', concept: 'zar 4-4, checker play' },
  { xgid: 'XGID=-aB-bCC-B----C---c-bcbbB--:0:0:1:65:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P43', concept: 'zar 6-5, checker play' },
  { xgid: 'XGID=-a-bBCC-C---bB---bBd-ca---:1:-1:1:42:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P45', concept: 'zar 4-2, checker play' },
  { xgid: 'XGID=--BBaBBB-A---B--bcbcc-B-a-:1:1:1:61:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P46', concept: 'zar 6-1, checker play' },
  { xgid: 'XGID=-b--B-DaDA--dC-a-A-cbb----:0:0:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P47', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=aCBCC-D----b------ccbbb---:1:1:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P48', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=--AaBBB-C----A-cbbbdBB--a-:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P50', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=--aaBACC----Aa---bbdbbC-B-:1:1:1:55:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P51', concept: 'zar 5-5, checker play' },
  { xgid: 'XGID=--A--AD-A---eE--abbcB---bA:0:0:1:43:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P52', concept: 'zar 4-3, checker play' },
  { xgid: 'XGID=--BBbDD------a-C-bbcbba---:1:-1:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P53', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=-a--BCD-BA---A-b-bbbB-bbb-:0:0:1:53:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P54', concept: 'zar 5-3, checker play' },
  { xgid: 'XGID=-B-bBBC-A--AcB--ab-dc---B-:0:0:1:43:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P55', concept: 'zar 4-3, checker play' },
  { xgid: 'XGID=-a-B--DaC---dD-a-c-bc-A-A-:0:0:1:41:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P56', concept: 'zar 4-1, checker play' },
  { xgid: 'XGID=--BA-BDAC-b-----Bc-abacc--:1:1:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P57', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=--AaB-D-C-A-dB----bbbb-bB-:1:1:1:63:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P58', concept: 'zar 6-3, checker play' },
  { xgid: 'XGID=-a-BaBCAB---cC--a--cbb-bAA:0:0:1:43:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P60', concept: 'zar 4-3, checker play' },
  { xgid: 'XGID=-a-a-BC-C-A-bE--bbbd----aA:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P61', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-a--C-DCB---aBc--aabbbb--A:0:0:1:22:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P62', concept: 'zar 2-2, checker play' },
  { xgid: 'XGID=----bBD-B--BcDa--b-dc---A-:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P63', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=-b--b-EBB--abD-A-c-da----A:0:0:1:42:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P64', concept: 'zar 4-2, checker play' },
  { xgid: 'XGID=-cb-bBEBBAAAA----caca-----:1:-1:1:22:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P65', concept: 'zar 2-2, checker play' },
  { xgid: 'XGID=----CBCBAaA-----------AAeA:1:1:1:43:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P67', concept: 'zar 4-3, checker play' },
  { xgid: 'XGID=-aa---E-C-A-eC---bae-A--AA:0:0:1:22:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P68', concept: 'zar 2-2, checker play' },
  { xgid: 'XGID=-b---BD-BB--dC---d-eB-----:1:-1:1:63:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P69', concept: 'zar 6-3, checker play' },
  { xgid: 'XGID=-b----EDC---cB--a--c-bb-bA:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P70', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-aaB-BD-C-AAa---aabd--bbB-:0:0:1:54:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P71', concept: 'zar 5-4, checker play' },
  { xgid: 'XGID=-b---AD-C--AdD---cacb---B-:0:0:1:44:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P72', concept: 'zar 4-4, checker play' },
  { xgid: 'XGID=--aBCBCB-----------c-bdeC-:1:1:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P74', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=----aBCCD---aa-a-c-bb-BbbA:0:0:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P75', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=---aB-C-C--b-F---cbd-Ac---:1:1:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P76', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=--aBBBCBA----A---bbbbBcab-:2:-1:1:31:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P77', concept: 'zar 3-1, checker play' },
  { xgid: 'XGID=aB-cABBBB--AbB---b-cb-b-A-:1:-1:1:54:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P78', concept: 'zar 5-4, checker play' },
  { xgid: 'XGID=aa-B-BC-B---bD-b-c-d-b-AA-:0:0:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P79', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=aaBB-BC-----bD-b-c-d-b-AA-:0:0:1:65:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P80', concept: 'zar 6-5, checker play' },
  { xgid: 'XGID=-BAbCBC-----cA---bbdBb--A-:1:-1:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P81', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=----bBDAC----C-b-bbcbBb---:0:0:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P82', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=----CbC-B-B-eC-B-a-b-bba--:0:0:1:54:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P83', concept: 'zar 5-4, checker play' },
  { xgid: 'XGID=---BAbD-E-B--A-------ccca-:1:1:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P85', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=----AaE-CB--bBBabb-c-b-b--:0:0:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P86', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=-b---BD-B---eE---b-db---B-:0:0:1:53:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P87', concept: 'zar 5-3, checker play' },
  { xgid: 'XGID=----BBCbBB--bB---d-d-ab-AA:0:0:1:61:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P88', concept: 'zar 6-1, checker play' },
  { xgid: 'XGID=-bCDcCBBA-------ababb-b---:1:-1:1:21:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P89', concept: 'zar 2-1, checker play' },
  { xgid: 'XGID=aBBCBCBA----------------g-:1:1:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P90', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=-a-B--D-C--AcCb--cadBa----:0:0:1:44:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P91', concept: 'zar 4-4, checker play' },
  { xgid: 'XGID=----a-DBC---AA---bbdBcc-B-:1:1:1:32:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P93', concept: 'zar 3-2, checker play' },
  { xgid: 'XGID=---Ba-CBB-B------babBdcbB-:1:1:1:21:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P94', concept: 'zar 2-1, checker play' },
  { xgid: 'XGID=----CBC-B---bCbb-d-eA---A-:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P95', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-b----EBB---cD---dae----B-:0:0:1:63:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P96', concept: 'zar 6-3, checker play' },
  { xgid: 'XGID=----cBDBB-B-bB---b-d-b-bA-:0:0:1:55:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P97', concept: 'zar 5-5, checker play' },
  { xgid: 'XGID=-a---cE-C---bCaC-b-bbb--A-:0:0:1:42:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P98', concept: 'zar 4-2, checker play' },
  { xgid: 'XGID=-B-BbBB-C---bB----Bcabcb--:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P99', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=---a-aDCC-a-bB---bBbbbb--A:1:1:1:32:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P100', concept: 'zar 3-2, checker play' },
  { xgid: 'XGID=-aBBC-BB----cB---bBbbbc---:1:-1:1:31:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P101', concept: 'zar 3-1, checker play' },
  { xgid: 'XGID=-aBa--DBBA-A------aAbcbBe-:1:-1:1:66:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P102', concept: 'zar 6-6, checker play' },
  { xgid: 'XGID=--ABBCBbC---B------bcbbbb-:0:0:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P104', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=-----bE-E-BabB-b-c-e----A-:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P105', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=-BBbb-DB-----Bbb-badBA----:0:0:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P106', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=---BBaCBB---cBb--c-bbb-AA-:0:0:1:63:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P107', concept: 'zar 6-3, checker play' },
  { xgid: 'XGID=-a-ab-E-D---bD-b-A-c--bAb-:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P108', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=-a-B-BB-C---cD---cbdb-B---:0:0:1:64:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P109', concept: 'zar 6-4, checker play' },
  { xgid: 'XGID=-b----FCC---bBaa-a-bbbb-A-:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P111', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=--aBBDBB----b--c-d-dCa----:1:-1:1:65:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P112', concept: 'zar 6-5, checker play' },
  { xgid: 'XGID=-baBa-E-A-AAcC---c-e-A-A--:0:0:1:43:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P113', concept: 'zar 4-3, checker play' },
  { xgid: 'XGID=-a----ECCA-Ad----baebA--A-:0:0:1:61:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P114', concept: 'zar 6-1, checker play' },
  { xgid: 'XGID=-a-aa-EDBA-Ad----aadbA---A:0:0:1:43:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P115', concept: 'zar 4-3, checker play' },
  { xgid: 'XGID=--a-b-E-D---bC--bbBcbaA---:0:0:1:11:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P116', concept: 'zar 1-1, checker play' },
  { xgid: 'XGID=--AbCBCC----b---cbCcc-----:0:0:1:54:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P117', concept: 'zar 5-4, checker play' },
  { xgid: 'XGID=-aa---E-Ea--cD-----bbab-bA:0:0:1:64:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P118', concept: 'zar 6-4, checker play' },
  { xgid: 'XGID=---abDCCC----B--a--bbabbb-:1:-1:1:61:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P119', concept: 'zar 6-1, checker play' },
  { xgid: 'XGID=-a-a--ECC---cC---c-e-b-A--:0:0:1:32:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P120', concept: 'zar 3-2, checker play' },
  { xgid: 'XGID=--a-BaDCC----Bc--b-d-b-bA-:0:0:1:55:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P121', concept: 'zar 5-5, checker play' },
  { xgid: 'XGID=-B-Ba-D-C---bCa-bc-d--b--A:0:0:1:44:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P123', concept: 'zar 4-4, checker play' },
  { xgid: 'XGID=-a--BBBBAB--aB--bcbd-bB---:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P124', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=--ABDBBb-----B---bbbbcB-b-:0:0:1:44:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P125', concept: 'zar 4-4, checker play' },
  { xgid: 'XGID=--CBACB-BAb-aab--b-c-bbA--:1:-1:1:32:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P126', concept: 'zar 3-2, checker play' },
  { xgid: 'XGID=-BaB-BB-B---aB--bb-cBb-bbA:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P127', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-aBBB-BBB-A-A--a--bbbbbbaA:1:1:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P128', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=aaBCaBB-A---bC-A---cbcbA--:1:-1:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P129', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=--ACCbB-D----B-----cbcbba-:1:1:1:11:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P130', concept: 'zar 1-1, checker play' },
  { xgid: 'XGID=--aB-BCaB---dD---d-e--A-A-:1:-1:1:21:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P131', concept: 'zar 2-1, checker play' },
  { xgid: 'XGID=-B-aCCBb-----B-b-b-bcBb-aA:0:0:1:43:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P132', concept: 'zar 4-3, checker play' },
  { xgid: 'XGID=------E-CAa-dD---c-e-AA-b-:1:1:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P133', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=-a-B-aD-BA--cD---bcc-B--b-:0:0:1:61:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P134', concept: 'zar 6-1, checker play' },
  { xgid: 'XGID=-aa---E-D---cD---c-dab--AA:0:0:1:52:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P136', concept: 'zar 5-2, checker play' },
  { xgid: 'XGID=-DCBBBb-----cAb--b-dA--aa-:1:-1:1:64:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P137', concept: 'zar 6-4, checker play' },
  { xgid: 'XGID=--b-C-D-C---cCa--b-dba--AA:0:0:1:33:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P138', concept: 'zar 3-3, checker play' },
  { xgid: 'XGID=--bCBaB-CA--bB---bbbbbB---:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P139', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=aA--aaFADa--b---bBabbbA---:0:0:1:51:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P140', concept: 'zar 5-1, checker play' },
  { xgid: 'XGID=---BB-CbC----C---cdf-B----:0:0:1:65:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P141', concept: 'zar 6-5, checker play' },
  { xgid: 'XGID=-aa-B-DAC-B-bB-aab-e-b--A-:1:-1:1:22:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P142', concept: 'zar 2-2, checker play' },
  { xgid: 'XGID=-a---BD-B-B-dBb--b-dA--bB-:0:0:1:21:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P143', concept: 'zar 2-1, checker play' },
  { xgid: 'XGID=-a--a-EBB---dD---b-eb---B-:0:0:1:21:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P144', concept: 'zar 2-1, checker play' },
  { xgid: 'XGID=-a-BB-C-B---bD---cBcbd----:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P145', concept: 'zar 6-2, checker play' },
  { xgid: 'XGID=--aBB-CaBA-AbBa-bb-bbbB---:1:1:1:64:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P146', concept: 'zar 6-4, checker play' },
  { xgid: 'XGID=--aBB-CBBA--bAa-bb-bcbB---:1:1:1:42:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P147', concept: 'zar 4-2, checker play' },
  { xgid: 'XGID=-BABBBA----A------bdBeBac-:2:1:1:54:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P149', concept: 'zar 5-4, checker play' },
  { xgid: 'XGID=-aa---E-C---dEa--c-e----B-:0:0:1:62:0:0:3:0:10', answer: '', title: 'Euler Everyday Errors — P150', concept: 'zar 6-2, checker play' },
  { gnuPos: 'sHPwBAY2mw4IEg', gnuMatch: 'cIkUAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P1', concept: 'Money; blot on 23pt over hitting' },
  { gnuPos: 'sHPwBAY2mw4ICg', gnuMatch: 'cIkUAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P1 Variant', concept: 'Shifted blot reverses strategy' },
  { gnuPos: 'zG4LA0C2uhkAGA', gnuMatch: 'UQkVAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P2', concept: 'Tweener balances hit and cover' },
  { gnuPos: 'ZruBAwSwbcMEMA', gnuMatch: 'cIkxAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P3', concept: 'DMP; prime vs prime' },
  { gnuPos: 'mOeGAxCz7QIBSA', gnuMatch: 'QYkFAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P4', concept: 'Maximize hitting over loose hit' },
  { gnuPos: 'mNeGAxCz7QIBSA', gnuMatch: 'QYkMAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P4 Variant', concept: 'Loose hit optimal after shift' },
  { gnuPos: 'bBvwBQLgc3AwMA', gnuMatch: 'cAknAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P5', concept: 'DMP gammon save; aggressive' },
  { gnuPos: 'bLcBATi23QkAGA', gnuMatch: 'cAkPAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P6', concept: 'Minimize shots; delicate balance' },
  { gnuPos: 'bLuBADi22wkAGA', gnuMatch: 'cAkaAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P6 Variant 1', concept: 'Shifted spare changes play' },
  { gnuPos: 'zM7gASTgc8NBEA', gnuMatch: '8AlXABAAAAAA', answer: '', title: 'Chow Challenge #1 — P7', concept: 'Gammon go; defensive' },
  { gnuPos: 'TJ+DwQC8vQEHAA', gnuMatch: 'QYkOAAAAAAAA', answer: '13/8 5/2', title: 'Chow Challenge #1 — P8', concept: 'Duplicate opponent\'s rolls' },
  { gnuPos: 'bD2DwQC8vQEHAA', gnuMatch: 'QYkOAAAAAAAA', answer: '6/1 5/2', title: 'Chow Challenge #1 — P8 Variant 1', concept: 'Stronger board changes play' },
  { gnuPos: 'tpyRwQDc3oAHAA', gnuMatch: 'QYkOAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P8 Variant 2', concept: 'Different distribution' },
  { gnuPos: 'ZncDBAY6N4MFCA', gnuMatch: '8AlFAAAACAAA', answer: '', title: 'Chow Challenge #1 — P9', concept: 'Gammon save; strengthen board' },
  { gnuPos: '2M7QADKwu8cAEA', gnuMatch: 'cIkGAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P10', concept: 'Aggressive hit' },
  { gnuPos: '2M7CADKwu8cAEA', gnuMatch: 'cIkGAAAAAAAA', answer: '', title: 'Chow Challenge #1 — P10 Variant', concept: 'Subtle shift reverses play' },
  { gnuPos: 'Zs7CAQbQa/AAMg', gnuMatch: 'cIkJAAAAAAAA', answer: '', title: 'Chow Challenge #2 — P1', concept: 'Anchoring vs advanced anchor' },
  { gnuPos: 'mM/BYQCrtgMNAA', gnuMatch: 'QYmSAAAAAAAA', answer: '', title: 'Chow Challenge #2 — P2', concept: 'Pay now or pay later' },
  { gnuPos: 'Zs7BYQCrtgMNAA', gnuMatch: 'QYmSAAAAAAAA', answer: '13/4', title: 'Chow Challenge #2 — P2 Variant', concept: 'Stronger board; close top plays' },
  { gnuPos: 't5sTBABtu0QAAw', gnuMatch: 'UQkJAAAAAAAA', answer: '', title: 'Chow Challenge #2 — P3', concept: 'Hit vs build; gammon losses' },
  { gnuPos: 'tm0FYAgbnoMHAA', gnuMatch: 'cAklAAAAAAAA', answer: '8/6 2/1', title: 'Chow Challenge #2 — P4', concept: '1pt match; defensive' },
  { gnuPos: 'ZpsLA0CbbQ0ADA', gnuMatch: 'QYkOAAAAAAAA', answer: '', title: 'Chow Challenge #2 — P5', concept: 'Slot boldly, diversified cover' },
  { gnuPos: 'LM/gAxBjnsHBAA', gnuMatch: '8IlEABAAAAAA', answer: '', title: 'Chow Challenge #2 — P6', concept: 'Gammon go; broken prime' },
  { gnuPos: 'jOcxA0DbbIEgAw', gnuMatch: 'QQkKAAAAAAAA', answer: '', title: 'Chow Challenge #2 — P7', concept: 'Consolidate vs overextend' },
  { gnuPos: 'a9tDAASZvc0AAA', gnuMatch: '8AlXAAAACAAA', answer: '', title: 'Chow Challenge #2 — P8', concept: 'Gammon save; safe play' },
  { gnuPos: '294GAAiO3SwhAA', gnuMatch: 'cIk2AAAAAAAA', answer: '', title: 'Chow Challenge #2 — P9', concept: '1pt match; uproot point' },
  { gnuPos: 'aHcDAjJ4nsEBDA', gnuMatch: 'cImoABAAEAAA', answer: '', title: 'bgonline — Perry/UBK 21 to Play', concept: 'Match to 5, 2-1 down' },
  { gnuPos: '1a4pwABsd7YAAA', gnuMatch: 'EYERADAAAAAA', answer: '10/6 5/2', title: 'bgonline — GNU 4-ply position', concept: 'Bearoff/safe; 4-ply top play' },
  { gnuPos: '33sAACjgtm0AYA', gnuMatch: 'cAkXAAAAAAAE', answer: '', title: 'bgonline — containment', concept: 'Entering from bar; containment' },
  { gnuPos: 'sCMJ2BaDu8FDAA', gnuMatch: 'QYnyAAAAEAAE', answer: '', title: 'bgonline — backgame double hit', concept: 'Backgame double hit' },
  { gnuPos: 'mM8jBwCMt8EBMA', gnuMatch: 'cAnuACAAEAAE', answer: '', title: 'rec.games.backgammon — Pos 1', concept: 'Make 4pt; race vs blitz' },
  { gnuPos: 'NJ8HBwCMt4kBUA', gnuMatch: 'UYn0ACAAEAAE', answer: '', title: 'rec.games.backgammon — Pos 2', concept: 'Enter from bar; anchor' },
  { gnuPos: 'wueYAQawz8gBDA', gnuMatch: 'cAkPAAAAAAAE', answer: '', title: 'bgonline — rollout running', concept: 'Running from backgame' },
  { gnuPos: '4PPEAQywZ8wBMA', gnuMatch: 'cInpACAAKAAA', answer: '', title: 'bgonline — Doubles 23 to Play', concept: '3-2 split vs break 11pt' },
  { gnuPos: '4NvgAQOYbwcDIA', gnuMatch: 'cIntAEAAEAAE', answer: '', title: 'bgonline — Middle Game 33 (match)', concept: 'Doubles 3-3 match play' },
  { gnuPos: '4HPhASjgc/ABMA', gnuMatch: 'cAkOAAAAAAAA', answer: '24/21 13/9', title: 'bgonline — SOSDD 43 to Play', concept: 'Opening 4-3; builder over hit' },
  { gnuPos: 'g3cPBgBsu8CAEQ', gnuMatch: 'QQn6ASAAIAAA', answer: '13/9 13/7', title: 'bgonline — OLM Rollout 13/9 13/7', concept: 'Middle-game builders' },
  { gnuPos: '4HPwYCDgc/ALAA', gnuMatch: 'cAn5ASAAQAAA', answer: '', title: 'bgonline — OLM Rollout 14/8 13/11', concept: 'Split and build' },
  { gnuPos: '0OvgYCDg88gHAA', gnuMatch: 'cAn1ASAAQAAA', answer: '13/11 6/1*', title: 'bgonline — OLM Rollout 13/11 6/1*', concept: 'Hit on ace point vs builder' },
  { gnuPos: 'sOvEYCDg8zEHAA', gnuMatch: 'cInoASAAQAAA', answer: '13/11 6/5', title: 'bgonline — OLM Rollout 13/11 6/5', concept: 'Slot 5pt vs safe' },
  { gnuPos: 'mLfBATCMz4MBKA', gnuMatch: 'cInpACAAAAAE', answer: '', title: 'rgb — random9 (3-2 açılış)', concept: '3-2 acilis cevabi; rollout en iyi 24/22 23/20' },
  { gnuPos: 'zE7wATCwt+ABMA', gnuMatch: 'cAlmAQAAQAAE', answer: '13/8', title: 'rgb — equities (13/8)', concept: 'Skora gore cubeless esitlik; 13/8' },
  { gnuPos: 'OWbDgCHsbOABBg', gnuMatch: 'MAHrAAAAIAAE', answer: '', title: 'rgb — 6-2 checker play', concept: '0-4 skorda 6-2 checker-play' },
  { gnuPos: 'sOfBAyDYzuABBg', gnuMatch: 'cAkPAAAAAAAA', answer: '13/10 13/7', title: 'rgb — 13/10 13/7 vs 13/4', concept: 'Hint derinligine gore degisen checker-play' },
  { gnuPos: 'sOfBAyBsO+DBAA', gnuMatch: 'cAkPAAAAAAAA', answer: '13/4', title: 'rgb — 13/4 varyant', concept: 'Ayni kararin 13/4 sonucu' },
  { gnuPos: 'dduAAQaNbRswAA', gnuMatch: 'cAkXAAAAAAAA', answer: '', title: 'rgb — 16/11 16/10 vs 7/1 7/2', concept: '2-ply vs rollout checker-play farki' },
  { gnuPos: '4HPwAyDgc/ABMA', gnuMatch: '8IntAFAAMAAA', answer: '', title: 'rgb — Crawford 33 açılış cevabı', concept: 'Crawford macta 33; gammon-save anchor' },
  { gnuPos: 'u+UBBAa7swMRAA', gnuMatch: 'QQkyAyAASAAE', answer: '', title: 'rgb — çift-4 15/3 12/8', concept: 'Cift-4 sonrasi vurus maruziyeti' },
  { gnuPos: 'ZndmAAjG3pICIA', gnuMatch: 'cAkzAAAAAAAE', answer: '', title: 'rgb — 6-4 24/18 7/3*', concept: 'Derinlige gore degisen vuruslu checker-play' },
  { gnuPos: 'eG8LBAhlAwB4Nw', gnuMatch: 'UommAAAAAAAE', answer: '', title: 'rgb — backgame 5-1 22/17*/16', concept: 'Backgame\'de 5-1 vuruslu checker-play' },
  { gnuPos: '4WYYCDPm7gBkQA', gnuMatch: 'QYklAuAAKAAE', answer: '', title: 'rgb — biggest blunder (3-1 bar/22 16/15)', concept: '3-1 vurma blunder; en iyi bar/22 16/15' },
  { gnuPos: '4PPIATDgc/ABMA', gnuMatch: 'MAG3AAAAAAAA', answer: '13/2', title: 'rgb — gBOT 65 -> 13/2', concept: '5p macta 6-5 ile 13/2' },
  { gnuPos: 'jM/BATDYZvABMA', gnuMatch: 'cAkKAAAAAAAA', answer: '', title: 'rgb — money 24/20 13/11', concept: 'Moneyplay checker-play' },
  { gnuPos: 'tmxDASjMts0AQA', gnuMatch: 'AYFkAaAAGAAA', answer: '', title: 'MCG vs Stick #1', concept: 'Post-Crawford 11; race vs contact' },
  { gnuPos: 'W1sOBgC2dgvAAA', gnuMatch: 'AYFtAaAAOAAA', answer: '', title: 'MCG vs Stick #2', concept: '33; priming vs builder' },
  { gnuPos: '7LwxAAY1dwcAAw', gnuMatch: 'cAn6ASAAGAAA', answer: '', title: 'Readers to play 46', concept: '46 to play' },
  { gnuPos: 'YudBAjiMt4MBQg', gnuMatch: 'QYnyAYAAGAAA', answer: '', title: 'OTB 54 to play', concept: '54 over-the-board' },
  { gnuPos: '9zYAEDL+/AYAAA', gnuMatch: 'EQF5ATAAGAAA', answer: '', title: 'OTB 26 to play', concept: '26 to play' },
  { gnuPos: '4NvgATDgc/ABMA', gnuMatch: '8AllABAAEAAA', answer: '', title: '53P-21 Gammon Save', concept: '21 slot at gammon-save' },
  { gnuPos: 'sG+JATBsnsEBMA', gnuMatch: 'cAkFAAAAIAAA', answer: '', title: 'Routine opening decision', concept: 'Opening checker decision' },
  { gnuPos: 'm5sbAAKY2yUCDA', gnuMatch: 'QYmqADAAGAAA', answer: '', title: 'Gus Hansen v Sander Lylloff 52', concept: '52 annotated match' },
  { gnuPos: '4NvBAQbgc+SAIQ', gnuMatch: 'cIn0ASAAIAAA', answer: '', title: 'OLM 06/17/10 A', concept: '15 online-league' },
  { gnuPos: '4LfBAAewz+CAQQ', gnuMatch: 'cInsASAAIAAA', answer: '', title: 'OLM 06/17/10 B', concept: 'Online-league checker play' },
  { gnuPos: 'cB/hAQbg2+ABMA', gnuMatch: 'cIkGAAAAAAAA', answer: '', title: 'Play 51 RO', concept: '51 deep rollout' },
  { gnuPos: '4PPgESDMTvABMA', gnuMatch: 'cIn5AUAAQAAA', answer: '', title: 'OLM 07/27/10 A 36', concept: '36 to play' },
  { gnuPos: '4NsTgwDMHfABUA', gnuMatch: 'cInwAUAAQAAA', answer: '', title: 'OLM 07/27/10 B 14', concept: '14 to play' },
  { gnuPos: '2LbBADRs9yQGAA', gnuMatch: 'QQkWAAAAAAAA', answer: '', title: 'Two down? Two in? 45', concept: '45 how many to bring in' },
  { gnuPos: '4PPgASHgOfIAWA', gnuMatch: 'cAkSAAAAAAAA', answer: '', title: 'Inconclusive rollout 44', concept: '44 close rollout' },
  { gnuPos: '4OvIAyBoZ+IDIA', gnuMatch: 'cAn3ACAAGAAA', answer: '', title: 'A very subtle position', concept: 'Subtle, small equity gaps' },
  { gnuPos: 'sLeDBwCw5zEDIA', gnuMatch: 'cAntAQAAAAAA', answer: '', title: 'OLM 04/25/10 A 23', concept: '23 to play' },
  { gnuPos: 'mHMwoCngM2MwSA', gnuMatch: 'MAGrADAAAAAA', answer: '', title: 'Senkiewicz-Tardieu (13/7)', concept: 'Classic reference 13/7 vs 8/2' },
  { gnuPos: '0Dn4AAuw8+DBAA', gnuMatch: 'cAkKAAAAKAAA', answer: '', title: 'Mutual holding game', concept: 'Mutual holding; timing vs race' },
  { gnuPos: '2+YMABRjN4MIAw', gnuMatch: 'QQmtAAAACAAA', answer: '', title: 'Hit or not? 23', concept: '23 hit vs non-hit' },
  { gnuPos: 'u22DAAjv7GEAAA', gnuMatch: 'UgkqASAAOAAA', answer: '', title: 'Super Gammon Save 42', concept: '42 gammon-save urgency' },
  { gnuPos: '2M7BAxDY3hHBAA', gnuMatch: 'QYkWAAAAAAAA', answer: '', title: 'Extreme Gammon 55', concept: '55 to play' },
  { gnuPos: 'btsEAQPNnIMHAA', gnuMatch: 'UQknA0ABiAAA', answer: '', title: '61 vs holding game', concept: '61 vs holding game' },
  { gnuPos: 'ZOfBAwIz7g4GAA', gnuMatch: 'cIkyAAAAAAAA', answer: '', title: 'Payment due? play 5', concept: 'Pay-now-vs-later' },
  { gnuPos: 'trsNAASazQ0BMA', gnuMatch: 'cAkuAAAAAAAA', answer: '', title: 'Six-primed at DMP A', concept: 'Six-prime escape 13/6 vs 8/4' },
  { gnuPos: 'tt0OAATM5oYBMA', gnuMatch: 'cAk3AAAAAAAA', answer: '', title: 'Six-primed at DMP C', concept: 'Six-prime escape variant' },
  { gnuPos: 'tu2GAASw84YBMA', gnuMatch: 'cIkuAAAAAAAA', answer: '', title: 'Six-primed at DMP D', concept: 'Six-prime escape variant' },
  { gnuPos: 'sFvwAQyw58QBMA', gnuMatch: 'cAkSABAAAAAA', answer: '', title: 'Which doublets hardest 44', concept: '44 hard doublet' },
  { gnuPos: 'szmDAQqw58EcAA', gnuMatch: 'UQkSADAAKAAA', answer: '', title: 'Which doublets hardest B', concept: 'Hard doublet checker play' },
  { gnuPos: 'Hc6MAQYzN8IRBA', gnuMatch: 'cImsACAAGAAA', answer: '', title: '31 several options', concept: '31 multiple reasonable moves' },
  { gnuPos: '4PPgASTgc/ABMA', gnuMatch: 'MAFmAQAAAAAA', answer: '', title: 'Real opening play 41', concept: '41 opening' },
  { gnuPos: 'IAfgGWvsnOgBAg', gnuMatch: 'sAH1AGAAEAAA', answer: '', title: 'Backgame checker play 25', concept: '25 from a backgame' },
  { gnuPos: 'IAfgOWbZk+gBAg', gnuMatch: 'sAHmAGAAEAAA', answer: '', title: 'Backgame checker play B', concept: 'Backgame checker play variant' },
  { gnuPos: 'gAPwHGvsE/SAQA', gnuMatch: 'sAH5AGAAEAAA', answer: '', title: 'Backgame checker play C', concept: 'Backgame checker play variant' },
  { gnuPos: '2G4LAwLg62AALQ', gnuMatch: 'AYGlAAAAEAAA', answer: '', title: 'Falafel to play 31', concept: '31 expert-level decision' },
  { gnuPos: 'jj0PBgDatsAAIw', gnuMatch: 'UYkVADAACAAA', answer: '', title: 'What do I concede? 35', concept: '35 which point to give up' },
  { gnuPos: 'xnYzAEjZbaAACw', gnuMatch: 'cIn4AYAAQAAA', answer: '', title: 'OLM 08/13/10 B', concept: 'Online-league checker play' },
  { gnuPos: '4HnkATDa3CbAAA', gnuMatch: 'EQHrAAAAAAAE', answer: '', title: 'rgb — 6-2 18/10', concept: '6-2 running play for gammon value vs safe 10/2' },
  { gnuPos: 'jGfwCQSDz4MBKA', gnuMatch: 'MAGnAQAAKAAA', answer: '8/2 6/5', title: 'rgb — 6-1 8/2 6/5', concept: '6-1 behind in score; builder vs anchor split' },
  { gnuPos: '4HPkASjgc+QBKA', gnuMatch: 'cAnzAEAAIAAA', answer: '24/14*', title: 'rgb — early 6-4 24/14*', concept: '6-4 double-run hit beats making bar/2-point' },
  { xgid: 'XGID=-aBCB-BbC----C----acabbba-:0:0:1:33:2:0:0:9:10', answer: '', title: 'Chris Bray 2024 POTW7', concept: '33 tas hamlesi' },
  { xgid: 'XGID=-A-BCCBb----aB-----cBbbcb-:0:0:1:21:0:0:0:0:10', answer: '4/1', title: 'Marc Olsen — Masterclass', concept: '21 nokta yapma; 4/1' },
  { gnuPos: '8M7BAWDLrMEAJg', gnuMatch: 'QQkbAAAAAAAE', answer: '', title: 'Forum — 6-6 Bar Point', concept: '66 çiftinde bar point kapama tercihi' },
  { xgid: 'XGID=--aBBBBB----cC---bBdab-b--:1:-1:1:32:0:0:0:7:10', answer: '', title: 'Chris Bray — At the Crossroads (USBGF 2026)', concept: '7 maçında 32 tas hamlesi' },
  { xgid: 'XGID=-----bE-CAA-cC--bc-e----B-:0:0:1:22:0:0:3:0:10', answer: '', title: 'Chris Bray — Priorities (USBGF 2026)', concept: 'Para oyunu 22 tas hamlesi' },
  { xgid: 'XGID=-bBba-DBB---bC-a-b-cAb---A:0:0:1:54:0:0:3:0:10', answer: '', title: 'Chris Bray — Back Game Planning (USBGF 2026)', concept: 'Arka oyun planlaması 54' },
  { xgid: 'XGID=-aa---E-C---cE-aac-e----AA:0:0:1:52:1:0:0:7:10', answer: '', title: 'Chris Bray — Early Development (USBGF 2026)', concept: 'Erken gelişim 52' },
  { xgid: 'XGID=-a-B--DaB---dEa--c-e----B-:0:0:1:22:0:0:2:0:10', answer: '', title: 'Chris Bray — Washing Day (USBGF 2026)', concept: 'Para oyunu 22 tas hamlesi' },
  { xgid: 'XGID=-BCbBaF-aB---------bbbbc--:0:0:1:54:0:0:3:0:10', answer: '', title: 'Chris Bray — Pay Me Now, Pay Me Later (USBGF)', concept: 'Para oyunu: kaçış zamanlaması vs güvenlik' },
  { xgid: 'XGID=--ABBBC-A---a--ccb-dBbB---:1:1:1:42:9:6:0:11:10', answer: '', title: 'Chris Bray — A Difficult Decision (USBGF)', concept: 'Skor 42 hamlesini şekillendirir' },
  { xgid: 'XGID=-BDBBbC-------b----cBbbbb-:0:0:1:42:7:9:0:11:10', answer: '', title: "Chris Bray — Bray's Principle (USBGF)", concept: 'Arka noktayı doğru boşaltmak' },
  { xgid: 'XGID=--b---EBB-A-cB-a-cae----BA:0:0:1:21:4:4:0:5:10', answer: '', title: 'Chris Bray — Make the Checkers Work (USBGF)', concept: 'DMP: her taşı üretken kıl' },
  { xgid: 'XGID=--a---EaB--AdD-a-c-e----BA:0:0:1:21:0:0:3:0:10', answer: '', title: 'Chris Bray — Checker Development (USBGF)', concept: '21 ile erken gelişim' },
  { xgid: 'XGID=----baDBB----B-AbcbbaAB-bA:0:0:1:41:0:0:0:7:10', answer: '', title: 'Chris Bray — Game Plan Required (USBGF)', concept: 'Hamleden önce oyun planı seç' },
  { xgid: 'XGID=-b--b-ECD---cB---d-d----A-:0:0:1:44:0:0:3:0:10', answer: '', title: 'Chris Bray — Simple Basics (USBGF)', concept: 'Temel 44 nokta yapımı' },
  { xgid: 'XGID=--BBCB---a-AA-------bbcDg-:3:-1:1:33:0:0:3:0:10', answer: '', title: 'Chris Bray — Making the Checkers Work (USBGF)', concept: 'Sınırsız: 33 değerini çıkar' },
  { xgid: 'XGID=-a---BCBC-A-cB----bebb-AA-:0:0:1:32:2:3:0:7:10', answer: '', title: 'Chris Bray — Flawed Strategy (USBGF)', concept: 'Orta oyun 32: hatalı plandan kaçın' },
  { xgid: 'XGID=aBBaBBB-----dA---b-cbBbAA-:1:-1:1:55:1:4:0:9:10', answer: '', title: 'Chris Bray — A Recurring Theme (USBGF)', concept: '55 ile prime/anchor teması' },
  { xgid: 'XGID=---aC-C-BC--aA-A---dcdb-B-:1:-1:1:33:5:5:0:7:10', answer: '', title: 'Chris Bray — Ignoring the Obvious (USBGF)', concept: 'DMP 33: bariz olmayan en iyi hamle' },
  { xgid: 'XGID=-b----E-D---dDa--c-da---AA:0:0:1:21:0:0:3:0:3', answer: '', title: 'Chris Bray — Early Game Skirmish (USBGF)', concept: 'Erken oyun 21 çatışması' },
  { gnuPos: '27pFAAR1dhgHAA', gnuMatch: 'QYkQAAAAAAAA', answer: '6/2', title: 'Forum — En zor problemler (41)', concept: 'Para 41: ince 6/2 vs 13/12' },
  { gnuPos: '23gbAAi4m0MIBg', gnuMatch: 'UYkMAAAAAAAA', answer: '4/3*', title: 'Forum — En zor problemler (31)', concept: 'Para 31: vuruş 4/3* vs 12/9' },
  { xgid: 'XGID=---BBBBA----eB---cBe-b-AA-:0:0:1:21:0:0:3:0:10', answer: '23/20', title: 'Forum — Six best plays (21)', concept: '2-1 arka tas/anchor seçimi' },
  { xgid: 'XGID=---BBBBA----fB---bBe-b-AA-:0:0:1:21:0:0:3:0:10', answer: '23/22 7/5', title: 'Forum — Six best plays (21 var A)', concept: '2-1 varyant' },
  { xgid: 'XGID=---BBBBA----dBa--cBe-b-AA-:0:0:1:21:0:0:3:0:10', answer: '13/10', title: 'Forum — Six best plays (21 var B)', concept: '2-1 varyant' },
  { xgid: 'XGID=---BBBBA----cBb--cBe-b-AA-:0:0:1:21:0:0:3:0:10', answer: '23/22 13/11', title: 'Forum — Six best plays (21 var C)', concept: '2-1 varyant' },
  { xgid: 'XGID=---BBBBA----cB--bcBe-b-AA-:0:0:1:21:0:0:3:0:10', answer: '24/23 13/11', title: 'Forum — Six best plays (21 var D)', concept: '2-1 varyant' },
  { xgid: 'XGID=---BBBBA----bB--ccBe-b-AA-:0:0:1:21:0:0:3:0:10', answer: '24/22 23/22', title: 'Forum — Six best plays (21 var E)', concept: '2-1 varyant' },
  { xgid: 'XGID=-a---aD-CA--cE-aac-c-b--AA:0:0:1:41:0:0:3:0:10', answer: 'bar/24 13/9', title: 'Forum — 41 bar (koş vs yap)', concept: '4-1 bardan: koşmak vs yapmak' },
  { xgid: 'XGID=-a---aE-CA--cD-aac-c-b--AA:0:0:1:41:0:0:3:0:10', answer: 'bar/24 9/5*', title: 'Forum — 41 bar varyant (vuruş)', concept: '4-1 bardan vuruşlu' },
  { xgid: 'XGID=---AB-C-B----C-b-cbdcaBB--:1:1:1:52:0:0:3:0:10', answer: '13/11 8/3', title: 'Forum — Hit or too soon (52)', concept: '5-2 vuruş zamanlaması' },
  { xgid: 'XGID=---AB-C-B----C-bbc-dcaBB--:1:1:1:52:0:0:3:0:10', answer: '23/21* 8/3', title: 'Forum — Hit or too soon (52 var)', concept: '5-2 varyant vuruş' },
  { xgid: 'XGID=--a--BCBB-B-cD---a-bb-bbb-:0:0:1:61:0:0:3:0:10', answer: '13/7 10/9', title: 'Forum — PotD 61 (yapıcı vs güvenli)', concept: '6-1 builder vs güvenli' },
  { xgid: 'XGID=--a--BCBB-B-cD---a-bb-bbb-:0:0:1:51:0:0:3:0:10', answer: '13/7', title: 'Forum — PotD 51', concept: '5-1 hamle' },
  { xgid: 'XGID=--a--BBBC-B-cD---a-bb-bbb-:0:0:1:61:0:0:3:0:10', answer: '13/6', title: 'Forum — PotD 61 varyant', concept: '6-1 (8pt yedek)' },
  { xgid: 'XGID=-----BD-BA--cD-b-cbe---AA-:0:0:1:31:0:0:3:0:10', answer: '24/23 13/10', title: 'Forum — PotD 31 (var A)', concept: '3-1 hamle varyant' },
  { xgid: 'XGID=-----BD-BA--cD-bbc-e---AA-:0:0:1:31:0:0:3:0:10', answer: '13/9', title: 'Forum — PotD 31 (var B)', concept: '3-1 hamle varyant' },
  { xgid: 'XGID=-----BD-BA--cDbb-c-e---AA-:0:0:1:31:0:0:3:0:10', answer: '23/22 13/10', title: 'Forum — PotD 31 (var C)', concept: '3-1 hamle varyant' },
  { xgid: 'XGID=-a--aBD-B---dE--ab-d--b-B-:0:0:1:43:0:0:3:0:10', answer: '', title: 'Forum — PotD 43 (10-18-26)', concept: '4-3 hamle' },
  { xgid: 'XGID=---CBCC------Bb-dc-bBbb---:1:-1:1:11:0:0:3:0:10', answer: '', title: 'Forum — PotD çift-1 (eşdeğer)', concept: 'Çift 1: eşdeğer oyunlar' },
  { xgid: 'XGID=-aa---D-C--adD-a-c-ca-A-AB:0:0:1:44:5:4:3:0:10', answer: '', title: 'Forum — PotD çift-4 (5-4 skor)', concept: 'Çift 4, 5-4 skorda' },
  { xgid: 'XGID=-ba--aC-C---eD-A-c-c-BA-A-:0:0:1:22:5:4:3:0:10', answer: '', title: 'Forum — PotD Ducks çift-2 (5-4)', concept: 'Çift 2, 5-4 skorda' },
]

// "Gercek Pozisyonlar": ISIM/MARKA bazli gruplar (Chris Bray, Mochy, Euler, Chow, Forum...) -> her usta/
// kaynak bir DERS, adiyla gorunur. Her grup, uyelerinin nöral-zorluk medyanina gore BIR katmana (tier)
// yerlesir (REAL_POSITIONS kolay->zor sirali, index = zorluk rank). Acilislar en kolay katmanda.
function authorOf(p: Famous): { key: string; title: string } {
  const t = p.title.toLowerCase()
  if (/michy|kageyama/.test(t)) return { key: 'michy', title: 'Michy Kageyama' }
  if (/falafel/.test(t)) return { key: 'falafel', title: 'Falafel Natanzon' }
  if (/mochy|sander/.test(t)) return { key: 'mochy', title: 'Mochy Mochizuki' }
  if (t.includes('bray')) return { key: 'bray', title: 'Chris Bray — Haftanın Pozisyonu' }
  if (t.includes('euler')) return { key: 'euler', title: 'Euler — Günlük Hatalar' }
  if (t.includes('chow')) return { key: 'chow', title: 'Chow’un Dama Sınavı' }
  if (t.includes('marc olsen')) return { key: 'olsen', title: 'Marc Olsen' }
  if (t.includes('ian terry')) return { key: 'terry', title: 'Ian Terry' }
  if (t.includes('wilkinson')) return { key: 'wilk', title: 'Sebastian Wilkinson' }
  if (t.includes('barget')) return { key: 'barget', title: 'Simon Barget' }
  if (/o.?hagan/.test(t)) return { key: 'ohagan', title: 'John O’Hagan' }
  if (/ubc|usbgf|masters|bgwc|monte carlo|\b501\b|essential|chicago|festive|jlee|boot camp|four-score/.test(t))
    return { key: 'champ', title: 'Turnuva & Şampiyonlar' }
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
  chow: 2, bray: 2, champ: 2, michy: 2, falafel: 2, mochy: 2,
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

// GÜNÜN POZİSYONU — her gün 1 ünlü pozisyon, deterministik (gün indeksi). Havuz = tüm gerçek/ünlü
// pozisyonlar (açılış zarları HARİÇ: onlar "pozisyon" değil). Aynı takvim gününde herkese aynı soru;
// ertesi gün havuzdaki sonraki pozisyon (UTC gün sınırı). Çoğu otoriter XG cevaplı; değilse motor puanlar.
const DAILY_POOL: Question[] = REAL_TIERS.flatMap((tier) =>
  tier.lessons.filter((l) => l.id !== 'rg-open').flatMap((l) => l.questions),
)
export const DAILY_POOL_SIZE = DAILY_POOL.length

export function dailyQuestion(epochMs: number): Question {
  const day = Math.floor(epochMs / 86_400_000)
  const n = DAILY_POOL.length
  return DAILY_POOL[(((day % n) + n) % n)]
}

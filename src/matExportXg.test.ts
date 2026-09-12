import { describe, it, expect } from 'vitest'
import { initialState, cloneState, opponent, gameOutcome } from './engine/board'
import { maximalTerminals, applyStep, boardKey } from './engine/moves'
import { moveNotation } from './engine/notation'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'
import { buildMatXg, buildMat, xgMoves } from './matExport'

// Sabit-seed PRNG -> tekrar-oynanabilir mac (bkz. matExport.test.ts).
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Motorla gercek (legal) tek oyunluk mac uret; kayitlar MoveLogEntry.
function playRealGame(seed: number): MoveLogEntry[] {
  const rng = mulberry32(seed)
  const roll = (): number[] => {
    const a = 1 + Math.floor(rng() * 6)
    const b = 1 + Math.floor(rng() * 6)
    return a === b ? [a, a, a, a] : [a, b]
  }
  const entries: MoveLogEntry[] = []
  let s: GameState = initialState()
  let mover: Player = 'white'
  let seq = 0
  for (let guard = 0; guard < 2000; guard++) {
    const dice = roll()
    s = { ...cloneState(s), turn: mover, dice, diceUsed: dice.map(() => false) }
    const before = cloneState(s)
    const terminals = maximalTerminals(s)
    let played: Step[] = []
    let after = cloneState(s)
    if (terminals.length > 0) {
      const pick = terminals[Math.floor(rng() * terminals.length)]
      played = pick.steps
      after = cloneState(pick.state)
    }
    entries.push({
      notation: moveNotation({ steps: played, resultKey: '' }, mover),
      best: '', loss: 0, pos: before, steps: played, playedSteps: played,
      player: mover, dice: dice.slice(0, 2), seq: seq++,
    })
    if (gameOutcome(after)) break
    after.turn = opponent(mover)
    after.dice = []
    after.diceUsed = []
    s = after
    mover = opponent(mover)
  }
  return entries
}

// XG notasyonunu geri ayristir (XG importerinin yaptigi is): 25 -> bar, 0 -> off.
// Tekrarlar zaten AYRI yazilidir (parantez yok). Beyaz mutlak numara (index=num-1),
// siyah ayna (index=24-num). Vurus (*) yok sayilir.
function parseXg(notation: string, player: Player): Step[] {
  if (!notation) return []
  const steps: Step[] = []
  for (const tok of notation.trim().split(/\s+/)) {
    const m = tok.replace(/\*/g, '').match(/^(25|\d+)\/(\d+)$/)
    if (!m) throw new Error(`gecersiz XG token: "${tok}" (notation="${notation}")`)
    const [, fromS, toS] = m
    const from: number | 'bar' =
      fromS === '25' ? 'bar' : player === 'white' ? parseInt(fromS, 10) - 1 : 24 - parseInt(fromS, 10)
    const to: number | 'off' =
      toS === '0' ? 'off' : player === 'white' ? parseInt(toS, 10) - 1 : 24 - parseInt(toS, 10)
    steps.push({ from, to, die: 0 })
  }
  return steps
}

describe('buildMatXg — Extreme Gammon uyumlu .mat (gercek XG dosyasiyla birebir bicim)', () => {
  it('header blogu + N point match dogru', () => {
    const log = playRealGame(12345)
    const mat = buildMatXg(log, {
      matchLength: 1, whiteName: 'Omer', blackName: 'GnuBot',
      matchId: 'ABC', eventDate: '2026.09.08', eventTime: '21.30',
    })
    expect(mat).toContain('; [Site "TavlaTV"]')
    expect(mat).toContain('; [Match ID "ABC"]')
    expect(mat).toContain('; [Player 1 "Omer"]')
    expect(mat).toContain('; [Player 2 "GnuBot"]')
    expect(mat).toContain('; [EventDate "2026.09.08"]')
    expect(mat).toContain('; [EventTime "21.30"]')
    expect(mat).toContain('; [Crawford "On"]')
    expect(mat).toContain('; [CubeLimit "1024"]')
    // header'dan sonra bos satir + "N point match" + bos satir + " Game 1" (bosluklu)
    expect(mat).toMatch(/; \[CubeLimit "1024"\]\n\n1 point match\n\n Game 1\n/)
    expect(mat).toMatch(/^ Omer : 0\s+GnuBot : 0$/m) // skor satiri BOSLUKLA baslar
  })

  it('hamle satirlari XG paren bicimi "  N)" (nokta DEGIL)', () => {
    const mat = buildMatXg(playRealGame(12345), { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toMatch(/^\s*\d+\) /m) // "  1) ..." paren
    expect(mat).not.toMatch(/^\s*\d+\. /m) // "1. ..." nokta bicimi OLMAMALI
  })

  it('YASAK tokenlar yok: bar/, /off, sikistirma (n)', () => {
    for (const seed of [1, 2, 3, 12345, 777, 999]) {
      const mat = buildMatXg(playRealGame(seed), { matchLength: 1, whiteName: 'A', blackName: 'B' })
      expect(mat, `seed ${seed} bar/`).not.toMatch(/bar\//)
      expect(mat, `seed ${seed} /off`).not.toMatch(/\/off/)
      expect(mat, `seed ${seed} (n)`).not.toMatch(/\/\d+\(\d+\)/)
    }
  })

  it('bear-off 0 ve bar 25 olarak yaziliyor (donusum sadik)', () => {
    expect(xgMoves('bar/20 8/6')).toBe('25/20 8/6')
    expect(xgMoves('6/off 3/off')).toBe('6/0 3/0')
    expect(xgMoves('8/3(2) 20/15')).toBe('8/3 8/3 20/15')
    expect(xgMoves('1/off(3)')).toBe('1/0 1/0 1/0')
    expect(xgMoves('bar/24(2)')).toBe('25/24 25/24')
  })

  it('cift zar dort hamle de acik yazilir', () => {
    const init = initialState()
    const log: MoveLogEntry[] = [
      { notation: '8/4(2) 6/2(2)', best: '', loss: 0, player: 'white', pos: init, dice: [4, 4], playedSteps: [], seq: 0 },
    ]
    const mat = buildMatXg(log, { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('44: 8/4 8/4 6/2 6/2')
    expect(mat).not.toContain('(2)')
  })

  it('notasyon sadik: XG notasyonu geri ayristirilinca playedSteps ile ayni tahta', () => {
    const log = playRealGame(12345)
    for (const e of log) {
      if (!e.player || !e.pos || !e.notation || e.notation === 'pas' || e.notation === 'pass') continue
      const viaXg = cloneState(e.pos)
      for (const st of parseXg(xgMoves(e.notation), e.player)) applyStep(viaXg, st, e.player)
      const viaSteps = cloneState(e.pos)
      for (const st of e.playedSteps ?? []) applyStep(viaSteps, st, e.player)
      expect(boardKey(viaXg)).toBe(boardKey(viaSteps))
    }
  })

  it('sonuc: her oyunda Wins satiri, tekil "point", mac bitince "and the match"', () => {
    for (const seed of [1, 2, 3, 12345, 777, 999]) {
      const mat = buildMatXg(playRealGame(seed), { matchLength: 1, whiteName: 'A', blackName: 'B' })
      expect(mat, `seed ${seed} Wins`).toMatch(/Wins \d+ point/)
      expect(mat, `seed ${seed} points`).not.toContain('points') // TEKIL point
      // Kazanan sol -> "      Wins ..." ayri satir; kazanan sag -> "  N)  Losses ...  Wins ..."
      const leftWin = / {6}Wins \d+ point/.test(mat)
      const rightWin = /^\s*\d+\)\s+Losses \d+ point\s+Wins \d+ point/m.test(mat)
      expect(leftWin || rightWin, `seed ${seed} sonuc bicimi`).toBe(true)
    }
    expect(buildMatXg(playRealGame(12345), { matchLength: 1, whiteName: 'A', blackName: 'B' })).toContain('and the match')
  })

  it('cok oyunlu: skor onceki oyunlarin sonucundan birikir', () => {
    const mat = buildMatXg([...playRealGame(12345), ...playRealGame(2)], { matchLength: 7, whiteName: 'A', blackName: 'B' })
    const games = mat.split('\n').filter((l) => /^ Game \d+$/.test(l))
    expect(games).toEqual([' Game 1', ' Game 2'])
    const scoreLines = mat.split('\n').filter((l) => /^ A : \d+\s+B : \d+$/.test(l))
    expect(scoreLines[0]).toMatch(/^ A : 0\s+B : 0$/) // 1. oyun 0-0
    expect(scoreLines[1]).not.toMatch(/^ A : 0\s+B : 0$/) // 2. oyun skor birikti
  })
})

// ---------------------------------------------------------------------------
// SONUC SATIRI GARANTISI: tamamlanmis her oyun MUTLAKA Wins/Losses satiri alir,
// gerekiyorsa "and the match". Kritik regresyon: analiz logu zorunlu (tek-legal)
// bitiren-hamleyi ATLAR -> logdaki son hamle terminal DEGILdir -> tahta-tekrari
// sonuc bulamaz. O bosluk otoriter `results` diziyle doldurulur (bkz. buildMatXg).
// ---------------------------------------------------------------------------
describe('buildMatXg — oyun sonu (Wins/Losses) garantisi + gercek puan + "and the match"', () => {
  const zeros = () => new Array(24).fill(0)
  const mk = (o: Partial<GameState>): GameState => ({
    points: o.points ?? zeros(),
    bar: o.bar ?? { white: 0, black: 0 },
    off: o.off ?? { white: 0, black: 0 },
    turn: o.turn ?? 'white',
    dice: o.dice ?? [],
    diceUsed: o.diceUsed ?? [],
  })
  // Beyaz kazanan terminal tahta (off.white=15). mult: 1 normal (kaybeden 1 tas topladi),
  // 2 gammon (hic toplamadi, bar/ev yok), 3 backgammon (barda tas var).
  const whiteWin = (mult: 1 | 2 | 3): GameState => {
    const points = zeros()
    const off = { white: 15, black: mult === 1 ? 1 : 0 }
    const bar = { white: 0, black: mult === 3 ? 1 : 0 }
    points[12] = -(15 - off.black - bar.black) // kalan siyah taslar 13. ucgende (siyah=negatif)
    return mk({ points, off, bar })
  }
  // Siyah kazanan terminal tahta (off.black=15, kaybeden beyaz 1 tas topladi -> mult 1).
  const blackWin = (): GameState => {
    const points = zeros()
    points[11] = 14 // beyaz (pozitif) 12. ucgende
    return mk({ points, off: { white: 1, black: 15 }, turn: 'black' })
  }
  const move = (pos: GameState, player: Player, playedSteps: Step[] = []): MoveLogEntry => ({
    notation: '2/off', best: '', loss: 0, player, pos, playedSteps, dice: [2, 1], seq: 100,
  })
  const cube = (chosen: 'double' | 'take' | 'drop', player: Player, seq: number): MoveLogEntry => ({
    notation: '', best: '', loss: 0, player, seq,
    cube: { win: 0.5, equity: 0, recommended: chosen, chosen, correct: true },
  })
  const winLine = (mat: string) =>
    / {6}Wins \d+ point/.test(mat) || /^\s*\d+\)\s+Losses \d+ point\s+Wins \d+ point/m.test(mat)

  it('normal win: kazanan sol sutunda -> "      Wins 1 point"', () => {
    const mat = buildMatXg([move(whiteWin(1), 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toMatch(/ {6}Wins 1 point/)
    expect(mat).not.toContain('and the match') // 1 < 5 -> mac bitmedi
  })

  it('gammon: kaybeden hic toplamadi -> "Wins 2 point"', () => {
    const mat = buildMatXg([move(whiteWin(2), 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Wins 2 point')
    expect(mat).not.toContain('points') // tekil
  })

  it('backgammon: kaybedenin barda tasi -> "Wins 3 point"', () => {
    const mat = buildMatXg([move(whiteWin(3), 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Wins 3 point')
  })

  // REGRESYON (OmerOzsoy 1-point dosyasi): 1-point match'te gammon (2) MAC HEDEFINI asamaz ->
  // "Wins 1 point and the match". ASLA "Wins 2 point" (match play'de hedefin otesine puan yazilmaz).
  it('1-point match: gammon bile 1 puana kirpilir -> "Wins 1 point and the match"', () => {
    const mat = buildMatXg([move(whiteWin(2), 'white')], { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Wins 1 point and the match')
    expect(mat).not.toContain('Wins 2 point')
  })

  it('kup ile biten oyun: Doubles/Takes -> puan kup ile carpilir (2)', () => {
    const log = [cube('double', 'white', 0), cube('take', 'black', 1), move(whiteWin(1), 'white')]
    const mat = buildMatXg(log, { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Doubles => 2')
    expect(mat).toContain('Takes')
    expect(mat).toMatch(/ {6}Wins 2 point/) // 1 (mult) × 2 (kup)
  })

  it('kup girinti: SOL sutunda Doubles/Takes bir bosluk girintili (referans XG ile birebir)', () => {
    // Beyaz katlar (SOL sutun) -> " Doubles => 2"; siyah kabul (SAG sutun) -> "Takes" (girintisiz).
    const wDouble = buildMatXg([cube('double', 'white', 0), cube('take', 'black', 1), move(whiteWin(1), 'white')],
      { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(wDouble).toMatch(/^\s*\d+\)  Doubles => 2 {2,}Takes$/m) // sol " Doubles", sag "Takes" girintisiz
    // Siyah katlar (SAG sutun) -> "Doubles => 2" girintisiz; beyaz kabul (SOL) -> " Takes".
    const bDouble = buildMatXg([cube('double', 'black', 0), cube('take', 'white', 1), move(whiteWin(1), 'white')],
      { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(bDouble).toMatch(/^\s*\d+\)  Takes\b/m) // beyaz kabul SOL sutunda bir bosluk girintili
    // HAMLE satiri ASLA girintili degil (sol sutun hamlesi paren+tek bosluktan hemen sonra baslar)
    expect(bDouble).toMatch(/^\s*\d+\) \d{2}: /m)
  })

  it('kazanan SAG sutunda (siyah): "  N)  Losses 1 point   Wins 1 point"', () => {
    const mat = buildMatXg([move(blackWin(), 'black')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toMatch(/^\s*\d+\)\s+Losses 1 point\s+Wins 1 point/m)
  })

  it('maci bitiren oyun: kazanan mac puanina ulasti -> "and the match"', () => {
    const mat = buildMatXg([move(whiteWin(1), 'white')], { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Wins 1 point and the match')
  })

  it('mac uzunlugu HARD-CODE degil: log mctx.matchLen otoriter (yanlis opts.matchLength=1 -> 3 point match)', () => {
    // MatchAnalytics gibi caller matchLength gecmese/1 gecse bile, log'a gomulu gercek uzunluk yazilir.
    const e: MoveLogEntry = {
      notation: '2/off', best: '', loss: 0, player: 'white', pos: whiteWin(1), playedSteps: [], dice: [2, 1], seq: 0,
      mctx: { score: { white: 0, black: 0 }, cube: 1, cubeOwner: null, crawford: false, matchLen: 3 },
    }
    const mat = buildMatXg([e], { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('3 point match')
    expect(mat).not.toContain('1 point match')
    // 3 puanlik macta 1 puanlik galibiyet maci BITIRMEZ -> "and the match" YOK
    expect(mat).not.toContain('and the match')
  })

  it('mctx yoksa opts.matchLength kullanilir (geriye donuk uyum)', () => {
    const mat = buildMatXg([move(whiteWin(1), 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('5 point match')
  })

  // REGRESYON (ÖmerDOĞAN_NeuralAI "Wins 8 point" bug'ı): matchResult (maç-skoru farkı) ARTIK
  // puan üretmez. Tahta+results YOKken SON oyun sonuçsuz kalır ama ASLA imkânsız/keyfi bir puan
  // yazılmaz. Eski davranış (finalScore − birikeni) 7-puanlık küpsüz maçta "Wins 8 point" gibi
  // cube×winType OLMAYAN değerler üretiyordu.
  it('matchResult (skor farkı) ile İMKÂNSIZ puan ÜRETİLMEZ (Wins 8 point regresyonu)', () => {
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    const mat = buildMatXg([move(nonTerminal, 'white')], {
      matchLength: 3, whiteName: 'A', blackName: 'B',
      matchResult: { winner: 'black', score: { white: 0, black: 4 } }, // eskiden "Wins 4 point" (İMKÂNSIZ)
    })
    expect(winLine(mat)).toBe(false) // keyfi puan yerine sonuç satırı YOK
    expect(mat).not.toMatch(/Wins 4 point/)
  })

  it('matchResult tümüyle YOK SAYILIR: tahta otoritesi puanı belirler (skor farkı sızmaz)', () => {
    // Tahta terminal -> gerçek sonuç (1 puan). matchResult ne derse desin okunmaz.
    const mat = buildMatXg([move(whiteWin(1), 'white')], {
      matchLength: 5, whiteName: 'A', blackName: 'B',
      matchResult: { winner: 'black', score: { white: 0, black: 99 } },
    })
    expect(mat).toMatch(/ {6}Wins 1 point/) // tahta otoritesi korunur
    expect(mat).not.toContain('99')
  })

  // KÖK-NEDEN GARANTİSİ (ÖmerDOĞAN_NeuralAI Game 1-3): son-OLMAYAN bir oyun sonuçsuz kalırsa
  // (bir sonraki oyun başlıyor ama önceki sonuç null) export SESSİZCE bozuk .mat üretmez —
  // HATA fırlatır (user direktifi: "hata logla ve export'u durdur").
  it('son-olmayan oyun sonuçsuzsa export DURUR (hata fırlatır)', () => {
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    const twoGames: MoveLogEntry[] = [
      move(nonTerminal, 'white'), // Game 1: bitiren hamle logda yok + results yok -> null
      { ...move(nonTerminal, 'white'), pos: initialState() }, // Game 2: açılış tahtası -> yeni oyun
    ]
    expect(() => buildMatXg(twoGames, { matchLength: 5, whiteName: 'A', blackName: 'B' })).toThrow(/Game 1 sonuçsuz/)
  })

  it('REGRESYON: logdaki son hamle terminal DEGILse (zorunlu bitiren-hamle atlanmis) results olmadan sonuc satiri YOK', () => {
    // Bear-off ortasi, oyun bitmemis gorunur (off.white=13<15) -> tahta-tekrari null.
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    const mat = buildMatXg([move(nonTerminal, 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(winLine(mat)).toBe(false) // iste tavlatv-mac(12).mat bug'i: sonuc satiri yazilmiyordu
  })

  it('FIX: ayni terminal-olmayan log + otoriter results -> sonuc satiri MUTLAKA yazilir', () => {
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    const log = [move(nonTerminal, 'white')]
    const mat = buildMatXg(log, {
      matchLength: 5, whiteName: 'A', blackName: 'B',
      results: [{ winner: 'white', points: 2 }],
    })
    expect(winLine(mat)).toBe(true)
    expect(mat).toMatch(/ {6}Wins 2 point/)
  })

  it('FIX: results ile maci bitiren oyunda "and the match"', () => {
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    const mat = buildMatXg([move(nonTerminal, 'white')], {
      matchLength: 2, whiteName: 'A', blackName: 'B',
      results: [{ winner: 'white', points: 2 }],
    })
    expect(mat).toContain('Wins 2 point and the match') // sw=2 >= 2
  })

  it('results yalnizca oyun sayisiyla BIREBIR eslesirse fallback olur (kayik dizi kullanilmaz)', () => {
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    // 1 oyun ama 2 sonuc -> eslesmiyor -> fallback YOK -> sonuc satiri yok (yanlis veri riski onlenir)
    const mat = buildMatXg([move(nonTerminal, 'white')], {
      matchLength: 5, whiteName: 'A', blackName: 'B',
      results: [{ winner: 'black', points: 9 }, { winner: 'white', points: 9 }],
    })
    expect(winLine(mat)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TUR-SIRASI: fill (zorunlu/dance) girdileri + mükerrer-tur dedup. tavlatv-mac(18) bug'ı:
// bear-off sonunda benim ZORUNLU toplamalarım matchLog'a girmiyordu -> rakibin hamleleri sol
// kolon BOŞ kalarak üst üste biniyordu ve XG son hamleleri parse edemiyordu. Ayrıca online
// çift-yazım aynı hamleyi iki satır yapıyordu.
// ---------------------------------------------------------------------------
describe('buildMatXg — fill (zar korunur) + mükerrer-tur dedup; native buildMat fill\'i süzer', () => {
  const zeros = () => new Array(24).fill(0)
  const nonTerm: GameState = {
    points: (() => { const p = zeros(); p[5] = 2; p[12] = -2; return p })(),
    bar: { white: 0, black: 0 }, off: { white: 0, black: 0 }, turn: 'white', dice: [], diceUsed: [],
  }
  const e = (o: Partial<MoveLogEntry>): MoveLogEntry =>
    ({ notation: '', best: '', loss: 0, pos: nonTerm, playedSteps: [], ...o })

  it('fill turları XG\'de ZAR+SIRA korur (dance -> "54:", forced -> "31: 2/1"); sol kolon boş kalmaz', () => {
    const log: MoveLogEntry[] = [
      e({ notation: '13/8 24/22', player: 'white', dice: [5, 2], seq: 0 }),
      e({ notation: '6/1 8/4', player: 'black', dice: [6, 1], seq: 1 }),
      e({ notation: '', player: 'white', dice: [5, 4], seq: 2, fill: true }), // dance (oynayamadı)
      e({ notation: '6/2 7/5', player: 'black', dice: [4, 2], seq: 3 }),
      e({ notation: '2/1', player: 'white', dice: [3, 1], seq: 4, fill: true }), // zorunlu tek hamle
      e({ notation: '19/16 16/10', player: 'black', dice: [3, 6], seq: 5 }),
    ]
    const mat = buildMatXg(log, { matchLength: 3, whiteName: 'A', blackName: 'B' })
    // dance: sol kolonda "54:" (zar VAR, hamle YOK) — kesinlikle BOŞ değil
    expect(mat).toMatch(/^\s*\d+\) 54: {2,}42: 6\/2 7\/5/m)
    // forced: sol kolonda "31: 2/1"; sağ zar [3,6] KANONİK "63" (yüksek önce; hamleler değişmez)
    expect(mat).toMatch(/^\s*\d+\) 31: 2\/1 {2,}63: 19\/16 16\/10/m)
    // native buildMat fill'i SÜZER -> luck yolu değişmez (dance "54:" satırı native'de YOK)
    const native = buildMat(log, { matchLength: 3, whiteName: 'A', blackName: 'B' })
    expect(native).not.toContain('54:')
    expect(native).not.toContain('31: 2/1')
  })

  it('mükerrer tur (aynı oyuncu+seq) TEK satıra iner (online çift-yazım / fill örtüşmesi)', () => {
    const log: MoveLogEntry[] = [
      e({ notation: '24/23', player: 'white', dice: [3, 1], seq: 5 }),
      e({ notation: '24/23', player: 'white', dice: [3, 1], seq: 5 }), // DUPLICATE
      e({ notation: '10/8 8/7', player: 'black', dice: [2, 1], seq: 6 }),
    ]
    const mat = buildMatXg(log, { matchLength: 3, whiteName: 'A', blackName: 'B' })
    expect((mat.match(/31: 24\/23/g) || []).length).toBe(1) // yalnız BİR kez
    expect(mat).toMatch(/^\s*\d+\) 31: 24\/23 {2,}21: 10\/8 8\/7/m) // sol+sağ tek satır
  })

  it('dedup BİLGİ taşıyanı korur: boş mükerrer, dolu hamleyi ezmez', () => {
    const log: MoveLogEntry[] = [
      e({ notation: '', player: 'white', dice: [3, 1], seq: 5, fill: true }), // önce boş fill
      e({ notation: '24/23', player: 'white', dice: [3, 1], seq: 5 }),        // sonra gerçek hamle
      e({ notation: '10/8', player: 'black', dice: [2, 1], seq: 6 }),
    ]
    const mat = buildMatXg(log, { matchLength: 3, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('31: 24/23') // dolu hamle korundu
  })
})

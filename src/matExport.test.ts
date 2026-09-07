import { describe, it, expect } from 'vitest'
import { initialState, cloneState, opponent, gameOutcome } from './engine/board'
import { maximalTerminals } from './engine/moves'
import { applyStep, boardKey } from './engine/moves'
import { moveNotation } from './engine/notation'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'
import { buildMat } from './matExport'

// Basit tekrar-uretilebilir PRNG (mulberry32) — seed sabit -> her calismada ayni mac.
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

// Motorla GERCEK (legal) tek oyunluk mac uret: her tur zar at, legal tam hamlelerden
// birini sec, uygula; biri tum taslarini toplayana kadar. Kayitlar MoveLogEntry seklinde.
function playRealGame(
  seed: number,
  cube?: { atSeq: number; response: 'take' | 'drop' },
): MoveLogEntry[] {
  const rng = mulberry32(seed)
  const roll = (): number[] => {
    const a = 1 + Math.floor(rng() * 6)
    const b = 1 + Math.floor(rng() * 6)
    return a === b ? [a, a, a, a] : [a, b]
  }
  const cubeEntry = (player: Player, chosen: 'double' | 'take' | 'drop', pos: GameState, seq: number): MoveLogEntry => ({
    notation: '', best: '', loss: 0, player, pos, seq,
    cube: { win: 0, equity: 0, recommended: chosen, chosen, correct: true },
  })
  const entries: MoveLogEntry[] = []
  let s: GameState = initialState() // turn = white
  let mover: Player = 'white'
  let seq = 0
  for (let guard = 0; guard < 2000; guard++) {
    const dice = roll()
    s = { ...cloneState(s), turn: mover, dice, diceUsed: dice.map(() => false) }
    const before = cloneState(s)
    // Kup enjeksiyonu: beyaz tur basinda katlar, siyah cevaplar (test icin iki tarafli kayit).
    if (cube && mover === 'white' && seq === cube.atSeq) {
      entries.push(cubeEntry('white', 'double', before, seq))
      entries.push(cubeEntry('black', cube.response, before, seq))
      if (cube.response === 'drop') break // siyah pas -> beyaz kazanir, oyun biter
    }
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
      best: '',
      loss: 0,
      pos: before,
      steps: played,
      playedSteps: played,
      player: mover,
      dice: dice.slice(0, 2), // gosterim: iki zar (cift ise [d,d])
      seq: seq++,
    })
    if (gameOutcome(after)) break
    // sirayi devret
    after.turn = opponent(mover)
    after.dice = []
    after.diceUsed = []
    s = after
    mover = opponent(mover)
  }
  return entries
}

// .mat notasyonunu geri ayristir (GNU BG importerinin yaptigi is) -> step'ler.
// Beyaz mutlak numara (index = num-1); siyah ayna (index = 24-num). bar/off dogrudan.
function parseNotation(notation: string, player: Player): Step[] {
  if (!notation || notation === 'pass' || notation === 'pas') return []
  const steps: Step[] = []
  for (const tok of notation.trim().split(/\s+/)) {
    const m = tok.match(/^(bar|\d+)\/(off|\d+)(?:\((\d+)\))?$/)
    if (!m) throw new Error(`gecersiz token: "${tok}" (notation="${notation}")`)
    const [, fromS, toS, cntS] = m
    const cnt = cntS ? parseInt(cntS, 10) : 1
    const from: number | 'bar' =
      fromS === 'bar' ? 'bar' : player === 'white' ? parseInt(fromS, 10) - 1 : 24 - parseInt(fromS, 10)
    const to: number | 'off' =
      toS === 'off' ? 'off' : player === 'white' ? parseInt(toS, 10) - 1 : 24 - parseInt(toS, 10)
    for (let i = 0; i < cnt; i++) steps.push({ from, to, die: 0 })
  }
  return steps
}

describe('buildMat — gercek maci .mat olarak uret + dogrula', () => {
  it('bir oyunu uretip .mat yazar; notasyon sadik ve tekrar-oynanabilir', () => {
    const log = playRealGame(12345)
    expect(log.length).toBeGreaterThan(10)

    const mat = buildMat(log, { matchLength: 1, whiteName: 'Omer', blackName: 'GnuBot' })

    // --- Yapisal kontroller ---
    expect(mat.startsWith('1 point match')).toBe(true) // ilk satir, onunde yorum yok
    expect(mat).not.toContain(' pas') // dance turlari sadece zar, "pas" token'i yok
    expect(mat).toContain(' Game 1')
    expect(mat).toMatch(/Omer : 0\s+GnuBot : 0/)
    expect(mat).toMatch(/Wins \d+ point/)

    // --- Notasyon sadakati: her hamlenin .mat notasyonunu geri ayristir, motorla
    //     oyna, playedSteps ile AYNI tahtaya varmali (gnubg importunun yapacagi is). ---
    for (const e of log) {
      if (!e.player || !e.pos) continue
      const viaNotation = cloneState(e.pos)
      for (const st of parseNotation(e.notation, e.player)) applyStep(viaNotation, st, e.player)
      const viaSteps = cloneState(e.pos)
      for (const st of e.playedSteps ?? []) applyStep(viaSteps, st, e.player)
      expect(boardKey(viaNotation)).toBe(boardKey(viaSteps))
    }

    // --- Baslangictan tum maci playedSteps ile yeniden oyna -> gecerli bir sonuc. ---
    const replay = initialState()
    let mover: Player = log[0].player!
    for (const e of log) {
      replay.turn = e.player!
      for (const st of e.playedSteps ?? []) applyStep(replay, st, e.player!)
      mover = e.player!
    }
    const oc = gameOutcome(replay)
    expect(oc).not.toBeNull()
    expect(oc!.winner).toBe(mover) // son hamleyi oynayan kazanir (tas topladi)
  })

  it('kup: cift tarafli double+take ayni satirda, deger 2->4 ilerler', () => {
    const init = initialState()
    const mid = cloneState(init)
    mid.points[23] = 1 // acilis dizilimi olmasin (isOpening false)
    const c = (player: Player, chosen: 'double' | 'take' | 'drop'): MoveLogEntry => ({
      notation: '', best: '', loss: 0, player, pos: mid, seq: 1,
      cube: { win: 0, equity: 0, recommended: chosen, chosen, correct: true },
    })
    const log: MoveLogEntry[] = [
      { notation: '8/5 6/5', best: '', loss: 0, player: 'white', pos: init, dice: [3, 1], playedSteps: [], seq: 0 },
      c('white', 'double'), c('black', 'take'), // cube -> 2
      c('black', 'double'), c('white', 'take'), // cube -> 4
    ]
    const mat = buildMat(log, { matchLength: 7, whiteName: 'W', blackName: 'B' })
    expect(mat).toMatch(/Doubles => 2\s+Takes/) // beyaz teklif + siyah kabul ayni satir
    expect(mat).toContain('Doubles => 4') // yeniden katlama dogru degeri gosterir
  })

  it('kup drop: teklif eden kazanir, puan mac uzunluguna kirpilir', () => {
    const init = initialState()
    const mid = cloneState(init)
    mid.points[23] = 1
    const log: MoveLogEntry[] = [
      { notation: '8/5 6/5', best: '', loss: 0, player: 'white', pos: init, dice: [3, 1], playedSteps: [], seq: 0 },
      { notation: '', best: '', loss: 0, player: 'white', pos: mid, seq: 1, cube: { win: 0, equity: 0, recommended: 'double', chosen: 'double', correct: true } },
      { notation: '', best: '', loss: 0, player: 'black', pos: mid, seq: 1, cube: { win: 0, equity: 0, recommended: 'drop', chosen: 'drop', correct: true } },
    ]
    const mat = buildMat(log, { matchLength: 1, whiteName: 'W', blackName: 'B' })
    expect(mat).toContain('Drops')
    expect(mat).toMatch(/ {6}Wins 1 point/) // beyaz (sol sutun) kazanir, 1 puana kirpili
  })

  // .mat satirlarini hucrelere ayir: sol sutun = beyaz, sag sutun = siyah (COLW=34,
  // "NNN) " onEki 5 karakter). XG/gnubg sirayi SUTUNDAN cikardigi icin hucre dizisi
  // kesintisiz W,B,W,B... gitmeli; gitmezse "The game contains some invalid moves".
  const actors = (mat: string): string[] => {
    const out: string[] = []
    for (const line of mat.split('\n')) {
      if (!/^\s*\d+\)\s/.test(line)) continue
      const left = line.slice(5, 5 + 34).trim()
      const right = line.slice(5 + 34).trim()
      if (left) out.push('W')
      if (right) out.push('B')
    }
    return out
  }
  const alternates = (seq: string[]): boolean => seq.every((p, i) => i === 0 || p !== seq[i - 1])

  const midPos = () => {
    const mid = cloneState(initialState())
    mid.points[23] = 1 // acilis dizilimi olmasin (isOpening false -> yeni oyun baslatmaz)
    return mid
  }
  const mkMove = (player: Player, notation: string, seq: number, pos = midPos()): MoveLogEntry => ({
    notation, best: '', loss: 0, player, pos, dice: [3, 1], playedSteps: [], seq,
  })
  const mkCube = (player: Player, chosen: 'double' | 'take' | 'drop', seq: number): MoveLogEntry => ({
    notation: '', best: '', loss: 0, player, pos: midPos(), seq,
    cube: { win: 0, equity: 0, recommended: chosen, chosen, correct: true },
  })

  // ONLINE: her istemci yalniz KENDI renginin girdilerini yazar; App birlestirmeyi
  // [...benimkiler, ...rakibinkiler] seklinde ARDISIK yapar ve sirayi seq'e birakir.
  // Kup girdileri o turun hamlesiyle AYNI seq'i tasidigindan (seq = turnsPlayed) esit
  // seq'te dogal sira "teklifim, hamlem, rakibin kabulu" olur -> Doubles cevapsiz kalir
  // ve sutunlar bir kayar (XG: invalid moves). buildMat ikincil siralamayla duzeltir.
  it('online birlesik log: kup hamleyle ayni seq olsa da Doubles/Takes cift kalir', () => {
    const mine = [mkMove('white', '8/5 6/5', 0), mkCube('white', 'double', 2), mkMove('white', '13/10 13/11', 2)]
    const theirs = [mkMove('black', '8/5 6/5', 1), mkCube('black', 'take', 2), mkMove('black', '24/23 13/9', 3)]
    const mat = buildMat([...mine, ...theirs], { matchLength: 3, whiteName: 'W', blackName: 'B' })
    expect(mat).toMatch(/Doubles => 2\s+Takes/) // ayni satirda cift
    expect(alternates(actors(mat))).toBe(true) // sutun almasigi bozulmamis
  })

  // Rakibin istemcisi senkron gonderemezse yanit hic gelmeyebilir. Askida kalan
  // "Doubles" dosyayi bozar -> oyun devam ettigine gore Takes URETILIR.
  it('eksik kayit: cevapsiz Doubles icin Takes uretilir', () => {
    const log: MoveLogEntry[] = [
      mkMove('white', '8/5 6/5', 0, initialState()),
      mkMove('black', '8/5 6/5', 1),
      mkCube('white', 'double', 2),
      mkMove('white', '13/10 13/11', 2),
      mkMove('black', '24/23 13/9', 3),
    ]
    const mat = buildMat(log, { matchLength: 3, whiteName: 'W', blackName: 'B' })
    expect(mat).toMatch(/Doubles => 2\s+Takes/)
    expect(alternates(actors(mat))).toBe(true)
  })

  // Ters yon: yalniz KENDI kabulum senkronlandi, rakibin teklifi kayip -> teklif URETILIR
  // (kup degeri korunur, satir cifti tamamlanir).
  it('eksik kayit: teklifsiz Takes icin Doubles uretilir', () => {
    const log: MoveLogEntry[] = [
      mkMove('white', '8/5 6/5', 0, initialState()),
      mkCube('white', 'take', 1),
      mkMove('black', '24/23 13/9', 1),
    ]
    const mat = buildMat(log, { matchLength: 3, whiteName: 'W', blackName: 'B' })
    // Siyah katladiginda cift AYNI satirda olmaz: teklif sag sutun, kabul bir sonraki
    // satirin sol sutunu. Onemli olan ikisinin de yazilmasi ve sutun almasiginin korunmasi.
    expect(mat).toContain('Doubles => 2') // teklif siyah adina uretildi
    expect(mat).toContain('Takes')
    expect(alternates(actors(mat))).toBe(true)
  })

  // seq = turnsPlayed ve turnsPlayed HER OYUNDA sifirlanir (App.nextGame -> resetGameUi), log
  // ise mac boyunca birikir. Tum log'u TEK seq'le siralamak oyunlari IC ICE gecirirdi: dosyada
  // once N-1 tane BOS "Game" basligi, sonra tum hamleler tek dev bozuk oyunda. Online sekli
  // ([...benim girdilerim, ...rakibinkiler]) ile test edilir — en zor hali.
  it('cok oyunlu: seq her oyunda sifirlansa da oyunlar dogru bolunur', () => {
    const mine = [
      mkMove('white', '8/5 6/5', 0, initialState()), // oyun 1
      mkMove('white', '13/10 13/11', 2),
      mkMove('white', '24/23 13/9', 1), // oyun 2 (seq bastan basladi)
    ]
    const theirs = [
      mkMove('black', '24/23 13/9', 1), // oyun 1
      mkMove('black', '8/5 6/5', 0, initialState()), // oyun 2 (siyah basliyor)
    ]
    const mat = buildMat([...mine, ...theirs], { matchLength: 3, whiteName: 'W', blackName: 'B' })
    const headers = mat.split('\n').filter((l) => /^ Game \d+$/.test(l))
    expect(headers).toEqual([' Game 1', ' Game 2'])
    // Hicbir oyun BOS olmamali: "Game N" + skor satirinin ardindan hamle satiri gelmeli
    const lines = mat.split('\n')
    lines.forEach((l, i) => {
      if (/^ Game \d+$/.test(l)) expect(lines[i + 2]).toMatch(/^\s*\d+\)/)
    })
    expect(alternates(actors(mat))).toBe(true)
    // Her hamle KENDI oyununda olmali (eski hata: oyun 1'in devami oyun 2'ye kayiyordu)
    const rowsOf = (g: number) => {
      const from = lines.indexOf(` Game ${g}`)
      const to = lines.findIndex((l, i) => i > from && /^ Game \d+$/.test(l))
      return lines.slice(from, to < 0 ? lines.length : to).filter((l) => /^\s*\d+\)/.test(l))
    }
    expect(rowsOf(1)).toEqual([
      '  1) 31: 8/5 6/5                       31: 24/23 13/9',
      '  2) 31: 13/10 13/11',
    ])
    expect(rowsOf(2)).toEqual([
      '  1)                                   31: 8/5 6/5',
      '  2) 31: 24/23 13/9',
    ])
  })

  it('kup take: gercek oyuna double+take enjekte edilir, notasyon+kup tutarli', () => {
    const log = playRealGame(777, { atSeq: 6, response: 'take' })
    const mat = buildMat(log, { matchLength: 5, whiteName: 'Omer', blackName: 'GnuBot' })
    expect(mat).toMatch(/Doubles => 2\s+Takes/)
    // GNU Backgammon 1.08 ile import edildi: "Cube: 2", 0 hata (bkz. mat-export-gnubg hafiza).
    for (const e of log) {
      if (!e.player || !e.pos) continue
      const viaNotation = cloneState(e.pos)
      for (const st of parseNotation(e.notation, e.player)) applyStep(viaNotation, st, e.player)
      const viaSteps = cloneState(e.pos)
      for (const st of e.playedSteps ?? []) applyStep(viaSteps, st, e.player)
      expect(boardKey(viaNotation)).toBe(boardKey(viaSteps))
    }
  })
})

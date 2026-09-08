// Mac kaydini .mat formatinda uret. IKI hedef var, IKI ayri fonksiyon:
//
//  1) buildMat()   -> GNU Backgammon (gnubg) NATIVE .mat. Sunucudaki luck analizi (Tavlai
//     Luck V1) ve testler bunu kullanir. gnubg'nin OKUDUGU notasyon: `bar/20`, `6/off`,
//     `8/3(2)` (tekrar parantezle), `Wins N points` (cogul). BU CIKTI DEGISTIRILMEMELI —
//     App.tsx bunu backend'e gonderip gnubg ile luck cikariyor; bicim bozulursa luck bozulur.
//
//  2) buildMatXg() -> Extreme Gammon (XG) uyumlu .mat (kullanici "Disa aktar" indirmesi).
//     XG'nin DILI gnubg'den FARKLI: bar = `25`, bear-off = `0`, tekrarlar AYRI yazilir
//     (parantez YOK), oyun sonu iki-sutun numarali "Losses/Wins N point" satiri, ust tarafta
//     `; [Site ...]` header blogu, tek "point" (cogul degil), mac biterse "and the match".
//     gnubg'nin `25/`,`/0` notasyonunu OKUYAMADIGI icin bu ciktiyi ASLA gnubg'ye verme.
//
// Oyunlar acilis dizilimi tespitiyle bolunur; kup girdileri (Doubles/Takes/Drops) ve online
// birlestirilmis log'un sira/eksik-kayit ozel durumlari ORTAK cozulur (asagidaki helper'lar).
//
// .mat iki SUTUNLU: her satirda once sol (beyaz/Player1) sonra sag (siyah/Player2) eylem
// gelir; okuyucu sirayi sutunlardan cikarir. Bu yuzden eylem dizisi almasik olmali ve her
// "Doubles" ile ayni satirda rakibin "Takes"/"Drops" cevabi bulunmali. Log'da bu iki sarti
// bozan iki gercek durum (online birlesik log sirasi + eksik senkron kaydi) helper'larda onarilir.
import type { MoveLogEntry } from './storage'
import type { Player } from './engine/types'
import { initialState, cloneState, gameOutcome, opponent } from './engine/board'
import { applyStep } from './engine/moves'

export interface MatOptions {
  matchLength?: number // .mat basligi ( or. "3 point match")
  whiteName?: string
  blackName?: string
}

// XG header'i icin ek alanlar. Verilmezse makul varsayilanlar kullanilir.
export interface MatXgOptions extends MatOptions {
  site?: string // ; [Site "..."]           varsayilan TavlaTV
  matchId?: string // ; [Match ID "..."]     varsayilan "0"
  eventDate?: string // ; [EventDate "..."]  "YYYY.MM.DD"
  eventTime?: string // ; [EventTime "..."]  "HH.MM"
  crawford?: boolean // ; [Crawford "On/Off"] varsayilan true (On)
}

// Bir oyundaki tek eylem. e yoksa ONARILMIS (log'da eksik olup oyunun akisindan
// zorunlu olarak cikan) kup satiridir.
type Act =
  | { kind: 'move'; player: Player; e: MoveLogEntry }
  | { kind: 'double' | 'take' | 'drop'; player: Player; e?: MoveLogEntry }

const INIT = initialState().points

// ---------------------------------------------------------------------------
// ORTAK ANALIZ (gnubg + XG ayni oyun bolme / kup / sonuc mantigini kullanir)
// ---------------------------------------------------------------------------

// Acilis dizilimi mi? (yeni oyunun ilk hamlesi: taslar baslangicta, bar/off bos)
function isOpening(e: MoveLogEntry): boolean {
  const p = e.pos
  if (!p || e.cube) return false
  if (p.bar.white || p.bar.black || p.off.white || p.off.black) return false
  return p.points.length === 24 && p.points.every((v, i) => v === INIT[i])
}

// Log'u oyunlara bol. Her girdinin OYUN numarasi cikarilir (bir oyuncunun kendi turlari o oyun
// icinde 0,2,4... diye ARTAR; seq'in DUSUP 0/1'e inmesi ancak yeni oyunun ilk turunda olur).
// (oyun, seq)'e gore sirala (async bot kayitlari dogru yere otursun) + oyunlara bol.
// AYNI seq icinde: teklif (0) < yanit (1) < hamle (2).
function splitGames(log: MoveLogEntry[]): MoveLogEntry[][] {
  const entries = log.filter((e) => e.player)
  const gameNoOf = new Map<number, number>()
  {
    const last: Partial<Record<Player, number>> = {}
    const g: Record<Player, number> = { white: 0, black: 0 }
    entries.forEach((e, i) => {
      const p = e.player as Player
      const s = e.seq ?? i
      const prev = last[p]
      if (prev !== undefined && s < prev && s <= 1) g[p] += 1
      last[p] = s
      gameNoOf.set(i, g[p])
    })
  }
  const rank = (e: MoveLogEntry): number => (!e.cube ? 2 : e.cube.chosen === 'double' ? 0 : 1)
  const gn = (i: number): number => gameNoOf.get(i) ?? 0
  const seqAll = entries
    .map((e, i) => ({ e, i }))
    .sort(
      (a, b) =>
        gn(a.i) - gn(b.i) ||
        (a.e.seq ?? a.i) - (b.e.seq ?? b.i) ||
        rank(a.e) - rank(b.e) ||
        a.i - b.i,
    )
  const games: MoveLogEntry[][] = []
  let prevG = -1
  for (const { e, i } of seqAll) {
    const g = gn(i)
    if (isOpening(e) || g !== prevG || games.length === 0) games.push([])
    prevG = g
    games[games.length - 1].push(e)
  }
  return games
}

// Oyunun eylem dizisi: kup satirlari CIFTLENIR. Cikan dizide her teklifin hemen ardindan
// rakibin yaniti gelir -> sutun almasigi bozulmaz. Eksik teklif/yanit oyunun akisindan uretilir.
function actsOf(game: MoveLogEntry[]): Act[] {
  const raw: Act[] = []
  for (const e of game) {
    if (!e.player) continue
    if (e.cube) {
      const c = e.cube.chosen
      if (c === 'double' || c === 'take' || c === 'drop') raw.push({ kind: c, player: e.player, e })
      continue
    }
    raw.push({ kind: 'move', player: e.player, e })
  }
  const out: Act[] = []
  let pending: Act | null = null
  const answer = (kind: 'take' | 'drop') => {
    if (!pending) return
    out.push({ kind, player: opponent(pending.player) })
    pending = null
  }
  for (const a of raw) {
    if (a.kind === 'double') {
      answer('take')
      out.push(a)
      pending = a
      continue
    }
    if (a.kind === 'take' || a.kind === 'drop') {
      if (!pending || pending.player !== opponent(a.player)) {
        out.push({ kind: 'double', player: opponent(a.player) })
      }
      pending = null
      out.push(a)
      continue
    }
    answer('take')
    out.push(a)
  }
  answer('drop')
  return out
}

// Bir oyunun sonucu: kup drop'ta teklifi kabul etmeyen kaybeder; yoksa son hamleyi kendi
// pos'una uygulayip gammon/backgammon carpanini gercek tahtadan hesapla.
function outcomeOf(acts: Act[]): { winner: Player; points: number } | null {
  let cube = 1
  let dropWinner: Player | null = null
  let last: MoveLogEntry | undefined
  for (const a of acts) {
    if (a.kind === 'drop') dropWinner = opponent(a.player)
    else if (a.kind === 'take') cube *= 2
    else if (a.kind === 'move') last = a.e
  }
  if (dropWinner) return { winner: dropWinner, points: cube }
  if (!last?.player || !last.pos) return null
  const s = cloneState(last.pos)
  for (const st of last.playedSteps ?? last.steps ?? []) applyStep(s, st, last.player)
  const oc = gameOutcome(s)
  return oc ? { winner: oc.winner, points: cube * oc.multiplier } : null
}

// Mac oyununda puan mac uzunlugunu asamaz: kalan puana kirp.
function capPoints(points: number, matchLength: number, winnerScore: number): number {
  if (matchLength <= 0) return points
  const need = matchLength - winnerScore
  return need > 0 ? Math.min(points, need) : points
}

// ---------------------------------------------------------------------------
// 1) gnubg NATIVE .mat  (DEGISTIRME — luck analizi buna bagli)
// ---------------------------------------------------------------------------
export function buildMat(log: MoveLogEntry[], opts: MatOptions = {}): string {
  const { matchLength = 1, whiteName = 'White', blackName = 'Black' } = opts
  const COLW = 34
  const games = splitGames(log)

  const out: string[] = [`${matchLength} point match`]
  let sw = 0
  let sb = 0
  games.forEach((game, gi) => {
    out.push('')
    out.push(` Game ${gi + 1}`)
    out.push(` ${`${whiteName} : ${sw}`.padEnd(COLW + 4)}${blackName} : ${sb}`)

    const acts = actsOf(game)
    const rows: { w?: string; b?: string }[] = []
    let cube = 1
    for (const a of acts) {
      let text: string
      if (a.kind === 'move') {
        const e = a.e
        const d = e.dice && e.dice.length >= 2 ? `${e.dice[0]}${e.dice[1]}` : '  '
        const mv = e.notation && e.notation !== 'pas' && e.notation !== 'pass' ? e.notation : ''
        text = mv ? `${d}: ${mv}` : `${d}:`
      } else if (a.kind === 'double') {
        text = `Doubles => ${cube * 2}`
      } else if (a.kind === 'take') {
        cube *= 2
        text = 'Takes'
      } else {
        text = 'Drops'
      }
      if (a.player === 'white') {
        rows.push({ w: text })
      } else {
        const last = rows[rows.length - 1]
        if (last && last.w !== undefined && last.b === undefined) last.b = text
        else rows.push({ b: text })
      }
    }
    rows.forEach((r, idx) => {
      const left = (r.w ?? '').padEnd(COLW)
      out.push(`${String(idx + 1).padStart(3)}) ${left}${r.b ?? ''}`.trimEnd())
    })

    const oc = outcomeOf(acts)
    if (oc) {
      const pts = capPoints(oc.points, matchLength, oc.winner === 'white' ? sw : sb)
      const winTxt = `Wins ${pts} point${pts === 1 ? '' : 's'}`
      out.push(oc.winner === 'white' ? `      ${winTxt}` : `      ${''.padEnd(COLW)}${winTxt}`)
      if (oc.winner === 'white') sw += pts
      else sb += pts
    }
  })

  return out.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// 2) XG-uyumlu .mat  (Extreme Gammon dogrudan acar)
// ---------------------------------------------------------------------------

// Tek notasyon token'ini XG diline cevir + tekrarlari AC (parantez yok).
//  bar -> 25, off -> 0. Or: "bar/20" -> ["25/20"], "8/3(2)" -> ["8/3","8/3"],
//  "6/off" -> ["6/0"], "1/off(3)" -> ["1/0","1/0","1/0"]. Coklu atlama/vurus (*) korunur.
function xgToken(tok: string): string[] {
  const m = tok.match(/^(.+?)(?:\((\d+)\))?$/)
  if (!m) return [tok]
  const path = m[1]
  const n = m[2] ? parseInt(m[2], 10) : 1
  const conv = path
    .split('/')
    .map((seg) => {
      const star = seg.endsWith('*') ? '*' : ''
      const core = star ? seg.slice(0, -1) : seg
      const mapped = core === 'bar' ? '25' : core === 'off' ? '0' : core
      return mapped + star
    })
    .join('/')
  return new Array(n).fill(conv)
}
export function xgMoves(notation: string): string {
  return notation
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(xgToken)
    .join(' ')
}

export function buildMatXg(log: MoveLogEntry[], opts: MatXgOptions = {}): string {
  const {
    matchLength = 1,
    whiteName = 'Player1',
    blackName = 'Player2',
    site = 'TavlaTV',
    matchId = '0',
    eventDate = '',
    eventTime = '',
    crawford = true,
  } = opts
  // Gercek XG dosyasiyla (BackgammonGalaxy export) BIREBIR: `  N)` (padStart 3 + paren),
  // ` Game`/` isim : skor` basinda BOSLUK, sol aksiyon COLW=28'e padlenir -> sag sutun col 33.
  const COLW = 28
  const games = splitGames(log)

  const out: string[] = [
    `; [Site "${site}"]`,
    `; [Match ID "${matchId}"]`,
    `; [Player 1 "${whiteName}"]`,
    `; [Player 2 "${blackName}"]`,
    `; [Player 1 Elo "0"]`,
    `; [Player 2 Elo "0"]`,
    `; [EventDate "${eventDate}"]`,
    `; [EventTime "${eventTime}"]`,
    `; [Variation "Backgammon"]`,
    `; [Unrated "Off"]`,
    `; [Crawford "${crawford ? 'On' : 'Off'}"]`,
    `; [CubeLimit "1024"]`,
    '',
    `${matchLength} point match`,
  ]

  let sw = 0
  let sb = 0
  games.forEach((game, gi) => {
    out.push('')
    out.push(` Game ${gi + 1}`)
    out.push(` ${`${whiteName} : ${sw}`.padEnd(COLW + 4)}${blackName} : ${sb}`)

    const acts = actsOf(game)
    const rows: { w?: string; b?: string }[] = []
    let cube = 1
    for (const a of acts) {
      let text: string
      if (a.kind === 'move') {
        const e = a.e
        const d = e.dice && e.dice.length >= 2 ? `${e.dice[0]}${e.dice[1]}` : ''
        // Oynanamayan tur (dance) veya bos: sadece zar yaz, hamle token'i YOK.
        const mv = e.notation && e.notation !== 'pas' && e.notation !== 'pass' ? xgMoves(e.notation) : ''
        text = mv ? `${d}: ${mv}` : `${d}:`
      } else if (a.kind === 'double') {
        text = `Doubles => ${cube * 2}`
      } else if (a.kind === 'take') {
        cube *= 2
        text = 'Takes'
      } else {
        text = 'Drops'
      }
      if (a.player === 'white') {
        rows.push({ w: text })
      } else {
        const last = rows[rows.length - 1]
        if (last && last.w !== undefined && last.b === undefined) last.b = text
        else rows.push({ b: text })
      }
    }

    // Hamle satirlari: "  N) sol   sag" (numara padStart 3 + paren, tekrarlar acik).
    rows.forEach((r, idx) => {
      const left = (r.w ?? '').padEnd(COLW)
      out.push(`${String(idx + 1).padStart(3)}) ${left}${r.b ?? ''}`.trimEnd())
    })

    // Oyun sonu — gercek XG davranisi:
    //  • kazanan SAG sutundaysa (Player2/siyah): NUMARALI iki-sutun satir
    //    "  N)  Losses X point   Wins X point" (kaybeden solda bir bosluk girintili).
    //  • kazanan SOL sutundaysa (Player1/beyaz): ayri "      Wins X point[ and the match]" satiri.
    // Mac bitince kazanana " and the match" eklenir. (Ornek XG dosyasiyla birebir.)
    const oc = outcomeOf(acts)
    if (oc) {
      const pts = capPoints(oc.points, matchLength, oc.winner === 'white' ? sw : sb)
      if (oc.winner === 'white') sw += pts
      else sb += pts
      const matchOver = matchLength > 0 && (oc.winner === 'white' ? sw : sb) >= matchLength
      const winTxt = `Wins ${pts} point${matchOver ? ' and the match' : ''}`
      const loseTxt = `Losses ${pts} point`
      if (oc.winner === 'black') {
        const num = rows.length + 1
        out.push(`${String(num).padStart(3)}) ${` ${loseTxt}`.padEnd(COLW)}${winTxt}`.trimEnd())
      } else {
        out.push(`      ${winTxt}`)
      }
    }
  })

  return out.join('\n') + '\n'
}

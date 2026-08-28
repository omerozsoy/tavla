// Mac kaydini standart .mat (Jellyfish / GNU Backgammon) formatinda uret.
// UI (MatchReport "Disa aktar") ve testler AYNI mantigi kullansin diye burada saf fonksiyon.
//
// Oyunlar acilis dizilimi tespitiyle bolunur; her hamle "zar: notasyon" satirina
// (beyaz sol / siyah sag sutun) yazilir; insanin kup kararlari (Doubles/Takes/Drops)
// ve oyun sonuclari (Wins N points) eklenir. Notasyon zaten her oyuncunun kendi
// perspektifinde (moveNotation) -> .mat ile uyumlu. GNU BG / XG ile analize acilabilir.
import type { MoveLogEntry } from './storage'
import type { Player } from './engine/types'
import { initialState, cloneState, gameOutcome, opponent } from './engine/board'
import { applyStep } from './engine/moves'

export interface MatOptions {
  matchLength?: number // .mat basligi ( or. "3 point match")
  whiteName?: string
  blackName?: string
}

export function buildMat(log: MoveLogEntry[], opts: MatOptions = {}): string {
  const { matchLength = 1, whiteName = 'White', blackName = 'Black' } = opts
  const COLW = 34 // sol sutun genisligi (hizalama)
  const INIT = initialState().points

  // Acilis dizilimi mi? (yeni oyunun ilk hamlesi: taslar baslangicta, bar/off bos)
  const isOpening = (e: MoveLogEntry): boolean => {
    const p = e.pos
    if (!p || e.cube) return false
    if (p.bar.white || p.bar.black || p.off.white || p.off.black) return false
    return p.points.length === 24 && p.points.every((v, i) => v === INIT[i])
  }

  // seq'e gore sirala (async bot kayitlari dogru yere otursun) + oyunlara bol
  const seqAll = log.map((e, i) => ({ e, i })).sort((a, b) => (a.e.seq ?? a.i) - (b.e.seq ?? b.i))
  const games: MoveLogEntry[][] = []
  for (const { e } of seqAll) {
    if (isOpening(e) || games.length === 0) games.push([])
    games[games.length - 1].push(e)
  }

  // Bir oyunun sonucu: kup drop'ta teklifi kabul etmeyen kaybeder; yoksa son hamleyi
  // kendi pos'una uygulayip gammon/backgammon carpanini gercek tahtadan hesapla.
  const outcomeOf = (game: MoveLogEntry[]): { winner: Player; points: number } | null => {
    let cube = 1
    let dropWinner: Player | null = null
    let last: MoveLogEntry | undefined
    for (const e of game) {
      if (e.cube) {
        // Kup yalnizca KABUL edilince (take) katlanir. Teklif (double) + kabul (take)
        // ayri satirlar oldugundan ikisinde de katlarsak x4 olurdu -> sadece take.
        if (e.cube.chosen === 'drop') dropWinner = e.player ? opponent(e.player) : null
        else if (e.cube.chosen === 'take') cube *= 2
      } else if (e.player) {
        last = e
      }
    }
    if (dropWinner) return { winner: dropWinner, points: cube }
    if (!last?.player || !last.pos) return null
    const s = cloneState(last.pos)
    for (const st of last.playedSteps ?? last.steps ?? []) applyStep(s, st, last.player)
    const oc = gameOutcome(s)
    return oc ? { winner: oc.winner, points: cube * oc.multiplier } : null
  }

  // Ilk satir mutlaka "N point match" (gnubg importeri bunu bekler; onunde yorum yok).
  const out: string[] = [`${matchLength} point match`]

  let sw = 0
  let sb = 0
  games.forEach((game, gi) => {
    out.push('')
    out.push(` Game ${gi + 1}`)
    out.push(` ${`${whiteName} : ${sw}`.padEnd(COLW + 4)}${blackName} : ${sb}`)

    // Sutunlu satirlar: sol=beyaz, sag=siyah. .mat'te hamle numarasi beyaz hamlesinde
    // artar; siyah acilisi kazandiginda sol sutun bos kalir (tur sirasi korunur).
    const rows: { w?: string; b?: string }[] = []
    let cube = 1
    for (const e of game) {
      if (!e.player) continue
      let text: string
      if (e.cube) {
        if (e.cube.chosen === 'double') {
          text = `Doubles => ${cube * 2}` // teklif edilen deger; cube kabul (take) ile guncellenir
        } else if (e.cube.chosen === 'take') {
          cube *= 2
          text = 'Takes'
        } else if (e.cube.chosen === 'drop') {
          text = 'Drops'
        } else {
          continue // 'no-double' vb. -> kup eylemi yok
        }
      } else {
        const d = e.dice && e.dice.length >= 2 ? `${e.dice[0]}${e.dice[1]}` : '  '
        // Oynanamayan tur (dance): sadece zar yaz, hamle token'i YOK ("pas" gnubg'u bozar).
        const mv = e.notation && e.notation !== 'pas' && e.notation !== 'pass' ? e.notation : ''
        text = mv ? `${d}: ${mv}` : `${d}:`
      }
      if (e.player === 'white') {
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

    const oc = outcomeOf(game)
    if (oc) {
      // Mac oyununda puan mac uzunlugunu asamaz: kalan puana kirp (1 puanlik macta
      // gammon "2" degil "1" yazilsin). matchLength <= 0 (para oyunu) -> kirpma yok.
      let pts = oc.points
      if (matchLength > 0) {
        const need = matchLength - (oc.winner === 'white' ? sw : sb)
        if (need > 0) pts = Math.min(pts, need)
      }
      const winTxt = `Wins ${pts} point${pts === 1 ? '' : 's'}`
      out.push(oc.winner === 'white' ? `      ${winTxt}` : `      ${''.padEnd(COLW)}${winTxt}`)
      if (oc.winner === 'white') sw += pts
      else sb += pts
    }
  })

  return out.join('\n') + '\n'
}

// Mac kaydini standart .mat (Jellyfish / GNU Backgammon) formatinda uret.
// UI (MatchReport "Disa aktar") ve testler AYNI mantigi kullansin diye burada saf fonksiyon.
//
// Oyunlar acilis dizilimi tespitiyle bolunur; her hamle "zar: notasyon" satirina
// (beyaz sol / siyah sag sutun) yazilir; insanin kup kararlari (Doubles/Takes/Drops)
// ve oyun sonuclari (Wins N points) eklenir. Notasyon zaten her oyuncunun kendi
// perspektifinde (moveNotation) -> .mat ile uyumlu. GNU BG / XG ile analize acilabilir.
//
// .mat iki SUTUNLU bir formattir ve okuyucu (XG/gnubg) sirayi sutunlardan cikarir:
// her satirda once sol (beyaz) sonra sag (siyah) eylem gelir. Bu yuzden eylem dizisi
// KESINTISIZ almasik olmali ve her "Doubles" satirinin AYNI satirinda rakibin
// "Takes"/"Drops" cevabi bulunmali. Aksi halde XG "The game contains some invalid
// moves" der. Log'da bu iki sarti bozan iki gercek durum var; ikisi de burada onarilir:
//  1) SIRALAMA: kup girdileri o turun hamlesiyle AYNI seq'i tasir (seq = turnsPlayed).
//     Online'da log [...benim girdilerim, ...rakibinkiler] seklinde birlestirildiginden
//     (her istemci yalniz kendi rengini yazar) esit seq'te dogal sira YANLIS olur:
//     "kendi teklifim, kendi hamlem, rakibin kabulu". -> seq esitliginde teklif < yanit
//     < hamle olacak sekilde ikincil siralama uygulanir.
//  2) EKSIK KAYIT: rakibin istemcisi senkron gonderemediyse teklif ya da yanit hic
//     gelmeyebilir. Askida kalan kup satiri dosyayi bozdugundan eksik taraf oyunun
//     devamindan cikarilarak URETILIR (devam ediyorsa Takes, oyun bittiyse Drops).
import type { MoveLogEntry } from './storage'
import type { Player } from './engine/types'
import { initialState, cloneState, gameOutcome, opponent } from './engine/board'
import { applyStep } from './engine/moves'

export interface MatOptions {
  matchLength?: number // .mat basligi ( or. "3 point match")
  whiteName?: string
  blackName?: string
}

// Bir oyundaki tek eylem. e yoksa ONARILMIS (log'da eksik olup oyunun akisindan
// zorunlu olarak cikan) kup satiridir.
type Act =
  | { kind: 'move'; player: Player; e: MoveLogEntry }
  | { kind: 'double' | 'take' | 'drop'; player: Player; e?: MoveLogEntry }

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

  // seq'e gore sirala (async bot kayitlari dogru yere otursun) + oyunlara bol.
  // AYNI seq icinde: teklif (0) < yanit (1) < hamle (2). Bkz. dosya basi (1).
  const rank = (e: MoveLogEntry): number => (!e.cube ? 2 : e.cube.chosen === 'double' ? 0 : 1)
  const seqAll = log
    .map((e, i) => ({ e, i }))
    .sort(
      (a, b) =>
        (a.e.seq ?? a.i) - (b.e.seq ?? b.i) || rank(a.e) - rank(b.e) || a.i - b.i,
    )
  const games: MoveLogEntry[][] = []
  for (const { e } of seqAll) {
    if (isOpening(e) || games.length === 0) games.push([])
    games[games.length - 1].push(e)
  }

  // Oyunun eylem dizisi: kup satirlari CIFTLENIR (bkz. dosya basi (2)). Cikan dizide
  // her teklifin hemen ardindan rakibin yaniti gelir -> sutun almasigi bozulmaz.
  const actsOf = (game: MoveLogEntry[]): Act[] => {
    const raw: Act[] = []
    for (const e of game) {
      if (!e.player) continue
      if (e.cube) {
        const c = e.cube.chosen
        // 'no-double' vb. .mat'e yazilmaz (kup eylemi gerceklesmemis)
        if (c === 'double' || c === 'take' || c === 'drop') raw.push({ kind: c, player: e.player, e })
        continue
      }
      raw.push({ kind: 'move', player: e.player, e })
    }
    const out: Act[] = []
    let pending: Act | null = null // yanit bekleyen teklif
    const answer = (kind: 'take' | 'drop') => {
      if (!pending) return
      out.push({ kind, player: opponent(pending.player) })
      pending = null
    }
    for (const a of raw) {
      if (a.kind === 'double') {
        answer('take') // onceki teklif cevapsiz kaldiysa: oyun surdugune gore kabul edilmis
        out.push(a)
        pending = a
        continue
      }
      if (a.kind === 'take' || a.kind === 'drop') {
        if (!pending || pending.player !== opponent(a.player)) {
          // Teklif kaydi eksik -> rakip adina uret ki kup degeri ve satir cifti korunsun
          out.push({ kind: 'double', player: opponent(a.player) })
        }
        pending = null
        out.push(a)
        continue
      }
      answer('take') // hamle geldiyse teklif kabul edilmis demektir
      out.push(a)
    }
    answer('drop') // oyun teklifin ardindan bittiyse: pas
    return out
  }

  // Bir oyunun sonucu: kup drop'ta teklifi kabul etmeyen kaybeder; yoksa son hamleyi
  // kendi pos'una uygulayip gammon/backgammon carpanini gercek tahtadan hesapla.
  const outcomeOf = (acts: Act[]): { winner: Player; points: number } | null => {
    let cube = 1
    let dropWinner: Player | null = null
    let last: MoveLogEntry | undefined
    for (const a of acts) {
      // Kup yalnizca KABUL edilince (take) katlanir. Teklif (double) + kabul (take)
      // ayri satirlar oldugundan ikisinde de katlarsak x4 olurdu -> sadece take.
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

  // Ilk satir mutlaka "N point match" (gnubg importeri bunu bekler; onunde yorum yok).
  const out: string[] = [`${matchLength} point match`]

  let sw = 0
  let sb = 0
  games.forEach((game, gi) => {
    out.push('')
    out.push(` Game ${gi + 1}`)
    out.push(` ${`${whiteName} : ${sw}`.padEnd(COLW + 4)}${blackName} : ${sb}`)

    const acts = actsOf(game)

    // Sutunlu satirlar: sol=beyaz, sag=siyah. .mat'te hamle numarasi beyaz hamlesinde
    // artar; siyah acilisi kazandiginda sol sutun bos kalir (tur sirasi korunur).
    const rows: { w?: string; b?: string }[] = []
    let cube = 1
    for (const a of acts) {
      let text: string
      if (a.kind === 'move') {
        const e = a.e
        const d = e.dice && e.dice.length >= 2 ? `${e.dice[0]}${e.dice[1]}` : '  '
        // Oynanamayan tur (dance): sadece zar yaz, hamle token'i YOK ("pas" gnubg'u bozar).
        const mv = e.notation && e.notation !== 'pas' && e.notation !== 'pass' ? e.notation : ''
        text = mv ? `${d}: ${mv}` : `${d}:`
      } else if (a.kind === 'double') {
        text = `Doubles => ${cube * 2}` // teklif edilen deger; cube kabul (take) ile guncellenir
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

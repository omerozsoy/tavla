// NOT (2026-09-11): .mat'in OTORITER ureticisi SUNUCUDUR (backend/app/Support/MatSerializer.php;
// MatBuilder=gnubg/luck, MatFromLog=xg/indirme). Buradaki iki fonksiyonun rolu:
//  - buildMat (gnubg NATIVE): UYGULAMADA KULLANILMAZ; yalniz TEST/SPEC oracle. matExport.botcheck.
//    test.ts bununla commit'li fixture (bot-match.mat) uretir; PHP MatBuilder o fixture ile BYTE-BYTE
//    karsilastirilir (MatBuilderTest = luck regresyon kalkani). buildMat = PHP luck'in DOGRULANMIS
//    referans spesifikasyonu; silme, degistirmeden once PHP paritesini guncelle.
//  - buildMatXg (XG): yalniz SESSIZ INDIRME YEDEGI (MatchReport). Sunucu kaydi henuz flush olmadi/
//    erisemedi ise istemci bir .mat uretebilsin diye; normalde sunucudan indirilir.
//
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
  // OTORİTER oyun sonuçları (oyun sırasıyla). Tahta-tekrarı sonuç veremezse (zorunlu son bear-off
  // logda yok VEYA oyun PES/terk ile bitti) buradan alınır -> her tamamlanan oyun sonuç satırı alır.
  results?: { winner: Player; points: number }[]
}

// XG header'i icin ek alanlar. Verilmezse makul varsayilanlar kullanilir.
export interface MatXgOptions extends MatOptions {
  site?: string // ; [Site "..."]           varsayilan TavlaTV
  matchId?: string // ; [Match ID "..."]     varsayilan "0"
  eventDate?: string // ; [EventDate "..."]  "YYYY.MM.DD"
  eventTime?: string // ; [EventTime "..."]  "HH.MM"
  crawford?: boolean // ; [Crawford "On/Off"] varsayilan true (On)
  // OTORITER oyun sonuclari (opsiyonel, oyun sirasiyla BIREBIR). Neden gerekli: analiz logu
  // (matchLog) tek-legal (zorunlu) hamleleri ATLAR; bir oyunu bitiren son bear-off cogu zaman
  // zorunludur -> logda YOKtur -> tahtayi tekrar oynatarak sonuc BULUNAMAZ ve "Wins/Losses"
  // satiri yazilmadan oyun kapanir (XG dosyayi bozuk okur). App bu diziyi motorun GameEnd'inden
  // doldurur; tahta-tekrari sonuc veremezse buradan alinir -> her tamamlanan oyun sonuc satiri alir.
  results?: { winner: Player; points: number }[]
  // OTORITER MAC SONUCU (kazanan + final skor). SON oyunun sonucu tahtadan/results'tan
  // ÇIKARILAMAZSA (ör. online rakibin kazanan hamlesi loga girmemiş / eski truncated log) bu
  // kullanılır: son oyunun puanı = kazananın final skoru - önceki oyunlardan birikeni. Böylece
  // TAMAMLANMIŞ maç DAİMA "Wins/Losses ... and the match" sonuç satırı alır.
  matchResult?: { winner: Player; score: { white: number; black: number } }
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

// Aynı turun (aynı oyuncu + aynı seq) MÜKERRER hamle girdisini ele: online senkron çift-yazımı
// (aynı hamle iki kez matchLog'a düşebiliyor -> XG'de aynı hamle iki satır) ya da fill/recordPR
// örtüşmesi. Küp girdileri hamle ile AYNI seq'i taşıyabildiğinden dedup DIŞIDIR. Bir tur için birden
// çok kayıt varsa BİLGİ taşıyanı (notation dolu) korunur. Oyun-İÇİ çağrılır (seq oyun başında sıfırlanır).
function dedupeTurns(game: MoveLogEntry[]): MoveLogEntry[] {
  const at = new Map<string, number>()
  const out: MoveLogEntry[] = []
  const info = (s?: string) => (s && s.trim() && s !== 'pas' && s !== 'pass' ? 1 : 0)
  for (const e of game) {
    if (e.cube || e.seq == null || !e.player) {
      out.push(e)
      continue
    }
    const key = `${e.player}:${e.seq}`
    const prevIdx = at.get(key)
    if (prevIdx === undefined) {
      at.set(key, out.length)
      out.push(e)
    } else if (info(e.notation) > info(out[prevIdx].notation)) {
      out[prevIdx] = e // daha bilgili kaydı tut, mükerreri düşür
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 1) gnubg NATIVE .mat  (DEGISTIRME — luck analizi buna bagli)
// ---------------------------------------------------------------------------
export function buildMat(log: MoveLogEntry[], opts: MatOptions = {}): string {
  const { matchLength = 1, whiteName = 'White', blackName = 'Black' } = opts
  const COLW = 34
  // gnubg NATIVE .mat: yalnız analiz-değeri taşıyan girdiler (fill = XG tur-sırası dolgusu HARİÇ).
  // Böylece luck kaynağı bugüne kadarki .mat ile BİREBİR aynı kalır (fill eklenmesi luck'ı bozmaz).
  const games = splitGames(log.filter((e) => !e.fill))

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

    // Tahta-tekrarı sonuç veremezse (zorunlu son bear-off logda yok VEYA oyun PES/terk ile bitti)
    // otoriter results[gi]'ye düş -> resigned oyunlar da "Wins N points" satırı + doğru skor alır.
    const oc = outcomeOf(acts) ?? (opts.results ? (opts.results[gi] ?? null) : null)
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

// KANONİK ZAR NORMALİZASYONU: aynı atış her zaman AYNI yazılsın diye zar çifti DAİMA
// yüksek-zar-önce sıralanır ("23"->"32", "12"->"21", "35"->"53"). Çiftler değişmez ("55").
// SADECE görüntü sırası; hamle token'ları (pip mesafesiyle zarı belirler) ASLA yeniden
// sıralanmaz. Kaynak (kendi-kayıt vs rakip-yeniden-kurulum) hangi sırada kaydetmiş olursa
// olsun MAT çıktısı deterministik olur.
export function xgDice(dice?: number[]): string {
  if (!dice || dice.length < 2) return ''
  const a = dice[0]
  const b = dice[1]
  return a >= b ? `${a}${b}` : `${b}${a}`
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
    results,
    matchResult,
  } = opts
  // MAÇ UZUNLUĞU HARD-CODE EDİLMEZ. Log'a oyun anında gömülen otoriter mctx.matchLen (match.target)
  // varsa ONU kullan; caller yanlış/varsayılan (1) geçse bile MAT başlığı GERÇEK maç uzunluğunu
  // yazar (ör. 3 point match). Kaynaklar çelişirse LOG otoriterdir (o maçla birlikte kaydedildi).
  const loggedLen = log.find((e) => typeof e.mctx?.matchLen === 'number' && e.mctx.matchLen > 0)?.mctx?.matchLen
  const effMatchLength = loggedLen ?? matchLength
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
    `${effMatchLength} point match`,
  ]

  let sw = 0
  let sb = 0
  games.forEach((rawGame, gi) => {
    // XG: fill (zorunlu/dance dolgu) girdileri DAHIL (tur sırası + zar korunur) ama MÜKERRER
    // tur (aynı oyuncu+seq) elenir -> "sol kolon sürekli boş" ve "aynı hamle iki satır" düzelir.
    const game = dedupeTurns(rawGame)
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
        const d = xgDice(e.dice) // KANONİK: yüksek zar önce (deterministik)
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
      // Referans XG (BackgammonGalaxy) davranisi: SOL sutundaki kup gibi HAMLE-DISI girdiler bir
      // bosluk girintili yazilir ("  5)  Doubles => 2", "  4)  Takes"); sag sutunda girinti YOK.
      // Hamleler her iki sutunda da girintisiz. (Referans .mat ile birebir.)
      const isSpecial = a.kind !== 'move'
      if (a.player === 'white') {
        rows.push({ w: isSpecial ? ` ${text}` : text })
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
    // Sonuc: once GERCEK tahtadan (logda bitiren hamle varsa); yoksa otoriter results'tan.
    // results yalnizca oyun sayisiyla birebir eslesirse fallback olur (yanlis eslemeyi onle).
    const resultsAligned = !!results && results.length === games.length
    let oc = outcomeOf(acts) ?? (resultsAligned ? (results as { winner: Player; points: number }[])[gi] : null)
    // SON CARE (yalniz SON oyun): tahta+results sonuc VERMEZSE ama MAC bitmisse (matchResult), o
    // oyunun puanini OTORITER SON SKORDAN turet: pts = kazananin final skoru - onceki oyunlardan
    // birikeni (sw/sb). Boylece rakibin kazanan hamlesi loga girmese/eski truncated logda bile
    // tamamlanan mac MUTLAKA "Wins/Losses ... and the match" sonuc satiri alir.
    if (!oc && matchResult && gi === games.length - 1) {
      const w = matchResult.winner
      const pts = matchResult.score[w] - (w === 'white' ? sw : sb)
      if (pts > 0) oc = { winner: w, points: pts }
    }
    if (oc) {
      // XG davranisi: puan KIRPILMAZ. Mac uzunlugu asilsa bile o oyunda kazanilan GERCEK puan
      // yazilir (gammon/backgammon × kup). "and the match" kazanan mac puanina ulastiginda eklenir.
      const pts = oc.points
      if (oc.winner === 'white') sw += pts
      else sb += pts
      const matchOver = effMatchLength > 0 && (oc.winner === 'white' ? sw : sb) >= effMatchLength
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

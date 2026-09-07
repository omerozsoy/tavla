// .mat DOGRULAYICI: uretilen dosyayi XG/gnubg'nin yaptigi gibi bastan oynar ve ilk
// gecersiz yeri isaret eder. "The game contains some invalid moves" uyarisinin
// kaynagini XG'ye gitmeden, tam satir/hucre duzeyinde bulmak icin.
//
// Kontroller:
//  - Sutun almasigi: hucreler kesintisiz beyaz/siyah gitmeli (.mat'te sirayi sutun belirler)
//  - Zar: her hamle o turun zarlariyla LEGAL ve MAKSIMAL olmali (motorun terminalleri)
//  - Kup: her "Doubles" rakibin "Takes"/"Drops" cevabini gormeli
import { initialState, cloneState, opponent } from './engine/board'
import { maximalTerminals, applyStep, boardKey } from './engine/moves'
import type { GameState, Player, Step } from './engine/types'

export interface MatProblem {
  game: number
  line: number // 1-tabanli dosya satiri
  cell: string // sorunlu hucre metni
  detail: string
}

const COLW = 34 // buildMat ile ayni sol sutun genisligi
const PREFIX = 5 // "NNN) "

// "8/5 6/5", "bar/22 13/7(2)", "6/off" -> adimlar (oyuncunun kendi numaralamasindan indekse)
function parseTokens(notation: string, player: Player): Step[] | null {
  const steps: Step[] = []
  for (const tok of notation.trim().split(/\s+/)) {
    if (!tok) continue
    const m = tok.match(/^(bar|\d+)\/(off|\d+)\*?(?:\((\d+)\))?$/i)
    if (!m) return null
    const [, fromS, toS, cntS] = m
    const num = (v: string) => (player === 'white' ? parseInt(v, 10) - 1 : 24 - parseInt(v, 10))
    const from: number | 'bar' = fromS.toLowerCase() === 'bar' ? 'bar' : num(fromS)
    const to: number | 'off' = toS.toLowerCase() === 'off' ? 'off' : num(toS)
    for (let i = 0; i < (cntS ? parseInt(cntS, 10) : 1); i++) steps.push({ from, to, die: 0 })
  }
  return steps
}

export function validateMat(text: string): MatProblem[] {
  const problems: MatProblem[] = []
  const lines = text.split(/\r?\n/)
  let game = 0
  let state: GameState | null = null
  let expect: Player | null = null // sirasi gelen (null = oyunun ilk hucresi, ikisi de olur)
  let pendingDouble: Player | null = null

  const add = (line: number, cell: string, detail: string) =>
    problems.push({ game, line, cell, detail })

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (/^\s*Game\s+\d+/.test(raw)) {
      if (pendingDouble) add(i, 'Doubles', 'oyun bitti ama teklif cevapsiz kaldi')
      game += 1
      state = initialState()
      expect = null
      pendingDouble = null
      continue
    }
    if (!/^\s*\d+\)\s/.test(raw)) continue
    if (!state) {
      add(i + 1, raw.trim(), 'hamle satiri "Game N" basligindan once geldi')
      continue
    }
    const cells: { player: Player; text: string }[] = []
    const left = raw.slice(PREFIX, PREFIX + COLW).trim()
    const right = raw.slice(PREFIX + COLW).trim()
    if (left) cells.push({ player: 'white', text: left })
    if (right) cells.push({ player: 'black', text: right })

    for (const c of cells) {
      if (/^Wins\s/i.test(c.text)) continue
      // --- Kup hucreleri ---
      if (/^Doubles/i.test(c.text)) {
        if (pendingDouble) add(i + 1, c.text, 'onceki teklif cevaplanmadan yeni teklif')
        pendingDouble = c.player
        expect = opponent(c.player) // cevabi rakip verir
        continue
      }
      if (/^(Takes|Drops)/i.test(c.text)) {
        if (pendingDouble === null) add(i + 1, c.text, 'teklifi olmayan yanit')
        else if (pendingDouble === c.player) add(i + 1, c.text, 'kendi teklifini kendi yanitlamis')
        pendingDouble = null
        // Take sonrasi sira TEKLIF EDENDE; drop'ta oyun biter.
        expect = /^Takes/i.test(c.text) ? opponent(c.player) : null
        continue
      }
      // --- Hamle hucresi ---
      if (pendingDouble) {
        add(i + 1, c.text, 'teklif cevaplanmadan hamle geldi (Takes/Drops eksik)')
        pendingDouble = null
      }
      if (expect && expect !== c.player) {
        add(i + 1, c.text, `sira ${expect} tarafinda ama ${c.player} oynadi (sutun almasigi bozuk)`)
      }
      const dm = c.text.match(/^(\d)(\d)\s*:\s*(.*)$/)
      if (!dm) {
        add(i + 1, c.text, 'zar/hamle bicimi cozulemedi')
        expect = opponent(c.player)
        continue
      }
      const d1 = Number(dm[1])
      const d2 = Number(dm[2])
      const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]
      const s: GameState = { ...cloneState(state), turn: c.player, dice, diceUsed: dice.map(() => false) }
      const terms = maximalTerminals(s)
      const notation = dm[3].trim()
      if (!notation) {
        // Oynanamayan tur (dance): motor da oynanacak adim bulamamali. maximalTerminals
        // dance'te BOS DIZI degil, adimsiz TEK terminal dondurur -> uzunluga degil
        // adimlara bak.
        if (terms.some((t) => t.steps.length > 0)) add(i + 1, c.text, 'hamle yazilmamis ama legal hamle var')
        state = { ...cloneState(s), turn: opponent(c.player), dice: [], diceUsed: [] }
        expect = opponent(c.player)
        continue
      }
      const steps = parseTokens(notation, c.player)
      if (!steps) {
        add(i + 1, c.text, 'notasyon cozulemedi')
        expect = opponent(c.player)
        continue
      }
      const after = cloneState(s)
      try {
        for (const st of steps) applyStep(after, st, c.player)
      } catch {
        add(i + 1, c.text, 'hamle tahtaya uygulanamadi')
        expect = opponent(c.player)
        continue
      }
      const key = boardKey(after)
      if (!terms.some((t) => boardKey(t.state) === key)) {
        add(i + 1, c.text, `bu zarlarla (${d1}-${d2}) legal/maksimal bir hamle degil`)
      }
      state = { ...after, turn: opponent(c.player), dice: [], diceUsed: [] }
      expect = opponent(c.player)
    }
  }
  if (pendingDouble) problems.push({ game, line: lines.length, cell: 'Doubles', detail: 'dosya sonunda teklif cevapsiz' })
  return problems
}

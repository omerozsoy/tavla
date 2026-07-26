import type { GameState, Move, Player, Step } from './types'
import {
  allHome,
  cloneState,
  countAt,
  highestHomeIndex,
  isBlocked,
  placeChecker,
  WHITE,
} from './board'

// Oyuncunun yonu: beyaz index azaltir (-1), siyah artirir (+1)
function dir(player: Player): number {
  return player === WHITE ? -1 : 1
}

// Bir tasin bear off icin gereken zar degeri (pip)
//   beyaz: index 0 -> 1 pip ... index 5 -> 6 pip
//   siyah: index 23 -> 1 pip ... index 18 -> 6 pip
function bearOffPip(player: Player, index: number): number {
  return player === WHITE ? index + 1 : 24 - index
}

// Bar'dan giris index'i (verilen zar icin)
function entryIndex(player: Player, die: number): number {
  return player === WHITE ? 24 - die : die - 1
}

// Verilen tek zar ile oynanabilecek tum tekil step'ler
export function singleDieSteps(state: GameState, player: Player, die: number): Step[] {
  const steps: Step[] = []
  const points = state.points

  // Bar'da tas varsa once onu sokmak zorunlu
  if (state.bar[player] > 0) {
    const idx = entryIndex(player, die)
    if (!isBlocked(points, idx, player)) {
      steps.push({ from: 'bar', to: idx, die })
    }
    return steps
  }

  const canBearOff = allHome(state, player)

  for (let i = 0; i < 24; i++) {
    if (countAt(points, i, player) === 0) continue
    const target = i + dir(player) * die

    if (target >= 0 && target <= 23) {
      // Tahta ici normal hareket
      if (!isBlocked(points, target, player)) {
        steps.push({ from: i, to: target, die })
      }
    } else if (canBearOff) {
      // Tahta disi -> bear off denemesi
      const pip = bearOffPip(player, i)
      if (pip === die) {
        // Tam ucus
        steps.push({ from: i, to: 'off', die })
      } else if (pip < die) {
        // Fazla zar: sadece daha uzakta tas yoksa (bu tas en uzaktaysa) izinli
        if (highestHomeIndex(state, player) === i) {
          steps.push({ from: i, to: 'off', die })
        }
      }
    }
  }
  return steps
}

// Bir step'i tahtaya uygula (state'i mutasyona ugratir)
export function applyStep(state: GameState, step: Step, player: Player): void {
  const sign = player === WHITE ? 1 : -1
  if (step.from === 'bar') {
    state.bar[player] -= 1
  } else {
    state.points[step.from] -= sign
  }
  if (step.to === 'off') {
    state.off[player] += 1
  } else {
    placeChecker(state, step.to, player)
  }
}

// Tahtanin parmak izi (ayni sonuca goturen farkli step siralarini dedupe icin)
export function boardKey(state: GameState): string {
  return (
    state.points.join(',') +
    '|' +
    state.bar.white +
    ',' +
    state.bar.black +
    '|' +
    state.off.white +
    ',' +
    state.off.black
  )
}

interface Terminal {
  steps: Step[]
  state: GameState
}

// Bir turdaki tum maksimal (en fazla zar kullanan) tam hamle dizileri - TEKILLESTIRILMEMIS.
// legalNextSteps bunu kullanir; cunku ayni sonuca goturen farkli ilk-adimlar
// dedup'ta kaybolmamali (yoksa gecerli taslar oynanamaz gibi gorunur).
export function maximalTerminals(state: GameState): Terminal[] {
  const player = state.turn
  if (state.dice.length === 0) return []

  // Kalan zarlar: cift zar zaten [d,d,d,d] gelir; normalde [a,b]; kismi turda tek zar da olabilir.
  // (Onceden [dice[0], dice[1]] varsayiliyordu; tek zarli analiz durumunda dice[1]=undefined ->
  //  bar'da NaN step uretiyordu. Simdi dizinin gercek uzunlugunu kullaniyoruz.)
  const remaining = state.dice.slice()

  const terminals: Terminal[] = []

  function expand(cur: GameState, dice: number[], stepsSoFar: Step[]): void {
    let extended = false
    const tried = new Set<number>()
    for (let k = 0; k < dice.length; k++) {
      const d = dice[k]
      if (tried.has(d)) continue
      tried.add(d)
      const options = singleDieSteps(cur, player, d)
      for (const st of options) {
        const nb = cloneState(cur)
        applyStep(nb, st, player)
        const rem = dice.slice()
        rem.splice(k, 1)
        expand(nb, rem, [...stepsSoFar, st])
        extended = true
      }
    }
    if (!extended) {
      terminals.push({ steps: stepsSoFar, state: cur })
    }
  }

  expand(cloneState(state), remaining, [])

  const maxLen = terminals.reduce((m, t) => Math.max(m, t.steps.length), 0)
  let best = terminals.filter((t) => t.steps.length === maxLen)

  // Ozel kural: iki FARKLI zardan sadece biri oynanabiliyorsa buyugu oynamak zorunlu
  if (maxLen === 1 && state.dice.length === 2 && state.dice[0] !== state.dice[1]) {
    const larger = Math.max(state.dice[0], state.dice[1])
    const withLarger = best.filter((t) => t.steps[0].die === larger)
    if (withLarger.length > 0) best = withLarger
  }

  return best
}

// Tum maksimal hamle dizileri (sadece step'ler, dedup yok) - UI ilk-adim secimi icin.
export function allMaximalSequences(state: GameState): Step[][] {
  return maximalTerminals(state).map((t) => t.steps)
}

// Bir turdaki tum legal tam hamleleri uret (sonuc tahtasina gore TEKILLESTIRILMIS).
// Bot degerlendirmesi icin: ayni sonuc = ayni deger.
export function generateMoves(state: GameState): Move[] {
  const best = maximalTerminals(state)
  const seen = new Set<string>()
  const moves: Move[] = []
  for (const t of best) {
    const key = boardKey(t.state)
    if (seen.has(key)) continue
    seen.add(key)
    moves.push({ steps: t.steps, resultKey: key })
  }
  return moves
}

// Hic legal hamle var mi (pas gerekiyor mu)?
export function hasNoMove(moves: Move[]): boolean {
  return moves.length === 1 && moves[0].steps.length === 0
}

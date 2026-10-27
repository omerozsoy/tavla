import type { GameState, Move, Step } from './types'
import { cloneState, countAt, initialState, opponent, winner } from './board'
import { allMaximalSequences, applyStep } from './moves'

export { initialState, winner }

// Kriptografik guvenli tek zar (1-6).
// crypto.getRandomValues + rejection sampling: 256 = 42*6 + 4, bu yuzden 252 ve
// ustu reddedilir (252 = 42*6). Kalan 0..251 esit dagilir -> modulo yanliligi yok.
export function secureDie(): number {
  const buf = new Uint8Array(1)
  let v: number
  do {
    crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= 252)
  return (v % 6) + 1
}

// Iki zar at (1-6). Cift ise 4 hamle.
export function rollDice(): number[] {
  const a = secureDie()
  const b = secureDie()
  return a === b ? [a, a, a, a] : [a, b]
}

// Yeni tur baslat: zar at ve state'e yaz
export function newTurn(state: GameState, dice: number[]): GameState {
  const s = cloneState(state)
  s.dice = dice
  s.diceUsed = dice.map(() => false)
  return s
}

// Bir tam hamleyi uygula ve sirayi rakibe ver
export function applyMove(state: GameState, move: Move): GameState {
  const s = cloneState(state)
  for (const step of move.steps) {
    applyStep(s, step, s.turn)
  }
  s.turn = opponent(s.turn)
  s.dice = []
  s.diceUsed = []
  return s
}

// UI icin: verilen prefix step'lerden sonra oynanabilecek bir sonraki step'ler.
// TEKILLESTIRILMEMIS maksimal dizileri kullanir; boylece ayni sonuca goturen
// farkli ilk-adimlar (or. bir tasi yurutmek vs ev taslarini oynamak) kaybolmaz.
export function legalNextSteps(state: GameState, played: Step[]): Step[] {
  const sequences = allMaximalSequences(state)
  const next: Step[] = []
  const seen = new Set<string>()

  for (const steps of sequences) {
    if (steps.length <= played.length) continue
    // played prefix'i bu dizi ile eslesiyor mu?
    let matches = true
    for (let i = 0; i < played.length; i++) {
      if (!sameStep(steps[i], played[i])) {
        matches = false
        break
      }
    }
    if (!matches) continue
    const cand = steps[played.length]
    const key = stepKey(cand)
    if (!seen.has(key)) {
      seen.add(key)
      next.push(cand)
    }
  }
  return next
}

// Bir tasi (from) SADECE o tasi oynatarak ulasabilecegi tum noktalar.
// Doner: hedef -> oraya gitmek icin (played sonrasi eklenecek) step dizisi.
// Boylece 3-5'te tek tik yerine surukleyerek 8'e (birlesik) gidilebilir.
export function reachableFromChecker(
  state: GameState,
  played: Step[],
  from: number | 'bar',
): Map<number | 'off', Step[]> {
  const results = new Map<number | 'off', Step[]>()
  function dfs(cur: number | 'bar', extra: Step[]) {
    const next = legalNextSteps(state, [...played, ...extra]).filter((s) => s.from === cur)
    for (const st of next) {
      const seq = [...extra, st]
      // Ayni hedefe daha kisa yol varsa koru (ilk bulunan = en az adim)
      if (!results.has(st.to)) results.set(st.to, seq)
      if (st.to !== 'off') dfs(st.to, seq)
    }
  }
  dfs(from, [])
  return results
}

// KAPI yapilabilen hedefler: bos bir haneye (oyuncunun tasindan BOS) eldeki zarlarla IKI tas
// getirilip kapi (2+ tas) yapilabiliyor mu? Her hedef -> [s1, s2] (iki farkli tasin o haneye inisi,
// played sonrasina eklenir). Her zar icin hedefe giden kaynak TEKtir (geometri) -> secim belirsiz degil.
// Rakip blot'a inis = vurma (legalNextSteps zaten izin verir). UI: bos haneye dokununca otomatik oynanir.
export function makePointTargets(state: GameState, played: Step[]): Map<number, Step[]> {
  // Hedefin "su an kendi tasindan bos" kontrolu played SONRASI tahtada yapilir (cift zarda tur ortasi).
  const working = cloneState(state)
  for (const st of played) applyStep(working, st, working.turn)
  const own = state.turn

  const map = new Map<number, Step[]>()
  for (const s1 of legalNextSteps(state, played)) {
    if (typeof s1.to !== 'number' || map.has(s1.to)) continue
    if (countAt(working.points, s1.to, own) !== 0) continue // zaten kendi hanen/blot -> kapi "yapma" degil
    const s2 = legalNextSteps(state, [...played, s1]).find((s) => s.to === s1.to)
    if (s2) map.set(s1.to, [s1, s2])
  }
  return map
}

// Prefix tamamlandi mi? (bu prefix'e tam olarak esit bir dizi var mi)
export function isTurnComplete(state: GameState, played: Step[]): boolean {
  const sequences = allMaximalSequences(state)
  return sequences.some(
    (steps) => steps.length === played.length && steps.every((s, i) => sameStep(s, played[i])),
  )
}

function sameStep(a: Step, b: Step): boolean {
  return a.from === b.from && a.to === b.to && a.die === b.die
}

function stepKey(s: Step): string {
  return `${s.from}-${s.to}-${s.die}`
}

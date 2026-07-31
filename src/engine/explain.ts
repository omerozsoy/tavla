// Bir hamlenin "neden iyi" oldugunu aciklayan sezgisel gerekcelerici.
// i18n anahtarlari + parametreler dondurur (why.*), boylece cok dilli calisir.
import type { GameState, Move, Player } from './types'
import { cloneState } from './board'
import { applyStep } from './moves'

export interface Reason {
  key: string
  params?: Record<string, number>
}

const sign = (p: Player) => (p === 'white' ? 1 : -1)
const isHome = (p: Player, i: number) => (p === 'white' ? i <= 5 : i >= 18)

// mover'in tek tasi (blot) sayisi (0..23 uzerinde)
function blotCount(state: GameState, p: Player): number {
  const s = sign(p)
  let n = 0
  for (let i = 0; i < 24; i++) if (state.points[i] === s) n++
  return n
}

// mover'in >=2 tasli nokta sayisi
function pointsOwned(state: GameState, p: Player): Set<number> {
  const s = sign(p)
  const set = new Set<number>()
  for (let i = 0; i < 24; i++) if (state.points[i] * s >= 2) set.add(i)
  return set
}

// mover'in en geri (baslangica en yakin) tasinin index'i
function backmost(state: GameState, p: Player): number {
  const s = sign(p)
  if (state.bar[p] > 0) return p === 'white' ? 24 : -1
  if (p === 'white') {
    for (let i = 23; i >= 0; i--) if (state.points[i] * s >= 1) return i
  } else {
    for (let i = 0; i < 24; i++) if (state.points[i] * s >= 1) return i
  }
  return -1
}

export function explainMove(before: GameState, move: Move, mover: Player): Reason[] {
  const opp = sign(mover) * -1
  const reasons: Reason[] = []

  // Adim adim uygula, vurmalari yakala
  const work = cloneState(before)
  let hits = 0
  let bearOff = 0
  const backBefore = backmost(before, mover)
  let escaped = false
  for (const st of move.steps) {
    if (typeof st.to === 'number' && work.points[st.to] === opp) hits++ // rakip tek tas -> vurma
    if (st.to === 'off') bearOff++
    if (typeof st.from === 'number' && st.from === backBefore) escaped = true
    applyStep(work, st, mover)
  }

  const before2 = pointsOwned(before, mover)
  const after2 = pointsOwned(work, mover)
  const newPoints: number[] = []
  for (const i of after2) if (!before2.has(i)) newPoints.push(i)
  const newHomePoints = newPoints.filter((i) => isHome(mover, i))

  const blotsBefore = blotCount(before, mover)
  const blotsAfter = blotCount(work, mover)

  // Oncelik sirasi: vurma > ev noktasi > nokta > kacis > toplama > guvenli
  if (hits > 0) reasons.push({ key: hits > 1 ? 'why.hitMulti' : 'why.hit', params: { n: hits } })
  if (newHomePoints.length > 0)
    reasons.push({ key: 'why.homePoint', params: { n: newHomePoints.length } })
  else if (newPoints.length > 0)
    reasons.push({ key: 'why.makePoint', params: { n: newPoints.length } })
  if (escaped && backBefore >= 0) reasons.push({ key: 'why.escape' })
  if (bearOff > 0) reasons.push({ key: 'why.bearOff', params: { n: bearOff } })

  if (reasons.length < 2) {
    if (blotsAfter < blotsBefore) reasons.push({ key: 'why.safer' })
    else if (blotsAfter === 0) reasons.push({ key: 'why.noBlots' })
  }
  if (reasons.length === 0) reasons.push({ key: 'why.bestEquity' })

  return reasons.slice(0, 3)
}

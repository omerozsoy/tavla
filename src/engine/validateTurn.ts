// Sunucu-otoriter TUR doğrulama (para maçı güvenliği Faz 2).
//
// Verilen otoriter state (zarı SUNUCU koydu: state.dice) için istemcinin önerdiği tam-tur
// step dizisini, UI ile AYNI motor kurallarıyla (legalNextSteps + isTurnComplete) adım adım
// doğrular. Yasalsa uygular ve sırayı devreder; değilse reddeder. MOTOR/AI çalıştırmaz.
//
// Node validator servisi bu fonksiyonu import eder (tek gerçek: TS motoru; PHP↔TS sapması YOK).

import type { GameState, Step } from './types'
import { generateMoves, hasNoMove, applyStep } from './moves'
import { legalNextSteps, isTurnComplete } from './game'
import { cloneState, opponent } from './board'

export interface ValidateTurnResult {
  valid: boolean
  state?: GameState // yalnız valid iken: uygulanmış + sıra devredilmiş yeni durum
  reason?: string
}

function sameStep(a: Step, b: Step): boolean {
  return a.from === b.from && a.to === b.to && a.die === b.die
}

// Sırayı rakibe devret, zarı temizle (uygulama sonrası ortak).
function endTurn(state: GameState): GameState {
  const s = cloneState(state)
  s.turn = opponent(s.turn)
  s.dice = []
  s.diceUsed = []
  return s
}

export function validateTurn(state: GameState, steps: Step[] | null | undefined): ValidateTurnResult {
  const proposed = steps ?? []

  // Boş tur (pas): YALNIZCA gerçekten yasal hamle yoksa (dance) geçerli.
  if (proposed.length === 0) {
    const legal = generateMoves(state)
    if (hasNoMove(legal)) {
      return { valid: true, state: endTurn(state) }
    }
    return { valid: false, reason: 'moves-available' } // hamle varken pas geçilemez
  }

  // Adım adım yasallık: her step, o ana kadar oynananların ardından legalNextSteps içinde olmalı.
  const played: Step[] = []
  for (const step of proposed) {
    const opts = legalNextSteps(state, played)
    if (!opts.some((o) => sameStep(o, step))) {
      return { valid: false, reason: 'illegal-step' }
    }
    played.push(step)
  }

  // Tur TAM mı? (zorunlu maksimum sayıda zar kullanılmış olmalı — eksik oynanamaz)
  if (!isTurnComplete(state, played)) {
    return { valid: false, reason: 'turn-incomplete' }
  }

  // Uygula + sırayı devret.
  const s = cloneState(state)
  for (const step of played) {
    applyStep(s, step, s.turn)
  }
  return { valid: true, state: endTurn(s) }
}

import { describe, it, expect } from 'vitest'
import { computeSummary } from './MatReview'
import type { LogEntry } from './MatchReport'

// prAdjustedEquityLoss (maç-bağlamlı) + countsForPR'a saygı: özet PR otoriter gnubg_pr ile
// aynı mantıkta hesaplanmalı. Oyun kararlaşmış (prAdjusted=0) hamle cezalandırılmamalı;
// zorunlu (countsForPR=false) hamle paydaya girmemeli.
const mk = (p: Partial<LogEntry>): LogEntry =>
  ({ notation: '8/4', best: '8/4', loss: 0, pos: {} as any, player: 'white', ...p }) as LogEntry

describe('computeSummary PR (match-aware)', () => {
  const log: LogEntry[] = [
    mk({ loss: 0.05, prAdjustedEquityLoss: 0.05, countsForPR: true }), // gerçek hata
    mk({ loss: 0.3, prAdjustedEquityLoss: 0, countsForPR: true }), // oyun kararlaşmış -> cezasız
    mk({ loss: 0.2, countsForPR: false }), // zorunlu -> sayılmaz
  ]
  const white = computeSummary(log, ['W', 'B'], 0).players[0]

  it('zorunlu hamleyi paydadan çıkarır', () => {
    expect(white.decisions).toBe(2)
  })
  it('yalnız maç-bağlamlı kaybı toplar (kararlaşmış hamle 0)', () => {
    expect(white.equityLost).toBeCloseTo(0.05, 6)
    expect(white.blunders).toBe(0) // ham 0.30/0.20 blunder DEĞİL (prAdjusted 0 / sayılmaz)
    expect(white.errors).toBe(1)
  })
  it('PR (xr) = (kayıp/karar)×500', () => {
    expect(white.xr).toBeCloseTo((0.05 / 2) * 500, 4) // 12.5, eski ham mantık ~91.6 verirdi
  })
})

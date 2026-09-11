// PR DEBUG modu (§13) — kapalıyken SIFIR maliyet. Açmak için tarayıcı konsolunda:
//   localStorage.setItem('tavla.prdebug','1')   (kapatmak: '0' / removeItem)
// Her checker kararı prDebugRecord ile toplanır; maç sonunda prDebugSummary(player) konsola
// karar tablosu + toplam/ortalama/PR basar. Böylece XG ile hamle-hamle karşılaştırılabilir.
//
// NOT: buradaki equity/loss motorun (wildbg) değerleridir; 1-puanlık maçta win-prob equity
// kullanılır (prMatchEquity). Sunucu-otoriter XG referansı için: artisan tavla:gnubg-pr.

export interface PrDebugEntry {
  player: 'white' | 'black'
  turn: number // seq (turnsPlayed)
  dice: number[]
  played: string // oynanan hamle notasyonu
  best: string // en iyi hamle notasyonu
  bestEquity: number
  playedEquity: number
  equityLoss: number // normalizedEquityLoss (best − played, ≥0)
  forced: boolean // tek legal play (PR'a girmez)
  countedInPR: boolean // obvious/forced değil -> paydaya girer
}

let entries: PrDebugEntry[] = []

export function prDebugEnabled(): boolean {
  try {
    return localStorage.getItem('tavla.prdebug') === '1'
  } catch {
    return false
  }
}

export function prDebugReset(): void {
  entries = []
}

export function prDebugRecord(e: PrDebugEntry): void {
  if (!prDebugEnabled()) return
  entries.push(e)
  // Anlık tek satır (ayrıntı istenirse); toplu tablo maç sonunda.
  // eslint-disable-next-line no-console
  console.debug(
    `[PR] ${e.player} t${e.turn} ${e.dice.join('')} played=${e.played} best=${e.best} ` +
      `loss=${e.equityLoss.toFixed(4)} ${e.forced ? 'FORCED' : e.countedInPR ? 'counted' : 'obvious'}`,
  )
}

// Maç sonu özeti: oyuncu başına tablo + toplam/ortalama/PR. player verilmezse ikisi de.
export function prDebugSummary(player?: 'white' | 'black'): void {
  if (!prDebugEnabled()) return
  const players: ('white' | 'black')[] = player ? [player] : ['white', 'black']
  for (const p of players) {
    const rows = entries.filter((e) => e.player === p)
    if (rows.length === 0) continue
    const counted = rows.filter((e) => e.countedInPR)
    const forced = rows.filter((e) => e.forced).length
    const totalLoss = counted.reduce((s, e) => s + e.equityLoss, 0)
    const avg = counted.length > 0 ? totalLoss / counted.length : 0
    const pr = counted.length > 0 ? avg * 500 : null
    // eslint-disable-next-line no-console
    console.log(`\n===== PR DEBUG: ${p} =====`)
    // eslint-disable-next-line no-console
    console.table(
      rows.map((e, i) => ({
        '#': i + 1,
        turn: e.turn,
        dice: e.dice.join(''),
        played: e.played,
        best: e.best,
        bestEq: +e.bestEquity.toFixed(4),
        playedEq: +e.playedEquity.toFixed(4),
        loss: +e.equityLoss.toFixed(4),
        forced: e.forced,
        'PR?': e.countedInPR,
      })),
    )
    // eslint-disable-next-line no-console
    console.log(
      `${p}: total rolls=${rows.length}  forced=${forced}  decisions(counted)=${counted.length}  ` +
        `totalEquityLoss=${totalLoss.toFixed(4)}  avg=${avg.toFixed(4)}  PR=${pr == null ? '—' : pr.toFixed(2)}`,
    )
  }
  entries = [] // özet basıldı -> sonraki maç için sıfırla (rematch temiz başlasın)
}

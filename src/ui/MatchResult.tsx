import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'

type Side = 'white' | 'black'

interface Props {
  winnerName: string
  loserName: string
  winnerAvatar?: string | null
  loserAvatar?: string | null
  winnerColor: Side
  loserColor: Side
  winnerScore: number
  loserScore: number
  winnerPr: number | null
  loserPr: number | null
  // XG kırılım: checker-yalnız + küp-yalnız PR (overall = winnerPr/loserPr). null -> —.
  winnerCheckerPr?: number | null
  winnerCubePr?: number | null
  loserCheckerPr?: number | null
  loserCubePr?: number | null
  winnerBand: string
  loserBand: string
  // Sans (luck): oyuncu-basi birikmis equity sansi. null = hesaplanmadi (—)
  winnerLuck: number | null
  loserLuck: number | null
  // Bahisli macta coin transfer tutari (mutlak); kazanan +, kaybeden -. null = bahissiz
  coinAmount: number | null
  // Rating degisimi (giris yapmis insan icin). Hangi tarafta gosterilecegi:
  ratingBefore: number | null
  ratingAfter: number | null
  ratingIsWinner: boolean // true: rating kazanan tarafta
  oppRating: number | null // rakip rating (online rakip / AI zorluga gore)
  onNewMatch: () => void
  onRematch: () => void
  onHome: () => void
  onStats: () => void
  onAnalysis: () => void
  hasReport: boolean
}

function Avatar({ url, color }: { url?: string | null; color: Side }) {
  return (
    <div className={`mr-avatar ${color}`}>
      {url ? <img src={url} alt="" /> : <span>{color === 'white' ? '🧑‍🚀' : '🐱'}</span>}
    </div>
  )
}

export default function MatchResult({
  winnerName,
  loserName,
  winnerAvatar,
  loserAvatar,
  winnerColor,
  loserColor,
  winnerScore,
  loserScore,
  winnerPr,
  loserPr,
  winnerCheckerPr,
  winnerCubePr,
  loserCheckerPr,
  loserCubePr,
  winnerBand,
  loserBand,
  winnerLuck,
  loserLuck,
  coinAmount,
  ratingBefore,
  ratingAfter,
  ratingIsWinner,
  oppRating,
  onNewMatch,
  onRematch,
  onHome,
  onStats,
  onAnalysis,
  hasReport,
}: Props) {
  const { t } = useT()
  const fmtPr = (p: number | null) => (p == null ? '—' : p.toFixed(2))
  // Dusuk PR daha iyi -> tac dusuk olanda
  const wBetter = winnerPr != null && loserPr != null && winnerPr <= loserPr
  const lBetter = winnerPr != null && loserPr != null && loserPr < winnerPr

  // Rating: insan (rating raporlanan) tarafi degisimli; diger taraf = rakip (online
  // rakip rating / AI zorluk). ratingIsWinner: insan kazanan tarafta mi.
  const ratingText = (winnerSide: boolean) => {
    if (winnerSide === ratingIsWinner && ratingBefore != null && ratingAfter != null) {
      const d = Math.round(ratingAfter - ratingBefore)
      return `${Math.round(ratingAfter)} (${d >= 0 ? '+' : ''}${d})`
    }
    return oppRating != null ? String(Math.round(oppRating)) : '—'
  }
  // Sans (luck) ZERO-SUM: iki taraf da biliniyorsa goreceli sansi goster
  // (kazanan - kaybeden, zit isaretli) -> toplam 0 VE iki istemcide ayni deger
  // (ikisi de ham degerlere sahip). Tek taraf biliniyorsa digeri onun negatifi.
  let wLuck: number | null
  let lLuck: number | null
  if (winnerLuck != null && loserLuck != null) {
    const net = winnerLuck - loserLuck
    wLuck = net
    lLuck = -net
  } else {
    wLuck = winnerLuck ?? (loserLuck != null ? -loserLuck : null)
    lLuck = loserLuck ?? (winnerLuck != null ? -winnerLuck : null)
  }
  // Sans: equity toplamini okunur bir skora olcekle (x100), isaretli goster
  const fmtLuck = (v: number | null) => {
    if (v == null) return '—'
    const s = Math.round(v * 100)
    return `${s >= 0 ? '+' : ''}${s}`
  }
  const fmtCoins = (isWinner: boolean) =>
    coinAmount == null ? '—' : `${isWinner ? '+' : '-'}${coinAmount} GC`

  return (
    <div className="register-overlay modal mr-overlay">
      <div className="mr-card">
        <div className="mr-head">
          <div className="mr-player">
            <div className="mr-role win">{t('mr.winner')} <Icon name="crown" size={16} /></div>
            <Avatar url={winnerAvatar} color={winnerColor} />
            <div className="mr-name">
              <span className={`dot ${winnerColor}`} /> {winnerName}
            </div>
          </div>

          <div className="mr-center">
            <div className="mr-title">{t('mr.title')}</div>
            <div className="mr-score">
              <span>{winnerScore}</span>
              <em>–</em>
              <span>{loserScore}</span>
            </div>
          </div>

          <div className="mr-player">
            <div className="mr-role">{t('mr.loser')}</div>
            <Avatar url={loserAvatar} color={loserColor} />
            <div className="mr-name">
              <span className={`dot ${loserColor}`} /> {loserName}
            </div>
          </div>
        </div>

        <div className="mr-table">
          <div className="mr-row">
            <span className="mr-a">{winnerBand}</span>
            <span className="mr-label">{t('mr.level')}</span>
            <span className="mr-b">{loserBand}</span>
          </div>
          <div className="mr-row">
            <span className="mr-a">
              {fmtPr(winnerPr)} {wBetter && <Icon name="crown" size={14} />}
            </span>
            <span className="mr-label">{t('mr.errorRate')}</span>
            <span className="mr-b">
              {fmtPr(loserPr)} {lBetter && <Icon name="crown" size={14} />}
            </span>
          </div>
          {/* XG kırılım: checker (oyun) + küp PR. Küp satırı yalnız küp kararı varsa görünür. */}
          <div className="mr-row mr-sub">
            <span className="mr-a">{fmtPr(winnerCheckerPr ?? null)}</span>
            <span className="mr-label">{t('mr.checkerPr')}</span>
            <span className="mr-b">{fmtPr(loserCheckerPr ?? null)}</span>
          </div>
          {(winnerCubePr != null || loserCubePr != null) && (
            <div className="mr-row mr-sub">
              <span className="mr-a">{fmtPr(winnerCubePr ?? null)}</span>
              <span className="mr-label">{t('mr.cubePr')}</span>
              <span className="mr-b">{fmtPr(loserCubePr ?? null)}</span>
            </div>
          )}
          <div className="mr-row">
            <span className="mr-a">{ratingText(true)}</span>
            <span className="mr-label">{t('mr.rating')}</span>
            <span className="mr-b">{ratingText(false)}</span>
          </div>
          {coinAmount != null && (
            <div className="mr-row">
              <span className="mr-a mr-pos">{fmtCoins(true)}</span>
              <span className="mr-label">{t('mr.coins')}</span>
              <span className="mr-b mr-neg">{fmtCoins(false)}</span>
            </div>
          )}
          <div className="mr-row">
            <span className={`mr-a ${(wLuck ?? 0) >= 0 ? 'mr-pos' : 'mr-neg'}`}>
              {fmtLuck(wLuck)}
            </span>
            <span className="mr-label">{t('mr.luck')}</span>
            <span className={`mr-b ${(lLuck ?? 0) >= 0 ? 'mr-pos' : 'mr-neg'}`}>
              {fmtLuck(lLuck)}
            </span>
          </div>
        </div>

        {hasReport && (
          <div className="mr-actions mr-report-actions">
            <Button variant="outline" onClick={onAnalysis}>
              <Icon name="search" /> {t('mr.analysis')}
            </Button>
            <Button variant="outline" onClick={onStats}>
              <Icon name="chart" /> {t('mr.stats')}
            </Button>
          </div>
        )}
        <div className="mr-actions">
          <Button variant="default" onClick={onRematch}>
            <Icon name="refresh" /> {t('mr.rematch')}
          </Button>
          <Button variant="outline" onClick={onNewMatch}>
            {t('mr.newMatch')}
          </Button>
          <Button variant="outline" onClick={onHome}>
            <Icon name="home" /> {t('home.title')}
          </Button>
        </div>
      </div>
    </div>
  )
}

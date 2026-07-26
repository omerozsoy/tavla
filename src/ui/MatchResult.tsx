import { useT } from '../i18n'

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
  winnerBand: string
  loserBand: string
  // Rating degisimi (giris yapmis insan icin). Hangi tarafta gosterilecegi:
  ratingBefore: number | null
  ratingAfter: number | null
  ratingIsWinner: boolean // true: rating kazanan tarafta
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
  winnerBand,
  loserBand,
  ratingBefore,
  ratingAfter,
  ratingIsWinner,
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

  const ratingCell = (isThisSide: boolean) => {
    if (!isThisSide || ratingBefore == null || ratingAfter == null) return '—'
    const d = Math.round(ratingAfter - ratingBefore)
    const sign = d >= 0 ? '+' : ''
    return `${Math.round(ratingAfter)} (${sign}${d})`
  }

  return (
    <div className="register-overlay modal mr-overlay">
      <div className="mr-card">
        <div className="mr-head">
          <div className="mr-player">
            <div className="mr-role win">{t('mr.winner')} 👑</div>
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
              {fmtPr(winnerPr)} {wBetter && '👑'}
            </span>
            <span className="mr-label">{t('mr.errorRate')}</span>
            <span className="mr-b">
              {fmtPr(loserPr)} {lBetter && '👑'}
            </span>
          </div>
          <div className="mr-row">
            <span className="mr-a">{ratingCell(ratingIsWinner)}</span>
            <span className="mr-label">{t('mr.rating')}</span>
            <span className="mr-b">{ratingCell(!ratingIsWinner)}</span>
          </div>
        </div>

        {hasReport && (
          <div className="mr-actions mr-report-actions">
            <button className="menu-btn" onClick={onAnalysis}>
              🔍 {t('mr.analysis')}
            </button>
            <button className="menu-btn" onClick={onStats}>
              📊 {t('mr.stats')}
            </button>
          </div>
        )}
        <div className="mr-actions">
          <button className="galaxy-btn roll" onClick={onRematch}>
            🔄 {t('mr.rematch')}
          </button>
          <button className="menu-btn" onClick={onNewMatch}>
            {t('mr.newMatch')}
          </button>
          <button className="menu-btn" onClick={onHome}>
            🏠 {t('home.title')}
          </button>
        </div>
      </div>
    </div>
  )
}

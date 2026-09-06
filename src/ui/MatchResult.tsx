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
  // Tavlai Luck V1 (gnubg NATIVE MWC-luck, YÜZDE): İKİSİ de doluysa BAĞIMSIZ % gösterilir
  // (sıfır-toplam DEĞİL — her oyuncu kendi zarlarından). null -> yukarıdaki ham luck (net) fallback.
  winnerLuckPct?: number | null
  loserLuckPct?: number | null
  // Bahisli macta coin transfer tutari (mutlak); kazanan +, kaybeden -. null = bahissiz
  coinAmount: number | null
  // Rating degisimi (giris yapmis insan icin). Hangi tarafta gosterilecegi:
  ratingBefore: number | null
  ratingAfter: number | null
  ratingIsWinner: boolean // true: rating kazanan tarafta
  oppRating: number | null // rakip rating (online rakip / AI zorluga gore) — maç ÖNCESİ
  // Rakip rating değişimi (online puanlı maçta). Elo sıfır-toplamlı -> = -(kendi delta). null ->
  // gösterme (pvb/AI kalıcı rating yok, veya puansız). Her iki ekranda TUTARLI (deterministik).
  oppRatingDelta?: number | null
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
  winnerLuckPct,
  loserLuckPct,
  coinAmount,
  ratingBefore,
  ratingAfter,
  ratingIsWinner,
  oppRating,
  oppRatingDelta,
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
    // KENDİ tarafı: sunucudan gelen before/after.
    if (winnerSide === ratingIsWinner) {
      if (ratingBefore != null && ratingAfter != null) {
        const d = Math.round(ratingAfter - ratingBefore)
        return d !== 0 ? `${Math.round(ratingAfter)} (${d >= 0 ? '+' : ''}${d})` : String(Math.round(ratingAfter))
      }
      return oppRating != null ? String(Math.round(oppRating)) : '—'
    }
    // RAKİP tarafı: Elo sıfır-toplamlı -> rakip delta = -(kendi delta); after = oppRating(before) + delta.
    // Böylece HER İKİ ekranda iki tarafın rating değişimi TUTARLI görünür (kullanıcı isteği).
    if (oppRating != null) {
      if (oppRatingDelta != null && oppRatingDelta !== 0) {
        return `${Math.round(oppRating + oppRatingDelta)} (${oppRatingDelta >= 0 ? '+' : ''}${oppRatingDelta})`
      }
      return String(Math.round(oppRating))
    }
    return '—'
  }
  // Tavlai Luck V1: gnubg NATIVE MWC-luck (%) İKİSİ de doluysa onu göster — BAĞIMSIZ per-oyuncu
  // (sıfır-toplam DEĞİL; gnubg metodolojisi: her oyuncu kendi zarlarından). Yoksa ham luck (net).
  const useGnubgPct = winnerLuckPct != null && loserLuckPct != null
  // Ham (fallback) ZERO-SUM net: iki taraf biliniyorsa göreceli (zıt işaretli); tek taraf -> negatifi.
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
  // Ham sans: equity toplamini okunur bir skora olcekle (x100), isaretli goster
  const fmtLuck = (v: number | null) => {
    if (v == null) return '—'
    const s = Math.round(v * 100)
    return `${s >= 0 ? '+' : ''}${s}`
  }
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}%`
  // Gösterilecek metin + işaret: gnubg % (bağımsız) ya da ham net (fallback).
  const wLuckText = useGnubgPct ? fmtPct(winnerLuckPct as number) : fmtLuck(wLuck)
  const lLuckText = useGnubgPct ? fmtPct(loserLuckPct as number) : fmtLuck(lLuck)
  const wLuckPos = useGnubgPct ? (winnerLuckPct as number) >= 0 : (wLuck ?? 0) >= 0
  const lLuckPos = useGnubgPct ? (loserLuckPct as number) >= 0 : (lLuck ?? 0) >= 0
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
          {/* XG kırılım YALNIZ küp kararı varsa (aksi halde Oyun PR = Hata Oranı -> gereksiz/karışık).
              Küp varken: Hata Oranı=genel, Oyun PR=checker, Küp PR=cube (üçü de anlamlı + farklı). */}
          {(winnerCubePr != null || loserCubePr != null) && (
            <>
              <div className="mr-row mr-sub">
                <span className="mr-a">{fmtPr(winnerCheckerPr ?? null)}</span>
                <span className="mr-label">{t('mr.checkerPr')}</span>
                <span className="mr-b">{fmtPr(loserCheckerPr ?? null)}</span>
              </div>
              <div className="mr-row mr-sub">
                <span className="mr-a">{fmtPr(winnerCubePr ?? null)}</span>
                <span className="mr-label">{t('mr.cubePr')}</span>
                <span className="mr-b">{fmtPr(loserCubePr ?? null)}</span>
              </div>
            </>
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
            <span className={`mr-a ${wLuckPos ? 'mr-pos' : 'mr-neg'}`}>
              {wLuckText}
            </span>
            <span className="mr-label">{t('mr.luck')}</span>
            <span className={`mr-b ${lLuckPos ? 'mr-pos' : 'mr-neg'}`}>
              {lLuckText}
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

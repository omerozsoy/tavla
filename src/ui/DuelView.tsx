import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { duelLeaderboard, leaderboard, type DuelIndividualRow, type DuelTeamRow, type LeaderRow } from '../api'
import { OnlinePlayersPanel } from './HomePanels'
import { CountryFlag } from './Flag'
import Loading from './Loading'

type Target = { id: number; name: string; avatar?: string | null; rating?: number | null }

interface Props {
  currentName?: string
  currentId?: number
  onClose: () => void
  onProfile: (id: number) => void
  // Düello davetini gönder (App.tsx davet+bekleme akışına bağlar). points ∈ {1,3,5}.
  onDuel: (p: Target, points: 1 | 3 | 5) => void
  titleOverride?: string
}

export default function DuelView({ currentName, currentId, onClose, onProfile, onDuel, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [pick, setPick] = useState<Target | null>(null) // uzunluk seçimi bekleyen rakip
  const [tab, setTab] = useState<'individual' | 'teams' | 'rating'>('individual')
  const [board, setBoard] = useState<{ individual: DuelIndividualRow[]; teams: DuelTeamRow[] } | null>(null)
  const [ratingRows, setRatingRows] = useState<LeaderRow[] | null>(null)

  useEffect(() => {
    let alive = true
    duelLeaderboard(100).then((d) => alive && setBoard(d)).catch(() => alive && setBoard({ individual: [], teams: [] }))
    return () => { alive = false }
  }, [])

  // Rating sekmesi: mevcut rating liderlik tablosundan (tembel: sekmeye ilk geçişte çek).
  useEffect(() => {
    if (tab !== 'rating' || ratingRows) return
    let alive = true
    leaderboard(100, 'rating').then((r) => alive && setRatingRows(r)).catch(() => alive && setRatingRows([]))
    return () => { alive = false }
  }, [tab, ratingRows])

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card duel-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <div className="lb-header">
          <h2><Icon name="sword" size={20} /> {titleOverride || t('duel.title')}</h2>
        </div>
        <p className="duel-intro">{t('duel.intro')}</p>

        {/* Çevrimiçi oyuncular: her birine "Düello" -> uzunluk seçici -> davet gönder (mevcut OnlinePlayersPanel). */}
        <section className="duel-online">
          <h3>{t('duel.online')}</h3>
          <OnlinePlayersPanel
            currentName={currentName}
            currentId={currentId}
            onProfile={onProfile}
            onInvite={currentId ? (p) => setPick(p) : undefined}
          />
        </section>

        {/* 3 sekmeli sıralama: Bireysel / Takımlar / Rating */}
        <div className="rep-filter">
          <Button variant={tab === 'individual' ? 'default' : 'ghost'} aria-pressed={tab === 'individual'} onClick={() => setTab('individual')}>
            <Icon name="sword" size={16} /> {t('duel.tab.individual')}
          </Button>
          <Button variant={tab === 'teams' ? 'default' : 'ghost'} aria-pressed={tab === 'teams'} onClick={() => setTab('teams')}>
            <Icon name="users-group" size={16} /> {t('duel.tab.teams')}
          </Button>
          <Button variant={tab === 'rating' ? 'default' : 'ghost'} aria-pressed={tab === 'rating'} onClick={() => setTab('rating')}>
            <Icon name="star" size={16} /> {t('duel.tab.rating')}
          </Button>
        </div>

        {tab === 'individual' && (
          board === null ? <Loading /> : board.individual.length === 0 ? <p className="duel-empty">{t('duel.empty')}</p> : (
            <div className="duel-rank">
              {board.individual.map((r, i) => (
                <div key={r.user_id} className={`lb-row clickable ${i < 3 ? 'top' : ''}`} onClick={() => onProfile(r.user_id)}>
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name">{r.nickname}</span>
                  <span className="lb-rating">{r.rating}</span>
                  <span className="lb-wl"><b className="lb-win">{r.wins}</b> {t('duel.wins')}</span>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'teams' && (
          board === null ? <Loading /> : board.teams.length === 0 ? <p className="duel-empty">{t('duel.emptyTeams')}</p> : (
            <div className="duel-rank">
              {board.teams.map((r, i) => (
                <div key={r.team_id} className={`lb-row ${i < 3 ? 'top' : ''}`}>
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name">{r.name} <small>[{r.tag}]</small></span>
                  <span className="lb-wl"><b className="lb-win">{r.wins}</b> {t('duel.wins')}</span>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'rating' && (
          ratingRows === null ? <Loading /> : (
            <div className="duel-rank">
              {ratingRows.map((r) => (
                <div key={r.id ?? r.rank} className={`lb-row ${r.id ? 'clickable' : ''}`} onClick={() => r.id && onProfile(r.id)}>
                  <span className="lb-rank">{r.rank}</span>
                  <span className="lb-name">{r.name}</span>
                  <span className="lb-flag"><CountryFlag code={r.country} size={22} /></span>
                  <span className="lb-rating">{r.rating}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Uzunluk seçici: 1/3/5 puan -> davet gönder */}
      {pick && (
        <div className="duel-picker-backdrop" onClick={() => setPick(null)}>
          <div className="register-card duel-picker" onClick={(e) => e.stopPropagation()}>
            <h3>{pick.name}</h3>
            <p>{t('duel.pickPoints')}</p>
            <div className="duel-picker-row">
              {([1, 3, 5] as const).map((n) => (
                <Button key={n} variant="default" onClick={() => { const p = pick; setPick(null); onDuel(p, n) }}>
                  {t('duel.points', { n })}
                </Button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setPick(null)}>{t('common.close')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

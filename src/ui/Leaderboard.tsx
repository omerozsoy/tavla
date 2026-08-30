import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { leaderboard, type LeaderRow } from '../api'
import AvatarFrame from './AvatarFrame'
import PublicProfile from './PublicProfile'
import { Skeleton } from './Skeleton'
import { DivisionChip } from './Badges'

interface Props {
  currentName?: string
  onClose: () => void
}

export default function Leaderboard({ currentName, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [error, setError] = useState(false)
  const [by, setBy] = useState<'rating' | 'coins' | 'wxp'>('rating')
  const [profileId, setProfileId] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError(false)
    // Her tab: top 30 oyuncu
    leaderboard(30, by === 'coins' ? 'coins' : by === 'wxp' ? 'wxp' : 'rating')
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [by])

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '')

  const renderRow = (r: LeaderRow) => {
    const wr = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0
    const mine = currentName && r.name === currentName
    return (
      <div
        key={r.rank}
        className={`lb-row ${mine ? 'mine' : ''} ${r.rank <= 3 ? 'top' : ''} ${r.id ? 'clickable' : ''}`}
        onClick={() => r.id && setProfileId(r.id)}
      >
        <span className="lb-rank">{medal(r.rank) || r.rank}</span>
        <span className="lb-name">
          <AvatarFrame src={r.avatar} frame={r.frame} size={30} name={r.name} animated={false} />
          {r.name}
          {/* Lig unvani her tabda yazili (Puan sekmesinde tam ad, digerlerinde kompakt) */}
          <DivisionChip rating={r.rating} size={by === 'rating' ? 'md' : 'sm'} />
        </span>
        <span className="lb-games">{r.games}</span>
        <span className="lb-wr">{r.games > 0 ? `%${wr}` : '–'}</span>
        <span className="lb-rating">
          {by === 'coins' ? (r.coins ?? 0) : by === 'wxp' ? (r.wxp ?? 0) : r.rating}
        </span>
      </div>
    )
  }

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card leaderboard-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2><Icon name="trophy" size={20} /> {t('lb.title')}</h2>
        <div className="rep-filter">
          <Button variant={by === 'rating' ? 'secondary' : 'ghost'} onClick={() => setBy('rating')}>
            <Icon name="star" size={16} /> {t('lb.rating')}
          </Button>
          <Button variant={by === 'coins' ? 'secondary' : 'ghost'} onClick={() => setBy('coins')}>
            <Icon name="coin" size={16} /> {t('lb.byCoins')}
          </Button>
          <Button variant={by === 'wxp' ? 'secondary' : 'ghost'} onClick={() => setBy('wxp')}>
            <Icon name="trophy" size={16} /> {t('lb.byWxp')}
          </Button>
        </div>

        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && rows === null && (
          <div className="lb-table" aria-busy="true" aria-live="polite">
            <div className="lb-head">
              <span className="lb-rank">#</span>
              <span className="lb-name">{t('lb.player')}</span>
              <span className="lb-games">{t('lb.games')}</span>
              <span className="lb-wr">{t('lb.winRate')}</span>
              <span className="lb-rating">
                {by === 'coins' ? <Icon name="coin" size={14} /> : by === 'wxp' ? t('lb.byWxp') : t('lb.rating')}
              </span>
            </div>
            <div className="lb-body">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="lb-row">
                  <span className="lb-rank"><Skeleton w={16} h={16} r={4} /></span>
                  <span className="lb-name">
                    <Skeleton w={22} h={22} r="50%" />
                    <Skeleton w={90 + ((i * 17) % 50)} h={12} />
                  </span>
                  <span className="lb-games"><Skeleton w={24} h={12} /></span>
                  <span className="lb-wr"><Skeleton w={30} h={12} /></span>
                  <span className="lb-rating"><Skeleton w={36} h={12} /></span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!error && rows !== null && rows.length === 0 && (
          <div className="lb-empty">{t('lb.empty')}</div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="lb-table">
            <div className="lb-head">
              <span className="lb-rank">#</span>
              <span className="lb-name">{t('lb.player')}</span>
              <span className="lb-games">{t('lb.games')}</span>
              <span className="lb-wr">{t('lb.winRate')}</span>
              <span className="lb-rating">
                {by === 'coins' ? <Icon name="coin" size={14} /> : by === 'wxp' ? t('lb.byWxp') : t('lb.rating')}
              </span>
            </div>
            <div className="lb-body">{rows.map(renderRow)}</div>
          </div>
        )}
      </div>
      {profileId !== null && (
        <PublicProfile id={profileId} onClose={() => setProfileId(null)} />
      )}
    </div>
  )
}

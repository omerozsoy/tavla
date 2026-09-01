import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { leaderboard, wxpBreakdown, type LeaderRow, type WxpBreakdown } from '../api'
import PlayerIdentity from './PlayerIdentity'
import PublicProfile from './PublicProfile'
import { Skeleton } from './Skeleton'

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
  const [wxpInfo, setWxpInfo] = useState<WxpBreakdown | null>(null)
  const [wxpOpen, setWxpOpen] = useState(false) // "WXP nasil hesaplanir?" varsayilan kapali

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

  // WXP sekmesi: kendi WXP kirilimini getir (yalniz giris yapmis kullanici)
  useEffect(() => {
    if (by !== 'wxp' || !currentName) {
      setWxpInfo(null)
      return
    }
    let alive = true
    wxpBreakdown()
      .then((w) => alive && setWxpInfo(w))
      .catch(() => alive && setWxpInfo(null))
    return () => {
      alive = false
    }
  }, [by, currentName])

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '')
  const wxpCatLabel = (key: string) => (key === 'coin' ? t('wxpbd.coin') : `${key} ${t('wxpbd.point')}`)

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
          <PlayerIdentity
            name={r.name}
            rating={r.rating}
            avatar={r.avatar}
            frame={r.frame}
            country={r.country}
            size={30}
            rankSize="md"
          />
        </span>
        <span className="lb-games">
          {r.games} <small>{t('lb.gamesUnit')}</small>
        </span>
        <span className="lb-wl">
          <b className="lb-win">{r.wins}</b>
          <span className="lb-slash">/</span>
          <span className="lb-loss">{r.losses}</span>
        </span>
        <span className="lb-wr">{r.games > 0 ? `%${wr}` : '–'}</span>
        <span className="lb-rating">
          {by === 'coins'
            ? (r.coins ?? 0).toLocaleString('tr-TR')
            : by === 'wxp'
              ? (r.wxp ?? 0).toLocaleString('tr-TR')
              : r.rating}
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
        <h2><Icon name="crown" size={20} /> {t('lb.title')}</h2>
        <div className="rep-filter">
          <Button variant={by === 'rating' ? 'default' : 'ghost'} aria-pressed={by === 'rating'} onClick={() => setBy('rating')}>
            <Icon name="star" size={16} /> {t('lb.rating')}
          </Button>
          <Button variant={by === 'coins' ? 'default' : 'ghost'} aria-pressed={by === 'coins'} onClick={() => setBy('coins')}>
            <Icon name="coin" size={16} /> {t('lb.byCoins')}
          </Button>
          <Button variant={by === 'wxp' ? 'default' : 'ghost'} aria-pressed={by === 'wxp'} onClick={() => setBy('wxp')}>
            <Icon name="trophy" size={16} /> {t('lb.byWxp')}
          </Button>
        </div>

        {by === 'wxp' && (
          <div className={`wxp-bd ${wxpOpen ? 'open' : ''}`}>
            <button
              type="button"
              className="wxp-bd-head"
              onClick={() => setWxpOpen((o) => !o)}
              aria-expanded={wxpOpen}
            >
              <Icon name="trophy" size={15} />
              <span className="wxp-bd-title">{t('wxpbd.title')}</span>
              <Icon name="chevron" size={16} className="wxp-bd-chev" />
            </button>
            {wxpOpen && (
              <>
                <p className="wxp-bd-desc">{t('wxpbd.desc')}</p>
                {wxpInfo && (
              <div className="wxp-bd-grid">
                <div className="wxp-bd-row wxp-bd-hrow">
                  <span className="wxp-bd-cat">{t('wxpbd.category')}</span>
                  <span className="wxp-bd-calc">{t('wxpbd.calc')}</span>
                  <span className="wxp-bd-sum">WXP</span>
                </div>
                {wxpInfo.categories.map((c) => (
                  <div key={c.key} className={`wxp-bd-row ${c.wins === 0 ? 'zero' : ''}`}>
                    <span className="wxp-bd-cat">{wxpCatLabel(c.key)}</span>
                    <span className="wxp-bd-calc">
                      {c.wins} <em>{t('wxpbd.wins')}</em> × {c.per}
                    </span>
                    <span className="wxp-bd-sum">{c.wxp}</span>
                  </div>
                ))}
                <div className="wxp-bd-row wxp-bd-total">
                  <span className="wxp-bd-cat">{t('wxpbd.total')}</span>
                  <span className="wxp-bd-calc" />
                  <span className="wxp-bd-sum">{wxpInfo.total}</span>
                </div>
              </div>
                )}
              </>
            )}
          </div>
        )}

        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && rows === null && (
          <div className="lb-table" aria-busy="true" aria-live="polite">
            <div className="lb-head">
              <span className="lb-rank">#</span>
              <span className="lb-name">{t('lb.player')}</span>
              <span className="lb-games">{t('lb.games')}</span>
              <span className="lb-wl">{t('lb.winLoss')}</span>
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
                  <span className="lb-games"><Skeleton w={36} h={12} /></span>
                  <span className="lb-wl"><Skeleton w={40} h={12} /></span>
                  <span className="lb-wr"><Skeleton w={28} h={12} /></span>
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
              <span className="lb-wl">{t('lb.winLoss')}</span>
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

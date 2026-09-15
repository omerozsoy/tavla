import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { leaderboard, prLeaderboard, wxpBreakdown, type LeaderRow, type PrLeaderRow, type WxpBreakdown } from '../api'
import PlayerIdentity from './PlayerIdentity'
import { CountryFlag } from './Flag'
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
  const [by, setBy] = useState<'rating' | 'coins' | 'wxp' | 'pr'>('rating')
  const [prRows, setPrRows] = useState<PrLeaderRow[] | null>(null)
  const [prMeta, setPrMeta] = useState<{ minMatches: number; minDecisions: number } | null>(null)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [wxpInfo, setWxpInfo] = useState<WxpBreakdown | null>(null)
  const [wxpOpen, setWxpOpen] = useState(false) // "WXP nasil hesaplanir?" varsayilan kapali
  const [page, setPage] = useState(0) // 0-tabanli sayfa; her 10 kisi bir sayfa (en fazla 100 kisi = 10 sayfa)

  const PAGE_SIZE = 10
  const MAX_PAGES = 10 // en fazla 100 kisi göster

  useEffect(() => {
    let alive = true
    setError(false)
    setPage(0) // sekme degisince ilk sayfaya dön
    if (by === 'pr') {
      setPrRows(null)
      // PR Sıralaması (Career PR): ilk 100 uygun oyuncu (10'ar sayfalanir)
      prLeaderboard(100)
        .then((r) => {
          if (!alive) return
          setPrRows(r.players)
          setPrMeta({ minMatches: r.minMatches, minDecisions: r.minDecisions })
        })
        .catch(() => alive && setError(true))
      return () => {
        alive = false
      }
    }
    setRows(null)
    // Her tab: ilk 100 oyuncu (10'ar sayfalanir)
    leaderboard(100, by === 'coins' ? 'coins' : by === 'wxp' ? 'wxp' : 'rating')
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

  // Toplam kayittan sayfa sayisi (en fazla MAX_PAGES).
  const pageCount = (total: number) => Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / PAGE_SIZE)))

  // Kibar sayfalama: ‹ 1 2 3 … › — rakamlar + iki yanda ok tuslari.
  const renderPager = (total: number) => {
    const pages = pageCount(total)
    if (pages <= 1) return null
    return (
      <nav className="lb-pager" aria-label={t('lb.pager')}>
        <button
          type="button"
          className="lb-pg-arrow"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          aria-label={t('lb.prev')}
        >
          <Icon name="caret-left" size={16} />
        </button>
        {Array.from({ length: pages }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`lb-pg-num ${i === page ? 'active' : ''}`}
            aria-current={i === page ? 'page' : undefined}
            onClick={() => setPage(i)}
          >
            {i + 1}
          </button>
        ))}
        <button
          type="button"
          className="lb-pg-arrow"
          disabled={page >= pages - 1}
          onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
          aria-label={t('lb.next')}
        >
          <Icon name="caret-right" size={16} />
        </button>
      </nav>
    )
  }

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
            size={26}
            rankSize="sm"
            premium={r.premium}
            animated
          />
        </span>
        <span className="lb-flag">
          <CountryFlag code={r.country} size={16} rounded={false} />
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
          <Button variant={by === 'pr' ? 'default' : 'ghost'} aria-pressed={by === 'pr'} onClick={() => setBy('pr')}>
            <Icon name="target" size={16} /> {t('lb.byPr')}
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
        {by !== 'pr' && !error && rows === null && (
          <div className="lb-table" aria-busy="true" aria-live="polite">
            <div className="lb-head">
              <span className="lb-rank">#</span>
              <span className="lb-name">{t('lb.player')}</span>
              <span className="lb-flag" aria-hidden="true" />
              <span className="lb-games">{t('lb.games')}</span>
              <span className="lb-wl">{t('lb.winLoss')}</span>
              <span className="lb-wr">{t('lb.winRate')}</span>
              <span className="lb-rating">
                {by === 'coins' ? <Icon name="coin" size={14} /> : by === 'wxp' ? t('lb.byWxp') : t('lb.rating')}
              </span>
            </div>
            <div className="lb-body">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="lb-row">
                  <span className="lb-rank"><Skeleton w={16} h={16} r={4} /></span>
                  <span className="lb-name">
                    <Skeleton w={22} h={22} r="50%" />
                    <Skeleton w={90 + ((i * 17) % 50)} h={12} />
                  </span>
                  <span className="lb-flag" aria-hidden="true" />
                  <span className="lb-games"><Skeleton w={36} h={12} /></span>
                  <span className="lb-wl"><Skeleton w={40} h={12} /></span>
                  <span className="lb-wr"><Skeleton w={28} h={12} /></span>
                  <span className="lb-rating"><Skeleton w={36} h={12} /></span>
                </div>
              ))}
            </div>
          </div>
        )}
        {by !== 'pr' && !error && rows !== null && rows.length === 0 && (
          <div className="lb-empty">{t('lb.empty')}</div>
        )}

        {by !== 'pr' && rows !== null && rows.length > 0 && (
          <div className="lb-table">
            <div className="lb-head">
              <span className="lb-rank">#</span>
              <span className="lb-name">{t('lb.player')}</span>
              <span className="lb-flag" aria-hidden="true" />
              <span className="lb-games">{t('lb.games')}</span>
              <span className="lb-wl">{t('lb.winLoss')}</span>
              <span className="lb-wr">{t('lb.winRate')}</span>
              <span className="lb-rating">
                {by === 'coins' ? <Icon name="coin" size={14} /> : by === 'wxp' ? t('lb.byWxp') : t('lb.rating')}
              </span>
            </div>
            <div className="lb-body">{rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map(renderRow)}</div>
          </div>
        )}
        {by !== 'pr' && rows !== null && rows.length > 0 && renderPager(rows.length)}

        {/* PR Sıralaması (Career PR): düşük PR üstte. Sütunlar: Maç / Karar / PR */}
        {by === 'pr' && (
          <>
            {prMeta && (
              <p className="lb-pr-note">
                {t('lb.prNote', { m: String(prMeta.minMatches), d: prMeta.minDecisions.toLocaleString('tr-TR') })}
              </p>
            )}
            {!error && prRows === null && (
              <div className="lb-table lb-pr" aria-busy="true">
                <div className="lb-head">
                  <span className="lb-rank">#</span>
                  <span className="lb-name">{t('lb.player')}</span>
                  <span className="lb-flag" aria-hidden="true" />
                  <span className="lb-games">{t('lb.prMatches')}</span>
                  <span className="lb-wl">{t('lb.prDecisions')}</span>
                  <span className="lb-wr" aria-hidden="true" />
                  <span className="lb-rating">PR</span>
                </div>
                <div className="lb-body">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="lb-row">
                      <span className="lb-rank"><Skeleton w={16} h={16} r={4} /></span>
                      <span className="lb-name">
                        <Skeleton w={22} h={22} r="50%" /> <Skeleton w={90 + ((i * 17) % 50)} h={12} />
                      </span>
                      <span className="lb-flag" aria-hidden="true" />
                      <span className="lb-games"><Skeleton w={36} h={12} /></span>
                      <span className="lb-wl"><Skeleton w={48} h={12} /></span>
                      <span className="lb-wr" aria-hidden="true" />
                      <span className="lb-rating"><Skeleton w={36} h={12} /></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!error && prRows !== null && prRows.length === 0 && (
              <div className="lb-empty">{t('lb.prEmpty')}</div>
            )}
            {prRows !== null && prRows.length > 0 && (
              <div className="lb-table lb-pr">
                <div className="lb-head">
                  <span className="lb-rank">#</span>
                  <span className="lb-name">{t('lb.player')}</span>
                  <span className="lb-flag" aria-hidden="true" />
                  <span className="lb-games">{t('lb.prMatches')}</span>
                  <span className="lb-wl">{t('lb.prDecisions')}</span>
                  <span className="lb-wr" aria-hidden="true" />
                  <span className="lb-rating">PR</span>
                </div>
                <div className="lb-body">
                  {prRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map((r) => {
                    const mine = currentName && r.name === currentName
                    return (
                      <div
                        key={r.rank}
                        className={`lb-row ${mine ? 'mine' : ''} ${r.rank <= 3 ? 'top' : ''} ${r.id ? 'clickable' : ''}`}
                        onClick={() => r.id && setProfileId(r.id)}
                      >
                        <span className="lb-rank">{medal(r.rank) || r.rank}</span>
                        <span className="lb-name">
                          <PlayerIdentity name={r.name} avatar={r.avatar} frame={r.frame} size={26} rankSize="sm" premium={r.premium} animated />
                        </span>
                        <span className="lb-flag">
                          <CountryFlag code={r.country} size={16} rounded={false} />
                        </span>
                        <span className="lb-games">
                          {r.matches} <small>{t('lb.gamesUnit')}</small>
                        </span>
                        <span className="lb-wl">{r.decisions.toLocaleString('tr-TR')}</span>
                        <span className="lb-wr" aria-hidden="true" />
                        <span className="lb-rating lb-pr-val">{r.career_pr.toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {prRows !== null && prRows.length > 0 && renderPager(prRows.length)}
          </>
        )}
      </div>
      {profileId !== null && (
        <PublicProfile id={profileId} onClose={() => setProfileId(null)} />
      )}
    </div>
  )
}

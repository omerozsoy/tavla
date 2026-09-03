import { useEffect, useState } from 'react'
import './homeCalendar.css'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import { Coins } from './Coins'
import { liveMatches, leaderboard, onlinePlayers, listContents, type LiveMatch, type LeaderRow, type OnlinePlayer, type Tournament, type Content } from '../api'
import PlayerIdentity from './PlayerIdentity'
import { CountryFlag } from './Flag'
import { Countdown } from './Countdown'
import { Button } from '@/components/ui/button'

// Canli mac tipi: Arkadaslik (puansiz) | Puan Maci (N-puan) | Tek Mac (1 oyun)
type LiveCat = 'single' | 'match' | 'friendly'
function liveCat(m: LiveMatch): LiveCat {
  if (m.mode === 'friendly') return 'friendly'
  return (m.target ?? 1) > 1 ? 'match' : 'single'
}
const LIVE_CAT_KEY: Record<LiveCat, string> = {
  single: 'live.catSingle',
  match: 'live.catPoint',
  friendly: 'live.catFriendly',
}

// ---- Ozellik vitrini (yalniz misafirlere): urunun ne sundugunu tanitir ----
const FEATURES: { icon: IconName; key: string }[] = [
  { icon: 'robot', key: 'ai' },
  { icon: 'users', key: 'online' },
  { icon: 'medal', key: 'tourn' },
  { icon: 'chart', key: 'rating' },
  { icon: 'star', key: 'themes' },
  { icon: 'graduation', key: 'learn' },
]

// ---- Uye panosu (giris yapmis kullaniciya): tek bakista durum + hizli erisim ----
// 3 hizli stat karti: Puan · Coin · Performans (kazanma % buyuk + Mac/Galibiyet)
export function StatCards(p: { rating: number; coins: number; wins: number; games: number }) {
  const { t } = useT()
  const winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0
  return (
    <div className="dash-stats dash-stats-3">
      <div className="dstat dstat-navy">
        <span className="dstat-icon" aria-hidden="true">
          <Icon name="chart" size={18} />
        </span>
        <span className="dstat-val">{p.rating.toLocaleString()}</span>
        <span className="dstat-label">{t('lb.rating')}</span>
      </div>
      <div className="dstat dstat-orange">
        <span className="dstat-icon" aria-hidden="true">
          <Icon name="coin" size={18} />
        </span>
        <span className="dstat-val">{p.coins.toLocaleString()}</span>
        <span className="dstat-label">{t('home.dash.coins')}</span>
      </div>
      {/* Birlesik performans karti: kazanma yuzdesi buyuk + altta Mac/Galibiyet */}
      <div className="dstat dstat-aqua">
        <span className="dstat-icon" aria-hidden="true">
          <Icon name="trophy" size={18} />
        </span>
        <span className="dstat-val dstat-pct">%{winRate}</span>
        <span className="dstat-label">
          {p.games.toLocaleString()} {t('home.dash.games')} · {p.wins.toLocaleString()}{' '}
          {t('home.dash.wins')}
        </span>
      </div>
    </div>
  )
}

export function HomeDashboard(p: {
  rating: number
  coins: number
  wins: number
  games: number
  daily?: { ready: boolean; countdown: string; onClaim: () => void }
  showStats?: boolean
}) {
  const { t } = useT()
  return (
    <section className="home-dash" aria-label={t('menu.myStats')}>
      {p.showStats !== false && (
        <StatCards rating={p.rating} coins={p.coins} wins={p.wins} games={p.games} />
      )}
      {p.daily && (
        <button
          type="button"
          className={`dash-daily ${p.daily.ready ? 'ready' : ''}`}
          onClick={p.daily.ready ? p.daily.onClaim : undefined}
          disabled={!p.daily.ready}
        >
          <span className="dd-icon" aria-hidden="true">
            <Icon name="gift" size={20} />
          </span>
          <span className="dd-text">
            <span className="dd-title">{t('home.dash.daily')}</span>
            <span className="dd-sub">
              {p.daily.ready ? (
                t('home.dash.dailyReady')
              ) : (
                <>
                  {t('reward.in')} ·{' '}
                  <span className="tnum">{p.daily.countdown}</span>
                </>
              )}
            </span>
          </span>
          {p.daily.ready && (
            <span className="dd-cta">
              {t('home.dash.claim')} <Icon name="chevron" size={15} />
            </span>
          )}
        </button>
      )}
    </section>
  )
}

export function HomeFeatures({ onPlay }: { onPlay: () => void }) {
  const { t } = useT()
  return (
    <section className="home-features" aria-labelledby="home-features-title">
      <header className="home-features-head">
        <span className="hf-kicker">{t('home.feat.kicker')}</span>
        <h2 id="home-features-title" className="hf-title">
          {t('home.feat.title')}
        </h2>
      </header>
      <div className="hf-grid">
        {FEATURES.map((f, i) => (
          <div className="hf-card" key={f.key}>
            <span className={`hf-icon hf-icon-${['navy', 'coral', 'orange'][i % 3]}`} aria-hidden="true">
              <Icon name={f.icon} size={22} />
            </span>
            <h3 className="hf-card-title">{t(`home.feat.${f.key}.t`)}</h3>
            <p className="hf-card-desc">{t(`home.feat.${f.key}.d`)}</p>
          </div>
        ))}
      </div>
      <div className="home-finalcta">
        <h2 className="hfc-title">{t('home.finalCta.title')}</h2>
        <p className="hfc-sub">{t('home.finalCta.sub')}</p>
        <Button variant="default" className="mt-5" onClick={onPlay}>
          <Icon name="dice" size={18} /> {t('home.finalCta.button')}
        </Button>
      </div>
    </section>
  )
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  return url ? (
    <img className="lm-avatar" src={url} alt="" />
  ) : (
    <span className="lm-avatar lm-avatar-ph">{name.charAt(0).toUpperCase()}</span>
  )
}

// ---- Canli maclar (izlenebilir) ----
export function LiveMatchesPanel({
  onSpectate,
}: {
  onSpectate: (code: string, p1: string, p2: string) => void
}) {
  const { t } = useT()
  const [matches, setMatches] = useState<LiveMatch[] | null>(null)
  const [tab, setTab] = useState<'all' | 'single' | 'match' | 'friendly'>('all')
  const [showAll, setShowAll] = useState(false) // 10'ar göster; "Tümü" ile hepsi
  const LIVE_LIMIT = 10

  useEffect(() => {
    let alive = true
    const load = () =>
      liveMatches()
        .then((m) => alive && setMatches(m))
        .catch(() => alive && setMatches([]))
    load()
    const id = window.setInterval(load, 10000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const shown = matches?.filter((m) => tab === 'all' || liveCat(m) === tab) ?? null
  // Sekme degisince tekrar 10'a don
  useEffect(() => {
    setShowAll(false)
  }, [tab])

  return (
    <div className="home-panel live-panel">
      <div className="home-panel-head">
        <span className="live-dot" />
        <Icon name="live" size={17} /> {t('live.title')}
      </div>
      <div className="rank-tabs">
        <Button type="button" variant={tab === 'all' ? 'default' : 'ghost'} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>
          {t('live.catAll')}
        </Button>
        <Button type="button" variant={tab === 'single' ? 'default' : 'ghost'} aria-pressed={tab === 'single'} onClick={() => setTab('single')}>
          {t('live.catSingle')}
        </Button>
        <Button type="button" variant={tab === 'match' ? 'default' : 'ghost'} aria-pressed={tab === 'match'} onClick={() => setTab('match')}>
          {t('live.catPoint')}
        </Button>
        <Button type="button" variant={tab === 'friendly' ? 'default' : 'ghost'} aria-pressed={tab === 'friendly'} onClick={() => setTab('friendly')}>
          {t('live.catFriendly')}
        </Button>
      </div>
      {shown === null ? (
        <div className="home-panel-empty">{t('common.loading')}</div>
      ) : shown.length === 0 ? (
        <div className="home-panel-empty">{t('live.empty')}</div>
      ) : (
        <>
        <div className="live-list">
          {(showAll ? shown : shown.slice(0, LIVE_LIMIT)).map((m) => (
            <button
              key={m.code}
              className="live-row"
              onClick={() => onSpectate(m.code, m.p1_name, m.p2_name)}
            >
              <span className={`lm-type lm-type-${liveCat(m)}`}>
                {t(LIVE_CAT_KEY[liveCat(m)])}
              </span>
              <span className="lm-side lm-p1">
                <Avatar url={m.p1_avatar} name={m.p1_name} />
                <span className="lm-name">{m.p1_name}</span>
              </span>
              <span className="lm-vs">vs</span>
              <span className="lm-side lm-p2">
                <span className="lm-name">{m.p2_name}</span>
                <Avatar url={m.p2_avatar} name={m.p2_name} />
              </span>
              <Icon name="eye" size={14} className="lm-watch" />
            </button>
          ))}
        </div>
        {!showAll && shown.length > LIVE_LIMIT && (
          <Button variant="ghost" className="live-more" onClick={() => setShowAll(true)}>
            {t('live.showAll', { n: shown.length })}
          </Button>
        )}
        </>
      )}
    </div>
  )
}

// ---- Cevrimici oyuncular ----
export function OnlinePlayersPanel({
  currentName,
  onProfile,
  onInvite,
  onAddFriend,
}: {
  currentName?: string
  onProfile: (id: number) => void
  onInvite?: (id: number) => void // maca davet et (giris yapmis kullanici)
  onAddFriend?: (id: number) => void // arkadas ol
}) {
  const { t } = useT()
  const [players, setPlayers] = useState<OnlinePlayer[] | null>(null)
  const [showAll, setShowAll] = useState(false)
  const LIMIT = 12

  useEffect(() => {
    let alive = true
    const load = () =>
      onlinePlayers()
        .then((p) => alive && setPlayers(p))
        .catch(() => alive && setPlayers([]))
    load()
    const id = window.setInterval(load, 15000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className="home-panel online-panel">
      <div className="home-panel-head">
        <span className="online-dot" />
        <Icon name="users" size={17} /> {t('online.title')}
        {players && players.length > 0 && <span className="online-count">{players.length}</span>}
      </div>
      {players === null ? (
        <div className="home-panel-empty">{t('common.loading')}</div>
      ) : players.length === 0 ? (
        <div className="home-panel-empty">{t('online.empty')}</div>
      ) : (
        <>
          <div className="rank-list">
            {(showAll ? players : players.slice(0, LIMIT)).map((p) => {
              const self = !!currentName && p.name === currentName
              return (
                <div key={p.id} className={`rank-row online-row ${self ? 'mine' : ''}`}>
                  <span className="online-pdot" title={t('online.title')} />
                  <button type="button" className="online-id" onClick={() => onProfile(p.id)}>
                    <PlayerIdentity name={p.name} rating={p.rating} avatar={p.avatar} frame={p.frame} size={30} rankSize="md" />
                  </button>
                  <span className="rank-flag">
                    <CountryFlag code={p.country} size={16} rounded={false} />
                  </span>
                  <span className="rank-val">{p.rating}</span>
                  {!self && (onInvite || onAddFriend) && (
                    <span className="online-actions">
                      {onInvite && (
                        <Button
                          variant="default"
                          size="icon"
                          className="online-act"
                          title={t('online.invite')}
                          aria-label={t('online.invite')}
                          onClick={() => onInvite(p.id)}
                        >
                          <Icon name="play" size={15} />
                        </Button>
                      )}
                      {onAddFriend && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="online-act"
                          title={t('online.addFriend')}
                          aria-label={t('online.addFriend')}
                          onClick={() => onAddFriend(p.id)}
                        >
                          <Icon name="user-plus" size={15} />
                        </Button>
                      )}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {!showAll && players.length > LIMIT && (
            <Button variant="ghost" className="live-more" onClick={() => setShowAll(true)}>
              {t('live.showAll', { n: players.length })}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

// ---- Siralama (rating / coin) ----
export function RankingPanel({
  currentName,
  onProfile,
  onOpen,
}: {
  currentName?: string
  onProfile: (id: number) => void
  onOpen?: () => void // baslik -> Liderlik Tablosu sayfasi (/lider-tablosu)
}) {
  const { t } = useT()
  const [by, setBy] = useState<'rating' | 'coins' | 'wxp'>('rating')
  const [rows, setRows] = useState<LeaderRow[] | null>(null)

  useEffect(() => {
    let alive = true
    // NOT: setRows(null) YOK -> tab degisince liste cokup sayfa kisalmaz (scroll yukari
    // atlamasin). Eski satirlar yeni veri gelene kadar durur; ilk yuklemede zaten null.
    leaderboard(15, by)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [by])

  return (
    <div className="home-panel rank-panel">
      {onOpen ? (
        <button type="button" className="home-panel-head hph-link" onClick={onOpen} title={t('lb.title')}>
          <Icon name="trophy" size={17} /> {t('lb.title')}
        </button>
      ) : (
        <div className="home-panel-head">
          <Icon name="trophy" size={17} /> {t('lb.title')}
        </div>
      )}
      <div className="rank-tabs">
        <Button type="button" variant={by === 'rating' ? 'default' : 'ghost'} aria-pressed={by === 'rating'} onClick={() => setBy('rating')}>
          {t('lb.rating')}
        </Button>
        <Button type="button" variant={by === 'coins' ? 'default' : 'ghost'} aria-pressed={by === 'coins'} onClick={() => setBy('coins')}>
          {t('lb.byCoins')}
        </Button>
        <Button type="button" variant={by === 'wxp' ? 'default' : 'ghost'} aria-pressed={by === 'wxp'} onClick={() => setBy('wxp')}>
          {t('lb.byWxp')}
        </Button>
      </div>
      {rows === null ? (
        <div className="home-panel-empty">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="home-panel-empty">{t('lb.empty')}</div>
      ) : (
        <div className="rank-list">
          {rows.map((r) => (
            <button
              key={r.rank}
              className={`rank-row ${currentName && r.name === currentName ? 'mine' : ''}`}
              onClick={() => r.id && onProfile(r.id)}
            >
              <span className={`rank-no${r.rank <= 3 ? ' rank-medal rank-medal-' + r.rank : ''}`}>
                {r.rank}
              </span>
              <span className="rank-name">
                <PlayerIdentity name={r.name} rating={r.rating} avatar={r.avatar} frame={r.frame} size={30} rankSize="md" />
              </span>
              <span className="rank-flag">
                <CountryFlag code={r.country} size={16} rounded={false} />
              </span>
              <span className="rank-val">
                {by === 'coins' ? (
                  <Coins amount={r.coins ?? 0} size={12} />
                ) : by === 'wxp' ? (
                  r.wxp ?? 0
                ) : (
                  r.rating
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Turnuvalar (tam genislik panel; icinde cok turnuva) ----
export function TournamentsPanel({
  tourns,
  onOpen,
}: {
  tourns: Tournament[]
  onOpen: () => void
}) {
  const { t, lang } = useT()
  if (tourns.length === 0) return null
  return (
    <div className="home-panel tourn-panel">
      <button type="button" className="home-panel-head hph-link" onClick={onOpen} title={t('menu.tournaments')}>
        <Icon name="medal" size={18} /> {t('menu.tournaments')}
        <span className="panel-count">{tourns.length}</span>
      </button>
      <div className="tourn-list">
        {tourns.map((tr) => {
          const full = tr.count >= tr.size
          const pct = tr.size > 0 ? Math.min(100, Math.round((tr.count / tr.size) * 100)) : 0
          // Odul tablosu: prizes varsa ilk 3 sira (1./2./3.), yoksa eski prize_coins
          const prizeList =
            tr.prizes && tr.prizes.length > 0
              ? tr.prizes.slice(0, 3)
              : tr.prize_coins
                ? [{ coins: tr.prize_coins }]
                : []
          const moreP = (tr.prizes?.length ?? 0) - prizeList.length
          // Kısa ödül açıklaması (ilk ödül desc'i veya genel not) — CSS ile ellipsize
          const prizeDesc = ((tr.prizes?.[0]?.desc ?? tr.prize_desc) ?? '').trim()
          // Tarih: baslama zamani (yoksa gizli). Dile gore biciml.
          const dateText = tr.starts_at
            ? new Date(tr.starts_at).toLocaleString(lang === 'tr' ? 'tr-TR' : lang, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null
          return (
            <button key={tr.id} className="tourn-row" onClick={onOpen}>
              <span className="tr-main">
                <span className="tr-name">{tr.name}</span>
                <span className="tr-chips">
                  <span className={`tr-status tr-status-${tr.status}`}>
                    {t(`tourn.status.${tr.status}`)}
                  </span>
                  {/* Guzel canli sayac (open + baslama zamani varsa) */}
                  {tr.status === 'open' && tr.starts_at && (
                    <span className="tr-cd-wrap">
                      <span className="tr-cd-lbl">{t('tourn.startsIn')}</span>
                      <Countdown target={tr.starts_at} className="tr-cd" />
                    </span>
                  )}
                </span>
                {/* Tarih + odul kirilimi */}
                {(dateText || prizeList.length > 0) && (
                  <span className="tr-meta">
                    {dateText && (
                      <span className="tr-date">
                        <Icon name="calendar" size={13} /> {dateText}
                      </span>
                    )}
                    {prizeList.length > 0 && (
                      <span className="tr-prizes" title={t('tourn.prizePool')}>
                        <Icon name="trophy" size={13} />
                        {prizeList.map((p, i) => (
                          <span key={i} className="tr-prize-item">
                            <b className="tr-prize-rank">{i + 1}.</b>{' '}
                            {p.coins.toLocaleString('tr-TR')}
                          </span>
                        ))}
                        {moreP > 0 && <span className="tr-prize-more">+{moreP}</span>}
                      </span>
                    )}
                    {prizeDesc && <span className="tr-prize-desc">{prizeDesc}</span>}
                  </span>
                )}
              </span>
              {/* SAG: kac kisi katilmis (buyuk) + etiket + doluluk cubugu */}
              <span className="tr-side">
                <span className="tr-count" data-full={full || undefined}>
                  <b>{tr.count}</b>
                  <span className="tr-count-sep">/{tr.size}</span>
                </span>
                <span className="tr-count-lbl">{t('tourn.players')}</span>
                <span className="tr-bar" aria-hidden="true">
                  <span className="tr-bar-fill" style={{ width: `${pct}%` }} />
                </span>
              </span>
              <Icon name="arrow-right" size={16} className="tr-go" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Medya yolu: mutlak/kok-baslangicli ise oldugu gibi, degilse /uploads/ oneki (ContentView ile ayni).
const calMediaSrc = (img?: string | null): string | undefined => {
  if (!img) return undefined
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}

// Baslik -> URL slug (ContentView.slugify ile ayni kural; haber detayini acmak icin).
const TR_SLUG: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u',
}
const newsSlug = (s: string): string =>
  s
    .replace(/[çğıöşüİÇĞÖŞÜ]/g, (c) => TR_SLUG[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// ---- Haberler (ana sayfa yan kutusu; Online Turnuvalar boyutunda) ----
// En son 3 haber: solda ufak kapak resmi + baslik + yayin tarihi. Satir -> haber detayi.
export function NewsPanel({ onOpen, onOpenNews }: { onOpen: () => void; onOpenNews: (slug: string) => void }) {
  const { t, lang } = useT()
  const [items, setItems] = useState<Content[] | null>(null)
  useEffect(() => {
    let alive = true
    listContents('news')
      .then((n) => alive && setItems(n.slice(0, 3)))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [])
  const locale = lang === 'tr' ? 'tr-TR' : lang
  const fmtDate = (c: Content): string | null => {
    const d = c.event_at ?? c.created_at
    if (!d) return null
    const dt = new Date(d)
    return Number.isNaN(dt.getTime())
      ? null
      : dt.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return (
    <div className="home-panel news-panel">
      <button type="button" className="home-panel-head hph-link" onClick={onOpen} title={t('menu.news')}>
        <Icon name="chat" size={18} /> {t('menu.news')}
        {items && items.length > 0 && <span className="panel-count">{items.length}</span>}
      </button>
      {items === null ? (
        <div className="home-panel-empty">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="home-panel-empty">{t('home.news.empty')}</div>
      ) : (
        <div className="news-list">
          {items.map((n) => {
            const cover = calMediaSrc(n.image)
            const date = fmtDate(n)
            return (
              <button key={n.id} className="news-row" onClick={() => onOpenNews(newsSlug(n.title))}>
                {cover ? (
                  <img className="news-thumb" src={cover} alt="" loading="lazy" />
                ) : (
                  <span className="news-thumb news-thumb-ph" aria-hidden="true">
                    <Icon name="chat" size={16} />
                  </span>
                )}
                <span className="news-main">
                  <span className="news-title">{n.title}</span>
                  {date && (
                    <span className="news-date">
                      <Icon name="calendar" size={12} /> {date}
                    </span>
                  )}
                </span>
                <Icon name="arrow-right" size={15} className="news-go" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
// Takvim balonundaki tek satir: {isim, varsa yuvarlak kurum logosu}.
type CalItem = { name: string; logo?: string }

// Ana sayfa mini takvim (slider altinda, canli maclar boyutunda). Turnuva baslama
// gunleri isaretli; bugun vurgulu. Panel/gun tiklayinca Turnuva Takvimi'ni acar.
export function CalendarPanel({ tourns, onOpen }: { tourns: Tournament[]; onOpen: () => void }) {
  const { t, lang } = useT()
  const today = new Date()
  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }))
  // Hover balonu (native title yerine): sabit konumlu, gun uzerine gelince isim(ler)i gosterir.
  const [tip, setTip] = useState<{ x: number; y: number; day: number; tourn: CalItem[]; event: CalItem[] } | null>(null)
  // Turnuva Takvimi etkinlikleri (dis aktivite/turnuva) -> kiremit. Bizim site turnuvalari (tourns) -> yesil.
  const [events, setEvents] = useState<Content[]>([])
  // Kurum adi -> yuvarlak logo (etkinlik satirinin basina konur). organizer adi = kurum basligi.
  const [kurumLogos, setKurumLogos] = useState<Record<string, string>>({})
  useEffect(() => {
    let alive = true
    listContents('event')
      .then((e) => alive && setEvents(e))
      .catch(() => {})
    listContents('kurum')
      .then((ks) => {
        if (!alive) return
        const map: Record<string, string> = {}
        for (const k of ks) if (k.title && k.image) map[k.title] = k.image
        setKurumLogos(map)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const locale = lang === 'tr' ? 'tr-TR' : lang
  const first = new Date(view.y, view.m, 1)
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const startOffset = (first.getDay() + 6) % 7 // Pazartesi-basli
  // gun -> ogeler (ayri: bizim turnuvalar / dis etkinlikler); her oge {isim, varsa logo}.
  const tournMap = new Map<number, CalItem[]>() // yesil
  const eventMap = new Map<number, CalItem[]>() // kiremit
  const mark = (map: Map<number, CalItem[]>, day: number, item: CalItem) => {
    const arr = map.get(day) ?? []
    arr.push(item)
    map.set(day, arr)
  }
  // Bizim turnuvalar: tek gun (starts_at). Logo = duzenleyen kurumun logosu (varsa).
  for (const tr of tourns) {
    if (!tr.starts_at) continue
    const d = new Date(tr.starts_at)
    if (d.getFullYear() === view.y && d.getMonth() === view.m)
      mark(tournMap, d.getDate(), { name: tr.name, logo: calMediaSrc(tr.organizer?.logo) })
  }
  // Dis etkinlikler: yapisal bitis tarihi YOK -> aciklamadaki "18-19-20 Eylul" gibi
  // gun araligini ayristirip TUM gunleri isaretle (cok gunlu turnuvalar).
  const TR_MONTHS = 'ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik'
  const rangeRe = new RegExp(`(\\d{1,2}(?:\\s*[-–]\\s*\\d{1,2})+)\\s*(?:${TR_MONTHS})`, 'i')
  for (const ev of events) {
    if (!ev.event_at) continue
    const base = new Date(ev.event_at)
    // Etkinlik satirinin basina konacak yuvarlak logo: duzenleyen kurumun logosu (varsa).
    const evItem: CalItem = { name: ev.title, logo: calMediaSrc(kurumLogos[ev.organizer ?? '']) }
    // 1) YAPISAL bitis tarihi (event_end) varsa: baslangic..bitis TUM gunler (en dogru).
    if (ev.event_end) {
      const end = new Date(ev.event_end)
      // gun-gun ilerle; yalniz goruntulenen aya dusenleri isaretle.
      const cur = new Date(base.getFullYear(), base.getMonth(), base.getDate())
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      let guard = 0
      while (cur <= last && guard++ < 40) {
        if (cur.getFullYear() === view.y && cur.getMonth() === view.m) mark(eventMap, cur.getDate(), evItem)
        cur.setDate(cur.getDate() + 1)
      }
      continue
    }
    // 2) Bitis yoksa: aciklamadaki "18-19-20 Eylul" araligini ayristir (fallback).
    if (base.getFullYear() !== view.y || base.getMonth() !== view.m) continue
    let days = [base.getDate()]
    const m = (ev.body ?? '').match(rangeRe)
    if (m) {
      const nums = m[1].split(/[-–]/).map((x) => parseInt(x.trim(), 10)).filter((n) => n >= 1 && n <= 31)
      if (nums.length >= 2) {
        const lo = Math.min(...nums), hi = Math.max(...nums)
        days = []
        for (let d = lo; d <= hi; d++) days.push(d)
      }
    }
    for (const day of days) mark(eventMap, day, evItem)
  }
  const monthLabel = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const wd: string[] = []
  for (let i = 0; i < 7; i++) {
    wd.push(new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' })) // 2024-01-01 = Pazartesi
  }
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const isToday = (d: number) =>
    today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d
  const prev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const next = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  return (
    <div className="home-panel cal-panel">
      <div className="home-panel-head cal-head">
        <span className="cal-title">
          <Icon name="calendar-dots" size={18} /> {t('menu.calendar')}
        </span>
        <div className="cal-nav">
          <button type="button" onClick={prev} aria-label="prev">‹</button>
          <span className="cal-month">{monthLabel}</span>
          <button type="button" onClick={next} aria-label="next">›</button>
        </div>
      </div>
      <div className="cal-grid cal-wd">
        {wd.map((w, i) => (
          <span key={i} className="cal-wd-cell">{w}</span>
        ))}
      </div>
      <div className="cal-grid cal-days">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="cal-cell empty" />
          const tn = tournMap.get(d) // yesil (bizim turnuvalar)
          const en = eventMap.get(d) // kiremit (dis etkinlikler)
          const title = [...(tn ?? []), ...(en ?? [])].map((it) => it.name).join(' · ')
          // Gun numarasi rengi: turnuva varsa yesil, yoksa etkinlik varsa kiremit.
          const kind = tn ? 'tourn' : en ? 'event' : ''
          const marked = !!(tn || en)
          return (
            <button
              key={i}
              type="button"
              className={`cal-cell ${isToday(d) ? 'today' : ''} ${kind ? 'has-ev cal-' + kind : ''}`}
              onClick={onOpen}
              aria-label={title || String(d)}
              onMouseEnter={(e) => {
                if (!marked) return
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setTip({ x: r.left + r.width / 2, y: r.top, day: d, tourn: tn ?? [], event: en ?? [] })
              }}
              onMouseLeave={() => setTip((cur) => (cur && cur.day === d ? null : cur))}
            >
              <span className="cal-daynum">{d}</span>
              {tn && (
                <span className="cal-evname ev-tourn">
                  {tn[0].name}
                  {tn.length > 1 ? ` +${tn.length - 1}` : ''}
                </span>
              )}
              {en && (
                <span className="cal-evname ev-event">
                  {en[0].name}
                  {en.length > 1 ? ` +${en.length - 1}` : ''}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="cal-foot">
        <Button variant="outline" className="w-full" onClick={onOpen}>
          <Icon name="calendar-dots" size={16} /> {t('menu.calendar')}
        </Button>
      </div>
      {tip && (tip.tourn.length > 0 || tip.event.length > 0) && (
        <div className="cal-balloon" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.tourn.map((it, k) => (
            <div key={'t' + k} className="calb-row calb-tourn">
              {it.logo ? (
                <img className="calb-logo" src={it.logo} alt="" loading="lazy" />
              ) : (
                <span className="calb-dot" />
              )}{' '}
              {it.name}
            </div>
          ))}
          {tip.event.map((it, k) => (
            <div key={'e' + k} className="calb-row calb-event">
              {it.logo ? (
                <img className="calb-logo" src={it.logo} alt="" loading="lazy" />
              ) : (
                <span className="calb-dot" />
              )}{' '}
              {it.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import './sidebar.css'
import { Icon } from './Icon'
import AvatarFrame from './AvatarFrame'
import PremiumPill from './PremiumPill'
import { useT } from '../i18n'

// Anlik PR degisim yonu: son harekette PR yukseldi (kotu) mi dustu (iyi) mi?
// Kisa sureligine dondurur (arrow animasyonu icin), sonra null'a doner.
function usePrTrend(pr: number | null | undefined): 'bad' | 'good' | null {
  const prev = useRef<number | null>(null)
  const [trend, setTrend] = useState<'bad' | 'good' | null>(null)
  useEffect(() => {
    if (pr == null) {
      prev.current = null
      return
    }
    const before = prev.current
    prev.current = pr
    if (before == null) return
    const d = pr - before
    let next: 'bad' | 'good' | null = null
    if (d > 0.05) next = 'bad' // PR yukseldi -> yanlis/zayif hamle
    else if (d < -0.05) next = 'good' // PR dustu -> iyi hamle
    if (!next) return
    setTrend(next)
    const id = setTimeout(() => setTrend(null), 2600)
    return () => clearTimeout(id)
  }, [pr])
  return trend
}

interface PlayerInfo {
  name: string
  avatar: string
  sub: string
  off: number
  active: boolean
  color: 'white' | 'black'
  score: number
  target: number
  rating?: number | null
  avatarUrl?: string | null
  frame?: string | null
  isBot?: boolean // YZ rakip -> avatar yoksa emoji yerine robot ikonu
  pr?: number | null // anlik PR (performans reytingi); null ise gizli
  premium?: boolean // süresi geçerli ücretli plan -> isim yaninda PREMIUM
  onOpenProfile?: () => void // varsa: avatara tıkla/hover -> herkese açık profil modalı (rakip)
}

interface SidebarProps {
  top: PlayerInfo
  bottom: PlayerInfo
  length?: number // mac uzunlugu (LENGTH)
  stake?: number // bahis tutari (STAKE); 0 ise gizli
  crawford?: boolean // Crawford oyunu: kup YOK -> panelde rozet (her modda, her ekranda)
}

// Sadelestirilmis sayi: 1400 -> "1.4K", 2000000 -> "2M".
function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K`
  return String(n)
}

function Avatar({ p }: { p: PlayerInfo }) {
  const { t } = useT()
  const inner = p.frame ? (
    <AvatarFrame
      src={p.avatarUrl}
      frame={p.frame}
      size={104}
      name={p.name}
      className={`pc-avf ${p.active ? 'active' : ''}`}
    />
  ) : (
    <div className={`avatar ${p.color} ${p.active ? 'active' : ''}`}>
      {p.avatarUrl ? (
        <img src={p.avatarUrl} alt="" />
      ) : p.isBot ? (
        <Icon name="robot" size={52} />
      ) : (
        <span>{p.avatar}</span>
      )}
    </div>
  )
  // Sira gostergesi: avatarin iki yaninda parantez benzeri iki yay, yanip soner (net "sira kimde")
  // onOpenProfile varsa (rakip): avatar tıklanabilir + hover'da profil modalı açılır.
  return (
    <div
      className={`pc-avatar ${p.active ? 'active' : ''} ${p.onOpenProfile ? 'clickable' : ''}`}
      onClick={p.onOpenProfile}
      onMouseEnter={p.onOpenProfile}
      role={p.onOpenProfile ? 'button' : undefined}
      tabIndex={p.onOpenProfile ? 0 : undefined}
      onKeyDown={p.onOpenProfile ? (e) => (e.key === 'Enter' || e.key === ' ') && p.onOpenProfile!() : undefined}
      title={p.onOpenProfile ? t('menu.viewProfile') : undefined}
    >
      {p.active && <span className="turn-arcs" aria-hidden="true" />}
      {inner}
    </div>
  )
}

function Name({ p }: { p: PlayerInfo }) {
  const { t } = useT()
  const trend = usePrTrend(p.pr)
  return (
    <div className="player-name-wrap">
      <div className="player-name">
        {p.name}
        {p.premium && <PremiumPill style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
      </div>
      {/* Botla oynarken botun seviyesi (isim altinda ince alt satir) */}
      {p.isBot && p.sub ? <div className="player-sub pc-bot-lvl">{p.sub}</div> : null}
      {/* Anlik PR (performans reytingi) — dusuk = iyi. Yanlis hamlede kirmizi oklar
          yukari, iyi hamlede yesil oklar asagi (iki yanda) animasyon + kucuk not: ogretici. */}
      {p.pr != null ? (
        <div className={`pc-pr-wrap ${trend ? 'pr-' + trend : ''}`}>
          <div className="pc-pr">
            {trend && <span className="pr-arrow pa-left" aria-hidden="true">{trend === 'bad' ? '▲' : '▼'}</span>}
            <span className="pr-val">PR {p.pr.toFixed(1)}</span>
            {trend && <span className="pr-arrow pa-right" aria-hidden="true">{trend === 'bad' ? '▲' : '▼'}</span>}
          </div>
          {trend && <div className="pc-pr-note">{trend === 'bad' ? t('pr.bad') : t('pr.good')}</div>}
        </div>
      ) : null}
    </div>
  )
}

function Rating({ p }: { p: PlayerInfo }) {
  if (p.rating == null) return null
  return (
    <div className="player-rating">
      <Icon name="star" size={15} /> {p.rating}
    </div>
  )
}

// Ust oyuncu: isim -> avatar -> rating. Alt oyuncu: rating -> avatar -> isim (aynasal).
function PlayerCard({ p, pos }: { p: PlayerInfo; pos: 'top' | 'bottom' }) {
  return (
    <div className={`player-card pc-${pos} ${p.active ? 'active' : ''}`}>
      {pos === 'top' ? (
        <>
          <Name p={p} />
          <Avatar p={p} />
          <Rating p={p} />
        </>
      ) : (
        <>
          <Rating p={p} />
          <Avatar p={p} />
          <Name p={p} />
        </>
      )}
    </div>
  )
}

export default function Sidebar({ top, bottom, length, stake, crawford }: SidebarProps) {
  const { t } = useT()
  return (
    <div className="sidebar">
      <PlayerCard p={top} pos="top" />
      <div className="sidebar-meta">
        {crawford && (
          <div className="sm-row sm-crawford" title={t('board.crawfordHint')}>
            <span className="sm-crawford-tag">{t('board.crawford')}</span>
            <span className="sm-crawford-note">{t('game.noCube')}</span>
          </div>
        )}
        {length != null && (
          <div className="sm-row">
            <span className="sm-lbl">{t('game.length')}</span>
            <span className="sm-val">{length}</span>
          </div>
        )}
        {stake != null && stake > 0 && (
          <div className="sm-row">
            <span className="sm-lbl">{t('game.stake')}</span>
            <span className="sm-val">{fmtK(stake)}</span>
          </div>
        )}
      </div>
      <PlayerCard p={bottom} pos="bottom" />
    </div>
  )
}

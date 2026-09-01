import './sidebar.css'
import { Icon } from './Icon'
import AvatarFrame from './AvatarFrame'
import { useT } from '../i18n'

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
}

interface SidebarProps {
  top: PlayerInfo
  bottom: PlayerInfo
  length?: number // mac uzunlugu (LENGTH)
  stake?: number // bahis tutari (STAKE); 0 ise gizli
}

// Sadelestirilmis sayi: 1400 -> "1.4K", 2000000 -> "2M".
function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K`
  return String(n)
}

function Avatar({ p }: { p: PlayerInfo }) {
  return p.frame ? (
    <AvatarFrame
      src={p.avatarUrl}
      frame={p.frame}
      size={104}
      name={p.name}
      className={`pc-avf ${p.active ? 'active' : ''}`}
    />
  ) : (
    <div className={`avatar ${p.color} ${p.active ? 'active' : ''}`}>
      {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : <span>{p.avatar}</span>}
    </div>
  )
}

function Name({ p }: { p: PlayerInfo }) {
  return <div className="player-name">{p.name}</div>
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

export default function Sidebar({ top, bottom, length, stake }: SidebarProps) {
  const { t } = useT()
  return (
    <div className="sidebar">
      <PlayerCard p={top} pos="top" />
      <div className="sidebar-meta">
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

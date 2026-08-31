import { Icon } from './Icon'
import AvatarFrame from './AvatarFrame'

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
}

function PlayerCard({ p }: { p: PlayerInfo }) {
  return (
    <div className={`player-card ${p.active ? 'active' : ''}`}>
      {p.frame ? (
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
      )}
      <div className="player-name">{p.name}</div>
      <div className="player-sub">{p.sub}</div>
      {p.rating != null && (
        <div className="player-rating">
          <Icon name="star" size={15} /> {p.rating}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ top, bottom }: SidebarProps) {
  // Tek ORTAK skor (iki ayrı kesir yerine): top – bottom, hedef bir kez.
  return (
    <div className="sidebar">
      <PlayerCard p={top} />
      <div className="sidebar-score" title={`${top.score} – ${bottom.score} · ${top.target} puan`}>
        <span className="ss-num">{top.score}</span>
        <span className="ss-sep">–</span>
        <span className="ss-num">{bottom.score}</span>
        <span className="ss-target">/{top.target}</span>
      </div>
      <PlayerCard p={bottom} />
    </div>
  )
}

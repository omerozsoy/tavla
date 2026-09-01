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
  // Skor artik saatin ust/alt kutularinda gosteriliyor (her oyuncu kendi tarafinda).
  return (
    <div className="sidebar">
      <PlayerCard p={top} />
      <PlayerCard p={bottom} />
    </div>
  )
}

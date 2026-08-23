import { Icon } from './Icon'

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
}

interface SidebarProps {
  top: PlayerInfo
  bottom: PlayerInfo
}

function PlayerCard({ p }: { p: PlayerInfo }) {
  return (
    <div className={`player-card ${p.active ? 'active' : ''}`}>
      <div className={`avatar ${p.color} ${p.active ? 'active' : ''}`}>
        {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : <span>{p.avatar}</span>}
      </div>
      <div className="player-name">{p.name}</div>
      <div className="player-sub">{p.sub}</div>
      {p.rating != null && (
        <div className="player-rating">
          <Icon name="star" size={13} /> {p.rating}
        </div>
      )}
      <div className="score-badge">
        <Icon name="medal" size={13} /> {p.score} / {p.target}
      </div>
      <div className="off-box">{p.off}</div>
    </div>
  )
}

export default function Sidebar({ top, bottom }: SidebarProps) {
  return (
    <div className="sidebar">
      <PlayerCard p={top} />
      <PlayerCard p={bottom} />
    </div>
  )
}

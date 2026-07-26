interface PlayerInfo {
  name: string
  avatar: string
  sub: string
  off: number
  active: boolean
  color: 'white' | 'black'
  score: number
  target: number
}

interface SidebarProps {
  top: PlayerInfo
  bottom: PlayerInfo
}

function PlayerCard({ p }: { p: PlayerInfo }) {
  return (
    <div className={`player-card ${p.active ? 'active' : ''}`}>
      <div className={`avatar ${p.color} ${p.active ? 'active' : ''}`}>
        <span>{p.avatar}</span>
      </div>
      <div className="player-name">{p.name}</div>
      <div className="player-sub">{p.sub}</div>
      <div className="score-badge">
        ⭐ {p.score} / {p.target}
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

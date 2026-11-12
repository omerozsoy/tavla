// Mobil portrait oyun ekrani YENIDEN TASARIM HUD'u (Backgammon Galaxy benzeri).
// Yalniz mobil portrait'te render edilir (App.tsx mobilePortrait gate'i); masaustu/yatay
// klasik Sidebar + ClockStack kullanmaya devam eder. Prototip boardshot.tsx ile birebir.
import { useEffect, useState } from 'react'
import './gameRedesign.css'
import { Icon } from './Icon'
import { Coins } from './Coins'

export function useMobilePortrait(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 900px) and (orientation: portrait)')
    const apply = () => setM(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return m
}

const pad = (n: number) => String(n).padStart(2, '0')
const mmss = (secs: number) => {
  const s = Math.max(0, Math.ceil(secs))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

type Who = {
  name: string
  avatarUrl?: string | null
  isBot?: boolean
  rating?: number | null
  sub?: string
}

function Player({ who, ring, coins, onAvatar }: {
  who: Who; ring: 'blue' | 'gold'; coins?: number | null; onAvatar?: () => void
}) {
  return (
    <div className="gb-player">
      <div className={`gb-pav ring-${ring}`} onClick={onAvatar} style={onAvatar ? { cursor: 'pointer' } : undefined}>
        <div className="gb-pav-inner">
          {who.avatarUrl ? <img src={who.avatarUrl} alt="" /> : <Icon name={who.isBot ? 'robot-face' : 'user'} size={44} />}
        </div>
      </div>
      <div className="gb-pname">{who.name}</div>
      <div className="gb-pstats">
        {who.isBot && <span className="gb-aipill">{who.sub || 'AI'}</span>}
        {who.rating != null && <span className="gb-stat"><Icon name="chart-bar-popular" size={14} />{who.rating}</span>}
        {coins != null && <span className="gb-stat"><Coins amount={coins} size={13} /></span>}
      </div>
    </div>
  )
}

// Kimlik basligi: SOL=ben (self), SAG=rakip. Orta: skor + maç uzunlugu + VS pullar.
export function GameHudHeader({ self, opp, selfCoins, target, selfScore, oppScore, selfColor, crawford }: {
  self: Who; opp: Who; selfCoins?: number | null; target: number
  selfScore: number; oppScore: number; selfColor: 'white' | 'black'; crawford?: boolean
}) {
  const oppColor = selfColor === 'white' ? 'black' : 'white'
  return (
    <div className="gb-identity">
      <Player who={self} ring="blue" coins={selfCoins} />
      <div className="gb-center">
        <div className="gb-vsbox">
          <div className="gb-vsrow"><Icon name="crown-simple" size={14} />{selfScore}–{oppScore}<span className="gb-vslbl">skor</span></div>
          <div className="gb-vsrow">{crawford ? 'CRAWFORD' : target}<span className="gb-vslbl">{crawford ? '' : 'maç'}</span></div>
        </div>
        <div className="gb-vs">
          <span className={`gb-vs-chk ${selfColor === 'white' ? 'white' : 'navy'}`} />
          <span className="gb-vs-txt">VS</span>
          <span className={`gb-vs-chk ${oppColor === 'white' ? 'white' : 'navy'}`} />
        </div>
      </div>
      <Player who={opp} ring="gold" onAvatar={opp.isBot ? undefined : undefined} />
    </div>
  )
}

// Oyuncu satiri: [skor + (sahipse KUP)] SOL | saat ORTA | tepsi SAG.
export function GameHudRow({ score, bankSecs, moveSecs, active, low, trayColor, trayCount, cubeValue }: {
  score: number; bankSecs: number; moveSecs: number | null; active: boolean; low: boolean
  trayColor: 'white' | 'black'; trayCount: number; cubeValue?: number | null
}) {
  return (
    <div className="gb-row">
      <div className="gb-scorewrap">
        <div className="gb-score">{score}</div>
        {cubeValue != null && <div className="gb-cube">{cubeValue}</div>}
      </div>
      <div className={`gbc ${active ? 'on' : ''} ${low ? 'low' : ''}`}>
        {moveSecs != null && <span className="gbc-move">{Math.max(0, Math.ceil(moveSecs))}</span>}
        <span className="gbc-bank">{mmss(bankSecs)}</span>
      </div>
      <div className={`gbt gbt-${trayColor}`}>
        <div className="gbt-stack">
          {Array.from({ length: Math.min(trayCount, 15) }).map((_, i) => (
            <span key={i} className={`gbt-chk ${trayColor}`} />
          ))}
        </div>
        <span className="gbt-count">{trayCount}</span>
      </div>
    </div>
  )
}

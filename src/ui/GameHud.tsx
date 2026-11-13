// Mobil portrait oyun ekrani YENIDEN TASARIM HUD'u (Backgammon Galaxy benzeri).
// Yalniz mobil portrait'te render edilir (App.tsx mobilePortrait gate'i); masaustu/yatay
// klasik Sidebar + ClockStack kullanmaya devam eder. Prototip boardshot.tsx ile birebir.
import { useEffect, useRef, useState } from 'react'
import './gameRedesign.css'
import { Icon } from './Icon'
import { Coins } from './Coins'

// Anlik PR degisim yonu (Sidebar'daki ile ayni): PR yukseldi=kotu(kirmizi ok), dustu=iyi(yesil).
function usePrTrend(pr: number | null | undefined): 'bad' | 'good' | null {
  const prev = useRef<number | null>(null)
  const [trend, setTrend] = useState<'bad' | 'good' | null>(null)
  useEffect(() => {
    if (pr == null) { prev.current = null; return }
    const before = prev.current
    prev.current = pr
    if (before == null) return
    const d = pr - before
    const next: 'bad' | 'good' | null = d > 0.05 ? 'bad' : d < -0.05 ? 'good' : null
    if (!next) return
    setTrend(next)
    const id = setTimeout(() => setTrend(null), 2600)
    return () => clearTimeout(id)
  }, [pr])
  return trend
}

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
  pr?: number | null // anlik PR (yalniz bota karsi self); null ise gizli
  prEstimate?: boolean // true -> "~" (oyun-ici tahmin)
  onOpenProfile?: () => void // rakip avatarina tikla -> herkese acik profil karti (self'te undefined)
}

function Player({ who, ring, coins, onAvatar }: {
  who: Who; ring: 'blue' | 'gold'; coins?: number | null; onAvatar?: () => void
}) {
  const trend = usePrTrend(who.pr)
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
      {/* Anlik PR (bota karsi oyun-ici tahmin) — dusuk=iyi. Yatay Sidebar ile ayni; dikeyde de gorunsun. */}
      {who.pr != null && (
        <div className={`gb-pr ${trend ? 'pr-' + trend : ''}`}>
          {trend && <span className="gb-pr-arw">{trend === 'bad' ? '▲' : '▼'}</span>}
          PR {who.prEstimate ? '~' : ''}{who.pr.toFixed(1)}
        </div>
      )}
    </div>
  )
}

// Kimlik basligi: SOL=ben (self), SAG=rakip. Orta: skor + maç uzunlugu + VS pullar.
export function GameHudHeader({ self, opp, selfCoins, target, selfScore, oppScore, selfColor, crawford, stake }: {
  self: Who; opp: Who; selfCoins?: number | null; target: number
  selfScore: number; oppScore: number; selfColor: 'white' | 'black'; crawford?: boolean
  stake?: number | null // bahis (pot); 0/null ise gizli
}) {
  const oppColor = selfColor === 'white' ? 'black' : 'white'
  return (
    <div className="gb-identity">
      <Player who={self} ring="blue" coins={selfCoins} onAvatar={self.onOpenProfile} />
      <div className="gb-center">
        <div className="gb-vsbox">
          <div className="gb-vsrow"><Icon name="crown-simple" size={14} />{selfScore}–{oppScore}<span className="gb-vslbl">skor</span></div>
          <div className="gb-vsrow">{crawford ? 'CRAWFORD' : target}<span className="gb-vslbl">{crawford ? '' : 'maç'}</span></div>
          {stake != null && stake > 0 && (
            <div className="gb-vsrow gb-stakerow"><Coins amount={stake} size={14} /><span className="gb-vslbl">bahis</span></div>
          )}
        </div>
        <div className="gb-vs">
          <span className={`gb-vs-chk ${selfColor === 'white' ? 'white' : 'navy'}`} />
          <span className="gb-vs-txt">VS</span>
          <span className={`gb-vs-chk ${oppColor === 'white' ? 'white' : 'navy'}`} />
        </div>
      </div>
      <Player who={opp} ring="gold" onAvatar={opp.onOpenProfile} />
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

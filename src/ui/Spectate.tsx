import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import MiniBoard from './MiniBoard'
import { Die } from './Dice'
import { showRoom } from '../api'
import type { GameState, Player } from '../engine/types'

interface Snap {
  turnStart?: GameState
  match?: { target: number; score: Record<Player, number> }
}

// Canli mac izleme: oda durumunu periyodik yoklar, pozisyonu salt-okunur gosterir.
export default function Spectate({
  code,
  p1,
  p2,
  onClose,
}: {
  code: string
  p1: string
  p2: string
  onClose: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  const [snap, setSnap] = useState<Snap | null>(null)
  const [gone, setGone] = useState(false)
  const verRef = useRef(-1)

  useEffect(() => {
    let alive = true
    let misses = 0
    const poll = async () => {
      try {
        const rv = await showRoom(code, verRef.current >= 0 ? verRef.current : undefined)
        if (!alive) return
        if (rv === null) return // degismedi
        verRef.current = rv.version
        if (rv.state) setSnap(rv.state as Snap)
        if (rv.status === 'finished') {
          misses++
          if (misses > 2) setGone(true)
        } else {
          misses = 0
        }
      } catch {
        /* gecici */
      }
    }
    poll()
    const id = window.setInterval(poll, 2000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [code])

  const ts = snap?.turnStart
  const dice = ts?.dice ?? []

  return (
    <div className="register-overlay modal spectate-overlay">
      <div className="spectate-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <div className="spectate-head">
          <span className="live-dot" /> <Icon name="eye" size={16} /> {t('live.watching')}
        </div>

        <div className="spectate-players">
          <span className={`sp-player ${ts?.turn === 'white' ? 'turn' : ''}`}>
            <span className="dot white" /> {p1}
            {snap?.match && <b> {snap.match.score.white}</b>}
          </span>
          <span className="sp-vs">–</span>
          <span className={`sp-player ${ts?.turn === 'black' ? 'turn' : ''}`}>
            {snap?.match && <b>{snap.match.score.black} </b>}
            {p2} <span className="dot black" />
          </span>
        </div>

        {ts ? (
          <>
            <MiniBoard state={ts} steps={[]} player={ts.turn} />
            <div className="spectate-dice">
              {dice.length > 0 ? (
                dice.map((d, i) => <Die key={i} value={d} owner={ts.turn} used={false} />)
              ) : (
                <span className="sp-roll">{t('live.rolling')}</span>
              )}
            </div>
          </>
        ) : gone ? (
          <div className="home-panel-empty">{t('live.ended')}</div>
        ) : (
          <div className="home-panel-empty">{t('an.loading')}</div>
        )}
      </div>
    </div>
  )
}

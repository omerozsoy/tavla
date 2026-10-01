import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { showTournament, type TournNotice } from '../api'

const COUNTDOWN = 3 // sn: rakip kisaca gorunur, sonra oyuncu macina OTOMATIK girer (aninda akis)
const DRAW_MS = 2200 // ilk tur: kura animasyonu suresi

interface Props {
  notice: TournNotice
  onEnter: () => void
  // Aktif bir oyundayken: OTOMATIK girme; "oyunu birak, gec" / "devam et" diye SOR.
  confirmLeave?: boolean
  onDismiss?: () => void
}

/**
 * Turnuva maci hazir: ilk turda kisa KURA animasyonu (katilimci isimleri doner, rakipte durur),
 * ardindan 20sn geri sayim -> oyuncu macina OTOMATIK girer ("Maca Gir" ile hemen).
 * Sitenin neresinde olursa olsun acilir (App, ping'teki tournament_matches'ten).
 */
export default function TournMatchReady({ notice, onEnter, confirmLeave = false, onDismiss }: Props) {
  const { t } = useT()
  const firstRound = (notice.round ?? 0) === 0
  const [drawing, setDrawing] = useState(firstRound)
  const [shown, setShown] = useState(firstRound ? '…' : notice.oppName)
  const [left, setLeft] = useState(COUNTDOWN)
  const enteredRef = useRef(false)
  const enter = () => {
    if (enteredRef.current) return
    enteredRef.current = true
    onEnter()
  }

  // Kura animasyonu: turnuvadaki isimler hizla doner, sonunda gercek rakipte durur.
  useEffect(() => {
    if (!firstRound) return
    let pool = [notice.oppName]
    showTournament(notice.tid)
      .then((tr) => {
        const names = (tr.players ?? []).map((p) => p.name).filter(Boolean)
        if (names.length > 1) pool = names
      })
      .catch(() => {})
    let i = 0
    const spin = window.setInterval(() => {
      setShown(pool[i++ % pool.length])
    }, 90)
    const stop = window.setTimeout(() => {
      window.clearInterval(spin)
      setShown(notice.oppName)
      setDrawing(false)
    }, DRAW_MS)
    return () => {
      window.clearInterval(spin)
      window.clearTimeout(stop)
    }
  }, [firstRound, notice.tid, notice.oppName])

  // Geri sayim (kura bittikten sonra); 0 -> otomatik giris.
  // confirmLeave: aktif oyun var -> OTOMATIK GIRME, kullanici onaylasin (coin/puan kaybi).
  useEffect(() => {
    if (drawing) return
    if (confirmLeave) return
    if (left <= 0) {
      enter()
      return
    }
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, left, confirmLeave])

  const rounds = notice.rounds ?? 0
  const ri = notice.round ?? 0
  const roundName =
    rounds > 0 && ri === rounds - 1
      ? t('tourn.final')
      : rounds > 1 && ri === rounds - 2
        ? t('tourn.semi')
        : t('tourn.round', { n: ri + 1 })

  return (
    <div className="register-overlay modal" role="dialog" aria-modal="true" aria-live="polite">
      <div className="register-card tmr-card">
        <div className="tmr-tname">
          <Icon name="medal" size={16} /> {notice.tname} · {roundName}
        </div>
        <h2 className="tmr-title">{drawing ? t('tourn.drawing') : firstRound ? t('tourn.drawDone') : t('tourn.nextMatch')}</h2>
        <div className="tmr-label">{t('tourn.opponent')}</div>
        <div className={`tmr-opp${drawing ? ' spinning' : ''}`}>{shown}</div>
        {!drawing && (confirmLeave ? (
          <>
            <div className="tmr-warn">{t('tourn.leaveCurrentWarn')}</div>
            <Button variant="destructive" className="tmr-go" onClick={enter}>
              <Icon name="flag" size={16} /> {t('tourn.leaveAndEnter')}
            </Button>
            <Button variant="secondary" onClick={() => onDismiss?.()}>
              {t('tourn.keepPlaying')}
            </Button>
          </>
        ) : (
          <>
            <div className="tmr-count" aria-label={t('tourn.autoEnter', { n: left })}>
              <span className="tmr-count-n tnum">{left}</span>
            </div>
            <div className="tmr-hint">{t('tourn.autoEnter', { n: left })}</div>
            <Button variant="default" className="tmr-go" onClick={enter}>
              <Icon name="play" size={16} /> {t('tourn.enterNow')}
            </Button>
          </>
        ))}
      </div>
    </div>
  )
}

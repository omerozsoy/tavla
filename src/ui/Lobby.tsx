import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'

interface RoomInfo {
  code: string
  slot: 'p1' | 'p2'
  oppName: string | null
  status: 'waiting' | 'mm_waiting' | 'playing' | 'finished'
}

interface Props {
  room: RoomInfo | null
  busy: boolean
  error: string
  onCreate: () => void
  onJoin: (code: string) => void
  onMatchmake: () => void
  onCancelMatch: () => void
  onLeave: () => void
}

export default function Lobby({
  room,
  busy,
  error,
  onCreate,
  onJoin,
  onMatchmake,
  onCancelMatch,
  onLeave,
}: Props) {
  const { t } = useT()
  const [code, setCode] = useState('')

  // Hizli eslesme: rakip araniyor
  if (room && room.status === 'mm_waiting') {
    return (
      <div className="register-overlay">
        <div className="register-card mm-searching">
          <div className="mm-spinner" />
          <h2>{t('mp.searching')}</h2>
          <p className="register-sub">{t('mp.searchingSub')}</p>
          <button className="menu-btn" onClick={onCancelMatch}>
            {t('mp.cancel')}
          </button>
        </div>
      </div>
    )
  }

  // Odaya girildi, rakip bekleniyor
  if (room && room.status === 'waiting') {
    return (
      <div className="register-overlay">
        <div className="register-card">
          <h2>{t('mp.waiting')}</h2>
          <p className="register-sub">{t('mp.shareCode')}</p>
          <div className="room-code">{room.code}</div>
          <button
            className="menu-btn"
            onClick={() => navigator.clipboard?.writeText(room.code).catch(() => {})}
          >
            {t('mp.copy')}
          </button>
          <div className="register-actions">
            <button className="menu-btn" onClick={onLeave}>
              {t('mp.leave')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Oda seçimi (oluştur / katıl)
  return (
    <div className="register-overlay">
      <div className="register-card">
        <h2><Icon name="globe" size={20} /> {t('mp.title')}</h2>
        <p className="register-sub">{t('mp.desc')}</p>

        <button className="galaxy-btn roll mm-quick" disabled={busy} onClick={onMatchmake}>
<Icon name="target" size={18} /> {t('mp.quickMatch')}
        </button>
        <p className="mm-quick-note">{t('mp.quickMatchNote')}</p>

        <div className="mp-or">— {t('mp.or')} —</div>

        <button className="menu-btn" disabled={busy} onClick={onCreate}>
          {t('mp.create')}
        </button>

        <div className="mp-or">— {t('mp.or')} —</div>

        <label>
          {t('mp.enterCode')}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            placeholder="ABX7Z"
          />
        </label>
        <button
          className="menu-btn"
          disabled={busy || code.trim().length < 4}
          onClick={() => onJoin(code.trim())}
        >
          {t('mp.join')}
        </button>

        {error && <div className="register-error">{error}</div>}

        <button type="button" className="guest-link" onClick={onLeave}>
          {t('mp.back')}
        </button>
      </div>
    </div>
  )
}

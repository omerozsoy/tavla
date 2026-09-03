import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { listContents, type Content } from '../api'

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
  myAvatar?: string | null
  onCreate: () => void
  onJoin: (code: string) => void
  onMatchmake: () => void
  onCancelMatch: () => void
  onLeave: () => void
  /** true: lobi kabugu (logo+sidebar) icinde GOMULU render (fixed tam-ekran overlay YERINE
   *  ortali in-flow panel) -> oda olustur/bekle ekraninda menu/logo kaybolmaz. */
  embedded?: boolean
}

export default function Lobby({
  room,
  busy,
  error,
  myAvatar,
  onCreate,
  onJoin,
  onMatchmake,
  onCancelMatch,
  onLeave,
  embedded,
}: Props) {
  const { t } = useT()
  // Gomulu: fixed overlay yerine ortali in-flow kap (kabuk gorunur kalir)
  const wrapCls = embedded ? 'lobby-embed' : 'register-overlay'
  const [code, setCode] = useState('')
  const [ads, setAds] = useState<Content[]>([])
  const [adIdx, setAdIdx] = useState(0)

  useEffect(() => {
    listContents('ad')
      .then(setAds)
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (ads.length < 2) return
    const id = window.setInterval(() => setAdIdx((i) => (i + 1) % ads.length), 4000)
    return () => window.clearInterval(id)
  }, [ads.length])

  // Hizli eslesme: rakip araniyor (avatar VS spinner + reklam)
  if (room && room.status === 'mm_waiting') {
    const ad = ads.length ? ads[adIdx % ads.length] : null
    return (
      <div className={wrapCls}>
        <div className="register-card mm-searching">
          <h2>{t('mp.searching')}</h2>
          <div className="mm-vs">
            <div className="mm-side">
              {myAvatar ? <img src={myAvatar} alt="" /> : <Icon name="user" size={30} />}
            </div>
            <span className="mm-vs-label">VS</span>
            <div className="mm-side mm-opp">
              <div className="mm-spinner" />
            </div>
          </div>

          {ad && (
            <div className="mm-ad">
              <a
                className="mm-ad-img"
                href={ad.body || undefined}
                target="_blank"
                rel="noreferrer"
                style={{ pointerEvents: ad.body ? 'auto' : 'none' }}
              >
                {ad.image ? (
                  <img src={ad.image} alt={ad.title} />
                ) : (
                  <div className="mm-ad-ph">{ad.title}</div>
                )}
              </a>
              {ads.length > 1 && (
                <div className="mm-ad-dots">
                  {ads.map((_, i) => (
                    <span key={i} className={i === adIdx ? 'on' : ''} />
                  ))}
                </div>
              )}
            </div>
          )}

          <Button variant="default" className="w-full" onClick={onCancelMatch}>
            {t('mp.cancel')}
          </Button>
        </div>
      </div>
    )
  }

  // Odaya girildi, rakip bekleniyor
  if (room && room.status === 'waiting') {
    return (
      <div className={wrapCls}>
        <div className="register-card">
          <h2>{t('mp.waiting')}</h2>
          <p className="register-sub">{t('mp.shareCode')}</p>
          <div className="room-code">{room.code}</div>
          <Button
            variant="outline"
            onClick={() => navigator.clipboard?.writeText(room.code).catch(() => {})}
          >
            {t('mp.copy')}
          </Button>
          <div className="register-actions">
            <Button variant="outline" onClick={onLeave}>
              {t('mp.leave')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Oda seçimi (oluştur / katıl)
  return (
    <div className={wrapCls}>
      <div className="register-card">
        <h2><Icon name="ranking" size={20} /> {t('mp.title')}</h2>
        <p className="register-sub">{t('mp.desc')}</p>

        <Button variant="default" className="w-full" disabled={busy} onClick={onMatchmake}>
<Icon name="target" size={18} /> {t('mp.quickMatch')}
        </Button>
        <p className="mm-quick-note">{t('mp.quickMatchNote')}</p>

        <div className="mp-or">— {t('mp.or')} —</div>

        <Button variant="outline" disabled={busy} onClick={onCreate}>
          {t('mp.create')}
        </Button>

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
        <Button
          variant="outline"
          disabled={busy || code.trim().length < 4}
          onClick={() => onJoin(code.trim())}
        >
          {t('mp.join')}
        </Button>

        {error && <div className="register-error">{error}</div>}

        <Button variant="ghost" type="button" className="guest-link" onClick={onLeave}>
          {t('mp.back')}
        </Button>
      </div>
    </div>
  )
}

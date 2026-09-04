import { useEffect, useState } from 'react'
import { Coins } from './Coins'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { userProfile, type PublicProfile as Profile } from '../api'
import PlayerIdentity from './PlayerIdentity'
import { BadgeList } from './Badges'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'

// Herkese acik oyuncu profili karti (liderlik/rakip isminden acilir)
// onAddFriend: giris yapmis + baskasinin profili ise arkadaslik istegi (App wire'lar).
export default function PublicProfile({
  id,
  onClose,
  onAddFriend,
}: {
  id: number
  onClose: () => void
  onAddFriend?: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  const [p, setP] = useState<Profile | null>(null)
  const [error, setError] = useState(false)
  const [friendSent, setFriendSent] = useState(false)

  useEffect(() => {
    let alive = true
    setP(null)
    setError(false)
    userProfile(id)
      .then((d) => alive && setP(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [id])

  const wr = p && p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0

  return (
    <div className="register-overlay modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="register-card pp-card" onClick={(e) => e.stopPropagation()}>
        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && !p && <div className="lb-empty">{t('an.loading')}</div>}

        {p && (
          <>
            <div className="pp-head">
              <PlayerIdentity
                lg
                name={p.name}
                rating={p.rating}
                avatar={p.avatar}
                frame={p.frame}
                country={p.country}
                flagInline
                size={64}
                animated
              />
              <div className="pp-rating">
                {p.rating}
                <div className="pp-coins">
                  <Coins amount={p.coins} size={14} />
                </div>
              </div>
            </div>
            <div className="pp-rank">{t('stats.rank', { r: p.rank, n: '' }).replace('/ ', '')}</div>

            <div className="pp-grid">
              <div className="pp-box">
                <div className="pp-val">{p.games}</div>
                <div className="pp-lbl">{t('stats.games')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val good">{p.wins}</div>
                <div className="pp-lbl">{t('stats.wins')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val bad">{p.losses}</div>
                <div className="pp-lbl">{t('stats.losses')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val">{p.games > 0 ? `%${wr}` : '–'}</div>
                <div className="pp-lbl">{t('stats.winRate')}</div>
              </div>
            </div>

            {p.form.length > 0 && (
              <div className="pp-form">
                <span className="pp-form-lbl">{t('stats.form')}</span>
                {p.form.map((w, i) => (
                  <span key={i} className={`pp-dot ${w ? 'win' : 'loss'}`}>
                    {w ? 'G' : 'M'}
                  </span>
                ))}
              </div>
            )}

            <BadgeList ids={p.badges} />

            {onAddFriend && (
              <Button
                variant="default"
                className="pp-addfriend w-full"
                disabled={friendSent}
                onClick={() => {
                  setFriendSent(true)
                  onAddFriend()
                }}
              >
                <Icon name={friendSent ? 'check' : 'user-plus'} size={16} />{' '}
                {friendSent ? t('online.friendSent') : t('online.addFriend')}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

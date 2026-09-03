import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import {
  getFriends,
  requestFriend,
  acceptFriend,
  removeFriend,
  type Friend,
} from '../api'
import PlayerIdentity from './PlayerIdentity'
import PublicProfile from './PublicProfile'
import { CountryFlag } from './Flag'
import { Button } from '@/components/ui/button'

interface Props {
  onInvite: (userId: number) => void
  onClose: () => void
}

export default function Friends({ onInvite, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [nick, setNick] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [profileId, setProfileId] = useState<number | null>(null)

  async function refresh() {
    try {
      const d = await getFriends()
      setFriends(d.friends)
      setIncoming(d.incoming)
    } catch {
      /* yoksay */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function add() {
    if (!nick.trim() || busy) return
    setBusy(true)
    setMsg('')
    try {
      const r = await requestFriend(nick.trim())
      setMsg(r.status === 'accepted' ? t('friends.added') : t('friends.sent'))
      setNick('')
      refresh()
    } catch {
      setMsg(t('friends.notFound'))
    } finally {
      setBusy(false)
    }
  }

  async function doAccept(id: number) {
    await acceptFriend(id)
    refresh()
  }
  async function doRemove(id: number) {
    await removeFriend(id)
    refresh()
  }

  const identity = (f: Friend) => (
    <button
      type="button"
      className="friend-id-btn"
      onClick={() => setProfileId(f.id)}
      title={t('menu.viewProfile')}
      aria-label={t('menu.viewProfile')}
    >
      <PlayerIdentity
        name={f.name}
        rating={f.rating}
        avatar={f.avatar}
        frame={f.frame}
        size={38}
        rankSize="md"
        className="friend-id"
      />
    </button>
  )

  return (
    <>
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card friends-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="users" size={20} /> {t('friends.title')}</h2>

        <div className="friends-add">
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder={t('friends.addPlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button variant="outline" disabled={busy || !nick.trim()} onClick={add}>
            {t('friends.add')}
          </Button>
        </div>
        {msg && <div className="friends-msg">{msg}</div>}

        {loading ? (
          <div className="lb-empty">{t('an.loading')}</div>
        ) : (
          <>
            {incoming.length > 0 && (
              <div className="friends-section">
                <h3>{t('friends.requests')}</h3>
                {incoming.map((f) => (
                  <div key={f.id} className="friend-row">
                    {identity(f)}
                    <span className="friend-flag">
                      <CountryFlag code={f.country} size={16} rounded={false} />
                    </span>
                    <span className="friend-actions">
                      <Button variant="default" size="icon" onClick={() => doAccept(f.id)} aria-label="Kabul">
                        <Icon name="check" size={16} />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => doRemove(f.id)} aria-label="Sil">
                        <Icon name="x" size={16} />
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="friends-section">
              <h3>{t('friends.list')}</h3>
              {friends.length === 0 ? (
                <div className="lb-empty">{t('friends.empty')}</div>
              ) : (
                // Online arkadaslar en ustte (stabil: online grubu once, sonra offline)
                [...friends]
                  .sort((a, b) => Number(b.online) - Number(a.online))
                  .map((f) => (
                  <div key={f.id} className="friend-row">
                    <span className={`friend-dot ${f.online ? 'on' : ''}`} title={f.online ? t('friends.online') : t('friends.offline')} />
                    {identity(f)}
                    <span className="friend-flag">
                      <CountryFlag code={f.country} size={16} rounded={false} />
                    </span>
                    <span className="friend-actions">
                      {f.online && (
                        <Button
                          variant="default"
                          size="icon"
                          title={t('friends.invite')}
                          aria-label={t('friends.invite')}
                          onClick={() => onInvite(f.id)}
                        >
                          <Icon name="play" size={16} />
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        title={t('friends.remove')}
                        aria-label={t('friends.remove')}
                        onClick={() => doRemove(f.id)}
                      >
                        <Icon name="trash" size={16} />
                      </Button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
    {profileId !== null && (
      <PublicProfile id={profileId} onClose={() => setProfileId(null)} />
    )}
    </>
  )
}

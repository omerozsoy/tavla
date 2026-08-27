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
import AvatarFrame from './AvatarFrame'

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

  const avatar = (f: Friend) => (
    <AvatarFrame src={f.avatar} frame={f.frame} size={30} name={f.name} animated={false} />
  )

  return (
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
          <button className="menu-btn" disabled={busy || !nick.trim()} onClick={add}>
            {t('friends.add')}
          </button>
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
                    {avatar(f)}
                    <span className="friend-name">{f.name}</span>
                    <span className="friend-rating">{f.rating}</span>
                    <button className="friend-btn ok" onClick={() => doAccept(f.id)} aria-label="Kabul">
                      <Icon name="check" size={16} />
                    </button>
                    <button className="friend-btn no" onClick={() => doRemove(f.id)} aria-label="Sil">
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="friends-section">
              <h3>{t('friends.list')}</h3>
              {friends.length === 0 ? (
                <div className="lb-empty">{t('friends.empty')}</div>
              ) : (
                friends.map((f) => (
                  <div key={f.id} className="friend-row">
                    <span className={`friend-dot ${f.online ? 'on' : ''}`} title={f.online ? t('friends.online') : t('friends.offline')} />
                    {avatar(f)}
                    <span className="friend-name">{f.name}</span>
                    <span className="friend-rating">{f.rating}</span>
                    {f.online && (
                      <button
                        className="friend-btn play"
                        title={t('friends.invite')}
                        onClick={() => onInvite(f.id)}
                      >
                        <Icon name="play" size={16} />
                      </button>
                    )}
                    <button
                      className="friend-btn no"
                      title={t('friends.remove')}
                      onClick={() => doRemove(f.id)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

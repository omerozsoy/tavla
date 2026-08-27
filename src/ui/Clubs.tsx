import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import {
  listClubs,
  myClub,
  createClub,
  joinClub,
  leaveClub,
  getClub,
  type ClubSummary,
  type ClubFull,
} from '../api'
import AvatarFrame from './AvatarFrame'
import PublicProfile from './PublicProfile'

interface Props {
  onClose: () => void
}

export default function Clubs({ onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [mine, setMine] = useState<ClubFull | null>(null)
  const [clubs, setClubs] = useState<ClubSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [desc, setDesc] = useState('')
  const [view, setView] = useState<ClubFull | null>(null) // baska kulup detayi
  const [profileId, setProfileId] = useState<number | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const [m, list] = await Promise.all([myClub(), listClubs()])
      setMine(m)
      setClubs(list)
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

  async function doCreate() {
    if (!name.trim() || busy) return
    setBusy(true)
    setMsg('')
    try {
      const c = await createClub({
        name: name.trim(),
        tag: tag.trim() || undefined,
        description: desc.trim() || undefined,
      })
      setMine(c)
      setCreating(false)
      setName('')
      setTag('')
      setDesc('')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('clubs.error'))
    } finally {
      setBusy(false)
    }
  }

  async function doJoin(id: number) {
    if (busy) return
    setBusy(true)
    setMsg('')
    try {
      const c = await joinClub(id)
      setMine(c)
      setView(null)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('clubs.error'))
    } finally {
      setBusy(false)
    }
  }

  async function doLeave() {
    if (busy) return
    setBusy(true)
    try {
      await leaveClub()
      setMine(null)
      refresh()
    } catch {
      /* yoksay */
    } finally {
      setBusy(false)
    }
  }

  async function openClub(id: number) {
    try {
      setView(await getClub(id))
    } catch {
      /* yoksay */
    }
  }

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

  const leagueTable = (c: ClubFull) => (
    <div className="club-league">
      <div className="club-league-head">
        <Icon name="medal" size={15} /> {t('clubs.leagueTable')}
      </div>
      {c.table.length === 0 ? (
        <div className="club-empty">{t('clubs.noMembers')}</div>
      ) : (
        <table className="club-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('clubs.player')}</th>
              <th>{t('clubs.points')}</th>
              <th>{t('clubs.wl')}</th>
            </tr>
          </thead>
          <tbody>
            {c.table.map((m, i) => (
              <tr key={m.user_id}>
                <td className="ct-rank">{medal(i)}</td>
                <td>
                  <button className="ct-player" onClick={() => setProfileId(m.user_id)}>
                    <AvatarFrame src={m.avatar} frame={undefined} size={30} name={m.nickname} animated={false} />
                    <span className="ct-name">
                      {m.nickname}
                      {m.role === 'owner' && <Icon name="crown" size={12} />}
                    </span>
                  </button>
                </td>
                <td className="ct-pts">{m.points}</td>
                <td className="ct-wl">
                  {m.wins}/{m.losses}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card clubs-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="users" size={20} /> {t('clubs.title')}
        </h2>

        {loading ? (
          <div className="club-empty">{t('clubs.loading')}</div>
        ) : mine ? (
          // ---- Kendi kulubum ----
          <div className="club-mine">
            <div className="club-banner">
              <div className="club-crest">{(mine.tag || mine.name).charAt(0).toUpperCase()}</div>
              <div className="club-info">
                <div className="club-name">
                  {mine.name}
                  {mine.tag && <span className="club-tag">{mine.tag}</span>}
                </div>
                {mine.description && <div className="club-desc">{mine.description}</div>}
                <div className="club-meta">
                  <span>
                    <Icon name="users" size={13} /> {mine.members_count} {t('clubs.members')}
                  </span>
                  <span>
                    <Icon name="medal" size={13} /> {mine.points} {t('clubs.points')}
                  </span>
                </div>
              </div>
              <button className="menu-btn danger club-leave" disabled={busy} onClick={doLeave}>
                {t('clubs.leave')}
              </button>
            </div>
            {leagueTable(mine)}
          </div>
        ) : (
          // ---- Kulup yok: olustur / katil ----
          <div className="club-browse">
            {creating ? (
              <div className="club-create">
                <input
                  value={name}
                  maxLength={60}
                  placeholder={t('clubs.namePh')}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  value={tag}
                  maxLength={6}
                  placeholder={t('clubs.tagPh')}
                  onChange={(e) => setTag(e.target.value)}
                />
                <textarea
                  value={desc}
                  maxLength={300}
                  placeholder={t('clubs.descPh')}
                  onChange={(e) => setDesc(e.target.value)}
                />
                <div className="club-create-actions">
                  <button className="btn-secondary" onClick={() => setCreating(false)}>
                    {t('setup.cancel')}
                  </button>
                  <button
                    className="galaxy-btn"
                    disabled={busy || !name.trim()}
                    onClick={doCreate}
                  >
                    {t('clubs.create')}
                  </button>
                </div>
              </div>
            ) : (
              <button className="menu-btn club-create-btn" onClick={() => setCreating(true)}>
                <Icon name="users" size={16} /> {t('clubs.createNew')}
              </button>
            )}

            {msg && <div className="friends-msg">{msg}</div>}

            <div className="club-list-head">{t('clubs.browse')}</div>
            {clubs && clubs.length === 0 ? (
              <div className="club-empty">{t('clubs.none')}</div>
            ) : (
              <div className="club-list">
                {clubs?.map((c) => (
                  <div key={c.id} className="club-row">
                    <button className="club-row-main" onClick={() => openClub(c.id)}>
                      <div className="club-crest sm">
                        {(c.tag || c.name).charAt(0).toUpperCase()}
                      </div>
                      <div className="club-row-info">
                        <div className="club-name">
                          {c.name}
                          {c.tag && <span className="club-tag">{c.tag}</span>}
                        </div>
                        <div className="club-meta">
                          <span>
                            <Icon name="users" size={12} /> {c.members_count}
                          </span>
                          <span>
                            <Icon name="medal" size={12} /> {c.points}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      className="menu-btn club-join"
                      disabled={busy}
                      onClick={() => doJoin(c.id)}
                    >
                      {t('clubs.join')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Baska kulup detayi (lig tablosu) */}
      {view && (
        <div className="register-overlay modal" role="dialog" aria-modal="true">
          <div className="register-card clubs-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setView(null)} aria-label={t('common.close')}>
              <Icon name="x" size={16} />
            </button>
            <h2>
              <Icon name="users" size={20} /> {view.name}
              {view.tag && <span className="club-tag">{view.tag}</span>}
            </h2>
            {view.description && <div className="club-desc">{view.description}</div>}
            {!mine && (
              <button
                className="galaxy-btn club-join-big"
                disabled={busy}
                onClick={() => doJoin(view.id)}
              >
                <Icon name="check" size={16} /> {t('clubs.join')}
              </button>
            )}
            {leagueTable(view)}
          </div>
        </div>
      )}

      {profileId !== null && (
        <PublicProfile id={profileId} onClose={() => setProfileId(null)} />
      )}
    </div>
  )
}

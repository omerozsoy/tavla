import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import {
  listTournaments,
  showTournament,
  createTournament,
  joinTournament,
  reportTournament,
  type Tournament,
  type TMatch,
} from '../api'

interface Props {
  myId: number | null
  onPlayMatch: (tid: number, m: TMatch, oppId: number) => void
  onClose: () => void
}

export default function Tournaments({ myId, onPlayMatch, onClose }: Props) {
  const { t } = useT()
  const [list, setList] = useState<Tournament[]>([])
  const [active, setActive] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [size, setSize] = useState(8)
  const [busy, setBusy] = useState(false)

  async function refreshList() {
    try {
      setList(await listTournaments())
    } catch {
      /* yoksay */
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    refreshList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function open(id: number) {
    try {
      setActive(await showTournament(id))
    } catch {
      /* yoksay */
    }
  }

  async function create() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const tr = await createTournament(name.trim(), size)
      setName('')
      setActive(tr)
      refreshList()
    } finally {
      setBusy(false)
    }
  }

  async function join(id: number) {
    setBusy(true)
    try {
      setActive(await joinTournament(id))
      refreshList()
    } finally {
      setBusy(false)
    }
  }

  async function report(matchKey: string, winnerId: number) {
    if (!active) return
    setBusy(true)
    try {
      setActive(await reportTournament(active.id, matchKey, winnerId))
    } finally {
      setBusy(false)
    }
  }

  // ---- Detay/bracket gorunumu ----
  if (active) {
    const champ = active.champion_id
      ? active.players?.find((p) => p.id === active.champion_id)
      : null
    const joined = active.players?.some((p) => p.id === myId)
    const canJoin = active.status === 'open' && !joined && myId != null
    return (
      <div className="register-overlay modal" onClick={onClose}>
        <div className="register-card tourn-card" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
          <button className="tourn-back" onClick={() => setActive(null)}>
            ← {t('tourn.back')}
          </button>
          <h2>🏆 {active.name}</h2>
          <div className="tourn-meta">
            {t('tourn.size', { n: active.size })} · {t(`tourn.status.${active.status}`)} ·{' '}
            {active.count}/{active.size}
          </div>

          {canJoin && (
            <button className="galaxy-btn roll" disabled={busy} onClick={() => join(active.id)}>
              {t('tourn.join')}
            </button>
          )}

          {champ && <div className="tourn-champ">👑 {t('tourn.champion')}: {champ.name}</div>}

          {active.status === 'open' ? (
            <div className="tourn-players">
              <h3>{t('tourn.players')}</h3>
              {active.players?.map((p) => (
                <div key={p.id} className="tourn-prow">
                  <span>{p.name}</span>
                  <b>{p.rating}</b>
                </div>
              ))}
              <div className="tourn-wait">{t('tourn.waitFull')}</div>
            </div>
          ) : (
            <div className="tourn-bracket">
              {active.bracket?.map((round, ri) => (
                <div key={ri} className="tourn-round">
                  <div className="tourn-round-title">{t('tourn.round', { n: ri + 1 })}</div>
                  {round.map((m) => {
                    const mine = m.p1?.id === myId || m.p2?.id === myId
                    const playable = mine && m.p1 && m.p2 && !m.winner
                    return (
                      <div key={m.key} className={`tourn-match ${mine ? 'mine' : ''}`}>
                        <div className={`tm-p ${m.winner === m.p1?.id ? 'win' : ''}`}>
                          {m.p1?.name ?? '—'}
                        </div>
                        <div className={`tm-p ${m.winner === m.p2?.id ? 'win' : ''}`}>
                          {m.p2?.name ?? '—'}
                        </div>
                        {playable && (
                          <>
                            <button
                              className="tm-play"
                              onClick={() =>
                                onPlayMatch(active.id, m, m.p1?.id === myId ? m.p2!.id : m.p1!.id)
                              }
                            >
                              🎮 {t('tourn.play')}
                            </button>
                            <div className="tm-actions">
                              <button disabled={busy} onClick={() => report(m.key, myId!)}>
                                {t('tourn.iWon')}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  report(m.key, m.p1?.id === myId ? m.p2!.id : m.p1!.id)
                                }
                              >
                                {t('tourn.iLost')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Liste + olustur ----
  return (
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card tourn-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
        <h2>🏆 {t('tourn.title')}</h2>

        {myId != null && (
          <div className="tourn-create">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('tourn.namePlaceholder')}
            />
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
            </select>
            <button className="menu-btn" disabled={busy || !name.trim()} onClick={create}>
              {t('tourn.create')}
            </button>
          </div>
        )}

        {loading ? (
          <div className="lb-empty">{t('an.loading')}</div>
        ) : list.length === 0 ? (
          <div className="lb-empty">{t('tourn.empty')}</div>
        ) : (
          <div className="tourn-list">
            {list.map((tr) => (
              <button key={tr.id} className="tourn-litem" onClick={() => open(tr.id)}>
                <span className="tourn-lname">{tr.name}</span>
                <span className="tourn-lmeta">
                  {t(`tourn.status.${tr.status}`)} · {tr.count}/{tr.size}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

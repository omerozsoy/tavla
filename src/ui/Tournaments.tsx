import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import {
  listTournaments,
  showTournament,
  joinTournament,
  reportTournament,
  finishTournament,
  startTournament,
  deleteTournament,
  type Tournament,
  type TMatch,
} from '../api'

interface Props {
  myId: number | null
  isAdmin: boolean
  onPlayMatch: (tid: number, m: TMatch, oppId: number) => void
  onClose: () => void
}

export default function Tournaments({ myId, isAdmin, onPlayMatch, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [list, setList] = useState<Tournament[]>([])
  const [active, setActive] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
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

  async function doFinish(id: number) {
    if (busy) return
    setBusy(true)
    try {
      await finishTournament(id)
      await refreshList()
      if (active?.id === id) setActive(await showTournament(id))
    } catch {
      /* yoksay */
    } finally {
      setBusy(false)
    }
  }

  async function doDelete(id: number) {
    if (busy || !confirm(t('admin.confirmDelTourn'))) return
    setBusy(true)
    try {
      await deleteTournament(id)
      if (active?.id === id) setActive(null)
      await refreshList()
    } catch {
      /* yoksay */
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
      <div className="register-overlay modal page" role="dialog" aria-modal="true">
        <div className="register-card tourn-card" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
          <button className="tourn-back" onClick={() => setActive(null)}>
            ← {t('tourn.back')}
          </button>
          <h2><Icon name="trophy" size={20} /> {active.name}</h2>
          <div className="tourn-meta">
            {t('tourn.size', { n: active.size })} · {t(`tourn.status.${active.status}`)} ·{' '}
            {active.count}/{active.size}
          </div>
          {(!!active.prize_coins || active.prize_desc || !!active.entry_fee) && (
            <div className="tourn-prize">
              <Icon name="medal" size={16} /> {t('tourn.prizeLabel')}:{' '}
              {!!active.prize_coins && (
                <b>
                  <Icon name="coin" size={14} /> {active.prize_coins} coin
                </b>
              )}
              {active.prize_desc && <span> {active.prize_desc}</span>}
              {!!active.entry_fee && (
                <span className="tourn-fee">
                  {' '}
                  · <Icon name="ticket" size={14} /> {t('tourn.entryFee')}: {active.entry_fee}
                </span>
              )}
            </div>
          )}

          {canJoin && (
            <button className="galaxy-btn" disabled={busy} onClick={() => join(active.id)}>
              {t('tourn.join')}
            </button>
          )}

          {champ && (
            <div className="tourn-champ">
              <Icon name="crown" size={16} /> {t('tourn.champion')}: {champ.name}
            </div>
          )}

          {active.status === 'open' ? (
            <div className="tourn-players">
              <h3>{t('tourn.players')}</h3>
              {active.players?.map((p) => (
                <div key={p.id} className="tourn-prow">
                  <span>{p.name}</span>
                  <b>{p.rating}</b>
                </div>
              ))}
              {isAdmin && (active.players?.length ?? 0) >= 2 ? (
                <button
                  className="galaxy-btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      setActive(await startTournament(active.id))
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <Icon name="play" size={16} /> {t('tourn.start')}
                </button>
              ) : (
                <div className="tourn-wait">{t('tourn.waitFull')}</div>
              )}
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
                              <Icon name="play" size={16} /> {t('tourn.play')}
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
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card tourn-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="trophy" size={20} /> {t('tourn.title')}</h2>

        {loading ? (
          <div className="lb-empty">{t('an.loading')}</div>
        ) : list.length === 0 ? (
          <div className="lb-empty">{t('tourn.empty')}</div>
        ) : (
          <div className="tourn-list">
            {list.map((tr) => (
              <div key={tr.id} className="tourn-litem-wrap">
                <button className="tourn-litem" onClick={() => open(tr.id)}>
                  <span className="tourn-lname">
                    {tr.name}
                    {!!tr.prize_coins && (
                      <span className="tourn-prize-badge">
                        <Icon name="coin" size={13} /> {tr.prize_coins}
                      </span>
                    )}
                  </span>
                  <span className="tourn-lmeta">
                    {t(`tourn.status.${tr.status}`)} · {tr.count}/{tr.size}
                  </span>
                </button>
                {isAdmin && (
                  <div className="tourn-admin-actions">
                    {tr.status !== 'finished' && (
                      <button
                        className="tourn-admin-btn"
                        disabled={busy}
                        onClick={() => doFinish(tr.id)}
                        title={t('admin.finishTournament')}
                        aria-label={t('admin.finishTournament')}
                      >
                        <Icon name="check" size={15} />
                      </button>
                    )}
                    <button
                      className="tourn-admin-btn danger"
                      disabled={busy}
                      onClick={() => doDelete(tr.id)}
                      title={t('admin.delTournament')}
                      aria-label={t('admin.delTournament')}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

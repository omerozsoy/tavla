import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Countdown } from './Countdown'
import PlayerIdentity from './PlayerIdentity'
import {
  listTournaments,
  showTournament,
  joinTournament,
  leaveTournament,
  reportTournament,
  type Tournament,
  type TMatch,
} from '../api'
import { Button } from '@/components/ui/button'

interface Props {
  myId: number | null
  onPlayMatch: (tid: number, m: TMatch, oppId: number) => void
  onClose: () => void
  /** Verilirse acilista dogrudan bu turnuvanin detayi gosterilir (ana sayfa reklamindan). */
  initialId?: number | null
}


export default function Tournaments({ myId, onPlayMatch, onClose, initialId }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [list, setList] = useState<Tournament[]>([])
  const [active, setActive] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'join' | 'leave'>(null) // katıl/çık onay dialogu

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
    // Reklamdan gelindiyse dogrudan o turnuvanin detayini ac
    if (initialId != null) open(initialId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function open(id: number) {
    try {
      setActive(await showTournament(id))
    } catch {
      /* yoksay */
    }
  }



  async function join(id: number) {
    setBusy(true)
    try {
      setActive(await joinTournament(id))
      refreshList()
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  async function leave(id: number) {
    setBusy(true)
    try {
      setActive(await leaveTournament(id))
      refreshList()
    } finally {
      setBusy(false)
      setConfirm(null)
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
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </Button>
          <button type="button" className="tourn-back-link" onClick={() => setActive(null)}>
            <span aria-hidden="true">←</span> {t('tourn.back')}
          </button>
          <h2><Icon name="trophy" size={20} /> {active.name}</h2>
          <div className="td-chips">
            <span className={`tr-status tr-status-${active.status}`}>
              {t(`tourn.status.${active.status}`)}
            </span>
            <span className="td-chip">
              <Icon name="users" size={13} /> {active.count}/{active.size}
            </span>
            {!!active.entry_fee && (
              <span className="td-chip">
                <Icon name="ticket" size={13} /> {t('tourn.entryFee')}:{' '}
                {active.entry_fee.toLocaleString('tr-TR')}
              </span>
            )}
          </div>
          {active.venue && (
            <div className="tourn-venue">
              <Icon name="pin" size={15} /> {active.venue}
            </div>
          )}
          {active.status === 'open' && active.starts_at && (
            <div className="tourn-countdown">
              <span className="tc-lbl">
                <Icon name="clock" size={15} /> {t('tourn.startsIn')}
              </span>
              <Countdown target={active.starts_at} onExpire={() => open(active.id)} />
              {active.register_until && (
                <span className="tc-until">
                  {t('tourn.registerUntil')}:{' '}
                  {new Date(active.register_until).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          )}
          {active.prizes && active.prizes.length > 0 ? (
            <div className="tourn-prizes">
              <div className="tp-head">
                <Icon name="medal" size={16} /> {t('tourn.prizeLabel')}
              </div>
              <ol className="tp-list">
                {active.prizes.map((pr, i) => (
                  <li key={i} className="tp-row">
                    <span className={`tp-rank${i < 3 ? ' tp-rank-' + (i + 1) : ''}`}>{i + 1}.</span>
                    <span className="tp-desc">{pr.desc || t('tourn.prizeCoinLbl')}</span>
                    <span className="tp-coins">
                      <Icon name="coin" size={14} /> {pr.coins.toLocaleString('tr-TR')}
                    </span>
                  </li>
                ))}
              </ol>
              {active.prize_desc && <div className="tp-note">{active.prize_desc}</div>}
              {!!active.entry_fee && (
                <div className="tourn-fee">
                  <Icon name="ticket" size={14} /> {t('tourn.entryFee')}: {active.entry_fee}
                </div>
              )}
            </div>
          ) : (
            (!!active.prize_coins || active.prize_desc || !!active.entry_fee) && (
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
            )
          )}

          {(canJoin || (joined && active.status === 'open')) && (
            <div className="tourn-actions">
              {canJoin && (
                <Button variant="default" disabled={busy} onClick={() => setConfirm('join')}>
                  {t('tourn.join')}
                  {!!active.entry_fee && (
                    <span className="tourn-join-fee">
                      <Icon name="coin" size={14} /> {active.entry_fee.toLocaleString('tr-TR')}
                    </span>
                  )}
                </Button>
              )}
              {joined && active.status === 'open' && (
                <Button variant="destructive" disabled={busy} onClick={() => setConfirm('leave')}>
                  <Icon name="x" size={16} /> {t('tourn.leave')}
                </Button>
              )}
            </div>
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
                  <PlayerIdentity name={p.name} rating={p.rating} avatar={p.avatar} size={30} rankSize="md" />
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
                            <Button
                              variant="default"
                              className="tm-play"
                              onClick={() =>
                                onPlayMatch(active.id, m, m.p1?.id === myId ? m.p2!.id : m.p1!.id)
                              }
                            >
                              <Icon name="play" size={16} /> {t('tourn.play')}
                            </Button>
                            <div className="tm-actions">
                              <Button variant="outline" disabled={busy} onClick={() => report(m.key, myId!)}>
                                {t('tourn.iWon')}
                              </Button>
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  report(m.key, m.p1?.id === myId ? m.p2!.id : m.p1!.id)
                                }
                              >
                                {t('tourn.iLost')}
                              </Button>
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
        {confirm && active && (
          <div className="register-overlay modal" role="dialog" aria-modal="true">
            <div className="register-card tourn-confirm" onClick={(e) => e.stopPropagation()}>
              {confirm === 'join' ? (
                <>
                  <h3>{t('tourn.joinTitle')}</h3>
                  <p className="tourn-confirm-desc">{t('tourn.joinDesc')}</p>
                  <div className="tourn-confirm-amt">
                    <Icon name="coin" size={22} /> {(active.entry_fee ?? 0).toLocaleString('tr-TR')} GC
                  </div>
                  <div className="tourn-confirm-actions">
                    <Button variant="secondary" onClick={() => setConfirm(null)}>
                      {t('reg.cancel')}
                    </Button>
                    <Button variant="default" disabled={busy} onClick={() => join(active.id)}>
                      {t('tourn.join')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3>{t('tourn.leaveTitle')}</h3>
                  <p className="tourn-confirm-desc">{t('tourn.leaveDesc')}</p>
                  <div className="tourn-confirm-actions">
                    <Button variant="secondary" onClick={() => setConfirm(null)}>
                      {t('reg.cancel')}
                    </Button>
                    <Button variant="destructive" disabled={busy} onClick={() => leave(active.id)}>
                      {t('tourn.leave')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- Liste + olustur ----
  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card tourn-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2><Icon name="trophy" size={20} /> {t('tourn.title')}</h2>

        {loading ? (
          <div className="lb-empty">{t('an.loading')}</div>
        ) : list.length === 0 ? (
          <div className="lb-empty">{t('tourn.empty')}</div>
        ) : (
          <div className="tourn-list">
            {list.map((tr) => {
              const full = tr.count >= tr.size
              const pct = tr.size > 0 ? Math.min(100, Math.round((tr.count / tr.size) * 100)) : 0
              // Odul havuzu: prizes tablosu varsa toplami, yoksa prize_coins
              const pool =
                tr.prizes && tr.prizes.length > 0
                  ? tr.prizes.reduce((s, p) => s + (p.coins || 0), 0)
                  : tr.prize_coins ?? 0
              const prizeCount = tr.prizes?.length ?? 0
              return (
                <button key={tr.id} className="tcard" onClick={() => open(tr.id)}>
                  <div className="tcard-top">
                    <span className="tcard-name">{tr.name}</span>
                    <span className="tcard-badges">
                      {tr.status === 'open' && tr.starts_at && (
                        <Countdown target={tr.starts_at} onExpire={refreshList} />
                      )}
                      <span className={`tcard-status tcard-status-${tr.status}`}>
                        {t(`tourn.status.${tr.status}`)}
                      </span>
                    </span>
                  </div>
                  {tr.venue && (
                    <div className="tcard-venue">
                      <Icon name="pin" size={13} /> {tr.venue}
                    </div>
                  )}
                  <div className="tcard-stats">
                    <div className="tcard-stat">
                      <span className="tcard-ic gold" aria-hidden="true">
                        <Icon name="medal" size={17} />
                      </span>
                      <span className="tcard-sb">
                        <span className="tcard-val">
                          {pool.toLocaleString('tr-TR')} <small>coin</small>
                        </span>
                        <span className="tcard-lbl">
                          {t('tourn.prizePool')}
                          {prizeCount > 1 ? ` · ${prizeCount}×` : ''}
                        </span>
                      </span>
                    </div>
                    <div className="tcard-stat">
                      <span className="tcard-ic brick" aria-hidden="true">
                        <Icon name="ticket" size={17} />
                      </span>
                      <span className="tcard-sb">
                        <span className="tcard-val">
                          {tr.entry_fee ? tr.entry_fee.toLocaleString('tr-TR') : t('tourn.free')}
                        </span>
                        <span className="tcard-lbl">{t('tourn.entryFee')}</span>
                      </span>
                    </div>
                    <div className="tcard-stat">
                      <span className="tcard-ic navy" aria-hidden="true">
                        <Icon name="users" size={17} />
                      </span>
                      <span className="tcard-sb">
                        <span className="tcard-val" data-full={full || undefined}>
                          {tr.count}
                          <small>/{tr.size}</small>
                        </span>
                        <span className="tcard-lbl">{t('tourn.players')}</span>
                      </span>
                    </div>
                  </div>
                  <div className="tcard-bar" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <span className="tcard-cta">
                    {t('tourn.details')} <Icon name="arrow-right" size={15} />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

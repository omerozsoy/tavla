import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { useEscape } from './useEscape'
import { Countdown } from './Countdown'
import PlayerIdentity from './PlayerIdentity'
import { TavlaTvLogo } from './TavlaTvLogo'
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

// SEO-dostu URL: /online-turnuvalar/{isim-slug}-{id}. Id sonda kalir -> derin link cozumu
// (applyFromPath son '-' parcasini id olarak alir). Eski /turnuvalar/... de calisir.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
export function tournUrlSlug(t: { id: number; name: string }): string {
  const s = slugify(t.name || '')
  return s ? `${s}-${t.id}` : String(t.id)
}

// Takvim (turnuva-takvimi) ile ayni tarih rozeti: bordo kare, GUN + altinda AY.
const monthUpper = (d: Date) =>
  d.toLocaleDateString('tr-TR', { month: 'long' }).toLocaleUpperCase('tr-TR')
// Kurum logosu ciplak yol olabilir -> /uploads/ oneki (mutlak/kok ise dokunma).
const orgLogoSrc = (logo?: string | null): string | null =>
  logo ? (/^(https?:|\/)/.test(logo) ? logo : '/uploads/' + logo) : null

interface Props {
  myId: number | null
  onPlayMatch: (tid: number, m: TMatch, oppId: number) => void
  onClose: () => void
  /** Acik turnuva detayi (URL: /online-turnuvalar/{id}). null -> liste. Ust bilesen (App) kontrol eder. */
  detailId?: number | null
  /** Detay ac/kapat -> App URL'i gunceller. slug verilirse SEO-dostu URL (/online-turnuvalar/isim-{id}). */
  onOpenDetail?: (id: number | null, slug?: string) => void
}


export default function Tournaments({ myId, onPlayMatch, onClose, detailId, onOpenDetail }: Props) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detay App/URL tarafindan KONTROL edilir: detailId degisince o turnuvayi getir
  // (null -> liste). Boylece /online-turnuvalar/{id} derin linki + geri/ileri tusu calisir.
  useEffect(() => {
    if (detailId == null) {
      setActive(null)
      return
    }
    let ok = true
    showTournament(detailId)
      .then((tt) => ok && setActive(tt))
      .catch(() => {
        /* yoksay */
      })
    return () => {
      ok = false
    }
  }, [detailId])

  // Detay yuklendiginde URL'i SEO-dostu slug'a yukselt (banner/eski-id ile acildiysa da).
  useEffect(() => {
    if (active) onOpenDetail?.(active.id, tournUrlSlug(active))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])



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
          <Button
            type="button"
            variant="default"
            className="tourn-back-btn"
            onClick={() => onOpenDetail?.(null)}
          >
            <Icon name="caret-left" size={16} /> {t('tourn.back')}
          </Button>
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
          {active.organizer && (
            <div className="tourn-organizer">
              {active.organizer.logo ? (
                <img
                  className="tourn-org-logo"
                  src={orgLogoSrc(active.organizer.logo) ?? undefined}
                  alt={active.organizer.name}
                />
              ) : (
                <Icon name="building-office" size={15} />
              )}
              <span>{t('tourn.organization')}: {active.organizer.name}</span>
            </div>
          )}
          {/* Duzenleyen: HER online turnuvada TavlaTv (sabit kural) */}
          <div className="tourn-organizer tourn-runby">
            <span>
              {t('tourn.organizer')}:{' '}
              <TavlaTvLogo size={24} tone="light" className="tourn-runby-logo" />
            </span>
          </div>
          {active.status === 'open' && active.starts_at && (
            <div className="tourn-countdown">
              <span className="tc-lbl">
                <Icon name="clock" size={15} /> {t('tourn.startsIn')}
              </span>
              <Countdown
                target={active.starts_at}
                onExpire={() => showTournament(active.id).then(setActive).catch(() => {})}
              />
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
                      <Coins amount={pr.coins} gain suffix="coin" size={14} />
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
                  <Coins amount={active.prize_coins} suffix="coin" size={14} />
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
                      <Coins amount={active.entry_fee} size={14} />
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

          {/* Katilimci listesi HER durumda gorunur (acik/devam/bitti) */}
          <div className="tourn-players">
            <h3>
              <Icon name="users" size={16} /> {t('tourn.players')}{' '}
              <span className="tourn-players-count">{active.count}/{active.size}</span>
            </h3>
            {active.players && active.players.length > 0 ? (
              active.players.map((p) => (
                <div key={p.id} className="tourn-prow">
                  <PlayerIdentity name={p.name} rating={p.rating} avatar={p.avatar} size={30} rankSize="md" />
                  <b>{p.rating}</b>
                </div>
              ))
            ) : (
              <div className="tourn-wait">{t('tourn.noPlayers')}</div>
            )}
            {active.status === 'open' && <div className="tourn-wait">{t('tourn.waitFull')}</div>}
          </div>

          {active.status !== 'open' && (
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
                    <Coins amount={active.entry_fee ?? 0} size={22} suffix="GC" />
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

  // Aktif (open/running) ile BİTEN (finished) turnuvalari ayir: biten "Geçmiş"te.
  const activeList = list.filter((tr) => tr.status !== 'finished')
  const pastList = list.filter((tr) => tr.status === 'finished')

  // Tek turnuva karti (aktif + gecmis listelerinde ortak render).
  // Tasarim: turnuva-takvimi (etkinlik) satiri ile ayni yatay duzen — SOL: duzenleyen
  // kurum logosu; ORTA: tarih rozeti + baslik + kurum/mekan + istatistik + doluluk.
  // Etkinlik satirindan farki: OTEL ve HARITA sutunu YOK (online turnuvada mekan yok).
  const renderCard = (tr: Tournament) => {
    const full = tr.count >= tr.size
    const pct = tr.size > 0 ? Math.min(100, Math.round((tr.count / tr.size) * 100)) : 0
    const pool =
      tr.prizes && tr.prizes.length > 0
        ? tr.prizes.reduce((s, p) => s + (p.coins || 0), 0)
        : tr.prize_coins ?? 0
    const prizeCount = tr.prizes?.length ?? 0
    const start = tr.starts_at ? new Date(tr.starts_at) : null
    const logo = orgLogoSrc(tr.organizer?.logo)
    return (
      <button
        key={tr.id}
        className={`event-row tourn-row ${tr.status === 'finished' ? 'past' : ''} ${logo ? 'has-logo' : ''}`}
        onClick={() => onOpenDetail?.(tr.id, tournUrlSlug(tr))}
      >
        {/* Sag ust kose flamasi: turnuva-takvimindeki bayrak gibi -> icinde TavlaTV logosu
            (wordmark), bayrak gibi 90 derece dondurulup dik flamayi doldurur. */}
        <span className="event-ribbon tourn-ribbon" aria-hidden="true">
          <span className="event-ribbon-band tourn-ribbon-band">
            <TavlaTvLogo size={20} tone="dark" className="tourn-ribbon-logo" />
          </span>
        </span>
        {/* Katilim ucreti: UST SAGDA (flamanin soluna, altina girmeden). */}
        <span className={`tourn-fee ${tr.entry_fee ? '' : 'free'}`}>
          <Icon name="ticket" size={15} />
          {tr.entry_fee ? tr.entry_fee.toLocaleString('tr-TR') : t('tourn.free')}
        </span>
        {/* Sol: duzenleyen kurumun BUYUK logosu (varsa; yoksa sutun render edilmez). */}
        {logo && (
          <div className="event-logo-col">
            <img className="event-kurum-logo" src={logo} alt={tr.organizer?.name ?? ''} />
          </div>
        )}
        {/* Orta: turnuva bilgileri */}
        <div className="event-main">
          {/* Tarih rozeti (baslama gunu) + YER (online turnuva -> "Online") + durum + geri sayim */}
          <div className="event-datebadges">
            {start && (
              <div className="event-datebadge">
                <span className="edb-day">{start.getDate()}</span>
                <span className="edb-month">{monthUpper(start)}</span>
              </div>
            )}
            {/* Online turnuva: etkinlik takvimindeki IL (event-province-top) ile BIREBIR ayni
                format -> tarih rozetinin yaninda buyuk (1.6rem) kiremit "Online". */}
            <span className="event-province-top">{t('tourn.online')}</span>
            <span className={`tcard-status tcard-status-${tr.status}`}>
              {t(`tourn.status.${tr.status}`)}
            </span>
            {/* Katilimcilar: UST SATIRDA, durum rozetinin yaninda (kompakt). */}
            <span className="tourn-players">
              <span className="tcard-ic navy" aria-hidden="true">
                <Icon name="users" size={16} />
              </span>
              <span className="tourn-pcount" data-full={full || undefined}>
                {tr.count}
                <small>/{tr.size}</small>
              </span>
              <span className="tourn-plabel">{t('tourn.players')}</span>
              <span className="tourn-pbar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
            </span>
          </div>
          {/* Geri sayim: tarihin ALTINDA, baslik ile arasinda (kendi satiri). */}
          {tr.status === 'open' && tr.starts_at && (
            <div className="tourn-cd-row">
              <Countdown target={tr.starts_at} onExpire={refreshList} />
            </div>
          )}
          <div className="event-title">{tr.name}</div>
          {/* Organizasyon = katkida bulunan kurum (varsa); Duzenleyen = HER online
              turnuvada TavlaTv (sabit kural). Iki ayri satir. */}
          <div className="event-meta">
            {tr.organizer && (
              <span className="event-organizer">
                <Icon name="star" size={24} /> {t('tourn.organization')}: {tr.organizer.name}
              </span>
            )}
            <span className="event-runby">
              {t('tourn.organizer')}:{' '}
              <TavlaTvLogo size={24} tone="light" className="event-runby-logo" />
            </span>
          </div>
          {/* Odul dagilimi: 1., 2., 3. ... her sira ne kazanir -> NET liste.
              prizes[] varsa sira-sira; yoksa tek toplam odul (fallback). */}
          {tr.prizes && tr.prizes.length > 0 ? (
            <div className="tourn-prizes tourn-row-prizes">
              <div className="tp-head">
                <Icon name="medal" size={16} /> {t('tourn.prizeLabel')}
                {prizeCount > 1 ? ` · ${prizeCount}×` : ''}
              </div>
              <ol className="tp-list">
                {tr.prizes.map((pr, i) => (
                  <li key={i} className="tp-row">
                    <span className={`tp-rank${i < 3 ? ' tp-rank-' + (i + 1) : ''}`}>{i + 1}.</span>
                    <span className="tp-desc">{pr.desc || t('tourn.prizeCoinLbl')}</span>
                    <span className="tp-coins">
                      <Coins amount={pr.coins} gain suffix="coin" size={14} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            pool > 0 && (
              <div className="tourn-prizes tourn-row-prizes">
                <div className="tp-head">
                  <Icon name="medal" size={16} /> {t('tourn.prizePool')}
                </div>
                <ol className="tp-list">
                  <li className="tp-row">
                    <span className="tp-rank tp-rank-1">1.</span>
                    <span className="tp-desc">{tr.prize_desc || t('tourn.prizeCoinLbl')}</span>
                    <span className="tp-coins">
                      <Coins amount={pool} gain suffix="coin" size={14} />
                    </span>
                  </li>
                </ol>
              </div>
            )
          )}
        </div>
      </button>
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
          <>
            {activeList.length > 0 ? (
              <div className="tourn-list">{activeList.map(renderCard)}</div>
            ) : (
              <div className="lb-empty">{t('tourn.empty')}</div>
            )}
            {/* Biten turnuvalar: sayfanin sonunda "Geçmiş" basligi altinda */}
            {pastList.length > 0 && (
              <div className="tourn-past">
                <h3 className="tourn-past-title">{t('tourn.past')}</h3>
                <div className="tourn-list">{pastList.map(renderCard)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

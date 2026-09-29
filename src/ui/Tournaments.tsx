import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import Breadcrumb, { homeCrumb } from './Breadcrumb'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { useEscape } from './useEscape'
import { Countdown } from './Countdown'
import Loading from './Loading'
import PlayerIdentity from './PlayerIdentity'
import PremiumCrown from './PremiumCrown'
import { TavlaTvLogo } from './TavlaTvLogo'
import {
  listTournaments,
  showTournament,
  pollTournament,
  tournamentViewers,
  joinTournament,
  leaveTournament,
  tournamentRoundMinutes,
  tournamentRoundTarget,
  type Tournament,
  type TMatch,
  ApiError,
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
  /** Kullanici Premium mu? (premium_only turnuvaya katilim) */
  premium?: boolean
  /** Misafir "Katil"a basti -> giris/kayit ekrani. */
  onRequireLogin?: () => void
  /** Normal uye Premium'a ozel turnuvaya "Katil"a basti -> uyelik ekrani. */
  onRequirePremium?: () => void
  /** Suren bir turnuva macini izle (goz butonu) -> App'in izleme ekrani. */
  onSpectate?: (code: string, p1: string, p2: string) => void
}


export default function Tournaments({ myId, onPlayMatch, onClose, detailId, onOpenDetail, premium = false, onRequireLogin, onRequirePremium, onSpectate }: Props) {
  const { t } = useT()
  useEscape(onClose)
  // Mac uzunlugu etiketi: 1 -> "Tek oyun", n -> "n puan"
  const lenLabel = (n: number) => (n <= 1 ? t('friend.single') : t('invite.points', { n }))
  const [list, setList] = useState<Tournament[]>([])
  const [active, setActive] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'join' | 'leave'>(null) // katıl/çık onay dialogu
  // Canli yenileme kalkani: katil/cik/sonuc istegi surerken (busy) veya poll ucusta iken bir
  // mutasyon olduysa (mutSeq degisti) gelen poll yaniti ESKI olabilir -> uygulanmaz.
  const busyRef = useRef(false)
  busyRef.current = busy
  const revRef = useRef<string | undefined>(undefined) // acik detayin sunucu surumu (poll 204 anahtari)
  revRef.current = active?.rev
  const mutSeq = useRef(0)

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

  // CANLI GUNCELLEME: acik detay 8sn'de bir sunucuya elindeki rev'i sorar; yalniz degistiyse tam
  // veri gelir (aksi 204). rev kayit acikken katilimcilara, turnuva BASLADIKTAN SONRA yalniz mac
  // sonuclarina bagli -> baslamis turnuvada sayfa yalniz bir mac bitince guncellenir. Liste (kart
  // sayaclari, ~1KB) 15sn'de bir. Sekme gizliyken durur, one gelince hemen tazeler. Biten turnuva
  // artik degismez -> detay poll'u kapanir.
  useEffect(() => {
    if (detailId == null || active?.status === 'finished') return
    let alive = true
    const tick = () => {
      if (document.visibilityState !== 'visible' || busyRef.current) return
      const seq = mutSeq.current
      pollTournament(detailId, revRef.current)
        .then((tt) => {
          if (tt && alive && seq === mutSeq.current && !busyRef.current) setActive(tt)
        })
        .catch(() => {
          /* gecici ag hatasi: sonraki tick dener */
        })
    }
    const id = window.setInterval(tick, 8000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [detailId, active?.status])
  useEffect(() => {
    if (detailId != null) return // detay acikken liste gorunmez
    const tick = () => {
      if (document.visibilityState === 'visible') refreshList()
    }
    const id = window.setInterval(tick, 15000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId])

  // IZLEYICI SAYILARI (goz ikonunun yaninda): suren turnuvada, izlenebilir oda varken 8sn'de bir
  // hafif uctan cekilir. Detay poll'u (rev) izleyici degisiminde tetiklenmez -> ayri dongu.
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({})
  const hasRooms = !!active?.bracket?.some((r) => r.some((m) => m.room && !m.winner))
  useEffect(() => {
    if (detailId == null || active?.status !== 'running' || !hasRooms) {
      setViewerCounts({})
      return
    }
    let alive = true
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      tournamentViewers(detailId)
        .then((c) => {
          if (alive) setViewerCounts(c)
        })
        .catch(() => {
          /* gecici hata: sonraki tick dener */
        })
    }
    tick()
    const id = window.setInterval(tick, 8000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      alive = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [detailId, active?.status, hasRooms])

  // Detay yuklendiginde URL'i SEO-dostu slug'a yukselt (banner/eski-id ile acildiysa da).
  useEffect(() => {
    if (active) onOpenDetail?.(active.id, tournUrlSlug(active))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])



  async function join(id: number) {
    mutSeq.current++
    setBusy(true)
    try {
      setActive(await joinTournament(id))
      refreshList()
    } catch (e) {
      // Sunucu kapisi (premium_only): plan bu arada dustuyse vb. -> uyelik ekrani.
      if (e instanceof ApiError && e.status === 403) onRequirePremium?.()
      else if (e instanceof ApiError && e.status === 401) onRequireLogin?.()
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  async function leave(id: number) {
    mutSeq.current++
    setBusy(true)
    try {
      setActive(await leaveTournament(id))
      refreshList()
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  // ---- Detay/bracket gorunumu ----
  if (active) {
    const champ = active.champion_id
      ? active.players?.find((p) => p.id === active.champion_id)
      : null
    const joined = active.players?.some((p) => p.id === myId)
    // "Katil" misafire ve Premium olmayan uyeye de GORUNUR; basinca giris/uyelik ekranina yonlenir.
    const canJoin = active.status === 'open' && !joined
    const premiumLocked = !!active.premium_only && !premium
    const onJoinClick = () =>
      myId == null ? onRequireLogin?.() : premiumLocked ? onRequirePremium?.() : setConfirm('join')
    // Hero ozet: toplam odul havuzu + katilim doluluk yuzdesi
    const totalPrize = active.prizes && active.prizes.length
      ? active.prizes.reduce((s, pr) => s + (pr.coins || 0), 0)
      : (active.prize_coins || 0)
    const fillPct = active.size ? Math.min(100, Math.round((active.count / active.size) * 100)) : 0
    return (
      <div className="register-overlay modal page" role="dialog" aria-modal="true">
        <div className="register-card tourn-card" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </Button>
          <Breadcrumb items={[homeCrumb(t), { name: t('menu.tournaments'), href: '/online-turnuvalar' }, { name: active.name }]} />
          <h2><Icon name="trophy" size={20} /> {active.name}</h2>

          {/* Editoryal alt-satir: durum rozeti + duzenleyen/mekan (tek satirda toplandi) */}
          <div className="tourn-subline">
            <span className={`tr-status tr-status-${active.status}`}>
              {t(`tourn.status.${active.status}`)}
            </span>
            <AccessBadge premiumOnly={!!active.premium_only} />
            <span className="tourn-meta-inline">
              {t('tourn.organizer')}:
              <TavlaTvLogo size={26} tone="light" className="tourn-runby-logo" />
              {active.organizer && (
                <>
                  <span className="tourn-meta-sep">·</span>
                  {active.organizer.logo && (
                    <img
                      className="tourn-org-logo sm"
                      src={orgLogoSrc(active.organizer.logo) ?? undefined}
                      alt={active.organizer.name}
                    />
                  )}
                  {active.organizer.name}
                </>
              )}
              {active.venue && (
                <>
                  <span className="tourn-meta-sep">·</span>
                  <Icon name="pin" size={13} /> {active.venue}
                </>
              )}
            </span>
          </div>

          {/* Hero: turnuvanin ozeti — odul havuzu / baslangic / katilim / giris */}
          <div className="tourn-hero">
            <div className="th-stat th-prize">
              <span className="th-lbl">{t('tourn.prizePool')}</span>
              <span className="th-val">
                {totalPrize > 0 ? <Coins amount={totalPrize} gain suffix="coin" size={18} /> : '—'}
              </span>
            </div>
            <div className="th-stat">
              <span className="th-lbl">{t('tourn.startLabel')}</span>
              <span className="th-val">
                {active.status === 'open' && active.starts_at ? (
                  <Countdown
                    target={active.starts_at}
                    onExpire={() => showTournament(active.id).then(setActive).catch(() => {})}
                  />
                ) : active.status === 'running' ? (
                  t('tourn.status.running')
                ) : (
                  t('tourn.status.finished')
                )}
              </span>
              {active.status === 'open' && active.register_until && (
                <span className="th-sub">
                  {t('tourn.registerUntil')}:{' '}
                  {new Date(active.register_until).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <div className="th-stat">
              <span className="th-lbl">{t('tourn.participation')}</span>
              <span className="th-val tnum">{active.count}/{active.size > 0 ? active.size : '∞'}</span>
              <span className="th-fill"><i style={{ width: `${fillPct}%` }} /></span>
            </div>
            <div className="th-stat">
              <span className="th-lbl">{t('tourn.entry')}</span>
              <span className="th-val">
                {active.entry_fee ? <Coins amount={active.entry_fee} size={16} /> : t('tourn.free')}
              </span>
            </div>
          </div>

          {/* Mac uzunluklari: normal turlar + (farkliysa) yari final / final */}
          <div className="tourn-lengths">
            <Icon name="target" size={14} />
            <span>
              {t('tourn.lengthLabel')}: <b>{lenLabel(active.match_length || 1)}</b>
              {!!active.round_minutes && <b>{` · ${t('tourn.minutes', { n: active.round_minutes })}`}</b>}
            </span>
            {((!!active.semi_length && active.semi_length !== (active.match_length || 1)) ||
              (!!active.semi_minutes && active.semi_minutes !== active.round_minutes)) && (
              <span>
                · {t('tourn.semi')}: <b>{lenLabel(active.semi_length || active.match_length || 1)}</b>
                {!!(active.semi_minutes || active.round_minutes) && (
                  <b>{` · ${t('tourn.minutes', { n: (active.semi_minutes || active.round_minutes)! })}`}</b>
                )}
              </span>
            )}
            {((!!active.final_length && active.final_length !== (active.match_length || 1)) ||
              (!!active.final_minutes && active.final_minutes !== active.round_minutes)) && (
              <span>
                · {t('tourn.final')}: <b>{lenLabel(active.final_length || active.match_length || 1)}</b>
                {!!(active.final_minutes || active.round_minutes) && (
                  <b>{` · ${t('tourn.minutes', { n: (active.final_minutes || active.round_minutes)! })}`}</b>
                )}
              </span>
            )}
          </div>

          {/* Birincil aksiyon: Katil / Kaydi iptal (hero'nun hemen altinda, belirgin) */}
          {(canJoin || (joined && active.status === 'open')) && (
            <div className="tourn-actions tourn-actions-hero">
              {canJoin && (
                <Button variant="default" className="tourn-join-btn" disabled={busy} onClick={onJoinClick}>
                  {premiumLocked && <PremiumCrown size={16} />}
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

          {/* Odul dagilimi (siralamaya gore) */}
          {active.prizes && active.prizes.length > 0 ? (
            <div className="tourn-prizes">
              <div className="tp-head">
                <Icon name="medal" size={16} /> {t('tourn.breakdown')}
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
            </div>
          ) : (
            active.prize_desc && (
              <div className="tourn-prize">
                <Icon name="medal" size={16} /> {t('tourn.prizeLabel')}: <span>{active.prize_desc}</span>
              </div>
            )
          )}

          {/* Katilimci listesi HER durumda gorunur (acik/devam/bitti) */}
          <div className="tourn-players">
            <h3>
              <Icon name="users" size={16} /> {t('tourn.players')}{' '}
              <span className="tourn-players-count">{active.count}/{active.size > 0 ? active.size : '∞'}</span>
            </h3>
            {active.players && active.players.length > 0 ? (
              active.players.map((p) => (
                <div key={p.id} className="tourn-prow">
                  <PlayerIdentity userId={p.id} name={p.name} rating={p.rating} avatar={p.avatar} size={30} rankSize="md" premium={p.premium} />
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
              {active.bracket?.map((round, ri) => {
                const rounds = active.bracket!.length
                const isFinal = ri === rounds - 1
                return (
                  <div key={ri} className="tourn-round">
                    <div className="tourn-round-title">
                      {isFinal ? t('tourn.final') : ri === rounds - 2 ? t('tourn.semi') : t('tourn.round', { n: ri + 1 })}
                      <span className="tourn-round-len">
                        {' · '}
                        {lenLabel(tournamentRoundTarget(active, ri, rounds))}
                        {tournamentRoundMinutes(active, ri, rounds) != null &&
                          ` · ${t('tourn.minutes', { n: tournamentRoundMinutes(active, ri, rounds)! })}`}
                      </span>
                    </div>
                    <div className="tourn-round-body">
                      {round.map((m, mi) => {
                        const mine = m.p1?.id === myId || m.p2?.id === myId
                        const playable = mine && m.p1 && m.p2 && !m.winner
                        // Izlenebilir: oda acilmis (biri "Oyna"ya basmis) ve mac bitmemis. Kendi macimda
                        // "Oyna" var; goz yalniz baskalarinin maclarinda.
                        const watchable = !mine && !!onSpectate && !!m.room && !!m.p1 && !!m.p2 && !m.winner
                        const viewers = watchable ? viewerCounts[m.room!.toUpperCase()] ?? 0 : 0
                        // Skor / hukmen: yalniz biten macta (bye'da skor yok).
                        const sc = m.winner && m.p1 && m.p2 ? m.score : null
                        const scoreOf = (side: 'p1' | 'p2') => {
                          if (!sc) return null
                          if (sc.walkover) {
                            return m.winner === m[side]?.id ? <span className="tm-score wo">{t('tourn.wo')}</span> : null
                          }
                          return <span className="tm-score tnum">{sc[side] ?? 0}</span>
                        }
                        return (
                          <div key={m.key} className="tb-slot">
                            {/* Onceki turdan gelen ok (kazanan yol yesil) */}
                            {ri > 0 && <span className={`tb-in${m.p1 || m.p2 ? ' on' : ''}`} aria-hidden="true" />}
                            {/* Sonraki tura giden cizgi: cift eslesme ortasinda birlesir; final -> sampiyon */}
                            <span
                              className={`tb-out ${isFinal ? 'straight' : mi % 2 === 0 ? 'down' : 'up'}${m.winner ? ' on' : ''}`}
                              aria-hidden="true"
                            />
                            <div className={`tourn-match ${mine ? 'mine' : ''} ${watchable ? 'watchable' : ''}`}>
                              {watchable && (
                                <button
                                  type="button"
                                  className="tm-watch"
                                  title={viewers > 0 ? `${t('tourn.watch')} · ${t('live.watchCount', { n: viewers })}` : t('tourn.watch')}
                                  aria-label={viewers > 0 ? `${t('tourn.watch')} · ${t('live.watchCount', { n: viewers })}` : t('tourn.watch')}
                                  onClick={() => onSpectate!(m.room!, m.p1!.name, m.p2!.name)}
                                >
                                  <Icon name="eye" size={16} />
                                  {viewers > 0 && <span className="tm-watch-n">{viewers}</span>}
                                </button>
                              )}
                              <div className={`tm-p ${m.winner === m.p1?.id ? 'win' : ''} ${m.winner && m.winner !== m.p1?.id ? 'lose' : ''}`}>
                                {m.p2 && !m.p1 && (ri === 0 || !!m.winner) ? (
                                  <span className="tm-name tm-bye">{t('tourn.bye')}</span>
                                ) : (
                                  <span className="tm-name">{m.p1?.name ?? '—'}</span>
                                )}
                                {scoreOf('p1')}
                              </div>
                              <div className={`tm-p ${m.winner === m.p2?.id ? 'win' : ''} ${m.winner && m.winner !== m.p2?.id ? 'lose' : ''}`}>
                                {/* Rakipsiz gecis (ilk tur bye / olu daldan otomatik ilerleme): cizgi yerine yesil "Bye" */}
                                {m.p1 && !m.p2 && (ri === 0 || !!m.winner) ? (
                                  <span className="tm-name tm-bye">{t('tourn.bye')}</span>
                                ) : (
                                  <span className="tm-name">{m.p2?.name ?? '—'}</span>
                                )}
                                {scoreOf('p2')}
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
                                  {/* Elle "Kazandim/Kaybettim" KALDIRILDI: sonuc yalniz sunucudaki gercek mac
                                      sonucundan gelir (App mac bitince otomatik bildirir, sunucu dogrular). */}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {/* Sampiyon: finalin sagi, tac ile */}
              {!!active.bracket?.length && (
                <div className="tourn-round tourn-champ-col">
                  <div className="tourn-round-title">{t('tourn.champion')}</div>
                  <div className="tourn-round-body">
                    <div className="tb-slot">
                      <span className={`tb-in${champ ? ' on' : ''}`} aria-hidden="true" />
                      <div className={`tourn-champ${champ ? ' done' : ''}`}>
                        <Icon name="crown" size={18} />
                        <span className="tm-name">{champ ? champ.name : '?'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
    // size 0 = sinirsiz kapasite (bracket katilan sayisina gore kurulur) -> hic dolmaz
    const full = tr.size > 0 && tr.count >= tr.size
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
            <AccessBadge premiumOnly={!!tr.premium_only} />
            {/* Katilimcilar: UST SATIRDA, durum rozetinin yaninda (kompakt). */}
            <span className="tourn-players">
              <span className="tcard-ic navy" aria-hidden="true">
                <Icon name="users" size={16} />
              </span>
              <span className="tourn-pcount" data-full={full || undefined}>
                {tr.count}
                <small>/{tr.size > 0 ? tr.size : '∞'}</small>
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
              <TavlaTvLogo size={30} tone="light" className="event-runby-logo" />
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
        <Breadcrumb items={[homeCrumb(t), { name: t('tourn.title') }]} />
        <h2><Icon name="trophy" size={20} /> {t('tourn.title')}</h2>

        {loading ? (
          <Loading />
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

// Katilim kosulu rozeti: Premium'a ozel (tac) / Tum uyeler. Misafir hicbir turnuvaya katilamaz.
function AccessBadge({ premiumOnly }: { premiumOnly: boolean }) {
  const { t } = useT()
  return premiumOnly ? (
    <span className="tourn-access tourn-access-premium" title={t('tourn.premiumOnlyHint')}>
      <PremiumCrown size={14} /> {t('tourn.premiumOnly')}
    </span>
  ) : (
    <span className="tourn-access tourn-access-all" title={t('tourn.membersHint')}>
      <Icon name="users" size={14} /> {t('tourn.members')}
    </span>
  )
}

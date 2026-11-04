import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import Loading from './Loading'
import Breadcrumb, { homeCrumb } from './Breadcrumb'
import {
  applyToLeague,
  confirmLeagueTime,
  getLeague,
  getLeagueMe,
  getLeagueSeason,
  leagueMatchRoom,
  proposeLeagueTime,
  readyLeagueMatch,
  type LeagueMatchRow,
  type LeagueSeasonMeta,
  type LeagueSeasonSummary,
  type LeagueStandingRow,
  type LeagueUserBrief,
} from '../api'

/**
 * Türkiye Online Tavla Ligi — kullanıcı ekranları (§16). BAĞIMSIZ modül; turnuva ekranından ayrı.
 * Liste/puan tablosu/fikstür/ağaç herkese açık (misafir dahil); başvuru/randevu/hazır-olma yetkili
 * kullanıcıya. Mevcut TavlaTV tasarımına uyumlu, mobil/masaüstü duyarlı. Lig puanı ≠ rating görsel ayrı.
 */

type Tab = 'standings' | 'fixtures' | 'bracket' | 'my' | 'rules'

interface Props {
  myId: number | null
  premium: boolean
  seasonId: number | null
  onRequireLogin: () => void
  onRequirePremium: () => void
  onEnterRoom: (code: string, target: number) => void
  onProfile?: (id: number) => void
  onOpenSeason?: (id: number) => void
  onClose: () => void
}

type Detail = Awaited<ReturnType<typeof getLeagueSeason>>
type Me = Awaited<ReturnType<typeof getLeagueMe>>

const PHASES = ['prelim', 'r16', 'qf', 'sf', 'final'] as const

export default function LeagueView(props: Props) {
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<LeagueSeasonMeta | null>(null)
  const [finished, setFinished] = useState<LeagueSeasonSummary[]>([])
  const [detail, setDetail] = useState<Detail | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [tab, setTab] = useState<Tab>('standings')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [proposeAt, setProposeAt] = useState('')
  const readiedRef = useRef(false)
  const enteredRef = useRef(false)

  const seasonId = props.seasonId ?? active?.id ?? null

  const load = useCallback(async () => {
    try {
      const d = await getLeague()
      setActive(d.active)
      setFinished(d.finished)
      const id = props.seasonId ?? d.active?.id ?? null
      if (id) {
        setDetail(await getLeagueSeason(id))
        if (props.myId) {
          try {
            setMe(await getLeagueMe(id))
          } catch {
            /* katılımcı değil */
          }
        }
      }
    } catch {
      /* ağ — poll tekrar dener */
    } finally {
      setLoading(false)
    }
  }, [props.seasonId, props.myId])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const iv = setInterval(() => void load(), 15000)
    return () => clearInterval(iv)
  }, [load])

  // Otomatik başlama: iki taraf da hazır olunca sunucu oda açar -> room_code görününce maça gir.
  useEffect(() => {
    const nm = me?.next_match
    if (nm?.room_code && readiedRef.current && !enteredRef.current) {
      enteredRef.current = true
      props.onEnterRoom(nm.room_code, nm.target)
    }
  }, [me, props])

  const act = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  const doApply = () => {
    if (!props.myId) return props.onRequireLogin()
    if (!props.premium) return props.onRequirePremium()
    if (!seasonId) return
    void act(async () => {
      await applyToLeague(seasonId)
      setNotice(t('league.applyOk'))
    })
  }

  const doPropose = (matchId: number) => {
    if (!proposeAt) return
    void act(async () => {
      await proposeLeagueTime(matchId, new Date(proposeAt).toISOString())
      setProposeAt('')
    })
  }
  const doConfirm = (matchId: number) => void act(() => confirmLeagueTime(matchId).then(() => {}))
  const doReady = (matchId: number, target: number) =>
    void act(async () => {
      readiedRef.current = true
      const r = await readyLeagueMatch(matchId)
      if (r.room) {
        enteredRef.current = true
        props.onEnterRoom(r.room, target)
      }
    })
  const doPlay = (matchId: number) =>
    void act(async () => {
      const r = await leagueMatchRoom(matchId)
      enteredRef.current = true
      props.onEnterRoom(r.code, r.target)
    })

  const season = detail?.season ?? active
  const S = (k: string) => t('league.status.' + k)

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card league-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={props.onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <Breadcrumb items={[homeCrumb(t), { name: t('league.title') }]} />
        <h2><Icon name="laurel-wreath" size={20} /> {t('league.title')}</h2>
        <p className="register-sub">{t('league.subtitle')}</p>
        {loading ? <Loading /> : <>

      {/* Sezon başlığı — yalnız aktif sezon varken (sekme çubuğunun üstünde). */}
      {season && (
        <>
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong>{season.name}</strong>
            <span style={badgeStyle}>{S(season.status)}</span>
            {season.status === 'league' && (
              <span style={{ opacity: 0.7 }}>{t('league.round', { n: season.current_round })} / {season.rounds_total}</span>
            )}
            {season.champion && (
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
                🏆 {t('league.champion')}: {season.champion.nickname}
              </span>
            )}
          </div>

          {season.status === 'applications' && (
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>{t('league.subtitle')}</span>
              <Button style={{ marginLeft: 'auto' }} onClick={doApply} disabled={busy}>
                {t('league.apply')}
              </Button>
            </div>
          )}
          {me?.participation && (
            <div style={{ ...cardStyle, fontSize: 14 }}>{t('league.part.' + me.participation.status)}</div>
          )}
        </>
      )}
      {notice && <div style={{ ...cardStyle, color: '#b45309' }}>{notice}</div>}

      {/* Sekme çubuğu HER ZAMAN görünür (sezon yoksa da); giriş 'Mevcut Sezon' seçili, Kurallar sekmede. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        {(['standings', 'fixtures', 'bracket', 'my', 'rules'] as Tab[]).map((tb) => (
          <Button key={tb} variant={tab === tb ? 'default' : 'outline'} onClick={() => setTab(tb)}>
            {t('league.tab.' + tb)}
          </Button>
        ))}
      </div>

      {tab === 'standings' && (!season ? (
        <div style={cardStyle}>{t('league.noActive')}</div>
      ) : (
        <>
          {(detail?.standings?.length ?? 0) === 0 && (
            <Participants parts={detail?.participants} onProfile={props.onProfile} />
          )}
          <Standings rows={detail?.standings ?? []} onProfile={props.onProfile} />
        </>
      ))}
      {tab === 'fixtures' && <Fixtures rounds={detail?.fixtures ?? []} />}
      {tab === 'bracket' && <Bracket bracket={detail?.bracket ?? {}} />}
      {tab === 'my' && (
        <MyMatch
          me={me}
          myId={props.myId}
          busy={busy}
          proposeAt={proposeAt}
          setProposeAt={setProposeAt}
          onPropose={doPropose}
          onConfirm={doConfirm}
          onReady={doReady}
          onPlay={doPlay}
        />
      )}
      {tab === 'rules' && <Rules prizes={season?.prizes ?? []} />}

      {finished.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>{t('league.finishedSeasons')}</h3>
          {finished.map((f) => (
            <button key={f.id} style={{ ...cardStyle, width: '100%', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => props.onOpenSeason?.(f.id)}>
              {f.name} — {f.champion ? '🏆 ' + f.champion.nickname : S(f.status)}
            </button>
          ))}
        </div>
      )}
        </>}
      </div>
    </div>
  )
}

function Participants({ parts, onProfile }: { parts?: { accepted: LeagueUserBrief[]; reserve: LeagueUserBrief[] }; onProfile?: (id: number) => void }) {
  const { t } = useT()
  if (!parts || (parts.accepted.length === 0 && parts.reserve.length === 0)) return null
  const chip = (u: LeagueUserBrief) => (
    <span key={u.id} onClick={() => onProfile?.(u.id)}
      style={{ ...badgeStyle, background: 'color-mix(in srgb, var(--text) 7%, transparent)', color: 'var(--text)', cursor: onProfile ? 'pointer' : 'default' }}>
      {u.nickname} · {u.rating}
    </span>
  )
  return (
    <div style={{ marginBottom: 10 }}>
      {parts.accepted.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('league.selectedPlayers')} ({parts.accepted.length})</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{parts.accepted.map(chip)}</div>
        </div>
      )}
      {parts.reserve.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('league.reserves')} ({parts.reserve.length})</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{parts.reserve.map(chip)}</div>
        </div>
      )}
    </div>
  )
}

function Standings({ rows, onProfile }: { rows: LeagueStandingRow[]; onProfile?: (id: number) => void }) {
  const { t } = useT()
  if (!rows.length) return <div style={cardStyle}>—</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {['rank', 'player', 'points', 'wins', 'losses', 'byes', 'buchholz', 'rating'].map((c) => (
              <th key={c} style={thStyle}>{t('league.col.' + c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user.id} style={{ opacity: r.status === 'withdrawn' ? 0.5 : 1 }}>
              <td style={tdStyle}>{r.rank ?? '-'}</td>
              <td style={{ ...tdStyle, cursor: onProfile ? 'pointer' : 'default' }} onClick={() => onProfile?.(r.user.id)}>
                {r.user.nickname}{r.status === 'withdrawn' ? ' ⊘' : ''}
              </td>
              {/* Lig puanı VURGULU (rating'ten görsel ayrı) */}
              <td style={{ ...tdStyle, fontWeight: 700 }}>{r.points}</td>
              <td style={tdStyle}>{r.wins}</td>
              <td style={tdStyle}>{r.losses}</td>
              <td style={tdStyle}>{r.byes}</td>
              <td style={tdStyle}>{r.opp_points}</td>
              <td style={{ ...tdStyle, opacity: 0.6 }}>{r.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Fixtures({ rounds }: { rounds: Array<{ round: number; matches: LeagueMatchRow[] }> }) {
  const { t } = useT()
  if (!rounds.length) return <div style={cardStyle}>—</div>
  return (
    <>
      {rounds.map((r) => (
        <div key={r.round} style={{ marginBottom: 14 }}>
          <h4 style={{ margin: '6px 0' }}>{t('league.round', { n: r.round })}</h4>
          {r.matches.map((m) => <MatchLine key={m.id} m={m} />)}
        </div>
      ))}
    </>
  )
}

function Bracket({ bracket }: { bracket: Record<string, LeagueMatchRow[]> }) {
  const { t } = useT()
  const phases = PHASES.filter((p) => (bracket[p] ?? []).length)
  if (!phases.length) return <div style={cardStyle}>—</div>
  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
      {phases.map((p) => (
        <div key={p} style={{ minWidth: 220 }}>
          <h4 style={{ margin: '6px 0' }}>{t('league.phase.' + p)}</h4>
          {(bracket[p] ?? []).map((m) => <MatchLine key={m.id} m={m} />)}
        </div>
      ))}
    </div>
  )
}

function MatchLine({ m }: { m: LeagueMatchRow }) {
  const { t } = useT()
  const name = (u: LeagueMatchRow['p1']) => u?.nickname ?? t('league.tbd')
  const win = (u: LeagueMatchRow['p1']) => !!u && m.winner_user_id === u.id
  return (
    <div style={{ ...cardStyle, padding: 8, marginBottom: 6, fontSize: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: win(m.p1) ? 700 : 400 }}>{name(m.p1)}</span>
        <span style={{ opacity: 0.5 }}>{t('league.vs')}</span>
        <span style={{ fontWeight: win(m.p2) ? 700 : 400 }}>{m.bye ? t('league.result.bye') : name(m.p2)}</span>
      </div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
        {t('league.result.' + m.result)}
        {m.start_at && m.result === 'pending' ? ' · ' + new Date(m.start_at).toLocaleString() : ''}
      </div>
    </div>
  )
}

function MyMatch(p: {
  me: Me | null
  myId: number | null
  busy: boolean
  proposeAt: string
  setProposeAt: (v: string) => void
  onPropose: (id: number) => void
  onConfirm: (id: number) => void
  onReady: (id: number, target: number) => void
  onPlay: (id: number) => void
}) {
  const { t } = useT()
  if (!p.myId) return <div style={cardStyle}>{t('league.loginRequired')}</div>
  const nm = p.me?.next_match
  if (!nm) return <div style={cardStyle}>—</div>
  const opp = nm.am_p1 ? nm.p2 : nm.p1
  const appt = nm.appointment
  const pendingProp = appt?.proposal ?? null
  const iProposed = pendingProp && p.myId === pendingProp.by
  return (
    <div style={cardStyle}>
      <h4 style={{ marginTop: 0 }}>{t('league.nextMatch')}</h4>
      <div style={{ marginBottom: 8 }}>
        {t('league.phase.' + (nm.phase === 'league' ? 'prelim' : nm.phase)) /* etiket */} ·{' '}
        <strong>{opp?.nickname ?? t('league.tbd')}</strong>
        {nm.start_at && <div style={{ fontSize: 13, opacity: 0.7 }}>{t('league.mandatoryAt')}: {new Date(nm.start_at).toLocaleString()}</div>}
      </div>

      {/* Randevu (§8) */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>{t('league.appointment')}</div>
        {pendingProp && (
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            {t('league.pendingProposal', { at: new Date(pendingProp.at).toLocaleString() })}
            {!iProposed && (
              <Button style={{ marginLeft: 8 }} disabled={p.busy} onClick={() => p.onConfirm(nm.id)}>
                {t('league.confirmTime')}
              </Button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="datetime-local" value={p.proposeAt} onChange={(e) => p.setProposeAt(e.target.value)}
            style={{ padding: 4, border: '1px solid #d1d5db', borderRadius: 6 }} />
          <Button variant="outline" disabled={p.busy || !p.proposeAt} onClick={() => p.onPropose(nm.id)}>
            {t('league.proposeTime')}
          </Button>
        </div>
      </div>

      {/* Hazır olma + maça giriş (§9) */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button disabled={p.busy} onClick={() => p.onReady(nm.id, nm.target)}>{t('league.ready')}</Button>
        {nm.room_code && (
          <Button variant="secondary" disabled={p.busy} onClick={() => p.onPlay(nm.id)}>{t('league.playNow')}</Button>
        )}
        <span style={{ fontSize: 12, opacity: 0.6 }}>{t('league.readyHint')}</span>
      </div>
    </div>
  )
}

function Rules({ prizes }: { prizes: Array<{ key: string; coins?: number; badge?: string; desc?: string }> }) {
  const { t } = useT()
  const lines = t('league.rulesText').split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div style={cardStyle}>
      {lines.map((ln, i) =>
        ln.startsWith('## ') ? (
          <h4 key={i} style={{ margin: i === 0 ? '0 0 4px' : '14px 0 4px' }}>{ln.slice(3)}</h4>
        ) : (
          <p key={i} style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{ln}</p>
        ),
      )}
      {prizes.length > 0 && (
        <>
          <h4>{t('league.prizes')}</h4>
          <ul>
            {prizes.map((pr, i) => (
              <li key={i}>
                {t('league.prize.' + pr.key)}: {pr.coins ? pr.coins + ' 🪙' : ''} {pr.desc ?? ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const cardStyle: CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 2, padding: '12px 14px', marginBottom: 8 }
const badgeStyle: CSSProperties = { display: 'inline-block', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }
const tdStyle: CSSProperties = { padding: '9px 10px', borderBottom: '1px solid var(--border)' }

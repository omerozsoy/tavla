import { useCallback, useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import Loading from './Loading'
import Breadcrumb, { homeCrumb } from './Breadcrumb'
import {
  acceptTeamInvite,
  acceptTeamMatch,
  acceptTeamTransfer,
  applyTeam,
  cancelTeamApplication,
  cancelTeamMatch,
  challengeTeam,
  closeTeam,
  createTeam,
  decideTeamApplication,
  declineTeamInvite,
  demoteTeamMember,
  getMyTeam,
  getMyTeamMatch,
  getTeam,
  getTeams,
  inviteToTeam,
  kickTeamMember,
  leaveTeam,
  promoteTeamMember,
  readyTeamMatch,
  renameTeam,
  setTeamLineup,
  transferTeam,
  updateTeamIdentity,
  type TeamBrief,
  type TeamDetail,
  type TeamMe,
  type TeamMyMatch,
  type TeamRankRow,
} from '../api'
import { ApiError } from '../api'

/**
 * Takımlar Ligi — kullanıcı ekranları (§1-§12). Turnuva/bireysel ligden BAĞIMSIZ modül. Sıralama/arama/
 * aylık/karşılaşma herkese açık; kurma/katılım/yönetim yetkili kullanıcıya (sunucu-otoriter). Gizli kadro
 * kilide kadar rakibe gösterilmez (backend gate + bu ekran yalnız kendi kadrosunu düzenletir).
 */
type Tab = 'overview' | 'myteam' | 'rules'
type View = { kind: 'home' } | { kind: 'team'; id: number } | { kind: 'match'; id: number }

interface Props {
  myId: number | null
  premium: boolean
  initialPath: string | null
  onRequireLogin: () => void
  onRequirePremium: () => void
  onEnterRoom: (code: string, target: number) => void
  onProfile?: (id: number) => void
  onPathChange?: (p: string | null) => void
  onClose: () => void
}

function parsePath(p: string | null): View {
  if (!p) return { kind: 'home' }
  const seg = p.split('/')
  const id = parseInt(seg[1] ?? '', 10)
  if (seg[0] === 'takim' && id) return { kind: 'team', id }
  if (seg[0] === 'mac' && id) return { kind: 'match', id }
  return { kind: 'home' }
}

export default function TeamsView(props: Props) {
  const { t } = useT()
  const [view, setView] = useState<View>(() => parsePath(props.initialPath))
  const [tab, setTab] = useState<Tab>('overview')
  const [notice, setNotice] = useState<string | null>(null)
  const [hasTeam, setHasTeam] = useState(false)

  // "Takımım" sekmesi yalnız takımı olan kullanıcıya görünür.
  useEffect(() => {
    if (!props.myId) { setHasTeam(false); return }
    getMyTeam().then((m) => setHasTeam(!!m.membership)).catch(() => {})
  }, [props.myId])
  useEffect(() => { if (tab === 'myteam' && !hasTeam) setTab('overview') }, [tab, hasTeam])

  const go = useCallback((v: View) => {
    setView(v)
    props.onPathChange?.(v.kind === 'team' ? 'takim/' + v.id : v.kind === 'match' ? 'mac/' + v.id : null)
  }, [props])

  // Hata kodunu okunur mesaja çevir (backend TeamException.error).
  const errText = useCallback((e: unknown): string => {
    let code = 'generic'
    if (e instanceof ApiError) {
      const er = e.errors as Record<string, unknown> | undefined
      code = typeof er?.error === 'string' ? er.error : (e.message || 'generic')
    }
    const key = 'teams.err.' + code
    return t(key) !== key ? t(key) : t('teams.err.generic')
  }, [t])

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card teams-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={props.onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <Breadcrumb items={[homeCrumb(t), { name: t('teams.title') }]} />
        <h2><Icon name="users-group" size={20} /> {t('teams.title')}</h2>

      {notice && (
        <div className="teams-notice" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: 2, marginBottom: 10, cursor: 'pointer' }}
          onClick={() => setNotice(null)}>{notice}</div>
      )}

      {view.kind === 'home' && (
        <>
          <nav className="teams-tabs" role="tablist">
            {(['overview', ...(hasTeam ? (['myteam'] as Tab[]) : []), 'rules'] as Tab[]).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} className={'teams-tab' + (tab === k ? ' is-active' : '')} onClick={() => setTab(k)}>
                {t('teams.tab.' + k)}
              </button>
            ))}
          </nav>
          {tab === 'overview' && <Overview {...props} go={go} setNotice={setNotice} errText={errText} />}
          {tab === 'myteam' && hasTeam && <MyTeam {...props} go={go} setNotice={setNotice} errText={errText} />}
          {tab === 'rules' && <Rules />}
        </>
      )}

      {view.kind === 'team' && <TeamDetailView id={view.id} myId={props.myId} back={() => go({ kind: 'home' })} onProfile={props.onProfile} setNotice={setNotice} errText={errText} />}
      {view.kind === 'match' && (
        <MatchView id={view.id} myId={props.myId} back={() => go({ kind: 'home' })}
          onEnterRoom={props.onEnterRoom} setNotice={setNotice} errText={errText} />
      )}
      </div>
    </div>
  )
}

// ---- Genel bakış: sıralama + arama + takımım özeti/kurma -----------------------
function Overview(props: Props & { go: (v: View) => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [ranking, setRanking] = useState<TeamRankRow[]>([])
  const [me, setMe] = useState<TeamMe | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<TeamBrief[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTeams().then((r) => setRanking(r.ranking ?? [])).catch(() => {}).finally(() => setLoading(false))
    if (props.myId) getMyTeam().then(setMe).catch(() => {})
  }, [props.myId])

  const search = async () => {
    if (!q.trim()) { setResults(null); return }
    try { setResults((await getTeams(q)).results ?? []) } catch { setResults([]) }
  }

  if (loading) return <Loading />
  return (
    <div>
      {props.myId && me && !me.membership && (
        <CreateTeam eligibility={me.eligibility} onRequirePremium={props.onRequirePremium}
          setNotice={props.setNotice} errText={props.errText} />
      )}
      {me?.membership && (
        <div style={{ marginBottom: 14 }}>
          <TeamChip team={me.membership.team} /> — {t('teams.my.role.' + me.membership.role)}
          <Button style={{ marginLeft: 8 }} onClick={() => props.go({ kind: 'home' })}>{t('teams.tab.myteam')}</Button>
        </div>
      )}
      <div className="teams-create-head" style={{ marginBottom: 10 }}>
        <h3>{t('teams.rankTitle')}</h3>
        <p>{t('teams.rankLead')}</p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('teams.search')}
          style={{ ...inp, flex: 1 }} />
        <Button onClick={search}>{t('teams.search')}</Button>
      </div>
      {results !== null ? (
        <TeamList teams={results} onOpen={(id) => props.go({ kind: 'team', id })} />
      ) : ranking.length === 0 ? (
        // Hiç takım yok: açıklama + kur düğmesi. Girişli uygun kullanıcıya üstteki CreateTeam
        // kutusu zaten düğmeyi verir; misafire burada giriş-kapılı "Takım Kur" düğmesi gösterilir.
        <div className="lb-empty">
          <div style={{ marginBottom: 12 }}>{t('teams.noneYet')}</div>
          {!props.myId && <Button onClick={props.onRequireLogin}>{t('teams.create')}</Button>}
        </div>
      ) : (
        <table className="teams-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th>#</th><th>{t('teams.team')}</th><th>{t('teams.avg')}</th><th>{t('teams.members')}</th>
          </tr></thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => props.go({ kind: 'team', id: r.id })}>
                <td>{r.rank}</td><td><TeamChip team={r} /></td><td>{r.rating_avg.toFixed(1)}</td><td>{r.member_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CreateTeam(props: { eligibility: TeamMe['eligibility']; onRequirePremium: () => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [color1, setColor1] = useState('#A83A2B')
  const [color2, setColor2] = useState('#1f2933')
  const [logo, setLogo] = useState('') // base64 data-URI (yüklenirse)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const el = props.eligibility

  if (!el.can_create) {
    return (
      <div className="teams-gate">
        <div className="teams-gate-icon"><Icon name="users-group" size={22} /></div>
        <div>
          <div className="teams-gate-title">{t('teams.createTitle')}</div>
          <div className="teams-gate-text">{t('teams.create.requirements', { cost: el.found_cost.toLocaleString(), rated: el.min_rated })}</div>
          {!el.premium && <Button style={{ marginTop: 8 }} onClick={props.onRequirePremium}>{t('teams.needPremium')}</Button>}
        </div>
      </div>
    )
  }
  if (!open) {
    return (
      <button className="teams-create-cta" onClick={() => setOpen(true)}>
        <span className="teams-create-cta-emblem" style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}>
          <Icon name="users-group" size={18} />
        </span>
        <span className="teams-create-cta-text">
          <strong>{t('teams.create')}</strong>
          <small>{t('teams.createLead')}</small>
        </span>
        <span className="teams-create-cta-cost">{el.found_cost.toLocaleString()} 🪙</span>
      </button>
    )
  }

  const onLogoFile = (file?: File) => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => setLogo(typeof r.result === 'string' ? r.result : '')
    r.readAsDataURL(file)
  }
  const submit = async () => {
    setBusy(true)
    try {
      await createTeam({ name, tag, color1, color2, description: desc || undefined, logo_upload: logo || undefined })
      props.setNotice(logo ? t('teams.created') + ' ' + t('teams.logoPending') : t('teams.created'))
      setTimeout(() => location.reload(), 700)
    } catch (e) { props.setNotice(props.errText(e)) } finally { setBusy(false) }
  }

  return (
    <div className="teams-create">
      <header className="teams-create-head">
        <h3>{t('teams.createTitle')}</h3>
        <p>{t('teams.createLead')}</p>
      </header>

      {/* Canlı amblem önizleme (renk + etiket + yüklenen logo) */}
      <div className="teams-create-preview">
        <div className="teams-emblem teams-emblem-lg" style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}>
          {logo ? <img src={logo} alt="" /> : <span>{(tag || '?').slice(0, 5).toUpperCase()}</span>}
        </div>
        <div className="teams-create-preview-name">
          <strong>{name || t('teams.name')}</strong>
          <span className="teams-tagchip" style={{ background: color1 }}>{tag ? tag.toUpperCase() : t('teams.tag')}</span>
        </div>
      </div>

      <label className="teams-field">
        <span>{t('teams.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} style={inp} placeholder="Örn. İstanbul Pulları" />
        <small>{t('teams.nameUnique')}</small>
      </label>
      <label className="teams-field">
        <span>{t('teams.tag')}</span>
        <input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={5} style={inp} placeholder="IST" />
        <small>{t('teams.tagHint')}</small>
      </label>

      <div className="teams-field">
        <span>{t('teams.colors')}</span>
        <div className="teams-colors">
          <label className="teams-color"><input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} /><small>{t('teams.colorPrimary')}</small></label>
          <label className="teams-color"><input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} /><small>{t('teams.colorSecondary')}</small></label>
        </div>
      </div>

      <div className="teams-field">
        <span>{t('teams.logo')}</span>
        <label className="teams-logo-upload">
          <input type="file" accept="image/*" onChange={(e) => onLogoFile(e.target.files?.[0])} hidden />
          <Icon name="users-group" size={16} /> {t('teams.logoUpload')}
        </label>
        <small>{t('teams.logoHint')}</small>
      </div>

      <label className="teams-field">
        <span>{t('teams.desc')}</span>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} style={{ ...inp, minHeight: 64 }} />
      </label>

      <div className="teams-create-actions">
        <Button disabled={busy || name.trim().length < 3 || tag.trim().length < 2} onClick={submit}>
          {t('teams.create')} · {el.found_cost.toLocaleString()} 🪙
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{t('teams.cancel')}</Button>
      </div>
    </div>
  )
}

// ---- Takımım (yönetim) --------------------------------------------------------
function MyTeam(props: Props & { go: (v: View) => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [me, setMe] = useState<TeamMe | null>(null)
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!props.myId) return
    const m = await getMyTeam().catch(() => null)
    setMe(m)
    if (m?.membership) setDetail(await getTeam(m.membership.team.id).catch(() => null))
  }, [props.myId])
  useEffect(() => { reload() }, [reload])

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setBusy(true)
    try { await fn(); if (msg) props.setNotice(msg); await reload() }
    catch (e) { props.setNotice(props.errText(e)) } finally { setBusy(false) }
  }

  if (!props.myId) return <div style={{ opacity: 0.7 }}><Button onClick={props.onRequireLogin}>{t('teams.needLogin')}</Button></div>
  if (!me) return <Loading />
  // Bekleyen davetler (takımsız kullanıcı da görür)
  if (!me.membership) {
    return (
      <div>
        <p style={{ opacity: 0.7 }}>{t('teams.my.none')}</p>
        {me.invites.length > 0 && <h3>{t('teams.invites')}</h3>}
        {me.invites.map((iv) => (
          <div key={iv.id} style={row}>
            {iv.team && <TeamChip team={iv.team} />}
            <span style={{ flex: 1 }} />
            <Button disabled={busy} onClick={() => act(() => acceptTeamInvite(iv.id), t('teams.joined'))}>{t('teams.accept')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => act(() => declineTeamInvite(iv.id))}>{t('teams.decline')}</Button>
          </div>
        ))}
        {me.applications.length > 0 && <h3>{t('teams.applications')}</h3>}
        {me.applications.map((a) => (
          <div key={a.id} style={row}>
            {a.team && <TeamChip team={a.team} />}<span style={{ flex: 1 }} />
            <Button variant="ghost" disabled={busy} onClick={() => act(() => cancelTeamApplication(a.id))}>{t('teams.cancel')}</Button>
          </div>
        ))}
      </div>
    )
  }

  const team = me.membership.team
  const myRole = me.membership.role
  const isFounder = myRole === 'founder'
  const isManager = isFounder || myRole === 'assistant'

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={row}>
        <TeamChip team={team} big /><span style={{ flex: 1 }} />
        <Button variant="ghost" onClick={() => props.go({ kind: 'team', id: team.id })}>{t('teams.view')}</Button>
        {!isFounder && <Button variant="ghost" disabled={busy} onClick={() => act(() => leaveTeam(team.id), t('teams.left'))}>{t('teams.leave')}</Button>}
      </div>

      {/* Bana yapılmış kuruculuk devri teklifi → kabul (§5) */}
      {me.transfer_offer === team.id && (
        <AcceptTransferMaybe teamId={team.id} setNotice={props.setNotice} errText={props.errText} reload={reload} />
      )}

      {/* Üyeler + rol aksiyonları */}
      <section>
        <h3>{t('teams.members')} ({detail?.members.length ?? 0})</h3>
        {detail?.members.map((m) => (
          <div key={m.user.id} style={row}>
            <button className="linklike" onClick={() => props.onProfile?.(m.user.id)} style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}>
              {m.user.nickname} {m.user.tag ? <span style={tagStyle}>{m.user.tag}</span> : null}
            </button>
            <span style={{ opacity: 0.6, marginLeft: 6 }}>{t('teams.my.role.' + m.role)}</span>
            <span style={{ flex: 1 }} />
            {isFounder && m.role === 'member' && <Button disabled={busy} onClick={() => act(() => promoteTeamMember(team.id, m.user.id))}>{t('teams.promote')}</Button>}
            {isFounder && m.role === 'assistant' && <Button disabled={busy} onClick={() => act(() => demoteTeamMember(team.id, m.user.id))}>{t('teams.demote')}</Button>}
            {isFounder && m.role !== 'founder' && <Button disabled={busy} onClick={() => act(() => transferTeam(team.id, m.user.id), t('teams.transferSent'))}>{t('teams.transfer')}</Button>}
            {isManager && m.role === 'member' && m.user.id !== props.myId &&
              <Button variant="ghost" disabled={busy} onClick={() => act(() => kickTeamMember(team.id, m.user.id))}>{t('teams.kick')}</Button>}
          </div>
        ))}
      </section>

      {/* Başvurular (yönetici) — gelen bekleyen başvurular (§4) */}
      {isManager && me.managed && me.managed.applications.length > 0 && (
        <section>
          <h3>{t('teams.applications')} ({me.managed.applications.length})</h3>
          {me.managed.applications.map((a) => (
            <div key={a.id} style={row}>
              <span>{a.user.nickname} {a.user.tag ? <span style={tagStyle}>{a.user.tag}</span> : null}</span>
              <span style={{ flex: 1 }} />
              <Button disabled={busy} onClick={() => act(() => decideTeamApplication(a.id, true), t('teams.joined'))}>{t('teams.accept')}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => act(() => decideTeamApplication(a.id, false))}>{t('teams.decline')}</Button>
            </div>
          ))}
        </section>
      )}

      {/* Davet (yönetici) */}
      {isManager && <InviteBox teamId={team.id} act={act} busy={busy} />}

      {/* Kimlik + ayarlar (kurucu) */}
      {isFounder && <IdentityBox detail={detail} act={act} busy={busy} />}

      {/* Karşılaşmalar + meydan okuma */}
      <section>
        <h3>{t('teams.matches')}</h3>
        {detail?.matches.map((mt) => (
          <div key={mt.id} style={row}>
            <span>{mt.home?.tag} {mt.home_score}–{mt.away_score} {mt.away?.tag}</span>
            <span style={{ opacity: 0.6, marginLeft: 8 }}>{mt.status}</span>
            <span style={{ flex: 1 }} />
            <Button variant="ghost" onClick={() => props.go({ kind: 'match', id: mt.id })}>{t('teams.view')}</Button>
          </div>
        ))}
        {isManager && <ChallengeBox teamId={team.id} act={act} busy={busy} />}
      </section>

      {/* Sohbet */}
      <TeamChat teamId={team.id} canManage={isManager} />

      {/* Kapat (kurucu) */}
      {isFounder && (
        <Button variant="ghost" disabled={busy}
          onClick={() => { if (confirm(t('teams.closeConfirm'))) act(() => closeTeam(team.id, true), t('teams.closed')) }}>
          {t('teams.close')}
        </Button>
      )}
    </div>
  )
}

function AcceptTransferMaybe(props: { teamId: number; setNotice: (s: string) => void; errText: (e: unknown) => string; reload: () => void }) {
  // Devir teklifi bildirimi ayrı akar; burada güvenli bir "Kuruculuğu Kabul Et" düğmesi sunulur.
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  return (
    <details style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: 8, borderRadius: 8 }}>
      <summary style={{ cursor: 'pointer' }}>{t('teams.transferAccept')}</summary>
      <Button disabled={busy} style={{ marginTop: 6 }} onClick={async () => {
        setBusy(true)
        try { await acceptTeamTransfer(props.teamId); props.setNotice(t('teams.transferAccepted')); props.reload() }
        catch (e) { props.setNotice(props.errText(e)) } finally { setBusy(false) }
      }}>{t('teams.transferAccept')}</Button>
    </details>
  )
}

function InviteBox(props: { teamId: number; act: (fn: () => Promise<unknown>, msg?: string) => void; busy: boolean }) {
  const { t } = useT()
  const [uid, setUid] = useState('')
  return (
    <section>
      <h3>{t('teams.invite')}</h3>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder={t('teams.userId')} style={inp} />
        <Button disabled={props.busy || !uid} onClick={() => props.act(() => inviteToTeam(props.teamId, parseInt(uid, 10)), t('teams.invited'))}>{t('teams.invite')}</Button>
      </div>
    </section>
  )
}

function IdentityBox(props: { detail: TeamDetail | null; act: (fn: () => Promise<unknown>, msg?: string) => void; busy: boolean }) {
  const { t } = useT()
  const [desc, setDesc] = useState(props.detail?.team.description ?? '')
  const [open, setOpen] = useState(props.detail?.team.applications_open ?? true)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const id = props.detail?.team.id
  if (!id) return null
  return (
    <section>
      <h3>{t('teams.identity')}</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('teams.desc')} maxLength={500} style={{ ...inp, minHeight: 60 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> {t('teams.applicationsOpen')}
        </label>
        <Button disabled={props.busy} onClick={() => props.act(() => updateTeamIdentity(id, { description: desc, applications_open: open }), t('teams.saved'))}>{t('teams.save')}</Button>
        <hr style={{ opacity: 0.2 }} />
        <div style={{ fontSize: 13, opacity: 0.7 }}>{t('teams.rename.hint')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('teams.name')} maxLength={30} style={inp} />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t('teams.tag')} maxLength={5} style={inp} />
          <Button disabled={props.busy || (!name && !tag)} onClick={() => props.act(() => renameTeam(id, name || null, tag || null), t('teams.renamed'))}>{t('teams.rename')}</Button>
        </div>
      </div>
    </section>
  )
}

function ChallengeBox(props: { teamId: number; act: (fn: () => Promise<unknown>, msg?: string) => void; busy: boolean }) {
  const { t } = useT()
  const [opp, setOpp] = useState('')
  const [at, setAt] = useState('')
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{t('teams.challenge.hint')}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input value={opp} onChange={(e) => setOpp(e.target.value)} placeholder={t('teams.opponentId')} style={inp} />
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} style={inp} />
        <Button disabled={props.busy || !opp || !at}
          onClick={() => props.act(() => challengeTeam(props.teamId, parseInt(opp, 10), new Date(at).toISOString()), t('teams.challengeSent'))}>
          {t('teams.challenge')}
        </Button>
      </div>
    </div>
  )
}

function TeamChat(props: { teamId: number; canManage: boolean }) {
  const { t } = useT()
  const [msgs, setMsgs] = useState<Array<{ id: number; body: string; pinned: boolean; user: { nickname?: string } | null; at: string | null }>>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { import('../api').then((a) => a.getTeamChat(props.teamId).then((r) => setMsgs(r.messages)).catch(() => {})) }, [props.teamId])
  useEffect(() => { load() }, [load])
  return (
    <section>
      <h3>{t('teams.chat')}</h3>
      <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
        {msgs.map((m) => (
          <div key={m.id} style={{ marginBottom: 4 }}>
            {m.pinned && <Icon name="pin" />} <b>{m.user?.nickname ?? '—'}:</b> {m.body}
          </div>
        ))}
        {msgs.length === 0 && <div style={{ opacity: 0.5 }}>{t('teams.chat.empty')}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('teams.chat')} maxLength={1000} style={inp} />
        <Button disabled={busy || !body} onClick={async () => {
          setBusy(true)
          try { const a = await import('../api'); await a.postTeamChat(props.teamId, body); setBody(''); load() } finally { setBusy(false) }
        }}>{t('teams.chat.send')}</Button>
      </div>
    </section>
  )
}

function Rules() {
  const { t } = useT()
  // teams.rules.body: bloklar \n\n ile ayrılır; blok ilk satır = başlık, '•' satırları = madde.
  const blocks = t('teams.rules.body').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className="teams-rules">
      <p className="teams-rules-lead">{t('teams.rulesLead')}</p>
      <div className="teams-rules-grid">
        {blocks.map((block, i) => {
          const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
          const heading = lines[0]
          const items = lines.slice(1).map((l) => l.replace(/^•\s*/, ''))
          return (
            <section key={i} className="teams-rule-card">
              <header className="teams-rule-head">
                <span className="teams-rule-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{heading}</h3>
              </header>
              <ul className="teams-rule-list">
                {items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

// ---- Takım detay (herkese açık) ----------------------------------------------
function TeamDetailView(props: { id: number; myId: number | null; back: () => void; onProfile?: (id: number) => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [d, setD] = useState<TeamDetail | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { getTeam(props.id).then(setD).catch(() => {}) }, [props.id])
  if (!d) return <Loading />
  const apply = async () => {
    setBusy(true)
    try { await applyTeam(props.id); props.setNotice(t('teams.invited')) } catch (e) { props.setNotice(props.errText(e)) } finally { setBusy(false) }
  }
  return (
    <div>
      <Button variant="ghost" onClick={props.back}>← {t('common.back')}</Button>
      <div style={{ margin: '10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <TeamChip team={d.team} big /> {d.team.is_champion && '🏆'}
        <span style={{ flex: 1 }} />
        {props.myId && d.team.applications_open && (
          <Button disabled={busy} onClick={apply}>{t('teams.apply')}</Button>
        )}
      </div>
      {d.team.description && <p style={{ opacity: 0.85 }}>{d.team.description}</p>}
      <h3>{t('teams.members')} ({d.members.length})</h3>
      {d.members.map((m) => (
        <div key={m.user.id} style={row}>
          <button className="linklike" onClick={() => props.onProfile?.(m.user.id)} style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}>
            {m.user.nickname}
          </button>
          <span style={{ opacity: 0.6, marginLeft: 6 }}>{t('teams.my.role.' + m.role)}</span>
        </div>
      ))}
      {d.team.awards.length > 0 && (
        <>
          <h3>{t('teams.awards')}</h3>
          {d.team.awards.map((a, i) => <div key={i}>{a.month_key} — {a.kind} #{a.rank}</div>)}
        </>
      )}
    </div>
  )
}

// ---- Karşılaşma detay --------------------------------------------------------
function MatchView(props: { id: number; myId: number | null; back: () => void; onEnterRoom: (c: string, t: number) => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [m, setM] = useState<TeamMyMatch | null>(null)
  const [busy, setBusy] = useState(false)
  const [lineup, setLineup] = useState('')

  const load = useCallback(() => {
    const fn = props.myId ? getMyTeamMatch(props.id).then((r) => r.match) : (async () => (await (await import('../api')).getTeamMatch(props.id)).match as TeamMyMatch)()
    fn.then(setM).catch(() => {})
  }, [props.id, props.myId])
  useEffect(() => { load(); const h = setInterval(load, 5000); return () => clearInterval(h) }, [load])

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setBusy(true)
    try { await fn(); if (msg) props.setNotice(msg); load() }
    catch (e) { props.setNotice(props.errText(e)) } finally { setBusy(false) }
  }
  if (!m) return <Loading />

  return (
    <div>
      <Button variant="ghost" onClick={props.back}>← {t('common.back')}</Button>
      <h2 style={{ margin: '10px 0' }}>{m.home?.tag} {m.home_score}–{m.away_score} {m.away?.tag}</h2>
      <div style={{ opacity: 0.6 }}>{m.status} · {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : '—'}</div>

      {/* Proposed → kabul/iptal */}
      {m.status === 'proposed' && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
          <Button disabled={busy} onClick={() => act(() => acceptTeamMatch(m.id), t('teams.match.accepted'))}>{t('teams.match.accept')}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => act(() => cancelTeamMatch(m.id))}>{t('teams.match.cancel')}</Button>
        </div>
      )}

      {/* Scheduled + kilit öncesi: KENDİ kadronu gir (gizli) */}
      {m.status === 'scheduled' && !m.lineup_revealed && m.my_team_id && (
        <div style={{ marginTop: 12 }}>
          <h3>{t('teams.match.lineup')}</h3>
          {m.my_lineup && m.my_lineup.length > 0 ? (
            <div>{m.my_lineup.map((l) => <span key={l.slot} style={tagStyle}>{l.slot}. {l.user.nickname}</span>)}</div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.7 }}>{t('teams.match.lineupHint')}</div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input value={lineup} onChange={(e) => setLineup(e.target.value)} placeholder="id,id,id,id,id" style={inp} />
            <Button disabled={busy} onClick={() => act(() => setTeamLineup(m.id, m.my_team_id!, lineup.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean)), t('teams.saved'))}>{t('teams.save')}</Button>
          </div>
          <Button variant="ghost" style={{ marginTop: 6 }} disabled={busy} onClick={() => act(() => cancelTeamMatch(m.id))}>{t('teams.match.cancel')}</Button>
        </div>
      )}

      {/* Kilit sonrası: eşleşmeler + Hazırım */}
      {m.lineup_revealed && (
        <div style={{ marginTop: 12 }}>
          <h3>{t('teams.match.games')}</h3>
          {m.games?.map((g) => (
            <div key={g.slot} style={row}>
              <span>{g.slot}. {g.home_user?.nickname ?? '—'} vs {g.away_user?.nickname ?? '—'}</span>
              <span style={{ opacity: 0.6, marginLeft: 8 }}>{g.result ?? g.status}</span>
              <span style={{ flex: 1 }} />
              {g.room_code && <Button variant="ghost" onClick={() => props.onEnterRoom(g.room_code!, 5)}>{t('teams.match.watch')}</Button>}
            </div>
          ))}
          {m.my_game && m.my_game.status !== 'finished' && (
            <Button style={{ marginTop: 8 }} disabled={busy} onClick={() => act(async () => {
              const r = await readyTeamMatch(m.id)
              if (r.room) props.onEnterRoom(r.room, 5)
            }, t('teams.match.ready'))}>{t('teams.match.ready')}</Button>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Ortak ------------------------------------------------------------------
function TeamChip(props: { team: TeamBrief; big?: boolean }) {
  const t = props.team
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: props.big ? 18 : 14 }}>
      <span style={{ ...tagStyle, background: t.color1, color: '#fff' }}>{t.tag}</span>
      <b>{t.name}</b>
    </span>
  )
}

function TeamList(props: { teams: TeamBrief[]; onOpen: (id: number) => void }) {
  const { t } = useT()
  if (props.teams.length === 0) return <div style={{ opacity: 0.6, padding: 12 }}>{t('teams.empty')}</div>
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {props.teams.map((tm) => (
        <div key={tm.id} style={{ ...row, cursor: 'pointer' }} onClick={() => props.onOpen(tm.id)}>
          <TeamChip team={tm} /><span style={{ flex: 1 }} /><span style={{ opacity: 0.6 }}>{tm.rating_avg.toFixed(1)} · {tm.member_count}</span>
        </div>
      ))}
    </div>
  )
}

const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 2, border: '1px solid var(--btn-border)', background: 'var(--input-bg)', color: 'var(--text)', flex: 1 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderTop: '1px solid #2a2a2a' }
const tagStyle: React.CSSProperties = { display: 'inline-block', padding: '1px 6px', borderRadius: 6, background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, marginRight: 4 }

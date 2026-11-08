import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { SHIELD_PATH, TeamEmblem } from './TeamEmblem'
import TeamTag from './TeamTag'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import Loading from './Loading'
import Breadcrumb, { homeCrumb } from './Breadcrumb'
import AvatarCropper from './AvatarCropper'
import AvatarFrame from './AvatarFrame'
import {
  acceptTeamInvite,
  acceptTeamMatch,
  acceptTeamTransfer,
  applyTeam,
  cancelTeamApplication,
  cancelTeamMatch,
  closeTeam,
  createTeam,
  decideTeamApplication,
  declineTeamInvite,
  demoteTeamMember,
  duelLeaderboard,
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
  revokeTeamInvite,
  searchLeaderboard,
  setTeamLineup,
  transferTeam,
  updateTeamIdentity,
  type DuelIndividualRow,
  type DuelTeamRow,
  type LeaderRow,
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
// Bölümler artık AYRI URL'li alt-sayfa (kullanıcı direktifi 2026-11-05): /takimlar-ligi (genel
// sıralama), /takimlar-ligi/takimim, /takimlar-ligi/kurallar, /takimlar-ligi/kur. Eski sekme-state
// yerine tek 'view' hem bölümü hem drill-in'i (takim/mac) tutar -> bookmark + geri-tuşu çalışır.
type Section = 'overview' | 'create' | 'myteam' | 'rules'
type View = { kind: Section } | { kind: 'team'; id: number } | { kind: 'match'; id: number }
const SECTIONS: readonly Section[] = ['overview', 'create', 'myteam', 'rules']
const isSection = (v: View): v is { kind: Section } => (SECTIONS as readonly string[]).includes(v.kind)

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
  if (!p) return { kind: 'overview' }
  const seg = p.split('/')
  const id = parseInt(seg[1] ?? '', 10)
  if (seg[0] === 'takim' && id) return { kind: 'team', id }
  if (seg[0] === 'mac' && id) return { kind: 'match', id }
  if (seg[0] === 'takimim') return { kind: 'myteam' }
  if (seg[0] === 'kurallar') return { kind: 'rules' }
  if (seg[0] === 'kur') return { kind: 'create' }
  return { kind: 'overview' }
}

// view -> TeamsView alt-yolu (App teamsArg; null = /takimlar-ligi tabanı). parsePath'in tersi.
function pathFor(v: View): string | null {
  switch (v.kind) {
    case 'overview': return null
    case 'myteam': return 'takimim'
    case 'rules': return 'kurallar'
    case 'create': return 'kur'
    case 'team': return 'takim/' + v.id
    case 'match': return 'mac/' + v.id
  }
}

// Türkçe tarih: gün.ay.yıl saat:dk (ör. 05.11.2026 19:30). Geçersiz/boş → '—'.
function fmtTR(s?: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TeamsView(props: Props) {
  const { t } = useT()
  const [view, setView] = useState<View>(() => parsePath(props.initialPath))
  const [notice, setNotice] = useState<string | null>(null)
  const [me, setMe] = useState<TeamMe | null>(null)
  const [meLoaded, setMeLoaded] = useState(false) // getMyTeam döndü mü (yükleniyor ↔ takımsız ayrımı)
  const hasTeam = !!me?.membership
  // Bekleyen davet/başvuru varsa (takımsız olsa da) "Takımım" sekmesi görünür → kabul/ret orada.
  const hasPending = (me?.invites?.length ?? 0) > 0 || (me?.applications?.length ?? 0) > 0

  // Üyelik durumu: takımsız → "Takım Kur" sekmesi, takımlı/davetli → "Takımım" sekmesi.
  useEffect(() => {
    if (!props.myId) { setMe(null); setMeLoaded(true); return } // misafir: kesin takımsız
    setMeLoaded(false)
    getMyTeam().then(setMe).catch(() => setMe(null)).finally(() => setMeLoaded(true))
  }, [props.myId])
  const go = useCallback((v: View) => {
    setView(v)
    props.onPathChange?.(pathFor(v))
  }, [props])
  // Tarayıcı geri/ileri (dış URL değişimi App→teamsArg→initialPath) view'i izlesin. go() kendi
  // yazdığında parsePath eşit → no-op (döngü yok); yalnız dıştan farklı gelirse senkronlar.
  useEffect(() => {
    const parsed = parsePath(props.initialPath)
    setView((cur) => (pathFor(cur) === pathFor(parsed) ? cur : parsed))
  }, [props.initialPath])
  // Üyelik durumu bölüm erişimini belirler: takımsız+davetsiz "Takımım" → genel sıralamaya;
  // takımlıyken "Takım Kur" → Takımım'a yönlendir (URL de düzelir, hayalet alt-sayfa kalmaz).
  useEffect(() => {
    if (!meLoaded) return // me yüklenmeden yönlendirme yok (doğrudan /takimim girişinde hatalı redirect önlenir)
    if (view.kind === 'myteam' && !hasTeam && !hasPending) go({ kind: 'overview' })
    if (view.kind === 'create' && hasTeam) go({ kind: 'myteam' })
  }, [view, hasTeam, hasPending, go, meLoaded])

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

      {isSection(view) && (
        <>
          <nav className="teams-tabs" role="tablist">
            {(['overview', ...((hasTeam || hasPending) ? (['myteam'] as Section[]) : []), ...(!hasTeam ? (['create'] as Section[]) : []), 'rules'] as Section[]).map((k) => (
              <button key={k} role="tab" aria-selected={view.kind === k} className={'teams-tab' + (view.kind === k ? ' is-active' : '')} onClick={() => go({ kind: k })}>
                {t('teams.tab.' + k)}
              </button>
            ))}
          </nav>
          {view.kind === 'overview' && <Overview {...props} go={go} setNotice={setNotice} errText={errText} />}
          {view.kind === 'create' && !hasTeam && (
            <CreateTeam myId={props.myId} eligibility={me?.eligibility ?? null}
              onRequireLogin={props.onRequireLogin} onRequirePremium={props.onRequirePremium}
              setNotice={setNotice} errText={errText} />
          )}
          {view.kind === 'myteam' && (hasTeam || hasPending) && <MyTeam {...props} go={go} setNotice={setNotice} errText={errText} />}
          {view.kind === 'rules' && <Rules />}
        </>
      )}

      {view.kind === 'team' && <TeamDetailView id={view.id} myId={props.myId} hasTeam={hasTeam} back={() => go({ kind: 'overview' })} onProfile={props.onProfile} setNotice={setNotice} errText={errText} />}
      {view.kind === 'match' && (
        <MatchView id={view.id} myId={props.myId} back={() => go({ kind: 'overview' })}
          onEnterRoom={props.onEnterRoom} setNotice={setNotice} errText={errText} />
      )}
      </div>
    </div>
  )
}

// ---- Genel bakış: sıralama + arama + takımım özeti/kurma -----------------------
function Overview(props: Props & { go: (v: View) => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<TeamBrief[] | null>(null)
  // 3 sıralama sekmesi (kullanıcı direktifi): Düello Puanı (takım) + Rating Ort. (takım) + En İyi Düellocu (bireysel).
  const [rankTab, setRankTab] = useState<'duel' | 'rating' | 'best'>('duel')
  const [teamRank, setTeamRank] = useState<TeamRankRow[] | null>(null)
  const [duelTeams, setDuelTeams] = useState<DuelTeamRow[] | null>(null)
  const [duelBest, setDuelBest] = useState<DuelIndividualRow[] | null>(null)

  // Aktif sekmenin verisini tembel çek (ilk geçişte); yüklenmişse tekrar çekme. Düello çağrısı
  // hem takım hem bireysel sıralamayı döndürür -> tek istekle ikisini de doldur.
  useEffect(() => {
    if (rankTab === 'rating' && teamRank === null) getTeams().then((r) => setTeamRank(r.ranking ?? [])).catch(() => setTeamRank([]))
    if ((rankTab === 'duel' || rankTab === 'best') && (duelTeams === null || duelBest === null)) {
      duelLeaderboard(100).then((r) => { setDuelTeams(r.teams); setDuelBest(r.individual) }).catch(() => { setDuelTeams([]); setDuelBest([]) })
    }
  }, [rankTab, teamRank, duelTeams, duelBest])

  const search = async () => {
    if (!q.trim()) { setResults(null); return }
    try { setResults((await getTeams(q)).results ?? []) } catch { setResults([]) }
  }

  const medal = (n: number) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : '')
  // Leaderboard-stili sıralama satırı: derece (madalya) + amblem+ad + sağda değer.
  const rankRow = (key: number, pos: number, team: { name: string; tag: string; logo?: string | null; color1: string; color2: string }, val: string, onOpen: () => void) => (
    <div key={key} className={`trank-row ${pos <= 3 ? 'top' : ''}`} onClick={onOpen}>
      <span className="trank-pos">{medal(pos) || pos}</span>
      <span className="trank-team">
        <TeamEmblem color1={team.color1} color2={team.color2} logo={team.logo || undefined} label={team.tag} size={28} />
        <b>{team.name}</b>
      </span>
      <span className="trank-val">{val}</span>
    </div>
  )

  return (
    <div>
      {/* Başlık + sağ üstte küçük "Takım ara" (liderlik tablosu düzeni). */}
      <div className="trank-head">
        <h3>{t('teams.rankTitle')}</h3>
        <div className="trank-search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('teams.search')}
            onKeyDown={(e) => { if (e.key === 'Enter') void search() }} />
          <Button onClick={() => void search()}>{t('teams.search')}</Button>
        </div>
      </div>
      {results !== null ? (
        <TeamList teams={results} onOpen={(id) => props.go({ kind: 'team', id })} />
      ) : (
        <>
          <div className="rank-tabs" style={{ marginBottom: 10 }}>
            <Button variant={rankTab === 'duel' ? 'default' : 'ghost'} aria-pressed={rankTab === 'duel'} onClick={() => setRankTab('duel')}>{t('teams.rank.duel')}</Button>
            <Button variant={rankTab === 'rating' ? 'default' : 'ghost'} aria-pressed={rankTab === 'rating'} onClick={() => setRankTab('rating')}>{t('teams.rank.rating')}</Button>
            <Button variant={rankTab === 'best' ? 'default' : 'ghost'} aria-pressed={rankTab === 'best'} onClick={() => setRankTab('best')}>{t('teams.rank.best')}</Button>
          </div>

          {/* Takım Düello Puanı: üyelerin topladığı toplam düello puanı (1/3/5). */}
          {rankTab === 'duel' && (
            duelTeams === null ? <Loading /> : duelTeams.length === 0 ? (
              <div className="lb-empty">{t('duel.emptyTeams')}</div>
            ) : (
              <div className="trank-list">
                {duelTeams.map((r, i) => rankRow(r.team_id, i + 1, r, String(r.wins), () => props.go({ kind: 'team', id: r.team_id })))}
              </div>
            )
          )}

          {/* Takım Rating Ortalaması. */}
          {rankTab === 'rating' && (
            teamRank === null ? <Loading /> : teamRank.length === 0 ? (
              <div className="lb-empty">{t('teams.empty')}</div>
            ) : (
              <div className="trank-list">
                {teamRank.map((r) => rankRow(r.id, r.rank, r, r.rating_avg.toFixed(1), () => props.go({ kind: 'team', id: r.id })))}
              </div>
            )
          )}

          {/* En İyi Düellocu: bireysel düello puanı sıralaması (en çok puan kazanan oyuncu). */}
          {rankTab === 'best' && (
            duelBest === null ? <Loading /> : duelBest.length === 0 ? (
              <div className="lb-empty">{t('duel.empty')}</div>
            ) : (
              <div className="trank-list">
                {duelBest.map((r, i) => (
                  <div key={r.user_id} className={`trank-row ${i < 3 ? 'top' : ''}`} onClick={() => props.onProfile?.(r.user_id)}>
                    <span className="trank-pos">{medal(i + 1) || (i + 1)}</span>
                    <span className="trank-team">
                      {r.avatar ? <img className="trank-ava" src={r.avatar} alt="" /> : <Icon name="user" size={18} />}
                      <b>{r.nickname}</b>
                    </span>
                    <span className="trank-val">{r.wins}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}


function CreateTeam(props: { myId: number | null; eligibility: TeamMe['eligibility'] | null; onRequireLogin: () => void; onRequirePremium: () => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [color1, setColor1] = useState('#A83A2B')
  const [color2, setColor2] = useState('#1f2933')
  const [logo, setLogo] = useState('') // base64 data-URI (yüklenirse)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false) // "Takım Kur" düğmesine basınca form açılır
  const [cropSrc, setCropSrc] = useState<string | null>(null) // seçilen ham görsel → avatar gibi kırp/hizala
  const el = props.eligibility

  // Misafir → giriş iste (sekme içeriği; modal arkasında kaybolmasın).
  if (!props.myId) {
    return (
      <div className="teams-gate">
        <div className="teams-gate-icon"><Icon name="users-group" size={22} /></div>
        <div>
          <div className="teams-gate-title">{t('teams.createTitle')}</div>
          <div className="teams-gate-text">{t('teams.createLead')}</div>
          <Button style={{ marginTop: 8 }} onClick={props.onRequireLogin}>{t('teams.needLogin')}</Button>
        </div>
      </div>
    )
  }
  // Uygun değilse de FORM görünür (kullanıcı alanları görsün); "Takım Kur" düğmesi pasif + üstte şart uyarısı.
  const canCreate = !!el?.can_create

  // Dosya seçilince ham görseli cropper'a ver (avatar gibi: zoom + sürükle → kare).
  const onLogoFile = (file?: File) => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => { if (typeof r.result === 'string') setCropSrc(r.result) }
    r.readAsDataURL(file)
  }
  const submit = async () => {
    setBusy(true)
    try {
      await createTeam({ name, tag, color1, color2, description: desc || undefined, logo_upload: logo || undefined })
      props.setNotice(t('teams.pendingApproval'))
      setTimeout(() => location.reload(), 1100)
    } catch (e) { props.setNotice(props.errText(e)) } finally { setBusy(false) }
  }

  // "Takım Kur" düğmesi: tıklanınca form alanları açılır (üstte Premium Al bandı yok).
  if (!showForm) {
    return (
      <button className="teams-create-cta teams-create-cta-lg" onClick={() => setShowForm(true)}>
        <span className="teams-create-cta-emblem" style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}>
          <Icon name="users-group" size={20} />
        </span>
        <span className="teams-create-cta-text">
          <strong>{t('teams.create')}</strong>
          <small>{t('teams.createLead')}</small>
        </span>
      </button>
    )
  }

  return (
    <div className="teams-create">
      <header className="teams-create-head">
        <h3>{t('teams.createTitle')}</h3>
        <p>{t('teams.createLead')}</p>
      </header>

      {/* Canlı amblem önizleme (renk + etiket + yüklenen logo) */}
      <div className="teams-create-preview">
        <TeamEmblem color1={color1} color2={color2} logo={logo || undefined} label={tag} size={76} />
        <div className="teams-create-preview-name">
          <strong>{name || t('teams.name')}</strong>
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
          <label className="teams-color">
            <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} />
            <span className="teams-color-meta"><small>{t('teams.colorPrimary')}</small><code>{color1.toUpperCase()}</code></span>
          </label>
          <label className="teams-color">
            <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} />
            <span className="teams-color-meta"><small>{t('teams.colorSecondary')}</small><code>{color2.toUpperCase()}</code></span>
          </label>
        </div>
      </div>

      <div className="teams-field">
        <span>{t('teams.logo')}</span>
        <div className="teams-logo-row">
          {logo && <img className="teams-logo-thumb" src={logo} alt="" />}
          <label className="teams-logo-upload">
            <input type="file" accept="image/*" onChange={(e) => { onLogoFile(e.target.files?.[0]); e.currentTarget.value = '' }} hidden />
            <Icon name="users-group" size={16} /> {t('teams.logoUpload')}
          </label>
        </div>
        <small>{t('teams.logoHint')}</small>
      </div>

      <label className="teams-field">
        <span>{t('teams.desc')}</span>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} style={{ ...inp, minHeight: 64 }} />
      </label>

      <div className="teams-create-actions">
        <Button disabled={busy || !canCreate || name.trim().length < 3 || tag.trim().length < 2} onClick={submit}>
          {t('teams.create')} · {(el?.found_cost ?? 10000).toLocaleString()} <Icon name="coin" size={13} />
        </Button>
      </div>
      {!canCreate && (
        <p className="teams-create-req">
          {t('teams.create.requirements', { cost: (el?.found_cost ?? 10000).toLocaleString(), rated: el?.min_rated ?? 20 })}
          {el && !el.premium && <> · <button type="button" className="teams-req-link" onClick={props.onRequirePremium}>{t('teams.needPremium')}</button></>}
        </p>
      )}
      {cropSrc && (
        <AvatarCropper src={cropSrc} size={256} title={t('teams.cropTitle')} maskPath={SHIELD_PATH}
          onApply={(d) => { setLogo(d); setCropSrc(null) }}
          onCancel={() => setCropSrc(null)} />
      )}
    </div>
  )
}

// ---- Takımım (yönetim) --------------------------------------------------------
function MyTeam(props: Props & { go: (v: View) => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [me, setMe] = useState<TeamMe | null>(null)
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false) // başlıktaki "Düzenle" → kimlik editörü inline açılır

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

  // Takım yönetim onayında → yönetim ekranı yerine bilgilendirme (henüz aktif değil).
  if (me.membership.team.status === 'pending') {
    return (
      <div className="teams-gate">
        <div className="teams-gate-icon"><Icon name="users-group" size={22} /></div>
        <div>
          <div className="teams-gate-title">{me.membership.team.name} · {t('teams.my.role.' + me.membership.role)}</div>
          <div className="teams-gate-text">{t('teams.pendingBanner')}</div>
        </div>
      </div>
    )
  }

  const team = me.membership.team
  const myRole = me.membership.role
  const isFounder = myRole === 'founder'
  const isManager = isFounder || myRole === 'assistant'

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: '2px solid var(--text)' }}>
        <TeamChip team={team} big /><span style={{ flex: 1 }} />
        {/* Kurucu: "Düzenle" → logo/renk/ad/açıklama editörünü inline aç (tek tık). Diğerleri: "Görüntüle". */}
        {isFounder
          ? <Button variant="outline" onClick={() => setEditOpen((v) => !v)} aria-expanded={editOpen}>{t('teams.edit')}</Button>
          : <Button variant="ghost" onClick={() => props.go({ kind: 'team', id: team.id })}>{t('teams.view')}</Button>}
        {!isFounder && <Button variant="ghost" disabled={busy} onClick={() => { if (confirm(t('teams.leaveConfirm'))) act(() => leaveTeam(team.id), t('teams.left')) }}>{t('teams.leave')}</Button>}
      </div>

      {/* Kimlik editörü — başlıktaki "Düzenle" ile açılır (kurucu). detail hazır olunca mount: form
          gerçek renk/açıklamayla başlar (IdentityBox başlangıç state'i mount'ta okunur). */}
      {isFounder && editOpen && detail && <IdentityBox detail={detail} act={act} busy={busy} defaultEditing onClose={() => setEditOpen(false)} />}

      {/* Bana yapılmış kuruculuk devri teklifi → kabul (§5) */}
      {me.transfer_offer === team.id && (
        <AcceptTransferMaybe teamId={team.id} setNotice={props.setNotice} errText={props.errText} reload={reload} />
      )}

      {/* Üyeler + rol aksiyonları — avatar kartı listesi */}
      <section>
        <SLabel count={detail?.members.length ?? 0}>{t('teams.members')}</SLabel>
        <div className="teams-members">
          {detail?.members.map((m) => {
            const mgr = m.role === 'founder' || m.role === 'assistant'
            return (
              <div key={m.user.id} className={'teams-member' + (m.role === 'founder' ? ' is-founder' : '')}>
                <span className="teams-member-ava" onClick={() => props.onProfile?.(m.user.id)}>
                  <AvatarFrame src={m.user.avatar} size={42} name={m.user.nickname} animated={false} />
                </span>
                <div className="teams-member-main">
                  <button className="teams-member-name" onClick={() => props.onProfile?.(m.user.id)}>{m.user.nickname}</button>
                  <span className="teams-member-meta">
                    <span className={'teams-member-role' + (mgr ? ' is-mgr' : '')}>{t('teams.my.role.' + m.role)}</span>
                    <TeamTag userId={m.user.id} size={18} />
                    {m.user.rating != null && <span className="teams-member-rating"><b>{m.user.rating}</b></span>}
                    {m.user.id === props.myId && <span className="teams-member-you">{t('player.you')}</span>}
                  </span>
                </div>
                <div className="teams-member-actions">
                  {isFounder && m.role === 'member' && <Button disabled={busy} onClick={() => act(() => promoteTeamMember(team.id, m.user.id))}>{t('teams.promote')}</Button>}
                  {isFounder && m.role === 'assistant' && <Button disabled={busy} onClick={() => act(() => demoteTeamMember(team.id, m.user.id))}>{t('teams.demote')}</Button>}
                  {isFounder && m.role !== 'founder' && <Button variant="outline" disabled={busy} onClick={() => { if (confirm(m.user.nickname + ' ' + t('teams.transferConfirm'))) act(() => transferTeam(team.id, m.user.id), t('teams.transferDone')) }}>{t('teams.transfer')}</Button>}
                  {isManager && m.role === 'member' && m.user.id !== props.myId &&
                    <Button variant="ghost" disabled={busy} onClick={() => { if (confirm(m.user.nickname + ' ' + t('teams.kickConfirm'))) act(() => kickTeamMember(team.id, m.user.id)) }}>{t('teams.kick')}</Button>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Başvurular (yönetici) — gelen bekleyen başvurular (§4). "Cevap bekliyor" = karar senin. */}
      {isManager && me.managed && me.managed.applications.length > 0 && (
        <section>
          <SLabel count={me.managed.applications.length}>{t('teams.applications')}</SLabel>
          {me.managed.applications.map((a) => (
            <div key={a.id} style={row}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button className="teams-member-name" onClick={() => props.onProfile?.(a.user.id)}>{a.user.nickname}</button>
                <TeamTag userId={a.user.id} size={20} />
              </span>
              <span style={microTag}>{t('teams.awaitingReply')}</span>
              <span style={{ flex: 1 }} />
              <Button disabled={busy} onClick={() => act(() => decideTeamApplication(a.id, true), t('teams.joined'))}>{t('teams.accept')}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => act(() => decideTeamApplication(a.id, false))}>{t('teams.decline')}</Button>
            </div>
          ))}
        </section>
      )}

      {/* Davet ettiklerim (yönetici) — gönderilmiş bekleyen davetler: "davet edildi, cevap bekleniyor". */}
      {isManager && me.managed && (me.managed.sent_invites?.length ?? 0) > 0 && (
        <section>
          <SLabel count={me.managed.sent_invites!.length}>{t('teams.sentInvites')}</SLabel>
          {me.managed.sent_invites!.map((iv) => (
            <div key={iv.id} style={row}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button className="teams-member-name" onClick={() => props.onProfile?.(iv.user.id)}>{iv.user.nickname}</button>
                <TeamTag userId={iv.user.id} size={20} />
              </span>
              <span style={microTag}>{t('teams.inviteAwaiting')}</span>
              <span style={{ flex: 1 }} />
              <Button variant="ghost" disabled={busy} onClick={() => act(() => revokeTeamInvite(iv.id))}>{t('teams.revoke')}</Button>
            </div>
          ))}
        </section>
      )}

      {/* Davet (yönetici) */}
      {isManager && <InviteBox teamId={team.id} act={act} busy={busy} />}

      {/* Sohbet */}
      <TeamChat teamId={team.id} canManage={isManager} myId={props.myId} />

      {/* Kapat (kurucu) — kurucudan başka üye varken kapatılamaz (backend guard + buton kilidi). */}
      {isFounder && (() => {
        const hasOthers = (team.member_count ?? 1) > 1
        return (
          <>
            <Button variant="ghost" disabled={busy || hasOthers}
              onClick={() => { if (confirm(t('teams.closeConfirm'))) act(() => closeTeam(team.id, true), t('teams.closed')) }}>
              {t('teams.close')}
            </Button>
            {hasOthers && <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>{t('teams.err.has_other_members')}</p>}
          </>
        )
      })()}
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
  const [q, setQ] = useState('')
  const [results, setResults] = useState<LeaderRow[]>([])
  const [searching, setSearching] = useState(false)
  const search = useCallback(async (term: string) => {
    const s = term.trim()
    if (!s) { setResults([]); return }
    setSearching(true)
    try { setResults(((await searchLeaderboard(s, 'rating')) as LeaderRow[]).filter((u) => u.id)) }
    catch { setResults([]) } finally { setSearching(false) }
  }, [])
  // 3 harften sonra OTOMATİK listele (debounce 300ms); <3 harf → temizle. Buton kısa sorgu için kalır.
  useEffect(() => {
    const s = q.trim()
    if (s.length < 3) { setResults([]); return }
    const id = setTimeout(() => search(s), 300)

    return () => clearTimeout(id)
  }, [q, search])
  return (
    <section>
      <SLabel>{t('teams.invite')}</SLabel>
      {/* ID yerine ad ile ara → 3 harften sonra oto-liste → davet et. */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(q) }} placeholder={t('teams.searchUser')} style={inp} />
        <Button variant="outline" disabled={searching || !q.trim()} onClick={() => search(q)}>{t('teams.searchUserBtn')}</Button>
      </div>
      {results.length > 0 && (
        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
          {results.map((u) => (
            <div key={u.id} style={row}>
              <span>{u.name} <span style={{ opacity: 0.6 }}>· {u.rating}</span></span>
              <span style={{ flex: 1 }} />
              <Button disabled={props.busy} onClick={() => { props.act(() => inviteToTeam(props.teamId, u.id!), t('teams.invited')); setResults([]); setQ('') }}>{t('teams.invite')}</Button>
            </div>
          ))}
        </div>
      )}
      {!searching && q.trim() !== '' && results.length === 0 && <div style={{ opacity: 0.6, fontSize: 13, marginTop: 6 }}>{t('teams.noResults')}</div>}
    </section>
  )
}

// defaultEditing: dışarıdaki düğme açtı → doğrudan form (kendi "Düzenle" düğmesini gösterme).
// onClose: "Vazgeç"te dış sahibe haber ver (açan bileşen kapatsın).
function IdentityBox(props: { detail: TeamDetail | null; act: (fn: () => Promise<unknown>, msg?: string) => void; busy: boolean; defaultEditing?: boolean; onClose?: () => void }) {
  const { t } = useT()
  const team = props.detail?.team
  const [editing, setEditing] = useState(props.defaultEditing ?? false)
  const [desc, setDesc] = useState(team?.description ?? '')
  const [open, setOpen] = useState(team?.applications_open ?? true)
  const [color1, setColor1] = useState(team?.color1 ?? '#A83A2B')
  const [color2, setColor2] = useState(team?.color2 ?? '#1f2933')
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const id = team?.id
  if (!id) return null
  // Varsayılan: "Düzenle" düğmesi. Tıkla → ad/etiket/logo/renk/açıklama düzenleme açılır.
  // defaultEditing modunda bu daralmış hal kullanılmaz (dış düğme açar, Vazgeç onClose çağırır).
  if (!editing && !props.defaultEditing) {
    return <Button variant="outline" onClick={() => setEditing(true)}>{t('teams.edit')}</Button>
  }
  const onLogoFile = (file?: File) => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => { if (typeof r.result === 'string') setCropSrc(r.result) }
    r.readAsDataURL(file)
  }
  return (
    <section>
      <SLabel>{t('teams.identity')}</SLabel>
      <div style={{ display: 'grid', gap: 8 }}>
        {/* Bekleyen (onaylanmamış) logo uyarısı — düzenlerken görünür */}
        {team?.has_pending_logo && (
          <div className="teams-logo-pending-warn" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 2, background: 'color-mix(in srgb, var(--warning, #c47f17) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--warning, #c47f17) 45%, transparent)', color: 'var(--text)', fontSize: 13 }}>
            <Icon name="clock" size={15} /> {t('teams.logoPendingWarn')}
          </div>
        )}
        {/* Canlı amblem önizleme (renk + etiket + onaylı logo) */}
        <div className="teams-create-preview">
          <TeamEmblem color1={color1} color2={color2} logo={team?.logo || undefined} label={team?.tag} size={76} />
        </div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('teams.desc')} maxLength={500} style={{ ...inp, minHeight: 60 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> {t('teams.applicationsOpen')}
        </label>
        {/* Renkler (kurucu düzenler → anında) */}
        <div className="teams-field">
          <span>{t('teams.colors')}</span>
          <div className="teams-colors">
            <label className="teams-color">
              <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} />
              <span className="teams-color-meta"><small>{t('teams.colorPrimary')}</small><code>{color1.toUpperCase()}</code></span>
            </label>
            <label className="teams-color">
              <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} />
              <span className="teams-color-meta"><small>{t('teams.colorSecondary')}</small><code>{color2.toUpperCase()}</code></span>
            </label>
          </div>
        </div>
        {/* Logo güncelle (avatar gibi kırp → admin onayına) */}
        <label className="teams-logo-upload" style={{ alignSelf: 'flex-start' }}>
          <input type="file" accept="image/*" onChange={(e) => { onLogoFile(e.target.files?.[0]); e.currentTarget.value = '' }} hidden />
          <Icon name="users-group" size={16} /> {t('teams.logoUpdate')}
        </label>
        <Button disabled={props.busy} onClick={() => props.act(() => updateTeamIdentity(id, { description: desc, applications_open: open, color1, color2 }), t('teams.saved'))}>{t('teams.save')}</Button>
        <hr style={{ opacity: 0.2 }} />
        <div style={{ fontSize: 13, opacity: 0.7 }}>{t('teams.rename.hint')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('teams.name')} maxLength={30} style={inp} />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t('teams.tag')} maxLength={5} style={inp} />
          <Button disabled={props.busy || (!name && !tag)} onClick={() => props.act(() => renameTeam(id, name || null, tag || null), t('teams.renamed'))}>{t('teams.rename')}</Button>
        </div>
        <Button variant="ghost" onClick={() => { setEditing(false); props.onClose?.() }}>{t('teams.cancel')}</Button>
      </div>
      {cropSrc && (
        <AvatarCropper src={cropSrc} size={256} title={t('teams.cropTitle')} maskPath={SHIELD_PATH}
          onApply={(d) => { setCropSrc(null); props.act(() => updateTeamIdentity(id, { logo_upload: d }), t('teams.logoPending')) }}
          onCancel={() => setCropSrc(null)} />
      )}
    </section>
  )
}

function TeamChat(props: { teamId: number; canManage: boolean; myId: number | null }) {
  const { t } = useT()
  const [msgs, setMsgs] = useState<Array<{ id: number; body: string; pinned: boolean; user: { id?: number; nickname?: string } | null; at: string | null }>>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const load = useCallback(() => { import('../api').then((a) => a.getTeamChat(props.teamId).then((r) => setMsgs(r.messages)).catch(() => {})) }, [props.teamId])
  const send = async () => {
    if (busy || !body.trim()) return
    setBusy(true)
    try { const a = await import('../api'); await a.postTeamChat(props.teamId, body); setBody(''); load() } finally { setBusy(false) }
  }
  useEffect(() => { load() }, [load])
  // Backend en-yeni-üstte (DESC) döndürür; sohbet kronolojik AKMALI → id'ye göre artan sırala (en yeni en altta).
  const ordered = [...msgs].sort((a, b) => a.id - b.id)
  // Yeni mesaj/ilk yüklemede kutuyu en alta kaydır (site mesajlaşması gibi: son mesaj görünür).
  useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs])
  return (
    <section>
      <SLabel>{t('teams.chat')}</SLabel>
      <div className="teams-chat-box" ref={boxRef}>
        {ordered.map((m) => {
          const mine = props.myId != null && m.user?.id === props.myId
          return (
            <div key={m.id} className={'teams-chat-msg' + (mine ? ' is-mine' : '')}>
              <div className="teams-chat-meta">
                {m.pinned && <Icon name="pin" size={12} />}
                {/* Kendi mesajımda ad gösterme (WhatsApp grup deseni); karşı tarafın adını göster. */}
                {!mine && <b>{m.user?.nickname ?? '—'}</b>}
                <span className="teams-chat-time">{fmtTR(m.at)}</span>
              </div>
              <div className="teams-chat-body">{m.body}</div>
            </div>
          )
        })}
        {ordered.length === 0 && <div style={{ opacity: 0.5, padding: 4 }}>{t('teams.chat.empty')}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send() } }} placeholder={t('teams.chat')} maxLength={1000} style={inp} />
        <Button disabled={busy || !body} onClick={send}>{t('teams.chat.send')}</Button>
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
function TeamDetailView(props: { id: number; myId: number | null; hasTeam: boolean; back: () => void; onProfile?: (id: number) => void; setNotice: (s: string) => void; errText: (e: unknown) => string }) {
  const { t } = useT()
  const [d, setD] = useState<TeamDetail | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { getTeam(props.id).then(setD).catch(() => {}) }, [props.id])
  if (!d) return <Loading />
  const isFounder = !!props.myId && d.members.some((m) => m.role === 'founder' && m.user.id === props.myId)
  const apply = async () => {
    setBusy(true)
    try { await applyTeam(props.id); props.setNotice(t('teams.invited')) } catch (e) { props.setNotice(props.errText(e)) } finally { setBusy(false) }
  }
  // IdentityBox'ın beklediği act: çalıştır → bildir → takımı yeniden çek (logo/renk anında yansısın).
  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setBusy(true)
    try { await fn(); if (msg) props.setNotice(msg); setD(await getTeam(props.id)) }
    catch (e) { props.setNotice(props.errText(e)) } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <Button variant="ghost" onClick={props.back}>← {t('common.back')}</Button>

      {/* Amblem başlık + kalın alt-kural (Swiss, Takımım görünümüyle tutarlı) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: '2px solid var(--text)' }}>
        <TeamChip team={d.team} big />
        {d.team.is_champion && <span title={t('teams.awards')}>🏆</span>}
        <span style={{ flex: 1 }} />
        <span style={microTag}>{d.team.rating_avg.toFixed(1)} · {d.members.length}</span>
        {/* Başvur yalnız takımsız kullanıcıya: takımdayken (kendi/başka takım) başvurulamaz */}
        {props.myId && !props.hasTeam && d.team.applications_open && (
          <Button disabled={busy} onClick={apply}>{t('teams.apply')}</Button>
        )}
      </div>
      {d.team.description && <p style={{ opacity: 0.85, margin: 0, lineHeight: 1.5 }}>{d.team.description}</p>}

      {/* Kurucuysan: logo/renk/ad/açıklama düzenle (Takımım'daki ile aynı editör) */}
      {isFounder && <IdentityBox detail={d} act={act} busy={busy} />}

      {/* Üyeler — avatar kartı (isimler var(--text), okunur) */}
      <section>
        <SLabel count={d.members.length}>{t('teams.members')}</SLabel>
        <div className="teams-members">
          {d.members.map((m) => {
            const mgr = m.role === 'founder' || m.role === 'assistant'
            return (
              <div key={m.user.id} className={'teams-member' + (m.role === 'founder' ? ' is-founder' : '')}>
                <span className="teams-member-ava" onClick={() => props.onProfile?.(m.user.id)}>
                  <AvatarFrame src={m.user.avatar} size={42} name={m.user.nickname} animated={false} />
                </span>
                <div className="teams-member-main">
                  <button className="teams-member-name" onClick={() => props.onProfile?.(m.user.id)}>{m.user.nickname}</button>
                  <span className="teams-member-meta">
                    <span className={'teams-member-role' + (mgr ? ' is-mgr' : '')}>{t('teams.my.role.' + m.role)}</span>
                    <TeamTag userId={m.user.id} size={18} />
                    {m.user.rating != null && <span className="teams-member-rating"><b>{m.user.rating}</b></span>}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Karşılaşmalar */}
      {d.matches.length > 0 && (
        <section>
          <SLabel count={d.matches.length}>{t('teams.matches')}</SLabel>
          {d.matches.map((mt) => (
            <div key={mt.id} style={row}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TeamMark team={mt.home} size={22} /> {mt.home_score}–{mt.away_score} <TeamMark team={mt.away} size={22} />
              </span>
              <span style={{ flex: 1 }} />
              <span style={microTag}>{mt.status}</span>
            </div>
          ))}
        </section>
      )}

      {/* Ödüller */}
      {d.team.awards.length > 0 && (
        <section>
          <SLabel count={d.team.awards.length}>{t('teams.awards')}</SLabel>
          {d.team.awards.map((a, i) => (
            <div key={i} style={row}>
              <span style={{ fontWeight: 600 }}>{a.month_key}</span>
              <span style={{ flex: 1 }} />
              <span style={microTag}>{a.kind} · #{a.rank}</span>
            </div>
          ))}
        </section>
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
      <h2 style={{ margin: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <TeamMark team={m.home} size={34} /> {m.home_score}–{m.away_score} <TeamMark team={m.away} size={34} />
      </h2>
      <div style={{ opacity: 0.6 }}>{m.status} · {fmtTR(m.scheduled_at)}</div>

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

// Takım kimliği DAİMA amblem (kalkan) — asla metin kısaltma (kullanıcı direktifi 2026-11-05).
// label yalnız logosuz takımda kalkan-içi harf fallback'idir (TeamEmblem), ayrı metin etiket DEĞİL.
function TeamMark(props: { team: TeamBrief | null | undefined; size?: number }) {
  const t = props.team
  if (!t) return null

  return <TeamEmblem color1={t.color1} color2={t.color2} logo={t.logo || undefined} label={t.tag} size={props.size ?? 20} />
}

function TeamChip(props: { team: TeamBrief; big?: boolean }) {
  const t = props.team
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: props.big ? 18 : 14 }}>
      <TeamMark team={t} size={props.big ? 40 : 28} />
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
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }
const tagStyle: React.CSSProperties = { display: 'inline-block', padding: '1px 6px', borderRadius: 2, background: 'var(--accent)', color: 'var(--accent-text, #fff)', fontSize: 12, fontWeight: 700, marginRight: 4 }

// Swiss tipografi: bölüm başlığı — küçük, uppercase, harf-aralıklı, kalın alt-kural (rule).
const sectionLabel: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 2px', paddingBottom: 8, borderBottom: '2px solid var(--text)' }
// Rol/durum mikro-etiketi (muted, uppercase).
const microTag: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }

/** Swiss bölüm başlığı: etiket + sayaç (opsiyonel), kalın alt-kural. */
function SLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ ...sectionLabel, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <span>{children}</span>
      {count != null && <span style={{ fontWeight: 700, color: 'var(--text)' }}>{count}</span>}
    </div>
  )
}

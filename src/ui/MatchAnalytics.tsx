import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { myMatches, matchLogById, type MyMatch, type EJPeriod } from '../api'
import MatchReport from './MatchReport'
import type { MoveLogEntry } from '../storage'
import type { Player } from '../engine/types'

// Her "Daha fazla goster" 30 mac yukler (sunucu offset/limit).
const PAGE = 30
// Donem filtresi (Hata Gunlugu ile ayni): Bugun/3g/7g/30g/Tumu. Varsayilan Tumu.
const PERIODS: EJPeriod[] = ['today', '3d', '7d', '30d', 'all']
// Donem -> 'from' ISO (created_at >=); 'all' -> filtresiz. Filtreleme SUNUCU tarafinda.
function periodFrom(p: EJPeriod): string | undefined {
  if (p === 'all') return undefined
  if (p === 'today') {
    const s = new Date()
    s.setHours(0, 0, 0, 0)
    return s.toISOString()
  }
  const days = p === '3d' ? 3 : p === '7d' ? 7 : 30
  return new Date(Date.now() - days * 86400000).toISOString()
}

// PR bandi (dusuk = iyi). MatchReport ile ayni ruh: kaba renk sinifi.
function prCls(pr: number | null | undefined): string {
  if (pr == null) return ''
  if (pr < 5) return 'good'
  if (pr < 10) return 'ok'
  return 'bad'
}

// Sans etiketi: Tavlai Luck V1 -> gnubg NATIVE MWC% (bagimsiz per-oyuncu, yuzde) VARSA onu goster;
// yoksa ham equity luck'ini okunur isaretli skora olcekle (x100). Ikisi de null -> gosterme.
function luckLabel(mwc?: number | null, raw?: number | null): { text: string; pos: boolean } | null {
  if (mwc != null) return { text: `${mwc >= 0 ? '+' : ''}${mwc.toFixed(1)}%`, pos: mwc >= 0 }
  if (raw != null) {
    const s = Math.round(raw * 100)
    return { text: `${s >= 0 ? '+' : ''}${s}`, pos: s >= 0 }
  }
  return null
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

// Isimden monogram (ilk harf, buyuk). Bos ise '?'.
function initial(name?: string | null): string {
  const c = (name ?? '').trim().charAt(0)
  return c ? c.toUpperCase() : '?'
}

// YZ (bot) rakip isimleri — MatchSetup AI_LEVELS ile senkron. Bu isimlerdeki rakip
// bot demektir; harf monogram yerine robot ikonu gosterilir.
const BOT_NAMES = new Set(
  ['beginner', 'rookie', 'casual', 'skilled', 'expert', 'master', 'grandmaster', 'elite', 'legend', 'neural ai'],
)
function isBot(name?: string | null): boolean {
  return BOT_NAMES.has((name ?? '').trim().toLowerCase())
}

interface Props {
  onClose: () => void
  myName?: string
  myAvatar?: string | null
  initialMatchId?: number // verilirse acilista bu mac bulunup genisletilir (profilden tiklama)
}

export default function MatchAnalytics({ onClose, myName, myAvatar, initialMatchId }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [rows, setRows] = useState<MyMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [report, setReport] = useState<{ log: MoveLogEntry[]; hc: Player; pr: number | null } | null>(null)
  const [reportBusy, setReportBusy] = useState(false)
  // Varsayilan 'Tumu': "bazi maclar cikmiyor" sikayetinin bir sebebi 7g filtresiydi.
  const [period, setPeriod] = useState<EJPeriod>('all')
  const [q, setQ] = useState('') // rakip arama (ham input)
  const [qDeb, setQDeb] = useState('') // debounce sonrasi (sunucuya giden)
  const offsetRef = useRef(0)

  // Bir macin tam analizini (log) cek -> MatchReport ac
  async function openReport(m: MyMatch) {
    setReportBusy(true)
    try {
      const raw = await matchLogById(m.id)
      if (!raw) return
      const parsed = JSON.parse(raw) as { hc?: Player; log?: MoveLogEntry[] }
      const log = parsed.log ?? []
      // Bos log (online/PvP mac -> hamle analizi tutulmaz): rapor acma, karar yok
      if (log.length === 0) return
      setReport({ log, hc: parsed.hc ?? 'white', pr: m.pr ?? null })
    } catch {
      /* yoksay */
    } finally {
      setReportBusy(false)
    }
  }

  // reset=true -> filtre/ilk yukleme (bastan); false -> "Daha fazla goster" (ekle).
  const load = (reset: boolean) => {
    if (reset) {
      setLoading(true)
      setError(false)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    const off = reset ? 0 : offsetRef.current
    myMatches({ offset: off, limit: PAGE, q: qDeb, from: periodFrom(period) })
      .then((data) => {
        setRows((prev) => (reset ? data : [...prev, ...data]))
        offsetRef.current = off + data.length
        setHasMore(data.length === PAGE) // tam sayfa geldiyse dahasi olabilir
        setError(false)
      })
      .catch(() => {
        if (reset) setError(true)
      })
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
  }

  // Rakip aramasini debounce et (her tusa istek atma)
  useEffect(() => {
    const id = setTimeout(() => setQDeb(q.trim()), 350)
    return () => clearTimeout(id)
  }, [q])

  // Filtre degisince (arama/donem) bastan yukle. Mount'ta da bir kez calisir (ilk yukleme).
  useEffect(() => {
    setOpenIdx(null)
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDeb, period])

  // Profilden bir mac id'siyle gelindiyse: o maci bul, genislet, ortala. Ilk sayfada yoksa
  // (eski mac) bulana kadar "Daha fazla" ile sayfalari otomatik cek.
  const didAutoOpen = useRef(false)
  useEffect(() => {
    if (initialMatchId == null || didAutoOpen.current) return
    const idx = rows.findIndex((m) => m.id === initialMatchId)
    if (idx >= 0) {
      didAutoOpen.current = true
      setOpenIdx(idx)
      const m = rows[idx]
      if (m.has_log) {
        // Log varsa (AI maci): dogrudan hamle analizi raporunu ac
        openReport(m)
      } else {
        // Log yoksa (online/PvP): detay satirini genislet + ortaya kaydir
        requestAnimationFrame(() => {
          document.querySelector('.mh-card .mh-item.open')?.scrollIntoView({ block: 'center' })
        })
      }
    } else if (hasMore && !loading && !loadingMore) {
      load(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, hasMore, loading, loadingMore, initialMatchId])

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card mh-card">
        <Button
          variant="ghost"
          size="icon"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="chart-line" size={20} /> {t('mh.title')}
        </h2>
        <p className="register-sub">{t('mh.sub')}</p>

        {/* Filtre: rakip arama + donem sekmeleri (her zaman gorunur ki bos durumda da daraltilabilsin) */}
        <div className="mh-filters">
          <input
            className="mh-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('mh.searchOpp')}
            aria-label={t('mh.searchOpp')}
          />
          <div className="ej-periods" role="tablist" aria-label={t('errorJournal.periodLabel')}>
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                className={`ej-period ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {t(`errorJournal.period.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : error ? (
          <div className="admin-empty">
            {t('common.loadError')}{' '}
            <Button variant="outline" onClick={() => load(true)}>
              {t('common.retry')}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="admin-empty">{qDeb || period !== 'all' ? t('mh.emptyPeriod') : t('mh.empty')}</div>
        ) : (
          <>
          <div className="mh-list">
            {rows.map((m, i) => {
              const open = openIdx === i
              const hasScore = m.score_self != null && m.score_opp != null
              const selfWon = hasScore ? m.score_self! > m.score_opp! : m.won
              const oppWon = hasScore ? m.score_opp! > m.score_self! : !m.won
              const oppName = m.opponent_name || t('mh.opponentFb')
              const meName = myName || t('mh.you')
              // Sans: gnubg NATIVE MWC% oncelikli, yoksa ham luck — her oyuncu kendi tarafinda.
              const selfLuck = luckLabel(m.luck_mwc, m.luck)
              const oppLuck = luckLabel(m.opponent_luck_mwc, m.opponent_luck)
              // Rating degisimi Elo sifir-toplamli: birine +N ise digerine -N. Rakip GERCEK
              // puanli oyuncu ise (bot degil, delta != 0) rakip tarafinda -(self) goster.
              const oppDelta = !isBot(oppName) && m.delta ? -m.delta : null
              return (
                <div
                  key={i}
                  className={`mh-item ${m.won ? 'win' : 'loss'} ${open ? 'open' : ''}`}
                  style={{ ['--i']: i } as CSSProperties}
                >
                  <button
                    type="button"
                    className="mh-row"
                    onClick={() => setOpenIdx(open ? null : i)}
                    aria-expanded={open}
                  >
                    {/* Skorbord: rakip | skor | ben — en onemli bilgi hemen gorunur */}
                    <div className="mh-board">
                      {/* Rakip (sol) */}
                      <div className={`mh-team mh-opp ${oppWon ? 'won' : ''}`}>
                        <span className="mh-ava" aria-hidden="true">
                          {isBot(oppName) ? <Icon name="robot" size={20} /> : initial(oppName)}
                        </span>
                        <span className="mh-info">
                          <span className="mh-nm">{oppName}</span>
                          <span className="mh-tags">
                            {m.opponent_pr != null && (
                              <span className={`mh-prc ${prCls(m.opponent_pr)}`}>PR {m.opponent_pr.toFixed(1)}</span>
                            )}
                            {oppLuck && (
                              <span className={`mh-luck ${oppLuck.pos ? 'good' : 'bad'}`} title={t('mh.dLuck')}>
                                <Icon name="dice" size={13} /> {oppLuck.text}
                              </span>
                            )}
                            <span className="mh-elo">
                              {m.opponent_rating}
                              {oppDelta != null && (
                                <b className={oppDelta >= 0 ? 'good' : 'bad'}> {oppDelta >= 0 ? '+' : ''}{oppDelta}</b>
                              )}
                            </span>
                          </span>
                        </span>
                      </div>

                      {/* Skor (orta) */}
                      <div className="mh-vs">
                        {hasScore ? (
                          <span className="mh-score">
                            <b className={oppWon ? 'w' : ''}>{m.score_opp}</b>
                            <i>–</i>
                            <b className={selfWon ? 'w' : ''}>{m.score_self}</b>
                          </span>
                        ) : (
                          <span className="mh-score mh-score-vs">VS</span>
                        )}
                        <span className="mh-fmt">
                          {m.match_length && m.match_length > 0
                            ? t('mh.ptMatch', { n: m.match_length })
                            : t('mh.moneyGame')}
                        </span>
                      </div>

                      {/* Ben (sag) */}
                      <div className={`mh-team mh-me ${selfWon ? 'won' : ''}`}>
                        <span className="mh-info">
                          <span className="mh-nm">{meName}</span>
                          <span className="mh-tags">
                            {m.pr != null && (
                              <span className={`mh-prc ${prCls(m.pr)}`}>PR {m.pr.toFixed(1)}</span>
                            )}
                            {selfLuck && (
                              <span className={`mh-luck ${selfLuck.pos ? 'good' : 'bad'}`} title={t('mh.dLuck')}>
                                <Icon name="dice" size={13} /> {selfLuck.text}
                              </span>
                            )}
                            <span className="mh-elo">
                              {m.rating_after}
                              <b className={m.delta >= 0 ? 'good' : 'bad'}> {m.delta >= 0 ? '+' : ''}{m.delta}</b>
                            </span>
                          </span>
                        </span>
                        <span className="mh-ava mh-ava-me" aria-hidden="true">
                          {myAvatar ? <img src={myAvatar} alt="" /> : initial(meName)}
                        </span>
                      </div>
                    </div>

                    {/* Alt serit: mac id · sonuc · tarih · genislet (rating degisimi artik
                        her oyuncunun kendi tarafinda — sifir-toplamli). */}
                    <div className="mh-foot">
                      <span className="mh-id" title={t('mh.matchId')}>#{m.id}</span>
                      <span className={`mh-out ${m.won ? 'win' : 'loss'}`}>
                        {m.won ? t('mh.win') : t('mh.loss')}
                      </span>
                      <span className="mh-date">{fmtDate(m.created_at)}</span>
                      <Icon name="chevron" size={16} className={`mh-chev mh-chev-end ${open ? 'chev-open' : ''}`} />
                    </div>
                  </button>
                  {open && (
                    <div className="mh-detail">
                      <div className="mh-stat">
                        <span className="mh-stat-k">{t('mh.dRating')}</span>
                        <span className="mh-stat-v">
                          {m.rating_before} → {m.rating_after}{' '}
                          <b className={m.delta >= 0 ? 'good' : 'bad'}>
                            ({m.delta >= 0 ? '+' : ''}{m.delta})
                          </b>
                        </span>
                      </div>
                      {m.coins_after != null && (
                        <div className="mh-stat">
                          <span className="mh-stat-k">{t('mr.coins')}</span>
                          <span className="mh-stat-v">{m.coins_after}</span>
                        </div>
                      )}
                      {m.has_log && (
                        <Button
                          variant="outline"
                          className="mh-analyze"
                          disabled={reportBusy}
                          onClick={() => openReport(m)}
                        >
                          <Icon name="search" size={15} /> {t('mh.analyze')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {hasMore && (
            <div className="mh-more">
              <Button variant="outline" onClick={() => load(false)} disabled={loadingMore}>
                {loadingMore ? t('admin.loading') : t('mh.showMore')}
              </Button>
            </div>
          )}
          </>
        )}
      </div>
      {report && (
        <MatchReport
          mode="analysis"
          log={report.log}
          pr={report.pr}
          humanColor={report.hc}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  )
}

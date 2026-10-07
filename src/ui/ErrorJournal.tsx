import { useCallback, useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import BlunderLog from './BlunderLog'
import { CategoryBars, ErrorTrend, SeverityDonut } from './ErrorJournalCharts'
import ErrorDetail from './ErrorDetail'
import { errorJournal, type EJEntry, type EJPeriod, type EJResponse, type EJSeverity } from '../api'

const SEV_CLS: Record<EJSeverity, string> = { inaccuracy: 'ok', mistake: 'bad', blunder: 'blunder' }
const PERIODS: EJPeriod[] = ['today', '3d', '7d', '30d', 'all']

// Hata Gunlugu ana ekrani (brief §28-34). Backend'in verdigi analizi gosterir;
// equity/errorRate/classification TEKRAR HESAPLANMAZ.
const ssGet = (k: string): string | null => {
  try {
    return sessionStorage.getItem('tavla.ej.' + k)
  } catch {
    return null
  }
}
const ssSet = (k: string, v: string) => {
  try {
    sessionStorage.setItem('tavla.ej.' + k, v)
  } catch {
    /* sessiz */
  }
}

export default function ErrorJournal({ onClose, titleOverride }: { onClose: () => void; titleOverride?: string /* admin "Sayfa Metni" baslik override'i (bos -> i18n varsayilani) */ }) {
  const { t, lang } = useT()
  useEscape(onClose)

  // Sekme + dönem yenilemede korunur (kaldığın yerden devam; bkz. scrollRestore.ts).
  const [tab, setTab] = useState<'summary' | 'all'>(() => (ssGet('tab') === 'all' ? 'all' : 'summary'))
  const [period, setPeriod] = useState<EJPeriod>(() => {
    const p = ssGet('period')
    return PERIODS.includes(p as EJPeriod) ? (p as EJPeriod) : '7d'
  })
  useEffect(() => ssSet('tab', tab), [tab])
  useEffect(() => ssSet('period', period), [period])
  const [category, setCategory] = useState<string | null>(null)
  const [data, setData] = useState<EJResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [detail, setDetail] = useState<EJEntry | null>(null)
  // "Tüm hatalar" sekmesi: tüm zamanların gnubg hataları (maça göre gruplu kartlar).
  const [all, setAll] = useState<EJEntry[] | null>(null)
  const [allLoading, setAllLoading] = useState(false)
  const [allError, setAllError] = useState(false)
  const loadAll = useCallback(() => {
    setAllLoading(true)
    setAllError(false)
    errorJournal('all', null, 100)
      .then((d) => setAll(d.entries))
      .catch(() => setAllError(true))
      .finally(() => setAllLoading(false))
  }, [])
  useEffect(() => {
    if (tab === 'all' && all === null && !allLoading) loadAll()
  }, [tab, all, allLoading, loadAll])

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    errorJournal(period, category, 50)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [period, category])
  useEffect(() => {
    load()
  }, [load])

  const changePeriod = (p: EJPeriod) => {
    setCategory(null)
    setPeriod(p)
  }
  const catLabel = (id: string) => t(`errorJournal.cat.${id}`)
  const sevLabel = (s: EJSeverity) =>
    t(s === 'inaccuracy' ? 'rep.minor' : s === 'mistake' ? 'rep.error' : 'rep.blunder')
  const relDate = (iso: string | null) => {
    if (!iso) return ''
    const then = new Date(iso).getTime()
    if (Number.isNaN(then)) return ''
    const diff = Math.round((then - Date.now()) / 86400000)
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    return rtf.format(diff, 'day')
  }

  const s = data?.summary
  const cats = s?.categories ?? []
  const order = data?.categoryOrder ?? []
  const entries = data?.entries ?? []
  const weak = data?.insights?.topWeakness ?? null

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card ej-card" onClick={(e) => e.stopPropagation()}>
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
          <Icon name="warning-circle" size={20} /> {titleOverride || t('errorJournal.title')}
        </h2>
        <p className="register-sub">{t('errorJournal.sub')}</p>

        {/* Sekmeler: Ozet | Tum hatalar */}
        <div className="ej-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'summary'}
            className={`ej-tab ${tab === 'summary' ? 'active' : ''}`}
            onClick={() => setTab('summary')}
          >
            {t('errorJournal.tab.summary')}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'all'}
            className={`ej-tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            {t('errorJournal.tab.all')}
          </button>
        </div>

        {tab === 'all' ? (
          <BlunderLog
            entries={all ?? []}
            loading={allLoading || (all === null && !allError)}
            error={allError}
            onRetry={loadAll}
            onOpen={setDetail}
          />
        ) : (
          <>
            {/* Tarih filtresi */}
            <div className="ej-periods" role="tablist" aria-label={t('errorJournal.periodLabel')}>
              {PERIODS.map((p) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={period === p}
                  className={`ej-period ${period === p ? 'active' : ''}`}
                  onClick={() => changePeriod(p)}
                >
                  {t(`errorJournal.period.${p}`)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="ej-skeleton" aria-busy="true">
                <div className="ej-sk-metrics">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="ej-sk-box" />
                  ))}
                </div>
                <div className="ej-sk-row" />
                <div className="ej-sk-row" />
                <div className="ej-sk-row" />
              </div>
            ) : error ? (
              <div className="admin-empty">
                {t('common.loadError')}{' '}
                <Button variant="outline" onClick={load}>
                  {t('common.retry')}
                </Button>
              </div>
            ) : !s || s.decisionsAnalyzed === 0 ? (
              <div className="ej-empty">
                <Icon name="chart" size={30} />
                <p className="ej-empty-title">{t('errorJournal.empty')}</p>
                <p className="ej-empty-sub">{t('errorJournal.emptySub')}</p>
              </div>
            ) : (
              <>
                {/* Gunun ozeti */}
                <div className="ej-metrics">
                  <Metric label={t('errorJournal.metric.games')} value={s.gamesAnalyzed} />
                  <Metric label={t('errorJournal.metric.decisions')} value={s.decisionsAnalyzed} />
                  <Metric label={t('errorJournal.metric.errors')} value={s.totalErrors} />
                  <Metric label={t('errorJournal.metric.blunders')} value={s.blunders} tone="blunder" />
                  <Metric
                    label={t('errorJournal.metric.equityLoss')}
                    value={s.totalEquityLoss.toFixed(3)}
                    tone="loss"
                  />
                </div>

                {/* Insight (gercek veriden) */}
                {weak && (
                  <div className="ej-insight">
                    <Icon name="bulb" size={18} />
                    <span>
                      {t('errorJournal.insight.weak', {
                        cat: catLabel(weak.category),
                        dec: weak.decisions,
                        err: weak.errors,
                        rate: Math.round(weak.errorRate * 100),
                      })}
                    </span>
                  </div>
                )}

                {/* Grafikler: çizgi (zaman) + halka (derece payı) yan yana; altta kategori çubukları */}
                <div className="ejc-row">
                  <section className="ejc-card ejc-card-wide">
                    <h3 className="ejc-h">
                      {s.trend?.[0]?.weekly ? t('ejc.trendTitleWeekly') : t('ejc.trendTitle')}
                    </h3>
                    <p className="ejc-sub">{t('ejc.trendSub')}</p>
                    <ErrorTrend points={s.trend ?? []} />
                  </section>
                  <section className="ejc-card">
                    <h3 className="ejc-h">{t('ejc.sevTitle')}</h3>
                    <p className="ejc-sub">{t('ejc.sevSub')}</p>
                    <SeverityDonut inaccuracies={s.inaccuracies} mistakes={s.mistakes} blunders={s.blunders} />
                  </section>
                </div>
                <section className="ejc-card">
                  <h3 className="ejc-h">{t('ejc.catTitle')}</h3>
                  <p className="ejc-sub">{t('ejc.catSub')}</p>
                  <CategoryBars
                    categories={cats}
                    order={order}
                    catLabel={catLabel}
                    selected={category}
                    onSelect={setCategory}
                  />
                </section>

                {/* Son hatalar / secili kategori hatalari */}
                <section className="ej-section">
                  <h3 className="ej-h">
                    {category ? (
                      <>
                        {catLabel(category)}{' '}
                        <button className="ej-clear" onClick={() => setCategory(null)}>
                          <Icon name="x" size={13} /> {t('errorJournal.clearFilter')}
                        </button>
                      </>
                    ) : (
                      t('errorJournal.recent')
                    )}
                  </h3>
                  {entries.length === 0 ? (
                    <div className="ej-empty small">
                      <p className="ej-empty-sub">{t('errorJournal.noErrorsHere')}</p>
                    </div>
                  ) : (
                    <div className="ej-errs">
                      {entries.map((e) => (
                        <button key={e.id} className="ej-err" onClick={() => setDetail(e)}>
                          <span className={`ej-sev ${SEV_CLS[e.severity]}`}>{sevLabel(e.severity)}</span>
                          <span className="ej-err-cat">{catLabel(e.category)}</span>
                          {e.dice && <span className="ej-err-dice">{e.dice.join('-')}</span>}
                          <span className="ej-err-moves">
                            <code className="bl-move played">{e.playedMove}</code>
                            {/* En iyi hamle yalnız gnubg'den geldiyse listede; diğerleri detayda gnubg'ye sorulur. */}
                            {e.engine === 'gnubg-best' && e.bestMove && (
                              <>
                                <span aria-hidden="true">→</span>
                                <code className="bl-move best">{e.bestMove}</code>
                              </>
                            )}
                          </span>
                          <span className="ej-err-loss">−{e.equityLoss.toFixed(3)}</span>
                          <span className="ej-err-date">{relDate(e.playedAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>

      {detail && (
        <ErrorDetail
          entry={detail}
          catLabel={catLabel}
          onClose={() => setDetail(null)}
          onOpenMatch={(id) => {
            // Hata günlüğünü kapat -> o maçın analizini aç (/mac-analizleri/<id>, App popstate yönlendirir).
            setDetail(null)
            onClose()
            window.history.pushState(null, '', `/mac-analizleri/${encodeURIComponent(id)}`)
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
        />
      )}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: 'blunder' | 'loss' }) {
  return (
    <div className={`ej-metric ${tone ? `t-${tone}` : ''}`}>
      <span className="ej-metric-val">{value}</span>
      <span className="ej-metric-label">{label}</span>
    </div>
  )
}

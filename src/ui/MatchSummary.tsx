import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n'
import { divisionOfPR } from '../badges'
import { computeMatchSummary, type PlayerMatchSummary } from '../analysis/matchSummary'
import type { LogEntry } from './MatchReport'

// Reusable Maç Özeti (Match Summary) modalı — GNU Backgammon Match Summary mantığında iki
// oyunculu karşılaştırma. Hem normal maç analizi (MatchReport) hem MAT analizi (MatReview)
// AYNI componenti + AYNI veri modelini kullanır. Veri LogEntry[]'ten aggregate edilir
// (bkz analysis/matchSummary.ts); yeni analiz çalıştırılmaz.

// Güvenli biçimlendirme: null/NaN/Infinity ASLA kullanıcıya gösterilmez -> '—'.
const DASH = '—'
const fin = (n: number | null | undefined): n is number => n != null && Number.isFinite(n)
const fmtPR = (n: number | null) => (fin(n) ? n.toFixed(2) : DASH)
const fmtCount = (n: number | null) => (fin(n) ? String(Math.round(n)) : DASH)
// Equity kaybı = "cost": pozitif loss'u negatif gösterir (GNU/XG konvansiyonu). Gerçek 0 -> 0.000.
const fmtCost = (n: number | null) => (fin(n) ? (n === 0 ? '0.000' : `−${n.toFixed(3)}`) : DASH)
const fmtLuck = (n: number | null) => (fin(n) ? `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%` : DASH)
// "2 (1)" = hata (blunder)
const fmtErr = (errors: number, blunders: number) => `${errors} (${blunders})`

type RowKind = 'pr' | 'count' | 'cost' | 'luck' | 'errs' | 'level' | 'text'

export default function MatchSummary({
  log,
  names,
  matchLength,
  luck,
  onClose,
}: {
  log: LogEntry[]
  names: string[] | null
  matchLength: number | null
  luck?: { white: number | null; black: number | null }
  onClose: () => void
}) {
  const { t } = useT()
  // Esc: YALNIZ bu (üstteki) modalı kapat — altındaki analiz ekranının Esc'ini tetiklemesin.
  // Capture fazında yakalayıp propagation'ı durdur (alttaki bubble dinleyicileri çalışmasın).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [onClose])
  const data = useMemo(
    () => computeMatchSummary(log, names, luck, matchLength),
    [log, names, luck, matchLength],
  )
  const { white: p1, black: p2 } = data

  // Bir metrik satırı: label + iki oyuncu değeri. sub=alt-metrik (girintili).
  const val = (p: PlayerMatchSummary, kind: RowKind, key: keyof PlayerMatchSummary): string => {
    if (kind === 'level') {
      const pr = p.performanceRating
      return fin(pr) ? t(divisionOfPR(pr).key) : DASH
    }
    const raw = p[key]
    if (kind === 'pr') return fmtPR(raw as number | null)
    if (kind === 'cost') return fmtCost(raw as number | null)
    if (kind === 'luck') return fmtLuck(raw as number | null)
    if (kind === 'count') return fmtCount(raw as number | null)
    return String(raw ?? DASH)
  }

  // Satır tanımları: [i18nKey, kind, field, sub?]. errs satırları iki alan kullanır (errors+blunders).
  const Row = ({
    label,
    kind,
    field,
    blunderField,
    sub,
    strong,
  }: {
    label: string
    kind: RowKind
    field?: keyof PlayerMatchSummary
    blunderField?: keyof PlayerMatchSummary
    sub?: boolean
    strong?: boolean
  }) => {
    const cell = (p: PlayerMatchSummary) => {
      if (kind === 'errs' && field && blunderField)
        return fmtErr(p[field] as number, p[blunderField] as number)
      return val(p, kind, field as keyof PlayerMatchSummary)
    }
    return (
      <tr className={`ms-row ${sub ? 'ms-sub' : ''} ${strong ? 'ms-strong' : ''}`}>
        <th scope="row">{label}</th>
        <td>{cell(p1)}</td>
        <td>{cell(p2)}</td>
      </tr>
    )
  }

  // Kategori başlık satırı (GENEL / HATALAR / …)
  const Head = ({ label }: { label: string }) => (
    <tr className="ms-cat">
      <th scope="colgroup" colSpan={3}>{label}</th>
    </tr>
  )

  // Oyuncu kolon başlığı: ad + PR seviyesi rozeti (varsa).
  const PlayerHead = ({ p }: { p: PlayerMatchSummary }) => {
    const pr = p.performanceRating
    const div = fin(pr) ? divisionOfPR(pr) : null
    return (
      <div className="ms-phead">
        <span className="ms-pname">{p.name}</span>
        {div && (
          <span className="ms-plevel" style={{ color: div.color, borderColor: div.color }}>
            <Icon name={div.icon} size={12} /> {t(div.key)}
          </span>
        )}
      </div>
    )
  }

  return createPortal(
    <div className="register-overlay modal ms-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ms-card" onClick={(e) => e.stopPropagation()}>
        <div className="ms-head">
          <h2>
            <Icon name="chart" size={20} /> {t('ms.title')}
            {matchLength ? <span className="ms-mlen"> · {t('ma.pointMatch', { n: matchLength })}</span> : null}
          </h2>
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={18} />
          </Button>
        </div>
        <div className="ms-body">
          <table className="ms-table">
            <thead>
              <tr>
                <th className="ms-corner">{t('ms.stat')}</th>
                <th><PlayerHead p={p1} /></th>
                <th><PlayerHead p={p2} /></th>
              </tr>
            </thead>
            <tbody>
              <Head label={t('ms.general')} />
              <Row label={t('ms.level')} kind="level" strong />
              <Row label={t('ms.pr')} kind="pr" field="performanceRating" strong />
              <Row label={t('ms.checkerPlay')} kind="pr" field="checkerPlay" />
              <Row label={t('ms.cubePlay')} kind="pr" field="cubePlay" />
              <Row label={t('ms.luckPct')} kind="luck" field="luck" />

              <Head label={t('ms.errors')} />
              <Row label={t('ms.totalErrors')} kind="errs" field="totalErrors" blunderField="totalBlunders" strong />
              <Row label={t('ms.equityCost')} kind="cost" field="totalEquityCost" sub />
              <Row label={t('ms.decisions')} kind="count" field="decisions" sub />

              <Head label={t('ms.checker')} />
              <Row label={t('ms.checkerErrors')} kind="errs" field="checkerErrors" blunderField="checkerBlunders" strong />
              <Row label={t('ms.equityCost')} kind="cost" field="checkerEquityCost" sub />
              <Row label={t('ms.unforced')} kind="count" field="unforcedMoves" sub />

              <Head label={t('ms.cube')} />
              <Row label={t('ms.doubles')} kind="errs" field="doubles" blunderField="doubleBlunders" strong />
              <Row label={t('ms.equityCost')} kind="cost" field="doubleEquityCost" sub />
              <Row label={t('ms.wrongDoubles')} kind="cost" field="wrongDoublesCost" sub />
              <Row label={t('ms.missedDoubles')} kind="cost" field="missedDoublesCost" sub />
              <Row label={t('ms.cubeDecisions')} kind="count" field="cubeDecisions" sub />

              <Head label={t('ms.take')} />
              <Row label={t('ms.takes')} kind="errs" field="takes" blunderField="takeBlunders" strong />
              <Row label={t('ms.equityCost')} kind="cost" field="takeEquityCost" sub />
              <Row label={t('ms.wrongTakes')} kind="cost" field="wrongTakesCost" sub />
              <Row label={t('ms.wrongPasses')} kind="cost" field="wrongPassesCost" sub />
              <Row label={t('ms.takeDecisions')} kind="count" field="takeDecisions" sub />

              <Head label={t('ms.luck')} />
              <Row label={t('ms.jokers')} kind="count" field="jokers" />
              <Row label={t('ms.luckCost')} kind="cost" field="luckCost" />
              <Row label={t('ms.rolls')} kind="count" field="rolls" />
              <Row label={t('ms.luckRating')} kind="pr" field="luckBasedRating" />
              <Row label={t('ms.luckElo')} kind="count" field="luckBasedElo" />
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  )
}

import { Icon } from './Icon'
import { useT } from '../i18n'
import type { LogEntry } from './MatchReport'

// Küp analizi paneli: küp kararında XG-benzeri aksiyon equity tablosu (Katlama yok / Katla,Pas /
// Katla,Kabul) + doğru aksiyon vurgusu + kazanma% + oynananın (double/no-double ya da take/drop)
// kaybı. MatReview (tam ekran) + MatchReport (gömülü analiz) ORTAK kullanır (tek kaynak).
export function CubeAnalysis({ cube }: { cube: NonNullable<LogEntry['cube']> }) {
  const { t } = useT()
  const eqs = cube.equities || {}
  const rows: Array<{ k: 'noDouble' | 'doublePass' | 'doubleTake'; lbl: string }> = [
    { k: 'noDouble', lbl: t('mrv.cActNoDouble') },
    { k: 'doublePass', lbl: t('mrv.cActDoublePass') },
    { k: 'doubleTake', lbl: t('mrv.cActDoubleTake') },
  ]
  const fmt = (v: number | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(3)}`)
  return (
    <div className="mrv-cube">
      <div className="mrv-cube-title">{cube.isResponse ? t('mrv.cResponse') : t('mrv.cOffer')}</div>
      <div className="mrv-cube-win">
        <span>{t('mrv.win')}</span>
        <b>{cube.win != null ? `${cube.win.toFixed(1)}%` : '—'}</b>
      </div>
      <div className="mrv-cube-eqs">
        {rows.map(({ k, lbl }) => {
          const best = cube.highlight === k
          return (
            <div key={k} className={`mrv-cube-eq ${best ? 'best' : ''}`}>
              <span className="mrv-ce-lbl">{lbl}</span>
              <span className="mrv-ce-val">{fmt(eqs[k])}</span>
              {best ? <Icon name="check" size={13} /> : <span className="mrv-ce-sp" />}
            </div>
          )
        })}
      </div>
      <div className={`mrv-cube-verdict ${cube.correct ? 'ok' : 'bad'}`}>
        <span className="mrv-cv-played">
          {t('mrv.cPlayed')}: {t(`cube.chose.${cube.chosen}`)}
        </span>
        <span className="mrv-cv-tag">
          {cube.correct ? (
            <>
              <Icon name="check" size={13} /> {t('cube.correct')}
            </>
          ) : (
            <>
              {t('cube.wrong')} · −{(cube.loss ?? 0).toFixed(3)}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

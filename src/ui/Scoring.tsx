/**
 * Scoring — Bilgi sayfasındaki "Puanlama" sekmesi. Standart Elo formülünü ve
 * kullanıcının mevcut puanına göre bir maçta kazanacağı/kaybedeceği puanı gösterir.
 * K faktörü backend ile AYNI olmalı (AuthController.reportRating → $k = 32).
 */

import { useT } from '../i18n'

const K = 32 // backend ile birebir (AuthController $k)

function expected(ra: number, rb: number) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400))
}
function winDelta(ra: number, rb: number) {
  return Math.round(K * (1 - expected(ra, rb)))
}
function lossDelta(ra: number, rb: number) {
  return Math.round(K * (0 - expected(ra, rb)))
}

export default function Scoring({ currentRating }: { currentRating?: number }) {
  const { t } = useT()
  const ra = currentRating ?? 1500
  const diffs = [-300, -150, 0, 150, 300]

  return (
    <div className="scoring">
      <p className="scoring-intro">{t('scoring.intro')}</p>

      <div className="scoring-formula">
        <code>{t('scoring.formula.text')}</code>
        <p className="scoring-formula-expl">{t('scoring.formula.expl')}</p>
      </div>

      <p className="scoring-your">{t('scoring.yourRating', { n: ra })}</p>
      <p className="scoring-hint">{t('scoring.tableHint')}</p>

      <table className="scoring-table">
        <thead>
          <tr>
            <th>{t('scoring.col.opp')}</th>
            <th>{t('scoring.col.win')}</th>
            <th>{t('scoring.col.loss')}</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((d) => {
            const rb = Math.max(100, ra + d)
            const w = winDelta(ra, rb)
            const l = lossDelta(ra, rb)
            const label =
              d === 0
                ? t('scoring.lbl.equal')
                : d < 0
                  ? t('scoring.lbl.weaker', { n: -d })
                  : t('scoring.lbl.stronger', { n: d })
            return (
              <tr key={d} className={d === 0 ? 'is-equal' : ''}>
                <td>
                  {label} <span className="scoring-opp-r">({rb})</span>
                </td>
                <td className="scoring-win">+{w}</td>
                <td className="scoring-loss">{l}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ul className="scoring-notes">
        <li>{t('scoring.note.rankedOnly')}</li>
        <li>{t('scoring.note.friendly')}</li>
        <li>{t('scoring.note.noScoreDiff')}</li>
        <li>{t('scoring.note.floor')}</li>
      </ul>
    </div>
  )
}

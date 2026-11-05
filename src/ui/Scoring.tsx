/**
 * Scoring — Bilgi sayfasındaki "Puanlama" sekmesi. TavlaTV'nin Elo + maç-uzunluğu
 * katsayılı puanlama tercihini açıklar ve mevcut puana göre kazanç/kaybı gösterir.
 *
 * Formül backend (App\Support\RatingPolicy) ile BİREBİR aynı olmalı:
 *   E = 1 / (1 + 10^((RakipR − R) / 400))            (beklenen kazanma olasılığı)
 *   C = √(L / 3)                                       (maç uzunluğu katsayısı)
 *   transfer = round(32 × C × (1 − E_kazanan))         (yuvarlama YALNIZ burada, kazanandan)
 *   Kazanan +transfer, kaybeden −transfer              (simetri garanti)
 *
 * SİMETRİ TUZAĞI: JS Math.round(-2.5) = -2 ama PHP round(-2.5) = -3. Bu yüzden kayıp da
 * POZİTİF transfer yuvarlanıp negatife çevrilir -> sunucuyla aynı sonuç.
 */

import { useState } from 'react'
import { useT } from '../i18n'

const K = 32 // backend RatingPolicy::ELO_K ile birebir
const LENGTHS = [1, 3, 5, 7, 9, 11, 13] // örnek/seçilebilir hedef puanlar (sistem 1–13 destekler)

function expected(ra: number, rb: number) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400))
}
function lengthFactor(l: number) {
  return Math.sqrt(Math.max(1, l) / 3)
}
// Pozitif transfer (kazananın kazancı) — kaybeden bunun eksisini alır (simetri).
function transfer(winnerR: number, loserR: number, l: number) {
  return Math.round(K * lengthFactor(l) * (1 - expected(winnerR, loserR)))
}
export function winDelta(ra: number, rb: number, l: number) {
  return transfer(ra, rb, l) // self = kazanan
}
export function lossDelta(ra: number, rb: number, l: number) {
  return -transfer(rb, ra, l) // self = kaybeden -> rakip kazanan, eksi uygula
}

export default function Scoring({ currentRating }: { currentRating?: number }) {
  const { t } = useT()
  const ra = currentRating ?? 1500
  const [len, setLen] = useState(3)
  const diffs = [-300, -150, 0, 150, 300]
  const c = lengthFactor(len)

  return (
    <div className="scoring">
      <p className="scoring-intro">{t('scoring.intro')}</p>

      <div className="scoring-formula">
        <code>{t('scoring.formula.text')}</code>
        <p className="scoring-formula-expl">{t('scoring.formula.expl')}</p>
      </div>

      {/* Eşit puanlı oyuncular için maç uzunluğuna göre örnek (kazanç = kayıp). */}
      <p className="scoring-hint">{t('scoring.example.title')}</p>
      <table className="scoring-table scoring-table-len">
        <thead>
          <tr>
            <th>{t('scoring.example.len')}</th>
            <th>{t('scoring.col.win')}</th>
            <th>{t('scoring.col.loss')}</th>
          </tr>
        </thead>
        <tbody>
          {LENGTHS.map((l) => {
            const w = winDelta(ra, ra, l)
            return (
              <tr key={l} className={l === len ? 'is-equal' : ''}>
                <td>{t('scoring.example.pts', { n: l })}</td>
                <td className="scoring-win">+{w}</td>
                <td className="scoring-loss">−{w}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="scoring-your">{t('scoring.yourRating', { n: ra })}</p>

      {/* Maç uzunluğu seçimi -> alttaki tablo C katsayısıyla yeniden hesaplanır. */}
      <label className="scoring-len-pick">
        {t('scoring.lengthLabel')}{' '}
        <select value={len} onChange={(e) => setLen(Number(e.target.value))}>
          {LENGTHS.map((l) => (
            <option key={l} value={l}>
              {t('scoring.example.pts', { n: l })}
            </option>
          ))}
        </select>
      </label>
      <p className="scoring-coeff">{t('scoring.coeff', { c: c.toFixed(2) })}</p>

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
            const w = winDelta(ra, rb, len)
            const l = lossDelta(ra, rb, len)
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
        <li>{t('scoring.note.length')}</li>
        <li>{t('scoring.note.rankedOnly')}</li>
        <li>{t('scoring.note.friendly')}</li>
        <li>{t('scoring.note.noScoreDiff')}</li>
        <li>{t('scoring.note.floor')}</li>
        <li>{t('scoring.note.pref')}</li>
      </ul>
    </div>
  )
}

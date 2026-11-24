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

// Yüksek puanda azalan KAZANÇ çarpanı — backend RatingPolicy::gainMultiplier ile BİREBİR.
// 2000 üstünde galibiyet kazancı lineer azalır (GM/SGM için kazanmak zor); KAYIP tam kalır.
const GAIN_TAPER_START = 2000
const GAIN_TAPER_SPAN = 1000
const GAIN_MULT_FLOOR = 0.2
export function gainMultiplier(rating: number) {
  if (rating <= GAIN_TAPER_START) return 1
  return Math.max(GAIN_MULT_FLOOR, 1 - (rating - GAIN_TAPER_START) / GAIN_TAPER_SPAN)
}

function expected(ra: number, rb: number) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400))
}
function lengthFactor(l: number) {
  return Math.sqrt(Math.max(1, l) / 3)
}
// Pozitif transfer (kazananın ham Elo kazancı) — kaybeden bunun eksisini TAM alır.
function transfer(winnerR: number, loserR: number, l: number) {
  return Math.round(K * lengthFactor(l) * (1 - expected(winnerR, loserR)))
}
export function winDelta(ra: number, rb: number, l: number) {
  // self = kazanan: ham transfer × yüksek-puan azalma çarpanı (kazananın kendi rating'i).
  return Math.round(transfer(ra, rb, l) * gainMultiplier(ra))
}
export function lossDelta(ra: number, rb: number, l: number) {
  return -transfer(rb, ra, l) // self = kaybeden -> rakip kazanan; KAYIP tam (taper yok)
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
            const lo = Math.abs(lossDelta(ra, ra, l)) // yüksek puanda kazançtan büyük olabilir
            return (
              <tr key={l} className={l === len ? 'is-equal' : ''}>
                <td>{t('scoring.example.pts', { n: l })}</td>
                <td className="scoring-win">+{w}</td>
                <td className="scoring-loss">−{lo}</td>
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

      {/* Yüksek puanda azalan kazanç — GM/SGM için "kazanmak zor" (kullanıcı direktifi). */}
      <div className="scoring-taper">
        <p className="scoring-hint">{t('scoring.taper.title')}</p>
        <p className="scoring-taper-expl">{t('scoring.taper.expl')}</p>
        <table className="scoring-table scoring-table-taper">
          <thead>
            <tr>
              <th>{t('scoring.taper.rating')}</th>
              <th>{t('scoring.taper.mult')}</th>
            </tr>
          </thead>
          <tbody>
            {[2000, 2150, 2300, 2400, 2500].map((r) => (
              <tr key={r} className={ra >= r && ra < r + 100 ? 'is-equal' : ''}>
                <td>
                  {r}
                  {r === 2150 ? ' · GM' : r === 2400 ? ' · Süper GM' : r === 2500 ? ` · ${t('scoring.taper.apex')}` : ''}
                </td>
                <td>×{gainMultiplier(r).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="scoring-taper-note">{t('scoring.taper.loss')}</p>
      </div>

      <ul className="scoring-notes">
        <li>{t('scoring.note.length')}</li>
        <li>{t('scoring.note.rankedOnly')}</li>
        <li>{t('scoring.note.friendly')}</li>
        <li>{t('scoring.note.tournament')}</li>
        <li>{t('scoring.note.prBonus')}</li>
        <li>{t('scoring.note.noScoreDiff')}</li>
        <li>{t('scoring.note.floor')}</li>
        <li>{t('scoring.note.pref')}</li>
      </ul>
    </div>
  )
}

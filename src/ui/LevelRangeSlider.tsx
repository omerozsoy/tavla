/**
 * Rakip Seviyesi — çift tutamaçlı seviye seçici. Sol tutamaç en düşük, sağ tutamaç en yüksek
 * rakip rütbesini seçer; tutamaçlar yalnız rütbe duraklarına oturur. Varsayılan EN GENİŞ (iki
 * tutamaç pencerenin uçlarında) -> kısa bekleme; oyuncu daraltabilir. "Tüm seviyeler" = sınırsız.
 *
 * Eşleşme RATING bandına göredir (rozet PR+EP ile hesaplanır ama eşleşme yalnız rating'e bakar).
 * Değerler anında üst bileşene onChange ile akar; puan önizlemesi Scoring (backend birebir ayna)
 * fonksiyonlarıyla hesaplanır. Bkz. levelRange.ts + backend RoomController matchmaking.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useT } from '../i18n'
import { levelWindow, payloadFromRange, rangeFromStops, selfStopIndex, type LevelStop } from '../levelRange'
import { lossDelta, winDelta } from './Scoring'
import { onlinePlayers, type OnlinePlayer } from '../api'

export interface LevelRangeValue {
  minRating: number // 0 = alt sınır serbest
  maxRating: number // 0 = üst sınır serbest (açık uçlu zirve ya da "Tüm seviyeler")
  allLevels: boolean
}

export function LevelRangeSlider({
  rating,
  target,
  onChange,
}: {
  rating: number
  target: number // maç hedef puanı (L); Tek Oyun = 1
  onChange: (v: LevelRangeValue) => void
}) {
  const { t } = useT()
  const stops = useMemo(() => levelWindow(rating), [rating])
  const self = selfStopIndex(stops, rating)
  const last = stops.length - 1
  const [lo, setLo] = useState(0) // varsayılan: en geniş
  const [hi, setHi] = useState(last)
  const [all, setAll] = useState(false)
  const [online, setOnline] = useState<OnlinePlayer[] | null>(null) // bu aralıkta kaç rakip çevrimiçi
  const trackRef = useRef<HTMLDivElement>(null)
  const active = useRef<'lo' | 'hi' | null>(null)

  // Çevrimiçi oyuncuları bir kez çek -> seçilen banda düşen (maçta olmayan) sayısını göster.
  // Böylece uygun rakip yoksa oyuncu boşuna aramaz. İstemci-tarafı filtre, sürükledikçe güncellenir.
  useEffect(() => {
    let alive = true
    onlinePlayers()
      .then((p) => alive && setOnline(p))
      .catch(() => alive && setOnline([]))
    return () => {
      alive = false
    }
  }, [])

  // Değer anında yukarı akar. onChange'i ref'le -> inline prop loop'u olmaz.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    if (all) {
      onChangeRef.current({ minRating: 0, maxRating: 0, allLevels: true })
      return
    }
    const r = rangeFromStops(stops, lo, hi)
    onChangeRef.current({ ...payloadFromRange(r), allLevels: false })
  }, [lo, hi, all, stops])

  const pct = (i: number) => (last === 0 ? 50 : (i / last) * 100)
  const idxFromX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(last, Math.round(ratio * last)))
  }
  const onDown = (which: 'lo' | 'hi') => (e: RPointerEvent) => {
    if (all) return
    active.current = which
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: RPointerEvent) => {
    if (!active.current || all) return
    const idx = idxFromX(e.clientX)
    if (active.current === 'lo') setLo(Math.min(idx, hi))
    else setHi(Math.max(idx, lo))
  }
  const onUp = (e: RPointerEvent) => {
    active.current = null
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  }

  const loStop = stops[Math.min(lo, hi)]
  const hiStop = stops[Math.max(lo, hi)]
  const nameOf = (s: LevelStop) => t(s.divKey)
  const bandOf = (s: LevelStop) => (s.max != null ? `${s.min}–${s.max}` : `${s.min}+`)
  const range = rangeFromStops(stops, lo, hi)
  const rangeText = all
    ? t('level.all')
    : range.max != null
      ? `${range.min}–${range.max}`
      : `${range.min}+`

  // Puan önizlemesi: zayıf rakip -> küçük kazanç/büyük kayıp; güçlü -> büyük kazanç/küçük kayıp.
  const L = Math.max(1, target)
  const oppLo = all ? 100 : Math.max(100, range.min)
  const oppHi = all ? 3000 : range.max != null ? range.max : 3000
  const winA = winDelta(rating, oppLo, L)
  const winB = winDelta(rating, oppHi, L)
  const winLo = Math.min(winA, winB)
  const winHi = Math.max(winA, winB)
  const lossX = Math.abs(lossDelta(rating, oppLo, L))
  const lossY = Math.abs(lossDelta(rating, oppHi, L))
  const lossLo = Math.min(lossX, lossY)
  const lossHi = Math.max(lossX, lossY)
  const span = (a: number, b: number, sign: string) => (a === b ? `${sign}${a}` : `${sign}${a} … ${sign}${b}`)

  // Seçilen banda düşen çevrimiçi (maçta olmayan) oyuncu sayısı; "Tüm seviyeler"de tüm havuz.
  const effMin = all ? 0 : range.min
  const effMax = all ? Infinity : range.max != null ? range.max : Infinity
  const matchCount =
    online == null ? null : online.filter((p) => !p.in_game && p.rating >= effMin && p.rating <= effMax).length

  return (
    <div className={'lvl' + (all ? ' lvl-all' : '')}>
      <div className="lvl-head">
        <span className="lvl-title">{t('level.title')}</span>
        <button
          type="button"
          className={'lvl-allbtn' + (all ? ' on' : '')}
          onClick={() => setAll((v) => !v)}
        >
          {t('level.all')}
        </button>
      </div>

      <p className="lvl-hint lvl-hint-top">{t('level.waitHint')}</p>

      <div
        className="lvl-track"
        ref={trackRef}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="lvl-rail" />
        {!all && (
          <div
            className="lvl-fill"
            style={{ left: `${pct(Math.min(lo, hi))}%`, width: `${pct(Math.max(lo, hi)) - pct(Math.min(lo, hi))}%` }}
          />
        )}
        {stops.map((s, i) => (
          <span
            key={s.divKey}
            className={'lvl-notch' + (i === self ? ' lvl-notch-self' : '')}
            style={{ left: `${pct(i)}%` }}
          />
        ))}
        {!all && (
          <>
            <button
              type="button"
              className="lvl-handle"
              style={{ left: `${pct(lo)}%` }}
              onPointerDown={onDown('lo')}
              role="slider"
              aria-label={t('level.lowest')}
              aria-valuemin={stops[0].min}
              aria-valuemax={hiStop.max ?? stops[last].min}
              aria-valuenow={loStop.min}
            >
              <span className="lvl-handle-val">{loStop.min}</span>
            </button>
            <button
              type="button"
              className="lvl-handle"
              style={{ left: `${pct(hi)}%` }}
              onPointerDown={onDown('hi')}
              role="slider"
              aria-label={t('level.highest')}
              aria-valuemin={loStop.min}
              aria-valuemax={stops[last].max ?? stops[last].min}
              aria-valuenow={hiStop.max ?? hiStop.min}
            >
              <span className="lvl-handle-val">{hiStop.max != null ? hiStop.max : `${hiStop.min}+`}</span>
            </button>
          </>
        )}
      </div>

      {!all && (
        <div className="lvl-readout">
          <div className="lvl-ends">
            <span className="lvl-end lvl-end-lo">
              <span className="lvl-lab">{t('level.lowest')}</span>
              <span className="lvl-val">
                {nameOf(loStop)} · {bandOf(loStop)}
              </span>
            </span>
            <span className="lvl-end lvl-end-hi">
              <span className="lvl-lab">{t('level.highest')}</span>
              <span className="lvl-val">
                {nameOf(hiStop)} · {bandOf(hiStop)}
              </span>
            </span>
          </div>
          <div className="lvl-row lvl-row-range">
            <span className="lvl-lab">{t('level.range')}</span>
            <span className="lvl-val">{rangeText}</span>
          </div>
        </div>
      )}

      <div className="lvl-preview">
        <span className="lvl-prev-win">{t('level.win')}: {span(winLo, winHi, '+')}</span>
        <span className="lvl-prev-loss">{t('level.loss')}: {span(lossLo, lossHi, '−')}</span>
      </div>

      <p className={'lvl-online' + (matchCount === 0 ? ' lvl-online-zero' : '')}>
        {t('level.online')}: <b>{matchCount == null ? '…' : matchCount}</b>
      </p>
    </div>
  )
}

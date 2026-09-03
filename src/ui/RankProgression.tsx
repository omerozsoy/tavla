/**
 * RankProgression — dikey "rütbe yolculuğu" infografiği (Emil Kowalski yönü:
 * temiz, premium, yalın, güçlü tipografi, dekorasyon yok).
 *
 * 20 kademe merkez omurga üzerinde milestone olarak; 6 görsel aile (entry +
 * intermediate/advanced/master/grandmaster/superGrandmaster). currentRating
 * verilirse: özet kart (mevcut → sonraki + kalan puan + bar), omurga current'a
 * kadar dolar, önceki=completed / current / sonraki=upcoming. S1 zirve.
 *
 * Veri TEK kaynak: src/ranks.ts (RANK_GROUPS). İkon SADECE Phosphor. Renkler
 * --rank-* token'larından; burada renk hard-code YOK. Stil: RankProgression.css.
 */

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { RANK_GROUPS, rankOf, nextRank, rankIndex, type RankTier } from '../ranks'
import './RankProgression.css'

export interface RankProgressionProps {
  /** Verilirse mevcut rütbe + ilerleme gösterilir (ör. 2125 → Master M2). */
  currentRating?: number
  /** Daha sıkı, küçük varyant (dar alanlar / yan panel). */
  compact?: boolean
  className?: string
}

export function RankProgression({ currentRating, compact = false, className }: RankProgressionProps) {
  const { t, lang } = useT()
  const trackRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLLIElement>(null)
  const [fill, setFill] = useState(0)

  const hasCurrent = typeof currentRating === 'number'
  const current = hasCurrent ? rankOf(currentRating as number) : undefined
  const currentIdx = current ? rankIndex(current) : -1
  const next = current ? nextRank(current) : undefined

  // Omurga dolgusu: current marker'ın merkezine kadar ÖLÇÜLÜR (aile etiketleri
  // değişken yükseklik kattığından yüzde hesabı ıskalar; ölçüm tam isabet eder).
  useLayoutEffect(() => {
    if (!hasCurrent) {
      setFill(0)
      return
    }
    const track = trackRef.current
    const row = currentRef.current
    if (!track || !row) return
    const compute = () => {
      const marker = row.querySelector('.rank-prog__marker')
      if (!marker) return
      const tr = track.getBoundingClientRect()
      const mr = marker.getBoundingClientRect()
      setFill(mr.top + mr.height / 2 - tr.top)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(track)
    return () => ro.disconnect()
  }, [hasCurrent, currentRating, compact])

  const stateOf = (r: RankTier): 'completed' | 'current' | 'upcoming' | 'default' => {
    if (!current) return 'default'
    const i = rankIndex(r)
    return i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'upcoming'
  }

  const toNext = current && next ? Math.max(0, next.min - (currentRating as number)) : 0
  const bandPct =
    current && next
      ? Math.max(
          0,
          Math.min(100, Math.round(((currentRating! - current.min) / (next.min - current.min)) * 100)),
        )
      : 100

  return (
    <section
      className={`rank-prog${compact ? ' rank-prog--compact' : ''}${className ? ' ' + className : ''}`}
      aria-label={t('rank.progTitle')}
    >
      <header className="rank-prog__head">
        <h2 className="rank-prog__title">
          <Icon name="medal" size={20} /> {t('rank.progTitle')}
        </h2>
        <p className="rank-prog__sub">{t('rank.progSub')}</p>
      </header>

      {current && (
        <div
          className="rank-prog__summary"
          data-family={current.family}
          {...(current.apex ? { 'data-apex': '' } : {})}
        >
          <div className="rank-prog__sum-grid">
            <div className="rank-prog__sum-side">
              <span className="rank-prog__sum-label">{t('rank.current')}</span>
              <span className="rank-prog__sum-rank">
                {t(current.familyKey)}
                {current.code && <b className="rank-prog__sum-code">{current.code}</b>}
              </span>
              {/* Eşik değil, kullanıcının GERÇEK güncel puanı (başlıktaki gibi) */}
              <span className="rank-prog__sum-meta">
                {(currentRating as number).toLocaleString(lang === 'tr' ? 'tr-TR' : undefined)}
              </span>
            </div>
            <div className="rank-prog__sum-side rank-prog__sum-side--next">
              {next ? (
                <>
                  <span className="rank-prog__sum-label">{t('rank.next')}</span>
                  <span className="rank-prog__sum-rank">
                    {t(next.familyKey)}
                    {next.code && <b className="rank-prog__sum-code">{next.code}</b>}
                    <span className="rank-prog__sum-sep">·</span>
                    {next.min}
                  </span>
                  <span className="rank-prog__sum-meta">{t('rank.toNext', { n: toNext })}</span>
                </>
              ) : (
                <>
                  <span className="rank-prog__sum-label">{t('rank.highest')}</span>
                  <span className="rank-prog__sum-rank">{t('rank.maxed')}</span>
                </>
              )}
            </div>
          </div>
          <div
            className="rank-prog__bar"
            role="progressbar"
            aria-valuenow={bandPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="rank-prog__bar-fill" style={{ width: `${bandPct}%` }} />
          </div>
        </div>
      )}

      <div
        className="rank-prog__track"
        ref={trackRef}
        style={hasCurrent ? ({ '--prog-fill': `${fill}px` } as CSSProperties) : undefined}
      >
        {hasCurrent && <span className="rank-prog__spine-fill" aria-hidden="true" />}
        {RANK_GROUPS.map((block) => (
          <div className="rank-prog__group" key={block.group}>
            <span className="rank-prog__group-label">{t(block.labelKey)}</span>
            <ol className="rank-prog__nodes">
              {block.ranks.map((r) => {
                const st = stateOf(r)
                const isCur = st === 'current'
                const RIcon = r.Icon
                const stateText =
                  st === 'completed'
                    ? t('rank.completed')
                    : st === 'upcoming'
                      ? t('rank.upcoming')
                      : ''
                return (
                  <li
                    key={r.divKey}
                    ref={isCur ? currentRef : undefined}
                    className="rank-prog__row"
                    data-family={r.family}
                    data-tier={r.tier}
                    data-state={st}
                    {...(r.special ? { 'data-special': '' } : {})}
                    {...(r.apex ? { 'data-apex': '' } : {})}
                    {...(isCur ? { 'aria-current': 'true' } : {})}
                  >
                    <span className="rank-prog__marker" aria-hidden="true">
                      <RIcon size={compact ? 15 : 18} weight={r.weight} />
                    </span>
                    <div className="rank-prog__card">
                      <div className="rank-prog__card-line">
                        <span className="rank-prog__name">{t(r.familyKey)}</span>
                        {r.code && <span className="rank-prog__code">{r.code}</span>}
                      </div>
                      <span className="rank-prog__rating">{r.min}+</span>
                      {isCur && <span className="rank-prog__tag">{t('rank.current')}</span>}
                      {r.apex && (
                        <span className="rank-prog__tag rank-prog__tag--apex">{t('rank.highest')}</span>
                      )}
                      {stateText && <span className="rank-prog__sr">{stateText}</span>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}

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

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useT } from '../i18n'
import { myStats } from '../api'
import { Icon } from './Icon'
import { RANKS, RANK_GROUPS, rankOf, nextRank, rankIndex, type RankTier } from '../ranks'
import './RankProgression.css'

export interface RankProgressionProps {
  /** Verilirse mevcut rütbe + ilerleme gösterilir (ör. 2125 → Master M2). */
  currentRating?: number
  /** Giriş yapan kullanıcının güncel pencere-PR'ı (düşük=iyi; null=yeterli veri yok). */
  currentPr?: number | null
  /** Giriş yapan kullanıcının toplam EP'si (tecrübe). */
  currentEp?: number
  /** Daha sıkı, küçük varyant (dar alanlar / yan panel). */
  compact?: boolean
  className?: string
}

/**
 * Üç şarta (rating ≥ min, PR ≤ prMax, EP ≥ epMin) göre oyuncunun HAK ETTİĞİ en yüksek
 * kademenin indexi. PR verisi yoksa (null) -> -2 (geçici/provisional). (Dikkat: null PR
 * ile `pr <= prMax` JS'de null→0 olduğundan HER eşiği yanlışlıkla geçer -> açıkça ele al.)
 */
function eligibleRankIndex(rating: number, pr: number | null, ep: number): number {
  if (pr === null) return -2
  let idx = 0
  for (let i = 0; i < RANKS.length; i++) {
    const r = RANKS[i]
    if (rating >= r.min && pr <= r.prMax && ep >= r.epMin) idx = i
  }
  return idx
}

// Rütbe/PR/EP eşiklerinde referans alınan kaynaklar (başlık+URL sabit; açıklama i18n).
const SOURCES: { title: string; url: string; descKey: string }[] = [
  {
    title: 'BMAB (Backgammon Masters Awarding Body)',
    url: 'https://bgmastersab.com/about',
    descKey: 'rank.src1',
  },
  {
    title: 'USBGF (United States Backgammon Federation)',
    url: 'https://usbgf.org/results/awards-recognition/backgammon-masters-awarding-body-bmab/',
    descKey: 'rank.src2',
  },
  {
    title: 'Austrian Backgammon Association',
    url: 'https://www.backgammon.or.at/prturniere/',
    descKey: 'rank.src3',
  },
  {
    title: 'GammonWorld',
    url: 'https://gammonworld.com/en/articles/what-are-bmab-and-xg-a-guide-to-pr-in-backgammon',
    descKey: 'rank.src4',
  },
  {
    title: 'BMAB Rating Sistemi',
    url: 'https://bgmastersab.com/europe/explain-ratings',
    descKey: 'rank.src5',
  },
]

export function RankProgression({
  currentRating,
  currentPr,
  currentEp,
  compact = false,
  className,
}: RankProgressionProps) {
  const { t, lang } = useT()
  const trackRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLLIElement>(null)
  const [fill, setFill] = useState(0)

  const hasCurrent = typeof currentRating === 'number'

  // PR/EP prop olarak verilmediyse (ör. Bilgi sayfası ranks sekmesi) ve kullanıcı giriş
  // yapmışsa (currentRating var) /me'den kendi pencere-PR + EP'sini çek -> "Senin Durumun"
  // kartı HER açılış yolunda (Info + RankInfo) görünsün.
  const [fetched, setFetched] = useState<{ pr: number | null; ep: number } | null>(null)
  useEffect(() => {
    if (currentRating === undefined) return
    if (currentPr !== undefined || currentEp !== undefined) return // prop geçildi -> fetch yok
    let on = true
    myStats()
      .then((s) => on && setFetched({ pr: s.rankWindowPr ?? null, ep: s.rankEp ?? 0 }))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [currentRating, currentPr, currentEp])

  // YENİ sistem durumu — prop öncelikli, yoksa /me'den çekilen değer.
  const effPr = currentPr !== undefined ? currentPr : fetched?.pr
  const effEp = currentEp !== undefined ? currentEp : fetched?.ep
  const hasStatus = hasCurrent && effEp !== undefined
  const prVal = typeof effPr === 'number' ? effPr : null
  const epVal = typeof effEp === 'number' ? effEp : 0
  const eligIdx = hasStatus ? eligibleRankIndex(currentRating as number, prVal, epVal) : -1
  const eligible = eligIdx >= 0 ? RANKS[eligIdx] : undefined // -2 = geçici (PR verisi yok)

  // "Mevcut rütbe" = EFEKTİF rütbe (rating+PR+EP) — site geneli rozetle/Senin Durumun ile AYNI.
  // Böylece özet + dikey merdiven işareti, yalnız-puana bakan rankOf ile çelişmez. Veri henüz
  // yoksa (fetch bekliyor / PR verisi yok -> eligible undefined) geçici olarak puan rütbesine düşer.
  const current = eligible ?? (hasCurrent ? rankOf(currentRating as number) : undefined)
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
  }, [hasCurrent, currentRating, currentIdx, compact])

  const stateOf = (r: RankTier): 'completed' | 'current' | 'upcoming' | 'default' => {
    if (!current) return 'default'
    const i = rankIndex(r)
    return i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'upcoming'
  }

  const fmt = (n: number) => n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')
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

      {/* Yeni sistem izahı: Puan + PR + EP, sade dille (üçü birden şartı). */}
      <div className="rank-prog__explain">
        <h3 className="rank-prog__explain-title">{t('rank.howTitle')}</h3>
        <p className="rank-prog__explain-intro">{t('rank.howIntro')}</p>
        <div className="rank-prog__concepts">
          {[
            { n: '1', title: t('rank.c1Title'), desc: t('rank.c1Desc') },
            { n: '2', title: t('rank.c2Title'), desc: t('rank.c2Desc') },
            { n: '3', title: t('rank.c3Title'), desc: t('rank.c3Desc') },
          ].map((c) => (
            <div className="rank-prog__concept" key={c.n}>
              <span className="rank-prog__concept-n">{c.n}</span>
              <div className="rank-prog__concept-body">
                <span className="rank-prog__concept-title">{c.title}</span>
                <span className="rank-prog__concept-desc">{c.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="rank-prog__explain-ex">{t('rank.howExample')}</p>
      </div>

      {/* Senin Durumun: mevcut rütbe + her kriter "senin / gereken" + bar + yönlendirme. */}
      {hasStatus && eligIdx === -2 && (
        <div className="rank-prog__status">
          <span className="rank-prog__status-title">{t('rank.statusTitle')}</span>
          <p className="rank-prog__status-prov">{t('rank.provisional')}</p>
        </div>
      )}
      {hasStatus &&
        eligible &&
        eligIdx >= 0 &&
        (() => {
          const EligIcon = eligible.Icon
          // Bir sonraki AİLE girişi (Master -> Grandmaster gibi büyük kilometre taşı; alt-tier değil).
          // Şartlar o ailenin GİRİŞ kademesine göredir (ör. Grandmaster = G3: 2150 / PR 4.00 / 400 EP).
          let nextFam: RankTier | undefined
          for (let i = eligIdx + 1; i < RANKS.length; i++) {
            if (RANKS[i].family !== eligible.family) {
              nextFam = RANKS[i]
              break
            }
          }
          const nextName = nextFam ? t(nextFam.familyKey) : ''
          const crit = nextFam
            ? [
                {
                  key: 'rating',
                  label: t('rank.scRating'),
                  mine: fmt(currentRating as number),
                  need: fmt(nextFam.min),
                  ok: (currentRating as number) >= nextFam.min,
                },
                {
                  key: 'pr',
                  label: t('rank.scPr'),
                  mine: prVal !== null ? prVal.toFixed(2) : t('rank.prNoData'),
                  need: nextFam.prMax.toFixed(2),
                  ok: prVal !== null && prVal <= nextFam.prMax,
                },
                {
                  key: 'ep',
                  label: t('rank.scEp'),
                  mine: `${fmt(epVal)} EP`,
                  need: `${fmt(nextFam.epMin)} EP`,
                  ok: epVal >= nextFam.epMin,
                },
              ]
            : []
          const hints: string[] = []
          if (nextFam) {
            if ((currentRating as number) < nextFam.min)
              hints.push(t('rank.hintRating', { r: nextName, n: fmt(nextFam.min) }))
            if (prVal === null || prVal > nextFam.prMax)
              hints.push(t('rank.hintPr', { r: nextName, n: nextFam.prMax.toFixed(2) }))
            if (epVal < nextFam.epMin)
              hints.push(t('rank.hintEp', { r: nextName, n: fmt(nextFam.epMin) }))
          }
          return (
            <div className="rank-prog__status">
              <div className="rank-prog__sc-head" data-family={eligible.family}>
                <span className="rank-prog__sc-icon">
                  <EligIcon size={24} stroke={2} />
                </span>
                <div className="rank-prog__sc-head-txt">
                  <span className="rank-prog__sc-rank">{t(eligible.familyKey)}</span>
                  <span className="rank-prog__sc-next">
                    {nextFam ? t('rank.nextTitle', { r: nextName }) : t('rank.maxed')}
                  </span>
                </div>
              </div>

              {crit.map((c) => (
                <div className="rank-prog__sc-row" key={c.key} data-tone={c.key}>
                  <div className="rank-prog__sc-line">
                    <span className="rank-prog__sc-label">{c.label}</span>
                    <span className="rank-prog__sc-right">
                      <span className="rank-prog__sc-val">
                        <b className="rank-prog__sc-mine">{c.mine}</b>
                        <span className="rank-prog__sc-need"> / {c.need}</span>
                      </span>
                      <span className="rank-prog__sc-check" data-ok={c.ok ? 'true' : 'false'}>
                        <Icon name={c.ok ? 'check' : 'x'} size={12} />
                        <span className="rank-prog__sr">
                          {c.ok ? t('rank.met') : t('rank.notMet')}
                        </span>
                      </span>
                    </span>
                  </div>
                  <div className="rank-prog__sc-bar" data-ok={c.ok ? 'true' : 'false'}>
                    <span />
                  </div>
                </div>
              ))}

              {hints.length > 0 && <p className="rank-prog__sc-hint">{hints.join(' ')}</p>}
            </div>
          )
        })()}

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
                      <RIcon size={compact ? 15 : 18} stroke={r.stroke} />
                    </span>
                    <div className="rank-prog__card">
                      <div className="rank-prog__card-line">
                        <span className="rank-prog__name">{t(r.familyKey)}</span>
                        {r.code && <span className="rank-prog__code">{r.code}</span>}
                      </div>
                      <span className="rank-prog__rating">{r.min}+</span>
                      {/* 3 şart: rating zaten {min}+; PR üst sınırı + EP alt sınırı. */}
                      {(Number.isFinite(r.prMax) || r.epMin > 0) && (
                        <span className="rank-prog__req-line">
                          {Number.isFinite(r.prMax) && (
                            <span className="rank-prog__req-pill rank-prog__req-pill--pr">
                              {t('rank.reqPrMax', { n: r.prMax })}
                            </span>
                          )}
                          {r.epMin > 0 && (
                            <span className="rank-prog__req-pill rank-prog__req-pill--ep">
                              {t('rank.reqEpMin', { n: r.epMin })}
                            </span>
                          )}
                        </span>
                      )}
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

      {/* Kaynaklar — rütbe/PR/EP eşiklerinde referans alınan uluslararası kaynaklar. */}
      <div className="rank-prog__sources">
        <h3 className="rank-prog__sources-title">{t('rank.refTitle')}</h3>
        <p className="rank-prog__sources-intro">{t('rank.refIntro')}</p>
        <ol className="rank-prog__sources-list">
          {SOURCES.map((s, i) => (
            <li className="rank-prog__source" key={s.url}>
              <a
                className="rank-prog__source-link"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="rank-prog__source-n">{i + 1}</span>
                <span className="rank-prog__source-name">{s.title}</span>
                <span className="rank-prog__source-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
              <span className="rank-prog__source-desc">{t(s.descKey)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/**
 * BAHANE MAKİNESİ — "The Price Is Right / Big Wheel" tarzı DEV DİKEY MEKANİK TAMBUR.
 *
 * Yuvarlak fortune-wheel / slot / carousel DEĞİL: yatay eksen etrafında dönen fiziksel
 * bir silindir. Ön yüzünde üst üste bahane panelleri; ortadaki panel tam karşıdan bakar
 * (en büyük/parlak/net), üst-alt paneller tamburun arkasına kıvrılır (perspective + rotateX
 * + translateZ + scale + opacity). Aynı anda ~7 panel görünür; 100 bahanenin tamamı DOM'a
 * basılmaz — merkez pozisyonu (position) etrafında kayan pencere (virtual window) render edilir.
 *
 * SONUÇ ÖNCE seçilir (pickRandomExcuse; arka arkaya tekrar engellenir), animasyon o panelde
 * bitecek şekilde hesaplanır -> çarkın durduğu bahane ile sonuç kartı DAİMA aynıdır.
 *
 * Salt eğlence: coin/ödül/kumar YOK, giriş gerektirmez.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
import { RARITY_COLORS } from './rarityColors'
import { isMuted } from '../sound'
import { getExcuses, pickRandomExcuse, type Excuse } from '../data/excuses'
import './ExcuseMachine.css'

interface Props {
  onClose: () => void
}

// --- Tambur geometrisi (JS 3D matematiği CSS panel yüksekliği --em-panel-h ile eşleşir) ---
const PANEL_ANGLE = 20 // komşu paneller arası açı (derece)
const HALF_WINDOW = 3 // merkez ± bu kadar panel render edilir (toplam 7)
const PANEL_H = 82 // px — CSS .em-panel yüksekliği ile BİREBİR aynı olmalı
// Silindir yarıçapı: komşu paneller kenar-kenara gelsin diye.
const RADIUS = Math.round(PANEL_H / (2 * Math.tan((PANEL_ANGLE * Math.PI) / 180 / 2)))

const SPIN_MS = 3000 // toplam dönme (ana + oturma)
const SETTLE_MS = 640 // son oturma fazı
const OVERSHOOT = 0.42 // panel birimi — küçük aşım, sonra tam yerine oturur
const REDUCED_MS = 360 // prefers-reduced-motion: kısa sade geçiş
const TURNS = 5 // sonuç öncesi tam tur sayısı (momentum hissi)

const wrapIndex = (i: number, n: number) => ((i % n) + n) % n

const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4)
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2

// Çok hafif mekanik "tak" — global ses kapalıysa (isMuted) hiç çalmaz, hata üretmez.
let audioCtx: AudioContext | null = null
function tick(kind: 'click' | 'done') {
  if (isMuted()) return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!audioCtx) audioCtx = new AC()
    const ctx = audioCtx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = kind === 'done' ? 'triangle' : 'square'
    osc.frequency.value = kind === 'done' ? 520 : 1400
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(kind === 'done' ? 0.08 : 0.025, ctx.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'done' ? 0.18 : 0.04))
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (kind === 'done' ? 0.2 : 0.05))
  } catch {
    /* ses opsiyonel — sessiz geç */
  }
}

function haptic(ms: number) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* haptik opsiyonel */
  }
}

export default function ExcuseMachine({ onClose }: Props) {
  const { t } = useT()
  const toast = useToast()
  useEscape(onClose)

  const reel = useMemo(() => getExcuses(), [])
  const N = reel.length

  const [pos, setPos] = useState(0) // fraksiyonel merkez pozisyonu (reel index birimi)
  const [spinning, setSpinning] = useState(false)
  const [fast, setFast] = useState(false) // yüksek hız -> hafif motion-blur
  const [result, setResult] = useState<Excuse | null>(null)
  const [pulse, setPulse] = useState(0) // sonuç highlight tetikleyici (key)

  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const spinningRef = useRef(false)
  const fastRef = useRef(false)
  const lastIdRef = useRef<number | undefined>(undefined)
  const lastCenterRef = useRef(0)

  const reduced = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  // Bileşen sökülürse bekleyen animasyon karesini temizle.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const wrap = useCallback((i: number) => wrapIndex(i, N), [N])

  const setFastFlag = useCallback((v: boolean) => {
    fastRef.current = v
    setFast(v)
  }, [])

  // from -> to arası tek tween (rAF timestamp tabanlı; Date kullanmaz).
  const tween = useCallback(
    (from: number, to: number, dur: number, ease: (x: number) => number, onDone?: () => void) => {
      let startTs: number | null = null
      const step = (ts: number) => {
        if (startTs == null) startTs = ts
        const p = dur <= 0 ? 1 : Math.min(1, (ts - startTs) / dur)
        const v = from + (to - from) * ease(p)
        posRef.current = v
        setPos(v)
        // Oturma fazında (hızlı değilken) merkez değişince hafif "tak" + minik titreşim.
        const center = Math.round(v)
        if (center !== lastCenterRef.current) {
          lastCenterRef.current = center
          if (!fastRef.current) tick('click')
        }
        if (p < 1) {
          rafRef.current = requestAnimationFrame(step)
        } else {
          posRef.current = to
          setPos(to)
          onDone?.()
        }
      }
      rafRef.current = requestAnimationFrame(step)
    },
    [],
  )

  const finish = useCallback((chosen: Excuse) => {
    spinningRef.current = false
    setSpinning(false)
    setFastFlag(false)
    setResult(chosen)
    setPulse((k) => k + 1)
    tick('done')
    haptic(12)
  }, [setFastFlag])

  const spin = useCallback(() => {
    if (spinningRef.current || N === 0) return
    spinningRef.current = true
    setSpinning(true)
    setResult(null)

    const chosen = pickRandomExcuse(lastIdRef.current)
    lastIdRef.current = chosen.id
    const targetIndex = reel.findIndex((e) => e.id === chosen.id)

    const base = posRef.current
    // base'in hemen üstünde targetIndex ile denk (mod N) ilk konumu bul.
    let raw = wrap(targetIndex)
    while (raw <= base + 0.5) raw += N

    if (reduced.current) {
      // Sade kısa geçiş: uzun spin yok.
      tween(base, raw, REDUCED_MS, easeInOutSine, () => finish(chosen))
      return
    }

    const target = raw + TURNS * N
    setFastFlag(true)
    // Ana faz: hız + yavaşlama, hedefi hafifçe aş (overshoot).
    tween(base, target + OVERSHOOT, SPIN_MS - SETTLE_MS, easeOutQuart, () => {
      setFastFlag(false)
      // Oturma fazı: küçük geri dönüşle tam yerine otur (tık-tık hissi).
      tween(target + OVERSHOOT, target, SETTLE_MS, easeOutCubic, () => finish(chosen))
    })
  }, [N, reel, wrap, tween, finish, setFastFlag])

  async function copyResult() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.text)
      toast.success(t('exc.copied'))
    } catch {
      toast.error(t('exc.copyFail'))
    }
  }

  // Görünür pencere: merkez etrafında ±HALF_WINDOW panel.
  const centerIdx = Math.round(pos)
  const panels: { key: number; excuse: Excuse; offset: number }[] = []
  for (let i = centerIdx - HALF_WINDOW; i <= centerIdx + HALF_WINDOW; i++) {
    panels.push({ key: i, excuse: reel[wrap(i)], offset: i - pos })
  }

  const rarityColor = result ? RARITY_COLORS[result.rarity] : undefined

  return (
    <div className="register-overlay modal page em-overlay" role="dialog" aria-modal="true" aria-label={t('exc.title')}>
      <div className="register-card em-card" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="modal-close em-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={18} />
        </Button>

        <div className="em-stage">
          <header className="em-head">
            <h2 className="em-title">{t('exc.title')}</h2>
            <p className="em-subtitle">{t('exc.subtitle')}</p>
          </header>

          {/* --- DEV MEKANİK TAMBUR --- */}
          <div className="em-machine">
            <div className="em-pointer" aria-hidden="true" />
            <div className="em-frame">
              <div className="em-viewport" style={{ ['--em-panel-h' as string]: `${PANEL_H}px` }}>
                <div className={`em-drum${fast ? ' is-fast' : ''}`} style={{ transform: `translateZ(${-RADIUS}px)` }}>
                  {panels.map(({ key, excuse, offset }) => {
                    const abs = Math.abs(offset)
                    if (abs > HALF_WINDOW + 0.2) return null
                    const opacity = Math.max(0, 1 - abs * 0.26)
                    const isCenter = abs < 0.5
                    return (
                      <div
                        key={key}
                        className={`em-panel${isCenter ? ' is-center' : ''}`}
                        style={{
                          transform: `rotateX(${-offset * PANEL_ANGLE}deg) translateZ(${RADIUS}px)`,
                          opacity,
                          zIndex: 100 - Math.round(abs),
                        }}
                        aria-hidden={!isCenter}
                      >
                        <span className="em-panel-text">{excuse.text}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="em-selector" aria-hidden="true" />
              <div className="em-glare" aria-hidden="true" />
            </div>

            {/* Ekran okuyucu: seçilen bahaneyi duyur */}
            <div className="sr-only" aria-live="polite">
              {result ? `${t('exc.resultTitle')}: ${result.text}` : ''}
            </div>
          </div>

          <div className="em-controls">
            <Button className="em-spin" onClick={spin} disabled={spinning} aria-busy={spinning}>
              {spinning ? t('exc.spinning') : t('exc.spin')}
            </Button>
          </div>

          {/* --- SONUÇ --- */}
          {result && !spinning && (
            <div className="em-result" key={pulse}>
              <div className="em-result-label">{t('exc.resultTitle')}</div>
              <p className="em-result-text">{result.text}</p>
              <div className="em-result-rarity" style={{ color: rarityColor, borderColor: rarityColor }}>
                <span className="em-rarity-dot" style={{ background: rarityColor }} />
                {t(`rarity.${result.rarity}`)}
              </div>
              <div className="em-result-actions">
                <Button variant="secondary" onClick={copyResult}>
                  <Icon name="copy" size={16} />
                  {t('exc.copy')}
                </Button>
                <Button onClick={spin} disabled={spinning}>
                  <Icon name="refresh" size={16} />
                  {t('exc.again')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

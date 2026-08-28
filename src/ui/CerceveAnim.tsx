import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import SoberFrame, { type SoberMotion } from './SoberFrame'
import './CerceveAnim.css'

// Animasyon katalogu (/cerceve-anim): TEK renk (Rose Gold) ile yapilabilir TUM animasyonlar,
// adlariyla + toplam sayi. Her animasyon bir kez. Merkez seffaf, halka donmez (donme grubu haric).
const ROSE = '#B76E79' // rose gold

const CATALOG: { group: string; items: [SoberMotion, string][] }[] = [
  { group: 'Glow / Işık', items: [
    ['breathe', 'Nefes'], ['glowPulse', 'Glow Nabız'], ['flicker', 'Titreme'], ['heartbeat', 'Kalp Atışı'],
    ['fade', 'Solma'], ['ember', 'Köz'], ['flash', 'Flaş'], ['hover', 'Hover Glow (üstüne gel)'],
  ] },
  { group: 'Ölçek / Hareket', items: [
    ['pulse', 'Nabız'], ['pulseFast', 'Hızlı Nabız'], ['throb', 'Zonklama'], ['float', 'Süzülme'],
    ['floatSide', 'Yan Süzülme'], ['levitate', 'Havalanma'], ['bounce', 'Zıplama'], ['jelly', 'Jöle'],
    ['gelatine', 'Jelatin'], ['heartScale', 'Kalp Ölçek'], ['nudge', 'Dürtme'], ['vibrate', 'Titreşim'],
    ['shiver', 'Ürperme'], ['pop', 'Pop'], ['squash', 'Ezilme'], ['expand', 'Genişleme'],
    ['rubber', 'Lastik'], ['headShake', 'Kafa Sallama'], ['twist', 'Bükülme'], ['skewPulse', 'Eğim Nabız'],
    ['tada', 'Tada'], ['circleMove', 'Daire Gezinme'], ['figure8', 'Sekiz'], ['diagonal', 'Çapraz'],
    ['zoomBlur', 'Zoom Bulanık'],
  ] },
  { group: 'Dönme', items: [
    ['sway', 'Sallanma'], ['wobble', 'Yalpa'], ['tilt', 'Eğilme'], ['rock', 'Beşik'], ['pendulum', 'Sarkaç'],
    ['swing', 'Salınım (Bell)'], ['spin', 'Dönüş'], ['spinSlow', 'Yavaş Dönüş'], ['spinPulse', 'Dönen Nabız'],
    ['barrelRoll', 'Takla'], ['wiggle', 'Kıpırtı'],
  ] },
  { group: '3D', items: [
    ['flip3d', '3D Y Çevirme'], ['flipX', '3D X Çevirme'], ['coinFlip', 'Yazı-Tura'], ['tumble', 'Yuvarlanma'],
    ['spinY3d', '3D Y Dönüş'], ['spinX3d', '3D X Dönüş'], ['seesaw', 'Tahterevalli'], ['gyro', 'Jiroskop'],
  ] },
  { group: 'Şekil / Morph', items: [['blob', 'Blob (Morph)']] },
  { group: 'SVG (Stroke)', items: [
    ['drawRing', 'Çizilen Halka'], ['dashSpin', 'Dönen Kesikli'], ['dashFlow', 'Akan Kesikli'],
  ] },
  { group: 'Halka Işık', items: [['sheen', 'Işık Kayması'], ['shimmer', 'Parıltı'], ['drift', 'Kayma']] },
  { group: 'Filtre', items: [
    ['hueCycle', 'Renk Döngüsü'], ['rainbow', 'Gökkuşağı'], ['hueWobble', 'Renk Salınımı'], ['saturate', 'Doygunluk'],
    ['bright', 'Parlaklık'], ['contrast', 'Kontrast'], ['invert', 'Ters (Invert)'], ['blur', 'Bulanıklık'],
    ['grayscale', 'Gri Tonlama'], ['sepia', 'Sepya'], ['dropGlow', 'Drop Glow'], ['shineOnce', 'Parlama'],
    ['bloom', 'Bloom'], ['duotone', 'Duotone'],
  ] },
  { group: 'Işık Turu (Sweep)', items: [
    ['sweep', 'Işık Turu'], ['sweepRev', 'Ters Tur'], ['sweepFast', 'Hızlı Tur'], ['dualSweep', 'Çift Tur'],
    ['trace', 'İz Sürme'], ['pulseSweep', 'Nabızlı Tur'], ['glint', 'Işıltı (Glint)'], ['loading', 'Yükleniyor'],
  ] },
  { group: 'Gradient Halka', items: [
    ['gradSpin', 'Dönen Gradient'], ['gradPulse', 'Gradient Nabız'], ['conicRainbow', 'Konik Gökkuşağı'], ['gradWave', 'Gradient Dalga'],
  ] },
  { group: 'Sparkle', items: [
    ['sparkle', 'Tekil Parıltı'], ['twinkle', 'Yıldızlar'], ['sparkleBurst', 'Parıltı Patlaması'],
    ['rising', 'Yükselen Parıltı'], ['rain', 'Parıltı Yağmuru'], ['fireflies', 'Ateş Böceği'],
  ] },
  { group: 'Yörünge', items: [['orbit', 'Yörünge'], ['comet', 'Kuyruklu Yıldız'], ['dualOrbit', 'Çift Yörünge']] },
  { group: 'Aura / Dalga', items: [
    ['aura', 'Yumuşak Aura'], ['auraPulse', 'Aura Nabız'], ['ripple', 'Dalga'], ['radar', 'Radar'],
    ['dualRipple', 'Çift Dalga'], ['ringPulse', 'Halka Nabız'], ['haloSpin', 'Dönen Hale'],
    ['neonPulse', 'Neon Nabız'], ['glowSpread', 'Glow Yayılma'], ['pulseHalo', 'Hale Nabız'], ['sonar', 'Sonar'],
  ] },
]

const TOTAL = CATALOG.reduce((n, g) => n + g.items.length, 0)
const NAME_BY_KEY: Record<string, string> = Object.fromEntries(
  CATALOG.flatMap((g) => g.items.map(([k, n]) => [k, n])),
)
const LS_KEY = 'cerceve-anim-favs'
const SIZES = [80, 104, 128] as const

export default function CerceveAnim({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [size, setSize] = useState<number>(104)
  const [sel, setSel] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })
  const [copied, setCopied] = useState(false)
  const persist = (s: Set<string>) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify([...s]))
    } catch {
      /* yok say */
    }
  }
  const toggle = (key: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      persist(n)
      return n
    })
  const clearAll = () => {
    setSel(new Set())
    persist(new Set())
  }
  const copyList = () => {
    const text = [...sel].map((k) => `${NAME_BY_KEY[k] || k} (${k})`).join(', ')
    try {
      navigator.clipboard?.writeText(text)
    } catch {
      /* yok say */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="ca-wrap" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>

        <div className="ca-head">
          <h2>Rose Gold — Tüm Animasyonlar</h2>
          <div className="ca-count">{TOTAL} farklı animasyon</div>
          <p>
            Tek renk (Rose Gold) ile yapılabilir tüm animasyonlar, adlarıyla. İnce halka · merkez şeffaf
            (yüz kapanmaz) · yalnız “Dönme / Sweep / Yörünge” gruplarında dönen öğe var. Beğendiğini yaz
            (animasyon adı), gerçek çerçeveye uygularım.
          </p>
          <div className="ca-seg">
            {SIZES.map((s) => (
              <button key={s} className={`ca-segbtn ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}>
                {s}px
              </button>
            ))}
          </div>
        </div>

        <div className="ca-bar">
          <span className="ca-barcount">{sel.size} seçili</span>
          <div className="ca-chips">
            {sel.size === 0 ? (
              <span className="ca-empty">Beğendiğin kareye tıkla → işaretlensin. Seçtiklerin burada listelenir.</span>
            ) : (
              [...sel].map((k) => (
                <button key={k} type="button" className="ca-chip" onClick={() => toggle(k)} title="Kaldır">
                  {NAME_BY_KEY[k] || k} ✕
                </button>
              ))
            )}
          </div>
          <button type="button" className="ca-barbtn" onClick={copyList} disabled={sel.size === 0}>
            {copied ? '✓ Kopyalandı' : 'Kopyala'}
          </button>
          <button type="button" className="ca-barbtn ca-barclear" onClick={clearAll} disabled={sel.size === 0}>
            Temizle
          </button>
        </div>

        {CATALOG.map((g) => (
          <section key={g.group} className="ca-sec">
            <h3>{g.group} · {g.items.length}</h3>
            <div className="ca-grid">
              {g.items.map(([motion, name]) => (
                <button
                  key={motion}
                  type="button"
                  className={`ca-cell ${sel.has(motion) ? 'sel' : ''}`}
                  onClick={() => toggle(motion)}
                  aria-pressed={sel.has(motion)}
                  title="Beğendiysen tıkla → işaretle"
                >
                  <div className="ca-stage" style={{ height: size + 12 }}>
                    <span className="ca-tick" aria-hidden="true">✓</span>
                    <SoberFrame accent={ROSE} motion={motion} size={size} />
                  </div>
                  <div className="ca-name">{name}</div>
                  <div className="ca-note">{motion}</div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

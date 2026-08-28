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
    ['fade', 'Solma'], ['ember', 'Köz'], ['hover', 'Hover Glow (üstüne gel)'],
  ] },
  { group: 'Ölçek / Hareket', items: [
    ['pulse', 'Nabız'], ['float', 'Süzülme'], ['levitate', 'Havalanma'], ['bounce', 'Zıplama'],
    ['jelly', 'Jöle'], ['heartScale', 'Kalp Ölçek'], ['nudge', 'Dürtme'],
  ] },
  { group: 'Dönme', items: [
    ['sway', 'Sallanma'], ['wobble', 'Yalpa'], ['tilt', 'Eğilme'], ['rock', 'Beşik'],
    ['pendulum', 'Sarkaç'], ['spin', 'Dönüş'], ['spinSlow', 'Yavaş Dönüş'], ['flip3d', '3D Çevirme'],
  ] },
  { group: 'Halka Işık', items: [['sheen', 'Işık Kayması'], ['shimmer', 'Parıltı'], ['drift', 'Kayma']] },
  { group: 'Filtre', items: [
    ['hueCycle', 'Renk Döngüsü'], ['saturate', 'Doygunluk'], ['bright', 'Parlaklık'],
    ['contrast', 'Kontrast'], ['invert', 'Ters (Invert)'], ['blur', 'Bulanıklık'],
  ] },
  { group: 'Işık Turu (Sweep)', items: [
    ['sweep', 'Işık Turu'], ['sweepRev', 'Ters Tur'], ['sweepFast', 'Hızlı Tur'],
    ['dualSweep', 'Çift Tur'], ['trace', 'İz Sürme'],
  ] },
  { group: 'Gradient Halka', items: [['gradSpin', 'Dönen Gradient'], ['gradPulse', 'Gradient Nabız']] },
  { group: 'Sparkle', items: [['sparkle', 'Tekil Parıltı'], ['twinkle', 'Yıldızlar'], ['sparkleBurst', 'Parıltı Patlaması']] },
  { group: 'Yörünge', items: [['orbit', 'Yörünge'], ['comet', 'Kuyruklu Yıldız'], ['dualOrbit', 'Çift Yörünge']] },
  { group: 'Aura / Dalga', items: [
    ['aura', 'Yumuşak Aura'], ['auraPulse', 'Aura Nabız'], ['ripple', 'Dalga'], ['radar', 'Radar'], ['dualRipple', 'Çift Dalga'],
  ] },
]

const TOTAL = CATALOG.reduce((n, g) => n + g.items.length, 0)
const SIZES = [80, 104, 128] as const

export default function CerceveAnim({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [size, setSize] = useState<number>(104)

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

        {CATALOG.map((g) => (
          <section key={g.group} className="ca-sec">
            <h3>{g.group} · {g.items.length}</h3>
            <div className="ca-grid">
              {g.items.map(([motion, name]) => (
                <div key={motion} className="ca-cell">
                  <div className="ca-stage" style={{ height: size + 12 }}>
                    <SoberFrame accent={ROSE} motion={motion} size={size} />
                  </div>
                  <div className="ca-name">{name}</div>
                  <div className="ca-note">{motion}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

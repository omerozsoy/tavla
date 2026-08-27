import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import PremiumFrame, { type PremiumRarity } from './PremiumFrame'

// Avatar frame prototip demo alani: Epic / Legendary / Mythic yan yana,
// farkli boyutlar + normal/hover/animasyonlu. (Onay icin — henuz sisteme baglanmadi.)

const SAMPLE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#3b4a6b"/><stop offset="1" stop-color="#0d1120"/></radialGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="82" r="34" fill="#c9d4e8"/><path d="M40 180c0-38 28-58 60-58s60 20 60 58z" fill="#c9d4e8"/></svg>`,
  )

const FRAMES: { rarity: PremiumRarity; name: string; theme: string; desc: string }[] = [
  {
    rarity: 'epic',
    name: 'Epic',
    theme: 'Arcane Energy',
    desc: 'Menekşe/camgöbeği enerji · dolaşan ışık arkı · rün kristalleri · çift katman metal',
  },
  {
    rarity: 'legendary',
    name: 'Legendary',
    theme: 'Royal Gold',
    desc: 'Metalik altın bevel · taç + yakut aksanlar · yavaş specular ışık süpürmesi',
  },
  {
    rarity: 'mythic',
    name: 'Mythic',
    theme: 'Cosmic / Celestial',
    desc: 'Konik kozmik enerji halkası · yıldız partikülleri · enerji wisp · yörünge',
  },
]

const SIZES = [48, 64, 80, 96, 128] as const

export default function FrameDemo({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [dark, setDark] = useState(true)

  return (
    <div className="register-overlay modal page">
      <div className={`fd-wrap ${dark ? 'fd-dark' : 'fd-light'}`} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <div className="fd-head">
          <h2>Avatar Çerçeveleri — Prototip</h2>
          <p>3 üst düzey tasarım. Fareyle üzerine gel → hover efekti. (Onay bekliyor)</p>
          <button className="menu-btn fd-bgtoggle" onClick={() => setDark((d) => !d)}>
            {dark ? 'Açık zemin' : 'Koyu zemin'}
          </button>
        </div>

        <div className="fd-grid">
          {FRAMES.map((f) => (
            <div key={f.rarity} className="fd-card">
              <div className={`fd-tag fd-tag-${f.rarity}`}>{f.name}</div>
              <div className="fd-theme">{f.theme}</div>

              <div className="fd-hero">
                <PremiumFrame rarity={f.rarity} src={SAMPLE} size={160} />
              </div>

              <div className="fd-sizes">
                {SIZES.map((s) => (
                  <div key={s} className="fd-size">
                    <PremiumFrame rarity={f.rarity} src={SAMPLE} size={s} />
                    <span>{s}px</span>
                  </div>
                ))}
              </div>

              <p className="fd-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

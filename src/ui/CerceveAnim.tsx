import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import SoberFrame, { type SoberMotion, type SoberRarity } from './SoberFrame'
import './CerceveAnim.css'

// Animasyon secim demosu (/cerceve-anim): sade-premium cerceve icin ELDEKI TUM sade animasyonlar,
// her rarity'de, altinda animasyon ismi yazili. Kullanici icinden secer -> nihai PremiumFrame'e uygulanir.

const ANIMS: { key: SoberMotion; name: string; note: string }[] = [
  { key: 'static', name: 'Statik', note: 'hareket yok' },
  { key: 'hover', name: 'Hover Glow', note: 'üstüne gel' },
  { key: 'breathe', name: 'Nefes · Breathe', note: 'glow yavaş nefes' },
  { key: 'pulse', name: 'Nabız · Pulse', note: 'hafif ölçek' },
  { key: 'sheen', name: 'Işık Kayması · Sheen', note: 'yavaş ışık' },
  { key: 'shimmer', name: 'Shimmer · Metalik', note: 'hızlı parıltı' },
  { key: 'sweep', name: 'Işık Turu · Sweep', note: 'parlak nokta döner' },
  { key: 'sparkle', name: 'Sparkle · Tekil', note: 'seyrek yıldız' },
  { key: 'twinkle', name: 'Twinkle · Yıldızlar', note: '3 yıldız' },
  { key: 'aura', name: 'Yumuşak Aura', note: 'dış aura nefesi' },
  { key: 'glowPulse', name: 'Glow Nabız', note: 'glow yayılır' },
  { key: 'float', name: 'Süzülme · Float', note: 'hafif yukarı-aşağı' },
]

const RARITIES: { key: SoberRarity; label: string }[] = [
  { key: 'rare', label: 'RARE — Steel Blue' },
  { key: 'epic', label: 'EPIC — Amethyst' },
  { key: 'legendary', label: 'LEGENDARY — Champagne Gold' },
  { key: 'mythic', label: 'MYTHIC — Bordeaux' },
]

const ACCENTS: [string, string][] = [
  ['Inferno', '#B4542E'], ['Emerald', '#2E7D57'], ['Diamond', '#6FA8C7'], ['Ruby', '#9B2C3A'],
  ['Galaxy', '#6D5AA6'], ['Sapphire', '#3B6FA0'], ['Amber', '#B8862B'], ['Onyx', '#4A4A55'],
]

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
          <h2>Çerçeve Animasyon Seçimi</h2>
          <p>
            Sade-premium çerçeve için elimdeki <b>tüm animasyonlar</b>, her rarity'de — altında ismi
            yazılı. İnce halka · merkez şeffaf (yüz kapanmaz) · halka dönmez (yalnız “Sweep”te ışık
            döner) · neon/particle yok. Beğendiğini söyle (rarity + animasyon adı), gerçek PremiumFrame'e
            onu uygularım.
          </p>
          <div className="ca-seg">
            {SIZES.map((s) => (
              <button key={s} className={`ca-segbtn ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}>
                {s}px
              </button>
            ))}
          </div>
        </div>

        {RARITIES.map((r) => (
          <section key={r.key} className="ca-sec">
            <h3>{r.label}</h3>
            <div className="ca-grid">
              {ANIMS.map((a) => (
                <div key={a.key} className="ca-cell">
                  <div className="ca-stage" style={{ height: size + 12 }}>
                    <SoberFrame rarity={r.key} motion={a.key} size={size} />
                  </div>
                  <div className="ca-name">{a.name}</div>
                  <div className="ca-note">{a.note}</div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="ca-sec">
          <h3>“24 farklı ama sade” — mat aksan örnekleri (Nefes animasyonu ile)</h3>
          <div className="ca-grid">
            {ACCENTS.map(([name, c]) => (
              <div key={name} className="ca-cell">
                <div className="ca-stage" style={{ height: size + 12 }}>
                  <SoberFrame accent={c} motion="breathe" size={size} />
                </div>
                <div className="ca-name">{name}</div>
                <div className="ca-note">mat aksan</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

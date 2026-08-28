import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import SoberFrame, { type SoberMotion } from './SoberFrame'
import './CerceveAnim.css'

// Animasyon + renk secim demosu (/cerceve-anim). Her animasyon icin 20 renk (UI/UX Pro Max
// paletlerinden), altinda renk adi. Animasyonlar bilerek ABARTILI (secim icin net gorunsun).
// Renkler = UI/UX Pro Max product palette accent/primary tonlari.
const COLORS: [string, string][] = [
  ['Antique Gold', '#A16207'], ['Rose Red', '#E11D48'], ['Coral', '#FB7185'], ['Royal Blue', '#2563EB'],
  ['Indigo', '#6366F1'], ['Periwinkle', '#818CF8'], ['Emerald', '#059669'], ['Burnt Orange', '#EA580C'],
  ['Amber', '#F59E0B'], ['Gold', '#FBBF24'], ['Violet', '#8B5CF6'], ['Forest', '#15803D'],
  ['Ochre', '#D97706'], ['Magenta', '#DB2777'], ['Pink', '#F472B6'], ['Teal', '#0891B2'],
  ['Cyan', '#22D3EE'], ['Orange', '#F97316'], ['Apricot', '#FB923C'], ['Deep Indigo', '#4F46E5'],
] // 20 renk

const SECTIONS: { motion: SoberMotion; title: string }[] = [
  { motion: 'static', title: 'Statik' },
  { motion: 'sweep', title: 'Işık Turu · Sweep' },
  { motion: 'glowPulse', title: 'Glow Nabız' },
  { motion: 'aura', title: 'Yumuşak Aura' },
  { motion: 'pulse', title: 'Nabız · Pulse' },
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
          <h2>Çerçeve Animasyon + Renk Seçimi</h2>
          <p>
            5 animasyon × 20 renk (UI/UX Pro Max paletleri). İnce halka · merkez şeffaf · halka
            dönmez (yalnız “Sweep”te ışık döner). Animasyonlar burada <b>bilerek abartılı</b> — net
            görün diye; seçtiğinde gerçek çerçevede çok daha <b>sade</b> olacak. Beğendiğini yaz
            (animasyon + renk adı).
          </p>
          <div className="ca-seg">
            {SIZES.map((s) => (
              <button key={s} className={`ca-segbtn ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}>
                {s}px
              </button>
            ))}
          </div>
        </div>

        {SECTIONS.map((sec) => (
          <section key={sec.motion} className="ca-sec">
            <h3>{sec.title} — 20 Renk</h3>
            <div className="ca-grid">
              {COLORS.map(([name, hex]) => (
                <div key={sec.motion + hex} className="ca-cell">
                  <div className="ca-stage" style={{ height: size + 12 }}>
                    <SoberFrame accent={hex} motion={sec.motion} size={size} />
                  </div>
                  <div className="ca-name">{name}</div>
                  <div className="ca-note">{hex}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import RiveLayer from './RiveLayer'
import './CerceveLab.css'

// Rive avatar cerceve LABORATUVARI (/cerceve-lab). Gercek binary .riv dosyalari
// (create->render->critique dongusuyle uretildi) RiveLayer uzerinden canli calisir.
// Her frame: Idle / Hover / Selected / Celebrate + boyut secici (48-128px) + reduced-motion.
// Sahne merkezi seffaftir (avatar deligi %72); avatar foto Rive katmaninin ALTINDA render edilir.
import epicRiv from '../assets/rive/avatar-frames/epic.riv'
import legendaryRiv from '../assets/rive/avatar-frames/legendary.riv'
import mythicRiv from '../assets/rive/avatar-frames/mythic.riv'

// Ornek avatar (yuz merkezde -> deligin yuzu kapatmadigini gorursun)
const SAMPLE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#3b4a6b"/><stop offset="1" stop-color="#0d1120"/></radialGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="84" r="33" fill="#c9d4e8"/><path d="M42 178c0-36 27-56 58-56s58 20 58 56z" fill="#c9d4e8"/></svg>`,
  )

type FrameDef = {
  key: string
  src: string
  artboard: string
  name: string
  theme: string
  desc: string
  tone: 'epic' | 'legendary' | 'mythic'
}

const FRAMES: FrameDef[] = [
  {
    key: 'epic',
    src: epicRiv,
    artboard: 'Epic',
    name: 'Epic',
    theme: 'Arcane',
    desc: '8-köşeli arcane mühür · ayrık iç/dış halka · 4 rün + köşe kristalleri · dolaşan enerji arkı (comet)',
    tone: 'epic',
  },
  {
    key: 'legendary',
    src: legendaryRiv,
    artboard: 'Legendary',
    name: 'Legendary',
    theme: 'Royal Gold',
    desc: 'Beveled gerçek altın · taç motifi + yakut · yan filigran + köşe stud · yavaş specular süpürme + sparkle',
    tone: 'legendary',
  },
  {
    key: 'mythic',
    src: mythicRiv,
    artboard: 'Mythic',
    name: 'Mythic',
    theme: 'Celestial Void',
    desc: '3 eşmerkezli katman · zıt dönen kopuk yaylar · 3 yüzen shard · yıldız alanı + twinkle · renk-kayan void + aura',
    tone: 'mythic',
  },
]

const SIZES = [48, 64, 96, 128] as const

type PerFrame = { hover: boolean; selected: boolean; celebrate: number }

export default function CerceveLab({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [size, setSize] = useState<number>(128)
  const [reduced, setReduced] = useState(false)
  const [intensity, setIntensity] = useState(100)
  const [dark, setDark] = useState(true)
  const [state, setState] = useState<Record<string, PerFrame>>(() =>
    Object.fromEntries(FRAMES.map((f) => [f.key, { hover: false, selected: false, celebrate: 0 }])),
  )

  const patch = (k: string, p: Partial<PerFrame>) =>
    setState((s) => ({ ...s, [k]: { ...s[k], ...p } }))

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className={`cl-wrap ${dark ? 'cl-dark' : 'cl-light'}`} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>

        <div className="cl-head">
          <h2>Çerçeve Lab — Rive</h2>
          <p>
            Gerçek <code>.riv</code> dosyaları (RiveLayer üzerinden canlı). Merkez şeffaf: avatar
            yüzü asla kapanmaz. Fareyle üzerine gel veya <b>Hover / Selected / Celebrate</b> ile
            gerçek görsel tepkileri gör (her biri <code>.riv</code> içinde ayrı authored animasyon).
            <b>Yoğunluk</b> kaydırıcısı ve <b>Reduced</b> anahtarı canlı etki eder.
          </p>

          <div className="cl-toolbar">
            <div className="cl-seg">
              {SIZES.map((s) => (
                <button
                  key={s}
                  className={`cl-segbtn ${size === s ? 'on' : ''}`}
                  onClick={() => setSize(s)}
                >
                  {s}px
                </button>
              ))}
            </div>
            <label className="cl-range" title="Görsel yoğunluk">
              <span>Yoğunluk {intensity}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </label>
            <button className={`menu-btn ${reduced ? 'cl-active' : ''}`} onClick={() => setReduced((r) => !r)}>
              {reduced ? 'Reduced: AÇIK' : 'Reduced: kapalı'}
            </button>
            <button className="menu-btn" onClick={() => setDark((d) => !d)}>
              {dark ? 'Açık zemin' : 'Koyu zemin'}
            </button>
          </div>
        </div>

        <div className="cl-grid">
          {FRAMES.map((f) => {
            const st = state[f.key]
            return (
              <div key={f.key} className={`cl-card cl-tone-${f.tone}`}>
                <div className={`cl-tag cl-tag-${f.tone}`}>{f.name}</div>
                <div className="cl-theme">{f.theme}</div>

                <div
                  className="cl-hero"
                  onMouseEnter={() => patch(f.key, { hover: true })}
                  onMouseLeave={() => patch(f.key, { hover: false })}
                >
                  <div className="cl-stack" style={{ width: size, height: size }}>
                    <img
                      className="cl-avatar"
                      src={SAMPLE}
                      alt=""
                      style={{ width: size * 0.72, height: size * 0.72 }}
                    />
                    <RiveLayer
                      src={f.src}
                      artboard={f.artboard}
                      hover={st.hover}
                      selected={st.selected}
                      reduced={reduced}
                      intensity={intensity}
                      celebrateSignal={st.celebrate}
                      className="cl-rive"
                    />
                  </div>
                </div>

                <div className="cl-controls">
                  <button
                    className={`cl-ctl ${st.hover ? 'on' : ''}`}
                    onClick={() => patch(f.key, { hover: !st.hover })}
                  >
                    Hover
                  </button>
                  <button
                    className={`cl-ctl ${st.selected ? 'on' : ''}`}
                    onClick={() => patch(f.key, { selected: !st.selected })}
                  >
                    Selected
                  </button>
                  <button
                    className="cl-ctl cl-ctl-fire"
                    onClick={() => patch(f.key, { celebrate: st.celebrate + 1 })}
                  >
                    Celebrate
                  </button>
                </div>

                <p className="cl-desc">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import RiveLayer from './RiveLayer'
import AvatarFrame from './AvatarFrame'
import { AVATAR_FRAMES, type FrameRarity } from './avatarFrames'
import './CerceveGaleri.css'

import epicRiv from '../assets/rive/avatar-frames/epic.riv'
import legendaryRiv from '../assets/rive/avatar-frames/legendary.riv'
import mythicRiv from '../assets/rive/avatar-frames/mythic.riv'

// Cerceve Galerisi (/cerceve-galeri): TUM cerceve sistemleri tek yerde, 50+ farkli canli cesit.
//  • Klasik: 24 premium SVG tasarim (PremiumFrame temalari: fire/ice/thunder/gold/dragon/cyber/
//    emerald/ruby/silver... — her biri farkli efekt, AvatarFrame ile).
//  • Rive: 3 gercek Rive taban (Epic/Legendary/Mythic) + renk-tema turevleri (hue/sat/bright).
// Rive kareler hover -> guclenir, tik -> celebrate; ekran disinda pause (perf).

const BASES = {
  epic: { src: epicRiv, artboard: 'Epic' },
  legendary: { src: legendaryRiv, artboard: 'Legendary' },
  mythic: { src: mythicRiv, artboard: 'Mythic' },
} as const
type BaseKey = keyof typeof BASES

const RIVE_NAMES = [
  'Aurora', 'Nova', 'Rift', 'Ember', 'Frost', 'Void', 'Halo', 'Prism', 'Pulse', 'Aether',
  'Zephyr', 'Onyx', 'Solstice', 'Quasar', 'Nebula', 'Cinder', 'Glacier', 'Mirage', 'Vortex', 'Radiant',
  'Eclipse', 'Phantom', 'Lumen', 'Cobalt', 'Astral', 'Tempest',
]

type Tile =
  | { kind: 'premium'; id: string; name: string; rarity: FrameRarity }
  | { kind: 'rive'; id: string; name: string; base: BaseKey; rarity: FrameRarity; filter: string }

const RARITY_OF_BASE: Record<BaseKey, FrameRarity> = { epic: 'epic', legendary: 'legendary', mythic: 'mythic' }

// Rive turevleri: 3 taban dongusu + yayilmis renk kimligi.
const RIVE_TILES: Tile[] = RIVE_NAMES.map((name, i) => {
  const base = (['epic', 'legendary', 'mythic'] as BaseKey[])[i % 3]
  const hue = (i * 53) % 360
  const sat = (0.9 + (i % 4) * 0.18).toFixed(2)
  const bright = (0.95 + (i % 3) * 0.05).toFixed(2)
  return {
    kind: 'rive',
    id: `rive-${i}`,
    name,
    base,
    rarity: RARITY_OF_BASE[base],
    filter: `hue-rotate(${hue}deg) saturate(${sat}) brightness(${bright})`,
  }
})

// Klasik premium tasarimlar (mevcut 24 cerceve). Gercek frame id'si ayri map'te.
const PREMIUM_TILES: Tile[] = AVATAR_FRAMES.map((f) => ({
  kind: 'premium',
  id: `prem-${f.id}`,
  name: f.name,
  rarity: f.rarity,
}))
const PREMIUM_FRAME_ID: Record<string, string> = Object.fromEntries(
  AVATAR_FRAMES.map((f) => [`prem-${f.id}`, f.id]),
)

const ALL_TILES: Tile[] = [...RIVE_TILES, ...PREMIUM_TILES] // 26 + 24 = 50

const SAMPLE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#3b4a6b"/><stop offset="1" stop-color="#0d1120"/></radialGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="84" r="33" fill="#c9d4e8"/><path d="M42 178c0-36 27-56 58-56s58 20 58 56z" fill="#c9d4e8"/></svg>`,
  )

const SIZES = [64, 84, 108] as const
type FilterKey = 'all' | 'rive' | 'premium' | FrameRarity
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'rive', label: 'Rive' },
  { key: 'premium', label: 'Klasik' },
  { key: 'rare', label: 'Rare' },
  { key: 'epic', label: 'Epic' },
  { key: 'legendary', label: 'Legendary' },
  { key: 'mythic', label: 'Mythic' },
]

export default function CerceveGaleri({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [size, setSize] = useState<number>(84)
  const [reduced, setReduced] = useState(false)
  const [flt, setFlt] = useState<FilterKey>('all')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [celebrations, setCelebrations] = useState<Record<string, number>>({})

  const list = useMemo(() => {
    if (flt === 'all') return ALL_TILES
    if (flt === 'rive') return ALL_TILES.filter((t) => t.kind === 'rive')
    if (flt === 'premium') return ALL_TILES.filter((t) => t.kind === 'premium')
    return ALL_TILES.filter((t) => t.rarity === flt)
  }, [flt])

  const celebrate = (id: string) => setCelebrations((c) => ({ ...c, [id]: (c[id] || 0) + 1 }))

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="cg-wrap" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>

        <div className="cg-head">
          <h2>Çerçeve Galerisi</h2>
          <p>
            {ALL_TILES.length} canlı çeşit — 24 klasik premium tasarım (ateş / buz / yıldırım / altın /
            ejderha / cyber / zümrüt / yakut…) + Rive taban tasarımları ve renk türevleri. Üzerine gel →
            güçlenir · tıkla → kutlama. Ekran dışı kareler performans için duraklar.
          </p>
          <div className="cg-toolbar">
            <div className="cg-seg">
              {FILTERS.map((f) => (
                <button key={f.key} className={`cg-segbtn ${flt === f.key ? 'on' : ''}`} onClick={() => setFlt(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="cg-seg">
              {SIZES.map((s) => (
                <button key={s} className={`cg-segbtn ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}>
                  {s}px
                </button>
              ))}
            </div>
            <button className={`menu-btn ${reduced ? 'cg-active' : ''}`} onClick={() => setReduced((r) => !r)}>
              {reduced ? 'Sakin: AÇIK' : 'Sakin: kapalı'}
            </button>
          </div>
        </div>

        <div className="cg-grid" style={{ ['--tile' as string]: `${size + 38}px` }}>
          {list.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`cg-tile cg-r-${t.rarity} ${t.kind === 'rive' ? 'cg-kind-rive' : 'cg-kind-prem'}`}
              onMouseEnter={() => setHoverId(t.id)}
              onMouseLeave={() => setHoverId((h) => (h === t.id ? null : h))}
              onFocus={() => setHoverId(t.id)}
              onBlur={() => setHoverId((h) => (h === t.id ? null : h))}
              onClick={() => t.kind === 'rive' && celebrate(t.id)}
              title={`${t.name} — ${t.kind === 'rive' ? 'Rive' : 'Klasik'}${t.kind === 'rive' ? ' · kutlamak için tıkla' : ''}`}
            >
              <div className="cg-stack" style={{ width: size, height: size }}>
                {t.kind === 'premium' ? (
                  <AvatarFrame
                    frame={PREMIUM_FRAME_ID[t.id]}
                    src={SAMPLE}
                    size={size}
                    name={t.name}
                    animated={!reduced}
                    className="cg-prem"
                  />
                ) : (
                  <>
                    <img className="cg-avatar" src={SAMPLE} alt="" style={{ width: size * 0.72, height: size * 0.72 }} />
                    <div className="cg-tint" style={{ filter: t.filter }}>
                      <RiveLayer
                        src={BASES[t.base].src}
                        artboard={BASES[t.base].artboard}
                        hover={hoverId === t.id}
                        reduced={reduced}
                        celebrateSignal={celebrations[t.id] || 0}
                        className="cg-rive"
                      />
                    </div>
                  </>
                )}
              </div>
              <span className="cg-name">{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

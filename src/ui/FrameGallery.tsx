import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import AvatarFrame from './AvatarFrame'
import {
  AVATAR_FRAMES,
  FRAME_GROUP_ORDER,
  FRAME_GROUP_LABEL,
  FRAME_RARITY_COLOR,
  type FrameGroup,
} from './avatarFrames'
import { RARITY_COLORS } from './rarityColors'

interface Props {
  avatar?: string | null
  name?: string
  onClose: () => void
}

// Galeri grup renkleri -> merkezi rarity paletinden (rarityColors.ts)
const GROUP_COLOR: Record<FrameGroup, string> = RARITY_COLORS

const SIZES = [48, 64, 96] as const

export default function FrameGallery({ avatar, name, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [size, setSize] = useState<number>(96)
  const [animated, setAnimated] = useState(true)

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card frame-gallery-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="crown" size={20} /> {t('frames.title')}</h2>
        <p className="setup-note">{t('frames.subtitle')}</p>

        {/* Vitrin araclari: boyut + animasyon */}
        <div className="fg-toolbar">
          <div className="fg-tool">
            <span className="fg-tool-lbl">{t('frames.size')}</span>
            <div className="fg-sizes">
              {SIZES.map((s) => (
                <button
                  key={s}
                  className={`fg-size-chip ${size === s ? 'active' : ''}`}
                  onClick={() => setSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <label className="fg-switch">
            <input type="checkbox" checked={animated} onChange={(e) => setAnimated(e.target.checked)} />
            <span className="fg-switch-track"><span className="fg-switch-thumb" /></span>
            <span className="fg-tool-lbl">{t('frames.animate')}</span>
          </label>
        </div>

        {FRAME_GROUP_ORDER.map((group) => {
          const items = AVATAR_FRAMES.filter((f) => f.group === group)
          if (items.length === 0) return null
          return (
            <div className="fg-group" key={group}>
              <div
                className="rarity-title"
                style={{ ['--rarity-color']: GROUP_COLOR[group] } as CSSProperties}
              >
                <span className="rarity-dot" /> {t(FRAME_GROUP_LABEL[group])}
                <span className="rarity-count">{items.length}</span>
              </div>
              <div className="fg-grid">
                {items.map((f) => (
                  <div
                    className="fg-item"
                    key={f.id}
                    style={{ ['--rarity-color']: GROUP_COLOR[group] } as CSSProperties}
                    title={f.name}
                  >
                    <div className="fg-preview" style={{ minHeight: SIZES[SIZES.length - 1] + 16 }}>
                      <AvatarFrame src={avatar} frame={f.id} size={size} name={name || 'T'} animated={animated} />
                    </div>
                    <span className="fg-name">{f.name}</span>
                    <span
                      className="fg-rarity"
                      style={{ ['--rarity-color']: FRAME_RARITY_COLOR[f.rarity] } as CSSProperties}
                    >
                      {t(`rarity.${f.rarity}`)}
                    </span>
                    {f.earned && (
                      <span className="fg-earned">
                        <Icon name="trophy" size={10} /> {t('frames.earned')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import type { CSSProperties } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import AvatarFrame from './AvatarFrame'
import {
  AVATAR_FRAMES,
  FRAME_GROUP_ORDER,
  FRAME_GROUP_LABEL,
  type FrameGroup,
} from './avatarFrames'

interface Props {
  avatar?: string | null
  name?: string
  onClose: () => void
}

// Galeri grup renkleri (rarity dili + ozel gruplar)
const GROUP_COLOR: Record<FrameGroup, string> = {
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
  prestige: '#EAB308',
  tavla: '#14B8A6',
  achievement: '#F5D06F',
}

export default function FrameGallery({ avatar, name, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  return (
    <div className="register-overlay modal page">
      <div className="register-card frame-gallery-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="crown" size={20} /> {t('frames.title')}</h2>
        <p className="setup-note">{t('frames.subtitle')}</p>

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
                  >
                    <AvatarFrame src={avatar} frame={f.id} size={104} name={name || 'T'} />
                    <span className="fg-name">{f.name}</span>
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

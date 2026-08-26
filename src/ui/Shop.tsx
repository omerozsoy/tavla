import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import AvatarFrame from './AvatarFrame'
import {
  AVATAR_FRAMES,
  FRAME_GROUP_ORDER,
  FRAME_GROUP_LABEL,
  framePrice,
  type FrameGroup,
} from './avatarFrames'

// Galeri ile ayni grup renkleri
const GROUP_COLOR: Record<FrameGroup, string> = {
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
  prestige: '#EAB308',
  tavla: '#14B8A6',
  achievement: '#F5D06F',
}

interface Props {
  coins: number
  unlocks: string[]
  currentFrame: string | null
  avatar?: string | null // onizlemede kullanicinin fotografi
  name?: string // foto yoksa bas harf
  rewardReady?: boolean // 6 saatlik gunluk odul hazir mi
  rewardSecs?: number // sonraki odule kalan saniye (geri sayim)
  onBuy: (shopId: string) => Promise<void>
  onEquip: (frameId: string | null) => Promise<void>
  onDaily: () => Promise<{ claimed: boolean; reward?: number }>
  onClose: () => void
}

// Saniye -> H:MM:SS (header ile ayni bicim)
const fmtLeft = (total: number) => {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function Shop({
  coins,
  unlocks,
  currentFrame,
  avatar,
  name,
  rewardReady = false,
  rewardSecs = 0,
  onBuy,
  onEquip,
  onDaily,
  onClose,
}: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [busy, setBusy] = useState<string | null>(null)
  const [dailyMsg, setDailyMsg] = useState('')
  const [buyErr, setBuyErr] = useState('')

  async function daily() {
    setBusy('daily')
    try {
      const r = await onDaily()
      setDailyMsg(r.claimed ? t('shop.dailyGot', { n: r.reward ?? 0 }) : t('shop.dailyDone'))
    } finally {
      setBusy(null)
    }
  }

  const owns = (shopId: string) => unlocks.includes(shopId)

  async function buy(shopId: string) {
    setBusy(shopId)
    setBuyErr('')
    try {
      await onBuy(shopId)
    } catch {
      setBuyErr(t('shop.buyErr'))
    } finally {
      setBusy(null)
    }
  }
  async function equip(id: string | null) {
    setBusy('frame.' + (id ?? 'none'))
    try {
      await onEquip(id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="register-overlay modal page">
      <div className="register-card shop-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="shop" size={20} /> {t('shop.title')}</h2>
        <div className="shop-top">
          <div className="shop-coins"><Icon name="coin" size={16} /> {coins} coin</div>
          <button
            className={`shop-daily ${rewardReady ? 'ready' : ''}`}
            disabled={busy === 'daily' || !rewardReady}
            onClick={daily}
            title={rewardReady ? t('reward.claim') : t('reward.in')}
          >
            <Icon name="gift" size={16} />{' '}
            {rewardReady ? t('shop.daily') : <span className="sd-count">{fmtLeft(rewardSecs)}</span>}
          </button>
        </div>
        {dailyMsg && <div className="shop-daily-msg">{dailyMsg}</div>}
        {buyErr && (
          <div className="shop-buy-err" role="alert">
            <Icon name="alert" size={15} /> {buyErr}
          </div>
        )}

        <h3 className="shop-sec">{t('shop.frames')}</h3>
        <div className="shop-grid">
          <div className="shop-item">
            <AvatarFrame src={avatar} frame={null} size={88} name={name} />
            <div className="shop-name">{t('shop.noFrame')}</div>
            <button
              className={`shop-btn ${!currentFrame ? 'active' : ''}`}
              disabled={!currentFrame}
              onClick={() => equip(null)}
            >
              {!currentFrame ? t('shop.equipped') : t('shop.equip')}
            </button>
          </div>
        </div>

        {FRAME_GROUP_ORDER.map((group) => {
          const items = AVATAR_FRAMES.filter((f) => f.group === group)
          if (items.length === 0) return null
          return (
            <div
              className="rarity-group"
              key={group}
              style={{ ['--rarity-color']: GROUP_COLOR[group] } as CSSProperties}
            >
              <div className="rarity-title">
                <span className="rarity-dot" /> {t(FRAME_GROUP_LABEL[group])}
              </div>
              <div className="shop-grid">
                {items.map((f) => {
                  const sid = 'frame.' + f.id
                  const owned = owns(sid)
                  const equipped = currentFrame === f.id
                  const price = framePrice(f)
                  return (
                    <div
                      key={f.id}
                      className="shop-item"
                      style={{ ['--rarity-color']: GROUP_COLOR[group] } as CSSProperties}
                    >
                      <AvatarFrame src={avatar} frame={f.id} size={88} name={name} />
                      <div className="shop-name">{f.name}</div>
                      {owned ? (
                        <button
                          className={`shop-btn ${equipped ? 'active' : ''}`}
                          disabled={equipped}
                          onClick={() => equip(f.id)}
                        >
                          {equipped ? t('shop.equipped') : t('shop.equip')}
                        </button>
                      ) : price != null ? (
                        <>
                          <button
                            className={`shop-btn buy${coins < price ? ' cant' : ''}`}
                            disabled={busy === sid || coins < price}
                            onClick={() => buy(sid)}
                          >
                            <Icon name="coin" size={14} /> {price}
                          </button>
                          {coins < price && (
                            <div className="shop-need">{t('shop.need', { n: price - coins })}</div>
                          )}
                        </>
                      ) : (
                        <span className="shop-earn">
                          <Icon name="trophy" size={12} /> {t('frames.earned')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <p className="shop-note">{t('shop.note')}</p>
      </div>
    </div>
  )
}

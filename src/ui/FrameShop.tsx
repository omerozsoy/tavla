import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { useT } from '../i18n'
import AvatarFrame from './AvatarFrame'
import {
  AVATAR_FRAMES,
  FRAME_GROUP_ORDER,
  FRAME_GROUP_LABEL,
  framePrice,
  type FrameGroup,
  type AvatarFrameDef,
} from './avatarFrames'
import { RARITY_COLORS } from './rarityColors'
import { Button } from '@/components/ui/button'

// 5 kademe grup rengi -> merkezi rarity paletinden (rarityColors.ts)
const GROUP_COLOR: Record<FrameGroup, string> = RARITY_COLORS
const fmtCoin = (n: number) => n.toLocaleString('tr-TR')

interface Props {
  coins: number
  unlocks: string[]
  currentFrame: string | null
  avatar?: string | null
  name?: string
  onBuy: (shopId: string) => Promise<void>
  onEquip: (frameId: string | null) => Promise<void>
}

// --- Tek cerceve karti: onizleme (rarity renkli halka) + ad + al/tak ---
interface CardProps {
  f: AvatarFrameDef
  avatar?: string | null
  name?: string
  currentFrame: string | null
  owns: (sid: string) => boolean
  coins: number
  busy: string | null
  groupColor: string
  onBuy: (sid: string) => void
  onEquip: (id: string) => void
  labels: { equip: string; equipped: string; earned: string; need: (n: number) => string; buyAria: (name: string, price: number) => string }
}
function FrameCard(p: CardProps) {
  const sid = 'frame.' + p.f.id
  const owned = p.owns(sid)
  const equipped = p.currentFrame === p.f.id
  const price = framePrice(p.f)
  return (
    <div className="shop-anim" style={{ ['--rarity-color']: p.groupColor } as CSSProperties}>
      <div className="shop-anim-preview">
        {/* Animasyon dogrudan oynar (reduced-motion'da SoberFrame zaten durdurur) */}
        <AvatarFrame src={p.avatar} frame={p.f.id} size={82} name={p.name} animated />
      </div>
      <div className="shop-anim-name" title={p.f.name}>
        {p.f.name}
      </div>
      {owned ? (
        <Button
          type="button"
          variant={equipped ? 'secondary' : 'default'}
          className="w-full"
          disabled={equipped}
          onClick={() => p.onEquip(p.f.id)}
        >
          {equipped ? p.labels.equipped : p.labels.equip}
        </Button>
      ) : price != null ? (
        <>
          <Button
            type="button"
            variant="default"
            className="w-full"
            disabled={p.busy === sid || p.coins < price}
            onClick={() => p.onBuy(sid)}
            aria-label={p.labels.buyAria(p.f.name, price)}
          >
            <Coins amount={price} size={14} />
          </Button>
          {p.coins < price && <div className="shop-need">{p.labels.need(price - p.coins)}</div>}
        </>
      ) : (
        <span className="shop-earn">
          <Icon name="trophy" size={12} /> {p.labels.earned}
        </span>
      )}
    </div>
  )
}

// Cerceve magazasi: satin alma + kusanma. Ayarlar "Avatar Cercevesi" sekmesine gomulu.
export default function FrameShop({ coins, unlocks, currentFrame, avatar, name, onBuy, onEquip }: Props) {
  const { t } = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const [buyErr, setBuyErr] = useState('')

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

  const labels = {
    equip: t('shop.equip'),
    equipped: t('shop.equipped'),
    earned: t('frames.earned'),
    need: (n: number) => t('shop.need', { n }),
    buyAria: (nm: string, price: number) => `${nm} — ${fmtCoin(price)} coin ile al`,
  }

  return (
    <div className="frame-shop">
      <div className="frame-shop-bal">
        <Coins amount={coins} size={22} />
      </div>
      {buyErr && (
        <div className="shop-buy-err" role="alert">
          <Icon name="alert" size={15} /> {buyErr}
        </div>
      )}

      {/* Cercevesiz */}
      <div className="shop-grid shop-grid-top">
        <div className="shop-anim">
          <div className="shop-anim-preview">
            <AvatarFrame src={avatar} frame={null} size={82} name={name} />
          </div>
          <div className="shop-anim-name">{t('shop.noFrame')}</div>
          <Button
            type="button"
            variant={!currentFrame ? 'secondary' : 'default'}
            className="w-full"
            disabled={!currentFrame}
            onClick={() => equip(null)}
          >
            {!currentFrame ? t('shop.equipped') : t('shop.equip')}
          </Button>
        </div>
      </div>

      {FRAME_GROUP_ORDER.map((group) => {
        const frames = AVATAR_FRAMES.filter((f) => f.group === group)
        if (frames.length === 0) return null
        return (
          <div
            className="rarity-group"
            key={group}
            style={{ ['--rarity-color']: GROUP_COLOR[group] } as CSSProperties}
          >
            <div className="rarity-title">
              <span className="rarity-dot" /> {t(FRAME_GROUP_LABEL[group])}
              <span className="rarity-count">{frames.length}</span>
            </div>
            <div className="shop-anim-grid">
              {frames.map((f) => (
                <FrameCard
                  key={f.id}
                  f={f}
                  avatar={avatar}
                  name={name}
                  currentFrame={currentFrame}
                  owns={owns}
                  coins={coins}
                  busy={busy}
                  groupColor={GROUP_COLOR[group]}
                  onBuy={buy}
                  onEquip={equip}
                  labels={labels}
                />
              ))}
            </div>
          </div>
        )
      })}

      <p className="shop-note">{t('shop.note')}</p>
    </div>
  )
}

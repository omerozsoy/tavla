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
import BuyConfirm from './BuyConfirm'

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

// --- Tek cerceve karti = TIKLANABILIR TILE (tahta tasarimlariyla AYNI akis; ayri dugme YOK) ---
// Sahipse tiklayinca kusanir; sahip degil + alinabilirse tiklayinca ONAY (BuyConfirm) acilir;
// fiyat kart uzerinde kucuk rozette (.bp-price). Kazanimla acilanlar (fiyatsiz) "kazan" etiketi.
interface CardProps {
  f: AvatarFrameDef
  avatar?: string | null
  name?: string
  currentFrame: string | null
  owns: (sid: string) => boolean
  coins: number
  groupColor: string
  onBuy: (sid: string, name: string, price: number) => void
  onEquip: (id: string) => void
  labels: { equipped: string; earned: string; buyAria: (name: string, price: number) => string }
}
function FrameCard(p: CardProps) {
  const sid = 'frame.' + p.f.id
  const owned = p.owns(sid)
  const equipped = p.currentFrame === p.f.id
  const price = framePrice(p.f)
  const buyable = !owned && price != null
  const affordable = buyable && p.coins >= price
  const earnOnly = !owned && price == null
  return (
    <button
      type="button"
      className={`shop-anim ${equipped ? 'active' : ''} ${buyable ? 'locked' : ''}`}
      style={{ ['--rarity-color']: p.groupColor } as CSSProperties}
      disabled={buyable && !affordable}
      title={buyable && price != null ? `${p.f.name} — ${fmtCoin(price)} coin` : p.f.name}
      aria-label={buyable && price != null ? p.labels.buyAria(p.f.name, price) : p.f.name}
      onClick={() => {
        if (owned) {
          if (!equipped) p.onEquip(p.f.id)
        } else if (affordable && price != null) {
          p.onBuy(sid, p.f.name, price)
        }
      }}
    >
      <div className="shop-anim-preview">
        {/* Animasyon dogrudan oynar (reduced-motion'da SoberFrame zaten durdurur) */}
        <AvatarFrame src={p.avatar} frame={p.f.id} size={50} name={p.name} animated />
      </div>
      <div className="shop-anim-name" title={p.f.name}>
        {p.f.name}
      </div>
      {equipped && (
        <span className="bp-selected">
          <Icon name="check" size={12} /> {p.labels.equipped}
        </span>
      )}
      {buyable && price != null && (
        <span className="bp-price">
          <Coins amount={price} size={12} />
        </span>
      )}
      {earnOnly && (
        <span className="shop-earn">
          <Icon name="trophy" size={12} /> {p.labels.earned}
        </span>
      )}
    </button>
  )
}

// Cerceve magazasi: satin alma + kusanma. Tahta tasarimlariyla AYNI etkilesim (tile tiklamasi).
export default function FrameShop({ coins, unlocks, currentFrame, avatar, name, onBuy, onEquip }: Props) {
  const { t } = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const [buyErr, setBuyErr] = useState('')
  // Satin alma ONAY adimi: yanlis tiklamayla coin gitmesin diye once onay iste.
  const [pending, setPending] = useState<{ sid: string; name: string; price: number } | null>(null)

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
    equipped: t('shop.equipped'),
    earned: t('frames.earned'),
    buyAria: (nm: string, price: number) => `${nm} — ${fmtCoin(price)} coin ile al`,
  }

  return (
    <div className="frame-shop">
      {/* Bakiye ust magaza basliginda zaten var -> burada tekrar gosterme (mukerrer). */}
      {buyErr && (
        <div className="shop-buy-err" role="alert">
          <Icon name="alert" size={15} /> {buyErr}
        </div>
      )}

      {/* Cercevesiz — tıklanabilir tile (tıklayınca çerçeveyi kaldırır) */}
      <div className="shop-anim-grid shop-grid-top">
        <button
          type="button"
          className={`shop-anim ${!currentFrame ? 'active' : ''}`}
          onClick={() => {
            if (currentFrame) equip(null)
          }}
          title={t('shop.noFrame')}
        >
          <div className="shop-anim-preview">
            <AvatarFrame src={avatar} frame={null} size={50} name={name} />
          </div>
          <div className="shop-anim-name">{t('shop.noFrame')}</div>
          {!currentFrame && (
            <span className="bp-selected">
              <Icon name="check" size={12} /> {t('shop.equipped')}
            </span>
          )}
        </button>
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
                  groupColor={GROUP_COLOR[group]}
                  onBuy={(sid, name, price) => setPending({ sid, name, price })}
                  onEquip={equip}
                  labels={labels}
                />
              ))}
            </div>
          </div>
        )
      })}

      <p className="shop-note">{t('shop.note')}</p>

      {pending && (
        <BuyConfirm
          name={pending.name}
          price={pending.price}
          coins={coins}
          busy={busy === pending.sid}
          onConfirm={() => {
            const sid = pending.sid
            setPending(null)
            buy(sid)
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

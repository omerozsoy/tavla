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
  type AvatarFrameDef,
} from './avatarFrames'

// 5 kademe grup rengi (rarity ile birebir; galeri ile ayni dil)
const GROUP_COLOR: Record<FrameGroup, string> = {
  common: '#9CA3AF',
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
  avatar?: string | null
  name?: string
  rewardReady?: boolean
  rewardSecs?: number
  onBuy: (shopId: string) => Promise<void>
  onEquip: (frameId: string | null) => Promise<void>
  onDaily: () => Promise<{ claimed: boolean; reward?: number }>
  onClose: () => void
}

const fmtLeft = (total: number) => {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const fmtCoin = (n: number) => n.toLocaleString('tr-TR')

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
        <button
          className={`shop-btn ${equipped ? 'active' : ''}`}
          disabled={equipped}
          onClick={() => p.onEquip(p.f.id)}
        >
          {equipped ? p.labels.equipped : p.labels.equip}
        </button>
      ) : price != null ? (
        <>
          <button
            className={`shop-btn buy${p.coins < price ? ' cant' : ''}`}
            disabled={p.busy === sid || p.coins < price}
            onClick={() => p.onBuy(sid)}
            aria-label={p.labels.buyAria(p.f.name, price)}
          >
            <Icon name="coin" size={14} /> <span className="tnum">{fmtCoin(price)}</span>
          </button>
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

  const labels = {
    equip: t('shop.equip'),
    equipped: t('shop.equipped'),
    earned: t('frames.earned'),
    need: (n: number) => t('shop.need', { n }),
    buyAria: (nm: string, price: number) => `${nm} — ${fmtCoin(price)} coin ile al`,
  }

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card shop-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="shop" size={20} /> {t('shop.title')}
        </h2>

        {/* Sticky kontrol bari: bakiye + odul */}
        <div className="shop-controls">
          <div className="shop-controls-row">
            <div className="shop-coins">
              <Icon name="coin" size={16} /> <span className="tnum">{fmtCoin(coins)}</span>
            </div>
            <button
              className={`shop-daily ${rewardReady ? 'ready' : ''}`}
              disabled={busy === 'daily' || !rewardReady}
              onClick={daily}
              title={rewardReady ? t('reward.claim') : t('reward.in')}
            >
              <Icon name="gift" size={16} />{' '}
              {rewardReady ? t('shop.daily') : <span className="sd-count tnum">{fmtLeft(rewardSecs)}</span>}
            </button>
          </div>
        </div>

        {dailyMsg && <div className="shop-daily-msg">{dailyMsg}</div>}
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
    </div>
  )
}

import { useMemo, useState } from 'react'
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
  type FrameRarity,
  type AvatarFrameDef,
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

// AVATAR_FRAMES'i animasyona gore grupla: her animasyon = 1 kart + N renk varyanti.
// (210 kart yerine ~42 kart + 5 renk swatch -> scannability + performans.)
type AnimGroup = { motion: string; name: string; rarity: FrameRarity; items: AvatarFrameDef[] }
const ANIMATIONS: AnimGroup[] = (() => {
  const out: AnimGroup[] = []
  for (const f of AVATAR_FRAMES) {
    const last = out[out.length - 1]
    if (last && last.motion === f.motion) last.items.push(f)
    else out.push({ motion: f.motion, name: f.name.split(' · ')[0], rarity: f.rarity, items: [f] })
  }
  return out
})()
// Renk cipleri (ilk animasyonun varyantlarindan: ad + hex, uretim sirasi = renk sirasi)
const COLOR_CHIPS = (ANIMATIONS[0]?.items ?? []).map((it) => ({
  name: it.name.split(' · ')[1] ?? '',
  accent: it.accent,
}))

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

// --- Tek animasyon karti: 1 onizleme (secili renk) + 5 renk swatch + al/tak ---
interface CardProps {
  anim: AnimGroup
  colorIdx: number
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
function AnimCard(p: CardProps) {
  const [sel, setSel] = useState(Math.min(p.colorIdx, p.anim.items.length - 1))
  const [hover, setHover] = useState(false)
  const f = p.anim.items[sel]
  const sid = 'frame.' + f.id
  const owned = p.owns(sid)
  const equipped = p.currentFrame === f.id
  const price = framePrice(f)
  const colorName = f.name.split(' · ')[1] ?? ''
  return (
    <div className="shop-anim" style={{ ['--rarity-color']: p.groupColor } as CSSProperties}>
      <div
        className="shop-anim-preview"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* hover/focus'ta animasyon; aksi halde statik (excessive-motion + perf) */}
        <AvatarFrame src={p.avatar} frame={f.id} size={82} name={p.name} animated={hover} />
      </div>
      <div className="shop-anim-name" title={p.anim.name}>
        {p.anim.name}
      </div>
      <div className="shop-swatches" role="group" aria-label={p.anim.name + ' renkleri'}>
        {p.anim.items.map((it, i) => {
          const o = p.owns('frame.' + it.id)
          const eq = p.currentFrame === it.id
          const cn = it.name.split(' · ')[1] ?? ''
          return (
            <button
              key={it.id}
              type="button"
              className={`shop-sw ${i === sel ? 'on' : ''} ${eq ? 'eq' : ''} ${o ? 'owned' : ''}`}
              style={{ background: it.accent }}
              onClick={() => setSel(i)}
              aria-label={cn + (eq ? ' (takılı)' : o ? ' (sahip)' : '')}
              aria-pressed={i === sel}
              title={cn}
            >
              {eq ? <Icon name="check" size={11} /> : o ? <span className="sw-dot" /> : null}
            </button>
          )
        })}
      </div>
      {owned ? (
        <button
          className={`shop-btn ${equipped ? 'active' : ''}`}
          disabled={equipped}
          onClick={() => p.onEquip(f.id)}
        >
          {equipped ? p.labels.equipped : p.labels.equip}
        </button>
      ) : price != null ? (
        <>
          <button
            className={`shop-btn buy${p.coins < price ? ' cant' : ''}`}
            disabled={p.busy === sid || p.coins < price}
            onClick={() => p.onBuy(sid)}
            aria-label={p.labels.buyAria(`${p.anim.name} ${colorName}`, price)}
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
  // Filtreler
  const [rarity, setRarity] = useState<FrameRarity | 'all'>('all')
  const [colorIdx, setColorIdx] = useState(0)
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [query, setQuery] = useState('')

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

  const q = query.trim().toLocaleLowerCase('tr')
  const shown = useMemo(
    () =>
      ANIMATIONS.filter(
        (a) =>
          (rarity === 'all' || a.rarity === rarity) &&
          (!ownedOnly || a.items.some((it) => unlocks.includes('frame.' + it.id))) &&
          (!q || a.name.toLocaleLowerCase('tr').includes(q)),
      ),
    [rarity, ownedOnly, q, unlocks],
  )

  const labels = {
    equip: t('shop.equip'),
    equipped: t('shop.equipped'),
    earned: t('frames.earned'),
    need: (n: number) => t('shop.need', { n }),
    buyAria: (nm: string, price: number) => `${nm} — ${fmtCoin(price)} coin ile al`,
  }
  const RARITY_CHIPS: { key: FrameRarity | 'all'; label: string }[] = [
    { key: 'all', label: t('shop.all') },
    { key: 'rare', label: t('rarity.rare') },
    { key: 'epic', label: t('rarity.epic') },
    { key: 'legendary', label: t('rarity.legendary') },
  ]

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card shop-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="shop" size={20} /> {t('shop.title')}
        </h2>

        {/* Sticky kontrol bari: bakiye + odul + arama + filtreler */}
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
            <label className="shop-search">
              <Icon name="search" size={15} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('shop.search')}
                aria-label={t('shop.search')}
              />
            </label>
          </div>
          <div className="shop-controls-row">
            <div className="shop-chips" role="group" aria-label={t('shop.rarity')}>
              {RARITY_CHIPS.map((c) => (
                <button
                  key={c.key}
                  className={`shop-chip ${rarity === c.key ? 'on' : ''}`}
                  onClick={() => setRarity(c.key)}
                  aria-pressed={rarity === c.key}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="shop-chips shop-colorchips" role="group" aria-label={t('shop.color')}>
              {COLOR_CHIPS.map((c, i) => (
                <button
                  key={c.accent}
                  className={`shop-colorchip ${colorIdx === i ? 'on' : ''}`}
                  style={{ background: c.accent }}
                  onClick={() => setColorIdx(i)}
                  aria-pressed={colorIdx === i}
                  aria-label={c.name}
                  title={c.name}
                />
              ))}
            </div>
            <button
              className={`shop-chip ${ownedOnly ? 'on' : ''}`}
              onClick={() => setOwnedOnly((v) => !v)}
              aria-pressed={ownedOnly}
            >
              {t('shop.ownedOnly')}
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
          const anims = shown.filter((a) => (a.rarity as FrameGroup) === group)
          if (anims.length === 0) return null
          return (
            <div
              className="rarity-group"
              key={group}
              style={{ ['--rarity-color']: GROUP_COLOR[group] } as CSSProperties}
            >
              <div className="rarity-title">
                <span className="rarity-dot" /> {t(FRAME_GROUP_LABEL[group])}
                <span className="rarity-count">{anims.length}</span>
              </div>
              <div className="shop-anim-grid">
                {anims.map((a) => (
                  <AnimCard
                    key={a.motion + '-' + colorIdx}
                    anim={a}
                    colorIdx={colorIdx}
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

        {shown.length === 0 && <div className="shop-empty">{t('shop.noResult')}</div>}

        <p className="shop-note">{t('shop.note')}</p>
      </div>
    </div>
  )
}

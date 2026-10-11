import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { Button } from '@/components/ui/button'
import HoverZoom, { canHoverPreview } from './HoverZoom'
import { useT } from '../i18n'
import AvatarFrame from './AvatarFrame'
import {
  AVATAR_FRAMES,
  FRAME_GROUP_ORDER,
  FRAME_GROUP_LABEL,
  framePrice,
  frameOnSale,
  type FrameGroup,
  type AvatarFrameDef,
} from './avatarFrames'
import { RARITY_COLORS } from './rarityColors'
import BuyConfirm from './BuyConfirm'

// 5 kademe grup rengi -> merkezi rarity paletinden (rarityColors.ts)
const GROUP_COLOR: Record<FrameGroup, string> = RARITY_COLORS
const fmtCoin = (n: number) => n.toLocaleString('tr-TR')

type Filter = 'all' | 'owned' | 'buyable'

interface Props {
  coins: number
  unlocks: string[]
  currentFrame: string | null
  avatar?: string | null
  name?: string
  onBuy: (shopId: string) => Promise<void>
  onEquip: (frameId: string | null) => Promise<void>
}

type FrameStatus = { owned: boolean; price: number | undefined; buyable: boolean; earnOnly: boolean }

// --- Tek cerceve karti = Tavla Tasarimlari KART DILI: onizleme + ad + durum footer'i.
// Aktif -> "Kullaniliyor" (pasif); sahip -> "Sende var" + "Kullan"; alinabilir -> fiyat + "Satin Al";
// kazanim -> "Kazanilir" (satin alinamaz). Hover'da yaninda buyuk onizleme (HoverZoom).
function FrameCard({
  f,
  avatar,
  name,
  status,
  coins,
  busy,
  groupColor,
  onBuy,
  onEquip,
  onHover,
  equipped,
  labels,
}: {
  f: AvatarFrameDef
  avatar?: string | null
  name?: string
  status: FrameStatus
  coins: number
  busy: string | null
  groupColor: string
  equipped: boolean
  onBuy: (sid: string, name: string, price: number) => void
  onEquip: (id: string) => void
  onHover: (h: { f: AvatarFrameDef; rect: DOMRect } | null) => void
  labels: { buyAria: (name: string, price: number) => string }
}) {
  const sid = 'frame.' + f.id
  const { owned, price, buyable } = status
  const affordable = buyable && price != null && coins >= price
  return (
    <div
      className={`shop-anim ${equipped ? 'active' : ''} ${buyable ? 'locked' : ''}`}
      data-frame-id={f.id}
      style={{ ['--rarity-color']: groupColor } as CSSProperties}
      title={f.name}
      onMouseEnter={(e) => { if (canHoverPreview()) onHover({ f, rect: e.currentTarget.getBoundingClientRect() }) }}
      onMouseLeave={() => onHover(null)}
    >
      <div className="shop-anim-preview">
        <AvatarFrame src={avatar} frame={f.id} size={50} name={name} animated />
      </div>
      <div className="shop-anim-name" title={f.name}>{f.name}</div>
      {buyable && price != null && (
        <span className="bp-price"><Coins amount={price} size={12} /></span>
      )}
      <div className="bp-foot">
        {equipped ? (
          <Button variant="secondary" className="bp-act" disabled>
            <Icon name="check" size={14} /> Kullanılıyor
          </Button>
        ) : owned ? (
          <>
            <span className="bp-have-tag">Sende var</span>
            <Button variant="default" className="bp-act" onClick={() => onEquip(f.id)}>Kullan</Button>
          </>
        ) : buyable && price != null ? (
          <Button
            variant="outline"
            className="bp-act"
            disabled={!affordable || busy === sid}
            aria-label={labels.buyAria(f.name, price)}
            onClick={() => onBuy(sid, f.name, price)}
          >
            Satın Al
          </Button>
        ) : (
          <span className="bp-lock"><Icon name="trophy" size={13} /> Kazanılır</span>
        )}
      </div>
    </div>
  )
}

// "Çerçevesiz" (çerçeveyi kaldır) — daima sahip olunan varsayılan; Standart grubunun İÇİNDE.
function NoneCard({ currentFrame, avatar, name, onEquip }: { currentFrame: string | null; avatar?: string | null; name?: string; onEquip: (id: string | null) => void }) {
  const active = !currentFrame
  return (
    <div className={`shop-anim ${active ? 'active' : ''}`} title="Çerçevesiz">
      <div className="shop-anim-preview">
        <AvatarFrame src={avatar} frame={null} size={50} name={name} />
      </div>
      <div className="shop-anim-name">Çerçevesiz</div>
      <div className="bp-foot">
        {active ? (
          <Button variant="secondary" className="bp-act" disabled>
            <Icon name="check" size={14} /> Kullanılıyor
          </Button>
        ) : (
          <>
            <span className="bp-have-tag">Sende var</span>
            <Button variant="default" className="bp-act" onClick={() => onEquip(null)}>Kullan</Button>
          </>
        )}
      </div>
    </div>
  )
}

// Cerceve magazasi: Tavla Tasarimlari ekraniyla AYNI dil — filtreler (Tumu/Sahip/Alinabilir) +
// "X / Y sahipsin" + nadirlik gruplari + durum footer'li kartlar. Sahiplik/alim MEVCUT akis.
export default function FrameShop({ coins, unlocks, currentFrame, avatar, name, onBuy, onEquip }: Props) {
  const { t } = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const [buyErr, setBuyErr] = useState('')
  const [pending, setPending] = useState<{ sid: string; name: string; price: number } | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [hover, setHover] = useState<{ f: AvatarFrameDef; rect: DOMRect } | null>(null)

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

  const statusOf = (f: AvatarFrameDef): FrameStatus => {
    const owned = owns('frame.' + f.id)
    const price = framePrice(f)
    const buyable = !owned && price != null
    return { owned, price, buyable, earnOnly: !owned && price == null }
  }

  // Gosterilen cerceveler: satista VEYA sahip olunan (eski/satistan kalkmis ama sahip -> gorunur).
  const shownFrames = AVATAR_FRAMES.filter((f) => frameOnSale(f.id) || owns('frame.' + f.id))
  // Sayilar GERCEK veriden. "Cercevesiz" (none) daima sahip -> +1 owned/total.
  const total = shownFrames.length + 1
  const ownedCount = shownFrames.filter((f) => owns('frame.' + f.id)).length + 1
  const buyableCount = shownFrames.filter((f) => statusOf(f).buyable).length

  const passFilter = (s: FrameStatus) => (filter === 'owned' ? s.owned : filter === 'buyable' ? s.buyable : true)
  const noneVisible = filter !== 'buyable' // "Çerçevesiz" sahip sayılır -> alınabilir filtresinde gizli

  const filters: Array<[Filter, string, number]> = [
    ['all', 'Tümü', total],
    ['owned', 'Sahip Olduklarım', ownedCount],
    ['buyable', 'Alınabilir', buyableCount],
  ]
  const labels = { buyAria: (nm: string, price: number) => `${nm} — ${fmtCoin(price)} coin ile al` }

  const anyShown = noneVisible || shownFrames.some((f) => passFilter(statusOf(f)))
  const emptyMsg =
    filter === 'owned' ? 'Henüz bir çerçeven yok.' : filter === 'buyable' ? 'Şu an alınabilir çerçeve yok — hepsi sende!' : 'Çerçeve bulunamadı.'

  return (
    <div className="frame-shop">
      {buyErr && (
        <div className="shop-buy-err" role="alert">
          <Icon name="alert" size={15} /> {buyErr}
        </div>
      )}

      <div className="bp-have-line">
        <strong>{ownedCount}</strong> / {total} tasarıma sahipsin
      </div>
      <div className="bp-filters" role="tablist" aria-label="Çerçeve filtreleri">
        {filters.map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`bp-filter ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label} <span className="bp-filter-n">{n}</span>
          </button>
        ))}
      </div>

      {!anyShown ? (
        <div className="bp-empty">{emptyMsg}</div>
      ) : (
        FRAME_GROUP_ORDER.map((group) => {
          const isStandart = group === 'common'
          const frames = shownFrames.filter((f) => f.group === group && passFilter(statusOf(f)))
          const showNone = isStandart && noneVisible
          if (frames.length === 0 && !showNone) return null
          return (
            <div className="rarity-group" key={group} style={{ ['--rarity-color']: GROUP_COLOR[group] } as CSSProperties}>
              <div className="rarity-title">
                <span className="rarity-dot" /> {t(FRAME_GROUP_LABEL[group])}
                <span className="rarity-count">{frames.length + (showNone ? 1 : 0)}</span>
              </div>
              <div className="shop-anim-grid">
                {showNone && <NoneCard currentFrame={currentFrame} avatar={avatar} name={name} onEquip={equip} />}
                {frames.map((f) => (
                  <FrameCard
                    key={f.id}
                    f={f}
                    avatar={avatar}
                    name={name}
                    status={statusOf(f)}
                    coins={coins}
                    busy={busy}
                    equipped={currentFrame === f.id}
                    groupColor={GROUP_COLOR[group]}
                    onBuy={(sid, nm, price) => setPending({ sid, name: nm, price })}
                    onEquip={equip}
                    onHover={setHover}
                    labels={labels}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}

      {hover && (
        <HoverZoom rect={hover.rect} width={200} height={232} onDismiss={() => setHover(null)}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
            <AvatarFrame src={avatar} frame={hover.f.id} size={156} name={name} animated />
          </div>
          <div className="bp-hover-name">{hover.f.name}</div>
        </HoverZoom>
      )}

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

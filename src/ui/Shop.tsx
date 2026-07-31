import { useState } from 'react'
import { useT } from '../i18n'

interface ThemeItem {
  id: string
  name: string
  price?: number
  a: string
  b: string
}
interface FrameItem {
  id: string
  name: string
  price: number
  css: string
}

interface Props {
  coins: number
  unlocks: string[]
  currentFrame: string | null
  boardTheme: string
  themes: ThemeItem[]
  frames: FrameItem[]
  onBuy: (shopId: string) => Promise<void>
  onEquip: (frameId: string | null) => Promise<void>
  onSelectTheme: (id: string) => void
  onClose: () => void
}

export default function Shop({
  coins,
  unlocks,
  currentFrame,
  boardTheme,
  themes,
  frames,
  onBuy,
  onEquip,
  onSelectTheme,
  onClose,
}: Props) {
  const { t } = useT()
  const [busy, setBusy] = useState<string | null>(null)

  const owns = (shopId: string) => unlocks.includes(shopId)

  async function buy(shopId: string) {
    setBusy(shopId)
    try {
      await onBuy(shopId)
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
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card shop-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
        <h2>🛍️ {t('shop.title')}</h2>
        <div className="shop-coins">🪙 {coins} coin</div>

        <h3 className="shop-sec">{t('shop.themes')}</h3>
        <div className="shop-grid">
          {themes.map((th) => {
            const sid = 'theme.' + th.id
            const owned = owns(sid)
            const active = boardTheme === th.id
            return (
              <div key={th.id} className="shop-item">
                <div
                  className="shop-swatch"
                  style={{ background: `linear-gradient(135deg, ${th.a} 0 50%, ${th.b} 50% 100%)` }}
                />
                <div className="shop-name">{th.name}</div>
                {owned ? (
                  <button
                    className={`shop-btn ${active ? 'active' : ''}`}
                    disabled={active}
                    onClick={() => onSelectTheme(th.id)}
                  >
                    {active ? t('shop.selected') : t('shop.select')}
                  </button>
                ) : (
                  <button
                    className="shop-btn buy"
                    disabled={busy === sid || coins < (th.price ?? 0)}
                    onClick={() => buy(sid)}
                  >
                    🪙 {th.price}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <h3 className="shop-sec">{t('shop.frames')}</h3>
        <div className="shop-grid">
          <div className="shop-item">
            <div className="shop-frame-prev" />
            <div className="shop-name">{t('shop.noFrame')}</div>
            <button
              className={`shop-btn ${!currentFrame ? 'active' : ''}`}
              disabled={!currentFrame}
              onClick={() => equip(null)}
            >
              {!currentFrame ? t('shop.equipped') : t('shop.equip')}
            </button>
          </div>
          {frames.map((fr) => {
            const sid = 'frame.' + fr.id
            const owned = owns(sid)
            const equipped = currentFrame === fr.id
            return (
              <div key={fr.id} className="shop-item">
                <div className="shop-frame-prev" style={{ background: fr.css }}>
                  <div className="shop-frame-hole" />
                </div>
                <div className="shop-name">{fr.name}</div>
                {owned ? (
                  <button
                    className={`shop-btn ${equipped ? 'active' : ''}`}
                    disabled={equipped}
                    onClick={() => equip(fr.id)}
                  >
                    {equipped ? t('shop.equipped') : t('shop.equip')}
                  </button>
                ) : (
                  <button
                    className="shop-btn buy"
                    disabled={busy === sid || coins < fr.price}
                    onClick={() => buy(sid)}
                  >
                    🪙 {fr.price}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="shop-note">{t('shop.note')}</p>
      </div>
    </div>
  )
}

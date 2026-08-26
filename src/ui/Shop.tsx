import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'

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
  frames: FrameItem[]
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
  frames,
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
                  <>
                    <button
                      className={`shop-btn buy${coins < fr.price ? ' cant' : ''}`}
                      disabled={busy === sid || coins < fr.price}
                      onClick={() => buy(sid)}
                    >
                      <Icon name="coin" size={14} /> {fr.price}
                    </button>
                    {coins < fr.price && (
                      <div className="shop-need">{t('shop.need', { n: fr.price - coins })}</div>
                    )}
                  </>
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

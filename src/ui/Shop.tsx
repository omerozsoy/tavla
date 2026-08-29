import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { COIN_PACKAGES } from '../coinPackages'
import { Button } from '@/components/ui/button'

interface Props {
  coins: number
  rewardReady?: boolean
  rewardSecs?: number
  onDaily: () => Promise<{ claimed: boolean; reward?: number }>
  onBuyCoins?: (pkgId: string) => void // gercek para ile jeton paketi al
  onMembership?: () => void // Star Uyelik kartindan uyelik ekranini ac
  onClose: () => void
}

const fmtLeft = (total: number) => {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const fmtCoin = (n: number) => n.toLocaleString('tr-TR')

// Magaza: coin (jeton) satin alma vitrini + gunluk odul. (Cerceveler artik Ayarlar'da.)
export default function Shop({
  coins,
  rewardReady = false,
  rewardSecs = 0,
  onDaily,
  onBuyCoins,
  onMembership,
  onClose,
}: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [busy, setBusy] = useState<string | null>(null)
  const [dailyMsg, setDailyMsg] = useState('')

  async function daily() {
    setBusy('daily')
    try {
      const r = await onDaily()
      setDailyMsg(r.claimed ? t('shop.dailyGot', { n: r.reward ?? 0 }) : t('shop.dailyDone'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card shop-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="shop" size={20} /> {t('shop.title')}
        </h2>

        {/* Sticky kontrol bari: bakiye + gunluk odul */}
        <div className="shop-controls">
          <div className="shop-controls-row">
            <div className="shop-coins">
              <Icon name="coin" size={16} /> <span className="tnum">{fmtCoin(coins)}</span>
            </div>
            <Button
              variant="default"
              className={`shop-daily ${rewardReady ? 'ready' : ''}`}
              disabled={busy === 'daily' || !rewardReady}
              onClick={daily}
              title={rewardReady ? t('reward.claim') : t('reward.in')}
            >
              <Icon name="gift" size={16} />{' '}
              {rewardReady ? t('shop.daily') : <span className="sd-count tnum">{fmtLeft(rewardSecs)}</span>}
            </Button>
          </div>
        </div>

        {dailyMsg && <div className="shop-daily-msg">{dailyMsg}</div>}

        {/* --- Coin satin al: gercek para ile jeton paketleri (vitrin) --- */}
        <section className="coin-store" aria-label={t('shop.buyCoins')}>
          <h3 className="coin-store-title">
            <Icon name="coin" size={18} /> {t('shop.buyCoins')}
          </h3>
          <div className="coin-grid">
            {COIN_PACKAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`coin-pkg coin-pkg-${p.tone}`}
                onClick={() => onBuyCoins?.(p.id)}
              >
                {p.popular && <span className="coin-pkg-badge">{t('shop.popular')}</span>}
                <span className="coin-pkg-ic" aria-hidden="true">
                  <Icon name="coin" size={26} />
                </span>
                <span className="coin-pkg-info">
                  <span className="coin-pkg-name">{p.name}</span>
                  <span className="coin-pkg-gc">{fmtCoin(p.gc)} GC</span>
                  <span className="coin-pkg-price">${p.price.toFixed(2)}</span>
                </span>
              </button>
            ))}
            {onMembership && (
              <button type="button" className="coin-pkg coin-pkg-mem" onClick={onMembership}>
                <span className="coin-mem-plan">{t('shop.memTitle')}</span>
                <span className="coin-mem-trial">{t('shop.memTrial')}</span>
                <span className="coin-mem-cta">
                  {t('shop.memCta')} <Icon name="chevron" size={14} />
                </span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

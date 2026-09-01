import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { COIN_PACKAGES } from '../coinPackages'
import { Button } from '@/components/ui/button'
import BoardPicker, { type BoardThemeOpt } from './BoardPicker'

interface Props {
  coins: number
  rewardReady?: boolean
  rewardSecs?: number
  onDaily: () => Promise<{ claimed: boolean; reward?: number }>
  onBuyCoins?: (pkgId: string) => void // gercek para ile jeton paketi al
  onMembership?: () => void // Star Uyelik kartindan uyelik ekranini ac
  // Tahta Rengi sekmesi (Ayarlar'dan Magaza'ya tasindi)
  boardTheme: string
  setBoardTheme: (id: string) => void
  boardThemes: BoardThemeOpt[]
  onBuyItem?: (shopId: string) => void // tahta/cerceve coin ile ac ('theme.<id>')
  framesSlot?: ReactNode // "Avatar Cercevesi" sekmesi (FrameShop/FrameGallery embed)
  initialTab?: ShopTab
  onClose: () => void
}

type ShopTab = 'coins' | 'board' | 'frame'

const fmtLeft = (total: number) => {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const fmtCoin = (n: number) => n.toLocaleString('tr-TR')
const fmtTL = (n: number) => `${n.toLocaleString('tr-TR')} ₺`

// Magaza: coin (jeton) satin alma vitrini + gunluk odul. (Cerceveler artik Ayarlar'da.)
export default function Shop({
  coins,
  rewardReady = false,
  rewardSecs = 0,
  onDaily,
  onBuyCoins,
  boardTheme,
  setBoardTheme,
  boardThemes,
  onBuyItem,
  framesSlot,
  initialTab = 'coins',
  onClose,
}: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [busy, setBusy] = useState<string | null>(null)
  const [dailyMsg, setDailyMsg] = useState('')
  const [tab, setTab] = useState<ShopTab>(initialTab)

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

        {/* Sekmeler: Jeton Al | Tahta Rengi | Avatar Cercevesi (Ayarlar'dan tasindi) */}
        <div className="prof-tabs bs-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'coins'}
            className={`prof-tab ${tab === 'coins' ? 'active' : ''}`}
            onClick={() => setTab('coins')}
          >
            <Icon name="coin" size={16} /> {t('shop.buyCoins')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'board'}
            className={`prof-tab ${tab === 'board' ? 'active' : ''}`}
            onClick={() => setTab('board')}
          >
            <Icon name="dice" size={16} /> {t('settings.tabBoard')}
          </button>
          {framesSlot && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'frame'}
              className={`prof-tab ${tab === 'frame' ? 'active' : ''}`}
              onClick={() => setTab('frame')}
            >
              <Icon name="crown" size={16} /> {t('settings.tabFrame')}
            </button>
          )}
        </div>

        {/* Tahta Rengi sekmesi */}
        {tab === 'board' && (
          <BoardPicker
            boardTheme={boardTheme}
            setBoardTheme={setBoardTheme}
            boardThemes={boardThemes}
            coins={coins}
            onBuy={onBuyItem}
          />
        )}

        {/* Avatar Cercevesi sekmesi */}
        {tab === 'frame' && framesSlot}

        {/* --- Coin satin al: gercek para ile jeton paketleri (vitrin) --- */}
        {tab === 'coins' && (
        <section className="coin-store" aria-label={t('shop.buyCoins')}>
          <h3 className="coin-store-title">
            <Icon name="coin" size={18} /> {t('shop.buyCoins')}
          </h3>
          <div className="coin-grid">
            {COIN_PACKAGES.map((p) => {
              const per = (p.price / p.gc).toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
              return (
                <button
                  key={p.id}
                  type="button"
                  className="coin-card"
                  data-popular={p.popular || undefined}
                  onClick={() => onBuyCoins?.(p.id)}
                >
                  {p.popular && <span className="coin-card-badge">{t('shop.popular')}</span>}
                  <span className="coin-card-name">{p.name}</span>
                  <span className="coin-card-amount">
                    <Icon name="coin" size={20} />
                    <b>{fmtCoin(p.gc)}</b>
                    <span className="coin-card-unit">coin</span>
                  </span>
                  <span className="coin-card-price">{fmtTL(p.price)}</span>
                  <span className="coin-card-meta">
                    <span className="coin-card-per">
                      {t('shop.perCoin')} {per} ₺
                    </span>
                    {p.discount > 0 && (
                      <span className="coin-card-save">
                        %{p.discount} {t('shop.advantage')}
                      </span>
                    )}
                  </span>
                  <span className="coin-card-cta">
                    {t('shop.buy')} <Icon name="arrow-right" size={14} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
        )}
      </div>
    </div>
  )
}

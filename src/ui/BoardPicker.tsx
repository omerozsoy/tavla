import { type CSSProperties } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import SetupBoard from './SetupBoard'
import { RARITY_COLORS } from './rarityColors'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'club'

export interface BoardThemeOpt {
  id: string
  name: string
  panel?: string
  a: string
  b: string
  checker?: string
  light?: string // acik pul rengi (onizleme gercek tahta ile ayni degeri kullansin)
  price?: number // coin fiyati (nadirlik bazli); ucretsiz/kulup -> undefined
  rarity?: Rarity
  owned?: boolean // sahip mi (ucretsiz/kulup/satin alinmis)
}

const RARITY_ORDER: Rarity[] = ['club', 'common', 'rare', 'epic', 'legendary', 'mythic']
const RARITY_COLOR: Record<Rarity, string> = RARITY_COLORS

interface Props {
  boardTheme: string
  setBoardTheme: (id: string) => void
  boardThemes: BoardThemeOpt[]
  coins?: number
  onBuy?: (shopId: string) => void
}

// Tahta rengi secici — nadirlik gruplari + buyuk onizlemeler. Hem Magaza (Tahta Rengi
// sekmesi) hem baska yerlerde tekrar kullanilir.
export default function BoardPicker({ boardTheme, setBoardTheme, boardThemes, coins = 0, onBuy }: Props) {
  const { t } = useT()
  return (
    <div className="setup-row">
      <div className="setup-label">{t('menu.board')}</div>
      {RARITY_ORDER.map((tier) => {
        const items = boardThemes.filter((bt) => (bt.rarity ?? 'common') === tier)
        if (items.length === 0) return null
        return (
          <div className="rarity-group" key={tier}>
            <div
              className={`rarity-title rarity-${tier}`}
              style={{ ['--rarity-color']: RARITY_COLOR[tier] } as CSSProperties}
            >
              <span className="rarity-dot" /> {t('rarity.' + tier)}
              <span className="rarity-count">{items.length}</span>
            </div>
            <div className="board-previews board-previews-lg">
              {items.map((bt) => {
                const owned = bt.owned !== false && bt.price == null ? true : !!bt.owned
                const price = bt.price
                const buyable = !owned && price != null
                const affordable = buyable && coins >= price
                return (
                  <button
                    key={bt.id}
                    type="button"
                    className={`board-prev ${boardTheme === bt.id ? 'active' : ''} ${buyable ? 'locked' : ''}`}
                    style={{ ['--rarity-color']: RARITY_COLOR[tier] } as CSSProperties}
                    disabled={buyable && !affordable}
                    title={buyable ? `${bt.name} — ${price} coin` : bt.name}
                    onClick={() =>
                      owned ? setBoardTheme(bt.id) : affordable ? onBuy?.('theme.' + bt.id) : undefined
                    }
                  >
                    <SetupBoard
                      panel={bt.panel ?? bt.b}
                      a={bt.a}
                      b={bt.b}
                      checker={bt.checker ?? bt.b}
                      cream={bt.light}
                    />
                    {boardTheme === bt.id && (
                      <span className="bp-selected">
                        <Icon name="check" size={12} /> {t('shop.selected')}
                      </span>
                    )}
                    <span className="bp-name">{bt.name}</span>
                    {buyable && (
                      <span className="bp-price">
                        <Icon name="coin" size={12} /> {price.toLocaleString('tr-TR')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

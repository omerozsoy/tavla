import { type CSSProperties, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Coins } from './Coins'
import SetupBoard from './SetupBoard'
import { RARITY_COLORS } from './rarityColors'
import BuyConfirm from './BuyConfirm'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'club' | 'country' | 'tavlatv'

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
  flag?: string // ulke boardu kart bayragi (emoji)
  pointStyle?: 'sharp' | 'rounded' // hane sekli (yuvarlak = TavlaTV Özel)
  surface?: 'plain' | 'gradient' | 'felt' | 'wood' // yuzey (agac damari vb.)
  checkerStyle?: 'flat' | 'gloss' | 'ice' | 'ring' | 'neon' // pul stili
}

// Sıra: Standart (common) üstte, sonra Kulüpler, Ülke Boardları, ardından nadirlik artışı.
const RARITY_ORDER: Rarity[] = ['common', 'club', 'country', 'rare', 'epic', 'legendary', 'mythic', 'tavlatv']
const RARITY_COLOR: Record<Rarity, string> = RARITY_COLORS

interface Props {
  boardTheme: string
  setBoardTheme: (id: string) => void
  boardThemes: BoardThemeOpt[]
  coins?: number
  onBuy?: (shopId: string) => void
}

// Masaustu hover onizlemesi: fare + hover destekli genis ekranda (dokunmatikte YOK).
const HOVER_W = 400
const canHoverPreview = () =>
  typeof window !== 'undefined' &&
  window.innerWidth >= 900 &&
  !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

// Kucuk kart zor seciliyor -> karta gelince yaninda 400px buyuk onizleme (pointer-events yok).
function HoverPreview({ bt, rect }: { bt: BoardThemeOpt; rect: DOMRect }) {
  const h = (HOVER_W * 264) / 400 + 34 // SetupBoard orani + ad satiri
  const gap = 12
  const right = rect.right + gap + HOVER_W <= window.innerWidth - 8
  const left = right ? rect.right + gap : Math.max(8, rect.left - gap - HOVER_W)
  const top = Math.min(Math.max(8, rect.top + rect.height / 2 - h / 2), window.innerHeight - h - 8)
  return createPortal(
    <div className="bp-hover" style={{ left, top, width: HOVER_W }} aria-hidden="true">
      <SetupBoard
        panel={bt.panel ?? bt.b}
        a={bt.a}
        b={bt.b}
        checker={bt.checker ?? bt.b}
        cream={bt.light}
        pointStyle={bt.pointStyle}
        surface={bt.surface}
        checkerStyle={bt.checkerStyle}
        themeId={bt.id}
      />
      <div className="bp-hover-name">
        {bt.flag && <span aria-hidden="true">{bt.flag} </span>}
        {bt.name}
      </div>
    </div>,
    document.body,
  )
}

// Tahta rengi secici — nadirlik gruplari + buyuk onizlemeler. Hem Magaza (Tahta Rengi
// sekmesi) hem baska yerlerde tekrar kullanilir.
export default function BoardPicker({ boardTheme, setBoardTheme, boardThemes, coins = 0, onBuy }: Props) {
  const { t } = useT()
  // Satin alma ONAY adimi: yanlis tiklamayla coin gitmesin diye once onay iste.
  const [pending, setPending] = useState<BoardThemeOpt | null>(null)
  const [hover, setHover] = useState<{ bt: BoardThemeOpt; rect: DOMRect } | null>(null)
  // Kaydirmada konum bayatlar -> onizlemeyi kapat.
  useEffect(() => {
    if (!hover) return
    const off = () => setHover(null)
    window.addEventListener('scroll', off, true)
    window.addEventListener('resize', off)
    return () => {
      window.removeEventListener('scroll', off, true)
      window.removeEventListener('resize', off)
    }
  }, [hover])
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
                      owned ? setBoardTheme(bt.id) : affordable ? setPending(bt) : undefined
                    }
                    onMouseEnter={(e) => {
                      if (canHoverPreview()) setHover({ bt, rect: e.currentTarget.getBoundingClientRect() })
                    }}
                    onMouseLeave={() => setHover(null)}
                  >
                    <SetupBoard
                      panel={bt.panel ?? bt.b}
                      a={bt.a}
                      b={bt.b}
                      checker={bt.checker ?? bt.b}
                      cream={bt.light}
                      pointStyle={bt.pointStyle}
                      surface={bt.surface}
                      checkerStyle={bt.checkerStyle}
                      themeId={bt.id}
                    />
                    {boardTheme === bt.id && (
                      <span className="bp-selected">
                        <Icon name="check" size={12} /> {t('shop.selected')}
                      </span>
                    )}
                    <span className="bp-name">
                      {bt.flag && <span className="bp-flag" aria-hidden="true">{bt.flag}</span>}
                      {bt.name}
                    </span>
                    {buyable && (
                      <span className="bp-price">
                        <Coins amount={price} size={12} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {hover && !pending && <HoverPreview bt={hover.bt} rect={hover.rect} />}
      {pending && pending.price != null && (
        <BuyConfirm
          name={pending.name}
          price={pending.price}
          coins={coins}
          onConfirm={() => {
            onBuy?.('theme.' + pending.id)
            setPending(null)
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

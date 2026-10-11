import { type CSSProperties, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { Button } from '@/components/ui/button'
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
  pointImgA?: string // özel tahta: tek hane resmi
  pointImgB?: string // özel tahta: çift hane resmi
  pointFitA?: import('../boardThemes').PointFit
  pointFitB?: import('../boardThemes').PointFit
  pointImgs?: Record<number, string>
  pointFits?: Record<number, import('../boardThemes').PointFit>
  surfaceImgLeft?: string
  surfaceImgRight?: string
  surfaceOpacity?: number
  pointTexts?: Record<number, string>
}

// Nadirlik -> kart kenar rengi (gruplar kaldırıldı; artık durum-bazlı tek ızgara, ama her
// kartın kenarı kendi nadirlik renginde kalır — görsel dil korunur).
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
        pointImgA={bt.pointImgA}
        pointImgB={bt.pointImgB}
        pointFitA={bt.pointFitA}
        pointFitB={bt.pointFitB}
        pointImgs={bt.pointImgs}
        pointFits={bt.pointFits}
        surfaceImgLeft={bt.surfaceImgLeft}
        surfaceImgRight={bt.surfaceImgRight}
        surfaceOpacity={bt.surfaceOpacity}
        pointTexts={bt.pointTexts}
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
type Filter = 'all' | 'owned' | 'buyable'

// Tek bir tasarimin durumu. Ucretsiz/varsayilan (fiyatsiz) -> sahip; fiyatli & sahip degil ->
// alinabilir; fiyatsiz & sahip degil -> ozel sartla acilan (satin alinamaz). Sahiplik SUNUCUDAN
// gelen owned/unlocks'a dayanir (bt.owned); burada yalniz gosterim.
function statusOf(bt: BoardThemeOpt): { owned: boolean; buyable: boolean } {
  const owned = bt.owned !== false && bt.price == null ? true : !!bt.owned
  const buyable = !owned && bt.price != null
  return { owned, buyable }
}

export default function BoardPicker({ boardTheme, setBoardTheme, boardThemes, coins = 0, onBuy }: Props) {
  // Satin alma ONAY adimi: yanlis tiklamayla coin gitmesin diye once onay iste.
  const [pending, setPending] = useState<BoardThemeOpt | null>(null)
  const [hover, setHover] = useState<{ bt: BoardThemeOpt; rect: DOMRect } | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
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

  // Sayilar GERCEK veriden (sabit yok). Katalog sirasi (boardThemes dizisi) index ile korunur.
  const items = boardThemes.map((bt, i) => ({ bt, i, ...statusOf(bt) }))
  const total = items.length
  const ownedCount = items.filter((x) => x.owned).length
  const buyableCount = items.filter((x) => x.buyable).length

  // Siralama: kullanilan (aktif) en basta -> sahip olunanlar -> digerleri (alinabilir/ozel).
  // Ayni bant icinde katalog sirasi (i) korunur.
  const rank = (x: (typeof items)[number]) => (x.bt.id === boardTheme ? 0 : x.owned ? 1 : 2)
  const shown = items
    .filter((x) => (filter === 'owned' ? x.owned : filter === 'buyable' ? x.buyable : true))
    .sort((a, b) => rank(a) - rank(b) || a.i - b.i)

  const emptyMsg =
    filter === 'owned'
      ? 'Henüz bir tasarıma sahip değilsin.'
      : filter === 'buyable'
        ? 'Şu an alınabilir tasarım yok — hepsi sende!'
        : 'Tasarım bulunamadı.'

  const filters: Array<[Filter, string, number]> = [
    ['all', 'Tümü', total],
    ['owned', 'Sahip Olduklarım', ownedCount],
    ['buyable', 'Alınabilir', buyableCount],
  ]

  return (
    <div className="bp-screen">
      <div className="bp-have-line">
        <strong>{ownedCount}</strong> / {total} tasarıma sahipsin
      </div>
      <div className="bp-filters" role="tablist" aria-label="Tasarım filtreleri">
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

      {shown.length === 0 ? (
        <div className="bp-empty">{emptyMsg}</div>
      ) : (
        <div className="board-previews board-previews-lg">
          {shown.map(({ bt, owned, buyable }) => {
            const active = boardTheme === bt.id
            const price = bt.price
            const affordable = buyable && price != null && coins >= price
            const color = RARITY_COLOR[bt.rarity ?? 'common']
            return (
              <div
                key={bt.id}
                className={`board-prev ${active ? 'active' : ''} ${buyable ? 'locked' : ''}`}
                style={{ ['--rarity-color']: color } as CSSProperties}
                title={bt.name}
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
                  pointImgA={bt.pointImgA}
                  pointImgB={bt.pointImgB}
                  pointFitA={bt.pointFitA}
                  pointFitB={bt.pointFitB}
                  pointImgs={bt.pointImgs}
                  pointFits={bt.pointFits}
                  surfaceImgLeft={bt.surfaceImgLeft}
                  surfaceImgRight={bt.surfaceImgRight}
                  surfaceOpacity={bt.surfaceOpacity}
                  pointTexts={bt.pointTexts}
                  themeId={bt.id}
                />
                <span className="bp-name">
                  {bt.flag && <span className="bp-flag" aria-hidden="true">{bt.flag}</span>}
                  {bt.name}
                </span>
                {buyable && price != null && (
                  <span className="bp-price">
                    <Coins amount={price} size={12} />
                  </span>
                )}
                <div className="bp-foot">
                  {active ? (
                    <Button variant="secondary" className="bp-act" disabled>
                      <Icon name="check" size={14} /> Kullanılıyor
                    </Button>
                  ) : owned ? (
                    <>
                      <span className="bp-have-tag">Sende var</span>
                      <Button variant="default" className="bp-act" onClick={() => setBoardTheme(bt.id)}>
                        Kullan
                      </Button>
                    </>
                  ) : buyable ? (
                    <Button
                      variant="outline"
                      className="bp-act"
                      disabled={!affordable}
                      onClick={() => setPending(bt)}
                    >
                      Satın Al
                    </Button>
                  ) : (
                    <span className="bp-lock">
                      <Icon name="lock" size={13} /> Özel tasarım
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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

import { useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import Coins from './Coins'
import { useT } from '../i18n'
import { useToast } from './Toast'
import { useEscape } from './useEscape'
import CheckerSkin from './CheckerSkin'
import HoverZoom, { canHoverPreview } from './HoverZoom'
import { CHECKER_FINISHES, checkerOnSale, checkerPrice, type CheckerRarity } from '../checkers'
import { RARITY_COLORS } from './rarityColors'
import './CheckerShop.css'

type Filter = 'all' | 'owned' | 'buyable'
type CheckerSkinT = (typeof CHECKER_FINISHES)[number]

// Pul (checker) nadirlik gruplari — EN PAHALI (mitik: Karbon) EN ÜSTTE -> en ucuz en altta.
const CHECKER_GROUP_ORDER: CheckerRarity[] = ['mythic', 'legendary', 'epic', 'rare', 'common']

/**
 * PUL TASARIMLARI — Tavla Tasarımları ekranıyla AYNI dil: filtreler (Tümü/Sahip/Alınabilir) +
 * "X / Y sahipsin" + nadirlik grupları (en pahalı Karbon en üstte) + durum footer'lı kartlar.
 * Seçtiğin doku, kullandığın tahtanın kendi pul renklerine otomatik uyar. Sahiplik unlocks'tan;
 * seçim users.checker. Satın alma/seçim MEVCUT akış.
 */
export default function CheckerShop({
  unlocks,
  selected,
  coins,
  onBuy,
  onSelect,
  onClose,
  embedded = false,
}: {
  unlocks: string[]
  selected: string | null
  coins: number
  onBuy: (fullId: string) => Promise<unknown> // basarisizda throw eder (yetersiz coin vb.)
  onSelect: (id: string | null) => void
  onClose?: () => void
  embedded?: boolean // true: profil sekmesinde inline (overlay/kapatma yok)
}) {
  const { t } = useT()
  const toast = useToast()
  useEscape(() => onClose?.())
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  // Karta gelince YANINDA büyük yüzen önizleme (Tavla Tasarımları gibi).
  const [hover, setHover] = useState<{ s: CheckerSkinT; rect: DOMRect } | null>(null)
  const owns = (id: string) => unlocks.includes('checker.' + id)

  async function buy(id: string) {
    if (busy) return
    setBusy(id)
    try {
      await onBuy('checker.' + id)
      onSelect(id) // aldıktan sonra otomatik seç
    } catch {
      toast.error('Yetersiz coin veya satın alınamadı.')
    } finally {
      setBusy(null)
    }
  }

  // Gosterilen: satista VEYA sahip olunan. Sayilar GERCEK veriden; "Varsayilan" (none) daima sahip (+1).
  const shown = CHECKER_FINISHES.filter((s) => checkerOnSale(s.id) || owns(s.id))
  const total = shown.length + 1
  const ownedCount = shown.filter((s) => owns(s.id)).length + 1
  const buyableCount = shown.filter((s) => !owns(s.id)).length
  const passFilter = (owned: boolean) => (filter === 'owned' ? owned : filter === 'buyable' ? !owned : true)
  const noneVisible = filter !== 'buyable' // Varsayılan sahip sayılır -> alınabilir filtresinde gizli
  const filters: Array<[Filter, string, number]> = [
    ['all', 'Tümü', total],
    ['owned', 'Sahip Olduklarım', ownedCount],
    ['buyable', 'Alınabilir', buyableCount],
  ]
  const anyShown = noneVisible || shown.some((s) => passFilter(owns(s.id)))
  const emptyMsg =
    filter === 'owned' ? 'Henüz bir pul tasarımın yok.' : filter === 'buyable' ? 'Şu an alınabilir pul yok — hepsi sende!' : 'Pul bulunamadı.'

  const renderCard = (s: CheckerSkinT) => {
    const owned = owns(s.id)
    const active = selected === s.id
    const price = checkerPrice(s)
    const affordable = coins >= price
    return (
      <div
        key={s.id}
        className={`cshop-item ${active ? 'active' : ''} ${!owned ? 'locked' : ''}`}
        onMouseEnter={(e) => { if (canHoverPreview()) setHover({ s, rect: e.currentTarget.getBoundingClientRect() }) }}
        onMouseLeave={() => setHover(null)}
      >
        <div className="cshop-prev" data-checker-id={s.id}>
          <CheckerSkin skin={s} tone="dark" size={56} />
          <CheckerSkin skin={s} tone="light" size={44} />
        </div>
        <div className="cshop-nm">{s.name}</div>
        {!owned && <span className="bp-price"><Coins amount={price} size={12} /></span>}
        <div className="bp-foot">
          {active ? (
            <Button variant="secondary" className="bp-act" disabled>
              <Icon name="check" size={14} /> Kullanılıyor
            </Button>
          ) : owned ? (
            <>
              <span className="bp-have-tag">Sende var</span>
              <Button variant="default" className="bp-act" onClick={() => onSelect(s.id)}>Kullan</Button>
            </>
          ) : (
            <Button variant="outline" className="bp-act" disabled={!affordable || busy === s.id} onClick={() => buy(s.id)}>
              Satın Al
            </Button>
          )}
        </div>
      </div>
    )
  }

  const noneCard = (
    <div className={`cshop-item ${selected == null ? 'active' : ''}`}>
      <div className="cshop-prev cshop-prev-default">
        <span className="cshop-def-checker dark" />
        <span className="cshop-def-checker light" />
      </div>
      <div className="cshop-nm">Varsayılan</div>
      <div className="bp-foot">
        {selected == null ? (
          <Button variant="secondary" className="bp-act" disabled>
            <Icon name="check" size={14} /> Kullanılıyor
          </Button>
        ) : (
          <>
            <span className="bp-have-tag">Sende var</span>
            <Button variant="default" className="bp-act" onClick={() => onSelect(null)}>Kullan</Button>
          </>
        )}
      </div>
    </div>
  )

  const body = (
    <>
      <div className="cshop-head">
        <h2><Icon name="palette" size={20} /> Pul Tasarımları</h2>
        <div className="cshop-bal">Bakiye <Coins amount={coins} size={16} /></div>
      </div>
      <p className="cshop-sub">Bir malzeme veya yüzey modeli seç; renk seçmene gerek yok — seçtiğin yüzey, kullandığın tahtanın kendi pul renklerine otomatik uyar. Oyunda pulların bu modelle görünür.</p>

      <div className="bp-have-line">
        <strong>{ownedCount}</strong> / {total} tasarıma sahipsin
      </div>
      <div className="bp-filters" role="tablist" aria-label="Pul filtreleri">
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
        <>
          {noneVisible && (
            <div className="rarity-group">
              <div className="rarity-title"><span className="rarity-dot" /> Varsayılan</div>
              <div className="cshop-grid">{noneCard}</div>
            </div>
          )}
          {CHECKER_GROUP_ORDER.map((tier) => {
            const group = shown.filter((s) => s.rarity === tier && passFilter(owns(s.id)))
            if (group.length === 0) return null
            return (
              <div className="rarity-group" key={tier} style={{ ['--rarity-color']: RARITY_COLORS[tier] } as CSSProperties}>
                <div className="rarity-title">
                  <span className="rarity-dot" /> {t('rarity.' + tier)}
                  <span className="rarity-count">{group.length}</span>
                </div>
                <div className="cshop-grid">{group.map(renderCard)}</div>
              </div>
            )
          })}
        </>
      )}

      {hover && (
        <HoverZoom rect={hover.rect} width={240} height={206} onDismiss={() => setHover(null)}>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center', padding: '16px 0 4px' }}>
            <CheckerSkin skin={hover.s} tone="dark" size={120} />
            <CheckerSkin skin={hover.s} tone="light" size={96} />
          </div>
          <div className="bp-hover-name">{hover.s.name}</div>
        </HoverZoom>
      )}
    </>
  )
  if (embedded) return <div className="cshop-embed">{body}</div>
  return (
    <div className="register-overlay modal page cshop-overlay" role="dialog" aria-modal="true">
      <div className="register-card cshop-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => onClose?.()} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        {body}
      </div>
    </div>
  )
}

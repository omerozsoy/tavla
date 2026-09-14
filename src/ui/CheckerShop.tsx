import { useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import Coins from './Coins'
import { useToast } from './Toast'
import { useEscape } from './useEscape'
import CheckerSkin from './CheckerSkin'
import { CHECKER_FINISHES, checkerPrice } from '../checkers'
import './CheckerShop.css'

/**
 * PUL TASARIMLARI — ücretli dijital checker materyali mağazası. 30 skin (5 aile × 6 renk),
 * coin ile alınır (mevcut /shop/buy akışı: onBuy('checker.<id>')), seçilir (onSelect).
 * Sahiplik unlocks'tan; seçim users.checker. Görsel: CheckerSkin (dark+light önizleme).
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
  const toast = useToast()
  useEscape(() => onClose?.())
  const [busy, setBusy] = useState<string | null>(null)
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

  const body = (
    <>
      <div className="cshop-head">
          <h2><Icon name="palette" size={20} /> Pul Tasarımları</h2>
          <div className="cshop-bal">Bakiye <Coins amount={coins} size={16} /></div>
        </div>
        <p className="cshop-sub">Bir malzeme (pul tarzı) seç; renk seçmene gerek yok — seçtiğin doku, kullandığın tahtanın kendi pul renklerine otomatik uyar. Oyunda pulların bu malzemeyle görünür.</p>

        {/* Varsayılan (board pulu) */}
        <button
          type="button"
          className={`cshop-default ${selected == null ? 'active' : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className="cshop-default-dot" /> Varsayılan (düz tahta pulu)
          {selected == null && <span className="cshop-badge">Seçili</span>}
        </button>

        <div className="cshop-grid">
          {CHECKER_FINISHES.map((s) => {
            const owned = owns(s.id)
            const active = selected === s.id
            return (
              <div key={s.id} className={`cshop-item ${active ? 'active' : ''}`}>
                <div className="cshop-prev">
                  <CheckerSkin skin={s} tone="dark" size={56} />
                  <CheckerSkin skin={s} tone="light" size={44} />
                </div>
                <div className="cshop-nm">{s.name}</div>
                {owned ? (
                  <Button
                    variant={active ? 'secondary' : 'default'}
                    size="default"
                    disabled={active}
                    onClick={() => onSelect(s.id)}
                  >
                    {active ? 'Seçili ✓' : 'Seç'}
                  </Button>
                ) : (
                  <Button variant="outline" size="default" disabled={busy === s.id} onClick={() => buy(s.id)}>
                    <Coins amount={checkerPrice(s)} size={14} />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
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

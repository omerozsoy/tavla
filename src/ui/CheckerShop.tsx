import { useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import Coins from './Coins'
import { useToast } from './Toast'
import { useEscape } from './useEscape'
import CheckerSkin from './CheckerSkin'
import { CHECKER_SKINS, CHECKER_FAMILIES, checkerPrice } from '../checkers'
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
}: {
  unlocks: string[]
  selected: string | null
  coins: number
  onBuy: (fullId: string) => Promise<{ owned?: boolean; insufficient?: boolean } | void>
  onSelect: (id: string | null) => void
  onClose: () => void
}) {
  const toast = useToast()
  useEscape(onClose)
  const [busy, setBusy] = useState<string | null>(null)
  const owns = (id: string) => unlocks.includes('checker.' + id)

  async function buy(id: string) {
    if (busy) return
    setBusy(id)
    try {
      const r = await onBuy('checker.' + id)
      if (r && 'insufficient' in r && r.insufficient) toast.error('Yetersiz coin.')
      else onSelect(id) // aldıktan sonra otomatik seç
    } catch {
      toast.error('Satın alınamadı.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="register-overlay modal page cshop-overlay" role="dialog" aria-modal="true">
      <div className="register-card cshop-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <div className="cshop-head">
          <h2><Icon name="palette" size={20} /> Pul Tasarımları</h2>
          <div className="cshop-bal">Bakiye <Coins amount={coins} size={16} /></div>
        </div>
        <p className="cshop-sub">Gerçek reçine/sedef/cam/metalik dokulu premium puller. Al, seç; oyunda pulların bu tasarımla görünür.</p>

        {/* Varsayılan (board pulu) */}
        <button
          type="button"
          className={`cshop-default ${selected == null ? 'active' : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className="cshop-default-dot" /> Varsayılan (tahta pulu)
          {selected == null && <span className="cshop-badge">Seçili</span>}
        </button>

        {CHECKER_FAMILIES.map((fam) => (
          <section key={fam.key} className="cshop-fam">
            <h3>{fam.label}</h3>
            <div className="cshop-grid">
              {CHECKER_SKINS.filter((s) => s.family === fam.key).map((s) => {
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
          </section>
        ))}
      </div>
    </div>
  )
}

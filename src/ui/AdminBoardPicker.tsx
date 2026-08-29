import { useState, type CSSProperties } from 'react'
import { ALL_THEMES } from '../boardThemes'
import { RARITY_COLORS } from './rarityColors'
import SetupBoard from './SetupBoard'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'club'
const RARITY_ORDER: Rarity[] = ['club', 'common', 'rare', 'epic', 'legendary', 'mythic']

// Yonetici test araci: AI'ya karsi oyunda tum tahtalari canli denemek icin sag ustte
// minik resimli tahta secici. Secim aninda setBoardTheme -> App'teki CSS degiskenleri
// guncellenir (gercek oyun tahtasi ANINDA degisir). Sadece admin + pvb'de render edilir.
export default function AdminBoardPicker({
  boardTheme,
  setBoardTheme,
}: {
  boardTheme: string
  setBoardTheme: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  useEscape(() => setOpen(false))
  const cur = ALL_THEMES.find((x) => x.id === boardTheme) ?? ALL_THEMES[0]

  return (
    <div className="admin-board-picker">
      <button
        type="button"
        className="abp-toggle"
        onClick={() => setOpen((v) => !v)}
        title="Tahta rengi (yonetici testi)"
        aria-label="Tahta rengi sec"
      >
        <span
          className="abp-swatch"
          style={{ background: cur.panel, borderColor: cur.a } as CSSProperties}
        >
          <span style={{ background: cur.a }} />
          <span style={{ background: cur.checker }} />
          <span style={{ background: cur.light ?? '#f0e8d8' }} />
        </span>
        <span className="abp-cur-name">{cur.name}</span>
        <Icon name="chevron" size={14} />
      </button>

      {open && (
        <>
          <div className="abp-backdrop" onClick={() => setOpen(false)} />
          <div className="abp-panel" role="dialog" aria-label="Tahta secimi">
            <div className="abp-head">
              <span>
                <Icon name="settings" size={15} /> Tahta ({ALL_THEMES.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
              >
                <Icon name="x" size={15} />
              </Button>
            </div>
            <div className="abp-scroll">
              {RARITY_ORDER.map((tier) => {
                const items = ALL_THEMES.filter((bt) => (bt.rarity ?? 'common') === tier)
                if (items.length === 0) return null
                return (
                  <div className="abp-group" key={tier}>
                    <div
                      className="abp-group-title"
                      style={{ ['--rarity-color']: RARITY_COLORS[tier] } as CSSProperties}
                    >
                      <span className="abp-dot" /> {tier} <span className="abp-count">{items.length}</span>
                    </div>
                    <div className="abp-grid">
                      {items.map((bt) => (
                        <button
                          key={bt.id}
                          type="button"
                          className={`abp-item ${boardTheme === bt.id ? 'active' : ''}`}
                          style={{ ['--rarity-color']: RARITY_COLORS[tier] } as CSSProperties}
                          onClick={() => setBoardTheme(bt.id)}
                          title={bt.name}
                        >
                          <SetupBoard
                            panel={bt.panel}
                            a={bt.a}
                            b={bt.b}
                            checker={bt.checker}
                            cream={bt.light}
                          />
                          {boardTheme === bt.id && (
                            <span className="abp-check">
                              <Icon name="check" size={11} />
                            </span>
                          )}
                          <span className="abp-name">{bt.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

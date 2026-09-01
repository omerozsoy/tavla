/**
 * Achievements — Basarim/Rozet galerisi. Iki kip:
 *  - Tam sayfa (menu/profil): overlay + featured secimi (giris gerekli).
 *  - embed (Bilgi > Rozetler sekmesi / misafir): salt-okunur "nasil alinir" listesi.
 * Mevcut tasarim dili: register-overlay/card, prof-ov-tabs chip'leri, Icon, Button.
 */

import { useEffect, useMemo, useState } from 'react'
import './achievements.css'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { useToast } from './Toast'
import {
  fetchAchievements,
  fetchPublicAchievements,
  setFeaturedBadges,
  type AchievementItem,
} from '../api'

// Kategori sirasi + filtre ikonu (etiketler i18n: ach.cat.<key>).
const CATEGORIES: { key: string; icon: IconName }[] = [
  { key: 'all', icon: 'star' },
  { key: 'match', icon: 'dice' },
  { key: 'wins', icon: 'trophy' },
  { key: 'streak', icon: 'flame' },
  { key: 'tavla', icon: 'target' },
  { key: 'dice', icon: 'dice' },
  { key: 'analysis', icon: 'star' },
  { key: 'cube', icon: 'target' },
  { key: 'coin', icon: 'gift' },
  { key: 'tournament', icon: 'trophy' },
  { key: 'rating', icon: 'crown' },
  { key: 'social', icon: 'users' },
  { key: 'fun', icon: 'dice' },
  { key: 'hidden', icon: 'lock-key' },
]

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const

interface Props {
  onClose?: () => void
  embed?: boolean // Bilgi sekmesi icine gomulu (overlay yok)
  loggedIn?: boolean
}

export default function Achievements({ onClose, embed = false, loggedIn = true }: Props) {
  const { t } = useT()
  const notify = useToast()
  const [items, setItems] = useState<AchievementItem[] | null>(null)
  const [featured, setFeatured] = useState<string[]>([])
  const [cat, setCat] = useState('all')
  const [sel, setSel] = useState<AchievementItem | null>(null)
  const [saving, setSaving] = useState(false)
  useEscape(() => (sel ? setSel(null) : onClose?.()))

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (loggedIn) {
          const data = await fetchAchievements()
          if (!alive) return
          setItems(data.items)
          setFeatured(data.featured ?? [])
        } else {
          const data = await fetchPublicAchievements()
          if (!alive) return
          setItems(data.items)
        }
      } catch {
        if (alive) setItems([])
      }
    })()
    return () => {
      alive = false
    }
  }, [loggedIn])

  const unlockedCount = useMemo(() => (items ?? []).filter((i) => i.unlocked).length, [items])
  const rarityCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of items ?? []) if (i.unlocked) m[i.rarity] = (m[i.rarity] ?? 0) + 1
    return m
  }, [items])
  const cats = useMemo(() => {
    const present = new Set((items ?? []).map((i) => i.category))
    return CATEGORIES.filter((c) => c.key === 'all' || present.has(c.key))
  }, [items])
  const shown = useMemo(
    () => (items ?? []).filter((i) => cat === 'all' || i.category === cat),
    [items, cat],
  )

  async function toggleFeatured(slug: string) {
    const isOn = featured.includes(slug)
    let next: string[]
    if (isOn) next = featured.filter((s) => s !== slug)
    else {
      if (featured.length >= 3) {
        notify.show(t('ach.featureMax'), 'info')
        return
      }
      next = [...featured, slug]
    }
    setSaving(true)
    try {
      const res = await setFeaturedBadges(next)
      setFeatured(res.featured.map((f) => f.slug))
    } catch {
      notify.show(t('ach.saveErr'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const body = (
    <>
      {!embed && (
        <div className="ach-summary">
          <div className="ach-sum-total">
            <Icon name="medal" size={22} />
            <div>
              <div className="ach-sum-num">
                {unlockedCount} <span className="ach-sum-den">/ {items?.length ?? 0}</span>
              </div>
              <div className="ach-sum-lbl">{t('ach.total')}</div>
            </div>
          </div>
          <div className="ach-sum-rarity">
            {RARITIES.map((r) =>
              rarityCounts[r] ? (
                <span key={r} className={`ach-rchip rarity-${r}`}>
                  {t(`ach.rarity.${r}`)} {rarityCounts[r]}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Kategori filtreleri */}
      <div className="ach-cats" role="tablist">
        {cats.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={cat === c.key}
            className={`ach-cat ${cat === c.key ? 'active' : ''}`}
            onClick={() => setCat(c.key)}
          >
            <Icon name={c.icon} size={14} /> {t(`ach.cat.${c.key}`)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {items === null ? (
        <div className="ach-loading">{t('common.loading')}</div>
      ) : shown.length === 0 ? (
        <div className="ach-empty">{t('ach.empty')}</div>
      ) : (
        <div className="ach-grid">
          {shown.map((a) => {
            const mystery = a.hidden && !a.unlocked
            return (
              <button
                key={a.slug}
                type="button"
                className={`ach-card ${a.unlocked ? 'unlocked' : 'locked'} tier-${a.tier ?? 'none'} rarity-${a.rarity}`}
                onClick={() => setSel(a)}
                title={mystery ? '???' : a.name}
              >
                {featured.includes(a.slug) && (
                  <span className="ach-fstar" aria-hidden="true">
                    <Icon name="star" size={12} />
                  </span>
                )}
                <span className="ach-ic">
                  <Icon name={(mystery ? 'lock-key' : (a.icon as IconName)) || 'medal'} size={26} />
                </span>
                <span className="ach-name">{mystery ? '???' : a.name}</span>
                {a.tier && <span className="ach-tier">{t(`ach.tier.${a.tier}`)}</span>}
                {!a.unlocked && !a.hidden && a.target > 1 && (
                  <span className="ach-bar">
                    <span className="ach-bar-fill" style={{ width: `${a.progressPct}%` }} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Detay modal */}
      {sel && (
        <div className="ach-detail-scrim" onClick={() => setSel(null)}>
          <div
            className={`ach-detail tier-${sel.tier ?? 'none'} rarity-${sel.rarity}`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="ach-detail-ic">
              <Icon name={(sel.hidden && !sel.unlocked ? 'lock-key' : (sel.icon as IconName)) || 'medal'} size={40} />
            </span>
            <h3>{sel.hidden && !sel.unlocked ? '???' : sel.name}</h3>
            <div className="ach-detail-tags">
              {sel.tier && <span className={`ach-tag tier-${sel.tier}`}>{t(`ach.tier.${sel.tier}`)}</span>}
              <span className={`ach-tag rarity-${sel.rarity}`}>{t(`ach.rarity.${sel.rarity}`)}</span>
              {sel.rewardCoin > 0 && (
                <span className="ach-tag reward">
                  <Icon name="coins" size={12} /> +{sel.rewardCoin}
                </span>
              )}
            </div>
            <p className="ach-detail-desc">{sel.hidden && !sel.unlocked ? t('ach.hiddenHint') : sel.desc}</p>

            {!sel.unlocked && !sel.hidden && sel.target > 1 && (
              <div className="ach-detail-prog">
                <div className="ach-bar">
                  <span className="ach-bar-fill" style={{ width: `${sel.progressPct}%` }} />
                </div>
                <div className="ach-detail-progtxt">
                  {sel.progress.toLocaleString('tr-TR')} / {sel.target.toLocaleString('tr-TR')} · %{sel.progressPct}
                </div>
              </div>
            )}

            <div className="ach-detail-meta">
              {sel.unlocked && sel.unlockedAt && (
                <span>
                  <Icon name="check" size={13} /> {t('ach.unlockedOn')}{' '}
                  {new Date(sel.unlockedAt).toLocaleDateString('tr-TR')}
                </span>
              )}
              <span>{t('ach.earnedBy', { pct: String(sel.rarityPct) })}</span>
            </div>

            {!embed && sel.unlocked && (
              <Button
                variant={featured.includes(sel.slug) ? 'secondary' : 'outline'}
                onClick={() => toggleFeatured(sel.slug)}
                disabled={saving}
                className="ach-feature-btn"
              >
                <Icon name="star" size={15} />
                {featured.includes(sel.slug) ? t('ach.unfeature') : t('ach.feature')}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )

  if (embed) return <div className="info-tab-pane ach-embed">{body}</div>

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card ach-card-wrap" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="medal" size={20} /> {t('ach.title')}
        </h2>
        {body}
      </div>
    </div>
  )
}

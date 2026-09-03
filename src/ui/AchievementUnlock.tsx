/**
 * AchievementUnlock — mac sonunda acilan rozetler icin premium ama kisa reveal.
 * Kuyruk: birden fazla rozet sirayla gosterilir, her biri ~3.6sn sonra otomatik ilerler.
 * Oyunu engellemez: ust-orta banner, kullanici kapatabilir / "Rozeti Gor" ile galeriyi acar.
 */

import { useEffect, useState } from 'react'
import './achievements.css'
import { Icon } from './Icon'
import { Coins } from './Coins'
import type { IconName } from './Icon'
import { useT } from '../i18n'
import type { UnlockedAchievement } from '../api'

interface Props {
  items: UnlockedAchievement[]
  onClose: () => void
  onView?: () => void
}

export default function AchievementUnlock({ items, onClose, onView }: Props) {
  const { t } = useT()
  const [idx, setIdx] = useState(0)
  const [leaving, setLeaving] = useState(false)

  const cur = items[idx]

  useEffect(() => {
    if (!cur) return
    setLeaving(false)
    const outT = setTimeout(() => setLeaving(true), 3100)
    const nextT = setTimeout(() => {
      if (idx + 1 < items.length) setIdx(idx + 1)
      else onClose()
    }, 3600)
    return () => {
      clearTimeout(outT)
      clearTimeout(nextT)
    }
  }, [idx, cur, items.length, onClose])

  if (!cur) return null

  return (
    <div className="ach-unlock-wrap" aria-live="polite">
      <div
        key={cur.slug}
        className={`ach-unlock tier-${cur.tier ?? 'none'} rarity-${cur.rarity} ${leaving ? 'leaving' : 'entering'}`}
        role="status"
      >
        <div className="ach-unlock-glow" aria-hidden="true" />
        <span className="ach-unlock-ic">
          <Icon name={(cur.icon as IconName) || 'medal'} size={34} />
        </span>
        <div className="ach-unlock-txt">
          <div className="ach-unlock-kicker">
            <Icon name="trophy" size={12} /> {t('ach.unlockTitle')}
          </div>
          <div className="ach-unlock-name">{cur.name}</div>
          <div className="ach-unlock-desc">{cur.desc}</div>
          {cur.rewardCoin > 0 && (
            <div className="ach-unlock-reward">
              <Coins amount={cur.rewardCoin} gain size={13} />
            </div>
          )}
        </div>
        <div className="ach-unlock-actions">
          {onView && (
            <button type="button" className="ach-unlock-view" onClick={onView}>
              {t('ach.viewBadge')}
            </button>
          )}
          <button type="button" className="ach-unlock-x" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={14} />
          </button>
        </div>
        {items.length > 1 && (
          <div className="ach-unlock-count">
            {idx + 1}/{items.length}
          </div>
        )}
      </div>
    </div>
  )
}

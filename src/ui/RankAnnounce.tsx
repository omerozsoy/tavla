/**
 * RankAnnounce — admin "Duyuru bannerı" açıkken sitenin üstünde çıkan ince bilgi şeridi:
 * "Rütbe sistemi yenilendi" + /bilgi/rutbeler'e köprü. Kullanıcı kapatınca localStorage'da
 * kalır (bir daha gösterilmez). Kaynak: /api/rank-divisions `announce` bayrağı (admin toggle).
 */
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { getRankDivisions } from '../api'

const KEY = 'tavla.rankAnnounceDismissed'

export default function RankAnnounce() {
  const { t } = useT()
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '1') return
    } catch {
      /* localStorage kapalı -> yine de göster */
    }
    getRankDivisions()
      .then((c) => setShow(!!c.announce))
      .catch(() => {})
  }, [])

  if (!show) return null

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* yoksay */
    }
    setShow(false)
  }

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'center',
        flexWrap: 'wrap',
        padding: '8px 14px',
        fontSize: '.85rem',
        background: 'color-mix(in srgb, var(--accent-text, #c9563f) 14%, var(--card-bg, #fff))',
        borderBottom: '1px solid color-mix(in srgb, var(--accent-text, #c9563f) 30%, transparent)',
        color: 'var(--text, #1a1a1a)',
      }}
    >
      <span>{t('rank.announceText')}</span>
      <a
        href="/bilgi/rutbeler"
        style={{ fontWeight: 600, color: 'var(--accent-text, #c9563f)', textDecoration: 'underline' }}
      >
        {t('rank.announceCta')}
      </a>
      <button
        onClick={dismiss}
        aria-label={t('common.close')}
        style={{
          marginLeft: 4,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          color: 'var(--muted, #888)',
        }}
      >
        ×
      </button>
    </div>
  )
}

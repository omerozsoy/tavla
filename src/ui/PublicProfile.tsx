import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { userProfile, type PublicProfile as Profile } from '../api'
import AvatarFrame from './AvatarFrame'
import { DivisionChip, BadgeList } from './Badges'

// Herkese acik oyuncu profili karti (liderlik/rakip isminden acilir)
export default function PublicProfile({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [p, setP] = useState<Profile | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setP(null)
    setError(false)
    userProfile(id)
      .then((d) => alive && setP(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [id])

  const wr = p && p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0

  return (
    <div className="register-overlay modal">
      <div className="register-card pp-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>

        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && !p && <div className="lb-empty">{t('an.loading')}</div>}

        {p && (
          <>
            <div className="pp-head">
              <AvatarFrame src={p.avatar} frame={p.frame} size={64} name={p.name} animated={true} />
              <div className="pp-id">
                <div className="pp-name">{p.name}</div>
                <div className="pp-rank">{t('stats.rank', { r: p.rank, n: '' }).replace('/ ', '')}</div>
              </div>
              <div className="pp-rating">
                {p.rating}
                <div className="pp-coins">
                  <Icon name="coin" size={14} /> {p.coins}
                </div>
              </div>
            </div>

            <DivisionChip rating={p.rating} />

            <div className="pp-grid">
              <div className="pp-box">
                <div className="pp-val">{p.games}</div>
                <div className="pp-lbl">{t('stats.games')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val good">{p.wins}</div>
                <div className="pp-lbl">{t('stats.wins')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val bad">{p.losses}</div>
                <div className="pp-lbl">{t('stats.losses')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val">{p.games > 0 ? `%${wr}` : '–'}</div>
                <div className="pp-lbl">{t('stats.winRate')}</div>
              </div>
            </div>

            {p.form.length > 0 && (
              <div className="pp-form">
                <span className="pp-form-lbl">{t('stats.form')}</span>
                {p.form.map((w, i) => (
                  <span key={i} className={`pp-dot ${w ? 'win' : 'loss'}`}>
                    {w ? 'G' : 'M'}
                  </span>
                ))}
              </div>
            )}

            <BadgeList ids={p.badges} />
          </>
        )}
      </div>
    </div>
  )
}

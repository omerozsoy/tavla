import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { PLANS, type PlanId } from '../plans'
import { startTrial, subscribe, type ServerUser } from '../api'

export default function Membership({
  current,
  trialUsed,
  onUpgraded,
  onClose,
}: {
  current: PlanId
  trialUsed: boolean
  onUpgraded: (u: ServerUser) => void
  onClose: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  const [yearly, setYearly] = useState(true)
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [err, setErr] = useState('')

  async function trial(plan: 'star' | 'starpro') {
    setErr('')
    setBusy(plan)
    try {
      const r = await startTrial(plan)
      onUpgraded(r.user)
      onClose()
    } catch (e) {
      const m = e as { message?: string }
      setErr(m?.message || t('mem.err'))
    } finally {
      setBusy(null)
    }
  }

  async function pay(plan: 'star' | 'starpro') {
    setErr('')
    setBusy(plan)
    try {
      const r = await subscribe(plan, yearly ? 'yearly' : 'monthly')
      window.location.href = r.url // Garanti kart sayfasina yonlendir
    } catch (e) {
      const m = e as { message?: string }
      setErr(m?.message || t('mem.err'))
      setBusy(null)
    }
  }

  return (
    <div className="register-overlay modal mem-overlay">
      <div className="mem-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2 className="mem-title">{t('mem.title')}</h2>

        <div className="mem-toggle">
          <button className={yearly ? 'active' : ''} onClick={() => setYearly(true)}>
            {t('mem.yearly')}
          </button>
          <button className={!yearly ? 'active' : ''} onClick={() => setYearly(false)}>
            {t('mem.monthly')}
          </button>
        </div>

        {err && <div className="register-error mem-err">{err}</div>}

        <div className="mem-grid">
          {PLANS.map((p) => {
            const isCurrent = current === p.id
            const price = yearly ? p.yearly : p.monthly
            return (
              <div key={p.id} className={`mem-plan ${p.id !== 'free' ? 'paid' : ''}`}>
                {yearly && p.id !== 'free' && <span className="mem-save">{t('mem.save')}</span>}
                <div className="mem-plan-name" style={{ color: p.color }}>
                  {t(p.nameKey)}
                </div>
                <ul className="mem-feats">
                  {p.features.map((f) => (
                    <li key={f.key} className={f.on ? 'on' : 'off'}>
                      <Icon name={f.on ? 'check' : 'x'} size={14} /> {t(f.key)}
                    </li>
                  ))}
                </ul>
                <div className="mem-cta">
                  {isCurrent ? (
                    <button className="mem-btn current" disabled>
                      {t('mem.current')}
                    </button>
                  ) : p.id === 'free' ? (
                    <span className="mem-free-note">—</span>
                  ) : (
                    <>
                      <button
                        className="mem-btn buy"
                        style={{ background: p.color }}
                        disabled={busy !== null || trialUsed}
                        onClick={() => trial(p.id as 'star' | 'starpro')}
                      >
                        {busy === p.id ? '…' : trialUsed ? t('mem.trialUsed') : t('mem.tryFree')}
                      </button>
                      <button
                        className="mem-sub"
                        disabled={busy !== null}
                        onClick={() => pay(p.id as 'star' | 'starpro')}
                      >
                        {t('mem.subscribe')}
                      </button>
                      <div className="mem-price">
                        {t('mem.after', {
                          price: `$${price.toFixed(2)}`,
                          period: yearly ? t('mem.perYear') : t('mem.perMonth'),
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mem-foot">{t('mem.trialNote')}</p>
      </div>
    </div>
  )
}

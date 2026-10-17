import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { ApiError, referralStatus, sendReferralInvite, type ReferralStatus } from '../api'

/**
 * "Arkadaşını Davet Et, 5000 coin kazan" kartı — Oyun Arayanlar'ın üstünde.
 * Davet eden arkadaşının e-postasına davet maili yollar; davet edilen İLK puanlı online maçını
 * yapınca iki tarafa coin gider (backend Referral::maybeReward). Kartta gereken maç + kalan hak
 * gösterilir. Misafire teaser + "Üye Ol" CTA.
 *
 * Tasarım: Swiss / International Typographic Style — katı grid, ince kural çizgileri, güçlü
 * tipografik hiyerarşi (ödül tutarı kahraman rakam), tek aksan (terracotta) + monokrom, keskin
 * köşe, gölge/degrade/ornament YOK. Site token'larıyla tema-duyarlı.
 */
export default function InviteFriendCard({ loggedIn, onLogin }: { loggedIn: boolean; onLogin?: () => void }) {
  const { t } = useT()
  const [st, setSt] = useState<ReferralStatus | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!loggedIn) return
    let alive = true
    referralStatus()
      .then((r) => alive && setSt(r))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [loggedIn])

  const reward = st?.reward ?? 5000
  const out = st?.remaining_today === 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      setMsg({ ok: false, text: t('invite.badEmail') })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const r = await sendReferralInvite(v)
      setEmail('')
      setMsg({ ok: true, text: t('invite.sent') })
      setSt((s) => (s ? { ...s, remaining_today: r.remaining_today } : s))
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : t('invite.failed') })
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!st?.link) return
    try {
      await navigator.clipboard.writeText(st.link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard engelli -> sessiz */
    }
  }

  return (
    <section className="rfr-card">
      <div className="rfr-top">
        <Icon name="gift" size={17} className="rfr-ico" />
        <h3 className="rfr-title">{t('invite.title')}</h3>
      </div>
      <div className="rfr-reward" aria-hidden>
        <span className="rfr-amount">{reward.toLocaleString('tr-TR')}</span>
        <span className="rfr-unit">
          <span>COIN</span>
          <span>{t('invite.both')}</span>
        </span>
      </div>
      <p className="rfr-sub">{t('invite.sub', { n: reward.toLocaleString('tr-TR') })}</p>

      {loggedIn ? (
        <>
          <form className="rfr-form" onSubmit={submit}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="rfr-input"
              placeholder={t('invite.placeholder')}
              aria-label={t('invite.placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy || out}
            />
            <button type="submit" className="rfr-btn" disabled={busy || out}>
              {t('invite.send')} &rarr;
            </button>
          </form>

          {msg && <div className={`rfr-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

          <div className="rfr-rule" aria-hidden />

          <div className="rfr-meta">
            <span className="rfr-stat">{t('invite.needMatch')}</span>
            <span className={`rfr-stat ${out ? 'err' : ''}`}>
              {t('invite.remaining', { n: st?.remaining_today ?? '—', t: st?.daily_limit ?? 5 })}
            </span>
            {!!st?.count && <span className="rfr-stat on">{t('invite.earned', { n: st.count })}</span>}
          </div>

          {st?.link && (
            <button type="button" className="rfr-link" onClick={copy} title={st.link}>
              {copied ? t('invite.copied') : st.link}
            </button>
          )}
        </>
      ) : (
        <div className="rfr-guest">
          <span className="rfr-stat">{t('invite.needMatch')}</span>
          <button type="button" className="rfr-btn" onClick={onLogin}>
            {t('invite.join')} &rarr;
          </button>
        </div>
      )}
    </section>
  )
}

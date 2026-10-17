import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { ApiError, referralStatus, sendReferralInvite, type ReferralStatus } from '../api'

/**
 * "Arkadaşını Davet Et, 5000 coin kazan" kartı — Oyun Arayanlar'ın üstünde (yarım grid).
 * Davet eden arkadaşının e-postasına davet maili yollar; davet edilen İLK puanlı online maçını
 * yapınca iki tarafa coin gider (backend Referral::maybeReward). Kartta gereken maç + kalan hak
 * gösterilir. Misafire teaser + "Üye Ol" CTA.
 *
 * Tasarım: sıcak terracotta (marka aksanı) "ödül kuponu" — üstte kavisli parıltı, kesikli bilet
 * ayracı, kabartmalı coin rozeti. Site token'larıyla (--card-bg/--accent/--coral) tema-duyarlı.
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
    <section className="invite-card home-panel">
      <span className="invite-glow" aria-hidden />
      <div className="invite-head">
        <span className="invite-gift" aria-hidden>
          <Icon name="gift" size={22} />
        </span>
        <div className="invite-head-txt">
          <h3 className="invite-title">{t('invite.title')}</h3>
          <p className="invite-sub">{t('invite.sub', { n: reward.toLocaleString('tr-TR') })}</p>
        </div>
        <span className="invite-reward">
          +{reward.toLocaleString('tr-TR')}
          <Icon name="coin" size={15} />
        </span>
      </div>

      {loggedIn ? (
        <>
          <form className="invite-form" onSubmit={submit}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="invite-input"
              placeholder={t('invite.placeholder')}
              aria-label={t('invite.placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy || out}
            />
            <Button type="submit" disabled={busy || out}>
              <Icon name="paper-plane-right" size={16} /> {t('invite.send')}
            </Button>
          </form>

          {msg && <div className={`invite-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

          <span className="invite-dash" aria-hidden />

          <div className="invite-meta">
            <span className="invite-chip">
              <Icon name="target" size={13} /> {t('invite.needMatch')}
            </span>
            <span className={`invite-chip ${out ? 'err' : ''}`}>
              <Icon name="dice" size={13} />{' '}
              {t('invite.remaining', { n: st?.remaining_today ?? '—', t: st?.daily_limit ?? 5 })}
            </span>
            {!!st?.count && (
              <span className="invite-chip earned">
                <Icon name="users" size={13} /> {t('invite.earned', { n: st.count })}
              </span>
            )}
          </div>

          {st?.link && (
            <button type="button" className="invite-link" onClick={copy} title={st.link}>
              <Icon name={copied ? 'shield-check' : 'copy'} size={14} />
              <span className="invite-link-txt">{copied ? t('invite.copied') : st.link}</span>
            </button>
          )}
        </>
      ) : (
        <div className="invite-guest">
          <span className="invite-chip">
            <Icon name="target" size={13} /> {t('invite.needMatch')}
          </span>
          <Button onClick={onLogin}>
            <Icon name="user-plus" size={16} /> {t('invite.join')}
          </Button>
        </div>
      )}
    </section>
  )
}

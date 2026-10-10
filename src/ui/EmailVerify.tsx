import { useState } from 'react'
import { Icon } from './Icon'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as api from '../api'
import type { ServerUser } from '../api'

interface Props {
  onVerified: (u: ServerUser) => void
  // 'banner' = profil kartindaki kompakt amber cip (varsayilan).
  // 'gate'   = tam ekran dogrulama duvari icin koyu, dikey, gosterisli yerlesim (EmailGate).
  tone?: 'banner' | 'gate'
}

// E-posta doğrulama: "Tekrar gönder" ile e-postaya 6 haneli kod + link gider; kod kutusuna
// girilince hesap ANINDA doğrulanır (link beklemeden). Telefon OTP (PhoneVerify) ile aynı desen.
export default function EmailVerify({ onVerified, tone = 'banner' }: Props) {
  const { t } = useT()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    setErr('')
    setBusy(true)
    try {
      await api.resendVerification()
      setSent(true)
    } catch (e) {
      setErr(e instanceof api.ApiError && e.status === 429 ? t('verify.phoneCooldown') : t('verify.phoneErr'))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    if (code.length !== 6) return
    setErr('')
    setBusy(true)
    try {
      const u = await api.verifyEmailCode(code)
      onVerified(u)
    } catch (e) {
      setErr(e instanceof api.ApiError && e.status === 429 ? t('verify.phoneCooldown') : t('verify.phoneErr'))
    } finally {
      setBusy(false)
    }
  }

  // DUVAR (gate) yerlesimi: kod kutusu HER ZAMAN gorunur (duvara gelen zaten kayitta kod aldi) —
  // buyuk ortali kod alani + tam-genislik "Doğrula" + sessiz "Tekrar gönder" baglantisi.
  if (tone === 'gate') {
    const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing && code.length === 6 && !busy) {
        e.preventDefault()
        void verify()
      }
    }
    return (
      <div className="verify-gate">
        <input
          className="verify-gate-code"
          type="tel"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={t('verify.phoneCode')}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={onEnter}
          maxLength={6}
          autoFocus
        />
        <button
          type="button"
          className="verify-gate-primary"
          disabled={busy || code.length !== 6}
          onClick={verify}
        >
          {busy ? '…' : t('verify.phoneVerify')}
        </button>
        <div className="verify-gate-foot">
          {err ? (
            <span className="verify-gate-err" role="alert">
              {err}
            </span>
          ) : sent ? (
            <span className="verify-gate-sent" role="status">
              <Icon name="check" size={14} /> {t('verify.sent')}
            </span>
          ) : (
            <span className="verify-gate-hint">{t('verify.gateHint')}</span>
          )}
          <button type="button" className="verify-gate-resend" disabled={busy} onClick={send}>
            {t('verify.resend')}
          </button>
        </div>
      </div>
    )
  }

  // BANNER (profil karti) yerlesimi — degismedi.
  return (
    <div className="verify-bar profile-verify">
      <Icon name="alert" size={15} />
      {!sent ? (
        <>
          <span>{t('verify.needed')}</span>
          <Button type="button" variant="ghost" disabled={busy} onClick={send}>
            {t('verify.resend')}
          </Button>
        </>
      ) : (
        <>
          <span>{t('verify.sent')}</span>
          <Input
            type="tel"
            inputMode="numeric"
            placeholder={t('verify.phoneCode')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ width: 110 }}
          />
          <Button type="button" variant="ghost" disabled={busy || code.length !== 6} onClick={verify}>
            {t('verify.phoneVerify')}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={send}>
            {t('verify.resend')}
          </Button>
        </>
      )}
      {err && <span className="verify-sent" role="alert" style={{ color: 'var(--destructive, #c0392b)' }}>{err}</span>}
    </div>
  )
}

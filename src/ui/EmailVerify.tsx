import { useState } from 'react'
import { Icon } from './Icon'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as api from '../api'
import type { ServerUser } from '../api'

interface Props {
  onVerified: (u: ServerUser) => void
}

// E-posta doğrulama: "Tekrar gönder" ile e-postaya 6 haneli kod + link gider; kod kutusuna
// girilince hesap ANINDA doğrulanır (link beklemeden). Telefon OTP (PhoneVerify) ile aynı desen.
export default function EmailVerify({ onVerified }: Props) {
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

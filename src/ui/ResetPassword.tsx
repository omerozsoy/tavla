import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
import * as api from '../api'

interface Props {
  email: string
  token: string
  onDone: () => void
}

export default function ResetPassword({ email, token, onDone }: Props) {
  const { t } = useT()
  useEscape(onDone)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError(t('reset.tooShort'))
      return
    }
    if (password !== password2) {
      setError(t('reset.mismatch'))
      return
    }
    setBusy(true)
    try {
      await api.resetPassword(email, token, password)
      setDone(true)
    } catch {
      setError(t('reset.fail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="register-overlay">
      <form className="register-card" onSubmit={submit}>
        <h2><Icon name="lock" size={20} /> {t('reset.title')}</h2>
        {done ? (
          <>
            <p className="register-sub">{t('reset.success')}</p>
            <Button type="button" variant="default" onClick={onDone}>
              {t('reset.toLogin')}
            </Button>
          </>
        ) : (
          <>
            <p className="register-sub">{email}</p>
            <label>
              {t('reset.newPassword')}
              <div className="pw-field">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={t(showPw ? 'auth.hidePw' : 'auth.showPw')}
                  title={t(showPw ? 'auth.hidePw' : 'auth.showPw')}
                >
                  <Icon name="eye" size={16} />
                </button>
              </div>
            </label>
            <label>
              {t('reset.confirm')}
              <input
                type={showPw ? 'text' : 'password'}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && <div className="register-error" role="alert">{error}</div>}
            <div className="register-actions">
              <Button type="button" variant="secondary" onClick={onDone}>
                {t('reg.cancel')}
              </Button>
              <Button type="submit" variant="default" disabled={busy}>
                {t('reset.submit')}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

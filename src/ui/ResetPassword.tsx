import { useState } from 'react'
import { useT } from '../i18n'
import * as api from '../api'

interface Props {
  email: string
  token: string
  onDone: () => void
}

export default function ResetPassword({ email, token, onDone }: Props) {
  const { t } = useT()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
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
        <h2>🔒 {t('reset.title')}</h2>
        {done ? (
          <>
            <p className="register-sub">{t('reset.success')}</p>
            <button type="button" className="galaxy-btn roll" onClick={onDone}>
              {t('reset.toLogin')}
            </button>
          </>
        ) : (
          <>
            <p className="register-sub">{email}</p>
            <label>
              {t('reset.newPassword')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              {t('reset.confirm')}
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
            </label>
            {error && <div className="register-error">{error}</div>}
            <div className="register-actions">
              <button type="button" className="menu-btn" onClick={onDone}>
                {t('reg.cancel')}
              </button>
              <button type="submit" className="galaxy-btn roll" disabled={busy}>
                {t('reset.submit')}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

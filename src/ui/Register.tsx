import { useState } from 'react'
import type { Profile } from '../storage'
import { isNicknameTaken } from '../storage'
import { countryOptions } from '../countries'
import { useT } from '../i18n'

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export default function Register({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Profile | null
  onDone: (p: Profile) => void
  onCancel?: () => void
}) {
  const { t, lang } = useT()
  const [firstName, setFirstName] = useState(initial?.firstName ?? '')
  const [lastName, setLastName] = useState(initial?.lastName ?? '')
  const [country, setCountry] = useState(initial?.country ?? '')
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [error, setError] = useState('')

  const nickTaken = isNicknameTaken(nickname, initial?.nickname)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !country.trim() || !nickname.trim()) {
      setError(t('reg.fillAll'))
      return
    }
    if (nickTaken) {
      setError(t('reg.nickTaken'))
      return
    }
    if (!isEmail(email)) {
      setError(t('reg.validEmail'))
      return
    }
    onDone({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      country: country.trim(),
      nickname: nickname.trim(),
      email: email.trim(),
    })
  }

  const title = initial ? t('reg.titleEdit') : t('reg.titleNew')

  return (
    <div className="register-overlay">
      <form className="register-card" onSubmit={submit}>
        <h2>{t('reg.brandTitle', { title, brand: t('brand.name') })}</h2>
        <p className="register-sub">{t('reg.sub')}</p>

        <label>
          {t('reg.firstName')}
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
        </label>
        <label>
          {t('reg.lastName')}
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
        <label>
          {t('reg.country')}
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">{t('reg.countryPlaceholder')}</option>
            {countryOptions(lang).map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('reg.nickname')}
          <input
            className={nickTaken ? 'invalid' : ''}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="username"
          />
          {nickTaken && <span className="field-error" role="alert">{t('reg.nickTaken')}</span>}
        </label>
        <label>
          {t('reg.email')}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        {error && <div className="register-error" role="alert">{error}</div>}

        <div className="register-actions">
          {onCancel && (
            <button type="button" className="menu-btn" onClick={onCancel}>
              {t('reg.cancel')}
            </button>
          )}
          <button type="submit" className="galaxy-btn" disabled={nickTaken}>
            {initial ? t('reg.submitEdit') : t('reg.submitNew')}
          </button>
        </div>
      </form>
    </div>
  )
}

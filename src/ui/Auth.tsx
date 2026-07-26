import { useEffect, useRef, useState } from 'react'
import type { Profile } from '../storage'
import { COUNTRIES } from '../countries'
import { useT } from '../i18n'
import * as api from '../api'
import type { ServerUser } from '../api'

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

interface Props {
  editUser?: ServerUser | null
  editGuest?: Profile | null
  onAuthed: (user: ServerUser, isNew?: boolean) => void
  onGuest: (profile: Profile) => void
  onCancel?: () => void
  onDeleteAccount?: () => void // profil duzenlemede hesabi sil
  modal?: boolean // true: yari saydam arka planla modal pencere
}

export default function Auth({
  editUser,
  editGuest,
  onAuthed,
  onGuest,
  onCancel,
  onDeleteAccount,
  modal,
}: Props) {
  const { t } = useT()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editing = !!(editUser || editGuest)
  const seed = editUser
    ? api.toProfile(editUser)
    : editGuest || { firstName: '', lastName: '', country: '', nickname: '', email: '' }

  const [tab, setTab] = useState<'login' | 'register'>('register')
  const [firstName, setFirstName] = useState(seed.firstName)
  const [lastName, setLastName] = useState(seed.lastName)
  const [country, setCountry] = useState(seed.country)
  const [nickname, setNickname] = useState(seed.nickname)
  const [email, setEmail] = useState(seed.email)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [nickTaken, setNickTaken] = useState(false)

  // Google butonu: onAuthed'i ref'te tut (efekt bagimliligini sabit tut)
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const onAuthedRef = useRef(onAuthed)
  onAuthedRef.current = onAuthed

  useEffect(() => {
    if (editing) return
    let cancelled = false
    const handleCredential = (resp: { credential: string }) => {
      setBusy(true)
      setError('')
      api
        .googleLogin(resp.credential)
        .then(({ user, isNew }) => onAuthedRef.current(user, isNew))
        .catch(() => setError(t('auth.googleFail')))
        .finally(() => setBusy(false))
    }
    const render = (): boolean => {
      const g = (window as unknown as { google?: any }).google
      if (!g?.accounts?.id || !googleBtnRef.current || cancelled) return false
      g.accounts.id.initialize({ client_id: api.GOOGLE_CLIENT_ID, callback: handleCredential })
      googleBtnRef.current.innerHTML = ''
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_blue',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 300,
      })
      return true
    }
    if (render()) return
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => render()
    document.body.appendChild(s)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, tab])

  // Takma isim musaitlik kontrolu (API, debounce) - kayit/duzenlemede
  useEffect(() => {
    if (tab === 'login' && !editing) return
    const n = nickname.trim()
    if (!n || n === seed.nickname) {
      setNickTaken(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const ok = await api.nicknameAvailable(n)
        if (!cancelled) setNickTaken(!ok)
      } catch {
        /* sunucu yoksa kontrol atlanir */
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [nickname, tab, editing, seed.nickname])

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await api.login(loginId.trim(), password)
      onAuthed(user)
    } catch (err) {
      setError(err instanceof api.ApiError ? t('auth.failed') : t('auth.offline'))
    } finally {
      setBusy(false)
    }
  }

  function validProfile(): boolean {
    if (!firstName.trim() || !lastName.trim() || !country.trim() || !nickname.trim()) {
      setError(t('reg.fillAll'))
      return false
    }
    if (nickTaken) {
      setError(t('reg.nickTaken'))
      return false
    }
    if (!isEmail(email)) {
      setError(t('reg.validEmail'))
      return false
    }
    return true
  }

  async function doRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!validProfile()) return
    if (password.length < 6) {
      setError(t('reg.validEmail'))
      return
    }
    setBusy(true)
    try {
      const user = await api.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country.trim(),
        nickname: nickname.trim(),
        email: email.trim(),
        password,
      })
      onAuthed(user)
    } catch (err) {
      setError(err instanceof api.ApiError ? t('auth.failed') : t('auth.offline'))
    } finally {
      setBusy(false)
    }
  }

  async function doEdit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!validProfile()) return
    const p: Profile = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      country: country.trim(),
      nickname: nickname.trim(),
      email: email.trim(),
    }
    if (editUser) {
      setBusy(true)
      try {
        const user = await api.updateProfile(p)
        onAuthed(user)
      } catch {
        setError(t('auth.failed'))
      } finally {
        setBusy(false)
      }
    } else {
      onGuest(p)
    }
  }

  const title = `🌍 ${t('brand.short')} — ${
    editing ? t('reg.titleEdit') : tab === 'login' ? t('auth.login') : t('auth.register')
  }`

  const profileFields = (
    <>
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
        <input
          list="country-list"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder={t('reg.countryPlaceholder')}
        />
        <datalist id="country-list">
          {COUNTRIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label>
        {t('reg.nickname')}
        <input
          className={nickTaken ? 'invalid' : ''}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        {nickTaken && <span className="field-error">{t('reg.nickTaken')}</span>}
      </label>
      <label>
        {t('reg.email')}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
    </>
  )

  return (
    <div
      className={`register-overlay ${modal ? 'modal' : ''}`}
      onClick={modal && onCancel ? (e) => e.target === e.currentTarget && onCancel() : undefined}
    >
      <form
        className="register-card"
        onSubmit={editing ? doEdit : tab === 'login' ? doLogin : doRegister}
      >
        {modal && onCancel && (
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Kapat">
            ✕
          </button>
        )}
        <h2>{title}</h2>

        {!editing && (
          <div className="auth-tabs">
            <button
              type="button"
              className={tab === 'login' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => {
                setTab('login')
                setError('')
              }}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              className={tab === 'register' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => {
                setTab('register')
                setError('')
              }}
            >
              {t('auth.register')}
            </button>
          </div>
        )}

        {!editing && (
          <div className="google-auth">
            <div ref={googleBtnRef} className="google-btn" />
            <div className="auth-divider">{t('auth.or')}</div>
          </div>
        )}

        {!editing && tab === 'login' ? (
          <>
            <label>
              {t('auth.loginId')}
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoFocus />
            </label>
            <label>
              {t('reg.password')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            {profileFields}
            {!editUser && (
              <label>
                {t('reg.password')}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
          </>
        )}

        {error && <div className="register-error">{error}</div>}

        <div className="register-actions">
          {onCancel && (
            <button type="button" className="menu-btn" onClick={onCancel}>
              {t('reg.cancel')}
            </button>
          )}
          <button type="submit" className="galaxy-btn roll" disabled={busy || nickTaken}>
            {editing
              ? t('reg.submitEdit')
              : tab === 'login'
                ? t('auth.doLogin')
                : t('reg.submitNew')}
          </button>
        </div>

        {!editing && (
          <button
            type="button"
            className="guest-link"
            onClick={() =>
              onGuest({
                firstName: '',
                lastName: '',
                country: '',
                nickname: t('auth.guestNick'),
                email: '',
              })
            }
          >
            {t('auth.guest')}
          </button>
        )}

        {/* Hesabi sil (yalnizca yonetici) */}
        {editUser && editUser.is_admin && onDeleteAccount && (
          <div className="danger-zone">
            {confirmDelete ? (
              <>
                <div className="danger-warn">{t('account.deleteConfirm')}</div>
                <div className="register-actions">
                  <button
                    type="button"
                    className="menu-btn"
                    onClick={() => setConfirmDelete(false)}
                  >
                    {t('reg.cancel')}
                  </button>
                  <button type="button" className="danger-btn" onClick={onDeleteAccount}>
                    {t('account.deleteYes')}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="danger-link"
                onClick={() => setConfirmDelete(true)}
              >
                {t('account.delete')}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  )
}

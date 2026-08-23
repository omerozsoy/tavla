import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import type { Profile } from '../storage'
import { COUNTRIES } from '../countries'
import { useT } from '../i18n'
import * as api from '../api'
import type { ServerUser } from '../api'

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// Secilen resmi kucult (max kenar) ve JPEG data URL dondur
function resizeImage(file: File, max = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
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
  useEscape(onCancel)
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
  const [avatar, setAvatar] = useState<string | undefined>(seed.avatar)
  const [birthDate, setBirthDate] = useState(seed.birthDate ?? '')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [nickTaken, setNickTaken] = useState(false)
  const [startRating, setStartRating] = useState(1400) // baslangic seviyesi (Galaxy tarzi)
  const [forgot, setForgot] = useState(false) // sifremi unuttum modu
  const [forgotSent, setForgotSent] = useState(false)

  async function doForgot(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.forgotPassword(loginId.trim())
    } catch {
      /* guvenlik: her durumda ayni mesaj */
    } finally {
      setForgotSent(true)
      setBusy(false)
    }
  }

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

  // Sunucudan gelen dogrulama hatasini anlasilir mesaja cevir (hangi alan?)
  function apiErrorMsg(err: unknown): string {
    if (!(err instanceof api.ApiError)) return t('auth.offline')
    const f = err.errors
    if (f?.email) return t('reg.emailTaken')
    if (f?.nickname) return t('reg.nickTaken')
    if (f?.password) return t('reg.pwShort')
    const first = f ? Object.values(f)[0]?.[0] : undefined
    return first || err.message || t('auth.failed')
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await api.login(loginId.trim(), password)
      onAuthed(user)
    } catch (err) {
      // Giriste alan bazli mesaj yerine tek anlasilir uyari
      setError(err instanceof api.ApiError ? t('auth.badLogin') : t('auth.offline'))
    } finally {
      setBusy(false)
    }
  }

  function validProfile(): boolean {
    // Ulke zorunlu degil (sonra profilden eklenebilir)
    if (!firstName.trim() || !lastName.trim() || !nickname.trim()) {
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
      setError(t('reg.pwShort'))
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
        avatar,
        birthDate,
        password,
        start_rating: startRating,
      })
      onAuthed(user)
    } catch (err) {
      setError(apiErrorMsg(err))
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
      avatar,
      birthDate,
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

  const title = `${t('brand.name')} — ${
    editing ? t('reg.titleEdit') : tab === 'login' ? t('auth.login') : t('auth.register')
  }`

  const profileFields = (
    <>
      {/* Fotograf/ulke/dogum tarihi sadece profil duzenlemede (kayitta sade) */}
      {editing && (
        <div className="avatar-picker">
          <div className="avatar-preview">
            {avatar ? <img src={avatar} alt="" /> : <span><Icon name="camera" size={28} /></span>}
          </div>
          <div className="avatar-actions">
            <label className="menu-btn avatar-btn">
              {t('reg.photoPick')}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) resizeImage(f).then(setAvatar).catch(() => {})
                }}
              />
            </label>
            {avatar && (
              <button type="button" className="menu-btn" onClick={() => setAvatar(undefined)}>
                {t('reg.photoRemove')}
              </button>
            )}
          </div>
        </div>
      )}
      <label>
        {t('reg.firstName')}
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
      </label>
      <label>
        {t('reg.lastName')}
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </label>
      {editing && (
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
      )}
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
      {editing && (
        <label>
          {t('reg.birthDate')}
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
      )}
      <label>
        {t('reg.email')}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
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
        onSubmit={
          !editing && forgot ? doForgot : editing ? doEdit : tab === 'login' ? doLogin : doRegister
        }
      >
        {modal && onCancel && (
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Kapat">
            <Icon name="x" size={16} />
          </button>
        )}
        <h2>{title}</h2>

        {/* Sifremi unuttum */}
        {!editing && forgot && (
          <div className="forgot-box">
            {forgotSent ? (
              <>
                <p className="register-sub">{t('auth.forgotSent')}</p>
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => {
                    setForgot(false)
                    setForgotSent(false)
                  }}
                >
                  {t('auth.backToLogin')}
                </button>
              </>
            ) : (
              <>
                <p className="register-sub">{t('auth.forgotHelp')}</p>
                <label>
                  {t('reg.email')}
                  <input
                    type="email"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                </label>
                <div className="register-actions">
                  <button type="button" className="menu-btn" onClick={() => setForgot(false)}>
                    {t('reg.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="galaxy-btn roll"
                    disabled={busy || !loginId.trim()}
                  >
                    {t('auth.forgotSend')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!editing && !forgot && (
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

        {!editing && !forgot && (
          <div className="google-auth">
            <div ref={googleBtnRef} className="google-btn" />
            <div className="auth-divider">{t('auth.or')}</div>
          </div>
        )}

        {!forgot &&
          (!editing && tab === 'login' ? (
            <>
              <label>
                {t('auth.loginId')}
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </label>
              <label>
                {t('reg.password')}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <button
                type="button"
                className="forgot-link"
                onClick={() => {
                  setForgot(true)
                  setError('')
                }}
              >
                {t('auth.forgot')}
              </button>
            </>
          ) : (
            <>
              {profileFields}
              {!editUser && (
                <>
                  <label>
                    {t('reg.password')}
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </label>
                  <div className="reg-rating">
                    <div className="reg-rating-label">{t('reg.startLevel')}</div>
                    <div className="reg-rating-grid">
                      {[
                        { r: 900, key: 'reg.lvlBeginner' },
                        { r: 1100, key: 'reg.lvlCasual' },
                        { r: 1400, key: 'reg.lvlClub' },
                        { r: 1700, key: 'reg.lvlStrong' },
                      ].map((o) => (
                        <button
                          type="button"
                          key={o.r}
                          className={`reg-rating-opt ${startRating === o.r ? 'active' : ''}`}
                          onClick={() => setStartRating(o.r)}
                        >
                          <span className="rr-name">{t(o.key)}</span>
                          <span className="rr-num">{o.r}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          ))}

        {!forgot && error && <div className="register-error" role="alert">{error}</div>}

        {!forgot && (
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
        )}

        {!editing && !forgot && (
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

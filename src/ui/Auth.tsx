import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import type { Profile } from '../storage'
import { countryOptions, COUNTRY_CODES } from '../countries'
import { PROVINCES } from '../provinces'
import DatePicker from './DatePicker'
import { useT } from '../i18n'
import * as api from '../api'
import type { ServerUser } from '../api'
import AvatarCropper from './AvatarCropper'

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// Dosyayi tam cozunurluklu data URL olarak oku (kirpici icin)
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(reader.result as string)
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
  onLogout?: () => void // profil duzenlemede cikis yap
  emailUnverified?: boolean // e-posta dogrulanmadi -> profilde uyari
  resendState?: 'idle' | 'sending' | 'sent'
  onResendVerification?: () => void
  modal?: boolean // true: yari saydam arka planla modal pencere
  page?: boolean // true: tam sayfa (sol menu gorunur), modal degil
}

export default function Auth({
  editUser,
  editGuest,
  onAuthed,
  onGuest,
  onCancel,
  onDeleteAccount,
  onLogout,
  emailUnverified,
  resendState = 'idle',
  onResendVerification,
  modal,
  page,
}: Props) {
  const { t, lang } = useT()
  useEscape(onCancel)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editing = !!(editUser || editGuest)
  const seed = editUser
    ? api.toProfile(editUser)
    : editGuest || { firstName: '', lastName: '', country: '', province: '', nickname: '', email: '' }

  const [firstName, setFirstName] = useState(seed.firstName)
  const [lastName, setLastName] = useState(seed.lastName)
  const [country, setCountry] = useState(seed.country)
  const [province, setProvince] = useState(seed.province ?? '')
  const [nickname, setNickname] = useState(seed.nickname)
  const [email, setEmail] = useState(seed.email)
  const [avatar, setAvatar] = useState<string | undefined>(seed.avatar)
  const [cropSrc, setCropSrc] = useState<string | null>(null) // cember kirpici acik kaynagi
  const [birthDate, setBirthDate] = useState(seed.birthDate ?? '')
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('') // giris sifresi (kayit sifresinden AYRI: yan yana)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Takma isim canli durumu: idle (bos/degismedi) | checking | ok (musait) | taken (alinmis)
  const [nickStatus, setNickStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const nickTaken = nickStatus === 'taken' // alinmis -> kirmizi + gonderim engellenir
  const [saved, setSaved] = useState(false) // profil kaydedildi onayi (sayfada kalir)
  const [showPw, setShowPw] = useState(false)
  const [showLoginPw, setShowLoginPw] = useState(false)
  const [startRating] = useState(1400) // baslangic seviyesi: kayitta gizli, sabit 1400 gonderilir
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
  }, [editing])

  // Takma isim musaitlik kontrolu (API, debounce) — yazdikca canli: yesil/kirmizi
  useEffect(() => {
    const n = nickname.trim()
    // Bos, degismemis (duzenleme) veya cok kisa -> notr (kontrol etme)
    if (!n || n === seed.nickname || n.length < 2) {
      setNickStatus('idle')
      return
    }
    setNickStatus('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const ok = await api.nicknameAvailable(n)
        if (!cancelled) setNickStatus(ok ? 'ok' : 'taken')
      } catch {
        if (!cancelled) setNickStatus('idle') // sunucu yoksa notr birak
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [nickname, editing, seed.nickname])

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

  async function doLogin(e?: React.FormEvent) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await api.login(loginId.trim(), loginPw)
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
        province: country === 'TR' ? province.trim() : '',
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
    setSaved(false)
    if (!validProfile()) return
    const p: Profile = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      country: country.trim(),
      province: country === 'TR' ? province.trim() : '',
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
        setSaved(true) // ana sayfaya donmez; sayfada "Kaydedildi" gosterilir
      } catch {
        setError(t('auth.failed'))
      } finally {
        setBusy(false)
      }
    } else {
      onGuest(p)
    }
  }

  const title = editing
    ? t('reg.titleEdit')
    : forgot
      ? `${t('brand.name')} — ${t('auth.login')}`
      : t('brand.name')

  // Profil fotografi blogu (yalnizca profil duzenlemede gorunur; grid disinda ust blok)
  const avatarBlock = (
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
              if (f) fileToDataURL(f).then(setCropSrc).catch(() => {})
              e.target.value = '' // ayni dosya tekrar secilebilsin
            }}
          />
        </label>
        {avatar && (
          <button type="button" className="menu-btn" onClick={() => setAvatar(undefined)}>
            {t('reg.photoRemove')}
          </button>
        )}
      </div>
      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          onApply={(d) => {
            setAvatar(d)
            setCropSrc(null)
          }}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  )

  // Form alanlari (label + input). Duzenlemede .form-grid ile 2 kolon; kayitta tek kolon.
  // Sira: Ad/Soyad · Ulke/Il · Takma Isim/E-posta · Dogum Tarihi (tek). Ulke/Il/Dogum
  // tarihi yalnizca profil duzenlemede gosterilir (kayitta sade).
  const profileInputs = (
    <>
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
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">{t('reg.countryPlaceholder')}</option>
            {country && !COUNTRY_CODES.includes(country) && (
              <option value={country}>{country}</option>
            )}
            {countryOptions(lang).map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* Il yalnizca Turkiye icin (diger ulkelerde sehir sorulmaz) */}
      {editing && country === 'TR' && (
        <label>
          {t('reg.province')}
          <select value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">{t('reg.provincePlaceholder')}</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {t('reg.nickname')}
        <input
          className={nickStatus === 'taken' ? 'invalid' : nickStatus === 'ok' ? 'valid' : ''}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="username"
          aria-invalid={nickStatus === 'taken'}
        />
        {nickStatus === 'checking' && (
          <span className="nick-hint checking">{t('reg.nickChecking')}</span>
        )}
        {nickStatus === 'ok' && (
          <span className="nick-hint ok">
            <Icon name="check" size={12} /> {t('reg.nickFree')}
          </span>
        )}
        {nickStatus === 'taken' && (
          <span className="field-error" role="alert">{t('reg.nickTaken')}</span>
        )}
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
      {editing && (
        <label>
          {t('reg.birthDate')}
          <DatePicker
            value={birthDate}
            onChange={setBirthDate}
            max={new Date().toISOString().slice(0, 10)}
            placeholder="GG.AA.YYYY"
          />
        </label>
      )}
    </>
  )

  return (
    <div className={`register-overlay ${modal ? 'modal' : ''} ${page ? 'page' : ''}`}>
      <form
        className={`register-card ${editing ? 'profile-form' : 'auth-card'}`}
        onSubmit={!editing && forgot ? doForgot : editing ? doEdit : doRegister}
      >
        {modal && onCancel && (
          <button type="button" className="modal-close" onClick={onCancel} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        )}
        <h2>{title}</h2>
        {editUser && emailUnverified && (
          <div className="verify-bar profile-verify">
            <Icon name="alert" size={15} />
            <span>{t('verify.needed')}</span>
            {resendState === 'sent' ? (
              <span className="verify-sent">{t('verify.sent')}</span>
            ) : (
              <button
                type="button"
                className="verify-resend"
                disabled={resendState === 'sending'}
                onClick={onResendVerification}
              >
                {t('verify.resend')}
              </button>
            )}
          </div>
        )}

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
                    className="galaxy-btn"
                    disabled={busy || !loginId.trim()}
                  >
                    {t('auth.forgotSend')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* GATE: Giris | Kayit YAN YANA (iki kolon) — sekmeler kaldirildi.
            Tek <form> korunur: Giris type=button->doLogin, Kayit type=submit->doRegister
            (form onSubmit). Login sifresi AYRI state (loginPw) -> alanlar cakismaz. */}
        {!editing && !forgot && (
          <div className="auth-cols">
            {/* Sol kolon: Giris yap. Sira: Google ile giris (ust) -> cizgi ->
                e-posta + sifre -> Giris Yap -> Sifremi unuttum. */}
            <div className="auth-col">
              <h3 className="auth-col-title">{t('auth.login')}</h3>
              <div className="google-auth google-auth-top">
                <div ref={googleBtnRef} className="google-btn" />
                <div className="auth-divider">{t('auth.or')}</div>
              </div>
              <label>
                {t('auth.loginId')}
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                />
              </label>
              <label>
                {t('reg.password')}
                <div className="pw-field">
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="pw-toggle"
                    onClick={() => setShowLoginPw((v) => !v)}
                    aria-label={t(showLoginPw ? 'auth.hidePw' : 'auth.showPw')}
                    title={t(showLoginPw ? 'auth.hidePw' : 'auth.showPw')}
                  >
                    <Icon name="eye" size={16} />
                  </button>
                </div>
              </label>
              <button
                type="button"
                className="galaxy-btn auth-col-submit"
                onClick={() => doLogin()}
                disabled={busy}
              >
                {t('auth.doLogin')}
              </button>
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
            </div>

            {/* Sag kolon: Kayit ol */}
            <div className="auth-col">
              <h3 className="auth-col-title">{t('auth.register')}</h3>
              <div className="form-grid reg-grid">{profileInputs}</div>
              <label>
                {t('reg.password')}
                <div className="pw-field">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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
              <button
                type="submit"
                className="galaxy-btn auth-col-submit"
                disabled={busy || nickTaken}
              >
                {t('reg.submitNew')}
              </button>
            </div>
          </div>
        )}

        {/* EDITING: profil duzenleme (tek kolon; DAVRANIS DEGISMEDI) */}
        {editing && (
          <>
            {avatarBlock}
            <div className="form-grid">{profileInputs}</div>
            {!editUser && (
              <label>
                {t('reg.password')}
                <div className="pw-field">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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
            )}
          </>
        )}

        {!forgot && error && <div className="register-error" role="alert">{error}</div>}
        {saved && (
          <div className="save-ok" role="status">
            <Icon name="check" size={15} /> {t('reg.saved')}
          </div>
        )}

        {/* Editing aksiyonlari (Vazgec + Kaydet); gate submitleri kolon icinde */}
        {editing && (
          <div className="register-actions">
            {onCancel && (
              <button type="button" className="menu-btn" onClick={onCancel}>
                {t('reg.cancel')}
              </button>
            )}
            <button type="submit" className="galaxy-btn" disabled={busy || nickTaken}>
              {t('reg.submitEdit')}
            </button>
          </div>
        )}

        {/* Gate alt bar: Misafir olarak oyna + Vazgec — ikisi de ayni SADE ghost
            buton (dikkat cekmez, hizali). Page modunda X yok; ESC de kapatir. */}
        {!editing && !forgot && (
          <div className="auth-foot">
            <button
              type="button"
              className="auth-ghost"
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
            {onCancel && (
              <button type="button" className="auth-ghost" onClick={onCancel}>
                {t('reg.cancel')}
              </button>
            )}
          </div>
        )}

        {/* Hesap aksiyonlari: Cikis Yap ORTADA + belirgin, Hesabi Sil SAG KOSEDE */}
        {editUser && (onLogout || onDeleteAccount) && (
          <div className={`profile-foot ${confirmDelete ? 'confirming' : ''}`}>
            {onLogout && (
              <button type="button" className="auth-logout" onClick={onLogout}>
                <Icon name="logout" size={16} /> {t('auth.logout')}
              </button>
            )}
            {onDeleteAccount && (
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
          </div>
        )}
      </form>
    </div>
  )
}

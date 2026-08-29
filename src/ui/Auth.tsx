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
import { useToast } from './Toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// Native <select> (uzun ulke listesinde native UX korunur) shadcn Input ile AYNI gorunum.
// Tek kaynak: Input ile ayni yukseklik/kenar/radius/odak halkasi.
const FIELD_CLS =
  'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

// Danger Zone metinleri (i18n.tsx paralel WIP tuttugu icin gecici yerel harita;
// onay sonrasi home.* gibi i18n anahtarlarina tasinacak).
const DANGER_I18N: Record<string, { zone: string; desc: string }> = {
  tr: { zone: 'Tehlikeli Bölge', desc: 'Bu işlem geri alınamaz. Hesabın ve tüm verilerin kalıcı olarak silinir.' },
  en: { zone: 'Danger Zone', desc: 'This action cannot be undone. Your account and all data are permanently deleted.' },
  es: { zone: 'Zona peligrosa', desc: 'Esta acción no se puede deshacer. Tu cuenta y todos tus datos se eliminan permanentemente.' },
  de: { zone: 'Gefahrenzone', desc: 'Diese Aktion kann nicht rückgängig gemacht werden. Dein Konto und alle Daten werden dauerhaft gelöscht.' },
  fr: { zone: 'Zone dangereuse', desc: 'Cette action est irréversible. Votre compte et toutes vos données sont définitivement supprimés.' },
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
  const notify = useToast()
  useEscape(onCancel)
  const photoInputRef = useRef<HTMLInputElement>(null)
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
        notify.success(t('reg.saved')) // birlesik toast; sayfada kalir, ana sayfaya donmez
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
  const danger = DANGER_I18N[lang] ?? DANGER_I18N.en

  // Profil fotografi blogu (yalnizca profil duzenlemede gorunur; grid disinda ust blok)
  const avatarBlock = (
    <div className="avatar-picker">
      <div className="avatar-preview">
        {avatar ? <img src={avatar} alt="" /> : <span><Icon name="camera" size={28} /></span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) fileToDataURL(f).then(setCropSrc).catch(() => {})
            e.target.value = '' // ayni dosya tekrar secilebilsin
          }}
        />
        <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click()}>
          <Icon name="camera" size={16} /> {t('reg.photoPick')}
        </Button>
        {avatar && (
          <Button type="button" variant="outline" onClick={() => setAvatar(undefined)}>
            {t('reg.photoRemove')}
          </Button>
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
      <div className="grid gap-1.5">
        <Label htmlFor="pf-firstName">{t('reg.firstName')}</Label>
        <Input id="pf-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pf-lastName">{t('reg.lastName')}</Label>
        <Input id="pf-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      {editing && (
        <div className="grid gap-1.5">
          <Label htmlFor="pf-country">{t('reg.country')}</Label>
          <select
            id="pf-country"
            className={FIELD_CLS}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
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
        </div>
      )}
      {/* Il yalnizca Turkiye icin (diger ulkelerde sehir sorulmaz) */}
      {editing && country === 'TR' && (
        <div className="grid gap-1.5">
          <Label htmlFor="pf-province">{t('reg.province')}</Label>
          <select
            id="pf-province"
            className={FIELD_CLS}
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            <option value="">{t('reg.provincePlaceholder')}</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="pf-nickname">{t('reg.nickname')}</Label>
        <Input
          id="pf-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="username"
          aria-invalid={nickStatus === 'taken'}
        />
        {nickStatus === 'checking' && (
          <span className="text-xs text-muted-foreground">{t('reg.nickChecking')}</span>
        )}
        {nickStatus === 'ok' && (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--success-fg)' }}>
            <Icon name="check" size={12} /> {t('reg.nickFree')}
          </span>
        )}
        {nickStatus === 'taken' && (
          <span className="text-xs text-destructive" role="alert">{t('reg.nickTaken')}</span>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pf-email">{t('reg.email')}</Label>
        <Input
          id="pf-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      {editing && (
        <div className="grid gap-1.5">
          <Label htmlFor="pf-birthDate">{t('reg.birthDate')}</Label>
          <DatePicker
            value={birthDate}
            onChange={setBirthDate}
            max={new Date().toISOString().slice(0, 10)}
            placeholder="GG.AA.YYYY"
          />
        </div>
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
          <Button type="button" variant="ghost" size="icon" className="modal-close" onClick={onCancel} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </Button>
        )}
        <h2>{title}</h2>
        {editUser && emailUnverified && (
          <div className="verify-bar profile-verify">
            <Icon name="alert" size={15} />
            <span>{t('verify.needed')}</span>
            {resendState === 'sent' ? (
              <span className="verify-sent">{t('verify.sent')}</span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                disabled={resendState === 'sending'}
                onClick={onResendVerification}
              >
                {t('verify.resend')}
              </Button>
            )}
          </div>
        )}

        {/* Sifremi unuttum */}
        {!editing && forgot && (
          <div className="forgot-box">
            {forgotSent ? (
              <>
                <p className="register-sub">{t('auth.forgotSent')}</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setForgot(false)
                    setForgotSent(false)
                  }}
                >
                  {t('auth.backToLogin')}
                </Button>
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
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setForgot(false)}
                  >
                    {t('reg.cancel')}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={busy || !loginId.trim()}>
                    {t('auth.forgotSend')}
                  </Button>
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
              <Button
                type="button"
                className="w-full"
                onClick={() => doLogin()}
                disabled={busy}
              >
                {t('auth.doLogin')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="self-end"
                onClick={() => {
                  setForgot(true)
                  setError('')
                }}
              >
                {t('auth.forgot')}
              </Button>
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
              <Button type="submit" className="w-full" disabled={busy || nickTaken}>
                {t('reg.submitNew')}
              </Button>
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

        {/* Ana aksiyon grubu: [Vazgeç] [Kaydet] birlikte, sag hizali */}
        {editing && (
          <div className="mt-1 flex flex-wrap justify-end gap-3">
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                {t('reg.cancel')}
              </Button>
            )}
            <Button type="submit" disabled={busy || nickTaken}>
              {t('reg.submitEdit')}
            </Button>
          </div>
        )}

        {/* Gate alt bar: Misafir olarak oyna + Vazgec — ikisi de ayni SADE ghost
            buton (dikkat cekmez, hizali). Page modunda X yok; ESC de kapatir. */}
        {!editing && !forgot && (
          <div className="auth-foot">
            <Button
              type="button"
              variant="ghost"
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
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t('reg.cancel')}
              </Button>
            )}
          </div>
        )}

        {/* Hesap aksiyonlari: Cikis Yap ayri alan; Hesabi Sil Tehlikeli Bolge icinde */}
        {editUser && (onLogout || onDeleteAccount) && (
          <>
            <Separator className="my-6" />
            {onLogout && (
              <div className="flex justify-center">
                <Button type="button" variant="outline" onClick={onLogout}>
                  <Icon name="logout" size={16} /> {t('auth.logout')}
                </Button>
              </div>
            )}
            {onDeleteAccount && (
              <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <h3 className="text-sm font-semibold text-destructive">{danger.zone}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{danger.desc}</p>
                {confirmDelete ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {t('account.deleteConfirm')}
                    </span>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setConfirmDelete(false)}
                      >
                        {t('reg.cancel')}
                      </Button>
                      <Button type="button" variant="destructive" onClick={onDeleteAccount}>
                        {t('account.deleteYes')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Icon name="trash" size={16} /> {t('account.delete')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </form>
    </div>
  )
}

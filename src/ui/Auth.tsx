import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import type { Profile } from '../storage'
import { countryOptions, COUNTRY_CODES } from '../countries'
import { PROVINCES } from '../provinces'
import { BRAND } from '../brand'
import DatePicker from './DatePicker'
import SearchSelect from './SearchSelect'
import { useT } from '../i18n'
import * as api from '../api'
import type { ServerUser } from '../api'
import { isNativeApp, isNativeGoogleAvailable, nativeGoogleSignIn } from '../nativeGoogle'
import AvatarCropper from './AvatarCropper'
import { useToast } from './Toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// Cep telefonu: state 0'sız 10 hane tutar (kullanici 0'ı yazmaz, biz gosteririz).
// Gecerli Turk cep = 10 hane, 5 ile baslar. Gorunum: "5XX XXX XX XX" (3-3-2-2).
function formatPhone(d: string): string {
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ')
}
function isPhone(d: string): boolean {
  return /^5\d{9}$/.test(d)
}

// Google Identity Services keeps its initialization state globally. Auth can be
// mounted more than once during route/profile transitions, so initialize it
// once and always dispatch credentials to the latest mounted Auth instance.
let gsiInitialized = false
let gsiCredentialHandler: ((resp: { credential: string }) => void) | null = null
let gsiScriptPromise: Promise<void> | null = null

function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as unknown as { google?: any }).google?.accounts?.id) return Promise.resolve()
  if (gsiScriptPromise) return gsiScriptPromise

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google Identity Services failed to load')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services failed to load'))
    document.body.appendChild(script)
  })
  return gsiScriptPromise
}

// Native <select> (uzun ulke listesinde native UX korunur) shadcn Input ile AYNI gorunum.
// Tek kaynak: Input ile ayni yukseklik/kenar/radius/odak halkasi.
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
  modal?: boolean // true: yari saydam arka planla modal pencere
  page?: boolean // true: tam sayfa (sol menu gorunur), modal degil
  initialForgot?: boolean // /sifremi-unuttum deep-link: acilista "sifremi unuttum" modu
  onForgotChange?: (v: boolean) => void // mod degisince URL guncelle (App: /giris <-> /sifremi-unuttum)
  requireComplete?: boolean // profil tamamlama KAPISI: eksik zorunlu alanlar doldurulana dek cikilamaz (App'te EmailGate gibi)
}

export default function Auth({
  editUser,
  editGuest,
  onAuthed,
  onGuest,
  onCancel,
  onDeleteAccount,
  modal,
  page,
  initialForgot,
  onForgotChange,
  requireComplete,
}: Props) {
  const { t, lang } = useT()
  const notify = useToast()
  useEscape(onCancel)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Profil DUZENLEME = sadece form; sekme yok (istatistik/bildirim/üyelik ana sayfada).
  const editing = !!(editUser || editGuest)
  const seed = editUser
    ? api.toProfile(editUser)
    : editGuest || { firstName: '', lastName: '', country: '', province: '', nickname: '', email: '', phone: '' }

  const [firstName, setFirstName] = useState(seed.firstName)
  const [lastName, setLastName] = useState(seed.lastName)
  const [country, setCountry] = useState(seed.country)
  const [province, setProvince] = useState(seed.province ?? '')
  const [nickname, setNickname] = useState(seed.nickname)
  const [email, setEmail] = useState(seed.email)
  // Telefon state'i 0'sız 10 haneyi tutar (seed '05XX...' gelirse 0'ı ve haneleri ayıkla).
  const [phone, setPhone] = useState((seed.phone || '').replace(/\D/g, '').replace(/^0/, '').slice(0, 10))
  // Telefon/ülke/şehir yalnız gerçek hesaplarda ZORUNLU (misafir yerel profilinde değil).
  // Kayıt + gerçek-hesap profil düzenlemesi backend ile birebir: ülke+telefon zorunlu, TR'de şehir.
  // Telefon markaya bağlı: TavlaTv (TR) sorar+zorunlu; GammonTV (yabancı) telefon HİÇ sormaz.
  const askPhone = !editGuest && BRAND.requirePhone
  const askLoc = !editGuest
  const [avatar, setAvatar] = useState<string | undefined>(seed.avatar)
  const [cropSrc, setCropSrc] = useState<string | null>(null) // cember kirpici acik kaynagi
  const [birthDate, setBirthDate] = useState(seed.birthDate ?? '')
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('') // giris sifresi (kayit sifresinden AYRI: yan yana)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Kayıt/düzenleme formunda "gönder"e basıldı mı — basıldıysa boş zorunlu alanlar tek tek
  // kendi altında "Zorunlu" işaretiyle gösterilir (tek bir "tüm alanları doldurun" banner'ı yerine).
  // KAPI (requireComplete): eksik alanlar daha ilk açılışta kırmızı görünsün ki kullanıcı
  // ne doldurması gerektiğini anında görsün (gönder beklenmez).
  const [triedSubmit, setTriedSubmit] = useState(!!requireComplete)
  // Takma isim canli durumu: idle | checking | ok (musait) | taken (alinmis) | blocked (kufur/uygunsuz)
  const [nickStatus, setNickStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'blocked' | 'invalid'>('idle')
  const nickBad = nickStatus === 'taken' || nickStatus === 'blocked' || nickStatus === 'invalid' // kirmizi + gonderim engellenir
  const [showPw, setShowPw] = useState(false)
  const [showLoginPw, setShowLoginPw] = useState(false)
  const [forgot, setForgot] = useState(!!initialForgot) // sifremi unuttum modu (/sifremi-unuttum)
  const [forgotSent, setForgotSent] = useState(false)
  // Mod degistir + URL'i senkronla (App /giris <-> /sifremi-unuttum). URL'den (geri/ileri)
  // gelen initialForgot degisimini de yansit.
  const changeForgot = (v: boolean) => {
    setForgot(v)
    onForgotChange?.(v)
  }
  useEffect(() => {
    setForgot(!!initialForgot)
  }, [initialForgot])

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
  // Google butonu gercekten cizildi mi? Cizilemezse (betik engellendi / cevrimdisi) "veya"
  // ayraci ve bos alan gosterilmez (girişte ~100px anlamsiz bosluk kaliyordu).
  const [googleReady, setGoogleReady] = useState(false)
  const onAuthedRef = useRef(onAuthed)
  onAuthedRef.current = onAuthed

  // Kurulu APK (Capacitor WebView): Google GIS burada CALISMAZ (Google gomulu WebView'i engeller,
  // ID-token geri donmez -> "Gmail sectim ama iceri almiyor"). Native hesap secici kullan.
  const isNative = isNativeApp()
  // Eski APK'larda (SocialLogin eklentisi derlenmemis) native Google buton "plugin is not
  // implemented on android" ile patlar -> butonu gosterme, "uygulamayi guncelle" notu goster.
  const nativeGoogleOk = isNativeGoogleAvailable()
  const doNativeGoogle = () => {
    setBusy(true)
    setError('')
    nativeGoogleSignIn(api.GOOGLE_CLIENT_ID)
      .then((idToken) => api.googleLogin(idToken))
      .then(({ user, isNew }) => onAuthedRef.current(user, isNew))
      .catch((e: unknown) => {
        // Native hatayi GOSTER (DEVELOPER_ERROR/kod vb.) -> tanimak icin. Web'i etkilemez (GIS ayri).
        const detail = (e as { message?: string; code?: string | number })?.message
          || String((e as { code?: string | number })?.code ?? e ?? '')
        // Eski APK (eklenti derlenmemis): "not implemented on android" -> ham hata yerine guncelle notu.
        if (/not implemented|not available|unimplemented/i.test(detail)) {
          setError(t('auth.googleUpdateApp'))
        } else {
          setError(t('auth.googleFail') + (detail ? ' [' + detail.slice(0, 140) + ']' : ''))
        }
      })
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    if (editing) return
    if (isNative) return // native'de GIS yerine native buton (asagida) kullanilir
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
      gsiCredentialHandler = handleCredential
      if (!gsiInitialized) {
        g.accounts.id.initialize({
          client_id: api.GOOGLE_CLIENT_ID,
          callback: (resp: { credential: string }) => gsiCredentialHandler?.(resp),
          // FedCM: popup+postMessage yerine tarayici-yerel hesap secici kullanir. Boylece
          // Google'in accounts.google.com popup'inin KENDI COOP'undan dogan "Cross-Origin-Opener-Policy
          // would block the window.postMessage call" konsol uyarisi HIC olusmaz (bu uyari bizim HTTP
          // basliklarimizla giderilemez; kaynagi Google popup'i). FedCM desteklemeyen tarayicida GSI
          // otomatik eski popup akisina duser -> guvenli degrade.
          use_fedcm_for_prompt: true,
          use_fedcm_for_button: true,
        })
        gsiInitialized = true
      }
      googleBtnRef.current.innerHTML = ''
      // Notr 'outline' tema: sitenin sicak kiremit/krem paletiyle uyumlu (parlak mavi pill
      // paleti bozuyordu). Beyaz zemin + ince kenar, kremsi kartta temiz durur.
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 300,
      })
      setGoogleReady(true)
      return true
    }
    if (render()) return
    loadGsiScript().then(() => render()).catch(() => {})
    return () => {
      cancelled = true
      if (gsiCredentialHandler === handleCredential) gsiCredentialHandler = null
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
    // Gecersiz karakter (harf/rakam disi: bosluk, noktalama, ozel, emoji) -> ANINDA uyar (API'ye gitme).
    if (!/^[\p{L}\p{N}]+$/u.test(n)) {
      setNickStatus('invalid')
      return
    }
    setNickStatus('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const r = await api.nicknameAvailable(n)
        if (!cancelled)
          setNickStatus(
            r.available ? 'ok' : r.reason === 'invalid' ? 'invalid' : r.reason === 'blocked' ? 'blocked' : 'taken',
          )
      } catch {
        if (!cancelled) setNickStatus('idle') // sunucu yoksa notr birak
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [nickname, editing, seed.nickname])

  // Zorunlu alan eksik mi — yalnız "gönder" denendikten (triedSubmit) sonra işaretlenir ve
  // kullanıcı doldurdukça (re-render) anında kalkar. Kayıtta ülke (+TR'de il) zorunlu;
  // profil düzenlemede bu ikisi zorlanmaz (backend de nullable).
  const reqMiss = {
    firstName: triedSubmit && !firstName.trim(),
    lastName: triedSubmit && !lastName.trim(),
    nickname: triedSubmit && !nickname.trim(),
    country: triedSubmit && askLoc && !country.trim(),
    province: triedSubmit && askLoc && country === 'TR' && !province.trim(),
    email: triedSubmit && !editing && !email.trim(),
    phone: triedSubmit && askPhone && !phone.trim(),
  }
  // İlk boş zorunlu alanın input id'si (görsel sırayla, odak için); hepsi doluysa null.
  function firstMissingFieldId(): string | null {
    if (!firstName.trim()) return 'pf-firstName'
    if (!lastName.trim()) return 'pf-lastName'
    if (askLoc && !country.trim()) return 'pf-country'
    if (askLoc && country === 'TR' && !province.trim()) return 'pf-province'
    if (!nickname.trim()) return 'pf-nickname'
    if (!editing && !email.trim()) return 'pf-email'
    if (askPhone && !phone.trim()) return 'pf-phone'
    return null
  }
  // Alan altında "Zorunlu" işareti (boş zorunlu alanlar için) — site rengi terracotta, ince.
  const reqHint = (show: boolean) =>
    show ? <span className="text-xs" role="alert" style={{ color: 'var(--terracotta)' }}>{t('reg.required')}</span> : null
  // Eksik zorunlu alanın ETİKETİ de terracotta + KALIN (kullanıcı hangi alanların eksik
  // olduğunu tek bakışta görsün; kenarlık + "Zorunlu" yazısına ek vurgu). INLINE style ŞART:
  // `.register-card label { color: var(--muted) }` kuralı class'ı ezer; inline style
  // specificity'yi her zaman yener.
  const reqLabelStyle = (missing: boolean): React.CSSProperties =>
    missing ? { color: 'var(--terracotta, #c9563f)', fontWeight: 700 } : { fontWeight: 700 }

  // Sunucudan gelen dogrulama hatasini anlasilir mesaja cevir (hangi alan?)
  function apiErrorMsg(err: unknown): string {
    if (!(err instanceof api.ApiError)) return t('auth.offline')
    // 422 dogrulama: backend ALAN -> anlasilir TURKCE mesaj (Laravel'in varsayilan ingilizce
    // mesajini gostermek yerine). Her alan icin ayri uyari ki "hangi bilgi hatali" belli olsun.
    const f = err.errors
    // Takma ad: backend mesaji zaten Turkce + spesifik (gecersiz karakter / yasakli / alinmis
    // ayrimini yapar) -> onu aynen goster (nickStatus realtime-kontrol durumudur, submit hatasi degil).
    if (f?.nickname) return f.nickname[0] || t('reg.nickTaken')
    if (f?.email) return t('reg.emailTaken')
    if (f?.password) return t('reg.pwShort')
    if (f?.first_name || f?.last_name) return t('reg.fillAll')
    if (f?.phone) return t('reg.validPhone')
    if (f?.avatar) return t('reg.avatarBig')
    if (f?.birth_date) return t('reg.birthInvalid')
    const first = f ? Object.values(f)[0]?.[0] : undefined
    return first || err.message || t('auth.failed')
  }

  // Giris ve kayit tek <form>'da (onSubmit = kayit). Giris alanlarinda Enter / mobil klavyede
  // "Git" tusu eskiden KAYIT dogrulamasini tetikleyip alanlar doluyken "Lutfen tum alanlari
  // doldurun" diyordu -> giris alanlarinda Enter dogrudan girisi gondersin.
  function loginOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (!busy && loginId.trim() && loginPw) void doLogin()
  }

  async function doLogin(e?: React.FormEvent) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await api.login(loginId.trim(), loginPw)
      onAuthed(user)
    } catch (err) {
      // Giriste alan bazli mesaj yerine tek anlasilir uyari: yalniz inline banner (formun
      // ustunde, role=alert). Ayrica toast basmak ayni mesaji iki kez gosterip banner'i ortuyordu.
      const msg = err instanceof api.ApiError ? t('auth.badLogin') : t('auth.offline')
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  function validProfile(): boolean {
    setTriedSubmit(true)
    // Boş zorunlu alanlar: tek "tüm alanları doldurun" banner'ı yerine her alanın altında
    // kendi "Zorunlu" işareti çıkar (reqMiss üzerinden). İlk boş alana odaklan.
    const missingId = firstMissingFieldId()
    if (missingId) {
      setError('')
      document.getElementById(missingId)?.focus()
      return false
    }
    // Format hataları da ALANIN ALTINDA gösterilir (global banner yerine) -> yalnız odaklan.
    if (nickBad) {
      document.getElementById('pf-nickname')?.focus()
      return false
    }
    if (!isEmail(email)) {
      document.getElementById('pf-email')?.focus()
      return false
    }
    if (askPhone && !isPhone(phone)) {
      document.getElementById('pf-phone')?.focus()
      return false
    }
    return true
  }

  async function doRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!validProfile()) return
    if (!api.pwValid(password)) {
      document.getElementById('pf-password')?.focus()
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
        phone: phone ? '0' + phone : '',
        avatar,
        birthDate,
        password,
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
      phone: phone ? '0' + phone : '',
      avatar,
      birthDate,
    }
    if (editUser) {
      setBusy(true)
      try {
        const user = await api.updateProfile(p)
        onAuthed(user)
        notify.success(t('reg.saved')) // birlesik toast; sayfada kalir, ana sayfaya donmez
      } catch (err) {
        setError(apiErrorMsg(err)) // jenerik "Bilgileri kontrol et" yerine ALAN bazli mesaj
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
      ? t('auth.forgot')
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
        <Label htmlFor="pf-firstName" style={reqLabelStyle(reqMiss.firstName)}>{t('reg.firstName')}</Label>
        {/* autoFocus YALNIZ profil duzenlemede; giris/kayit landing'inde odagi CALMA
            (kullanici nereye yazacagini kendi secsin — istek). */}
        <Input id="pf-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus={editing} aria-invalid={reqMiss.firstName || undefined} />
        {reqHint(reqMiss.firstName)}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pf-lastName" style={reqLabelStyle(reqMiss.lastName)}>{t('reg.lastName')}</Label>
        <Input id="pf-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} aria-invalid={reqMiss.lastName || undefined} />
        {reqHint(reqMiss.lastName)}
      </div>
      {/* Ülke: kayıtta da sorulur (yeni üye için ZORUNLU). */}
      <div className="grid gap-1.5">
        <Label htmlFor="pf-country" style={reqLabelStyle(reqMiss.country)}>{t('reg.country')}</Label>
        <SearchSelect
          id="pf-country"
          value={country}
          onChange={setCountry}
          ariaInvalid={reqMiss.country}
          placeholder={t('reg.countryPlaceholder')}
          options={[
            ...(country && !COUNTRY_CODES.includes(country) ? [{ value: country, label: country }] : []),
            ...countryOptions(lang).map(({ code, name }) => ({ value: code, label: name })),
          ]}
        />
        {reqHint(reqMiss.country)}
      </div>
      {/* Il yalnizca Turkiye icin (diger ulkelerde sehir sorulmaz); kayıtta TR ise ZORUNLU. */}
      {country === 'TR' && (
        <div className="grid gap-1.5">
          <Label htmlFor="pf-province" style={reqLabelStyle(reqMiss.province)}>{t('reg.province')}</Label>
          <SearchSelect
            id="pf-province"
            value={province}
            onChange={setProvince}
            ariaInvalid={reqMiss.province}
            placeholder={t('reg.provincePlaceholder')}
            options={PROVINCES.map((p) => ({ value: p, label: p }))}
          />
          {reqHint(reqMiss.province)}
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="pf-nickname" style={reqLabelStyle(reqMiss.nickname)}>{t('reg.nickname')}</Label>
        <Input
          id="pf-nickname"
          value={nickname}
          // En fazla 15 karakter (isimlerin liderlik/kimlik bloklarında kırpılmadan okunması için).
          maxLength={15}
          onChange={(e) => setNickname(e.target.value.slice(0, 15))}
          autoComplete="username"
          aria-invalid={nickBad || reqMiss.nickname || undefined}
        />
        {reqHint(reqMiss.nickname)}
        <span className="nick-counter text-xs text-muted-foreground">{nickname.length}/15</span>
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
        {nickStatus === 'blocked' && (
          <span className="text-xs text-destructive" role="alert">{t('reg.nickBlocked')}</span>
        )}
        {nickStatus === 'invalid' && (
          <span className="text-xs text-destructive" role="alert">{t('reg.nickInvalid')}</span>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pf-email" style={reqLabelStyle(reqMiss.email)}>{t('reg.email')}</Label>
        <Input
          id="pf-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          aria-invalid={reqMiss.email || (triedSubmit && !!email.trim() && !isEmail(email)) || undefined}
        />
        {/* Hata alanın ALTINDA: boşsa "Zorunlu", doluysa geçersiz format uyarısı. */}
        {reqMiss.email
          ? reqHint(true)
          : triedSubmit && !!email.trim() && !isEmail(email) && (
              <span className="text-xs text-destructive" role="alert">{t('reg.validEmail')}</span>
            )}
      </div>
      {askPhone && (
        <div className="grid gap-1.5">
          <Label htmlFor="pf-phone" style={reqLabelStyle(reqMiss.phone)}>{t('reg.phone')}</Label>
          <div className="flex items-center gap-2">
            {/* Sabit '0' öneki: kullanıcı 0'sız girer, biz gösteririz */}
            <span className="text-muted-foreground select-none" style={{ fontWeight: 600 }}>0</span>
            <Input
              id="pf-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="5XX XXX XX XX"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              aria-invalid={reqMiss.phone || (phone.length > 0 && !isPhone(phone)) || undefined}
            />
          </div>
          {/* Hata alanın ALTINDA: boşsa "Zorunlu", doluysa "Geçerli bir cep telefonu girin (5XX…)". */}
          {reqMiss.phone
            ? reqHint(true)
            : triedSubmit && phone.length > 0 && !isPhone(phone) && (
                <span className="text-xs text-destructive" role="alert">{t('reg.validPhone')}</span>
              )}
        </div>
      )}
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
        {/* Giris/kayit landing'inde ust baslik ("Tavla TV") gosterilmez; Giris/Kayit
            kolon basliklari sayfa basligi rolunu ustlenir. Duzenleme/sifremi-unuttum h2 kalir. */}
        {(editing || forgot) && <h2>{title}</h2>}
        {editing && requireComplete && (
          <p className="font-bold text-sm mb-2" role="alert" style={{ color: 'var(--terracotta)' }}>{t('reg.completeRequired')}</p>
        )}
        {/* E-posta dogrulama uyarisi profil DUZENLEME formundan KALDIRILDI; artik uyelik
            kartinda (ProfileOverview > MembershipCard) gosterilir. */}

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
                    changeForgot(false)
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
                    onClick={() => changeForgot(false)}
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
        {/* Hata banner'i giris/kayit alaninin USTUNDE (belirgin) — eskiden kolonlarin
            altinda dipte "saclma sapan" yerde cikiyordu. Ayrica toast da basilir. */}
        {!editing && !forgot && error && (
          <div className="register-error auth-error-top" role="alert">{error}</div>
        )}
        {!editing && !forgot && (
          <div className="auth-cols">
            {/* Sol kolon: Giris yap. Sira: Google ile giris (ust) -> cizgi ->
                e-posta + sifre -> Giris Yap -> Sifremi unuttum. */}
            <div className="auth-col">
              <h3 className="auth-col-title">{t('auth.login')}</h3>
              {isNative ? (
                nativeGoogleOk ? (
                  <div className="google-auth google-auth-top">
                    <button type="button" className="native-google-btn" onClick={doNativeGoogle} disabled={busy}>
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.1 17.6 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7C43.8 38 46.5 31.9 46.5 24.5z"/>
                        <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6.1C.9 16 0 19.9 0 24s.9 8 2.6 11.4l7.8-6.1z"/>
                        <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.6l-7.4-5.7c-2 1.4-4.7 2.3-7.8 2.3-6.4 0-11.8-3.6-13.6-8.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>
                      </svg>
                      <span>Google</span>
                    </button>
                    <div className="auth-divider">{t('auth.or')}</div>
                  </div>
                ) : (
                  <div className="google-auth google-auth-top">
                    <div className="auth-update-note">{t('auth.googleUpdateApp')}</div>
                    <div className="auth-divider">{t('auth.or')}</div>
                  </div>
                )
              ) : (
                <div className="google-auth google-auth-top" style={googleReady ? undefined : { display: 'none' }}>
                  <div ref={googleBtnRef} className="google-btn" />
                  <div className="auth-divider">{t('auth.or')}</div>
                </div>
              )}
              <label>
                {t('auth.loginId')}
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  onKeyDown={loginOnEnter}
                  autoComplete="username"
                  enterKeyHint="next"
                />
              </label>
              <label>
                {t('reg.password')}
                <div className="pw-field">
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                    onKeyDown={loginOnEnter}
                    autoComplete="current-password"
                    enterKeyHint="go"
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
                  changeForgot(true)
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
                    id="pf-password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className={password.length === 0 ? undefined : api.pwValid(password) ? 'valid' : 'invalid'}
                    aria-invalid={(triedSubmit && !api.pwValid(password)) || undefined}
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
                {/* Canli sifre dogrulamasi: bos=notr ipucu, karsilandi=yesil, eksik=kirmizi */}
                {password.length === 0 ? (
                  <span className={`pw-hint text-xs ${triedSubmit ? 'text-destructive' : 'text-muted-foreground'}`} role={triedSubmit ? 'alert' : undefined}>{t('reg.pwShort')}</span>
                ) : api.pwValid(password) ? (
                  <span className="pw-hint inline-flex items-center gap-1 text-xs" style={{ color: 'var(--success-fg)' }}>
                    <Icon name="check" size={12} /> {t('reg.pwOk')}
                  </span>
                ) : (
                  <span className="pw-hint text-xs text-destructive">{t('reg.pwShort')}</span>
                )}
              </label>
              <Button type="submit" className="w-full" disabled={busy || nickBad}>
                {t('reg.submitNew')}
              </Button>
            </div>
          </div>
        )}

        {/* EDITING: profil duzenleme (tek kolon; DAVRANIS DEGISMEDI) */}
        {editing && (
          <>
            {/* Profil DUZENLEME = SADECE form. İstatistikler/Bildirimler/Üyelik profil ANA
                sayfasina (ProfileOverview) tasindi; burada yalniz duzenleme kalir. */}
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
          </>
        )}

        {editing && error && <div className="register-error" role="alert">{error}</div>}

        {/* Ana aksiyon grubu: [Vazgeç] [Kaydet] birlikte, sag hizali */}
        {editing && (
          <div className="mt-1 flex flex-wrap justify-end gap-3">
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                {t('reg.cancel')}
              </Button>
            )}
            <Button type="submit" disabled={busy || nickBad}>
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

        {/* Hesap aksiyonlari: Cikis Yap profil ust basligina tasindi (ProfileOverview);
            burada yalniz Hesabi Sil (Tehlikeli Bolge). */}
        {editUser && onDeleteAccount && (
          <>
            <Separator className="my-6" />
            <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <h3 className="text-sm font-normal text-destructive">{danger.zone}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{danger.desc}</p>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon name="trash" size={16} /> {t('account.delete')}
                </Button>
              </div>
            </div>
          </>
        )}
      </form>
      {/* Hesap silme onayi: inline yerine site-tasarimli modal (register-overlay). Auth
          tam-sayfa overlay icinde oldugundan position:fixed guvenli olsun diye createPortal
          ile body'ye tasinir. Bkz [[fixed-portal-transform-tuzagi]]. */}
      {confirmDelete &&
        editUser &&
        onDeleteAccount &&
        createPortal(
          <div
            className="register-overlay modal"
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmDelete(false)}
          >
            <div className="register-card resign-card" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-destructive">
                <Icon name="trash" size={20} /> {danger.zone}
              </h2>
              <p className="register-sub">{t('account.deleteConfirm')}</p>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmDelete(false)
                  onDeleteAccount()
                }}
              >
                <Icon name="trash" size={16} /> {t('account.deleteYes')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('reg.cancel')}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

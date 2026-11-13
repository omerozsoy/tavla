import { useState } from 'react'
import { useEscape } from './useEscape'
import { Icon, type IconName } from './Icon'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n'
import { liveTournamentLogin, liveTournamentCreate } from '../api'
import TrDateTimePicker from './TrDateTimePicker'

interface Props {
  onClose: () => void
  titleOverride?: string
}

const SIZES = [0, 4, 8, 16, 32, 64, 128, 256]
const LENGTHS = [1, 3, 5, 7, 9, 11, 13, 15]

const EMAIL = 'bilgi@tavlatv.com'
const GSM_NAME = 'Caner Çelik'
const GSM_DISPLAY = '+90 537 389 1907'
const GSM_WA = '905373891907'

const FEATURES: { icon: IconName; key: string }[] = [
  { icon: 'medal', key: 'lts.feat1' },
  { icon: 'users', key: 'lts.feat2' },
  { icon: 'live', key: 'lts.feat3' },
]

// Canlı Turnuva Sistemi — tavla dernek/gruplarına yönelik ücretli turnuva kurma hizmetinin
// tanıtım + iletişim sayfası (form yok; talep iletişim üzerinden alınır).
export default function LiveTournamentSystem({ onClose, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const title = titleOverride || t('menu.liveTournSystem')

  // --- Dernek / Grup Giriş Paneli (şifre kapısı) ---
  const [pw, setPw] = useState('')
  const [auth, setAuth] = useState<{ name: string } | null>(null) // şifre doğrulandı
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<string | null>(null) // kurulan turnuva adı
  // Form alanları
  const [fName, setFName] = useState('')
  const [fType, setFType] = useState<'bracket' | 'swiss_triple'>('bracket')
  const [fSize, setFSize] = useState(8)
  const [fLen, setFLen] = useState(1)
  const [fLives, setFLives] = useState(3)
  const [fAutoBye, setFAutoBye] = useState(false) // Swiss bye: false=elle, true=otomatik
  const [fWhen, setFWhen] = useState('')
  const [fJoinPw, setFJoinPw] = useState('')

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !pw.trim()) return
    setBusy(true)
    setErr('')
    try {
      const r = await liveTournamentLogin(pw.trim())
      setAuth({ name: r.name })
    } catch {
      setErr(t('lts.gate.wrong'))
    } finally {
      setBusy(false)
    }
  }

  async function doCreate(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !fName.trim()) return
    setBusy(true)
    setErr('')
    try {
      const r = await liveTournamentCreate(pw.trim(), {
        name: fName.trim(),
        type: fType,
        size: fSize,
        match_length: fLen,
        swiss_lives: fType === 'swiss_triple' ? fLives : undefined,
        swiss_auto_draw: fType === 'swiss_triple' ? fAutoBye : undefined,
        register_until: fWhen || null,
        join_password: fJoinPw.trim() || null,
      })
      setDone(r.name)
      setFName('')
      setFJoinPw('')
      setFWhen('')
    } catch {
      setErr(t('lts.gate.createErr'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card info-card lts-card">
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>

        <div className="lts-landing">
          <header className="lts-hero">
            <span className="lts-hero-badge" aria-hidden="true">
              <Icon name="trophy" size={30} />
            </span>
            <h1 className="lts-hero-title">{title}</h1>
            <p className="lts-hero-lead">{t('lts.desc1')}</p>
          </header>

          <ul className="lts-feats">
            {FEATURES.map((f) => (
              <li className="lts-feat" key={f.key}>
                <span className="lts-feat-icon" aria-hidden="true">
                  <Icon name={f.icon} size={20} />
                </span>
                <span className="lts-feat-txt">{t(f.key)}</span>
              </li>
            ))}
          </ul>

          <section className="lts-contact-card">
            <p className="lts-contact-lead">{t('lts.desc2')}</p>
            <div className="lts-contact-rows">
              <a className="lts-contact-row" href={`mailto:${EMAIL}`}>
                <span className="lts-contact-icon" aria-hidden="true">
                  <Icon name="mail" size={20} />
                </span>
                <span className="lts-contact-main">
                  <span className="lts-contact-label">{t('lts.contactEmail')}</span>
                  <span className="lts-contact-value">{EMAIL}</span>
                </span>
              </a>
              <a className="lts-contact-row" href={`https://wa.me/${GSM_WA}`} target="_blank" rel="noopener noreferrer">
                <span className="lts-contact-icon" aria-hidden="true">
                  <Icon name="whatsapp" size={20} />
                </span>
                <span className="lts-contact-main">
                  <span className="lts-contact-label">
                    {t('lts.contactGsm')} · {GSM_NAME}
                  </span>
                  <span className="lts-contact-value">{GSM_DISPLAY}</span>
                </span>
              </a>
            </div>
          </section>

          {/* Dernek / Grup Giriş Paneli: şifre -> turnuva kurma formu. */}
          <section className="lts-gate">
            <h2 className="lts-gate-title">
              <Icon name="lock" size={18} /> {t('lts.gate.title')}
            </h2>

            {!auth ? (
              <form className="lts-gate-form" onSubmit={doLogin}>
                <p className="lts-gate-lead">{t('lts.gate.lead')}</p>
                <div className="lts-gate-row">
                  <input
                    type="password"
                    className="lts-gate-input"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder={t('lts.gate.pwPlaceholder')}
                    autoComplete="off"
                    maxLength={60}
                  />
                  <Button type="submit" variant="default" disabled={busy || !pw.trim()}>
                    {t('lts.gate.enter')}
                  </Button>
                </div>
                {err && <p className="lts-gate-err">{err}</p>}
              </form>
            ) : done ? (
              <div className="lts-gate-done">
                <p className="lts-gate-ok">
                  <Icon name="check" size={18} /> {t('lts.gate.created', { name: done })}
                </p>
                <Button type="button" variant="ghost" onClick={() => setDone(null)}>
                  {t('lts.gate.createMore')}
                </Button>
              </div>
            ) : (
              <form className="lts-create-form" onSubmit={doCreate}>
                <p className="lts-gate-welcome">{t('lts.gate.welcome', { name: auth.name })}</p>
                <label className="lts-field">
                  <span>{t('lts.gate.fName')}</span>
                  <input className="lts-gate-input" value={fName} onChange={(e) => setFName(e.target.value)} maxLength={60} required />
                </label>
                <label className="lts-field">
                  <span>{t('lts.gate.fType')}</span>
                  <select className="lts-gate-input" value={fType} onChange={(e) => setFType(e.target.value as 'bracket' | 'swiss_triple')}>
                    <option value="bracket">{t('tourn.typeBracket')}</option>
                    <option value="swiss_triple">{t('lts.gate.swiss')}</option>
                  </select>
                </label>
                {fType === 'swiss_triple' && (
                  <label className="lts-field">
                    <span>{t('lts.gate.fLives')}</span>
                    <select className="lts-gate-input" value={fLives} onChange={(e) => setFLives(Number(e.target.value))}>
                      <option value={1}>{t('lts.gate.lives', { n: 1 })}</option>
                      <option value={2}>{t('lts.gate.lives', { n: 2 })}</option>
                      <option value={3}>{t('lts.gate.lives', { n: 3 })}</option>
                    </select>
                  </label>
                )}
                <label className="lts-field">
                  <span>{t('lts.gate.fSize')}</span>
                  <select className="lts-gate-input" value={fSize} onChange={(e) => setFSize(Number(e.target.value))}>
                    {SIZES.map((s) => (
                      <option key={s} value={s}>{s === 0 ? t('lts.gate.sizeUnlimited') : s}</option>
                    ))}
                  </select>
                </label>
                <label className="lts-field">
                  <span>{t('lts.gate.fLen')}</span>
                  <select className="lts-gate-input" value={fLen} onChange={(e) => setFLen(Number(e.target.value))}>
                    {LENGTHS.map((n) => (
                      <option key={n} value={n}>{n === 1 ? t('friend.single') : t('invite.points', { n })}</option>
                    ))}
                  </select>
                </label>
                <label className="lts-field">
                  <span>{t('lts.gate.fWhen')}</span>
                  <TrDateTimePicker value={fWhen} onChange={setFWhen} />
                </label>
                {fType === 'swiss_triple' && (
                  <label className="lts-field">
                    <span>{t('lts.gate.fBye')}</span>
                    <select className="lts-gate-input" value={fAutoBye ? '1' : '0'} onChange={(e) => setFAutoBye(e.target.value === '1')}>
                      <option value="0">{t('lts.gate.byeManual')}</option>
                      <option value="1">{t('lts.gate.byeAuto')}</option>
                    </select>
                  </label>
                )}
                <label className="lts-field">
                  <span>{t('lts.gate.fJoinPw')}</span>
                  <input className="lts-gate-input" value={fJoinPw} onChange={(e) => setFJoinPw(e.target.value)} maxLength={60} placeholder={t('lts.gate.fJoinPwPh')} autoComplete="off" />
                </label>
                <Button type="submit" variant="default" disabled={busy || !fName.trim() || !fWhen}>
                  {t('lts.gate.create')}
                </Button>
                {err && <p className="lts-gate-err">{err}</p>}
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

import { useEscape } from './useEscape'
import { Icon, type IconName } from './Icon'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n'

interface Props {
  onClose: () => void
  titleOverride?: string
}

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
        </div>
      </div>
    </div>
  )
}

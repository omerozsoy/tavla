/**
 * Info — menüden açılan "Bilgi" sayfası. Site hakkında kısa tanıtım + özellikler
 * + iletişim. Diğer sayfa-modallarıyla aynı kalıp (register-overlay modal page +
 * standart header + useEscape). Backdrop onClick YOK (nested modal tuzağı).
 */

import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'

interface Props {
  onClose: () => void
}

export default function Info({ onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card info-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="info" size={20} /> {t('info.title')}
        </h2>

        <div className="info-body">
          <p>{t('info.intro')}</p>

          <h3>{t('info.featuresTitle')}</h3>
          <ul className="info-list">
            <li><Icon name="robot" size={18} /> {t('info.f1')}</li>
            <li><Icon name="ranking" size={18} /> {t('info.f2')}</li>
            <li><Icon name="chart-line" size={18} /> {t('info.f3')}</li>
            <li><Icon name="shield-check" size={18} /> {t('info.f4')}</li>
          </ul>

          <h3>{t('info.contactTitle')}</h3>
          <p>{t('info.contact')}</p>
        </div>
      </div>
    </div>
  )
}

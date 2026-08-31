/**
 * Info — menüden açılan "Bilgi" sayfası. Sekmeler: Hakkında · Rütbeler · Adil Zar.
 * Rütbeler (RankProgression) ve Adil Zar (FairnessModal embed) buraya taşındı;
 * ayrı menü öğeleri kaldırıldı. Standart sayfa kalıbı + useEscape.
 */

import { useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { RankProgression } from './RankProgression'
import FairnessModal from './FairnessModal'
import ContentView from './ContentView'

interface Props {
  onClose: () => void
  currentRating?: number
  fair: { commitment: string; clientSeed: string; serverSeed?: string; rolls: number }
}

type Tab = 'about' | 'ranks' | 'fair' | 'services'

export default function Info({ onClose, currentRating, fair }: Props) {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('about')
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

        {/* Sekmeler */}
        <div className="prof-ov-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'about'} className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
            {t('info.tab.about')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'ranks'} className={tab === 'ranks' ? 'active' : ''} onClick={() => setTab('ranks')}>
            {t('menu.ranks')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'fair'} className={tab === 'fair' ? 'active' : ''} onClick={() => setTab('fair')}>
            {t('fair.title')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'services'} className={tab === 'services' ? 'active' : ''} onClick={() => setTab('services')}>
            {t('menu.services')}
          </button>
        </div>

        {tab === 'about' && (
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
        )}

        {tab === 'ranks' && (
          <div className="info-tab-pane">
            <RankProgression currentRating={currentRating} />
          </div>
        )}

        {tab === 'fair' && (
          <div className="info-tab-pane">
            <FairnessModal
              embed
              commitment={fair.commitment}
              clientSeed={fair.clientSeed}
              serverSeed={fair.serverSeed}
              rolls={fair.rolls}
              onClose={() => {}}
            />
          </div>
        )}

        {tab === 'services' && (
          <div className="info-tab-pane">
            <ContentView type="service" embed onClose={() => {}} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Info — menüden açılan "Bilgi" sayfası. Sekmeler: Hakkında · Hizmetler · Rütbeler · Adil Zar.
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
import Achievements from './Achievements'

interface Props {
  onClose: () => void
  currentRating?: number
  loggedIn?: boolean
  fair: { commitment: string; clientSeed: string; serverSeed?: string; rolls: number }
}

type Tab = 'about' | 'ranks' | 'fair' | 'services' | 'badges'

export default function Info({ onClose, currentRating, loggedIn = false, fair }: Props) {
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
          <button type="button" role="tab" aria-selected={tab === 'services'} className={tab === 'services' ? 'active' : ''} onClick={() => setTab('services')}>
            {t('menu.services')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'ranks'} className={tab === 'ranks' ? 'active' : ''} onClick={() => setTab('ranks')}>
            {t('menu.ranks')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'badges'} className={tab === 'badges' ? 'active' : ''} onClick={() => setTab('badges')}>
            {t('ach.title')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'fair'} className={tab === 'fair' ? 'active' : ''} onClick={() => setTab('fair')}>
            {t('fair.title')}
          </button>
        </div>

        {tab === 'about' && (
          <div className="info-body">
            <p>{t('info.intro')}</p>
            <h3>{t('info.featuresTitle')}</h3>
            <ul className="info-features">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <li key={n} className="info-feature">
                  <span className="info-feat-ic" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  <span className="info-feat-txt">
                    <span className="info-feat-t">{t(`info.feat.${n}.t`)}</span>
                    <span className="info-feat-d">{t(`info.feat.${n}.d`)}</span>
                  </span>
                </li>
              ))}
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

        {tab === 'badges' && (
          <div className="info-tab-pane">
            <p className="ach-howto-intro">{t('ach.howtoIntro')}</p>
            <Achievements embed loggedIn={loggedIn} />
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

import { useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { OnlinePlayersPanel } from './HomePanels'

type Target = { id: number; name: string; avatar?: string | null; rating?: number | null }

interface Props {
  currentName?: string
  currentId?: number
  onClose: () => void
  onProfile: (id: number) => void
  // Düello davetini gönder (App.tsx davet+bekleme akışına bağlar). points ∈ {1,3,5}.
  onDuel: (p: Target, points: 1 | 3 | 5) => void
  titleOverride?: string
}

// Bireysel Düello sayfası (/duello): çevrimiçi takımlı oyuncu seç -> uzunluk (1/3/5) -> davet.
// Oyun kurma TAMAMEN burada (ayrı /maca-davet sayfasına yönlendirme YOK). Sıralamalar Takımlar Ligi'nde.
export default function DuelView({ currentName, currentId, onClose, onProfile, onDuel, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [pick, setPick] = useState<Target | null>(null) // uzunluk seçimi bekleyen rakip

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card duel-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <div className="lb-header">
          <h2><Icon name="swords" size={20} /> {titleOverride || t('duel.title')}</h2>
        </div>
        <p className="duel-intro">{t('duel.intro')}</p>

        {/* Çevrimiçi (takımlı) oyuncular: kılıç -> uzunluk seçici -> davet gönder (hepsi bu sayfada). */}
        <section className="duel-online">
          <h3>{t('duel.online')}</h3>
          <OnlinePlayersPanel
            currentName={currentName}
            currentId={currentId}
            onProfile={onProfile}
            onDuel={currentId ? (p) => setPick(p) : undefined}
            duelTeamOnly
          />
        </section>
      </div>

      {/* Uzunluk seçici (oyun kurma): 1/3/5 puan -> davet gönder */}
      {pick && (
        <div className="duel-picker-backdrop" onClick={() => setPick(null)}>
          <div className="register-card duel-picker" onClick={(e) => e.stopPropagation()}>
            <h3>{pick.name}</h3>
            <p>{t('duel.pickPoints')}</p>
            <div className="duel-picker-row">
              {([1, 3, 5] as const).map((n) => (
                <Button key={n} variant="default" onClick={() => { const p = pick; setPick(null); onDuel(p, n) }}>
                  {t('duel.points', { n })}
                </Button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setPick(null)}>{t('common.close')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

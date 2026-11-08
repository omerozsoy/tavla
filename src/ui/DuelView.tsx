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
  // Düello: oyuncuya tıklayınca /yeni-oyun benzeri düello KURULUM sayfasını aç (uzunluk orada seçilir).
  onDuel: (p: Target) => void
  titleOverride?: string
}

// Bireysel Düello sayfası: YALNIZ düello başlatma (çevrimiçi takımlı oyuncuyu seç -> kurulum sayfası).
// Sıralamalar (Bireysel / Takımlar / Rating) bu sayfada DEĞİL -> Takımlar Ligi sayfasında (kullanıcı
// direktifi). Kılıç -> handleOpenDuel -> FriendGameSetup düello modu.
export default function DuelView({ currentName, currentId, onClose, onProfile, onDuel, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)

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

        {/* Çevrimiçi (takımlı) oyuncular: kılıç -> düello kurulum sayfası. */}
        <section className="duel-online">
          <h3>{t('duel.online')}</h3>
          <OnlinePlayersPanel
            currentName={currentName}
            currentId={currentId}
            onProfile={onProfile}
            onDuel={currentId ? onDuel : undefined}
            duelTeamOnly
          />
        </section>
      </div>
    </div>
  )
}

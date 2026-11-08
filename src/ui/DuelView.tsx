import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import SetupBoard from './SetupBoard'
import { onlinePlayers, getMyTeam, type OnlinePlayer } from '../api'
import { CountryFlag } from './Flag'
import Loading from './Loading'

type Target = { id: number; name: string; avatar?: string | null; rating?: number | null }
const DUEL_LENGTHS = [1, 3, 5]

interface BoardColors {
  id?: string
  panel: string
  a: string
  b: string
  checker: string
  light?: string
  pointStyle?: 'sharp' | 'rounded'
  surface?: 'plain' | 'gradient' | 'felt' | 'wood'
  checkerStyle?: 'flat' | 'gloss' | 'ice' | 'ring' | 'neon'
  pointImgA?: string
  pointImgB?: string
  pointFitA?: import('../boardThemes').PointFit
  pointFitB?: import('../boardThemes').PointFit
  pointImgs?: Record<number, string>
  pointFits?: Record<number, import('../boardThemes').PointFit>
  surfaceImgLeft?: string
  surfaceImgRight?: string
  surfaceOpacity?: number
  pointTexts?: Record<number, string>
}

interface Props {
  currentId?: number
  onClose: () => void
  // Düello davetini gönder (App davet+bekleme akışına bağlar). points ∈ {1,3,5}.
  onDuel: (p: Target, points: 1 | 3 | 5) => void
  board: BoardColors
  onChangeBoard: () => void
  // Takımsız kullanıcı "Takım Kur" uyarısındaki butona basınca → Takımlar Ligi (kur) sayfasına git.
  onCreateTeam: () => void
  titleOverride?: string
}

// Bireysel Düello sayfası (/duello) — /yeni-oyun (MatchSetup) ile AYNI tasarım: sol ayar kartı
// (rakip seç + uzunluk + davet) + sağ board önizleme. Düello YALNIZ takımlılar arası; coin/bahis yok.
export default function DuelView({ currentId, onClose, onDuel, board, onChangeBoard, onCreateTeam, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [players, setPlayers] = useState<OnlinePlayer[] | null>(null)
  const [sel, setSel] = useState<Target | null>(null) // seçili rakip
  const [len, setLen] = useState(3) // düello uzunluğu (1/3/5)
  const [hasTeam, setHasTeam] = useState<boolean | null>(null) // kullanıcının takımı var mı (null=yükleniyor/misafir)

  // Takım kontrolü: düello YALNIZ takımlılar arası -> takımsız kullanıcıya "Takım Kur" uyarısı.
  useEffect(() => {
    if (!currentId) { setHasTeam(null); return }
    let alive = true
    getMyTeam().then((r) => alive && setHasTeam(!!r.membership)).catch(() => alive && setHasTeam(null))
    return () => { alive = false }
  }, [currentId])

  // Çevrimiçi TAKIMLI oyuncular (düello takımlılar arası) — kendini hariç tut, 15sn tazele.
  useEffect(() => {
    let alive = true
    const load = () =>
      onlinePlayers()
        .then((p) => alive && setPlayers(p.filter((x) => x.has_team && x.id !== currentId)))
        .catch(() => alive && setPlayers([]))
    load()
    const id = window.setInterval(load, 15000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [currentId])

  return (
    <div className="register-overlay page setup-page">
      <div className="setup-split">
        <div className="register-card setup-card">
          <h2>
            <Icon name="swords" size={24} /> {titleOverride || t('duel.title')}
          </h2>
          <p className="setup-unrated-hint">{t('duel.intro')}</p>

          {/* Takımsız kullanıcı: düello takımlılar arası -> "Takım Kur" uyarısı. */}
          {currentId && hasTeam === false && (
            <div className="duel-needteam" role="note">
              <Icon name="warning-circle" size={18} />
              <span>{t('duel.needTeam')}</span>
              <Button variant="default" onClick={onCreateTeam}>{t('duel.createTeam')}</Button>
            </div>
          )}

          {/* Rakip seç: çevrimiçi takımlı oyuncular (kaydırılır liste) */}
          <div className="setup-row">
            <div className="setup-label">{t('duel.online')}</div>
            <div className="duel-opp-list">
              {players === null ? (
                <Loading />
              ) : players.length === 0 ? (
                <div className="duel-opp-empty">{t('duel.noOnline')}</div>
              ) : (
                players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`duel-opp ${sel?.id === p.id ? 'active' : ''}`}
                    onClick={() => setSel({ id: p.id, name: p.name, avatar: p.avatar, rating: p.rating })}
                  >
                    <span className="duel-opp-av" aria-hidden="true">
                      {p.avatar ? <img src={p.avatar} alt="" /> : <Icon name="user" size={16} />}
                    </span>
                    <span className="duel-opp-name">{p.name}</span>
                    <CountryFlag code={p.country} size={18} />
                    <span className="duel-opp-rating">{p.rating}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Uzunluk (puan): 1 / 3 / 5 */}
          <div className="setup-row">
            <div className="setup-label">{t('duel.pickPoints')}</div>
            <div className="target-grid">
              {DUEL_LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`target-chip ${len === n ? 'active' : ''}`}
                  onClick={() => setLen(n)}
                  aria-pressed={len === n}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-actions">
            <Button variant="secondary" onClick={onClose}>
              {t('setup.cancel')}
            </Button>
            <Button variant="default" disabled={!sel} onClick={() => sel && onDuel(sel, len as 1 | 3 | 5)}>
              <Icon name="swords" size={18} /> {t('duel.invite')}
            </Button>
          </div>
        </div>

        <div className="setup-preview">
          <SetupBoard
            panel={board.panel}
            a={board.a}
            b={board.b}
            checker={board.checker}
            cream={board.light}
            pointStyle={board.pointStyle}
            surface={board.surface}
            checkerStyle={board.checkerStyle}
            pointImgA={board.pointImgA}
            pointImgB={board.pointImgB}
            pointFitA={board.pointFitA}
            pointFitB={board.pointFitB}
            pointImgs={board.pointImgs}
            pointFits={board.pointFits}
            surfaceImgLeft={board.surfaceImgLeft}
            surfaceImgRight={board.surfaceImgRight}
            surfaceOpacity={board.surfaceOpacity}
            pointTexts={board.pointTexts}
            themeId={board.id}
            onChangeBoard={onChangeBoard}
            changeLabel={t('setup.changeBoard')}
          />
        </div>
      </div>
    </div>
  )
}

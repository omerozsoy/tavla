import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import SetupBoard from './SetupBoard'
import { onlinePlayers, getMyTeam, type OnlinePlayer } from '../api'
import { CountryFlag } from './Flag'
import { useTeamTag } from '../teamTags'
import { TeamEmblem } from './TeamEmblem'
import Loading from './Loading'

// Oyuncunun takımı (amblem + ad) — /duello listesinde "hangi takımda" göstergesi. useTeamTag hook
// döngüde çağrılamaz; bu yüzden satır başına bir bileşen (her biri hook'u BİR kez çağırır → geçerli).
function PlayerTeam({ userId }: { userId: number }) {
  const info = useTeamTag(userId)
  if (!info) return null
  return (
    <span className="duel-opp-team" title={info.name || info.tag}>
      <TeamEmblem color1={info.color1} color2={info.color2} logo={info.logo || undefined} label={info.tag} size={15} />
      <span>{info.name || info.tag}</span>
    </span>
  )
}

type Target = { id: number; name: string; avatar?: string | null; rating?: number | null }
const DUEL_LENGTHS = [1, 3, 5]
// Sabit düello bahsi + rating deltası — backend config/game.php `duel_stake` / `duel_rating_delta`
// ile AYNI tutulmalı (değişirse ikisini de güncelle).
const DUEL_STAKE = 25
const DUEL_RATING = 10

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
  // Çevrimiçi Oyuncular'dan düelloya davet edilen oyuncu -> sayfa açılınca ÖN-SEÇİLİ gelir.
  preselect?: Target | null
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
export default function DuelView({ currentId, preselect, onClose, onDuel, board, onChangeBoard, onCreateTeam, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [players, setPlayers] = useState<OnlinePlayer[] | null>(null)
  const [sel, setSel] = useState<Target | null>(preselect ?? null) // seçili rakip (dışarıdan davetle ön-seçili gelebilir)
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
  // YALNIZ müsait/oyuna hazır olanlar (meşgul 'busy' veya aktif maçtaki 'in_game' listelenmez),
  // puana göre azalan sıralı.
  useEffect(() => {
    let alive = true
    const load = () =>
      onlinePlayers()
        .then((p) => alive && setPlayers(
          p.filter((x) =>
            x.has_team &&
            x.id !== currentId &&
            !x.in_game &&
            (x.status === 'available' || x.status === 'ready' || x.status == null),
          ).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
        ))
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

          {/* Belirgin bahis + rating rozeti: telefonda da net görünsün (paragraf gözden kaçmasın). */}
          <div className="duel-stake-badge" role="note">
            <span className="duel-stake-item">
              <Icon name="coin" size={20} aria-hidden="true" />
              <span className="duel-stake-amt">{DUEL_STAKE} coin</span>
              <span className="duel-stake-note">{t('duel.stakeNote')}</span>
            </span>
            <span className="duel-stake-item duel-stake-rating">
              <Icon name="chart-line" size={18} aria-hidden="true" />
              <span className="duel-stake-amt">+{DUEL_RATING} / −{DUEL_RATING}</span>
              <span className="duel-stake-note">{t('duel.ratingNote')}</span>
            </span>
          </div>

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
                    <span className="duel-opp-main">
                      <span className="duel-opp-name">
                        <span className={`presence-dot status-dot--${p.status ?? 'available'}`} aria-hidden="true" />
                        {p.name}
                      </span>
                      <PlayerTeam userId={p.id} />
                    </span>
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
                  className={`target-chip duel-len-chip ${len === n ? 'active' : ''}`}
                  onClick={() => setLen(n)}
                  aria-pressed={len === n}
                >
                  <span className="duel-len-n">{n}</span>
                  <span className="duel-len-pts">{n} Takım Puanı Eklenir</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setup-actions">
            <Button variant="secondary" onClick={onClose}>
              {t('setup.cancel')}
            </Button>
            <Button variant="default" disabled={!sel} onClick={() => sel && onDuel(sel, len as 1 | 3 | 5)}>
              <Icon name="swords" size={18} /> {t('duel.invite')} · {DUEL_STAKE} coin
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

import { useEffect, useState } from 'react'
import { Coins } from './Coins'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { userProfile, type PublicProfile as Profile } from '../api'
import Loading from './Loading'
import PlayerIdentity from './PlayerIdentity'
import TopRankMedals from './TopRankMedals'
import { useOnline } from '../presence'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from './Icon'

// Herkese acik oyuncu profili karti (liderlik/rakip isminden acilir)
// onAddFriend: giris yapmis + baskasinin profili ise arkadaslik istegi (App wire'lar).
export default function PublicProfile({
  id,
  onClose,
  onAddFriend,
  onMessage,
}: {
  id: number
  onClose: () => void
  onAddFriend?: () => void
  onMessage?: () => void // baska bir oyuncuya mesaj gonder (arkadas olmasa da; istek olarak duser)
}) {
  const { t } = useT()
  useEscape(onClose)
  // Profil kartı TEK atış fetch -> p.online/p.status açıldığı AN'ın bayat anlık görüntüsü.
  // Oyuncu sonradan çıkınca kart "Oyun Kabul Etmiyor/kırmızı"da takılı kalıyordu. Durum
  // noktasını site geneli CANLI presence'tan (useOnline, 70sn pencere, oto-tazelenen) türet;
  // busy/available ayrımı için yine snapshot p.status kullanılır ama YALNIZ canlı online ise.
  const { online: liveOnline, known: onlineKnown } = useOnline(id)
  const [p, setP] = useState<Profile | null>(null)
  const [error, setError] = useState(false)
  const [friendSent, setFriendSent] = useState(false)

  useEffect(() => {
    let alive = true
    setP(null)
    setError(false)
    userProfile(id)
      .then((d) => alive && setP(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [id])

  const wr = p && p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0
  // Presence bilinene kadar (ilk fetch) snapshot'a düş; bilindiğinde CANLI online esas alınır.
  const isOnline = onlineKnown ? liveOnline : !!p?.online
  // Canlı online değilse 'offline'; onlineysa snapshot durumu (busy/ready) yoksa 'available'.
  const statusDot = isOnline ? (p?.status && p.status !== 'offline' ? p.status : 'available') : 'offline'

  return (
    <div className="register-overlay modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="register-card pp-card" onClick={(e) => e.stopPropagation()}>
        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && !p && <Loading />}

        {p && (
          <>
            <div className="pp-head">
              <PlayerIdentity
                lg
                userId={p.id}
                name={p.name}
                rating={p.rating}
                avatar={p.avatar}
                frame={p.frame}
                country={p.country}
                flagInline
                size={64}
                animated
                premium={p.premium}
                admin={p.is_admin}
                support={p.is_support}
                // İsim yanı nokta CANLI presence'a göre (busy -> kırmızı; offline -> gri).
                statusDot={statusDot}
              />
              <div className="pp-rating">
                {p.rating}
                <div className="pp-coins">
                  <Coins amount={p.coins} size={14} />
                </div>
              </div>
            </div>
            {/* Top-3 madalyaları (PR/Puan ilk 3): belirgin etiketli blok (isim-yani rozetin buyugu). */}
            <TopRankMedals userId={p.id} />
            <div className="pp-rank">
              {/* busy = "Oyun Kabul Etmiyor" -> kirmizi; diger cevrimici -> yesil; degilse gri. */}
              <span className={`pp-status ${!isOnline ? 'off' : p.status === 'busy' ? 'busy' : 'on'}`}>
                <span className="pp-status-dot" aria-hidden="true" />
                {!isOnline ? t('online.statusOff') : p.status === 'busy' ? t('online.st.busy') : t('online.statusOn')}
              </span>
            </div>

            {/* Yönetici VEYA Destek profili: resmi iletişim aksiyonları.
                - "Hata Bildir" -> mevcut global BugReport formunu açar (pencere olayıyla köprülenir).
                - "Yardım İste" -> bu yönetici/destek kişisine DM açar (onMessage; sohbetten yaz).
                Her iki rol için de aynı (adminleride aynı yap). */}
            {(p.is_admin || p.is_support) && (
              <div className="pp-actions">
                <Button
                  variant="default"
                  className="pp-report"
                  style={{ background: '#A83A2B', borderColor: '#A83A2B', color: '#fff', width: '100%' }}
                  onClick={() => {
                    onClose()
                    window.dispatchEvent(new CustomEvent('tavla:open-bug-report'))
                  }}
                >
                  <Icon name="flag" size={14} /> {t('bug.button')}
                </Button>
                {onMessage && (
                  <Button
                    variant="default"
                    className="pp-help"
                    style={{ background: '#ffa093', borderColor: '#ffa093', color: '#1c1a17', width: '100%' }}
                    onClick={() => {
                      onClose()
                      onMessage()
                    }}
                  >
                    <Icon name="chat" size={14} /> {t('role.helpRequest')}
                  </Button>
                )}
              </div>
            )}

            {/* Aksiyonlar (Arkadaş ol / Mesaj): başlık sağ sütunu yerine tam-genişlik çubuk ->
                mobilde sıkışma/taşma olmaz, masaüstünde ferah. */}
            {(onAddFriend || onMessage) && (
              <div className="pp-actions">
                {/* SİTE GENELİ: bakan kişiyle ZATEN arkadaşsa (p.is_friend) "Arkadaş ol"u gizle;
                    yerine küçük "Arkadaşınız" göstergesi. Nereden açılırsa açılsın geçerli. */}
                {onAddFriend && (p.is_friend ? (
                  <span className="pp-isfriend">
                    <Icon name="check" size={14} /> {t('online.alreadyFriend')}
                  </span>
                ) : (
                  <Button
                    variant="default"
                    className="pp-addfriend"
                    disabled={friendSent}
                    onClick={() => {
                      setFriendSent(true)
                      onAddFriend()
                    }}
                  >
                    <Icon name={friendSent ? 'check' : 'user-plus'} size={14} />{' '}
                    {friendSent ? t('online.friendSent') : t('online.addFriend')}
                  </Button>
                ))}
                {/* Yönetici/Destek profilinde "Mesaj gönder" GIZLI: üstteki "Yardım İste" zaten
                    DM açıyor (çift buton olmasın). Normal oyuncuda gösterilir. */}
                {onMessage && !(p.is_admin || p.is_support) && (
                  <Button variant="outline" className="pp-message" onClick={onMessage}>
                    <Icon name="chat" size={14} /> {t('dm.message')}
                  </Button>
                )}
              </div>
            )}

            <div className="pp-grid">
              <div className="pp-box">
                <div className="pp-val">{p.games}</div>
                <div className="pp-lbl">{t('stats.games')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val good">{p.wins}</div>
                <div className="pp-lbl">{t('stats.wins')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val bad">{p.losses}</div>
                <div className="pp-lbl">{t('stats.losses')}</div>
              </div>
              <div className="pp-box">
                <div className="pp-val">{p.games > 0 ? `%${wr}` : '–'}</div>
                <div className="pp-lbl">{t('stats.winRate')}</div>
              </div>
            </div>

            {/* PR (Career PR): analiz edilmiş maçlardan havuzlanan hata oranı (düşük=iyi) + kaç maç
                sayıldığı. Henüz analiz edilmiş maç yoksa "henüz yok" gösterilir. */}
            <div className="pp-pr">
              <span className="pp-pr-lbl">
                <Icon name="target" size={14} /> {t('lb.byPr')}
              </span>
              {p.career_pr != null && (p.career_pr_matches ?? 0) > 0 ? (
                <span className="pp-pr-val">
                  {p.career_pr.toFixed(2)}
                  <span className="pp-pr-sub">
                    {' · '}
                    {t('pp.prMatches', { n: String(p.career_pr_matches ?? 0) })}
                  </span>
                </span>
              ) : (
                <span className="pp-pr-sub">{t('pp.prNone')}</span>
              )}
            </div>

            {p.form.length > 0 && (
              <div className="pp-form">
                <span className="pp-form-lbl">{t('stats.form')}</span>
                {p.form.map((w, i) => (
                  <span key={i} className={`pp-dot ${w ? 'win' : 'loss'}`}>
                    {w ? 'G' : 'M'}
                  </span>
                ))}
              </div>
            )}

            {/* Yalnız oyuncunun ÖNE ÇIKARDIĞI (seçtiği) başarımlar; seçmediyse bölüm hiç gösterilmez. */}
            {p.featured && p.featured.length > 0 && (
              <div className="badge-section">
                <div className="badge-head">
                  <Icon name="medal" size={15} /> {t('badges.title')}
                </div>
                <div className="badge-grid">
                  {p.featured.map((b) => (
                    <span key={b.slug} className="badge-item" title={b.name}>
                      <Icon name={b.icon as IconName} size={18} />
                      <span className="badge-name">{b.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

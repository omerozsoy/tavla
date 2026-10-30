import { useEffect, useState } from 'react'
import { Coins } from './Coins'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { userProfile, adminChatMute, adminSetNote, type PublicProfile as Profile } from '../api'
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
  viewerIsAdmin,
}: {
  id: number
  onClose: () => void
  onAddFriend?: () => void
  onMessage?: () => void // baska bir oyuncuya mesaj gonder (arkadas olmasa da; istek olarak duser)
  viewerIsAdmin?: boolean // bakan kişi yönetici mi (başkasının profili) -> konuşma yasağı aksiyonu
}) {
  const { t } = useT()
  useEscape(onClose)
  // Admin moderasyon: konuşma yasağı aksiyonu (süre seçenekleri açık/kapalı + sonuç mesajı).
  const [showMute, setShowMute] = useState(false)
  const [muteBusy, setMuteBusy] = useState(false)
  const [muteMsg, setMuteMsg] = useState<string | null>(null)
  // Aktif yasak bitişi (ISO): yüklemede p.muted_until, aksiyondan sonra override (undefined=henüz yok).
  const [mutedOverride, setMutedOverride] = useState<string | null | undefined>(undefined)
  const applyMute = (minutes: number) => {
    setMuteBusy(true)
    setMuteMsg(null)
    adminChatMute(id, minutes)
      .then((r) => {
        setMutedOverride(r.muted_until)
        setMuteMsg(minutes > 0 ? t('mod.chatBan.done') : t('mod.chatBan.lifted'))
      })
      .catch(() => setMuteMsg(t('mod.chatBan.err')))
      .finally(() => {
        setMuteBusy(false)
        setShowMute(false)
      })
  }
  // Profil kartı TEK atış fetch -> p.online/p.status açıldığı AN'ın bayat anlık görüntüsü.
  // Oyuncu sonradan çıkınca kart "Oyun Kabul Etmiyor/kırmızı"da takılı kalıyordu. Durum
  // noktasını site geneli CANLI presence'tan (useOnline, 70sn pencere, oto-tazelenen) türet;
  // busy/available ayrımı için yine snapshot p.status kullanılır ama YALNIZ canlı online ise.
  const { online: liveOnline, known: onlineKnown } = useOnline(id)
  const [p, setP] = useState<Profile | null>(null)
  const [error, setError] = useState(false)
  const [friendSent, setFriendSent] = useState(false)
  // Admin notu: görüntüle/düzenle. noteOverride = kaydettikten sonra güncel değer (undefined=sunucudan).
  const [noteOverride, setNoteOverride] = useState<string | null | undefined>(undefined)
  const [noteEdit, setNoteEdit] = useState<string | null>(null) // null=görüntü modu, string=düzenleme kutusu açık
  const [noteBusy, setNoteBusy] = useState(false)
  // Notu son yazan admin + zaman (kaydetme sonrası override; undefined=sunucudan).
  const [noteMeta, setNoteMeta] = useState<{ by?: string | null; at?: string | null } | undefined>(undefined)
  const saveNote = () => {
    if (noteEdit == null) return
    setNoteBusy(true)
    adminSetNote(id, noteEdit)
      .then((r) => {
        setNoteOverride(r.admin_note)
        setNoteMeta({ by: r.admin_note_by_name ?? null, at: r.admin_note_at ?? null })
        setNoteEdit(null)
      })
      .catch(() => {})
      .finally(() => setNoteBusy(false))
  }

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
  // Gösterilecek yasak bitişi: aksiyon override'ı varsa o, yoksa sunucudan gelen değer (yalnız admin dolu).
  const mutedUntil = mutedOverride !== undefined ? mutedOverride : (p?.muted_until ?? null)
  const mutedUntilLabel = mutedUntil
    ? new Date(mutedUntil).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null
  // Gösterilecek admin notu: kaydetme override'ı varsa o, yoksa sunucudan gelen (yalnız admin dolu).
  // Moderasyon bloğu (Konuşma Yasağı + Admin Notu): prop ile GELMESE de backend "bakan admin mi"
  // der (viewer_is_admin) -> Liderlik/Arkadaşlar/Kulüpler dahil HER açılış yolunda görünür.
  const showMod = viewerIsAdmin || !!p?.viewer_is_admin
  const adminNote = noteOverride !== undefined ? noteOverride : (p?.admin_note ?? null)
  // Notu yazan admin + zaman (override varsa o, yoksa sunucudan).
  const noteBy = noteMeta !== undefined ? noteMeta.by : (p?.admin_note_by_name ?? null)
  const noteAt = noteMeta !== undefined ? noteMeta.at : (p?.admin_note_at ?? null)

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
              <div className="pp-actions pp-actions-admin">
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
                    style={{ background: '#C9563F', borderColor: '#C9563F', color: '#fff', width: '100%' }}
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

            {/* YÖNETİCİ: konuşma yasağı (sohbet susturma). Başkasının profili + bakan admin ise. */}
            {showMod && (
              <div className="pp-actions pp-mod">
                {mutedUntilLabel && (
                  <div className="pp-muted-badge">
                    <Icon name="ban" size={14} /> {t('mod.chatBan.active', { until: mutedUntilLabel })}
                  </div>
                )}
                {!showMute ? (
                  <Button
                    variant="outline"
                    className="pp-mute-toggle"
                    disabled={muteBusy}
                    onClick={() => { setShowMute(true); setMuteMsg(null) }}
                    style={{ width: '100%' }}
                  >
                    <Icon name="chat" size={14} /> {t('mod.chatBan')}
                  </Button>
                ) : (
                  <div className="pp-mute-opts">
                    <Button variant="outline" disabled={muteBusy} onClick={() => applyMute(1440)}>{t('chat.ban.24h')}</Button>
                    <Button variant="outline" disabled={muteBusy} onClick={() => applyMute(10080)}>{t('chat.ban.1w')}</Button>
                    <Button variant="outline" disabled={muteBusy} onClick={() => applyMute(43200)}>{t('chat.ban.1mo')}</Button>
                    <Button variant="outline" disabled={muteBusy} onClick={() => applyMute(525600)}>{t('chat.ban.1y')}</Button>
                    <Button variant="outline" disabled={muteBusy} onClick={() => applyMute(0)}>{t('mod.chatBan.lift')}</Button>
                  </div>
                )}
                {muteMsg && <div className="pp-mute-msg">{muteMsg}</div>}

                {/* ADMIN NOTU: varsa oku (tıkla-düzenle), yoksa "Not Ekle". Yalnız yönetici görür. */}
                {noteEdit == null ? (
                  adminNote ? (
                    <div className="pp-note">
                      <div className="pp-note-head">
                        <span className="pp-note-lbl"><Icon name="pencil" size={13} /> {t('mod.note')}</span>
                        <button type="button" className="pp-note-edit" onClick={() => setNoteEdit(adminNote)}>
                          {t('mod.note.edit')}
                        </button>
                      </div>
                      <div className="pp-note-body">{adminNote}</div>
                      {noteBy && (
                        <div className="pp-note-by">
                          {noteBy}
                          {noteAt ? ' · ' + new Date(noteAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button variant="outline" className="pp-note-add" style={{ width: '100%' }} onClick={() => setNoteEdit('')}>
                      <Icon name="pencil" size={14} /> {t('mod.note.add')}
                    </Button>
                  )
                ) : (
                  <div className="pp-note-editor">
                    <textarea
                      className="pp-note-input"
                      value={noteEdit}
                      maxLength={5000}
                      rows={4}
                      placeholder={t('mod.note.ph')}
                      onChange={(e) => setNoteEdit(e.target.value)}
                    />
                    <div className="pp-note-actions">
                      <Button variant="outline" disabled={noteBusy} onClick={() => setNoteEdit(null)}>{t('mod.note.cancel')}</Button>
                      <Button variant="default" disabled={noteBusy} onClick={saveNote}>{t('mod.note.save')}</Button>
                    </div>
                  </div>
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

            {/* Turnuva şampiyonlukları — yalnız kazananlarda göster (çoğu oyuncu 0). */}
            {(p.tournaments_won ?? 0) > 0 && (
              <div className="champ-row">
                <span className="champ-row-lbl"><Icon name="trophy" size={15} /> {t('stats.championships')}</span>
                <span className="champ-row-val">{p.tournaments_won}</span>
              </div>
            )}

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

            {/* Yönetici için DAİMA (1. sırada Yönetici rozeti); ayrıca oyuncunun seçtiği başarımlar. */}
            {(p.is_admin || (p.featured && p.featured.length > 0)) && (
              <div className="badge-section">
                <div className="badge-head">
                  <Icon name="medal" size={15} /> {t('badges.title')}
                </div>
                <div className="badge-grid">
                  {/* YÖNETİCİ rozeti: site rengi (kiremit) zemin + beyaz yazı + başında kalkan. */}
                  {p.is_admin && (
                    <span className="badge-item badge-item-admin" title={t('role.admin')}>
                      <Icon name="shield-check" size={16} weight="fill" />
                      <span className="badge-name">{t('role.admin')}</span>
                    </span>
                  )}
                  {p.featured?.map((b) => (
                    <span key={b.slug} className="badge-item" title={b.desc || b.name}>
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

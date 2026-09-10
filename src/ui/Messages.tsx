import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import {
  getThreads,
  getThread,
  sendMessage,
  sendTyping,
  ApiError,
  type ChatThread,
  type ChatMessage,
  type ChatUser,
  type AppNotification,
} from '../api'
import PlayerIdentity from './PlayerIdentity'
import AvatarFrame from './AvatarFrame'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import { type IconName } from './Icon'

interface Props {
  focusUserId?: number | null // acilirken dogrudan bu arkadasin konusmasini ac (NOTIF_ID -> Bildirimler)
  onClose: () => void
  onRead?: () => void // gelenler okundu -> App rozetini tazele
  // Gonderenin fotografi balonun yaninda gosterilir (kendi mesajlarim icin bu bilgiler).
  myAvatar?: string | null
  myFrame?: string | null
  myName?: string
  // Bildirimler mesajlarla birlestirildi: sol listede sabit "Bildirimler" girisi.
  notifications?: AppNotification[]
  unreadNotif?: number
  onNotifRead?: () => void // Bildirimler acilinca hepsini okundu isaretle
  onNotifDelete?: (id: number) => void
  onNotifDeleteAll?: () => void
}

// Bildirimler "sohbeti" icin ozel sentinel id (gercek kullanici id'leri pozitif).
const NOTIF_ID = -1
const NOTIF_ICONS: Record<string, IconName> = {
  bell: 'bell', crown: 'crown', medal: 'medal', star: 'star', trophy: 'trophy', coin: 'coin', gift: 'gift',
}
function timeAgo(iso: string | null | undefined, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!iso) return ''
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return t('notif.now')
  const m = Math.floor(s / 60)
  if (m < 60) return t('notif.minAgo', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('notif.hourAgo', { h })
  return t('notif.dayAgo', { d: Math.floor(h / 24) })
}

// Sohbet icin basit emoji seti (kutuphane yok; hafif)
const EMOJIS = [
  '😀', '😂', '🙂', '😉', '😍', '😘', '😎', '🤔', '😴', '😢',
  '😭', '😡', '👍', '👎', '👏', '🙏', '💪', '🔥', '🎲', '🏆',
  '❤️', '💔', '😅', '😜', '🤣', '😊', '🥳', '😳', '🤝', '✌️',
]

// Kisa saat (HH:MM)
function fmtTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export default function Messages({
  focusUserId,
  onClose,
  onRead,
  myAvatar,
  myFrame,
  myName,
  notifications = [],
  unreadNotif = 0,
  onNotifRead,
  onNotifDelete,
  onNotifDeleteAll,
}: Props) {
  const { t } = useT()
  const toast = useToast()
  useEscape(onClose)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeId, setActiveId] = useState<number | null>(focusUserId ?? null)
  const [activeUser, setActiveUser] = useState<ChatUser | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false) // karsi taraf "yaziyor…" mu
  const [search, setSearch] = useState('') // sol listede sohbet arama
  const listEndRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null) // sohbet log kaydırma kabı (en alta indir)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingSentRef = useRef(0) // son "yaziyor" nabzinin zamani (throttle)

  const refreshThreads = useCallback(async () => {
    try {
      const d = await getThreads()
      setThreads(d.threads)
    } catch {
      /* yoksay */
    } finally {
      setLoadingThreads(false)
    }
  }, [])

  // onRead prop'u her render'da yeni gelebilir (App inline arrow) -> ref'te tut ki
  // loadThread kimligi sabit kalsin (yoksa yukleme effect'i sonsuz doner -> ekran yanip soner).
  const onReadRef = useRef(onRead)
  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

  // Bildirimler açılınca hepsini okundu işaretle (ref: kimlik sabit kalsın).
  const onNotifReadRef = useRef(onNotifRead)
  useEffect(() => {
    onNotifReadRef.current = onNotifRead
  }, [onNotifRead])
  useEffect(() => {
    if (activeId === NOTIF_ID) onNotifReadRef.current?.()
  }, [activeId])

  // Gonderilmis ama sunucuda henuz onaylanmamis (iyimser) mesajlar. 3sn'lik sessiz tazeleme
  // setMessages(server) ile diziyi TAMAMEN degistirdiginden, gonderim uctugu an tazeleme
  // araya girerse iyimser mesaj SILINIYORDU (mesaj "gonderilmiyor" gibi gorunuyordu).
  // Cozum: her tazelemede henuz onaylanmamis iyimser mesajlari sunucu listesine EKLE.
  const pendingRef = useRef<ChatMessage[]>([])
  const mergePending = (server: ChatMessage[]): ChatMessage[] => {
    const extra = pendingRef.current.filter((p) => !server.some((s) => s.id === p.id))
    return extra.length ? [...server, ...extra] : server
  }

  // Aktif konusmayi yukle (gelenleri okundu isaretler)
  const loadThread = useCallback(async (uid: number, silent = false) => {
    if (!silent) setLoadingThread(true)
    try {
      const d = await getThread(uid)
      setActiveUser(d.user)
      setMessages(mergePending(d.messages)) // in-flight iyimser mesajlari koru
      setPartnerTyping(!!d.typing) // karsi taraf yaziyor mu
      onReadRef.current?.() // gelenler backend'de okundu -> rozet tazele
    } catch {
      /* yoksay */
    } finally {
      if (!silent) setLoadingThread(false)
    }
  }, [])

  useEffect(() => {
    refreshThreads()
  }, [refreshThreads])

  // Aktif konusma degisince yukle (onceki konusmanin "yaziyor" durumunu + bekleyenleri sifirla)
  useEffect(() => {
    setPartnerTyping(false)
    pendingRef.current = [] // konusma degisti -> onceki sohbetin bekleyen iyimser mesajlari
    if (activeId != null && activeId !== NOTIF_ID) loadThread(activeId)
  }, [activeId, loadThread])

  // Aktif konusma acikken 3 sn'de bir sessiz tazele (yeni mesajlar + "yaziyor…")
  useEffect(() => {
    if (activeId == null || activeId === NOTIF_ID) return
    const id = window.setInterval(() => {
      loadThread(activeId, true)
      refreshThreads()
    }, 3000)
    return () => window.clearInterval(id)
  }, [activeId, loadThread, refreshThreads])

  // Sohbet açılınca / yeni mesajda log'u EN ALTA indir (son mesaj görünür). Kabın kendisini
  // kaydır (scrollTop=scrollHeight) — zero-height end-marker + scrollIntoView güvenilmezdi
  // (yanlış ata kayabiliyor, üstte kalıyordu). layout effect: boyanmadan önce çalışır (zıplama yok).
  useLayoutEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, activeId, loadingThread])

  async function doSend() {
    const body = text.trim()
    if (!body || sending || activeId == null) return
    setEmojiOpen(false)
    setSending(true)
    // Iyimser ekle (+ pendingRef: 3sn tazeleme araya girse de kaybolmasin)
    const optimistic: ChatMessage = { id: -Date.now(), body, mine: true, created_at: new Date().toISOString() }
    pendingRef.current = [...pendingRef.current, optimistic]
    setMessages((m) => [...m, optimistic])
    setText('')
    try {
      const r = await sendMessage(activeId, body)
      pendingRef.current = pendingRef.current.filter((x) => x.id !== optimistic.id)
      setMessages((m) => {
        const idx = m.findIndex((x) => x.id === optimistic.id)
        if (idx >= 0) {
          const n = m.slice()
          n[idx] = r.message
          return n
        }
        // Iyimser mesaj bir tazeleme tarafindan silinmisti -> gercek mesaji yine de ekle.
        return m.some((x) => x.id === r.message.id) ? m : [...m, r.message]
      })
      refreshThreads()
    } catch (err) {
      // Basarisiz -> iyimser mesaji geri al + NEDENINI goster (eskiden sessizce yutuluyordu
      // -> kullanici "mesaj atamiyorum" diyordu ama neden belli olmuyordu).
      pendingRef.current = pendingRef.current.filter((x) => x.id !== optimistic.id)
      setMessages((m) => m.filter((x) => x.id !== optimistic.id))
      setText(body)
      toast.error(err instanceof ApiError && err.message ? err.message : t('dm.sendFail'))
    } finally {
      setSending(false)
    }
  }

  const showList = activeId == null // mobilde: liste mi konusma mi

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card messages-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="chat" size={20} /> {t('dm.title')}
        </h2>

        <div className={`messages-split ${showList ? 'show-list' : 'show-thread'}`}>
          {/* Sol: konusma listesi (gelen kutusu). Üstte arama, altında sabit "Bildirimler". */}
          <div className="messages-threads">
            <div className="messages-search">
              <Icon name="search" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('dm.search')}
                aria-label={t('dm.search')}
              />
              {search && (
                <button type="button" className="messages-search-clear" onClick={() => setSearch('')} aria-label={t('common.close')}>
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
            <div className="messages-thread-scroll">
              <button
                type="button"
                className={`messages-thread messages-thread-notif ${activeId === NOTIF_ID ? 'active' : ''}`}
                onClick={() => setActiveId(NOTIF_ID)}
              >
                <span className="messages-notif-ava">
                  <Icon name="bell" size={18} />
                </span>
                <span className="messages-thread-body">
                  <span className="messages-thread-top">
                    <span className="messages-thread-name">{t('notif.title')}</span>
                  </span>
                  <span className="messages-thread-last">{notifications[0]?.title ?? t('notif.empty')}</span>
                </span>
                {unreadNotif > 0 && <span className="messages-badge">{unreadNotif > 9 ? '9+' : unreadNotif}</span>}
              </button>
              {(() => {
                const q = search.trim().toLowerCase()
                const list = q ? threads.filter((th) => th.user.name.toLowerCase().includes(q)) : threads
                if (loadingThreads) return <div className="lb-empty">{t('dm.loading')}</div>
                if (threads.length === 0) return <div className="lb-empty">{t('dm.empty')}</div>
                if (list.length === 0) return <div className="lb-empty">{t('dm.searchEmpty')}</div>
                return list.map((th) => (
                  <button
                    key={th.user.id}
                    type="button"
                    className={`messages-thread ${activeId === th.user.id ? 'active' : ''} ${th.unread > 0 ? 'has-unread' : ''}`}
                    onClick={() => setActiveId(th.user.id)}
                  >
                    <AvatarFrame src={th.user.avatar} frame={th.user.frame} size={44} name={th.user.name} />
                    <span className="messages-thread-body">
                      <span className="messages-thread-top">
                        <span className="messages-thread-name">{th.user.name}</span>
                        {th.last?.created_at && <span className="messages-thread-time">{fmtTime(th.last.created_at)}</span>}
                      </span>
                      <span className="messages-thread-last">
                        {th.last ? (th.last.mine ? `${t('dm.you')}: ${th.last.body}` : th.last.body) : ''}
                      </span>
                    </span>
                    {th.unread > 0 && <span className="messages-badge">{th.unread > 9 ? '9+' : th.unread}</span>}
                  </button>
                ))
              })()}
            </div>
          </div>

          {/* Sag: aktif konusma */}
          <div className="messages-thread-view">
            {activeId == null ? (
              <div className="messages-placeholder">
                <Icon name="chat" size={40} />
                <p>{t('dm.pick')}</p>
              </div>
            ) : activeId === NOTIF_ID ? (
              /* Bildirimler görünümü (mesajlarla birleşik) */
              <>
                <div className="messages-thread-head">
                  <button type="button" className="messages-back" onClick={() => setActiveId(null)} aria-label={t('common.close')}>
                    <Icon name="arrow-right" size={16} />
                  </button>
                  <span className="messages-notif-title">
                    <Icon name="bell" size={18} /> {t('notif.title')}
                  </span>
                  {notifications.length > 0 && onNotifDeleteAll && (
                    <button type="button" className="notif-clear messages-notif-clear" onClick={onNotifDeleteAll}>
                      {t('notif.clearAll')}
                    </button>
                  )}
                </div>
                <div className="messages-log">
                  {notifications.length === 0 ? (
                    <div className="messages-hint">{t('notif.empty')}</div>
                  ) : (
                    <ul className="notif-list notif-list-inline">
                      {notifications.map((n) => (
                        <li key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                          <span className="notif-ic">
                            <Icon name={NOTIF_ICONS[n.icon ?? 'bell'] ?? 'bell'} size={16} />
                          </span>
                          <span className="notif-txt">
                            <span className="notif-t">{n.title}</span>
                            {n.body && <span className="notif-b">{n.body}</span>}
                          </span>
                          <span className="notif-time">{timeAgo(n.created_at, t)}</span>
                          {onNotifDelete && (
                            <button type="button" className="notif-del" title={t('notif.delete')} aria-label={t('notif.delete')} onClick={() => onNotifDelete(n.id)}>
                              <Icon name="x" size={14} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="messages-thread-head">
                  <button
                    type="button"
                    className="messages-back"
                    onClick={() => setActiveId(null)}
                    aria-label={t('common.close')}
                  >
                    <Icon name="arrow-right" size={16} />
                  </button>
                  {activeUser && (
                    <PlayerIdentity
                      name={activeUser.name}
                      rating={activeUser.rating}
                      avatar={activeUser.avatar}
                      frame={activeUser.frame}
                      size={34}
                      rankSize="sm"
                      premium={activeUser.premium}
                    />
                  )}
                </div>

                <div className="messages-log" ref={logRef}>
                  {loadingThread ? (
                    <div className="lb-empty">{t('dm.loading')}</div>
                  ) : messages.length === 0 ? (
                    <div className="messages-hint">{t('dm.firstHint')}</div>
                  ) : (
                    messages.map((m, i, arr) => {
                      // Gönderenin fotoğrafı: her ardışık grubun SON mesajının yanında (WhatsApp tarzı).
                      const showAvatar = i === arr.length - 1 || arr[i + 1].mine !== m.mine
                      return (
                        <div key={m.id} className={`msg-row ${m.mine ? 'mine' : 'theirs'}`}>
                          {showAvatar ? (
                            <AvatarFrame
                              src={m.mine ? myAvatar ?? null : activeUser?.avatar ?? null}
                              frame={m.mine ? myFrame ?? null : activeUser?.frame ?? null}
                              name={m.mine ? myName ?? '' : activeUser?.name ?? ''}
                              size={30}
                              className="msg-avatar"
                            />
                          ) : (
                            <span className="msg-avatar-spacer" aria-hidden="true" />
                          )}
                          <div className={`msg-bubble ${m.mine ? 'mine' : 'theirs'}`}>
                            <span className="msg-text">{m.body}</span>
                            <span className="msg-meta">
                              <span className="msg-time">{fmtTime(m.created_at)}</span>
                              {m.mine && (
                                <span
                                  className={`msg-tick ${m.read ? 'read' : ''}`}
                                  aria-label={m.read ? t('dm.read') : t('dm.sent')}
                                  title={m.read ? t('dm.read') : t('dm.sent')}
                                >
                                  <Icon name={m.read ? 'checks' : 'check'} size={14} />
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                  {partnerTyping && (
                    <div className="messages-typing" aria-live="polite">
                      <span className="typing-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="typing-label">{t('dm.typing')}</span>
                    </div>
                  )}
                  <div ref={listEndRef} />
                </div>

                <div className="messages-compose">
                  <div className="emoji-wrap">
                    <button
                      type="button"
                      className="emoji-btn"
                      onClick={() => setEmojiOpen((o) => !o)}
                      aria-label="Emoji"
                      title="Emoji"
                    >
                      🙂
                    </button>
                    {emojiOpen && (
                      <div className="emoji-pop">
                        {EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            className="emoji-item"
                            onClick={() => {
                              setText((v) => (v + e).slice(0, 1000))
                              inputRef.current?.focus()
                            }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value)
                      // Yazarken karsi tarafa "yaziyor…" nabzi (en fazla ~2.5 sn'de bir)
                      if (activeId != null && e.target.value.trim()) {
                        const now = Date.now()
                        if (now - typingSentRef.current > 2500) {
                          typingSentRef.current = now
                          sendTyping(activeId).catch(() => {})
                        }
                      }
                    }}
                    placeholder={t('dm.placeholder')}
                    maxLength={1000}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), doSend())}
                  />
                  <Button variant="default" size="icon" disabled={sending || !text.trim()} onClick={doSend} aria-label={t('dm.send')}>
                    <Icon name="arrow-right" size={18} />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

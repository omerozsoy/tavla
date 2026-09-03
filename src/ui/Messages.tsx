import { useEffect, useRef, useState, useCallback } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import {
  getThreads,
  getThread,
  sendMessage,
  type ChatThread,
  type ChatMessage,
  type ChatUser,
} from '../api'
import PlayerIdentity from './PlayerIdentity'
import { Button } from '@/components/ui/button'

interface Props {
  focusUserId?: number | null // acilirken dogrudan bu arkadasin konusmasini ac
  onClose: () => void
  onRead?: () => void // gelenler okundu -> App rozetini tazele
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

export default function Messages({ focusUserId, onClose, onRead }: Props) {
  const { t } = useT()
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
  const listEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Aktif konusmayi yukle (gelenleri okundu isaretler)
  const loadThread = useCallback(async (uid: number, silent = false) => {
    if (!silent) setLoadingThread(true)
    try {
      const d = await getThread(uid)
      setActiveUser(d.user)
      setMessages(d.messages)
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

  // Aktif konusma degisince yukle
  useEffect(() => {
    if (activeId != null) loadThread(activeId)
  }, [activeId, loadThread])

  // Aktif konusma acikken 5 sn'de bir sessiz tazele (yeni mesajlar)
  useEffect(() => {
    if (activeId == null) return
    const id = window.setInterval(() => {
      loadThread(activeId, true)
      refreshThreads()
    }, 5000)
    return () => window.clearInterval(id)
  }, [activeId, loadThread, refreshThreads])

  // Yeni mesajda en alta kaydir
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, activeId])

  async function doSend() {
    const body = text.trim()
    if (!body || sending || activeId == null) return
    setEmojiOpen(false)
    setSending(true)
    // Iyimser ekle
    const optimistic: ChatMessage = { id: -Date.now(), body, mine: true, created_at: new Date().toISOString() }
    setMessages((m) => [...m, optimistic])
    setText('')
    try {
      const r = await sendMessage(activeId, body)
      setMessages((m) => m.map((x) => (x.id === optimistic.id ? r.message : x)))
      refreshThreads()
    } catch {
      // Basarisiz -> iyimser mesaji geri al
      setMessages((m) => m.filter((x) => x.id !== optimistic.id))
      setText(body)
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
          {/* Sol: konusma listesi (gelen kutusu) */}
          <div className="messages-threads">
            {loadingThreads ? (
              <div className="lb-empty">{t('dm.loading')}</div>
            ) : threads.length === 0 ? (
              <div className="lb-empty">{t('dm.empty')}</div>
            ) : (
              threads.map((th) => (
                <button
                  key={th.user.id}
                  type="button"
                  className={`messages-thread ${activeId === th.user.id ? 'active' : ''}`}
                  onClick={() => setActiveId(th.user.id)}
                >
                  <PlayerIdentity
                    name={th.user.name}
                    rating={th.user.rating}
                    avatar={th.user.avatar}
                    frame={th.user.frame}
                    size={38}
                    rankSize="sm"
                  />
                  <span className="messages-thread-body">
                    <span className="messages-thread-last">
                      {th.last ? (th.last.mine ? `${t('dm.you')}: ${th.last.body}` : th.last.body) : ''}
                    </span>
                  </span>
                  {th.unread > 0 && <span className="messages-badge">{th.unread}</span>}
                </button>
              ))
            )}
          </div>

          {/* Sag: aktif konusma */}
          <div className="messages-thread-view">
            {activeId == null ? (
              <div className="messages-placeholder">
                <Icon name="chat" size={40} />
                <p>{t('dm.pick')}</p>
              </div>
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
                    />
                  )}
                </div>

                <div className="messages-log">
                  {loadingThread ? (
                    <div className="lb-empty">{t('dm.loading')}</div>
                  ) : messages.length === 0 ? (
                    <div className="messages-hint">{t('dm.firstHint')}</div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`msg-bubble ${m.mine ? 'mine' : 'theirs'}`}>
                        <span className="msg-text">{m.body}</span>
                        <span className="msg-time">{fmtTime(m.created_at)}</span>
                      </div>
                    ))
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
                    onChange={(e) => setText(e.target.value)}
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

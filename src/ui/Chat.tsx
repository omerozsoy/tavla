import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useT } from '../i18n'
import type { ChatMsg, Slot } from '../api'
import { Button } from '@/components/ui/button'

interface Props {
  messages: ChatMsg[]
  mySlot: Slot
  onSend: (text: string) => void
  canText?: boolean // serbest yazili sohbet (premium); false ise sadece emoji
  onUpgrade?: () => void
  loggedIn?: boolean // MISAFIR sohbet edemez -> false ise giris prompt'u gosterilir
  onLogin?: () => void // giris modalini ac
}

// En cok kullanilan 12 emoji (az tutuldu -> panel tasmaz/bozulmaz).
const EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '😢', '👍', '👎', '🙏', '🔥', '🎲', '🎉']

export default function Chat({ messages, mySlot, onSend, canText = true, onUpgrade, loggedIn = true, onLogin }: Props) {
  const { t } = useT()
  const [text, setText] = useState('')
  // Maca girince sohbet KAPALI baslar; baslikla acilir.
  const [open, setOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Okunmamis mesaj sayaci: sohbet KAPALIYKEN rakipten (slot !== mySlot) gelen mesajlari
  // say -> baslikta kirmizi rozet goster. Acilinca sifirlanir (kullanici gordu).
  const [unread, setUnread] = useState(0)
  const prevLenRef = useRef(messages.length)
  useEffect(() => {
    const prev = prevLenRef.current
    if (messages.length > prev) {
      const incoming = messages.slice(prev).filter((m) => m.slot !== mySlot).length
      if (!open && incoming > 0) setUnread((u) => u + incoming)
    }
    prevLenRef.current = messages.length
  }, [messages, open, mySlot])
  useEffect(() => {
    if (open) setUnread(0)
  }, [open])

  // Yeni mesajda en alta kaydir
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open])

  const submit = () => {
    const v = text.trim()
    if (!v) return
    onSend(v)
    setText('')
    setEmojiOpen(false)
  }

  return (
    <div className={`chat-panel ${open ? 'open' : 'closed'}`}>
      <button className={`chat-head ${!open && unread > 0 ? 'has-unread' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span><Icon name="chat" size={16} /> {t('chat.title')}</span>
        <span className="chat-head-right">
          {!open && unread > 0 && <span className="chat-unread">{unread > 9 ? '9+' : unread}</span>}
          <span className="chat-toggle">{open ? '▾' : '▴'}</span>
        </span>
      </button>

      {open && (
        <>
          <div className="chat-list" ref={listRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">{t('chat.empty')}</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.slot === mySlot ? 'mine' : 'theirs'}`}>
                  <span className="chat-name">{m.name}</span>
                  <span className="chat-text">{m.text}</span>
                </div>
              ))
            )}
          </div>

          {loggedIn && emojiOpen && (
            <div className="chat-emojis">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="emoji-btn"
                  onClick={() => setText((v) => (v + e).slice(0, 280))}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input">
            {!loggedIn ? (
              // MİSAFİR: sohbet edemez -> giriş prompt'u (emoji/yazma yok).
              <Button variant="secondary" className="flex-1" onClick={onLogin}>
                <Icon name="user" size={14} /> {t('auth.doLogin')}
              </Button>
            ) : (
              <>
                <button
                  type="button"
                  className={`chat-icon-btn ${emojiOpen ? 'active' : ''}`}
                  onClick={() => setEmojiOpen((v) => !v)}
                  aria-label="Emoji"
                  title="Emoji"
                >
                  <Icon name="smiley" size={18} />
                </button>
                {canText ? (
                  <>
                    <input
                      value={text}
                      maxLength={280}
                      placeholder={t('chat.placeholder')}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submit()
                      }}
                    />
                    <button
                      type="button"
                      className="chat-icon-btn chat-send"
                      onClick={submit}
                      disabled={!text.trim()}
                      aria-label={t('chat.send')}
                      title={t('chat.send')}
                    >
                      <Icon name="paper-plane-right" size={18} />
                    </button>
                  </>
                ) : (
                  <Button variant="secondary" className="flex-1 chat-premium" onClick={onUpgrade}>
                    <Icon name="crown" size={14} /> {t('chat.premium')}
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

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
}

// Yaygin emojiler (hazir panel)
const EMOJIS = [
  '😀', '😂', '😉', '😎', '😍', '🤔', '😅', '😴',
  '😢', '😡', '👍', '👎', '👏', '🙏', '💪', '🔥',
  '🎲', '🎉', '❤️', '💔', '😱', '🤯', '🥳', '🤝',
  '😏', '🫡', '👋', '🍀', '⭐', '💯', '😤', '🙈',
]

export default function Chat({ messages, mySlot, onSend, canText = true, onUpgrade }: Props) {
  const { t } = useT()
  const [text, setText] = useState('')
  // Maca girince sohbet KAPALI baslar; baslikla acilir.
  const [open, setOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

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
      <button className="chat-head" onClick={() => setOpen((v) => !v)}>
        <span><Icon name="chat" size={16} /> {t('chat.title')}</span>
        <span className="chat-toggle">{open ? '▾' : '▴'}</span>
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

          {emojiOpen && (
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
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="shrink-0"
              onClick={() => setEmojiOpen((v) => !v)}
              title="Emoji"
            >
              😊
            </Button>
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
                <Button variant="default" className="shrink-0" onClick={submit}>{t('chat.send')}</Button>
              </>
            ) : (
              <Button variant="secondary" className="flex-1" onClick={onUpgrade}>
                <Icon name="crown" size={14} /> {t('chat.premium')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

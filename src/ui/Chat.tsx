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
  /** Oyun-ici menu (sag drawer) acikken TRUE: sohbeti menu backdrop'unun arkasina indir
      ki menunun alt aksiyonlarini (Lobi / Pes Et) ORTMESIN. Mount kalir -> okunmamis surer. */
  behindMenu?: boolean
  /** Küfür uyarısı / konuşma yasağı (kırmızı küçük yazı). null -> gösterilmez. */
  notice?: string | null
  /** SALT OKUNUR (yönetici izleme): yalnız mesaj listesi; emoji/yazma kutusu çizilmez. */
  readOnly?: boolean
  /** Gönderen adına tıklayınca (yönetici moderasyon): o slot'un oyuncu profilini aç. */
  onNameClick?: (slot: Slot) => void
}

// En cok kullanilan 12 emoji (az tutuldu -> panel tasmaz/bozulmaz).
const EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '😢', '👍', '👎', '🙏', '🔥', '🎲', '🎉']

export default function Chat({ messages, mySlot, onSend, canText = true, onUpgrade, loggedIn = true, onLogin, behindMenu = false, notice = null, readOnly = false, onNameClick }: Props) {
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
  // Yönetici izlemede (readOnly) sohbet varsa KENDİLİĞİNDEN açık gelsin (bir kez; admin
  // sonradan kapatabilir). Oyuncu sohbeti eskisi gibi kapalı başlar (başlıkla açılır).
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (readOnly && !autoOpenedRef.current && messages.length > 0) {
      autoOpenedRef.current = true
      setOpen(true)
    }
  }, [readOnly, messages.length])
  // Genis masaustunde (>=1440px, CSS) acik sohbet tahtanin YANINA yerlesir: body sinifi oyun
  // sahnesine sag pay + daha kucuk --board-h verir (tahta ortulmez, perde yok).
  useEffect(() => {
    document.body.classList.toggle('chat-open', open && !behindMenu)
    return () => document.body.classList.remove('chat-open')
  }, [open, behindMenu])
  // Esc acik sohbet sayfasini kapatir.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Yeni mesajda en alta kaydir -- YALNIZ kullanıcı zaten en alttaysa. Yukarı kaydırıp
  // geçmişi okuyan (admin) izleyiciyi her poll'de zıplatma; konumu scroll bayrağı belirler.
  const atBottomRef = useRef(true)
  useEffect(() => {
    const el = listRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages, open])

  const submit = () => {
    const v = text.trim()
    if (!v) return
    onSend(v)
    setText('')
    setEmojiOpen(false)
  }

  // Acik sohbet = sagdan acilan sayfa (sheet) + perde. Eskiden tahtanin sag alt kosesine sabit
  // 260px panel olarak aciliyor ve 1-4 numarali haneleri + bear-off tepsisini ortuyordu.
  // Kapaliyken: masaustu/dikeyde kose hapi, yatay telefonda kompakt ikon dugmesi (CSS).
  return (
    <>
    {open && !behindMenu && <div className="chat-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
    <div
      className={`chat-panel ${open ? 'open' : 'closed'} ${behindMenu ? 'behind-menu' : ''}`}
      role={open ? 'dialog' : undefined}
      aria-label={open ? t('chat.title') : undefined}
    >
      <button
        className={`chat-head ${!open && unread > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('chat.title')}
      >
        <span className="chat-head-label"><Icon name="chat" size={16} /> <span className="chat-head-text">{t('chat.title')}</span></span>
        <span className="chat-head-right">
          {!open && unread > 0 && <span className="chat-unread">{unread > 9 ? '9+' : unread}</span>}
          <span className="chat-toggle">{open ? <Icon name="x" size={16} /> : '▴'}</span>
        </span>
      </button>

      {open && (
        <>
          <div
            className="chat-list"
            ref={listRef}
            onScroll={() => {
              const el = listRef.current
              if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            }}
          >
            {messages.length === 0 ? (
              <div className="chat-empty">{t('chat.empty')}</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.slot === mySlot ? 'mine' : 'theirs'}`}>
                  {onNameClick ? (
                    <button type="button" className="chat-name chat-name-btn" onClick={() => onNameClick(m.slot)}>
                      {m.name}
                    </button>
                  ) : (
                    <span className="chat-name">{m.name}</span>
                  )}
                  <span className="chat-text">{m.text}</span>
                </div>
              ))
            )}
          </div>

          {!readOnly && loggedIn && emojiOpen && (
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

          {notice && <div className="chat-notice" role="alert">{notice}</div>}
          {!readOnly && <div className="chat-input">
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
          </div>}
        </>
      )}
    </div>
    </>
  )
}

import { useState } from 'react'
import './betaBanner.css'

// Surum TEK KAYNAK: vite.config define'i package.json'dan okur (elle yazilmaz).
declare const __APP_VERSION__: string
const VERSION = `v${__APP_VERSION__}`
// Kapatma tercihi surume bagli: yeni surumde bant TEKRAR gorunur.
const DISMISS_KEY = `beta-banner-dismissed-${VERSION}`

// Kayan duyuru metinleri. strong=true -> parlak (#FAF9F5), digerleri sonuk (0.72).
const MESSAGES: { text: string; strong?: boolean }[] = [
  { text: `SÜRÜM ${VERSION}`, strong: true },
  { text: 'BU SÜRÜM TEST AŞAMASINDADIR' },
  { text: 'HATALAR VE EKSİK ÖZELLİKLER OLABİLİR' },
  { text: 'GERİ BİLDİRİM GÖNDERİN' },
]

// Tek tur metin dizisi (her mesajdan sonra ◆ ayrac -> dongude uniform aralik + kusursuz ek).
function Sequence({ hidden }: { hidden?: boolean }) {
  return (
    <div className="bb-seq" aria-hidden={hidden || undefined}>
      {MESSAGES.map((m, i) => (
        <span className="bb-item" key={i}>
          <span className={m.strong ? 'bb-msg bb-msg-strong' : 'bb-msg'}>{m.text}</span>
          <span className="bb-sep" aria-hidden="true">◆</span>
        </span>
      ))}
    </div>
  )
}

/**
 * Ince BETA duyuru bandi (account bar'in ALTINDA, sticky). Sol sabit BETA rozeti + orta
 * kesintisiz kayan marquee + sag kapat butonu. Kapatma surume ozel localStorage'a yazilir;
 * surum degisince tekrar gorunur. Surum package.json'dan (__APP_VERSION__) okunur.
 */
export default function BetaBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  if (dismissed) return null

  const close = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* localStorage yoksa yok say */
    }
  }

  return (
    <div className="beta-banner" role="region" aria-label="Beta duyurusu">
      <div className="bb-badge">
        <span className="bb-dot" aria-hidden="true" />
        BETA
      </div>
      <div className="bb-marquee">
        {/* Icerik IKI kez: width:max-content + translateX(0 -> -50%) = kusursuz dongu. */}
        <div className="bb-track">
          <Sequence />
          <Sequence hidden />
        </div>
      </div>
      <button type="button" className="bb-close" onClick={close} aria-label="Bandı kapat">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M1 1 L11 11 M11 1 L1 11"
            stroke="#141413"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

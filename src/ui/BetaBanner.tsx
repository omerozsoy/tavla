import { useState } from 'react'
import './betaBanner.css'

// Surum TEK KAYNAK: vite.config define'i package.json'dan okur (elle yazilmaz).
declare const __APP_VERSION__: string
// Etikette major.minor goster: "2.2.0" -> "v2.2" (sondaki .0 kirpilir).
const VERSION = `v${__APP_VERSION__.replace(/\.0$/, '')}`
// Kapatma tercihi surume bagli: yeni surumde bant TEKRAR gorunur.
const DISMISS_KEY = `beta-banner-dismissed-${VERSION}`

// Kayan duyuru metinleri. strong=true -> parlak (#FAF9F5), digerleri sonuk (0.72).
const MESSAGES: { text: string; strong?: boolean }[] = [
  { text: `SÜRÜM ${VERSION}`, strong: true },
  { text: 'BU SÜRÜM TEST AŞAMASINDADIR' },
  { text: 'HATALAR VE EKSİK ÖZELLİKLER OLABİLİR' },
  { text: 'LÜTFEN GERİ BİLDİRİM GÖNDERİN' },
]

// Kesintisiz akis: tek dizi genis ekranda viewport'tan dar kalinca arada BOSLUK
// olusup akis "bitmis" gibi gorunuyordu. Diziyi cok kez tekrarla ki her an ekran
// dolu kalsin (translateX bir dizi-boyu kayar -> kusursuz dongu). Bkz. keyframe.
const LOOPS = 6

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
        {/* Icerik LOOPS kez: width:max-content + translateX(0 -> -1 dizi) = kusursuz,
            hic durmayan dongu (genis ekranda bile bosluk olmaz). */}
        <div className="bb-track">
          {Array.from({ length: LOOPS }).map((_, i) => (
            <Sequence key={i} hidden={i > 0} />
          ))}
        </div>
      </div>
      <button type="button" className="bb-close" onClick={close} aria-label="Bandı kapat">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M1 1 L11 11 M11 1 L1 11"
            stroke="#FAF9F5"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

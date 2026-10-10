import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'

// "TavlaTv'yi yükle" istemi. Kök seviyede (main.tsx) mount edilir; normalde görünmez.
// - Android/masaüstü Chrome/Edge: beforeinstallprompt yakalanır -> kendi düğmemizle kurulum penceresi açılır.
// - iOS/iPadOS Safari: bu olay YOK -> "Paylaş → Ana Ekrana Ekle" yönergesi gösterilir.
// - Başka tarayıcı/standalone/kısa süre önce kapatıldıysa: hiçbir şey gösterilmez (çalışmayan düğme yok).
// - Aktif maç sırasında banner GÖSTERİLMEZ (güvenli ana ertelenir). Özellik algılama esas; UA yalnız iOS Safari ayrımı için.

const DISMISS_KEY = 'tavla.pwaInstallDismissed'
const DISMISS_DAYS = 14

// PWA "Yükle" banner'ı KAPATILDI: native uygulamaya (Android/iOS) geçiliyor, PWA kurulumu
// artık teşvik edilmiyor. Geri açmak için: ENABLED = true.
const ENABLED = false

type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// iOS/iPadOS GERÇEK Safari mi? (Ana Ekrana Ekle yalnız Safari'de var; Chrome/Firefox iOS'ta yok.)
function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS "Mac" gibi görünür
  return iOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

function dismissedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return t > 0 && Date.now() - t < DISMISS_DAYS * 864e5
  } catch {
    return false
  }
}

function inActiveMatch(): boolean {
  return !!document.querySelector('.app.game-view')
}

// Güncelleme bandı (UpdateBanner) aynı köşede: ikisi üst üste binmesin -> o görünürken bekle.
function updateBannerVisible(): boolean {
  return !!document.querySelector('.update-banner')
}

export default function InstallPrompt() {
  const { t } = useT()
  const deferredRef = useRef<BIPEvent | null>(null)
  const [mode, setMode] = useState<'none' | 'prompt' | 'ios'>('none')
  const [show, setShow] = useState(false)
  const [guide, setGuide] = useState(false)

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return

    const onBip = (e: Event) => {
      e.preventDefault() // tarayıcının otomatik mini-infobar'ını bastır; kendi düğmemizle sun
      deferredRef.current = e as BIPEvent
      setMode('prompt')
    }
    const onInstalled = () => {
      deferredRef.current = null
      setMode('none')
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()))
      } catch {
        /* yok */
      }
    }
    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    if (isIosSafari()) setMode('ios') // iOS'ta beforeinstallprompt yok -> yönergeli düğme

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Yalnız güvenli anda (aktif maç yokken) banner'ı göster; maçtayken ertele.
  useEffect(() => {
    if (mode === 'none') {
      setShow(false)
      return
    }
    const tick = () => {
      if (isStandalone() || dismissedRecently()) {
        setShow(false)
        return
      }
      setShow(!inActiveMatch() && !updateBannerVisible())
    }
    tick()
    const id = window.setInterval(tick, 1500)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [mode])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* yok */
    }
    setShow(false)
    setGuide(false)
  }

  const install = async () => {
    if (mode === 'ios') {
      setGuide(true)
      return
    }
    const d = deferredRef.current
    if (!d) return
    try {
      await d.prompt()
      const { outcome } = await d.userChoice
      deferredRef.current = null
      if (outcome === 'accepted') {
        setShow(false)
        setMode('none')
      } else {
        dismiss() // iptal -> bir süre tekrar sorma
      }
    } catch {
      /* yok */
    }
  }

  if (!ENABLED || !show) return null

  return (
    <div
      className="install-prompt"
      role="dialog"
      aria-label={t('pwa.install')}
      style={{
        position: 'fixed',
        insetInlineStart: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        transform: 'translateX(-50%)',
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 24px)',
        padding: '10px 10px 10px 16px',
        borderRadius: 12,
        background: 'rgba(17,17,20,0.96)',
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        font: '500 14px/1.35 system-ui, sans-serif',
      }}
    >
      <Icon name="install" size={20} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{t('pwa.install')}</div>
        <div style={{ opacity: 0.75, fontSize: 12 }}>{t('pwa.installHint')}</div>
      </div>
      <Button type="button" onClick={install} className="shrink-0">
        {t('pwa.installBtn')}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.close')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          opacity: 0.7,
          cursor: 'pointer',
          width: 40,
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="x" size={18} />
      </button>

      {guide &&
        createPortal(
        <div
          role="dialog"
          aria-label={t('pwa.iosTitle')}
          onClick={() => setGuide(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483001,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            font: '500 14px/1.35 system-ui, sans-serif',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, calc(100vw - 24px))',
              margin: '0 12px calc(env(safe-area-inset-bottom, 0px) + 16px)',
              padding: 18,
              borderRadius: 16,
              background: '#1C1A17',
              color: '#F4EFE6',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="install" size={20} />
              <strong style={{ flex: 1 }}>{t('pwa.iosTitle')}</strong>
              <button
                type="button"
                onClick={() => setGuide(false)}
                aria-label={t('common.close')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.6 }}>
              <li>{t('pwa.iosStep1')}</li>
              <li>{t('pwa.iosStep2')}</li>
              <li>{t('pwa.iosStep3')}</li>
            </ol>
          </div>
        </div>,
          document.body,
        )}
    </div>
  )
}

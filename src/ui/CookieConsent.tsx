import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { getCookieConsent } from '../api'
import {
  ACCEPT_ALL,
  ONLY_NECESSARY,
  applyConsent,
  applyConsentOrReload,
  getConsent,
  needsConsent,
  saveConsent,
  type ConsentConfig,
} from '../consent'
import './cookieConsent.css'

// Footer / diğer yerlerden tercih modalını açmak için olay adları (App'e state eklemeden).
export const OPEN_COOKIE_PREFS = 'tavla:cookie-prefs'
export const OPEN_LEGAL = 'tavla:open-legal' // detail: { slug }

function openLegal(slug: string) {
  window.dispatchEvent(new CustomEvent(OPEN_LEGAL, { detail: { slug } }))
}

// Varsayılan (backend erişilemezse) TR metinler — admin panel değerleri bunları ezer.
const FALLBACK: ConsentConfig = {
  banner_title: 'Çerez Tercihleriniz',
  banner_body:
    'Size daha iyi bir deneyim sunmak, oturumunuzu güvenli şekilde yönetmek, site kullanımını analiz etmek ve tercihlerinizi hatırlamak için çerezler kullanıyoruz. Zorunlu çerezler sitenin çalışması için gereklidir. Diğer çerezlerin kullanımına ilişkin tercihlerinizi dilediğiniz zaman belirleyebilirsiniz.',
  modal_title: 'Çerez Tercihleri',
  modal_desc:
    'Çerez tercihlerinizi aşağıdan yönetebilirsiniz. Zorunlu çerezler, internet sitesinin temel işlevlerinin çalışabilmesi için gereklidir ve devre dışı bırakılamaz. Diğer kategoriler için tercihinizi değiştirebilirsiniz.',
  categories: {
    necessary:
      'Bu çerezler internet sitesinin güvenli ve doğru şekilde çalışması için gereklidir. Oturum yönetimi, güvenlik, kullanıcı girişi ve temel site özellikleri bu kapsamda değerlendirilebilir.',
    functional:
      'Tercihlerinizin hatırlanması ve internet sitesinin size daha uygun şekilde çalışması için kullanılan çerezlerdir.',
    analytics:
      'İnternet sitesinin nasıl kullanıldığını anlamamıza, performansı ölçmemize ve kullanıcı deneyimini geliştirmemize yardımcı olan çerezlerdir.',
    marketing:
      'İzin vermeniz halinde reklamların ve pazarlama faaliyetlerinin etkinliğini ölçmek ve daha ilgili içerikler sunmak amacıyla kullanılan çerezlerdir.',
  },
  consent_version: 1,
}

/**
 * Çerez onay altyapısı: alt banner (ilk girişte) + tercih modalı. Kullanıcı onay vermeden
 * zorunlu-olmayan script'ler (GA/GTM/Pixel) YÜKLENMEZ (bkz src/consent.ts). Tercih kalıcı
 * ve sürümlüdür; footer "Çerez Tercihleri" bağlantısı modalı tekrar açar (olay ile).
 */
export function CookieConsent() {
  const [cfg, setCfg] = useState<ConsentConfig | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const cfgRef = useRef<ConsentConfig | null>(null)

  // Yapılandırmayı çek; mevcut onayı (varsa) hemen uygula (onaylı script'leri yükle).
  useEffect(() => {
    let alive = true
    getCookieConsent()
      .then((c) => {
        if (!alive) return
        const conf = c || FALLBACK
        cfgRef.current = conf
        setCfg(conf)
        const existing = getConsent()
        if (existing && !needsConsent(conf.consent_version)) {
          applyConsent(existing, conf) // önceden onaylı -> script'leri yükle
        } else {
          setShowBanner(true) // onay yok / sürüm eskimiş -> banner göster
        }
      })
      .catch(() => {
        if (!alive) return
        cfgRef.current = FALLBACK
        setCfg(FALLBACK)
        if (needsConsent(FALLBACK.consent_version)) setShowBanner(true)
        else {
          const ex = getConsent()
          if (ex) applyConsent(ex, FALLBACK)
        }
      })
    return () => {
      alive = false
    }
  }, [])

  // Footer / diğer yerlerden "Çerez Tercihleri" -> modalı aç.
  useEffect(() => {
    const open = () => setPrefsOpen(true)
    window.addEventListener(OPEN_COOKIE_PREFS, open)
    return () => window.removeEventListener(OPEN_COOKIE_PREFS, open)
  }, [])

  const version = cfg?.consent_version ?? 1

  const acceptAll = useCallback(() => {
    const rec = saveConsent(ACCEPT_ALL, version)
    applyConsent(rec, cfgRef.current)
    setShowBanner(false)
    setPrefsOpen(false)
  }, [version])

  const onlyNecessary = useCallback(() => {
    const rec = saveConsent(ONLY_NECESSARY, version)
    applyConsentOrReload(rec, cfgRef.current)
    setShowBanner(false)
    setPrefsOpen(false)
  }, [version])

  if (!cfg) return null

  return (
    <>
      {showBanner && !prefsOpen && (
        <div className="cc-banner" role="dialog" aria-live="polite" aria-label={cfg.banner_title || 'Çerez'}>
          <div className="cc-banner-inner">
            <div className="cc-banner-main">
              <h2 className="cc-title">{cfg.banner_title || FALLBACK.banner_title}</h2>
              <p className="cc-text">{cfg.banner_body || FALLBACK.banner_body}</p>
              <div className="cc-links">
                <button type="button" className="cc-link" onClick={() => openLegal('cerez-politikasi')}>
                  Çerez Politikası
                </button>
                <button type="button" className="cc-link" onClick={() => openLegal('gizlilik-politikasi')}>
                  Gizlilik Politikası
                </button>
              </div>
            </div>
            <div className="cc-actions">
              <Button variant="default" className="cc-grow" onClick={acceptAll}>
                Tümünü Kabul Et
              </Button>
              <Button variant="outline" className="cc-grow" onClick={onlyNecessary}>
                Yalnızca Zorunlular
              </Button>
              <Button variant="ghost" className="cc-grow" onClick={() => setPrefsOpen(true)}>
                Tercihleri Yönet
              </Button>
            </div>
          </div>
        </div>
      )}

      {prefsOpen && (
        <CookiePreferences
          cfg={cfg}
          onClose={() => setPrefsOpen(false)}
          onAcceptAll={acceptAll}
          onOnlyNecessary={onlyNecessary}
          onSave={(cats) => {
            const rec = saveConsent(cats, version)
            applyConsentOrReload(rec, cfgRef.current)
            setPrefsOpen(false)
            setShowBanner(false)
          }}
        />
      )}
    </>
  )
}

function CookiePreferences({
  cfg,
  onClose,
  onAcceptAll,
  onOnlyNecessary,
  onSave,
}: {
  cfg: ConsentConfig
  onClose: () => void
  onAcceptAll: () => void
  onOnlyNecessary: () => void
  onSave: (cats: { functional: boolean; analytics: boolean; marketing: boolean }) => void
}) {
  useEscape(onClose)
  const existing = getConsent()
  const [functional, setFunctional] = useState(existing?.functional ?? false)
  const [analytics, setAnalytics] = useState(existing?.analytics ?? false)
  const [marketing, setMarketing] = useState(existing?.marketing ?? false)
  const cats = cfg.categories || {}

  const rows: { key: string; name: string; desc?: string | null; always?: boolean; val?: boolean; set?: (v: boolean) => void }[] = [
    { key: 'necessary', name: 'Zorunlu Çerezler', desc: cats.necessary, always: true },
    { key: 'functional', name: 'İşlevsel Çerezler', desc: cats.functional, val: functional, set: setFunctional },
    { key: 'analytics', name: 'Analitik Çerezler', desc: cats.analytics, val: analytics, set: setAnalytics },
    { key: 'marketing', name: 'Pazarlama Çerezleri', desc: cats.marketing, val: marketing, set: setMarketing },
  ]

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="register-card cc-prefs-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </Button>
        <h2 className="info-title">{cfg.modal_title || FALLBACK.modal_title}</h2>
        <p className="cc-text">{cfg.modal_desc || FALLBACK.modal_desc}</p>

        <div className="cc-cats">
          {rows.map((r) => (
            <div className="cc-cat" key={r.key}>
              <div className="cc-cat-head">
                <span className="cc-cat-name">{r.name}</span>
                {r.always ? (
                  <span className="cc-always">Her Zaman Aktif</span>
                ) : (
                  <label className="cc-switch">
                    <input type="checkbox" checked={!!r.val} onChange={(e) => r.set!(e.target.checked)} />
                    <span className="cc-slider" />
                  </label>
                )}
              </div>
              {r.desc && <p className="cc-cat-desc">{r.desc}</p>}
            </div>
          ))}
        </div>

        <div className="cc-modal-actions">
          <Button variant="default" className="cc-grow" onClick={() => onSave({ functional, analytics, marketing })}>
            Seçimlerimi Kaydet
          </Button>
          <Button variant="secondary" className="cc-grow" onClick={onAcceptAll}>
            Tümünü Kabul Et
          </Button>
          <Button variant="outline" className="cc-grow" onClick={onOnlyNecessary}>
            Yalnızca Zorunlular
          </Button>
        </div>
      </div>
    </div>
  )
}

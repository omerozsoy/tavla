import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// shadcn/ui + Tailwind katmani App.css'ten SONRA yuklenir (utility'ler oncelikli olsun)
import './shadcn.css'
import { LangProvider } from './i18n.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import { ToastProvider } from './ui/Toast.tsx'
import { TopRanksProvider } from './topRanks.tsx'
import { RolesProvider } from './roles.tsx'
import { PresenceProvider } from './presence.tsx'
import GatePrompt from './ui/GatePrompt.tsx'
import PullToRefresh from './ui/PullToRefresh.tsx'
import UpdateBanner from './ui/UpdateBanner.tsx'
import InstallPrompt from './ui/InstallPrompt.tsx'
import OfflineBanner from './ui/LoadError.tsx'
import { initGoogleTag } from './analytics.ts'
import { applyCachedRankThresholds, initRankThresholds } from './rankConfig.ts'
import { installAutoUpdate } from './autoUpdate.ts'
import { reportReloadDiag } from './reloadDiag.ts'
import { installScrollRestore } from './scrollRestore.ts'
import { BRAND } from './brand.ts'

// Çoklu-domain: ana sayfa statik servis edildiğinden (DirectoryIndex) server-side marka
// enjeksiyonu '/' için garanti değil. İstemci marka düzeltmesi: dil, PWA manifest, apple başlık,
// og:site_name — ziyaret edilen domaine göre. tavlatv.com'da no-op (statik değerler zaten doğru).
try {
  document.documentElement.lang = BRAND.locale
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', BRAND.manifest)
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', BRAND.name)
  document.querySelector('meta[property="og:site_name"]')?.setAttribute('content', BRAND.name)
} catch {
  /* yok */
}

// Rutbe esikleri (admin: Ayarlar > Rating Ayar) onbellekten SENKRON uygulanir -> ilk boyamada
// dogru rutbe gorunur, esik degisiminde "yanlis rozet" flash'i olmaz.
applyCachedRankThresholds()

// Sayfa yenilemede kaldığın kaydırma konumuna dön (içerik geç yüklense bile).
installScrollRestore()

// Kurulu PWA (standalone) isareti: CSS'te `.is-standalone` ile yalniz uygulamada gorunen ogeler
// (orn. sayfa basi "Geri"). display-mode medya sorgusu eski iOS'ta yok -> navigator.standalone da.
try {
  if (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  ) {
    document.documentElement.classList.add('is-standalone')
  }
} catch {
  /* yok */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LangProvider>
        <ToastProvider>
          <TopRanksProvider>
           <RolesProvider>
            <PresenceProvider>
              <App />
              {/* Kapali test sifre kapisi: normalde gorunmez, /api 401 {gate} gelince acilir */}
              <GatePrompt />
              {/* Mobil "aşağı çek-yenile" (native PTR sabit-kabukta çalışmaz) */}
              <PullToRefresh />
              {/* Yeni sürüm algılanınca "güncelleyin" istemi (kendiliğinden reload YOK) */}
              <UpdateBanner />
              {/* "TavlaTv'yi yükle" (PWA): standalone/maç/yakın-zamanda-kapatıldıysa görünmez */}
              <InstallPrompt />
              {/* Bağlantı koptuğunda üstte ince "Çevrimdışısın" şeridi (geri gelince kısa bildirim) */}
              <OfflineBanner />
            </PresenceProvider>
           </RolesProvider>
          </TopRanksProvider>
        </ToastProvider>
      </LangProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// BAYAT BUNDLE ÇÖZÜMÜ: yeni deploy'u algıla; kendiliğinden YENİLEME -> güvenli anda UpdateBanner
// ile "yeni sürüm var, güncelleyin" de. Reload yalnız kullanıcı "Güncelle"ye basınca olur.
installAutoUpdate()

// GEÇİCİ TANI: bu yükleme bir reload ise nedenini (chunk/selfheal/update/ptr/browser) + maç-içi mi
// sunucuya beacon'la -> "maç içinde F5" şikayetinin gerçek kaynağını topla. Yalnız prod.
if (import.meta.env.PROD) reportReloadDiag()

// Google Etiketi (gtag.js): admin panelden yönetilen ID ile dinamik yükle (aktifse). Ana sayfa
// statik servis edildiğinden server-side enjeksiyon home'a ulaşmaz -> client-side tek kaynak.
void initGoogleTag()

// Rutbe esiklerini sunucudan tazele (degisirse acik ekranlar yeniden render olur).
void initRankThresholds()

// PWA: service worker'i kaydet (yuklenebilir + cevrimdisi). Sadece prod'da.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // /service-worker.js = Laravel route (no-store header; bkz web.php). Static /sw.js nginx'te
    // Cloudflare tarafından 4sa cache'leniyordu -> yeni SW geç ulaşıyordu. No-store ile anında güncel.
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      /* SW kaydi basarisiz -> uygulama normal calisir */
    })
  })
}

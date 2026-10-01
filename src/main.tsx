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
import { PresenceProvider } from './presence.tsx'
import GatePrompt from './ui/GatePrompt.tsx'
import PullToRefresh from './ui/PullToRefresh.tsx'
import UpdateBanner from './ui/UpdateBanner.tsx'
import InstallPrompt from './ui/InstallPrompt.tsx'
import { initGoogleTag } from './analytics.ts'
import { applyCachedRankThresholds, initRankThresholds } from './rankConfig.ts'
import { installAutoUpdate } from './autoUpdate.ts'
import { installReloadDiag } from './reloadDiag.ts'

// Rutbe esikleri (admin: Ayarlar > Rating Ayar) onbellekten SENKRON uygulanir -> ilk boyamada
// dogru rutbe gorunur, esik degisiminde "yanlis rozet" flash'i olmaz.
applyCachedRankThresholds()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LangProvider>
        <ToastProvider>
          <TopRanksProvider>
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
            </PresenceProvider>
          </TopRanksProvider>
        </ToastProvider>
      </LangProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// BAYAT BUNDLE ÇÖZÜMÜ: yeni deploy'u algıla; kendiliğinden YENİLEME -> güvenli anda UpdateBanner
// ile "yeni sürüm var, güncelleyin" de. Reload yalnız kullanıcı "Güncelle"ye basınca olur.
installAutoUpdate()

// GEÇİCİ: Safari "çok yenileniyor" şikâyetinin kökünü ölç (reload nedeni/ekran -> /api/diag/reload).
installReloadDiag()

// Google Etiketi (gtag.js): admin panelden yönetilen ID ile dinamik yükle (aktifse). Ana sayfa
// statik servis edildiğinden server-side enjeksiyon home'a ulaşmaz -> client-side tek kaynak.
void initGoogleTag()

// Rutbe esiklerini sunucudan tazele (degisirse acik ekranlar yeniden render olur).
void initRankThresholds()

// PWA: service worker'i kaydet (yuklenebilir + cevrimdisi). Sadece prod'da.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW kaydi basarisiz -> uygulama normal calisir */
    })
  })
}

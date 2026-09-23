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
import { installAutoUpdate } from './autoUpdate.ts'

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
            </PresenceProvider>
          </TopRanksProvider>
        </ToastProvider>
      </LangProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// BAYAT BUNDLE KALICI ÇÖZÜM: yeni deploy'u algılayıp GÜVENLİ anda (aktif maç/ödeme DIŞINDA)
// otomatik yenile. Açık kalan sekmeler eski kodda (maç-sonu desync vb.) takılı kalmasın.
installAutoUpdate()

// PWA: service worker'i kaydet (yuklenebilir + cevrimdisi). Sadece prod'da.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW kaydi basarisiz -> uygulama normal calisir */
    })
  })
}

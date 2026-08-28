import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LangProvider } from './i18n.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import { ToastProvider } from './ui/Toast.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LangProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </LangProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// PWA: service worker'i kaydet (yuklenebilir + cevrimdisi). Sadece prod'da.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW kaydi basarisiz -> uygulama normal calisir */
    })
  })
}

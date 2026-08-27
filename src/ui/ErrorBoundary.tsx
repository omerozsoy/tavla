import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

// Uygulama genel hata siniri: tek bir render hatasi tum uygulamayi beyaz ekrana
// dusurmesin. Hata yakalanir, dostane bir ekran + yenile butonu gosterilir.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Gelistirme icin konsola yaz; prod'da servise gonderilebilir.
    console.error('Uygulama hatasi:', error, info.componentStack)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-card">
            <h1>Bir şeyler ters gitti</h1>
            <p>Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi dene.</p>
            <p className="error-boundary-sub">Something went wrong. Please try reloading the page.</p>
            <button className="galaxy-btn" onClick={this.handleReload}>
              Yenile / Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

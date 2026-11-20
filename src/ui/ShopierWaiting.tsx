import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { paymentStatus } from '../api'
import './CheckoutSwiss.css'

// Shopier ödeme bekleme ekranı (YENİ SEKME akışı): Shopier ayrı sekmede açıldı, kullanıcı bizim
// sekmede kalır. Ödeme durumunu pollar; settle olunca (webhook gelmez -> reconciler ~1dk) "yüklendi"
// gösterir + bakiye güncellenir. Buyer Shopier'den siteye dönmediği için bu ekran dönüşün yerini tutar.
export default function ShopierWaiting({
  order,
  url,
  onPaid,
  onClose,
}: {
  order: string
  url: string
  onPaid: (balance: number | null) => void
  onClose: () => void
}) {
  const [state, setState] = useState<'waiting' | 'paid' | 'failed'>('waiting')
  const [coins, setCoins] = useState(0)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    let tries = 0
    const tick = async () => {
      if (!aliveRef.current) return
      tries++
      try {
        const r = await paymentStatus(order)
        if (r.status === 'paid') {
          aliveRef.current = false
          try {
            localStorage.removeItem('tavla.shopierPending')
          } catch {
            /* yoksay */
          }
          setCoins(r.coins || 0)
          setState('paid')
          onPaid(typeof r.balance === 'number' ? r.balance : null)
          return
        }
        if (r.status === 'failed') {
          aliveRef.current = false
          setState('failed')
        }
      } catch {
        /* geçici hata -> tekrar dene */
      }
      // ~5 dk yokla (webhook gelmese bile reconciler dakikada bir settle eder).
      if (tries >= 60) aliveRef.current = false
    }
    const timer = setInterval(() => {
      if (!aliveRef.current) {
        clearInterval(timer)
        return
      }
      void tick()
    }, 5000)
    void tick()
    return () => {
      aliveRef.current = false
      clearInterval(timer)
    }
  }, [order, onPaid])

  return (
    <div className="register-overlay page">
      <div className="ckw ckw-wait">
        {state === 'waiting' && (
          <>
            <div className="ckw-wait-spin" aria-hidden="true">
              <span className="btn-spinner" />
            </div>
            <h2 className="ckw-title">Ödemen bekleniyor…</h2>
            <p className="ckw-wait-text">
              Ödeme sayfası <strong>yeni sekmede</strong> açıldı. Ödemeni tamamladığında coin'lerin
              buraya otomatik yüklenecek — bu ekranı kapatmana gerek yok.
            </p>
            <a className="ckw-btn ckw-btn-ghost" href={url} target="_blank" rel="noopener noreferrer">
              <Icon name="credit-card" size={16} /> Ödeme sayfasını tekrar aç
            </a>
            <button type="button" className="ckw-wait-cancel" onClick={onClose}>
              Vazgeç
            </button>
          </>
        )}
        {state === 'paid' && (
          <>
            <div className="ckw-wait-ok" aria-hidden="true">
              <Icon name="check" size={40} />
            </div>
            <h2 className="ckw-title">Ödemen alındı! 🎉</h2>
            <p className="ckw-wait-text">{coins > 0 ? `${coins} coin hesabına yüklendi.` : 'Ödemen hesabına işlendi.'}</p>
            <button type="button" className="ckw-btn" onClick={onClose}>
              Tamam
            </button>
          </>
        )}
        {state === 'failed' && (
          <>
            <div className="ckw-wait-fail" aria-hidden="true">
              <Icon name="x" size={36} />
            </div>
            <h2 className="ckw-title">Ödeme tamamlanamadı</h2>
            <p className="ckw-wait-text">Ödemen alınamadı. Tekrar deneyebilir veya başka yöntem seçebilirsin.</p>
            <button type="button" className="ckw-btn" onClick={onClose}>
              Kapat
            </button>
          </>
        )}
      </div>
    </div>
  )
}

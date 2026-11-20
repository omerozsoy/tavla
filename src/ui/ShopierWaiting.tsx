import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { paymentStatus } from '../api'
import './CheckoutSwiss.css'

// Shopier ödeme bekleme ekranı (YENİ SEKME akışı): Shopier ayrı sekmede açıldı, kullanıcı bizim
// sekmede kalır. Ödeme durumunu pollar; settle olunca (webhook gelmez -> reconciler ~1dk) "yüklendi"
// gösterir + bakiye güncellenir. Buyer Shopier'den siteye dönmediği için bu ekran dönüşün yerini tutar.
export default function ShopierWaiting({
  order,
  url,
  getWin,
  onPaid,
  onClose,
}: {
  order: string
  url: string
  // SADECE WEB: ödeme popup'ı (varsa). Kapanınca anında durum kontrolü tetiklenir. Boot/same-tab'de yok.
  getWin?: () => Window | null
  onPaid: (balance: number | null) => void
  onClose: () => void
}) {
  const [state, setState] = useState<'waiting' | 'paid' | 'failed'>('waiting')
  const [coins, setCoins] = useState(0)
  const aliveRef = useRef(true)
  const triesRef = useRef(0)

  // Tek durum kontrolü (hem 5sn interval hem popup-kapandı tetiği buradan geçer).
  const check = useCallback(async () => {
    if (!aliveRef.current) return
    triesRef.current++
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
    if (triesRef.current >= 60) aliveRef.current = false
  }, [order, onPaid])

  useEffect(() => {
    aliveRef.current = true
    triesRef.current = 0
    const timer = setInterval(() => {
      if (!aliveRef.current) {
        clearInterval(timer)
        return
      }
      void check()
    }, 5000)
    void check()
    return () => {
      aliveRef.current = false
      clearInterval(timer)
    }
  }, [check])

  // BONUS (web): popup pencere kapanınca 5sn'yi bekleme — anında kontrol et (ödeme biter bitmez sonuç).
  useEffect(() => {
    if (!getWin) return
    const watch = setInterval(() => {
      if (!aliveRef.current) {
        clearInterval(watch)
        return
      }
      const w = getWin()
      if (w && w.closed) {
        clearInterval(watch)
        void check() // kapandı -> hemen yokla (reconciler henüz işlememişse 5sn interval devam eder)
      }
    }, 700)
    return () => clearInterval(watch)
  }, [getWin, check])

  return (
    <div className="register-overlay page">
      <div className="ckw ckw-wait">
        {state === 'waiting' && (
          <>
            <div className="ckw-wait-spin" aria-hidden="true">
              <span className="btn-spinner" />
            </div>
            <h2 className="ckw-title">Ödemen kontrol ediliyor…</h2>
            <p className="ckw-wait-text">
              Ödemeni Shopier sayfasında tamamladıktan sonra o sekmeyi <strong>kapatabilirsin</strong>.
              Coin'lerin buraya <strong>otomatik</strong> yüklenecek (en geç birkaç dakika) — bu ekranı
              kapatmana gerek yok, siparişini buradan takip edebilirsin.
            </p>
            {url && (
              <a className="ckw-btn ckw-btn-ghost" href={url} target="_blank" rel="noopener noreferrer">
                <Icon name="credit-card" size={16} /> Ödeme sayfasını aç
              </a>
            )}
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

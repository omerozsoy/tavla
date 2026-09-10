import type { CSSProperties } from 'react'

/**
 * PremiumPill — süresi geçerli ücretli üyeyi belirten ismin YANINDA duran ince pill:
 * TAÇ ikonu + "PREMIUM". Avatar dekorasyonundan (24 animasyonlu çerçeve) BAĞIMSIZ ->
 * isim satırına konur, çakışmaz. Renk site ana rengi var(--accent) (sabit hex YOK).
 *
 * TEMA-DUYARLI (kullanıcı): açık temada dolu koyu kiremit pill + beyaz yazı (daha okunur),
 * koyu temada ince soft pill. Stiller App.css `.premium-pill` altında; `style` prop yalnız
 * konumlandırma (margin/vertical-align) içindir, renkleri EZMEZ.
 */
export default function PremiumPill({ style }: { style?: CSSProperties }) {
  return (
    <span className="premium-pill" style={style} title="Premium üye">
      {/* Taç (dolgu yok, ince kontur) — rengi currentColor ile pill yazı rengini izler */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8.5l3.5 2.5L12 5.5l4.5 5.5L20 8.5l-1.4 9H5.4L4 8.5z" />
      </svg>
      PREMIUM
    </span>
  )
}

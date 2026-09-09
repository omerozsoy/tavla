import type { CSSProperties } from 'react'

/**
 * PremiumPill — süresi geçerli ücretli üyeyi belirten ismin YANINDA duran soft pill: TAÇ ikonu +
 * "PREMIUM" (kullanıcı seçimi: "B soft"). Avatar dekorasyonundan (24 animasyonlu çerçeve) BAĞIMSIZ
 * olsun diye avatara değil isim satırına konur -> hiçbir çerçeveyle çakışmaz, her boyutta çalışır.
 * Renk site ana renginden var(--accent); soft = accent-tonlu zemin + accent taç/metin + ince kontur.
 * Sabit hex YOK (token direktifi). Kendi kendine yeter (CSS dosyası gerekmez).
 */
const PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 18,
  padding: '0 8px 0 6px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
  color: 'var(--accent)',
  border: '1px solid color-mix(in srgb, var(--accent) 42%, transparent)',
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
  verticalAlign: 'middle',
}

export default function PremiumPill({ style }: { style?: CSSProperties }) {
  return (
    <span style={style ? { ...PILL_STYLE, ...style } : PILL_STYLE} title="Premium üye">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 8l3.6 2.7L12 5l5.4 5.7L21 8l-1.6 9.4H4.6L3 8z" />
      </svg>
      PREMIUM
    </span>
  )
}

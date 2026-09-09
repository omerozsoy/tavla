import type { CSSProperties } from 'react'

/**
 * PremiumPill — süresi geçerli ücretli üyeyi belirten ismin YANINDA duran İNCE soft pill:
 * ince outline TAÇ + "PREMIUM" (kullanıcı: bold YOK, ne ikon ne yazı; crown ikon). Avatar
 * dekorasyonundan (24 animasyonlu çerçeve) BAĞIMSIZ -> isim satırına konur, çakışmaz.
 * Renk site ana renginden var(--accent) (sabit hex YOK). Kendi kendine yeter (CSS dosyası gerekmez).
 */
const PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 18,
  padding: '0 9px 0 7px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
  color: 'var(--accent)',
  border: '1px solid color-mix(in srgb, var(--accent) 38%, transparent)',
  fontSize: 10,
  fontWeight: 400, // İNCE — bold yok (kullanıcı direktifi)
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
  verticalAlign: 'middle',
}

export default function PremiumPill({ style }: { style?: CSSProperties }) {
  return (
    <span style={style ? { ...PILL_STYLE, ...style } : PILL_STYLE} title="Premium üye">
      {/* İnce outline taç (dolgu yok, ince kontur) */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8.5l3.5 2.5L12 5.5l4.5 5.5L20 8.5l-1.4 9H5.4L4 8.5z" />
      </svg>
      PREMIUM
    </span>
  )
}

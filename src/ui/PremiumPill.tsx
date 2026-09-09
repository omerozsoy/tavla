import type { CSSProperties } from 'react'

/**
 * PremiumPill — süresi geçerli ücretli üyeyi belirten ismin YANINDA duran yumuşak "PREMIUM"
 * pill'i (kullanıcı seçimi: "C soft"). Avatar dekorasyonundan (24 animasyonlu çerçeve)
 * BAĞIMSIZ olsun diye avatara değil isim satırına konur -> hiçbir çerçeveyle çakışmaz.
 * Renk site ana renginden (var(--accent)); soft = accent-tonlu zemin + accent metin + ince kontur.
 * Sabit hex YOK (token direktifi). Kendi kendine yeter (CSS dosyası gerekmez).
 */
const PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 17,
  padding: '0 7px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
  color: 'var(--accent)',
  border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
  fontSize: 9.5,
  fontWeight: 700,
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
      PREMIUM
    </span>
  )
}

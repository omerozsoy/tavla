// A-30: yönetim panelinden gelen bağlantılar (popup/reklam/banner/kulüp linkleri) yalnız güvenli
// şemalarla kullanılır. `javascript:`/`data:`/`vbscript:` vb. bir değer (ele geçirilmiş/yanlış girilmiş
// yönetici kaydı) tıklanınca betik çalıştırırdı. Göreli yollar (/…, #…, ?…) ve http(s)/mailto/tel geçer.
export function safeHref(raw: string | null | undefined): string | undefined {
  const v = (raw ?? '').trim()
  if (!v) return undefined
  // Kontrol karakterleri/boşluklar şema gizlemek için kullanılabilir ("java\tscript:") -> temizle.
  const probe = v.replace(/[\u0000- \u007f]+/g, '').toLowerCase()
  if (/^(https?:|mailto:|tel:)/.test(probe)) return v
  if (/^\/\//.test(probe)) return v // protokole göreli (https'te https)
  if (/^[a-z][a-z0-9+.-]*:/.test(probe)) return undefined // başka her şema reddedilir
  return v // göreli yol
}

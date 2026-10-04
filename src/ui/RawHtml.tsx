import { memo } from 'react'

/**
 * Sunucudan/yönetimden gelen HTML'i basar. NEDEN ayrı bileşen: React 19, her render'da yeni bir
 * `dangerouslySetInnerHTML={{ __html }}` NESNESİ görünce içeriği KARŞILAŞTIRMADAN `innerHTML`'i
 * baştan yazar. Giriş yapmış kullanıcıda uygulama birkaç saniyede bir yeniden çizildiğinden (ping,
 * sayaçlar) metin düğümleri sürekli yeniden oluşturuluyor ve kullanıcının SEÇTİĞİ YAZI kayboluyordu
 * (gizlilik politikası / makale / kurallar sayfaları). memo: html + className aynıysa yeniden
 * çizilmez -> DOM'a dokunulmaz, seçim ve kaydırma korunur.
 */
export const RawHtml = memo(function RawHtml({
  html,
  className,
  as = 'div',
}: {
  html: string
  className?: string
  as?: 'div' | 'p'
}) {
  const Tag = as
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
})

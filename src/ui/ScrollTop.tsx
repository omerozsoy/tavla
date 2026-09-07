import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'

/**
 * "En Üste Git" — uzun sayfalarda (kulüpler, kurallar, turnuvalar, ana sayfa) sağ altta
 * beliren kaydırma butonu.
 *
 * KRİTİK: kaydırma kabı WINDOW DEĞİL. body `overflow: hidden` ve asıl scroller
 * `.app.lobby` (height:100dvh + overflow-y:auto). Bu yüzden `window.scrollTo` işe yaramaz;
 * scroll olayını da document üzerinde CAPTURE fazında dinliyoruz (scroll bubble ETMEZ).
 * Böylece dört ayrı lobi render dalına ref geçirmeye gerek kalmaz.
 */
export default function ScrollTop({ threshold = 320 }: { threshold?: number }) {
  const { t } = useT()
  const [show, setShow] = useState(false)
  const elRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement | null
      // Yalniz ana lobi kabinin scroll'u sayilir (ic listeler/menu degil).
      if (!el || !(el instanceof HTMLElement) || !el.classList?.contains('lobby')) return
      elRef.current = el
      setShow(el.scrollTop > threshold)
    }
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [threshold])

  const toTop = () => {
    const el =
      elRef.current && elRef.current.isConnected
        ? elRef.current
        : (document.querySelector('.app.lobby') as HTMLElement | null)
    el?.scrollTo({ top: 0, behavior: 'smooth' })
    setShow(false)
  }

  if (!show) return null
  return (
    <button className="to-top" onClick={toTop} aria-label={t('btn.toTop')} title={t('btn.toTop')}>
      <Icon name="arrow-up" size={22} />
    </button>
  )
}

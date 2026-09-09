/**
 * Zar Slotu makarası — tek dikey makara. Ortadaki sembol nettir; üstte/altta bir sonraki/
 * önceki sembolün küçük bir kısmı görünür (gerçek fiziksel makara hissi).
 *
 * ANİMASYON: sunucu 'finalCode'u belirler; makara yalnız ona iner. Dönüşte üstten aşağıya
 * hızla semboller akar (motion blur), sonra kübik-bezier overshoot ile MEKANİK SNAP yaparak
 * final sembol tam merkeze oturur. Her makaranın 'duration'ı farklıdır -> sırayla durur
 * (sol < orta < sağ). CSS transform-tabanlı; --slot-row satır yüksekliğini verir.
 *
 * Şerit düzeni: [üstDolgu, FINAL, ...altDolgu]. Rest'te FINAL (index 1) merkezde. Başlangıçta
 * en alttaki dolgu merkezdedir; transform artarak (şerit AŞAĞI kayar) tüm dolgular geçip
 * FINAL'e iner. Overshoot'ta üstDolgu bir an görünür (boşluk olmaz).
 */
import { useEffect, useRef, useState } from 'react'
import type { SlotSymbolCode } from '../api'
import SlotSymbol from './SlotSymbol'

const ALL: SlotSymbolCode[] = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'c64']
const FILLER = 18 // dönüşte geçen dolgu sembol sayısı (uzun şerit = uzun akış)
const FINAL_INDEX = 1 // [üstDolgu, FINAL, ...alt]

function randSym(): SlotSymbolCode {
  return ALL[Math.floor(Math.random() * ALL.length)]
}

interface Props {
  finalCode: SlotSymbolCode
  spinKey: number // her değiştiğinde yeni dönüş başlar (0 = henüz dönmedi)
  duration: number // bu makaranın durma süresi (ms) — stagger
  win?: boolean // kazanan çizgi vurgusu
  onRest?: () => void
}

export default function SlotReel({ finalCode, spinKey, duration, win, onRest }: Props) {
  // Şerit: dönüş sırasında sabit kalır; spinKey değişince yeniden kurulur.
  const [strip, setStrip] = useState<SlotSymbolCode[]>([randSym(), finalCode])
  const [offset, setOffset] = useState(FINAL_INDEX) // merkezlenen index (rest = FINAL_INDEX)
  const [animate, setAnimate] = useState(false)
  const [motion, setMotion] = useState(false)
  const rafRef = useRef<number | null>(null)
  const firstRun = useRef(true)

  useEffect(() => {
    if (spinKey === 0) {
      // Henüz dönmedi: final sembolü sabit merkezde göster.
      setStrip([randSym(), finalCode])
      setOffset(FINAL_INDEX)
      return
    }
    if (firstRun.current) {
      firstRun.current = false
    }
    // Yeni şerit kur: [üstDolgu, FINAL, ...altDolgu].
    const s: SlotSymbolCode[] = [randSym(), finalCode]
    for (let i = 0; i < FILLER; i++) s.push(randSym())
    setStrip(s)
    setMotion(true)
    // 1) transition kapalıyken en alta atla (başlangıç: son dolgu merkezde)
    setAnimate(false)
    setOffset(s.length - 1)
    // 2) bir sonraki frame'de transition açık -> FINAL'e in (şerit aşağı kayar, snap)
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = window.requestAnimationFrame(() => {
        setAnimate(true)
        setOffset(FINAL_INDEX)
      })
    })
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
    // finalCode aynı spin içinde sabit; sadece spinKey tetikler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey])

  function handleEnd() {
    setMotion(false)
    onRest?.()
  }

  return (
    <div className={`sr ${win ? 'is-win' : ''}`}>
      <div className="sr-window">
        <div
          className={`sr-strip ${motion ? 'is-motion' : ''}`}
          onTransitionEnd={handleEnd}
          style={{
            // Merkezlenen index'i pencerenin ortasına getir. Pencere yüksekliği 1.6*row,
            // merkez 0.8*row; sembol i'nin merkezi (i+0.5)*row -> translateY = (0.3 - i)*row.
            transform: `translateY(calc((0.3 - ${offset}) * var(--slot-row)))`,
            transitionProperty: animate ? 'transform' : 'none',
            transitionDuration: animate ? `${duration}ms` : '0ms',
            transitionTimingFunction: 'cubic-bezier(0.16, 0.9, 0.28, 1.06)', // hız + mekanik snap (hafif overshoot)
          }}
        >
          {strip.map((code, i) => (
            <div className="sr-cell" key={i}>
              <SlotSymbol code={code} />
            </div>
          ))}
        </div>
      </div>
      {/* Üst/alt gölge maskesi — makaranın silindirik hissi (CSS gradient) */}
      <div className="sr-fade" aria-hidden="true" />
    </div>
  )
}

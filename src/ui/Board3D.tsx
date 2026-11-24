// 3D TAHTA (yalniz admin 3D testi). Tavla3D modulunu (three + cannon-es) saran React bileseni.
// tas dizilisi + zar + hamle (surukle/tap) + KONTROL DUGMELERI (Zar At/Oyna/Onayla/Cift/Geri/kup).
// OYUN MANTIGINA DOKUNMAZ: diziliş/zar App'ten gelir; hamleler mevcut handleSelectFrom/Target'a;
// dugmeler 2D Board ile AYNI centerMain/Left/Right node'lari (canvas ustune duz overlay).
import { useEffect, useRef, type ReactNode } from 'react'
import { mount, type Tavla3DInstance } from './tavla-3d'
import type { GameState } from '../engine/types'
import type { DieFace } from './Dice'

// GameState.points (index0=hane1, +beyaz -siyah) -> modul dizisi (modul hep beyazi altta gosterir).
// flip (siyah oyuncu bakisi): tahtayi ters cevir+negate -> sirasi gelen oyuncunun taslari altta.
function toModuleArray(points: number[], flip: boolean): number[] {
  if (!flip) return points.slice()
  return points.map((_, i) => -points[23 - i])
}
// Modul hane (1-24) -> motor index (0-23). flip'te ters eslesir.
function moduleToEngine(point: number, flip: boolean): number {
  return flip ? 24 - point : point - 1
}

export default function Board3D({
  state,
  diceFaces,
  flip = false,
  nearSide = true,
  zoom = 1.25,
  selectedFrom,
  onSelectFrom,
  onSelectTarget,
  centerMain,
  centerLeft,
  centerRight,
}: {
  state: GameState
  diceFaces: DieFace[]
  flip?: boolean
  nearSide?: boolean
  zoom?: number
  selectedFrom: number | 'bar' | null
  onSelectFrom: (from: number | 'bar') => void
  onSelectTarget: (to: number | 'off') => void
  // Oyun kontrol slotları (2D Board ile AYNI node'lar): Zar At/Oyna/Onayla/Çift/Geri + küp pas/al.
  centerMain?: ReactNode
  centerLeft?: ReactNode
  centerRight?: ReactNode
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const tavlaRef = useRef<Tavla3DInstance | null>(null)
  // Drag handler'inin guncel degerleri okumasi icin ref (effect [] deps).
  const flipRef = useRef(flip)
  flipRef.current = flip
  const selRef = useRef(selectedFrom)
  selRef.current = selectedFrom
  const nearRef = useRef(nearSide)
  nearRef.current = nearSide
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const fromRef = useRef(onSelectFrom)
  fromRef.current = onSelectFrom
  const targetRef = useRef(onSelectTarget)
  targetRef.current = onSelectTarget

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    // Mount BİR KEZ (deps []). Atış tarafı/yönü her roll'da setThrow ile ayarlanır -> sıra
    // değişiminde sahneyi remount etme (flaş/israf). from burada sadece ilk varsayılan.
    const tavla = mount(el, { tilt: 60, zoom: zoomRef.current, from: 'top', sound: false })
    tavlaRef.current = tavla
    const canvas = tavla.canvas
    canvas.style.pointerEvents = 'auto'
    // Surukle / tap-to-move: basinca kaynak, birakinca hedef. pointAtScreen (modul salt-okunur ek).
    let down: number | 'bar' | null = null
    const onDown = (ev: PointerEvent) => { down = tavla.pointAtScreen(ev.clientX, ev.clientY) }
    const onUp = (ev: PointerEvent) => {
      const dp = down
      down = null
      if (dp == null) return
      const up = tavla.pointAtScreen(ev.clientX, ev.clientY)
      const flipNow = flipRef.current
      const fromEng: number | 'bar' = dp === 'bar' ? 'bar' : moduleToEngine(dp, flipNow)
      if (up != null && up !== dp && up !== 'bar') {
        // SURUKLEME: kaynak -> hedef (hedef hane olmali)
        fromRef.current(fromEng)
        targetRef.current(moduleToEngine(up, flipNow))
      } else {
        // TAP: secili kaynak yoksa sec, varsa hedef (ayni hane -> hedef say)
        if (selRef.current == null) fromRef.current(fromEng)
        else if (dp !== 'bar') targetRef.current(moduleToEngine(dp, flipNow))
      }
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      tavla.destroy()
      tavlaRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zoom kaydırıcısı değişince kamerayı canlı güncelle (remount gerekmez).
  useEffect(() => {
    tavlaRef.current?.setZoom(zoom)
  }, [zoom])

  // Tas dizilisi: durum (points) ya da flip degisince.
  const posKey = state.points.join(',') + '|' + (flip ? 1 : 0)
  useEffect(() => {
    tavlaRef.current?.setPosition(toModuleArray(state.points, flip))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey])

  // Zar: degerler degisince fizik atisini oynat (deger uretilmez, diceFaces'ten gelir).
  const valKey = diceFaces.slice(0, 2).map((f) => f.value).join(',')
  useEffect(() => {
    const t = tavlaRef.current
    const vals = diceFaces.slice(0, 2).map((f) => f.value)
    if (!t || vals.length < 2) return
    // Her oyuncu zarı KENDİ tarafına atar: ben (sıra bende) sağ-ALT, rakip sol-ÜST.
    // from = atışın GELDİĞİ kenar; zarlar KARŞI (uzak) duvara yaslanır -> kendi yanımızda
    // dursun diye from'u ters veriyoruz: ben from='top' (uzak duvar=alt), rakip from='bottom'.
    const mine = nearRef.current
    t.setThrow(mine ? 'right' : 'left', mine ? 'top' : 'bottom')
    t.roll(vals).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valKey])

  // Kullanilan zar solsun.
  const usedKey = diceFaces.slice(0, 2).map((f) => (f.used ? '1' : '0')).join('')
  useEffect(() => {
    const t = tavlaRef.current
    if (!t) return
    diceFaces.slice(0, 2).forEach((f, i) => t.markUsed(i, !!f.used))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedKey])

  // mount div'i modül sahiplenir (canvas'ı oraya ekler) -> React cocugu KOYMA. Kontrol katmanı
  // KARDEŞ olarak canvas üstüne gelir (2D Board'un center-overlay sınıfları yeniden kullanılır).
  return (
    <div className="board3d-stage" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '320px' }}>
      <div ref={mountRef} className="board3d-mount" style={{ width: '100%', height: '100%' }} />
      {(centerMain || centerLeft || centerRight) && (
        <div className="board3d-ctl">
          {centerLeft && <div className="center-overlay left">{centerLeft}</div>}
          {centerRight && <div className="center-overlay right">{centerRight}</div>}
          {centerMain && <div className="center-overlay main">{centerMain}</div>}
        </div>
      )}
    </div>
  )
}

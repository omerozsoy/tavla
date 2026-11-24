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
  tilt = 60,
  cubeValue = 1,
  selectedFrom,
  selectableFroms,
  targets,
  makePoints,
  onSelectFrom,
  onSelectTarget,
  onMakePoint,
  onDragFrom,
  centerMain,
  centerLeft,
  centerRight,
}: {
  state: GameState
  diceFaces: DieFace[]
  flip?: boolean
  nearSide?: boolean
  zoom?: number
  tilt?: number
  cubeValue?: number
  selectedFrom: number | 'bar' | null
  // Hane durum setleri (motor-index uzayı) — 2D Board ile AYNI öncelik (hedef>kaynak>kapı) için.
  selectableFroms: Set<number | 'bar'>
  targets: Set<number | 'off'>
  makePoints: Set<number>
  onSelectFrom: (from: number | 'bar') => void
  onSelectTarget: (to: number | 'off') => void
  onMakePoint: (to: number) => void
  onDragFrom: (from: number | 'bar') => void
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
  const tiltRef = useRef(tilt)
  tiltRef.current = tilt
  const fromRef = useRef(onSelectFrom)
  fromRef.current = onSelectFrom
  const targetRef = useRef(onSelectTarget)
  targetRef.current = onSelectTarget
  const makeRef = useRef(onMakePoint)
  makeRef.current = onMakePoint
  const dragFromRef = useRef(onDragFrom)
  dragFromRef.current = onDragFrom
  // Güncel "kullanıldı" bayrakları — roll animasyonu bitince uygulamak için (atış sırasında solmasın).
  const usedRef = useRef<boolean[]>([])
  usedRef.current = diceFaces.slice(0, 2).map((f) => !!f.used)
  // Hane durum setleri (güncel) — drag/tap handler effect [] içinden okur.
  const setsRef = useRef({ selectableFroms, targets, makePoints })
  setsRef.current = { selectableFroms, targets, makePoints }

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    // Mount BİR KEZ (deps []). Atış tarafı/yönü her roll'da setThrow ile ayarlanır -> sıra
    // değişiminde sahneyi remount etme (flaş/israf). from burada sadece ilk varsayılan.
    const tavla = mount(el, { tilt: tiltRef.current, zoom: zoomRef.current, vshift: 0.15, from: 'top', sound: false })
    tavlaRef.current = tavla
    const canvas = tavla.canvas
    canvas.style.pointerEvents = 'auto'
    // Hamle etkileşimi 2D Board ile AYNI mantık:
    //  - TAP (sürükleme yok): öncelik HEDEF > KAYNAK > KAPI (targets/selectableFroms/makePoints setleri).
    //    Kaynağa tek-tık DİREK oynar (handleSelectFrom), boş kapıya tık iki taşı oynar (handleMakePoint).
    //  - SÜRÜKLEME: ilk harekette onDragFrom(kaynak) -> selectedFrom set + yeşil hedefler (dragTargets
    //    React re-render'da dolar); bırakınca onSelectTarget(hedef). (Eşzamanlı from+target çağırmak
    //    React state async'liği yüzünden hedefi düşürüyordu -> "hamle olmuyor" buydu.)
    let downPt: number | 'bar' | null = null
    let downX = 0, downY = 0, active = false, dragging = false
    const toEng = (pt: number | 'bar'): number | 'bar' => (pt === 'bar' ? 'bar' : moduleToEngine(pt, flipRef.current))
    const onDown = (ev: PointerEvent) => {
      downPt = tavla.pointAtScreen(ev.clientX, ev.clientY)
      downX = ev.clientX; downY = ev.clientY; active = downPt != null; dragging = false
    }
    const onMove = (ev: PointerEvent) => {
      if (!active || dragging || downPt == null) return
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) < 6) return
      const e = toEng(downPt)
      if (setsRef.current.selectableFroms.has(e)) { dragFromRef.current(e); dragging = true }
    }
    const onUp = (ev: PointerEvent) => {
      if (!active) return
      active = false
      const dp = downPt; downPt = null
      if (dp == null) return
      const flipNow = flipRef.current
      if (dragging) {
        dragging = false
        const up = tavla.pointAtScreen(ev.clientX, ev.clientY)
        if (up != null && up !== 'bar') targetRef.current(moduleToEngine(up, flipNow))
        return
      }
      // TAP: 2D öncelik (hedef > kaynak > kapı)
      const e = dp === 'bar' ? 'bar' : moduleToEngine(dp, flipNow)
      const sets = setsRef.current
      if (e !== 'bar' && sets.targets.has(e)) targetRef.current(e)
      else if (sets.selectableFroms.has(e)) fromRef.current(e)
      else if (e !== 'bar' && sets.makePoints.has(e)) makeRef.current(e)
    }
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      tavla.destroy()
      tavlaRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zoom kaydırıcısı değişince kamerayı canlı güncelle (remount gerekmez).
  useEffect(() => {
    tavlaRef.current?.setZoom(zoom)
  }, [zoom])

  // Eğim açısı kaydırıcısı değişince WebGL kamera eğimini canlı güncelle.
  useEffect(() => {
    tavlaRef.current?.setTilt(tilt)
  }, [tilt])

  // Katlama küpü değeri değişince güncelle (>1 iken görünür).
  useEffect(() => {
    tavlaRef.current?.setCube(cubeValue)
  }, [cubeValue])

  // Tas dizilisi + KIRIK/BAR taslari: durum ya da flip degisince.
  // bar modül uzayı: w = izleyicinin (altta), b = rakip (üstte). flip'te renkler yer değişir.
  const barW = flip ? state.bar.black : state.bar.white
  const barB = flip ? state.bar.white : state.bar.black
  const posKey = state.points.join(',') + '|' + (flip ? 1 : 0) + '|' + barW + ',' + barB
  useEffect(() => {
    tavlaRef.current?.setPosition(toModuleArray(state.points, flip), { w: barW, b: barB })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey])

  // Zar: degerler degisince fizik atisini oynat (deger uretilmez, diceFaces'ten gelir).
  const valKey = diceFaces.slice(0, 2).map((f) => f.value).join(',')
  useEffect(() => {
    const t = tavlaRef.current
    const vals = diceFaces.slice(0, 2).map((f) => f.value)
    if (!t || vals.length < 2) return
    // Her oyuncu zarı KENDİ tarafına (yarı) atar: ben sağ, rakip sol. YÖN: zar İLERİ/ÖNE fırlar
    // (gerçek atış gibi) -> ben from='bottom' (yakın kenardan yukarı/uzağa), rakip from='top'.
    // (Kullanıcı: "zarlar bana doğru geliyordu, benden ileri gitmeli" -> from ters çevrildi.)
    const mine = nearRef.current
    t.setThrow(mine ? 'right' : 'left', mine ? 'bottom' : 'top')
    // roll SIRASINDA zarlar PARLAK tumble etsin (solmasın) -> markUsed'u roll BİTİNCE uygula.
    t.roll(vals).then(() => {
      usedRef.current.forEach((u, i) => t.markUsed(i, u))
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valKey])

  // Kullanilan/ölü zar solsun. Roll animasyonu sürerken DOKUNMA (yukarıdaki .then uygular) -> atılan
  // zar atış boyunca parlak kalır, yalnız oturduktan sonra (oynanınca/ölüyse) solar.
  const usedKey = diceFaces.slice(0, 2).map((f) => (f.used ? '1' : '0')).join('')
  useEffect(() => {
    const t = tavlaRef.current
    if (!t || t.isRolling) return
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

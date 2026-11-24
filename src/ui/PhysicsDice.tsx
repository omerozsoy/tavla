// 3D ZAR (yalniz admin 3D board modu). TavlaZar3D modulunu (three + cannon-es, fizik replay)
// saran ince React wrapper. OYUN MANTIGINA DOKUNMAZ: zar degerleri App.tsx'ten gelen diceFaces'ten
// gelir (otoriter); bu bilesen yalnizca o degerleri ekranda animasyonla gosterir. Normal 2D oyun
// zari (DiceRow) ayridir ve HIC etkilenmez.
import { useEffect, useRef } from 'react'
import { mount, type TavlaZarInstance } from './tavla-zar-3d'
import type { DieFace } from './Dice'

export default function PhysicsDice({ faces, nearSide = true }: { faces: DieFace[]; nearSide?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const zarRef = useRef<TavlaZarInstance | null>(null)

  // Modulu mount et. from = sira kimdeyse onun tarafi (yakin/alt -> 'bottom', rakip/ust -> 'top');
  // atan taraf degisince yeniden mount edilir. avoid = taslar (.checker) -> zar taslarin ustune dusmez
  // (modul canli olarak .checker dikdortgenlerini okur; tas koduna DOKUNULMAZ, sadece okunur).
  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const zar = mount(el, {
      dieSize: 32,
      from: nearSide ? 'bottom' : 'top',
      avoid: '.checker',
      sound: false,
    })
    zarRef.current = zar
    return () => {
      zar.destroy()
      zarRef.current = null
    }
  }, [nearSide])

  // Zar DEGERLERI degisince (yeni atis) fizik animasyonunu oynat. Deger uretilmez, diceFaces'ten gelir.
  const valKey = faces.slice(0, 2).map((f) => f.value).join(',')
  useEffect(() => {
    const zar = zarRef.current
    const vals = faces.slice(0, 2).map((f) => f.value)
    if (!zar || vals.length < 2) return
    zar.roll(vals).catch(() => {}) // atis zaten donuyorsa reddeder -> sessiz gec
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valKey])

  // Hamlede kullanilan zari soluklastir (senin used bilgini kullanir; deger degismez).
  const usedKey = faces.slice(0, 2).map((f) => (f.used ? '1' : '0')).join('')
  useEffect(() => {
    const zar = zarRef.current
    if (!zar) return
    faces.slice(0, 2).forEach((f, i) => zar.markUsed(i, !!f.used))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedKey])

  return <div ref={mountRef} className="phys-dice" aria-hidden="true" />
}

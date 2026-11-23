import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { valueUpQuat, FACE_NORMALS } from './PhysicsDice'

// Fizik zar oturunca otoriter degere snap edilir: valueUpQuat(v) uygulaninca v'nin yuzu TAM
// yukari (+Y) bakmali -> gosterilen = oynanan. Yoksa zar yanlis sayi gosterir (oyun bozulur).
describe('valueUpQuat: istenen deger yukari bakar', () => {
  for (let v = 1; v <= 6; v++) {
    it(`deger ${v} -> ust yuz ${v}`, () => {
      const q = valueUpQuat(v)
      let bestY = -Infinity
      let topValue = 0
      for (const f of FACE_NORMALS) {
        const world = new THREE.Vector3(...f.n).applyQuaternion(q)
        if (world.y > bestY) {
          bestY = world.y
          topValue = f.v
        }
      }
      expect(topValue).toBe(v)
      expect(bestY).toBeCloseTo(1, 5) // yuz TAM yukari (duz oturur, kirik degil)
    })
  }
})

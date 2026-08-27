import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { FACES, PIP_LAYOUT, nearestUpQuaternion, type FaceValue } from './faceLayout'

const VALUES: FaceValue[] = [1, 2, 3, 4, 5, 6]

/** Verilen yonelimde dunya +Y'ye en yakin bakan yuzun degerini bul. */
function topFace(q: THREE.Quaternion): FaceValue {
  let best: FaceValue = 1
  let bestY = -Infinity
  for (const v of VALUES) {
    const n = FACES[v].normal.clone().applyQuaternion(q)
    if (n.y > bestY) {
      bestY = n.y
      best = v
    }
  }
  return best
}

describe('zar yuz duzeni', () => {
  it('karsilikli yuzlerin toplami 7 (gercek zar standardi)', () => {
    // Zit normalli yuz ciftlerini bul, toplam 7 olmali.
    for (const v of VALUES) {
      const opp = VALUES.find((o) =>
        FACES[o].normal.clone().add(FACES[v].normal).lengthSq() < 1e-9,
      )
      expect(opp).toBeDefined()
      expect(v + (opp as number)).toBe(7)
    }
  })

  it('her yuzun pip sayisi degerine esit', () => {
    for (const v of VALUES) expect(PIP_LAYOUT[v].length).toBe(v)
  })

  it('nearestUpQuaternion hedef yuzu her zaman yukari getirir', () => {
    // 200 rastgele baslangic yoneliminden hedef daima ust yuz olmali.
    for (let i = 0; i < 200; i++) {
      const rnd = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(Math.random() * 7, Math.random() * 7, Math.random() * 7))
        .normalize()
      for (const target of VALUES) {
        const q = nearestUpQuaternion(target, rnd)
        expect(topFace(q)).toBe(target)
      }
    }
  })

  it('pip yerlesimleri yuz sinirlari icinde', () => {
    for (const v of VALUES) {
      for (const [u, w] of PIP_LAYOUT[v]) {
        expect(Math.abs(u)).toBeLessThanOrEqual(1)
        expect(Math.abs(w)).toBeLessThanOrEqual(1)
      }
    }
  })
})

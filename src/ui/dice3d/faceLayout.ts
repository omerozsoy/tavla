import * as THREE from 'three'

/**
 * Zar yuz duzeni ve yonelim matematigi.
 *
 * Yerel eksen -> yuz degeri eslemesi (karsilikli yuzler toplami DAIMA 7):
 *   +Y = 1   -Y = 6
 *   +X = 3   -X = 4
 *   +Z = 2   -Z = 5
 * (1+6, 3+4, 2+5 => hepsi 7 — gercek zar standardi.)
 */

export type FaceValue = 1 | 2 | 3 | 4 | 5 | 6

interface FaceDef {
  /** Yuzun dis normali (yerel uzay). */
  normal: THREE.Vector3
  /** Yuz duzleminde yatay eksen (pip yerlesimi icin). */
  u: THREE.Vector3
  /** Yuz duzleminde dikey eksen. */
  v: THREE.Vector3
}

// Her yuz degeri icin normal + duzlem tabani.
export const FACES: Record<FaceValue, FaceDef> = {
  1: { normal: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
  6: { normal: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
  3: { normal: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) },
  4: { normal: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) },
  2: { normal: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
  5: { normal: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
}

/**
 * Pip (nokta) yerlesimleri — yuz-yerel (u,v) koordinati [-1,1] araliginda.
 * s = kenardan ice kayma orani.
 */
const s = 0.56
export const PIP_LAYOUT: Record<FaceValue, [number, number][]> = {
  1: [[0, 0]],
  2: [[-s, s], [s, -s]],
  3: [[-s, s], [0, 0], [s, -s]],
  4: [[-s, -s], [s, -s], [-s, s], [s, s]],
  5: [[-s, -s], [s, -s], [0, 0], [-s, s], [s, s]],
  6: [[-s, -s], [s, -s], [-s, 0], [s, 0], [-s, s], [s, s]],
}

/**
 * Verilen yuz degerini dunya +Y (yukari) yonune getiren yonelimlerden,
 * mevcut kuaternion'a EN YAKIN olani dondurur (minimum donme aciyla dogal oturma).
 *
 * Belirli bir yuz yukaridayken, dikey eksen etrafinda 4 gecerli "yaw" varyanti
 * vardir; bunlardan mevcut duruma en yakini secilir ki son duzeltme gorunmez kalsin.
 */
export function nearestUpQuaternion(value: FaceValue, current: THREE.Quaternion): THREE.Quaternion {
  const up = new THREE.Vector3(0, 1, 0)
  // Once yuz normalini +Y'ye tasiyan taban donme.
  const base = new THREE.Quaternion().setFromUnitVectors(FACES[value].normal.clone(), up)

  let best = base
  let bestAngle = Infinity
  for (let k = 0; k < 4; k++) {
    const yaw = new THREE.Quaternion().setFromAxisAngle(up, (k * Math.PI) / 2)
    const cand = yaw.multiply(base.clone())
    const angle = cand.angleTo(current)
    if (angle < bestAngle) {
      bestAngle = angle
      best = cand
    }
  }
  return best
}
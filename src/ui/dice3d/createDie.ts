import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { FACES, PIP_LAYOUT, type FaceValue } from './faceLayout'

export interface DiePalette {
  /** Zar govdesi (fildisi/krem tas). */
  body: THREE.ColorRepresentation
  /** Pip (nokta) rengi. */
  pip: THREE.ColorRepresentation
}

export interface DieMeshBundle {
  mesh: THREE.Group
  /** Yaridan-kenar (fizik body boyutu icin). */
  half: number
  dispose: () => void
}

/**
 * Tek bir gercekci zar olusturur: yuvarlatilmis kutu govde (PBR/clearcoat) +
 * her yuze fiziksel olarak gomulu pip kureleri (sticker/texture DEGIL).
 *
 * @param size   kenar uzunlugu (dunya birimi)
 * @param quality 'high' | 'low' — dusuk modda daha az segment/pip cozunurlugu
 */
export function createDie(
  palette: DiePalette,
  envMap: THREE.Texture | null,
  size = 1,
  quality: 'high' | 'low' = 'high',
): DieMeshBundle {
  const half = size / 2
  const group = new THREE.Group()

  // --- Govde: hafif yuvarlatilmis koseler (keskin kutu degil) ---
  const segments = quality === 'high' ? 6 : 3
  const radius = size * 0.14 // yumusak ama abartisiz koseler
  const bodyGeo = new RoundedBoxGeometry(size, size, size, segments, radius)

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.body),
    roughness: 0.34, // saten fildisi — plastik oyuncak parlakligi degil
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    reflectivity: 0.35,
    envMap,
    envMapIntensity: 0.9,
    sheen: 0.25,
    sheenColor: new THREE.Color(palette.body),
  })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Pipler: yuze gomulu, matlastirilmis koyu kureler ---
  // Kure normal ekseninde yassilastirilir => flush "boyali oyuk" hissi.
  const pipSeg = quality === 'high' ? 20 : 12
  const pipRadius = size * 0.088
  const pipGeo = new THREE.SphereGeometry(pipRadius, pipSeg, pipSeg)
  const pipMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.pip),
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
    envMap,
    envMapIntensity: 0.4,
  })

  // Pipleri tek InstancedMesh'te toplamak drawcall'i dusurur.
  let pipCount = 0
  ;(Object.keys(PIP_LAYOUT) as unknown as FaceValue[]).forEach((f) => {
    pipCount += PIP_LAYOUT[f].length
  })
  const pips = new THREE.InstancedMesh(pipGeo, pipMat, pipCount)
  pips.castShadow = false
  pips.receiveShadow = false

  const spread = half * 0.62 // pip yerlesim yaricapinin yuz icindeki olcegi
  // Yuzey seviyesinin biraz altina gom: sadece kucuk bir kubbe/flush disk gorunur.
  const surface = half - radius * 0.12
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  const pos = new THREE.Vector3()
  let i = 0
  ;(Object.keys(PIP_LAYOUT) as unknown as FaceValue[]).forEach((value) => {
    const face = FACES[value]
    const layout = PIP_LAYOUT[value]
    // Kureyi normal ekseni boyunca yassilastirmak icin, normal'i +Y kabul edip
    // olcekleyecegimiz bir donme kur.
    const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), face.normal)
    for (const [pu, pv] of layout) {
      pos
        .copy(face.normal)
        .multiplyScalar(surface)
        .addScaledVector(face.u, pu * spread)
        .addScaledVector(face.v, pv * spread)
      q.copy(align)
      // yassilastirma: normal boyunca 0.45, duzlemde 1
      scl.set(1, 0.45, 1)
      m.compose(pos, q, scl)
      pips.setMatrixAt(i++, m)
    }
  })
  pips.instanceMatrix.needsUpdate = true
  group.add(pips)

  const dispose = () => {
    bodyGeo.dispose()
    bodyMat.dispose()
    pipGeo.dispose()
    pipMat.dispose()
    pips.dispose()
  }

  return { mesh: group, half, dispose }
}
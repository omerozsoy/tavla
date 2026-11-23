// FIZIK WebGL ZAR (yalniz admin 3D testi). Gercek three.js + cannon-es fizik taklasi, AMA otoriter
// degere oturur: fizik rastgele atar, durunca yaw korunarak istenen yuz TAM YUKARI + zemine DUZ snap
// edilir (kirik/egik kalmaz). Seffaf overlay (ShadowMaterial) -> gercek tahtanin uzerine biner.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { DieFace } from './Dice'

const FACE_VALUES = [1, 6, 2, 5, 3, 4] // BoxGeometry materyal sirasi: +X,-X,+Y,-Y,+Z,-Z (karsi=7)
const SIZE = 0.32 // yari-kenar (kullanici "biraz buyut": 0.18 -> 0.32; eski 0.9'dan hala kucuk)
const DIE = SIZE * 2

function makePipTexture(value: number): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, S, S)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#f2f2f2')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const P: Record<string, [number, number]> = {
    c: [0.5, 0.5], tl: [0.26, 0.26], tr: [0.74, 0.26],
    ml: [0.26, 0.5], mr: [0.74, 0.5], bl: [0.26, 0.74], br: [0.74, 0.74],
  }
  const layouts: Record<number, string[]> = {
    1: ['c'], 2: ['tl', 'br'], 3: ['tl', 'c', 'br'],
    4: ['tl', 'tr', 'bl', 'br'], 5: ['tl', 'tr', 'c', 'bl', 'br'],
    6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
  }
  ctx.fillStyle = '#1a1a1a'
  ;(layouts[value] ?? []).forEach((k) => {
    const [x, y] = P[k]
    ctx.beginPath()
    ctx.arc(x * S, y * S, S * 0.085, 0, Math.PI * 2)
    ctx.fill()
  })
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

// Yerel yuz normalleri -> deger (materyal sirasiyla ayni: +X,-X,+Y,-Y,+Z,-Z).
export const FACE_NORMALS: { n: [number, number, number]; v: number }[] = [
  { n: [1, 0, 0], v: 1 }, { n: [-1, 0, 0], v: 6 },
  { n: [0, 1, 0], v: 2 }, { n: [0, -1, 0], v: 5 },
  { n: [0, 0, 1], v: 3 }, { n: [0, 0, -1], v: 4 },
]

// Deger -> o yuzu +Y'ye (yukari) getiren yerel kuaterniyon (eksene hizali DUZ).
export function valueUpQuat(v: number): THREE.Quaternion {
  const q = new THREE.Quaternion()
  const X = new THREE.Vector3(1, 0, 0)
  const Z = new THREE.Vector3(0, 0, 1)
  const h = Math.PI / 2
  if (v === 2) return q // +Y zaten yukari
  if (v === 5) return q.setFromAxisAngle(X, Math.PI) // -Y
  if (v === 1) return q.setFromAxisAngle(Z, h) // +X -> +Y
  if (v === 6) return q.setFromAxisAngle(Z, -h) // -X
  if (v === 3) return q.setFromAxisAngle(X, -h) // +Z -> +Y
  return q.setFromAxisAngle(X, h) // v===4, -Z
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export default function PhysicsDice({ faces }: { faces: DieFace[] }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const rollRef = useRef<((vals: number[]) => void) | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w0 = mount.clientWidth || 300
    const h0 = mount.clientHeight || 300

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, w0 / h0, 0.1, 100)
    camera.position.set(0, 20, 16.5)
    camera.lookAt(0, SIZE, 0)
    // En-boy oranina gore fov ayarla: SABIT dunya-genisligi (VIEW_W) her zaman canvas GENISLIGINE sigar
    // -> zar, ekran/board oraninda DEGISMEZ (mobil/masaustu tutarli; "devasa" fix'i). DIE=1.8 -> ~%6 genislik.
    const VIEW_W = 30
    const camDist = camera.position.distanceTo(new THREE.Vector3(0, SIZE, 0))
    const fitCamera = (w: number, h: number) => {
      const aspect = Math.max(0.2, w / h)
      camera.aspect = aspect
      // yatay VIEW_W birimi canvas genisligine sigsin: vFov = 2*atan(VIEW_W/(2*dist*aspect)). Clamp 30-58.
      const fovRad = 2 * Math.atan(VIEW_W / (2 * camDist * aspect))
      camera.fov = Math.min(58, Math.max(30, (fovRad * 180) / Math.PI))
      camera.updateProjectionMatrix()
    }
    fitCamera(w0, h0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(w0, h0)
    renderer.setClearColor(0x000000, 0) // seffaf -> tahtanin uzerine biner
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(4, 12, 6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -6; key.shadow.camera.right = 6
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6
    key.shadow.camera.near = 1; key.shadow.camera.far = 30
    key.shadow.bias = -0.0004
    scene.add(key)

    // Gorunmez golge yakalayici zemin (yalniz golgeyi gosterir -> tahta gorunur).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.32 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // Fizik dunyasi
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) })
    world.broadphase = new CANNON.SAPBroadphase(world)
    world.allowSleep = true
    const diceMat = new CANNON.Material('dice')
    const floorMat = new CANNON.Material('floor')
    world.addContactMaterial(new CANNON.ContactMaterial(diceMat, floorMat, { friction: 0.1, restitution: 0.4 }))
    world.addContactMaterial(new CANNON.ContactMaterial(diceMat, diceMat, { friction: 0.05, restitution: 0.5 }))
    world.addBody(new CANNON.Body({
      mass: 0, material: floorMat, shape: new CANNON.Plane(),
      quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
    }))
    // Gorunmez duvarlar -> zar cerceve disina ucmaz, merkezde kalir
    const AX = 3.6, AZ = 2.6
    const wall = (x: number, z: number, sx: number, sz: number) => {
      const b = new CANNON.Body({ mass: 0, material: floorMat })
      b.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, 1.5, sz / 2)))
      b.position.set(x, 1.5, z)
      world.addBody(b)
    }
    wall(0, -AZ, AX * 2, 0.4); wall(0, AZ, AX * 2, 0.4)
    wall(-AX, 0, 0.4, AZ * 2); wall(AX, 0, 0.4, AZ * 2)

    const faceMaterials = FACE_VALUES.map((v) =>
      new THREE.MeshStandardMaterial({ map: makePipTexture(v), roughness: 0.4, metalness: 0.05 }),
    )

    type Die = { mesh: THREE.Mesh; body: CANNON.Body }
    const makeDie = (): Die => {
      const geo = new THREE.BoxGeometry(DIE, DIE, DIE)
      const mesh = new THREE.Mesh(geo, faceMaterials)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      const body = new CANNON.Body({
        mass: 1, material: diceMat,
        shape: new CANNON.Box(new CANNON.Vec3(SIZE, SIZE, SIZE)),
        sleepSpeedLimit: 0.15, sleepTimeLimit: 0.2,
      })
      body.linearDamping = 0.14
      body.angularDamping = 0.22
      world.addBody(body)
      return { mesh, body }
    }
    const dice: Die[] = [makeDie(), makeDie()]
    const restPos = [new THREE.Vector3(-0.62, SIZE, 0), new THREE.Vector3(0.62, SIZE, 0)]

    let targets = [1, 1]
    let phase: 'idle' | 'rolling' = 'idle'
    let animT = 0
    const ROLL_DUR = 0.75 // sn
    const Y = new THREE.Vector3(0, 1, 0)
    const startY = [0, 0]
    const tumbleAng = [0, 0]
    const finalQ = dice.map(() => new THREE.Quaternion())
    const tumbleAxis = dice.map(() => new THREE.Vector3())

    // SCRIPTLI TUMBLE (fizik YOK): zar GORUNUR sekilde takla atar ama DETERMINISTIK olarak tam
    // dogru degere (valueUpQuat) iner -> hem donme animasyonu var hem "attigim=oynadigim" garanti.
    function rollTo(vals: number[]) {
      targets = [vals[0] ?? 1, vals[1] ?? vals[0] ?? 1]
      phase = 'rolling'
      animT = 0
      dice.forEach((d, i) => {
        d.body.type = CANNON.Body.STATIC // fizik kapali
        const yaw = (Math.random() - 0.5) * 0.8
        finalQ[i].setFromAxisAngle(Y, yaw).multiply(valueUpQuat(targets[i])) // dinlenme: deger +Y (ust)
        const a = Math.random() * Math.PI * 2 // egik tumble ekseni (gorunur takla)
        tumbleAxis[i].set(Math.cos(a), 0.35, Math.sin(a)).normalize()
        tumbleAng[i] = (2.3 + Math.random() * 1.4) * Math.PI * 2 * (i ? -1 : 1) // 2-4 tur takla
        startY[i] = 1.5 + Math.random() * 0.5
      })
    }
    rollRef.current = rollTo

    const easeOutBounce = (x: number) => {
      const n1 = 7.5625, d1 = 2.75
      if (x < 1 / d1) return n1 * x * x
      if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75 }
      if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375 }
      x -= 2.625 / d1; return n1 * x * x + 0.984375
    }
    const tmpQ = new THREE.Quaternion()
    const setDie = (d: Die, i: number, ang: number, y: number, s: number) => {
      tmpQ.setFromAxisAngle(tumbleAxis[i], ang) // world-tumble * finalQ -> ang=0'da dogru deger ustte
      d.mesh.quaternion.copy(tmpQ).multiply(finalQ[i])
      d.mesh.position.set(restPos[i].x, y, restPos[i].z)
      d.mesh.scale.setScalar(s)
    }

    const clock = new THREE.Clock()
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 1 / 30)
      if (phase === 'rolling') {
        animT += dt / ROLL_DUR
        const t = Math.min(animT, 1)
        const spinT = easeOut(t)
        const dropT = easeOutBounce(Math.min(t * 1.18, 1))
        const popT = easeOut(Math.min(t * 2, 1))
        dice.forEach((d, i) => {
          const ang = tumbleAng[i] * (1 - spinT) // takla acisi 0'a dusunce dogru deger ustte
          const y = restPos[i].y + (startY[i] - restPos[i].y) * (1 - dropT)
          setDie(d, i, ang, y, 0.7 + 0.3 * popT)
        })
        if (animT >= 1) {
          phase = 'idle'
          dice.forEach((d, i) => setDie(d, i, 0, restPos[i].y, 1))
        }
      }
      renderer.render(scene, camera)
    }
    animate()

    // ilk faces zaten varsa at
    const initVals = faces.map((f) => f.value)
    if (initVals.length) rollTo(initVals)

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || w0
      const h = mount.clientHeight || h0
      fitCamera(w, h)
      renderer.setSize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      rollRef.current = null
      renderer.dispose()
      faceMaterials.forEach((m) => { m.map?.dispose(); m.dispose() })
      dice.forEach((d) => (d.mesh.geometry as THREE.BufferGeometry).dispose())
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // yeni zar degerleri gelince fizik atisini tetikle
  const key = faces.map((f) => f.value).join(',')
  useEffect(() => {
    const vals = faces.map((f) => f.value)
    if (vals.length) rollRef.current?.(vals)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return <div ref={mountRef} className="phys-dice" aria-hidden="true" />
}

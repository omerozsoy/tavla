import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import * as CANNON from 'cannon-es'
import { createDie, type DieMeshBundle, type DiePalette } from './createDie'
import { nearestUpQuaternion, type FaceValue } from './faceLayout'

type Quality = 'high' | 'low'
type Phase = 'idle' | 'physics' | 'settling'

interface DieEntity {
  bundle: DieMeshBundle
  body: CANNON.Body
  result: FaceValue
  /** Oturma fazi verileri. */
  startQuat: THREE.Quaternion
  targetQuat: THREE.Quaternion
  restX: number
  restZ: number
}

export interface DiceSceneOptions {
  palette: DiePalette
  /** Zar kenar uzunlugu (dunya birimi). */
  size?: number
}

const DIE_SIZE = 1
const FIXED_DT = 1 / 120
const MAX_SIM_MS = 4500 // guvenlik: bu surede oturmazsa zorla oturt
const SETTLE_MS = 380 // hedef yuze dogal yonlenme suresi
const REST_SPEED = 0.55 // bu hizin altinda "durgun" say
const REST_FRAMES = 10 // ardarda durgun kare esigi
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Three.js render + cannon-es fizik ile gercekci iki-zar sahnesi.
 *
 * Yasam dongusu: `new DiceScene(container)` -> `roll()` -> otomatik durur
 * (sonsuz loop YOK; oturunca RAF durur, CPU serbest). `dispose()` her seyi temizler.
 */
export class DiceScene {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private world!: CANNON.World
  private dice: DieEntity[] = []
  private ground!: THREE.Mesh
  private pmrem: THREE.PMREMGenerator
  private envRT: THREE.WebGLRenderTarget | null = null

  private quality: Quality
  private dpr: number
  private phase: Phase = 'idle'
  private raf = 0
  private running = false
  private paused = false
  private disposed = false

  private lastTime = 0
  private accumulator = 0
  private simStart = 0
  private restCount = 0
  private settleStart = 0

  private ro: ResizeObserver

  constructor(container: HTMLElement, opts: DiceSceneOptions) {
    this.container = container
    this.quality = pickQuality()
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.5)

    const w = container.clientWidth || 320
    const h = container.clientHeight || 220

    // --- Renderer (seffaf: hero kart zemini gorunur, tema-notr) ---
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: this.quality === 'high',
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    container.appendChild(this.renderer.domElement)

    // --- Sahne + kamera (urun cekimi 3/4 acisi) ---
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100)
    this.camera.position.set(0, 3.15, 4.7)
    this.camera.lookAt(0, 0.35, 0)

    // --- Environment (yumusak studio yansimalari, PBR icin) ---
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    const roomEnv = new RoomEnvironment()
    this.envRT = this.pmrem.fromScene(roomEnv, 0.04)
    this.scene.environment = this.envRT.texture
    disposeEnvScene(roomEnv)

    this.setupLights()
    this.setupGround()
    this.setupPhysics()
    this.setupDice(opts.palette, opts.size ?? DIE_SIZE)

    // Ilk kare — zarlar zeminde oturmus (roll cagrilana kadar sessiz durur).
    this.showStatic(5, 3)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
  }

  // ---- Kurulum ----
  private setupLights() {
    const q = this.quality
    // Ambient/environment tabani (yumusak dolgu).
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2622, 0.55))
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.18))

    // Key light — yumusak, tepeden-yandan, kontakt golge dokur.
    const key = new THREE.DirectionalLight(0xfff4e4, 2.1)
    key.position.set(3.2, 6.4, 3.6)
    key.castShadow = true
    const mapSize = q === 'high' ? 1024 : 512
    key.shadow.mapSize.set(mapSize, mapSize)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 20
    key.shadow.camera.left = -3.4
    key.shadow.camera.right = 3.4
    key.shadow.camera.top = 3.4
    key.shadow.camera.bottom = -3.4
    key.shadow.bias = -0.0006
    key.shadow.radius = q === 'high' ? 4 : 2
    this.scene.add(key)
    this.scene.add(key.target)

    // Fill light — golgeleri acar, karsi yondan zayif.
    const fill = new THREE.DirectionalLight(0xd8e4ff, 0.5)
    fill.position.set(-4, 2.4, 2)
    this.scene.add(fill)

    // Rim light — arkadan kenar isigi, hacim/premium his.
    const rim = new THREE.DirectionalLight(0xffe6b0, 0.9)
    rim.position.set(-1.5, 3, -4.5)
    this.scene.add(rim)
  }

  private setupGround() {
    // Sadece golge yakalayan zemin (kanvas seffaf; yalnizca kontakt golge cizilir).
    const mat = new THREE.ShadowMaterial({ opacity: 0.26 })
    const geo = new THREE.PlaneGeometry(60, 60)
    this.ground = new THREE.Mesh(geo, mat)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.scene.add(this.ground)
  }

  private diceMat = new CANNON.Material('dice')
  private floorMat = new CANNON.Material('floor')

  private setupPhysics() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) })
    this.world.allowSleep = true
    ;(this.world.solver as CANNON.GSSolver).iterations = 12

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMat, this.floorMat, { friction: 0.4, restitution: 0.32 }),
    )
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMat, this.diceMat, { friction: 0.3, restitution: 0.4 }),
    )

    // Zemin
    const floor = new CANNON.Body({ mass: 0, material: this.floorMat, shape: new CANNON.Plane() })
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.world.addBody(floor)

    // Gorunmez duvarlar — zarlar kadrajdan kacmasin.
    const W = 2.3
    const walls: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-W, 0, 0), new THREE.Vector3(1, 0, 0)],
      [new THREE.Vector3(W, 0, 0), new THREE.Vector3(-1, 0, 0)],
      [new THREE.Vector3(0, 0, -W), new THREE.Vector3(0, 0, 1)],
      [new THREE.Vector3(0, 0, W), new THREE.Vector3(0, 0, -1)],
    ]
    const zAxis = new THREE.Vector3(0, 0, 1)
    for (const [pos, normal] of walls) {
      const b = new CANNON.Body({ mass: 0, material: this.floorMat, shape: new CANNON.Plane() })
      const q = new THREE.Quaternion().setFromUnitVectors(zAxis, normal)
      b.position.set(pos.x, pos.y, pos.z)
      b.quaternion.set(q.x, q.y, q.z, q.w)
      this.world.addBody(b)
    }
  }

  private setupDice(palette: DiePalette, size: number) {
    const half = size / 2
    for (let idx = 0; idx < 2; idx++) {
      const bundle = createDie(palette, this.envRT!.texture, size, this.quality)
      this.scene.add(bundle.mesh)
      const body = new CANNON.Body({
        mass: 1,
        material: this.diceMat,
        shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
      })
      body.linearDamping = 0.06
      body.angularDamping = 0.08
      this.dice.push({
        bundle,
        body,
        result: 1,
        startQuat: new THREE.Quaternion(),
        targetQuat: new THREE.Quaternion(),
        restX: 0,
        restZ: 0,
      })
      this.world.addBody(body)
    }
  }

  // ---- Genel API ----

  /**
   * Zarlari atar. Deger verilmezse 1-6 rastgele. Donen dizi nihai ust yuzlerdir.
   * Ornek: `scene.roll(6)` -> ilk zar 6 gelir; `scene.roll(6, 3)`; `scene.roll()`.
   */
  roll(v1?: number, v2?: number): [FaceValue, FaceValue] {
    if (this.disposed) return [1, 1]
    const r1 = normalizeFace(v1)
    const r2 = normalizeFace(v2)
    const targets: [FaceValue, FaceValue] = [r1, r2]

    const startX = [-0.85, 0.85]
    this.dice.forEach((d, i) => {
      d.result = targets[i]
      const body = d.body
      // Hafif random baslangic konumu (havada), her atista farkli.
      body.position.set(
        startX[i] + rand(-0.12, 0.12),
        3.4 + Math.random() * 0.9,
        rand(-0.5, 0.5),
      )
      // Random baslangic yonelimi.
      const e = new THREE.Euler(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2))
      const q = new THREE.Quaternion().setFromEuler(e)
      body.quaternion.set(q.x, q.y, q.z, q.w)
      // Impulse: agirlikli asagi + hafif ice/yatay, her yon hafif random.
      body.velocity.set(rand(-1.6, 1.6) - Math.sign(startX[i]) * 1.4, rand(-2.5, -1), rand(-2.2, 2.2))
      // Acisal momentum — belirgin ama kaotik degil.
      body.angularVelocity.set(rand(-9, 9), rand(-9, 9), rand(-9, 9))
      body.wakeUp()
      // Mesh'i aninda esitle (flicker olmasin).
      d.bundle.mesh.position.set(body.position.x, body.position.y, body.position.z)
      d.bundle.mesh.quaternion.copy(q)
    })

    this.phase = 'physics'
    this.simStart = now()
    this.restCount = 0
    this.accumulator = 0
    this.lastTime = now()
    this.start()
    return targets
  }

  /** Sayfa acilisi girisi — bir kez dogal dusus. */
  intro() {
    this.roll()
  }

  /**
   * Fiziksiz statik pozis­yon: zarlari zeminde, hedef yuzler yukarida gosterir.
   * Baslangic karesi + reduced-motion icin (hareket yok, yine de gercek 3D).
   */
  showStatic(v1?: number, v2?: number) {
    if (this.disposed) return
    const half = this.dice[0].bundle.half
    const xs = [-0.82, 0.86]
    const targets: [FaceValue, FaceValue] = [normalizeFace(v1), normalizeFace(v2)]
    this.dice.forEach((d, i) => {
      d.result = targets[i]
      const base = nearestUpQuaternion(targets[i], new THREE.Quaternion())
      // Dikey eksende hafif yaw — ust yuz korunur ama pozis daha dogal.
      const yaw = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        rand(-0.4, 0.4),
      )
      const q = yaw.multiply(base)
      const z = rand(-0.15, 0.15)
      d.bundle.mesh.position.set(xs[i], half, z)
      d.bundle.mesh.quaternion.copy(q)
      d.body.position.set(xs[i], half, z)
      d.body.quaternion.set(q.x, q.y, q.z, q.w)
      d.body.velocity.setZero()
      d.body.angularVelocity.setZero()
      d.body.sleep()
    })
    this.phase = 'idle'
    this.renderer.render(this.scene, this.camera)
  }

  setPaused(p: boolean) {
    this.paused = p
    if (p) this.stop() // gorunmez/gizli: RAF tamamen dur, CPU serbest
    else if (this.phase !== 'idle') this.start()
  }

  resize() {
    if (this.disposed) return
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (!this.running) this.renderer.render(this.scene, this.camera)
  }

  // ---- Dongu ----
  private start() {
    if (this.running || this.paused || this.disposed) return
    this.running = true
    this.lastTime = now()
    this.raf = requestAnimationFrame(this.loop)
  }

  private stop() {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private loop = () => {
    if (!this.running || this.disposed) return
    const t = now()
    let frameDt = (t - this.lastTime) / 1000
    this.lastTime = t
    if (frameDt > 0.1) frameDt = 0.1 // sekme donusu buyuk sicramayi engelle

    if (this.phase === 'physics') {
      this.accumulator += frameDt
      while (this.accumulator >= FIXED_DT) {
        this.world.step(FIXED_DT)
        this.accumulator -= FIXED_DT
      }
      this.syncMeshes()
      this.checkRest(t)
    } else if (this.phase === 'settling') {
      this.updateSettle(t)
    }

    this.renderer.render(this.scene, this.camera)

    if (this.phase === 'idle') {
      this.stop() // oturdu: RAF dur, CPU serbest (sonsuz loop yok)
      return
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private syncMeshes() {
    for (const d of this.dice) {
      const p = d.body.position
      const q = d.body.quaternion
      d.bundle.mesh.position.set(p.x, p.y, p.z)
      d.bundle.mesh.quaternion.set(q.x, q.y, q.z, q.w)
    }
  }

  private checkRest(t: number) {
    let allStill = true
    for (const d of this.dice) {
      const v = d.body.velocity.length()
      const av = d.body.angularVelocity.length()
      if (v > REST_SPEED || av > REST_SPEED) allStill = false
    }
    const elapsed = t - this.simStart
    if (allStill && elapsed > 700) this.restCount++
    else this.restCount = 0

    if (this.restCount >= REST_FRAMES || elapsed > MAX_SIM_MS) {
      this.beginSettle(t)
    }
  }

  /** Fizik durunca: hedef yuzu yukari getiren EN YAKIN yonelime dogal olarak yonlen. */
  private beginSettle(t: number) {
    const half = this.dice[0].bundle.half
    for (const d of this.dice) {
      // Fizik body'sini uyut — artik mesh'i biz yonetiyoruz.
      d.body.sleep()
      d.startQuat.copy(d.bundle.mesh.quaternion)
      d.targetQuat.copy(nearestUpQuaternion(d.result, d.startQuat))
      d.restX = d.bundle.mesh.position.x
      d.restZ = d.bundle.mesh.position.z
      // Body pozisyonunu da oturma yuksekligine kilitle.
      d.body.position.y = half
    }
    this.phase = 'settling'
    this.settleStart = t
  }

  private updateSettle(t: number) {
    const half = this.dice[0].bundle.half
    const raw = (t - this.settleStart) / SETTLE_MS
    const done = raw >= 1
    const p = done ? 1 : raw
    const e = easeOutCubic(p)
    for (const d of this.dice) {
      d.bundle.mesh.quaternion.slerpQuaternions(d.startQuat, d.targetQuat, e)
      // Kucuk son "sekme": donme, dogal bir son ziplama gibi okunur.
      const hop = Math.sin(p * Math.PI) * DIE_SIZE * 0.14
      d.bundle.mesh.position.set(d.restX, half + hop, d.restZ)
    }
    if (done) {
      for (const d of this.dice) d.bundle.mesh.position.y = half
      this.phase = 'idle'
    }
  }

  // ---- Temizlik ----
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    this.ro.disconnect()

    for (const d of this.dice) {
      this.scene.remove(d.bundle.mesh)
      d.bundle.dispose()
      this.world.removeBody(d.body)
    }
    this.ground.geometry.dispose()
    ;(this.ground.material as THREE.Material).dispose()
    this.envRT?.dispose()
    this.pmrem.dispose()
    this.scene.environment = null

    this.renderer.dispose()
    const el = this.renderer.domElement
    el.parentNode?.removeChild(el)
    // WebGL baglamini serbest birak.
    this.renderer.forceContextLoss()
  }

  get isRolling() {
    return this.phase !== 'idle'
  }
}

// ---- Yardimcilar ----
function now(): number {
  return performance.now()
}
function rand(a: number, b: number): number {
  return a + Math.random() * (b - a)
}
function normalizeFace(v?: number): FaceValue {
  if (v == null || !Number.isFinite(v)) return (1 + Math.floor(Math.random() * 6)) as FaceValue
  const c = Math.min(6, Math.max(1, Math.round(v)))
  return c as FaceValue
}
function pickQuality(): Quality {
  const cores = navigator.hardwareConcurrency || 4
  const narrow = window.matchMedia('(max-width: 640px)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (narrow || cores <= 4 || (coarse && cores <= 6)) return 'low'
  return 'high'
}
/** RoomEnvironment gecici sahnesinin geometry/material'lerini serbest birak. */
function disposeEnvScene(env: THREE.Scene) {
  env.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    if (m.material) {
      const mat = m.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat.dispose()
    }
  })
}
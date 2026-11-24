/*!
 * TavlaZar3D — Tavla TV oyun içi gerçekçi zar (fizik motorlu)
 * Bağımlılıklar: three, cannon-es   →   npm i three cannon-es
 *
 *   import { mount } from './tavla-zar-3d.js';
 *   const zar = mount(document.getElementById('tahta'), { dieSize: 24 });
 *   await zar.roll();          // rastgele
 *   await zar.roll([6, 5]);    // sunucudan gelen sonucu oynatır (online maç)
 *   zar.markUsed(0);           // hamlede kullanılan zarı soluklaştırır
 *   zar.on('rolled', r => {}); // r.values, r.isDouble, r.moves
 *
 *   Taşların üstüne düşmesin:  mount(el, { avoid: '.tas' })  — seçici, eleman listesi ya da
 *   eleman/DOMRect döndüren fonksiyon. Zar taşa çarparsa seker; üstüne düşerse kenarından
 *   kayıp tahtaya iner, hiçbir zaman taşın üstünde kalmaz.
 *
 * Nasıl çalışır: atış önce görünmeden fizik motorunda baştan sona hesaplanır, hangi yüzün
 * üstte kaldığı bulunur, istenen sayı o yüze gelecek şekilde zarın yüzleri yeniden dizilir,
 * sonra kaydedilen hareket ekranda oynatılır. Böylece hareket tamamen fiziksel,
 * sonuç ise her zaman istenen değer olur.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const BASE = [3, 4, 1, 6, 2, 5]; // +x,-x,+y,-y,+z,-z — karşılıklı yüzler toplamı 7
const AXES = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
];
const FPS = 60;
const SUBSTEPS = 2;
const rnd = (a, b) => a + Math.random() * (b - a);

function d6() {
  const b = new Uint8Array(1);
  let v;
  do { crypto.getRandomValues(b); v = b[0]; } while (v >= 252);
  return (v % 6) + 1;
}

function faceCanvas(value, c, bump) {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = bump ? '#fff' : c.face;
  g.fillRect(0, 0, S, S);
  const step = S / 3.4, off = (S - step * 2) / 2;
  for (const k of PIPS[value]) {
    const x = off + (k % 3) * step, y = off + Math.floor(k / 3) * step;
    const ace = value === 1;
    const r = ace ? S * 0.17 : S * 0.125;
    if (bump) {
      const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r * 1.15);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.85, '#111'); gr.addColorStop(1, '#fff');
      g.fillStyle = gr;
    } else {
      const col = ace ? c.ace : c.pip;
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      gr.addColorStop(0, shade(col, -0.45)); gr.addColorStop(0.9, col); gr.addColorStop(1, shade(col, -0.2));
      g.fillStyle = gr;
    }
    g.beginPath(); g.arc(x, y, r * (bump ? 1.08 : 1), 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = bump ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('');
}

function remap(upIdx, target) {
  const vals = BASE.slice();
  const j = vals.indexOf(target);
  if (j === upIdx) return vals;
  const opp = (i) => i ^ 1;
  if (j === opp(upIdx)) { vals[j] = vals[upIdx]; vals[upIdx] = target; return vals; }
  const a = vals[upIdx], ao = vals[opp(upIdx)];
  vals[upIdx] = target; vals[opp(upIdx)] = 7 - target;
  vals[j] = a; vals[opp(j)] = ao;
  return vals;
}

function upFace(q) {
  let best = 0, bestDot = -2;
  const v = new THREE.Vector3();
  AXES.forEach((ax, i) => { const d = v.copy(ax).applyQuaternion(q).y; if (d > bestDot) { bestDot = d; best = i; } });
  return best;
}

let audioCtx = null;
function click(strength, high) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime, len = 0.06;
    const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * len), audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = (high ? 3200 : 1800) + Math.random() * 600; bp.Q.value = 2.5;
    const gn = audioCtx.createGain(); gn.gain.setValueAtTime(Math.min(1, strength) * 0.9, t);
    src.connect(bp).connect(gn).connect(audioCtx.destination);
    src.start(t);
  } catch (e) { /* ses yoksa sessiz devam */ }
}

export function mount(container, opts = {}) {
  const o = Object.assign({
    dieSize: 24,          // ekranda zarın yaklaşık piksel boyu
    from: 'bottom',       // 'bottom' (oyuncu, elden atış) | 'top' (rakip) | 'left' | 'right'
    sound: true,
    colors: { face: '#F4F0EA', pip: '#231F20', ace: '#D13C1E' },
    initial: [6, 5],
    shadowOpacity: 0.38,
    slide: 1,             // kayma miktarı (0.5 az … 2 çok)
    spin: 1,              // dönme miktarı (0.5 az … 2 çok)
    avoid: null,          // zarın üstüne düşmeyeceği elemanlar (ör. '.tas')
    avoidPadding: 4,      // engellerin etrafına eklenecek pay (px)
    wallHit: true,        // en az bir zar karşı kenara çarpıp geri seksin
    maxSpread: 6,         // iki zarın durduğu yer arası en fazla (zar boyu cinsinden)
    minSpread: 3          // iki zarın durduğu yer arası en az (zar boyu cinsinden)
  }, opts);
  o.colors = Object.assign({ face: '#F4F0EA', pip: '#231F20', ace: '#D13C1E' }, opts.colors);

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-4, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: o.shadowOpacity }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const geo = new RoundedBoxGeometry(1, 1, 1, 5, 0.12);
  const tex = {}, bump = {};
  for (let v = 1; v <= 6; v++) { tex[v] = faceCanvas(v, o.colors, false); bump[v] = faceCanvas(v, o.colors, true); }

  const dice = [0, 1].map(() => {
    const mats = {};
    for (let v = 1; v <= 6; v++) {
      mats[v] = new THREE.MeshPhysicalMaterial({
        map: tex[v], bumpMap: bump[v], bumpScale: 2.2,
        roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, transparent: true
      });
    }
    const mesh = new THREE.Mesh(geo, BASE.map((v) => mats[v]));
    mesh.castShadow = true;
    scene.add(mesh);
    return { mesh, mats, used: false };
  });

  let bounds = { x: 4, zMin: -3, zMax: 3 };
  let width = 0, height = 0;

  function layout() {
    width = container.clientWidth; height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const visH = height / o.dieSize;
    const dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, dist * 0.94, dist * 0.34);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => {
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      return ray.ray.intersectPlane(plane, hit) ? hit.clone() : new THREE.Vector3();
    });
    const m = 0.15;
    bounds = {
      x: Math.min(Math.abs(pts[0].x), Math.abs(pts[1].x)) - m,
      zMin: Math.max(pts[2].z, pts[3].z) + m,
      zMax: Math.min(pts[0].z, pts[1].z) - m
    };
    const s = sun.shadow.camera, ext = Math.max(bounds.x, Math.abs(bounds.zMin), bounds.zMax) + 3;
    s.left = -ext; s.right = ext; s.top = ext; s.bottom = -ext; s.near = 1; s.far = 40;
    s.updateProjectionMatrix();
    dirty = true;
  }

  let dirty = true;
  const ro = new ResizeObserver(layout);
  ro.observe(container);

  function setValues(d, vals) { d.mesh.material = vals.map((v) => d.mats[v]); }

  function show(values) {
    const zc = (bounds.zMin + bounds.zMax) / 2;
    dice.forEach((d, i) => {
      d.mesh.position.set(i ? 0.75 : -0.75, 0.5, zc + (i ? 0.15 : -0.15));
      d.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i ? -0.25 : 0.18);
      setValues(d, remap(2, values[i]));
    });
    current = values.slice();
    dirty = true;
  }

  function avoidRects() {
    let src = o.avoid;
    if (!src) return [];
    if (typeof src === 'function') src = src();
    if (typeof src === 'string') src = document.querySelectorAll(src);
    const cr = container.getBoundingClientRect();
    const pad = o.avoidPadding;
    const out = [];
    for (const it of Array.from(src || [])) {
      const r = it && typeof it.getBoundingClientRect === 'function' ? it.getBoundingClientRect() : it;
      if (!r || !r.width || !r.height) continue;
      const x0 = r.left - cr.left - pad, y0 = r.top - cr.top - pad, x1 = r.right - cr.left + pad, y1 = r.bottom - cr.top + pad;
      if (x1 < 0 || y1 < 0 || x0 > cr.width || y0 > cr.height) continue;
      out.push([x0, y0, x1, y1]);
    }
    return out;
  }

  const _ray = new THREE.Raycaster(), _hit = new THREE.Vector3(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pxToFloor(px, py) {
    _ray.setFromCamera(new THREE.Vector2((px / width) * 2 - 1, -(py / height) * 2 + 1), camera);
    return _ray.ray.intersectPlane(_plane, _hit) ? _hit.clone() : null;
  }

  function mergeRects(rs) {
    rs = rs.map((r) => r.slice());
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        if (a[0] <= b[2] + 1 && b[0] <= a[2] + 1 && a[1] <= b[3] + 1 && b[1] <= a[3] + 1) {
          rs[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
          rs.splice(j, 1); merged = true; break outer;
        }
      }
    }
    return rs;
  }

  function obstacleBoxes() {
    return mergeRects(avoidRects()).map(([x0, y0, x1, y1]) => {
      const pts = [pxToFloor(x0, y0), pxToFloor(x1, y0), pxToFloor(x0, y1), pxToFloor(x1, y1)].filter(Boolean);
      if (pts.length < 4) return null;
      return {
        minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)),
        minZ: Math.min(...pts.map((p) => p.z)), maxZ: Math.max(...pts.map((p) => p.z))
      };
    }).filter(Boolean);
  }

  function simulate() {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -62, 0) });
    world.allowSleep = true;
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 14;
    const mDie = new CANNON.Material('die'), mFloor = new CANNON.Material('floor'), mWall = new CANNON.Material('wall');
    world.addContactMaterial(new CANNON.ContactMaterial(mDie, mFloor, { friction: 0.16 / o.slide, restitution: 0.32 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mDie, mWall, { friction: 0.05, restitution: 0.88 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mDie, mDie, { friction: 0.18, restitution: 0.45 }));

    const addPlane = (pos, axis, ang, mat) => {
      const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
      b.position.set(...pos);
      b.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), ang);
      world.addBody(b);
      return b;
    };
    addPlane([0, 0, 0], [1, 0, 0], -Math.PI / 2, mFloor);
    const walls = {
      left: addPlane([-bounds.x, 0, 0], [0, 1, 0], Math.PI / 2, mWall),
      right: addPlane([bounds.x, 0, 0], [0, 1, 0], -Math.PI / 2, mWall),
      top: addPlane([0, 0, bounds.zMin], [0, 1, 0], 0, mWall),
      bottom: addPlane([0, 0, bounds.zMax], [0, 1, 0], Math.PI, mWall)
    };
    const farWall = walls[{ bottom: 'top', top: 'bottom', left: 'right', right: 'left' }[o.from] || 'top'];
    let farHit = false;

    const CHECKER_H = 0.32;
    const mChecker = new CANNON.Material('checker');
    world.addContactMaterial(new CANNON.ContactMaterial(mDie, mChecker, { friction: 0.08, restitution: 0.3 }));
    const obs = obstacleBoxes();
    for (const b of obs) {
      const hx = (b.maxX - b.minX) / 2, hz = (b.maxZ - b.minZ) / 2;
      const body = new CANNON.Body({ mass: 0, material: mChecker, shape: new CANNON.Box(new CANNON.Vec3(hx, CHECKER_H / 2, hz)) });
      body.position.set((b.minX + b.maxX) / 2, CHECKER_H / 2, (b.minZ + b.maxZ) / 2);
      world.addBody(body);
    }
    const blocked = (x, z, r) => obs.some((b) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ);
    const under = (x, z) => obs.find((b) => x + 0.35 > b.minX && x - 0.35 < b.maxX && z + 0.35 > b.minZ && z - 0.35 < b.maxZ);
    // Taşın üstünde yavaşlayan zarı en yakın boş kenara doğru it: kenardan devrilip düşsün
    function slideOff(b) {
      const ob = under(b.position.x, b.position.z);
      if (!ob || b.position.y < 0.5 + CHECKER_H * 0.6) return false;
      if (b.velocity.length() > 2.2) return true;
      const opts = [
        [-1, 0, b.position.x - ob.minX], [1, 0, ob.maxX - b.position.x],
        [0, -1, b.position.z - ob.minZ], [0, 1, ob.maxZ - b.position.z]
      ].filter(([dx, dz]) => {
        const tx = dx < 0 ? ob.minX - 0.7 : dx > 0 ? ob.maxX + 0.7 : b.position.x;
        const tz = dz < 0 ? ob.minZ - 0.7 : dz > 0 ? ob.maxZ + 0.7 : b.position.z;
        return Math.abs(tx) < bounds.x - 0.5 && tz > bounds.zMin + 0.5 && tz < bounds.zMax - 0.5 && !blocked(tx, tz, 0.4);
      }).sort((a, c) => a[2] - c[2]);
      const [dx, dz] = opts[0] || [Math.sign(zc - b.position.z) ? 0 : 1, Math.sign(zc - b.position.z) || 0];
      b.wakeUp();
      b.velocity.x += dx * 2.6; b.velocity.z += dz * 2.6; b.velocity.y = Math.max(b.velocity.y, 0.8);
      b.angularVelocity.x += dz * 7; b.angularVelocity.z -= dx * 7;
      return true;
    }

    const zc = (bounds.zMin + bounds.zMax) / 2;
    const events = [];
    const side = o.from === 'left' || o.from === 'right';
    const W = 30 * o.spin;
    // Elden atış: oyuncunun tarafında (ekranın altı) havada başlar, ileri ve hafif yukarı fırlar
    const hand = (() => {
      if (side) return null;
      const s = o.from === 'top' ? 1 : -1; // -1: alttan yukarı doğru atış
      const depth = bounds.zMax - bounds.zMin;
      return {
        s,
        x: rnd(-0.35, 0.35) * bounds.x,
        z: s < 0 ? bounds.zMax - 0.8 : bounds.zMin + 0.8,
        vz: s * depth * rnd(0.64, 0.84) * Math.sqrt(o.slide),
        vx: rnd(-0.25, 0.25) * bounds.x
      };
    })();
    const dir = o.from === 'left' ? 1 : -1;
    const startX = -dir * (bounds.x - 0.75);
    const zs = [];
    if (side) {
      const cands = [];
      for (let k = 0; k <= 40; k++) cands.push(bounds.zMin + 0.75 + (k / 40) * (bounds.zMax - bounds.zMin - 1.5));
      cands.sort((a, b) => Math.abs(a - zc) - Math.abs(b - zc) + rnd(-0.6, 0.6));
      for (const z of cands) {
        if (zs.length === 2) break;
        if (!blocked(startX, z, 0.9) && zs.every((q) => Math.abs(q - z) > 1.4)) zs.push(z);
      }
      while (zs.length < 2) zs.push(zc + (zs.length ? 1 : -1) * 0.8);
    }
    const power = rnd(1.45, 1.8);
    const bodies = [0, 1].map((i) => {
      const b = new CANNON.Body({
        mass: 1, material: mDie, shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
        linearDamping: 0.04, angularDamping: 0.05, sleepSpeedLimit: 0.1, sleepTimeLimit: 0.3
      });
      b.quaternion.setFromEuler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28));
      if (hand) {
        const sx = Math.max(-bounds.x + 0.7, Math.min(bounds.x - 0.7, hand.x + (i ? 0.65 : -0.65)));
        b.position.set(sx, rnd(2.6, 3.4), hand.z + rnd(-0.25, 0.25));
        // İki zar aynı elden, benzer hızla çıkar; karşı kenara ulaşacak güçte (wallHit)
        b.velocity.set(hand.vx + (i ? 1 : -1) * rnd(0, 0.5), rnd(1.5, 3.5), hand.vz * (o.wallHit ? power * rnd(0.92, 1.08) : rnd(0.9, 1.1)));
        b.angularVelocity.set(hand.s * -rnd(W * 0.6, W), rnd(-W * 0.6, W * 0.6), rnd(-W * 0.5, W * 0.5));
      } else {
        b.position.set(startX + rnd(-0.15, 0.15), rnd(1.2, 1.8), zs[i]);
        const speed = Math.max(10, bounds.x * 3) * Math.sqrt(o.slide) * rnd(0.85, 1.15);
        b.velocity.set(dir * speed, rnd(-3, -1), (zc - zs[i]) * rnd(0.6, 1.4) + rnd(-1.5, 1.5));
        b.angularVelocity.set(rnd(-W, W), (Math.random() < 0.5 ? -1 : 1) * rnd(W * 0.5, W), rnd(-W, W));
      }
      b.idx = i; b.lastHit = -10;
      b.addEventListener('collide', (e) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (e.body === farWall && v > 3) farHit = true;
        if (v > 1.2 && frame - b.lastHit > 3) {
          b.lastHit = frame;
          events.push({ frame, strength: v / 14, high: e.body.mass > 0 });
        }
      });
      world.addBody(b);
      return b;
    });

    const frames = [];
    let frame = 0;
    const maxFrames = FPS * 6;
    let still = 0;
    while (frame < maxFrames) {
      for (let s = 0; s < SUBSTEPS; s++) world.step(1 / (FPS * SUBSTEPS));
      const onTop = bodies.map((b) => frame % 6 === 0 ? slideOff(b) : !!under(b.position.x, b.position.z) && b.position.y > 0.5 + CHECKER_H * 0.6);
      frames.push(bodies.map((b) => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
      frame++;
      const asleep = bodies.every((b) => b.sleepState === CANNON.Body.SLEEPING || (b.velocity.length() < 0.05 && b.angularVelocity.length() < 0.05));
      still = asleep && !onTop.some(Boolean) ? still + 1 : 0;
      if (still > 8) break;
    }
    const last = frames[frames.length - 1];
    const ups = last.map((f) => upFace(new THREE.Quaternion(f[3], f[4], f[5], f[6])));
    const tilted = last.some((f) => new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(f[3], f[4], f[5], f[6])).y < 0.2 && Math.abs(f[1] - 0.5) > 0.05);
    const flat = last.every((f) => Math.abs(f[1] - 0.5) < 0.06);
    const clear = last.every((f) => !blocked(f[0], f[2], 0.45));
    const spread = Math.hypot(last[0][0] - last[1][0], last[0][2] - last[1][2]);
    // Karşı kenara yapışık kalmasınlar: sektikten sonra biraz geri gelsinler
    const farDist = (f) => ({ bottom: f[2] - bounds.zMin, top: bounds.zMax - f[2], right: f[0] + bounds.x, left: bounds.x - f[0] })[o.from] ?? (f[2] - bounds.zMin);
    const backOff = !o.wallHit || last.every((f) => farDist(f) > 1.3);
    const must = flat && !tilted && clear;
    const score = must ? 1 + (!o.wallHit || farHit ? 4 : 0) + (spread <= o.maxSpread && spread >= o.minSpread ? 2 : 0) + (backOff ? 1 : 0) : 0;
    return { frames, events, ups, score, ok: score === 8 };
  }

  const listeners = {};
  const emit = (n, d) => (listeners[n] || []).forEach((fn) => fn(d));
  let current = o.initial.slice();
  let anim = null;

  function roll(values) {
    if (anim) return Promise.reject(new Error('TavlaZar: zarlar zaten dönüyor'));
    const vals = Array.isArray(values) && values.length === 2 ? values.slice() : [d6(), d6()];
    if (vals.some((v) => !Number.isInteger(v) || v < 1 || v > 6)) return Promise.reject(new Error('TavlaZar: değerler 1-6 arası olmalı'));
    if (!width) layout();
    reset();
    let sim, tries = 0;
    let best = null;
    do { sim = simulate(); if (!best || sim.score > best.score) best = sim; } while (!sim.ok && ++tries < 60);
    sim = best;
    dice.forEach((d, i) => setValues(d, remap(sim.ups[i], vals[i])));
    emit('roll', { values: vals });
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) sim.frames = sim.frames.slice(-1);
    return new Promise((resolve) => {
      anim = { sim, start: performance.now(), played: 0, resolve, vals };
    });
  }

  function applyFrame(f) {
    dice.forEach((d, i) => {
      d.mesh.position.set(f[i][0], f[i][1], f[i][2]);
      d.mesh.quaternion.set(f[i][3], f[i][4], f[i][5], f[i][6]);
    });
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (anim) {
      const { sim } = anim;
      const pos = Math.max(0, ((now - anim.start) / 1000) * FPS);
      const i = Math.min(Math.floor(pos), sim.frames.length - 1);
      const a = sim.frames[i], b = sim.frames[Math.min(i + 1, sim.frames.length - 1)], t = pos - i;
      const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
      applyFrame(a.map((fa, k) => {
        const fb = b[k];
        qa.set(fa[3], fa[4], fa[5], fa[6]); qb.set(fb[3], fb[4], fb[5], fb[6]); qa.slerp(qb, Math.min(1, t));
        return [fa[0] + (fb[0] - fa[0]) * t, fa[1] + (fb[1] - fa[1]) * t, fa[2] + (fb[2] - fa[2]) * t, qa.x, qa.y, qa.z, qa.w];
      }));
      while (anim.played < sim.events.length && sim.events[anim.played].frame <= i) {
        const ev = sim.events[anim.played++];
        if (o.sound) click(ev.strength, ev.high);
      }
      dirty = true;
      if (i >= sim.frames.length - 1) {
        applyFrame(sim.frames[sim.frames.length - 1]);
        const { resolve, vals } = anim;
        anim = null;
        current = vals;
        const isDouble = vals[0] === vals[1];
        emit('rolled', { values: vals, isDouble, moves: isDouble ? [vals[0], vals[0], vals[0], vals[0]] : vals.slice() });
        resolve(vals);
      }
    }
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  }

  function markUsed(i, used = true) {
    const d = dice[i];
    if (!d) return;
    d.used = used;
    Object.values(d.mats).forEach((m) => { m.opacity = used ? 0.4 : 1; m.color.setScalar(used ? 0.6 : 1); });
    dirty = true;
  }
  function reset() { dice.forEach((_, i) => markUsed(i, false)); }

  layout();
  show(current);
  let raf = requestAnimationFrame(tick);

  return {
    canvas,
    roll,
    show,
    markUsed,
    reset,
    get values() { return current.slice(); },
    get isRolling() { return !!anim; },
    setSound(v) { o.sound = !!v; },
    setAvoid(v) { o.avoid = v; },
    on(n, fn) { (listeners[n] = listeners[n] || []).push(fn); return this; },
    off(n, fn) { listeners[n] = (listeners[n] || []).filter((f) => f !== fn); return this; },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.dispose(); geo.dispose(); pmrem.dispose();
      Object.values(tex).concat(Object.values(bump)).forEach((t) => t.dispose());
      dice.forEach((d) => Object.values(d.mats).forEach((m) => m.dispose()));
      canvas.remove();
    }
  };
}

export default { mount };

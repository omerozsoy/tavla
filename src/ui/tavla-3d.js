/*!
 * Tavla3D — Tavla TV 3 boyutlu, perspektifli tavla tahtası + fizik motorlu zar
 * Bağımlılıklar: three, cannon-es   →   npm i three cannon-es
 *
 *   import { mount } from './tavla-3d.js';
 *   const tavla = mount(document.getElementById('oyun'), { tilt: 60 });
 *   await tavla.roll();            // rastgele
 *   await tavla.roll([6, 5]);      // sunucudan gelen sonucu oynatır
 *   tavla.setPosition(pozisyon);   // 24 elemanlı dizi: + beyaz, - siyah (1. hane = dizi[0])
 *   tavla.markUsed(0);             // kullanılan zarı soluklaştırır
 *   tavla.on('rolled', r => {});   // r.values, r.isDouble, r.moves
 *   tavla.on('point', e => {});    // tahtaya tıklanınca: e.point = 1-24 ya da 'bar'
 *
 * Atış görünmeden fizik motorunda baştan sona hesaplanır, istenen sayılar üste gelecek şekilde
 * zar yüzleri yeniden dizilir, sonra kayıt oynatılır. Zarlar tahtanın kenarlarına ve taşlara
 * gerçekten çarpar; taşın üstüne düşen zar kenarından kayıp tahtaya iner.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---- Ölçüler (1 birim = 1 zar) ----
const K = 0.8;          // tahta ölçeği (küçüldükçe zar tahtaya göre büyür)
const P = 2.1 * K;         // hane genişliği
const HW = 6 * P;       // yarı tahta genişliği
const D = 26 * K;         // tahta derinliği
const B = 2.6 * K;        // bar genişliği
const F = 1.4 * K;        // çerçeve kalınlığı
const R = 1.0 * K;        // kenar yüksekliği
const CR = 0.98 * K;       // taş yarıçapı
const CH = 0.42 * K;       // taş kalınlığı
const PL = 10.6 * K;       // hane (üçgen) uzunluğu
const DIE = 0.6;           // zar kenar uzunluğu (büyütmek için artır; geo+fizik+dinlenme birlikte ölçeklenir)
const DH = DIE / 2;        // zar yarı-kenarı (dinlenirken merkez yüksekliği)
const DCL = DH + 0.08;     // zar temizlik yarıçapı (pul üstüne gelmesin diye; zar boyutuyla ölçekli)

export const OPENING = (() => {
  const p = new Array(24).fill(0);
  p[0] = -2; p[5] = 5; p[7] = 3; p[11] = -5; p[12] = 5; p[16] = -3; p[18] = -5; p[23] = 2;
  return p;
})();

const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const BASE = [3, 4, 1, 6, 2, 5];
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((a) => new THREE.Vector3(...a));
const FPS = 60, SUBSTEPS = 2;
const rnd = (a, b) => a + Math.random() * (b - a);

function d6() {
  const b = new Uint8Array(1);
  let v;
  do { crypto.getRandomValues(b); v = b[0]; } while (v >= 252);
  return (v % 6) + 1;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('');
}
function faceTexture(value, c, bump) {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = bump ? '#fff' : c.face;
  g.fillRect(0, 0, S, S);
  const step = S / 3.4, off = (S - step * 2) / 2;
  for (const k of PIPS[value]) {
    const x = off + (k % 3) * step, y = off + Math.floor(k / 3) * step;
    const r = value === 1 ? S * 0.17 : S * 0.125;
    let gr;
    if (bump) {
      gr = g.createRadialGradient(x, y, r * 0.2, x, y, r * 1.08);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.85, '#111'); gr.addColorStop(1, '#fff');
    } else {
      const col = value === 1 ? c.ace : c.pip;
      gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      gr.addColorStop(0, shade(col, -0.45)); gr.addColorStop(0.9, col); gr.addColorStop(1, shade(col, -0.2));
    }
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r * (bump ? 1.08 : 1), 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = bump ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function remap(upIdx, target) {
  const vals = BASE.slice(), j = vals.indexOf(target), opp = (i) => i ^ 1;
  if (j === upIdx) return vals;
  if (j === opp(upIdx)) { vals[j] = vals[upIdx]; vals[upIdx] = target; return vals; }
  const a = vals[upIdx], ao = vals[opp(upIdx)];
  vals[upIdx] = target; vals[opp(upIdx)] = 7 - target; vals[j] = a; vals[opp(j)] = ao;
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
    bp.frequency.value = (high ? 3200 : 1700) + Math.random() * 600; bp.Q.value = 2.5;
    const gn = audioCtx.createGain(); gn.gain.setValueAtTime(Math.min(1, strength) * 0.9, t);
    src.connect(bp).connect(gn).connect(audioCtx.destination);
    src.start(t);
  } catch (e) { /* ses yoksa sessiz */ }
}

// Hane merkezinin x'i ve tabanın z'si (beyaz oyuncu altta, evi sağ altta)
function pointGeom(p) { // p: 1..24
  if (p <= 6) return { x: B / 2 + HW - (p - 0.5) * P, bottom: true };
  if (p <= 12) return { x: -B / 2 - (p - 6 - 0.5) * P, bottom: true };
  if (p <= 18) return { x: -B / 2 - HW + (p - 12 - 0.5) * P, bottom: false };
  return { x: B / 2 + (p - 18 - 0.5) * P, bottom: false };
}

export function mount(container, opts = {}) {
  const o = Object.assign({
    tilt: 60,              // kameranın dikeyle yaptığı açı (0 = tepeden, 90 = yandan)
    zoom: 1,               // kamera yakınlaştırma (>1 = board canvas içinde daha büyük görünür)
    vshift: 0,             // dikey kaydırma (yük. oranı; >0 = board aşağı/izleyiciye yakın, boşluk üstte)
    half: 'right',         // zarların düştüğü yarı: 'right' | 'left'
    from: 'bottom',        // atan taraf: 'bottom' (oyuncu) | 'top' (rakip)
    position: OPENING,
    sound: true,
    slide: 1, spin: 1,
    wallHit: true,         // en az bir zar karşı kenara çarpsın
    minSpread: 3, maxSpread: 6,
    initial: [6, 5],
    background: null       // null = saydam
  }, opts);
  o.colors = Object.assign({
    face: '#F4F0EA', pip: '#231F20', ace: '#D13C1E',
    frame: '#231F20', field: '#E0B99A', pointA: '#D13C1E', pointB: '#393637',
    white: '#F4F0EA', black: '#2A2526'
  }, opts.colors);

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !o.background });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  if (o.background) scene.background = new THREE.Color(o.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a4a, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-10, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 20, bottom: -20, near: 1, far: 80 });
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 300);

  // ---- Tahta ----
  const boardGroup = new THREE.Group();
  scene.add(boardGroup);
  // Ağaç dokusu (prosedürel canvas): sıcak kahve taban + dikey damar çizgileri -> çerçeve ahşap görünür.
  function woodTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 512, 0);
    grd.addColorStop(0, '#5b3a22'); grd.addColorStop(0.5, '#6f4a2d'); grd.addColorStop(1, '#58381f');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 512;
      const w = 0.5 + Math.random() * 2.2;
      const dark = Math.random() < 0.5;
      g.strokeStyle = dark ? 'rgba(40,24,12,0.28)' : 'rgba(150,110,70,0.20)';
      g.lineWidth = w;
      g.beginPath();
      let y = 0, xx = x;
      g.moveTo(xx, y);
      for (; y < 512; y += 16) { xx += (Math.random() - 0.5) * 6; g.lineTo(xx, y); }
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const frameMat = new THREE.MeshPhysicalMaterial({ map: woodTexture(), roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const fieldMat = new THREE.MeshStandardMaterial({ color: o.colors.field, roughness: 0.85 });
  const OX = B / 2 + HW + F, OZ = D / 2 + F;
  const TW = 2.7 * CR, RX = OX + TW; // bear-off (taş toplama) tepsisi (SAĞ dış); RX = tepsi dahil dış kenar
  const TRAYX = OX + (TW - F) / 2;   // tepsi iç ortası (off taşları + küp burada)
  const box = (w, h, d, x, y, z, m) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    boardGroup.add(mesh); return mesh;
  };
  box(2 * OX + TW, 0.6, 2 * OZ, TW / 2, -0.3, 0, frameMat);             // taban (tepsi dahil)
  box(F, R, 2 * OZ, -OX + F / 2, R / 2, 0, frameMat);                   // sol kenar
  box(F, R, 2 * OZ, OX - F / 2, R / 2, 0, frameMat);                    // oyun/tepsi ayırıcı (eski sağ kenar)
  box(F, R, 2 * OZ, RX - F / 2, R / 2, 0, frameMat);                    // SAĞ dış kenar (tepsi dışı)
  box(2 * OX - 2 * F + TW, R, F, TW / 2, R / 2, -OZ + F / 2, frameMat); // üst kenar (tepsi dahil)
  box(2 * OX - 2 * F + TW, R, F, TW / 2, R / 2, OZ - F / 2, frameMat);  // alt kenar (tepsi dahil)
  box(B, R, D, 0, R / 2, 0, frameMat);                                 // bar
  // TavlaTV logosu — bar'ın üstünde, uzunluğu boyunca (soluk krem marka).
  (function () {
    const c = document.createElement('canvas'); c.width = 512; c.height = 110;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(244,240,234,0.42)';
    g.font = 'bold 66px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('TavlaTV', 256, 60);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(B * 3.6, B * 0.78),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    logo.rotation.x = -Math.PI / 2; logo.rotation.z = -Math.PI / 2; // bar boyunca (z) oku
    logo.position.set(0, R + 0.02, 0);
    boardGroup.add(logo);
  })();
  // Katlama küpü — değer>1 iken bar üst ucunda görünür (setCube ile güncellenir).
  const cubeNumTex = (v) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#F4F0EA'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#231F20'; g.font = 'bold 72px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(v), 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const CUBE = 1.3;
  const cubeSideMat = new THREE.MeshPhysicalMaterial({ color: '#EDE6D8', roughness: 0.4, clearcoat: 0.5 });
  const cubeMesh = new THREE.Mesh(new RoundedBoxGeometry(CUBE, CUBE, CUBE, 4, 0.12), cubeSideMat);
  cubeMesh.position.set(TRAYX, CUBE / 2, 0); // SAĞ bear-off tepsisinin ortasında
  cubeMesh.castShadow = true; cubeMesh.visible = false;
  boardGroup.add(cubeMesh);
  function setCube(value) {
    if (!value || value <= 1) { cubeMesh.visible = false; dirty = true; return; }
    const top = new THREE.MeshPhysicalMaterial({ map: cubeNumTex(value), roughness: 0.4, clearcoat: 0.5 });
    cubeMesh.material = [cubeSideMat, cubeSideMat, top, cubeSideMat, cubeSideMat, cubeSideMat]; // +y yüz = top
    cubeMesh.visible = true; dirty = true;
  }
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(HW, D), fieldMat);
    f.rotation.x = -Math.PI / 2; f.position.set(s * (B / 2 + HW / 2), 0.001, 0); f.receiveShadow = true;
    boardGroup.add(f);
  }
  const triShape = new THREE.Shape();
  triShape.moveTo(-P * 0.46, 0); triShape.lineTo(P * 0.46, 0); triShape.lineTo(0, PL); triShape.closePath();
  const triGeo = new THREE.ShapeGeometry(triShape);
  const ptMats = [o.colors.pointA, o.colors.pointB].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  for (let p = 1; p <= 24; p++) {
    const g = pointGeom(p);
    const m = new THREE.Mesh(triGeo, ptMats[p % 2]);
    m.rotation.x = -Math.PI / 2;
    if (g.bottom) { m.position.set(g.x, 0.003, D / 2); m.rotation.z = 0; }
    else { m.position.set(g.x, 0.003, -D / 2); m.rotation.z = Math.PI; }
    m.receiveShadow = true;
    boardGroup.add(m);
  }

  // ---- Taşlar ----
  const prof = [[0, 0], [CR - 0.07, 0], [CR, 0.06], [CR, CH - 0.06], [CR - 0.07, CH], [CR * 0.74, CH], [CR * 0.7, CH - 0.035], [0, CH - 0.035]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const checkerGeo = new THREE.LatheGeometry(prof, 48);
  const checkerMats = {
    w: new THREE.MeshPhysicalMaterial({ color: o.colors.white, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    b: new THREE.MeshPhysicalMaterial({ color: o.colors.black, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 })
  };
  const checkersGroup = new THREE.Group();
  scene.add(checkersGroup);
  let checkerSpots = []; // {x, z, y}

  // bar = { w, b } kırık taşlar (bar üstü). off = { w, b } toplanan taşlar (SAĞ bear-off tepsisi).
  function setPosition(pos, bar, off) {
    checkersGroup.clear();
    checkerSpots = [];
    pos.forEach((n, i) => {
      if (!n) return;
      const g = pointGeom(i + 1), cnt = Math.abs(n), mat = n > 0 ? checkerMats.w : checkerMats.b;
      for (let k = 0; k < cnt; k++) {
        const layer = Math.floor(k / 5), slot = k % 5;
        const off = CR + 0.05 + slot * 2 * CR + layer * CR;
        const z = g.bottom ? D / 2 - off : -D / 2 + off;
        const y = layer * CH;
        const m = new THREE.Mesh(checkerGeo, mat);
        m.position.set(g.x, y, z); m.castShadow = true; m.receiveShadow = true;
        checkersGroup.add(m);
        checkerSpots.push({ x: g.x, z, y });
      }
    });
    // Kırık taşlar: bar'ın ÜSTÜNE (x=0, raised R). w (izleyici) alt yarıda +z, b üst yarıda -z.
    if (bar) {
      const placeBar = (count, isWhite) => {
        const mat = isWhite ? checkerMats.w : checkerMats.b, dir = isWhite ? 1 : -1;
        for (let k = 0; k < (count || 0); k++) {
          const off = CR + 0.3 + (k % 5) * 2 * CR;
          const m = new THREE.Mesh(checkerGeo, mat);
          m.position.set(0, R + CH / 2 + Math.floor(k / 5) * CH, dir * off);
          m.castShadow = true; m.receiveShadow = true;
          checkersGroup.add(m);
        }
      };
      placeBar(bar.w, true);
      placeBar(bar.b, false);
    }
    // Toplanan taşlar: SAĞ bear-off tepsisinde (x=TRAYX). w (izleyici) alt yarıda, b üst yarıda; dik istif.
    if (off) {
      const placeOff = (count, isWhite) => {
        const mat = isWhite ? checkerMats.w : checkerMats.b, dir = isWhite ? 1 : -1;
        for (let k = 0; k < (count || 0); k++) {
          const layer = Math.floor(k / 5), slot = k % 5;
          const d = CR + 0.15 + slot * 2 * CR + layer * CR;
          const m = new THREE.Mesh(checkerGeo, mat);
          m.position.set(TRAYX, layer * CH, dir * (D / 2 - d));
          m.castShadow = true; m.receiveShadow = true;
          checkersGroup.add(m);
        }
      };
      placeOff(off.w, true);
      placeOff(off.b, false);
    }
    dirty = true;
  }

  // ---- Zarlar ----
  const dieGeo = new RoundedBoxGeometry(DIE, DIE, DIE, 5, 0.12 * DIE);
  const tex = {}, bump = {};
  for (let v = 1; v <= 6; v++) { tex[v] = faceTexture(v, o.colors, false); bump[v] = faceTexture(v, o.colors, true); }
  const dice = [0, 1].map(() => {
    const mats = {};
    for (let v = 1; v <= 6; v++) mats[v] = new THREE.MeshPhysicalMaterial({ map: tex[v], bumpMap: bump[v], bumpScale: 2.2, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, transparent: true });
    const mesh = new THREE.Mesh(dieGeo, BASE.map((v) => mats[v]));
    mesh.castShadow = true;
    scene.add(mesh);
    return { mesh, mats };
  });
  const setFaces = (d, vals) => { d.mesh.material = vals.map((v) => d.mats[v]); };

  function area() {
    const s = o.half === 'left' ? -1 : 1;
    const a = B / 2, b = B / 2 + HW;
    return { xMin: s > 0 ? a : -b, xMax: s > 0 ? b : -a, zMin: -D / 2, zMax: D / 2 };
  }

  // ---- Kamera ----
  let width = 0, height = 0, dirty = true;
  function layout() {
    width = container.clientWidth; height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Önceki çağrının view-offset'ini TEMİZLE: yoksa tekrar layout()'ta (setZoom/setTilt/resize)
    // eski offset binary-search fit'ini bozar -> zoom/tilt canlı değişmez (sadece ilk mount doğru).
    camera.clearViewOffset();
    const th = THREE.MathUtils.degToRad(o.tilt);
    const dir = new THREE.Vector3(0, Math.cos(th), Math.sin(th));
    // Tepsi SAĞ'a eklendi -> board merkezi x=TW/2'ye kaydı; hedefi oraya al (yatay ortala) + sağ kenar RX.
    const target = new THREE.Vector3(TW / 2, 0, 0);
    const corners = [];
    for (const x of [-OX, RX]) for (const z of [-OZ, OZ]) for (const y of [0, R]) corners.push(new THREE.Vector3(x, y, z));
    const fits = (dist) => {
      camera.position.copy(dir).multiplyScalar(dist).add(target);
      camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      return corners.every((c) => { const p = c.clone().project(camera); return Math.abs(p.x) < 0.97 && Math.abs(p.y) < 0.95 && p.z < 1; });
    };
    let lo = 5, hi = 400;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    // Tahtayı dikeyde ortala. zoom>1 -> kamerayı yaklaştır (dist küçült) -> board daha büyük görünür
    // (kenarlar foreshorten boşluğunu doldurur; dış çerçeve hafif taşabilir, oyun alanı kırpılmaz).
    fits(hi / (o.zoom || 1));
    const ys = corners.map((c) => c.clone().project(camera).y);
    const mid = (Math.max(...ys) + Math.min(...ys)) / 2;
    // vshift>0 -> board'u aşağı kaydır (yakın kenar alta, boşluk üstte); izleyiciye yaklaşmış hissi.
    camera.setViewOffset(width, height, 0, (-mid * height) / 2 - (o.vshift || 0) * height, width, height);
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(layout);
  ro.observe(container);

  function show(values) {
    const a = area(), xc = (a.xMin + a.xMax) / 2;
    dice.forEach((d, i) => {
      d.mesh.position.set(xc + (i ? 1.4 : -1.4), 0.5, i ? 0.6 : -0.4);
      d.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i ? -0.3 : 0.2);
      setFaces(d, remap(2, values[i]));
    });
    current = values.slice();
    dirty = true;
  }

  // ---- Fizik ----
  function stackBoxes() {
    const a = area(), m = 0.05;
    const groups = {};
    for (const c of checkerSpots) {
      if (c.x < a.xMin || c.x > a.xMax) continue;
      const key = c.x.toFixed(2) + (c.z > 0 ? 'b' : 't');
      const g = groups[key] || (groups[key] = { minX: c.x - CR - m, maxX: c.x + CR + m, minZ: Infinity, maxZ: -Infinity, top: 0 });
      g.minZ = Math.min(g.minZ, c.z - CR - m); g.maxZ = Math.max(g.maxZ, c.z + CR + m); g.top = Math.max(g.top, c.y + CH);
    }
    return Object.values(groups);
  }

  function simulate() {
    const a = area();
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -62, 0) });
    world.allowSleep = true;
    world.solver.iterations = 14;
    const mDie = new CANNON.Material('die'), mFloor = new CANNON.Material('floor'), mWall = new CANNON.Material('wall'), mChk = new CANNON.Material('chk');
    world.addContactMaterial(new CANNON.ContactMaterial(mDie, mFloor, { friction: 0.16 / o.slide, restitution: 0.32 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mDie, mWall, { friction: 0.05, restitution: 0.88 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mDie, mDie, { friction: 0.18, restitution: 0.45 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mDie, mChk, { friction: 0.08, restitution: 0.35 }));
    const plane = (pos, axis, ang, mat) => {
      const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
      b.position.set(...pos); b.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), ang);
      world.addBody(b); return b;
    };
    plane([0, 0, 0], [1, 0, 0], -Math.PI / 2, mFloor);
    const walls = {
      left: plane([a.xMin, 0, 0], [0, 1, 0], Math.PI / 2, mWall),
      right: plane([a.xMax, 0, 0], [0, 1, 0], -Math.PI / 2, mWall),
      top: plane([0, 0, a.zMin], [0, 1, 0], 0, mWall),
      bottom: plane([0, 0, a.zMax], [0, 1, 0], Math.PI, mWall)
    };
    // X-yönlü atış: oyuncunun DIŞ kenarından bar'a doğru. Far wall = bar tarafı x-duvarı.
    const sx = o.half === 'left' ? 1 : -1; // left: +x (soldan içeri), right: -x (sağdan içeri)
    const farWall = sx < 0 ? walls.left : walls.right;
    let farHit = false;

    for (const c of checkerSpots) {
      if (c.x < a.xMin - CR || c.x > a.xMax + CR) continue;
      const b = new CANNON.Body({ mass: 0, material: mChk, shape: new CANNON.Cylinder(CR, CR, CH, 20) });
      b.position.set(c.x, c.y + CH / 2, c.z);
      world.addBody(b);
    }
    const stacks = stackBoxes();
    const over = (x, z, r = DH) => stacks.find((s) => x + r > s.minX && x - r < s.maxX && z + r > s.minZ && z - r < s.maxZ);
    const free = (x, z, r) => !stacks.some((s) => x + r > s.minX && x - r < s.maxX && z + r > s.minZ && z - r < s.maxZ);
    function slideOff(b) {
      const s = over(b.position.x, b.position.z);
      if (!s || b.position.y < DH + CH * 0.6) return false;
      if (b.velocity.length() > 2.2) return true;
      const cand = [[-1, 0, b.position.x - s.minX], [1, 0, s.maxX - b.position.x], [0, -1, b.position.z - s.minZ], [0, 1, s.maxZ - b.position.z]]
        .filter(([dx, dz]) => {
          const tx = dx < 0 ? s.minX - 0.7 : dx > 0 ? s.maxX + 0.7 : b.position.x;
          const tz = dz < 0 ? s.minZ - 0.7 : dz > 0 ? s.maxZ + 0.7 : b.position.z;
          return tx > a.xMin + 0.5 && tx < a.xMax - 0.5 && tz > a.zMin + 0.5 && tz < a.zMax - 0.5 && free(tx, tz, DCL);
        }).sort((p, q) => p[2] - q[2]);
      const [dx, dz] = cand[0] || [0, b.position.z > 0 ? -1 : 1];
      b.wakeUp();
      b.velocity.x += dx * 2.6; b.velocity.z += dz * 2.6; b.velocity.y = Math.max(b.velocity.y, 0.8);
      b.angularVelocity.x += dz * 7; b.angularVelocity.z -= dx * 7;
      return true;
    }

    const W = 30 * o.spin;
    // X-yönlü: dış kenardan (benim sağ, rakip sol) bar'a doğru fırlar; derinlik (z) ortasında.
    const width = a.xMax - a.xMin, hdep = (a.zMax - a.zMin) / 2;
    const hx = sx < 0 ? a.xMax - 0.9 : a.xMin + 0.9;     // dış kenardan başla
    const hz = rnd(-0.15, 0.15) * hdep;                   // derinlik ortasına yakın
    const vx = sx * width * rnd(0.64, 0.84) * Math.sqrt(o.slide), vz = rnd(-0.08, 0.08) * hdep;
    const power = o.wallHit ? rnd(1.65, 1.95) : 1;
    const events = [];
    let frame = 0;
    const bodies = [0, 1].map((i) => {
      const b = new CANNON.Body({
        mass: 1, material: mDie, shape: new CANNON.Box(new CANNON.Vec3(DH, DH, DH)),
        linearDamping: 0.04, angularDamping: 0.05, sleepSpeedLimit: 0.1, sleepTimeLimit: 0.3
      });
      b.quaternion.setFromEuler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28));
      b.position.set(hx + rnd(-0.25, 0.25), rnd(2.6, 3.4), Math.max(a.zMin + 0.7, Math.min(a.zMax - 0.7, hz + (i ? 0.6 : -0.6))));
      b.velocity.set(vx * power * rnd(0.92, 1.08), rnd(1.5, 3.5), vz + (i ? 1 : -1) * rnd(0, 0.4));
      b.angularVelocity.set(rnd(-W * 0.5, W * 0.5), rnd(-W * 0.6, W * 0.6), sx * -rnd(W * 0.6, W));
      b.lastHit = -10;
      b.addEventListener('collide', (e) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (e.body === farWall && v > 2.5) farHit = true;
        if (v > 1.2 && frame - b.lastHit > 3) { b.lastHit = frame; events.push({ frame, strength: v / 14, high: e.body.mass > 0 }); }
      });
      world.addBody(b);
      return b;
    });

    const frames = [];
    let still = 0;
    while (frame < FPS * 6) {
      for (let k = 0; k < SUBSTEPS; k++) world.step(1 / (FPS * SUBSTEPS));
      const onTop = bodies.map((b) => (frame % 6 === 0 ? slideOff(b) : !!over(b.position.x, b.position.z) && b.position.y > DH + CH * 0.6));
      frames.push(bodies.map((b) => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
      frame++;
      const asleep = bodies.every((b) => b.sleepState === CANNON.Body.SLEEPING || (b.velocity.length() < 0.05 && b.angularVelocity.length() < 0.05));
      still = asleep && !onTop.some(Boolean) ? still + 1 : 0;
      if (still > 8) break;
    }
    const last = frames[frames.length - 1];
    const ups = last.map((f) => upFace(new THREE.Quaternion(f[3], f[4], f[5], f[6])));
    const flat = last.every((f) => Math.abs(f[1] - DH) < 0.07);
    const clear = last.every((f) => free(f[0], f[2], DCL));
    const spread = Math.hypot(last[0][0] - last[1][0], last[0][2] - last[1][2]);
    const farDist = (f) => (sx < 0 ? f[0] - a.xMin : a.xMax - f[0]);
    const backOff = !o.wallHit || last.every((f) => farDist(f) > 1.5);
    const must = flat && clear;
    const score = must ? 1 + (!o.wallHit || farHit ? 4 : 0) + (spread >= o.minSpread && spread <= o.maxSpread ? 2 : 0) + (backOff ? 1 : 0) : 0;
    return { frames, events, ups, score, ok: score === 8 };
  }

  // ---- Oynatma ----
  const listeners = {};
  const emit = (n, d) => (listeners[n] || []).forEach((fn) => fn(d));
  let current = o.initial.slice(), anim = null;

  function roll(values) {
    if (anim) return Promise.reject(new Error('Tavla3D: zarlar zaten dönüyor'));
    const vals = Array.isArray(values) && values.length === 2 ? values.slice() : [d6(), d6()];
    if (vals.some((v) => !Number.isInteger(v) || v < 1 || v > 6)) return Promise.reject(new Error('Tavla3D: değerler 1-6 arası olmalı'));
    if (!width) layout();
    reset();
    let sim, best = null, tries = 0;
    do { sim = simulate(); if (!best || sim.score > best.score) best = sim; } while (!sim.ok && ++tries < 60);
    sim = best;
    // GARANTİ (kullanıcı direktifi: zar pul üstünde DURAMAZ): best sim'de hâlâ pula denk gelen
    // zarı en yakın BOŞ noktaya düz otur. x/z taşınır + y=DH (üst yüz korunur -> değer değişmez),
    // iki zar da üst üste gelmez. Clearance düzeltmesi çoğu atışı zaten temiz yaptığından nadir.
    // Zarlar ATILDIĞI YERDE kalır (otomatik ortaya ALMA — kullanıcı direktifi). Yalnız pul ÜSTÜNE
    // denk gelen zar, en yakın boş noktaya oturur (kötü "pul üstü" animasyonu olmasın); temizse dokunma.
    {
      const stk = stackBoxes(), ar = area(), last = sim.frames[sim.frames.length - 1], placed = [];
      const spotFree = (x, z) =>
        !stk.some((s) => x + DCL > s.minX && x - DCL < s.maxX && z + DCL > s.minZ && z - DCL < s.maxZ) &&
        placed.every((p) => Math.hypot(p[0] - x, p[1] - z) > DIE + 0.08);
      for (const f of last) {
        if (spotFree(f[0], f[2])) { placed.push([f[0], f[2]]); continue; }
        let bx = f[0], bz = f[2], bd = Infinity;
        for (let gx = ar.xMin + DH + 0.1; gx <= ar.xMax - DH - 0.1; gx += 0.3)
          for (let gz = ar.zMin + DH + 0.1; gz <= ar.zMax - DH - 0.1; gz += 0.3) {
            if (!spotFree(gx, gz)) continue;
            const d2 = (gx - f[0]) ** 2 + (gz - f[2]) ** 2;
            if (d2 < bd) { bd = d2; bx = gx; bz = gz; }
          }
        f[0] = bx; f[1] = DH; f[2] = bz; placed.push([bx, bz]);
      }
    }
    dice.forEach((d, i) => setFaces(d, remap(sim.ups[i], vals[i])));
    emit('roll', { values: vals });
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) sim.frames = sim.frames.slice(-1);
    return new Promise((resolve) => { anim = { sim, start: performance.now(), played: 0, resolve, vals }; });
  }

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (anim) {
      const { sim } = anim, n = sim.frames.length;
      const pos = Math.max(0, ((now - anim.start) / 1000) * FPS);
      const i = Math.min(Math.floor(pos), n - 1), t = Math.min(1, pos - i);
      const fa = sim.frames[i], fb = sim.frames[Math.min(i + 1, n - 1)];
      dice.forEach((d, k) => {
        const A = fa[k], Bf = fb[k];
        d.mesh.position.set(A[0] + (Bf[0] - A[0]) * t, A[1] + (Bf[1] - A[1]) * t, A[2] + (Bf[2] - A[2]) * t);
        qa.set(A[3], A[4], A[5], A[6]); qb.set(Bf[3], Bf[4], Bf[5], Bf[6]);
        d.mesh.quaternion.copy(qa.slerp(qb, t));
      });
      while (anim.played < sim.events.length && sim.events[anim.played].frame <= i) {
        const ev = sim.events[anim.played++];
        if (o.sound) click(ev.strength, ev.high);
      }
      dirty = true;
      if (i >= n - 1) {
        const { resolve, vals } = anim;
        anim = null; current = vals;
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
    Object.values(d.mats).forEach((m) => { m.opacity = used ? 0.4 : 1; m.color.setScalar(used ? 0.6 : 1); });
    dirty = true;
  }
  function reset() { dice.forEach((_, i) => markUsed(i, false)); }

  // ---- Tıklama: hangi haneye tıklandı ----
  const pickRay = new THREE.Raycaster(), pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pickHit = new THREE.Vector3();
  function pointAt(x, z) {
    if (Math.abs(x) > B / 2 + HW || Math.abs(z) > D / 2) return null;
    if (Math.abs(x) < B / 2) return 'bar';
    const bottom = z > 0;
    const col = Math.min(5, Math.floor((Math.abs(x) - B / 2) / P));
    if (x > 0) return bottom ? 6 - col : 19 + col;
    return bottom ? 7 + col : 18 - col;
  }
  // EK (salt-okunur, surukleme icin): verilen EKRAN koordinatindaki haneyi dondurur (1-24 / 'bar' / null).
  // Fizik/ayar/oyun mantigi DEGISMEZ; yalnizca var olan raycast + pointAt disa acilir.
  function pointAtScreen(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    pickRay.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    if (!pickRay.ray.intersectPlane(pickPlane, pickHit)) return null;
    return pointAt(pickHit.x, pickHit.z);
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const point = pointAtScreen(ev.clientX, ev.clientY);
    if (point != null) emit('point', { point, originalEvent: ev });
  });

  layout();
  setPosition(o.position);
  show(current);
  let raf = requestAnimationFrame(tick);

  return {
    canvas,
    pointAtScreen, // EK (salt-okunur): surukleme icin ekran->hane
    roll, show, setPosition, markUsed, reset,
    get values() { return current.slice(); },
    get isRolling() { return !!anim; },
    setSound(v) { o.sound = !!v; },
    setTilt(deg) { o.tilt = deg; layout(); },
    setZoom(z) { o.zoom = z > 0 ? z : 1; layout(); },
    setCube(value) { setCube(value); },
    setThrow(half, from) { if (half) o.half = half; if (from) o.from = from; },
    on(n, fn) { (listeners[n] = listeners[n] || []).push(fn); return this; },
    off(n, fn) { listeners[n] = (listeners[n] || []).filter((f) => f !== fn); return this; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); pmrem.dispose(); canvas.remove(); }
  };
}

export default { mount, OPENING };

// The 3D kitchen: one warm night diorama that reacts to the line (burners, stacks, riders, lamps, fireworks).
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { MANIFEST } from './manifest.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const C = { night: 0x14162E, wall: 0x2A2F66, wall2: 0x22265A, tile: 0x31376F, cream: 0xFFF2DC, ink: 0x23284A, saffron: 0xF4A51C, gold: 0xFFD166, tomato: 0xE8503A, teal: 0x1FA898, sky: 0x7FB8F0, green: 0x8BC34A, pink: 0xF28DB2, wood: 0xC8955E, steel: 0x8C93B8 };
export const STX = { prep: -6.75, cook: -2.25, pack: 2.25, disp: 6.75 };
let R, scene, cam, clock, lamps = [], burners = [], packStack, dispStack, scooters = [], cityMat, fw, steams = [], openSign, signCtx, signTex, bulbs = [], parts = {};
const U = { t: 0 };

function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .0, ...o }); }
function box(w, h, d, mat, r = .06, seg = 3) { return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, r), mat); }
function add(parent, m, x = 0, y = 0, z = 0, sh = true) { m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; parent.add(m); return m; }

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

function skyline() {
  return canvasTex(2048, 640, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0E1030'); sky.addColorStop(.7, '#262A63'); sky.addColorStop(1, '#3B3577');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .6 + .2})`; const r = Math.random() * 1.6 + .4; g.beginPath(); g.arc(Math.random() * w, Math.random() * h * .55, r, 0, 7); g.fill(); }
    // moon
    g.fillStyle = '#FFE7A8'; g.beginPath(); g.arc(1640, 120, 54, 0, 7); g.fill(); g.fillStyle = '#16183F'; g.beginPath(); g.arc(1666, 104, 50, 0, 7); g.fill();
    const layer = (base, hmin, hmax, col, win, seed) => { let x = -20; let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      while (x < w) { const bw = 70 + rnd() * 130, bh = hmin + rnd() * (hmax - hmin); g.fillStyle = col; g.fillRect(x, h - bh, bw, bh);
        if (rnd() < .18) { g.beginPath(); g.arc(x + bw / 2, h - bh, bw * .32, Math.PI, 0); g.fill(); }
        if (win) for (let yy = h - bh + 18; yy < h - 10; yy += 26) for (let xx = x + 12; xx < x + bw - 14; xx += 22) if (rnd() < .33) { g.fillStyle = rnd() < .8 ? 'rgba(255,209,102,.85)' : 'rgba(127,184,240,.8)'; g.fillRect(xx, yy, 9, 12); g.fillStyle = col; }
        x += bw + 6; } };
    layer(0, 200, 380, '#232663', false, 7); layer(0, 120, 300, '#1A1C48', true, 21); layer(0, 60, 170, '#121433', true, 99);
  });
}
function neon(on) {
  const g = signCtx, w = 512, h = 192; g.clearRect(0, 0, w, h); g.fillStyle = '#12132A'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 30); g.fill();
  g.font = '800 120px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (on) { g.shadowColor = '#FF6A50'; g.shadowBlur = 30; g.fillStyle = '#FFB3A6'; g.fillText('OPEN', w / 2, h / 2 + 8); g.shadowBlur = 12; g.fillText('OPEN', w / 2, h / 2 + 8); }
  else { g.fillStyle = '#3A2E48'; g.fillText('OPEN', w / 2, h / 2 + 8); }
  signTex.needsUpdate = true; openSign.material.emissiveIntensity = on ? 1.4 : 0;
}

export function initScene(canvas) {
  R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  R.setClearColor(C.night); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = THREE.SRGBColorSpace;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(C.night, 30, 60);
  const pmg = new THREE.PMREMGenerator(R); scene.environment = pmg.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .35; pmg.dispose();
  cam = new THREE.PerspectiveCamera(30, 1920 / 1200, .1, 120);
  clock = new THREE.Clock();

  // lights
  const hemi = new THREE.HemisphereLight(0x9AA6FF, 0x2A1E2E, .9); scene.add(hemi); parts.hemi = hemi;
  const key = new THREE.DirectionalLight(0xFFE2B8, 1.6); key.position.set(-6, 12, 10); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -6, near: 1, far: 40 }); key.shadow.bias = -.0008; key.shadow.normalBias = .02; scene.add(key); parts.key = key;
  const fill = new THREE.DirectionalLight(0x7FB8F0, .35); fill.position.set(8, 4, 6); scene.add(fill);

  // room
  const planks = canvasTex(1024, 1024, (g, w, h) => { for (let i = 0; i < 8; i++) { const y = i * 128; g.fillStyle = ['#4A2F2A', '#53352E', '#462C28', '#4E322B'][i % 4]; g.fillRect(0, y, w, 128);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(0,0,0,${.05 + Math.random() * .08})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const yy = y + Math.random() * 128; g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + 6, w * .6, yy - 6, w, yy + 3); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y, w, 3); const off = (i * 397) % w; g.fillRect(off, y, 3, 128); } });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(6, 3);
  const floor = add(scene, new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ map: planks, roughness: .55, metalness: 0, envMapIntensity: .6 })), 0, 0, 4, false); floor.rotation.x = -Math.PI / 2;
  // subway tiles: glossy, slightly uneven, with grout
  const tiles = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#20244E'; g.fillRect(0, 0, w, h); const tw = 128, th = 64;
    for (let r = 0; r < h / th; r++) for (let c = -1; c < w / tw + 1; c++) { const x = c * tw + (r % 2) * tw / 2, y = r * th; const l = 25 + Math.random() * 3;
      const gr = g.createLinearGradient(x, y, x, y + th); gr.addColorStop(0, `hsl(234,30%,${l + 3}%)`); gr.addColorStop(1, `hsl(234,32%,${l - 1}%)`); g.fillStyle = gr; g.beginPath(); g.roundRect(x + 3, y + 3, tw - 6, th - 6, 6); g.fill(); } });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(3.4, 1.6);
  const wallMat = new THREE.MeshPhysicalMaterial({ map: tiles, roughness: .32, clearcoat: .4, clearcoatRoughness: .25, envMapIntensity: .8 });
  // back wall with a window hole: build from 4 slabs around the opening
  const W = 30, H = 12, wz = -3.2, ox0 = -7.4, ox1 = 7.4, oy0 = 3.2, oy1 = 7.6;
  add(scene, new THREE.Mesh(new THREE.BoxGeometry(W, oy0, .3), wallMat), 0, oy0 / 2, wz, false);
  add(scene, new THREE.Mesh(new THREE.BoxGeometry(W, H - oy1, .3), wallMat), 0, oy1 + (H - oy1) / 2, wz, false);
  add(scene, new THREE.Mesh(new THREE.BoxGeometry((W / 2 + ox0), oy1 - oy0, .3), wallMat), (-W / 2 + ox0) / 2, (oy0 + oy1) / 2, wz, false);
  add(scene, new THREE.Mesh(new THREE.BoxGeometry((W / 2 - ox1), oy1 - oy0, .3), wallMat), (W / 2 + ox1) / 2, (oy0 + oy1) / 2, wz, false);
  // window frame + mullions
  const frameM = std(C.cream, { roughness: .5 });
  add(scene, box(ox1 - ox0 + .5, .28, .5, frameM, .08), 0, oy0 - .05, wz + .15);
  add(scene, box(ox1 - ox0 + .5, .22, .4, frameM, .08), 0, oy1, wz + .1);
  for (const x of [ox0, -2.47, 2.47, ox1]) add(scene, box(.22, oy1 - oy0, .4, frameM, .06), x, (oy0 + oy1) / 2, wz + .1);
  // skyline backdrop (outside)
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(26, 8.1), new THREE.MeshBasicMaterial({ map: skyline(), toneMapped: false })); sky.position.set(0, 5.3, -9); scene.add(sky); parts.sky = sky;
  cityMat = sky.material;
  const refl = canvasTex(1024, 512, (g, w, h) => { g.clearRect(0, 0, w, h); for (const [x0, wd, a] of [[120, 90, .10], [260, 30, .07], [620, 140, .08], [800, 40, .06]]) { const gr = g.createLinearGradient(x0, 0, x0 + wd, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(200,215,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.save(); g.translate(0, 0); g.transform(1, 0, -.45, 1, 0, 0); g.fillRect(x0, 0, wd, h); g.restore(); } });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(ox1 - ox0, oy1 - oy0), new THREE.MeshBasicMaterial({ map: refl, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glass.position.set(0, (oy0 + oy1) / 2, wz + .02); scene.add(glass);
  // string lights across the window
  const bulbGeo = new THREE.SphereGeometry(.07, 10, 8);
  for (let i = 0; i < 34; i++) { const t = i / 33, x = ox0 + .2 + t * (ox1 - ox0 - .4), y = oy1 - .35 - Math.sin(t * Math.PI * 3) * .18 - .1;
    const col = [C.gold, C.pink, C.sky, C.saffron][i % 4]; const m = new THREE.Mesh(bulbGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0 })); m.position.set(x, y, wz + .35); scene.add(m); bulbs.push(m); }

  // shelves on wall sides
  const shelfM = std(C.wood, { roughness: .7 });
  for (const sx of [-11.3, 11.3]) { add(scene, box(4.2, .14, .7, shelfM, .04), sx, 5.2, wz + .45); add(scene, box(4.2, .14, .7, shelfM, .04), sx, 6.6, wz + .45);
    for (let i = 0; i < 4; i++) { const jar = add(scene, new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .5, 18), std([C.saffron, C.teal, C.tomato, C.green][(i + (sx > 0 ? 2 : 0)) % 4], { roughness: .4 })), sx - 1.4 + i * .95, 5.52, wz + .45); jar.scale.y = .8 + (i % 2) * .4; jar.userData.proc = 1; parts.jars = (parts.jars || []).concat(jar); } }

  // counter
  const marble = canvasTex(1024, 256, (g, w, h) => { g.fillStyle = '#F4ECE0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(150,140,160,${.08 + Math.random() * .18})`; g.lineWidth = .6 + Math.random() * 1.8; g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (Math.random() - .5) * 40; y += 12 + Math.random() * 20; g.lineTo(x, y); } g.stroke(); } });
  const ctop = new THREE.MeshPhysicalMaterial({ map: marble, roughness: .18, clearcoat: .6, clearcoatRoughness: .1, envMapIntensity: .9 });
  const panel = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#242A5E'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.strokeRect(i * 128 + 10, 14, 108, h - 28); }  });
  panel.wrapS = THREE.RepeatWrapping; panel.repeat.set(5, 1);
  const cbody = new THREE.MeshStandardMaterial({ map: panel, roughness: .5, envMapIntensity: .5 });
  add(scene, box(20, 1.25, 2.6, cbody, .12), 0, .63, 1.2);
  add(scene, box(20.4, .16, 2.9, ctop, .07), 0, 1.33, 1.2);
  const stripeCols = [C.green, C.tomato, C.saffron, C.sky];
  Object.values(STX).forEach((x, i) => { add(scene, box(4.2, .1, .06, std(stripeCols[i], { emissive: stripeCols[i], emissiveIntensity: .35 }), .03), x, 1.05, 2.53, false); });

  // pendant lamps
  const shadeM = std(C.ink, { roughness: .4, metalness: .2 });
  Object.values(STX).forEach((x, i) => {
    const g = new THREE.Group(); g.position.set(x, 8.4, .9); scene.add(g);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 3, 6), shadeM); cord.position.y = 1.5; g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.75, .7, 28, 1, true), std(C.saffron, { side: THREE.DoubleSide, roughness: .5 })); g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xFFF1C2, emissive: 0xFFD27A, emissiveIntensity: 0 })); bulb.position.y = -.28; g.add(bulb);
    const pl = new THREE.PointLight(0xFFC77A, 0, 9, 1.6); pl.position.y = -.6; g.add(pl);
    lamps.push({ g, bulb, pl, shade });
  });

  buildPrep(); buildCook(); buildPack(); buildDisp();

  // fireworks particles (behind the glass, in front of skyline)
  const N = 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const pm = new THREE.PointsMaterial({ size: .32, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; scene.add(pts);
  fw = { pts, pos, col, vel: new Float32Array(N * 3), life: new Float32Array(N), n: N, head: 0 };
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -99;

  setCam('dark', 0);
  return { renderer: R, scene, camera: cam };
}

function buildPrep() {
  const x = STX.prep, g = new THREE.Group(); g.position.set(x, 1.42, 1.0); scene.add(g); parts.prep = g;
  add(g, box(2.6, .14, 1.5, std(C.wood, { roughness: .7 }), .06), 0, 0, 0);
  const tom = std(C.tomato, { roughness: .35 }), cuc = std(0x5DB54A, { roughness: .45 }), on = std(0xC86DA8, { roughness: .4 });
  add(g, new THREE.Mesh(new THREE.SphereGeometry(.28, 20, 14), tom), -.8, .3, -.2);
  add(g, new THREE.Mesh(new THREE.SphereGeometry(.22, 20, 14), tom), -.45, .25, .3);
  const c1 = add(g, new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1.1, 16), cuc), .55, .2, -.25); c1.rotation.z = Math.PI / 2; c1.rotation.y = .4;
  for (let i = 0; i < 4; i++) { const s = add(g, new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .05, 16), std(0xCDEFB0)), .2 + i * .17, .1, .35); s.rotation.x = .1; }
  add(g, new THREE.Mesh(new THREE.SphereGeometry(.24, 18, 14), on), 1.0, .26, .25);
  const knife = new THREE.Group(); g.add(knife); knife.position.set(-.1, .12, .55); knife.rotation.y = -.25;
  add(knife, box(.9, .04, .16, std(0xD9DEEF, { metalness: .6, roughness: .25 }), .02), .3, 0, 0); add(knife, box(.42, .08, .14, std(C.ink), .03), -.35, 0, 0);
  parts.knife = knife;
  // bowls
  for (let i = 0; i < 2; i++) add(g, new THREE.Mesh(new THREE.CylinderGeometry(.35, .22, .26, 22, 1, true), std(0xC9D0EA, { metalness: .5, roughness: .3, side: THREE.DoubleSide })), -1.7 + i * .0, .1, -.2 + i * .65).scale.set(1, 1, 1);
}
function buildCook() {
  const x = STX.cook, g = new THREE.Group(); g.position.set(x, 1.42, 1.0); scene.add(g); parts.cook = g;
  add(g, box(3.6, .24, 1.7, std(0x1B1E40, { roughness: .4, metalness: .3 }), .08), 0, .05, 0).userData.proc = 1;
  [-1.15, 0, 1.15].forEach((bx, i) => {
    const ringM = new THREE.MeshStandardMaterial({ color: 0x3A3F70, emissive: 0xFF7A2A, emissiveIntensity: 0, roughness: .4 });
    const ring = add(g, new THREE.Mesh(new THREE.TorusGeometry(.42, .055, 10, 36), ringM), bx, .2, .05, false); ring.rotation.x = -Math.PI / 2;
    const glow = new THREE.PointLight(0xFF8A3A, 0, 2.2, 2); glow.position.set(bx, .45, .1); g.add(glow);
    burners.push({ ring, glow, x: bx, state: 'off', level: 0 });
  });
  // pot (lathe) on burner 1
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(.45 + Math.sin(t * Math.PI) * .06, t * .6)); }
  const pot = add(g, new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), ...pts], 32), std(C.tomato, { roughness: .35 })), -1.15, .24, .05);
  const lid = add(g, new THREE.Mesh(new THREE.SphereGeometry(.47, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), std(C.gold, { metalness: .4, roughness: .3 })), -1.15, .82, .05); lid.scale.y = .55;
  add(g, new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 10), std(C.gold, { metalness: .4, roughness: .3 })), -1.15, 1.0, .05);
  parts.lid = lid; [pot, lid].forEach(m => m.userData.proc = 1); g.children[g.children.length - 1].userData.proc = 1;
  // pan on burner 2
  const pan = add(g, new THREE.Mesh(new THREE.CylinderGeometry(.5, .42, .14, 28), std(0x2C2F55, { metalness: .4, roughness: .35 })), 0, .3, .05); pan.userData.proc = 1;
  add(pan, box(.9, .07, .12, std(C.ink), .03), .85, .02, 0);
  for (let i = 0; i < 4; i++) add(g, box(.18, .12, .18, std(0xF0B45A, { roughness: .5 }), .05), -.18 + (i % 2) * .3, .42, -.1 + Math.floor(i / 2) * .28).userData.proc = 1;
  // tray on burner 3
  add(g, box(1.0, .1, .8, std(0xC9D0EA, { metalness: .5, roughness: .3 }), .05), 1.15, .3, .05);
  for (let i = 0; i < 3; i++) add(g, new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), std(0x8C3B1E, { roughness: .3 })), .9 + i * .25, .42, .05);
  // steam sprites
  const m = MANIFEST.fx_steam; const loader = new THREE.TextureLoader();
  [-1.15, 0, 1.15].forEach((bx, i) => { const t = loader.load(m.src); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 4, 1); const sm = new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(sm); s.scale.set(.5, 1.06, 1); s.position.set(bx, 1.45, .05); g.add(s); steams.push({ s, t, ph: i * 1.3 }); });
}
function buildPack() {
  const x = STX.pack, g = new THREE.Group(); g.position.set(x, 1.42, 1.0); scene.add(g); parts.pack = g;
  add(g, box(3.4, .08, 1.6, std(0xEADBC2, { roughness: .8 }), .03), 0, 0, 0);
  // flat box stack (left) and tape
  for (let i = 0; i < 4; i++) add(g, box(1.0, .06, .8, std(0xD9A066), .02), -1.1, .07 + i * .07, -.15);
  const tape = add(g, new THREE.Mesh(new THREE.TorusGeometry(.18, .07, 10, 24), std(C.saffron)), -1.1, .5, .45); tape.rotation.x = -Math.PI / 2.4;
  packStack = new THREE.Group(); packStack.position.set(.55, .05, 0); g.add(packStack);
}
function partyBox(col = C.cream) {
  const g = new THREE.Group();
  const b = box(.82, .5, .62, std(col, { roughness: .55 }), .06); b.castShadow = true; b.position.y = .25; g.add(b);
  const band = box(.84, .14, .64, std(C.saffron, { roughness: .5 }), .03); band.position.y = .3; g.add(band);
  const bow = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), std(C.gold, { roughness: .4 })); bow.position.y = .53; g.add(bow);
  return g;
}
function buildDisp() {
  const x = STX.disp, g = new THREE.Group(); g.position.set(x, 1.42, 1.0); scene.add(g); parts.disp = g;
  // pickup shelf
  add(g, box(3.2, .1, 1.4, std(C.wood), .04), 0, 0, -.1);
  dispStack = new THREE.Group(); dispStack.position.set(-1.1, .05, -.1); g.add(dispStack);
  // door on the right wall area behind
  const door = new THREE.Group(); door.position.set(x + 1.9, 0, -3.0); scene.add(door);
  add(door, box(2.2, 4.4, .2, std(C.teal, { roughness: .5 }), .08), 0, 2.2, 0);
  add(door, box(1.4, 1.6, .12, new THREE.MeshStandardMaterial({ color: 0x7FB8F0, emissive: 0x2C4C7A, emissiveIntensity: .6, roughness: .2 }), .06), 0, 3.0, .12);
  add(door, new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), std(C.gold, { metalness: .5 })), .75, 2.1, .18);
  // OPEN neon sign above the counter at dispatch
  const c = document.createElement('canvas'); c.width = 512; c.height = 192; signCtx = c.getContext('2d'); signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace;
  openSign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .72), new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0, transparent: true }));
  openSign.position.set(5.0, 4.15, -3.0); scene.add(openSign); neon(false);
  // scooters parked (riders) — little stylised scooters on the floor in front-right
  for (let i = 0; i < 6; i++) { const s = scooter(); s.position.set(11.4 + (i % 3) * 1.25, 0, -2.4 + Math.floor(i / 3) * 1.3); s.rotation.y = -1.2; scene.add(s); scooters.push(s); }
}
function scooter() {
  const g = new THREE.Group(); const red = std(C.tomato, { roughness: .35 }), dark = std(0x22243F, { roughness: .6 });
  const w1 = new THREE.Mesh(new THREE.TorusGeometry(.22, .09, 10, 20), dark); w1.position.set(-.45, .3, 0); g.add(w1);
  const w2 = w1.clone(); w2.position.x = .45; g.add(w2);
  const body = box(.95, .32, .38, red, .12); body.position.set(-.05, .55, 0); g.add(body);
  const stem = box(.12, .6, .12, red, .05); stem.position.set(.45, .85, 0); g.add(stem);
  const bar = box(.1, .08, .55, dark, .03); bar.position.set(.45, 1.15, 0); g.add(bar);
  const crate = box(.42, .38, .42, std(C.cream), .06); crate.position.set(-.4, .92, 0); g.add(crate);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(.95);
  return g;
}

/* ---------- reactive API ---------- */
export function lightsOn(on = true, stagger = .22) {
  lamps.forEach((l, i) => { gsap.to(l.bulb.material, { emissiveIntensity: on ? 2.2 : 0, duration: .25, delay: on ? i * stagger : 0 }); gsap.to(l.pl, { intensity: on ? 9 : 0, duration: .35, delay: on ? i * stagger : 0 }); });
  gsap.to(parts.key, { intensity: on ? 1.6 : .25, duration: .8 }); gsap.to(parts.hemi, { intensity: on ? .9 : .35, duration: .8 });
  bulbs.forEach((b, i) => gsap.to(b.material, { emissiveIntensity: on ? 1.8 : 0, duration: .3, delay: on ? .9 + i * .02 : 0 }));
}
export function setOpen(on) { neon(on); }
export function setBurner(i, state, level = 0) { const b = burners[i]; if (!b) return; b.state = state; b.level = level; }
export function setStacks(pack, disp) {
  const fill = (grp, n, cap) => { while (grp.children.length > Math.min(n, cap)) grp.remove(grp.children[grp.children.length - 1]);
    while (grp.children.length < Math.min(n, cap)) { const k = grp.children.length; const b = partyBox(); const col = k % 3, row = Math.floor(k / 3); b.position.set(col * .9 - .9, row * .52, (k % 2) * .05); b.rotation.y = (Math.random() - .5) * .2; grp.add(b); gsap.from(b.position, { y: b.position.y + 1.2, duration: .45, ease: 'bounce.out' }); } };
  fill(packStack, pack, 6); fill(dispStack, disp, 9);
}
export function setRiders(free, total) { scooters.forEach((s, i) => { const vis = i < Math.round(free / Math.max(1, total) * 6); if (s.visible !== vis) { if (!vis) { gsap.to(s.position, { x: s.position.x + 6, duration: .9, ease: 'power2.in', onComplete: () => { s.visible = false; s.position.x -= 6; } }); } else { s.visible = true; gsap.from(s.position, { x: s.position.x + 6, duration: .9, ease: 'power2.out' }); } } }); }
export function chop() { if (!parts.knife) return; gsap.fromTo(parts.knife.rotation, { z: 0 }, { z: .5, duration: .08, yoyo: true, repeat: 1 }); }
export function rattleLid() { const l = parts.lid; if (!l) return; const y0 = l.userData.y0 ?? (l.userData.y0 = l.position.y); gsap.fromTo(l.position, { y: y0 }, { y: y0 + .07, duration: .08, yoyo: true, repeat: 3 }); }
export function burstFirework(x = (Math.random() - .5) * 12, y = 4.5 + Math.random() * 2.5, hue, z = -6, sc = 1) {
  const cols = [[1, .82, .4], [.95, .55, .7], [.5, .75, .95], [.35, .9, .8], [1, .65, .2]]; const c = hue != null ? cols[hue % cols.length] : cols[Math.floor(Math.random() * cols.length)];
  const n = 90; for (let k = 0; k < n; k++) { const i = fw.head; fw.head = (fw.head + 1) % fw.n; const a = Math.random() * Math.PI * 2, el = Math.acos(Math.random() * 2 - 1), sp = (1.6 + Math.random() * .8) * sc;
    fw.pos.set([x, y, z], i * 3); fw.vel.set([Math.sin(el) * Math.cos(a) * sp, Math.cos(el) * sp, Math.sin(el) * Math.sin(a) * sp * .3], i * 3); fw.col.set(c, i * 3); fw.life[i] = 1 + Math.random() * .4; }
}
/* camera presets */
const CAMS = {
  dark: { p: [0, 3.6, 8.5], t: [0, 3.2, -1], fov: 30 },
  wide: { p: [0, 5.4, 22.5], t: [0, 3.5, 0], fov: 30 },
  play: { p: [0, 7.0, 22.5], t: [0, 1.65, 0], fov: 30 },
  disp: { p: [6.5, 4.2, 12], t: [7.5, 2.6, -1], fov: 30 },
  window: { p: [0, 4.4, 15], t: [0, 5.4, -4], fov: 34 },
  plan: { p: [-1.2, 5.6, 21], t: [0, 4.0, 0], fov: 30 },
};
const camT = new THREE.Vector3();
export function setCam(name, dur = 1.6, ease = 'power3.inOut') {
  const c = CAMS[name]; if (!c) return; gsap.killTweensOf(cam.position); gsap.killTweensOf(camT); gsap.killTweensOf(cam);
  if (!dur) { cam.position.set(...c.p); camT.set(...c.t); cam.fov = c.fov; cam.updateProjectionMatrix(); return; }
  gsap.to(cam.position, { x: c.p[0], y: c.p[1], z: c.p[2], duration: dur, ease });
  gsap.to(camT, { x: c.t[0], y: c.t[1], z: c.t[2], duration: dur, ease });
  gsap.to(cam, { fov: c.fov, duration: dur, ease, onUpdate: () => cam.updateProjectionMatrix() });
}
let quality = /q=low/.test(location.search) ? .45 : 1, lastScale = 1;
export function resize(scale) { lastScale = scale; const pr = Math.min(window.devicePixelRatio || 1, 1.5) * scale * quality; R.setPixelRatio(Math.max(.3, pr)); R.setSize(1920, 1200, false); if (quality < .6) R.shadowMap.enabled = false; }
// adaptive quality: if the device can't hold ~40 fps, render fewer pixels (K11 safety net)
let fpsAcc = 0, fpsN = 0, fpsChecks = 0;
function adapt(dt) { fpsAcc += dt; fpsN++; if (fpsAcc > 2) { const fps = fpsN / fpsAcc; fpsAcc = fpsN = 0; if (fps < 38 && quality > .5 && fpsChecks < 4) { quality -= .2; fpsChecks++; resize(lastScale); } } }

export function frame() {
  const dt = Math.min(clock.getDelta(), .05); U.t += dt;
  // burners
  burners.forEach((b, i) => { const m = b.ring.material; let target = 0, col = 0xFF7A2A;
    if (b.state === 'cook') target = 1.2 + Math.sin(U.t * 6 + i) * .15; else if (b.state === 'done') { target = 1.6 + Math.sin(U.t * 8) * .6; col = 0xFFD166; } else if (b.state === 'burnt') { target = .2; col = 0x553322; }
    m.emissive.setHex(col); m.emissiveIntensity += (target - m.emissiveIntensity) * .15; b.glow.intensity = m.emissiveIntensity * 2.2; b.glow.color.setHex(col);
    const st = steams[i]; const want = b.state === 'cook' || b.state === 'done' ? .9 : 0; st.s.material.opacity += (want - st.s.material.opacity) * .08;
    st.t.offset.x = Math.floor((U.t * 5 + st.ph) % 4) / 4; st.s.position.y = 1.45 + Math.sin(U.t * 1.4 + st.ph) * .05; });
  burners.forEach(b => { if (b.gl) b.gl.material.opacity = Math.min(.9, b.ring.material.emissiveIntensity * .45); });
  lamps.forEach(l => { if (l.halo) l.halo.material.opacity = Math.min(.55, l.bulb.material.emissiveIntensity * .25); if (l.pool) { const k = Math.min(1, l.bulb.material.emissiveIntensity / 2.2); l.pool.material.opacity = .28 * k; l.wpool.material.opacity = .16 * k; } });
  bulbs.forEach(b => { if (b.userData.gl) b.userData.gl.material.opacity = Math.min(.9, b.material.emissiveIntensity * .4); });
  if (parts.signGlow) parts.signGlow.material.opacity = openSign.material.emissiveIntensity * .35;
  // string light twinkle
  bulbs.forEach((b, i) => { if (b.material.emissiveIntensity > .4) b.material.emissiveIntensity = 1.5 + Math.sin(U.t * 2 + i * 1.7) * .4; });
  // fireworks
  if (fw) { const p = fw.pos, v = fw.vel, c = fw.col; let any = false;
    for (let i = 0; i < fw.n; i++) { if (fw.life[i] <= 0) continue; any = true; fw.life[i] -= dt * .55; v[i * 3 + 1] -= dt * 1.1; v[i * 3] *= .985; v[i * 3 + 1] *= .985; v[i * 3 + 2] *= .985;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt; const f = Math.max(0, fw.life[i]); if (fw.life[i] <= 0) p[i * 3 + 1] = -99; else { c[i * 3] *= .995; c[i * 3 + 1] *= .992; c[i * 3 + 2] *= .995; } }
    if (any) { fw.pts.geometry.attributes.position.needsUpdate = true; fw.pts.geometry.attributes.color.needsUpdate = true; } }
  if (intro && intro.g.visible) introFrame(dt);
  adapt(dt);
  cam.lookAt(camT);
  R.render(scene, cam);
  return dt * 1000;
}

/* ---------- glow sprites (cheap bloom) ---------- */
let glowTex = null;
function glow(color, size, opacity = 1) {
  if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); glowTex = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.set(size, size, 1); s.userData.base = opacity; return s;
}

/* ---------- Blender props ---------- */
export async function loadProps() {
  let gl; try { gl = await new GLTFLoader().loadAsync('assets/models/props.glb'); } catch (e) { console.warn('props.glb failed, keeping procedural props', e); return; }
  const get = n => gl.scene.getObjectByName(n);
  gl.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.envMapIntensity = 1.0; } });
  const drop = grp => [...grp.children].forEach(c => { if (c.userData.proc) grp.remove(c); });
  // prep board + veg + knife
  const board = get('board'); parts.prep.clear(); parts.prep.add(board); board.position.set(0, 0, 0); parts.knife = board.getObjectByName('knife');
  // cook: stove, handi, karahi
  drop(parts.cook);
  const stove = get('stove'); parts.cook.add(stove); stove.position.set(0, -.05, .05);
  const pot = get('pot'); parts.cook.add(pot); pot.position.set(-1.15, .22, .05); parts.lid = pot.getObjectByName('pot_lid');
  const kar = get('karahi'); parts.cook.add(kar); kar.position.set(0, .22, .05);
  burners.forEach(b => { b.ring.position.y = .14; b.ring.material.color.setHex(0x26283A); b.gl = glow(0xFF8A3A, 1.6, 0); b.gl.position.set(b.x, .3, .1); parts.cook.add(b.gl); });
  // lamps
  const lampSrc = get('lamp');
  lamps.forEach(l => { l.shade.visible = false; l.bulb.visible = false; const c = lampSrc.clone(true); c.scale.setScalar(1.35); l.g.add(c);
    const bm = c.getObjectByName('lamp_bulb'); bm.material = bm.material.clone(); bm.material.emissiveIntensity = 0; l.bulb = bm;
    l.halo = glow(0xFFC77A, 3.2, 0); l.halo.position.y = -.4; l.g.add(l.halo); l.pl.position.y = -.5; });
  // shelves
  (parts.jars || []).forEach(j => scene.remove(j));
  const shelf = get('shelfset');
  for (const [x, y] of [[-11.3, 5.27], [11.3, 5.27], [-11.3, 6.67], [11.3, 6.67]]) { const c = shelf.clone(true); c.position.set(x - .1, y, -3.2 + .45); c.scale.setScalar(.95); if (y > 6) c.rotation.y = Math.PI; scene.add(c); }
  // scooters
  const scSrc = get('scooter');
  scooters.forEach(s => { s.clear(); const c = scSrc.clone(true); s.add(c); });
  const rail = get('rail'); scene.add(rail); rail.position.set(-4.5, 2.95, -2.98); rail.scale.setScalar(1.25);
  const tr = get('ticketrail'); scene.add(tr); tr.position.set(2.25, 2.85, -3.0);
  // warm light pools from each pendant onto the counter and wall (cheap baked-look)
  lamps.forEach((l, i) => { const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.0), new THREE.MeshBasicMaterial({ map: poolTex(), color: 0xFFB866, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(l.g.position.x, 1.425, 1.1); scene.add(pool); l.pool = pool;
    const wp = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.4), pool.material.clone()); wp.position.set(l.g.position.x, 3.2, -3.03); scene.add(wp); l.wpool = wp; });
  // string-light + sign glows
  bulbs.forEach(b => { const g = glow(b.material.color.getHex(), .55, 0); b.add(g); b.userData.gl = g; });
  parts.signGlow = glow(0xFF6A50, 3.2, 0); parts.signGlow.position.copy(openSign.position); parts.signGlow.position.z += .1; scene.add(parts.signGlow);
  props = true;
}
let props = false;

let _pool = null;
function poolTex() { if (_pool) return _pool; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); _pool = new THREE.CanvasTexture(c); return _pool; }


/* ================= cinematic intro: night sky → street → shop window → kitchen =================
   Everything here is procedural (canvas textures + primitives), so the download barely grows.
   It is built once, played once, then disposed. */
let intro = null;
function introBuild() {
  const g = new THREE.Group(); scene.add(g);
  const basic = (o) => new THREE.MeshBasicMaterial({ toneMapped: false, ...o });
  // --- sky at infinity: follows the camera ---
  const sky = new THREE.Group(); g.add(sky);
  const domeTex = canvasTex(64, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#04051A'); gr.addColorStop(.3, '#0C1036'); gr.addColorStop(.47, '#27235F'); gr.addColorStop(.52, '#4C3876'); gr.addColorStop(.6, '#1A1638'); gr.addColorStop(1, '#0B0A1E'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), basic({ map: domeTex, side: THREE.BackSide, fog: false, depthWrite: false })); dome.renderOrder = -2; sky.add(dome);
  const dotTex = canvasTex(32, 32, (c) => { const r = c.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, 32, 32); });
  const stars = [];
  [[1400, 3], [520, 4.6], [120, 7.5]].forEach(([n, size], li) => { const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random(), th = Math.random() * Math.PI * 2, y = .06 + Math.pow(u, .7) * .94, r = Math.sqrt(1 - y * y); pos.set([Math.cos(th) * r * 90, y * 90, Math.sin(th) * r * 90], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, map: dotTex, color: [0xDDE4FF, 0xFFF1C2, 0xFFFFFF][li], transparent: true, depthWrite: false, fog: false, toneMapped: false });
    const pts = new THREE.Points(geo, m); pts.renderOrder = -1; sky.add(pts); stars.push(m); });
  const moonTex = canvasTex(256, 256, (c) => { c.fillStyle = '#FFE7A8'; c.beginPath(); c.arc(128, 128, 100, 0, 7); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(170, 100, 92, 0, 7); c.fill(); });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, toneMapped: false, depthWrite: false })); moon.position.set(24, 50, -66); moon.scale.set(12, 12, 1); sky.add(moon);
  const moonGlow = glow(0xFFE2A0, 34, .32); moonGlow.material.fog = false; moonGlow.position.copy(moon.position); sky.add(moonGlow);
  const streakTex = canvasTex(256, 16, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = gr; c.fillRect(0, 6, w, 4); });
  const shoot = new THREE.Sprite(new THREE.SpriteMaterial({ map: streakTex, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, rotation: -.35 })); shoot.scale.set(16, 1, 1); sky.add(shoot);

  // --- the street outside the kitchen (world-fixed) ---
  const city = new THREE.Group(); g.add(city);
  const winTex = (seed, base) => canvasTex(256, 512, (c, W, H) => { c.fillStyle = base; c.fillRect(0, 0, W, H); let s = seed; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let y = 18; y < H - 12; y += 42) for (let x = 16; x < W - 24; x += 42) { const l = r(); c.fillStyle = l < .3 ? (r() < .8 ? 'rgba(255,205,120,.95)' : 'rgba(140,190,255,.9)') : 'rgba(8,10,36,.6)'; c.fillRect(x, y, 22, 26); } });
  const wt = [winTex(7, '#20235A'), winTex(31, '#2A2160'), winTex(77, '#191B48')];
  const building = (x, z, w, hgt, d, k) => { const t = wt[k % 3].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(hgt / 12)));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), basic({ map: t, color: [0xffffff, 0xd8d8ff, 0xc8c8f0][k % 3] })); m.position.set(x, hgt / 2, z); city.add(m); };
  let x = 12.3, k = 0; while (x < 70) { const w = 7 + (k * 37 % 6), hh = 12 + (k * 53 % 20); building(x + w / 2, 24 - 4 - (k % 3) * 1.2, w, hh, 8, k); x += w + .4; k++; }
  x = -12.3; while (x > -70) { const w = 7 + (k * 37 % 6), hh = 12 + (k * 53 % 20); building(x - w / 2, 24 - 4 - (k % 3) * 1.2, w, hh, 8, k); x -= w + .4; k++; }
  for (let i = 0; i < 9; i++) building(-80 + i * 20 + (i % 2) * 4, -30 - (i % 3) * 8, 14, 26 + (i * 41 % 26), 10, i + 1);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(200, 70), basic({ color: 0x14132A })); street.rotation.x = -Math.PI / 2; street.position.set(0, .02, 60); city.add(street);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(200, 5), basic({ color: 0x2A2750 })); walk.rotation.x = -Math.PI / 2; walk.position.set(0, .04, 26.6); city.add(walk);
  for (let i = -6; i <= 6; i++) { const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, .25), basic({ color: 0x4A4680 })); dash.rotation.x = -Math.PI / 2; dash.position.set(i * 9, .05, 38); city.add(dash); }
  for (const lx of [-15, 15]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 7, 8), basic({ color: 0x1A1A30 })); post.position.set(lx, 3.5, 28.4); city.add(post);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 8), basic({ color: 0xFFE2A8 })); head.position.set(lx, 7.1, 28.4); city.add(head);
    const hg = glow(0xFFC77A, 6, .55); hg.position.copy(head.position); city.add(hg);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), basic({ map: poolTex(), color: 0xFFB866, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.set(lx, .06, 28.6); city.add(pool); }
  let sc = null; if (scooters[0]) { sc = scooters[0].clone(true); sc.visible = true; sc.position.set(10.6, 0, 28.2); sc.rotation.y = -.5; city.add(sc); }

  // --- the kitchen's shop front at z = 24 (the camera flies through its window) ---
  const fz = 24, X = v => (v + 12) / 24, Y = v => (20 - v) / 20;
  const facadeTex = canvasTex(1536, 1280, (c, W, H) => {
    const px = v => X(v) * W, py = v => Y(v) * H;
    c.fillStyle = '#382A50'; c.fillRect(0, 0, W, H);
    const bw = 48, bh = 22; for (let r = 0; r * bh < H; r++) for (let cc = -1; cc * bw < W; cc++) { c.fillStyle = `hsl(${262 + Math.random() * 16},26%,${21 + Math.random() * 7}%)`; c.fillRect(cc * bw + (r % 2) * bw / 2 + 2, r * bh + 2, bw - 4, bh - 4); }
    const sh = c.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(6,6,28,.6)'); sh.addColorStop(.55, 'rgba(6,6,28,.12)'); sh.addColorStop(1, 'rgba(6,6,28,.3)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
    const sp = c.createRadialGradient(px(0), py(5.3), 40, px(0), py(5.3), W * .55); sp.addColorStop(0, 'rgba(255,170,80,.5)'); sp.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = sp; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1C1636'; c.fillRect(0, py(1), W, H - py(1));
    c.fillStyle = '#CDBFAE'; c.fillRect(0, py(11.4), W, 14);
    for (const wy of [16.8, 13.6]) for (const wx of [-9, -4.5, 0, 4.5, 9]) { const lit = Math.random() < .65, x0 = px(wx - 1.3), y0 = py(wy + 1.1), w = px(wx + 1.3) - x0, h = py(wy - 1.1) - y0;
      c.fillStyle = '#E2D4BE'; c.fillRect(x0 - 8, y0 - 8, w + 16, h + 16);
      const gr = c.createLinearGradient(0, y0, 0, y0 + h); if (lit) { gr.addColorStop(0, '#FFD98A'); gr.addColorStop(1, '#F09848'); } else { gr.addColorStop(0, '#2B2F66'); gr.addColorStop(1, '#17193F'); } c.fillStyle = gr; c.fillRect(x0, y0, w, h);
      c.fillStyle = '#E2D4BE'; c.fillRect(x0 + w / 2 - 4, y0, 8, h); c.fillRect(x0, y0 + h * .45, w, 6);
      if (lit && Math.random() < .5) for (let b = 0; b < 6; b++) { c.fillStyle = ['#F28DB2', '#FFD166', '#7FB8F0', '#8BC34A'][b % 4]; const bx = x0 + 8 + b * (w - 16) / 6; c.beginPath(); c.moveTo(bx, y0 + 10); c.lineTo(bx + (w - 16) / 6, y0 + 10); c.lineTo(bx + (w - 16) / 12, y0 + 34); c.fill(); } }
    c.fillStyle = '#14625A'; c.fillRect(px(9), py(4.4), px(11.3) - px(9), py(0) - py(4.4)); c.fillStyle = '#7FB8F0'; c.fillRect(px(9.4), py(4), px(10.9) - px(9.4), py(2.6) - py(4)); c.fillStyle = '#FFD166'; c.beginPath(); c.arc(px(10.9) - 14, py(2), 7, 0, 7); c.fill();
    c.fillStyle = '#22264E'; c.fillRect(px(-11.3), py(5.6), px(-9) - px(-11.3), py(1.7) - py(5.6)); c.textAlign = 'center'; c.fillStyle = '#FFD166'; c.font = '800 34px "Baloo 2", sans-serif'; c.fillText('MENU', px(-10.15), py(5.0));
    c.fillStyle = '#FFF1C2'; c.font = '700 21px Nunito, sans-serif'; ['Biryani', 'Paneer tikka', 'Gulab jamun', 'Fries', 'Raita', 'Cake slice'].forEach((t, i) => c.fillText(t, px(-10.15), py(4.5) + i * 27));
    c.clearRect(px(-8), py(9.2), px(8) - px(-8), py(1.4) - py(9.2));
  });
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(24, 20), basic({ map: facadeTex, alphaTest: .5 })); facade.position.set(0, 10, fz); g.add(facade);
  const cream = basic({ color: 0xE9DCC8 }), creamD = basic({ color: 0xB9AC98 });
  const bar = (w, hh, d, x, y, z, m = cream) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); b.position.set(x, y, z); g.add(b); return b; };
  bar(16.8, .32, .9, 0, 1.3, fz + .2); bar(16.8, .3, .6, 0, 9.3, fz + .15); for (const fx of [-8.1, 8.1]) bar(.32, 8.2, .7, fx, 5.3, fz + .15); for (const fx of [-2.7, 2.7]) bar(.16, 7.8, .3, fx, 5.3, fz + .05, creamD);
  const reflTex = canvasTex(512, 256, (c, w, h) => { for (const [x0, wd, a] of [[60, 70, .16], [190, 24, .1], [330, 110, .12]]) { const gr = c.createLinearGradient(x0, 0, x0 + wd, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(210,220,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.save(); c.transform(1, 0, -.4, 1, 0, 0); c.fillRect(x0, 0, wd, h); c.restore(); } });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(16, 7.8), basic({ map: reflTex, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })); glass.position.set(0, 5.3, fz + .02); g.add(glass);
  const stripes = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#FFF1DC' : '#E8503A'; c.fillRect(i * w / 16, 0, w / 16, h); } });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(17.6, .14, 2.6), basic({ map: stripes })); awning.position.set(0, 10.05, fz + 1.2); awning.rotation.x = .38; g.add(awning);
  const scallop = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#FFF1DC' : '#E8503A'; c.beginPath(); c.moveTo(i * w / 16, 0); c.lineTo((i + 1) * w / 16, 0); c.lineTo((i + 1) * w / 16, h * .4); c.arc((i + .5) * w / 16, h * .4, w / 32, 0, Math.PI); c.fill(); } });
  const val = new THREE.Mesh(new THREE.PlaneGeometry(17.6, .7), basic({ map: scallop, transparent: true })); val.position.set(0, 9.25, fz + 2.45); g.add(val);
  const sbulbs = []; for (let i = 0; i < 26; i++) { const t = i / 25, col = [C.gold, C.pink, C.sky, C.saffron][i % 4]; const b = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), basic({ color: col })); b.position.set(-8.6 + t * 17.2, 8.85 - Math.sin(t * Math.PI * 4) * .12, fz + 2.5); g.add(b); const gl = glow(col, .7, .8); b.add(gl); sbulbs.push(gl); }
  const signC = document.createElement('canvas'); signC.width = 1024; signC.height = 200; const sg = signC.getContext('2d'); const signTex2 = new THREE.CanvasTexture(signC); signTex2.colorSpace = THREE.SRGBColorSpace;
  const drawSign = on => { sg.clearRect(0, 0, 1024, 200); sg.fillStyle = '#120F26'; sg.beginPath(); sg.roundRect(8, 8, 1008, 184, 40); sg.fill(); sg.font = '800 112px "Baloo 2", Nunito, sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
    if (on) { sg.shadowColor = '#FF5FA2'; sg.shadowBlur = 34; sg.fillStyle = '#FFC1DA'; sg.fillText('MEHER’S KITCHEN', 512, 108); sg.shadowBlur = 12; sg.fillText('MEHER’S KITCHEN', 512, 108); } else { sg.fillStyle = '#3A2E48'; sg.fillText('MEHER’S KITCHEN', 512, 108); } signTex2.needsUpdate = true; };
  drawSign(false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.15), basic({ map: signTex2, transparent: true })); sign.position.set(0, 12.5, fz + .1); g.add(sign);
  const signGlow = glow(0xFF5FA2, 16, 0); signGlow.position.set(0, 12.5, fz + .4); signGlow.scale.set(18, 6, 1); g.add(signGlow);
  // inside the shop between the counter and the window (only seen during the fly-in)
  const inM = new THREE.MeshStandardMaterial({ color: 0x22265A, roughness: .8 });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), new THREE.MeshStandardMaterial({ color: 0x4A2F2A, roughness: .6 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, .005, 21.6); g.add(fl);
  for (const sx of [-15, 15]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(27.4, 12), inM); w.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; w.position.set(sx, 6, 10.4); g.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 27.4), inM); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 12, 10.4); g.add(ceil);
  intro = { g, sky, stars, shoot, glass, drawSign, signGlow, sbulbs, sc, t: 0 };
}
function introFrame(dt) {
  intro.t += dt; intro.sky.position.copy(cam.position);
  intro.stars.forEach((m, i) => { m.opacity = .65 + Math.sin(intro.t * (1.3 + i * .7) + i * 2) * .3; });
  intro.sbulbs.forEach((b, i) => { b.material.opacity = .55 + Math.sin(intro.t * 2.2 + i * 1.7) * .3; });
}
const CAM_SKY = { p: [0, 40, 95], t: [10, 100, -40], fov: 42 };
/* put the camera in the night sky (called before the "tap to start" gate, so the gate already shows stars) */
export function introBegin() {
  if (!intro) introBuild();
  intro.g.visible = true; scene.fog.near = 90; scene.fog.far = 260; cam.far = 400;
  cam.position.set(...CAM_SKY.p); camT.set(...CAM_SKY.t); cam.fov = CAM_SKY.fov; cam.updateProjectionMatrix();
  fw.pts.material.size = 2.6;
  lightsOn(false, 0); neon(false);
}
/* play the flight; hooks fire for captions and sound. Returns { done: Promise, skip() } */
export function introRun(hk = {}) {
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  const shot = (at, dur, p, t, fov, ease) => { tl.to(cam.position, { x: p[0], y: p[1], z: p[2], duration: dur, ease }, at); tl.to(camT, { x: t[0], y: t[1], z: t[2], duration: dur, ease }, at); if (fov) tl.to(cam, { fov, duration: dur, ease, onUpdate: () => cam.updateProjectionMatrix() }, at); };
  shot(0, 4.6, [0, 33, 88], [6, 72, -30], 40, 'sine.inOut');                       // drift under the stars
  tl.call(() => { gsap.fromTo(intro.shoot.position, { x: -38, y: 74, z: -58 }, { x: 12, y: 57, z: -70, duration: 1.1, ease: 'power1.in' }); gsap.fromTo(intro.shoot.material, { opacity: 0 }, { opacity: 1, duration: .25, yoyo: true, repeat: 1, repeatDelay: .6 }); }, null, 1.6);
  shot(4.6, 4.2, [0, 13, 58], [0, 8.5, 24], 34);                                   // tilt down over the city to the shop
  [[5.4, -22, 30, 0], [6.5, 20, 34, 1], [7.7, -6, 38, 4]].forEach(([at, x, y, hue]) => tl.call(() => { burstFirework(x, y, hue, -12, 3.2); hk.boom && hk.boom(); }, null, at));
  tl.call(() => { hk.neon && hk.neon(); let n = 0; const fl = () => { intro.drawSign(n % 2 === 0); n++; if (n < 5) setTimeout(fl, 90 + Math.random() * 120); else { intro.drawSign(true); gsap.to(intro.signGlow.material, { opacity: .55, duration: .4 }); } }; fl(); }, null, 6.0);
  shot(8.8, 3.4, [0, 6.2, 35], [0, 5.4, 8], 31);                                   // toward the glowing window
  tl.call(() => { lightsOn(true, .16); hk.lights && hk.lights(); }, null, 9.3);
  tl.to(intro.glass.material, { opacity: 0, duration: 2.2 }, 10.2);
  shot(12.2, 2.3, [0, 5.4, 22.5], [0, 3.5, 0], 30, 'power2.out');                  // through the glass, into the kitchen
  tl.call(() => hk.whoosh && hk.whoosh(), null, 12.3);
  Object.entries(hk.captions || {}).forEach(([at, fn]) => tl.call(fn, null, +at));
  let resolve; const done = new Promise(r => resolve = r);
  tl.call(() => { introEnd(); resolve(); }, null, 14.6);
  return { done, skip() { tl.kill(); gsap.killTweensOf(cam.position); gsap.killTweensOf(camT); gsap.killTweensOf(cam); lightsOn(true, 0); introEnd(); setCam('wide', 0); resolve(); } };
}
function introEnd() {
  if (!intro) return;
  scene.fog.near = 30; scene.fog.far = 60; cam.far = 120; cam.fov = 30; cam.updateProjectionMatrix(); fw.pts.material.size = .32;
  const g = intro.g; scene.remove(g); if (intro.sc) intro.sc.removeFromParent();   // the scooter clone shares the game's meshes
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.map !== glowTex && m.map !== _pool) m.map.dispose(); m.dispose(); }); } });
  intro = null;
}

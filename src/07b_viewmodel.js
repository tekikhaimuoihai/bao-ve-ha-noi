/* ===== first-person weapons: CC0 gun models (Quaternius, Kenney), gloved hands, reload animations,
   ejected casings and muzzle smoke ===== */
const b64ToBuf = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
const GUN_MATS = {};
// restyle the flat-coloured source materials into PBR metals, polymers and lacquer
const MAT_STYLE = {
  Black: [0x26272b, 0.5, 0.45], Black2: [0x1a1b1e, 0.45, 0.5], DarkMetal: [0x4a4e55, 0.85, 0.34], Metal: [0x5a5f68, 0.88, 0.34], LightMetal: [0x70757d, 0.85, 0.4], Grey: [0x4a4d53, 0.5, 0.45],
  Main: [0x3a3f47, 0.55, 0.42], MainDark: [0x24272d, 0.5, 0.5], MainLight: [0x5a6068, 0.75, 0.32],
  Wood: [0x6e4527, 0.0, 0.6], DarkWood: [0x4b2c18, 0.0, 0.64],
  // firework launcher: red lacquer and gold, Mid-Autumn style
  dark: [0x231d1b, 0.5, 0.45], gold: [0xd9a93a, 0.95, 0.26], green: [0xa8201c, 0.25, 0.32], grey: [0x8e1916, 0.25, 0.36], greyLight: [0xeedfb6, 0.2, 0.45], greyDark: [0x3a2e2c, 0.4, 0.5], _defaultMat: [0xf2d27a, 0.7, 0.3], wood: [0x7a4a26, 0, 0.6],
};
function gunMat(name, color) {
  if (GUN_MATS[name]) return GUN_MATS[name];
  const st = MAT_STYLE[name];
  const m = new THREE.MeshStandardMaterial(st ? { color: st[0], metalness: st[1], roughness: st[2] } : { color: new THREE.Color(color[0], color[1], color[2]), roughness: 0.5 });
  m.envMapIntensity = 1.4; return GUN_MATS[name] = m;
}
// decode one embedded model; optionally split triangles into named parts by their centroid
function buildModelParts(name, split) {
  const parts = {};
  for (const p of GUN_MODELS[name]) {
    const pos = new Float32Array(b64ToBuf(p.pos)), nrm = new Int8Array(b64ToBuf(p.nrm)), idx = new Uint16Array(b64ToBuf(p.idx));
    const buckets = {};
    for (let t = 0; t < idx.length; t += 3) {
      let key = 'main';
      if (split) { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3; key = split((pos[a] + pos[b] + pos[c]) / 3, (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3) || 'main'; }
      (buckets[key] || (buckets[key] = [])).push(idx[t], idx[t + 1], idx[t + 2]);
    }
    for (const key in buckets) {
      const ix = buckets[key], P = new Float32Array(ix.length * 3), N = new Float32Array(ix.length * 3);
      for (let i = 0; i < ix.length; i++) { const v = ix[i] * 3; P[i * 3] = pos[v]; P[i * 3 + 1] = pos[v + 1]; P[i * 3 + 2] = pos[v + 2]; N[i * 3] = nrm[v] / 127; N[i * 3 + 1] = nrm[v + 1] / 127; N[i * 3 + 2] = nrm[v + 2] / 127; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.computeBoundingSphere();
      (parts[key] || (parts[key] = new THREE.Group())).add(new THREE.Mesh(g, gunMat(p.mat, p.color)));
    }
  }
  return parts;
}

// model-space anchors (source units; Quaternius guns point along +X, Kenney's along -Z)
const VM_DEF = {
  pistol: { model: 'Pistol_4', s: 0.105, rot: Math.PI / 2, split: (x, y) => y > 0.57 ? 'slide' : null, grip: [0.1, 0.05, 0], fore: null, muzzle: [1.62, 0.86, 0], eject: [0.7, 1.0, 0], sight: 1.08, hip: [0.135, -0.16, -0.31], adsZ: -0.3, casing: 'pistol' },
  shotgun: { model: 'Shotgun_1', s: 0.19, rot: Math.PI / 2, split: (x, y) => (x > 1.65 && x < 2.8 && y < 0.07) ? 'pump' : null, grip: [-0.05, -0.12, 0], fore: [2.2, -0.08, 0], muzzle: [3.8, 0.3, 0], eject: [0.75, 0.25, 0], sight: 0.42, hip: [0.16, -0.17, -0.34], adsZ: -0.3, casing: 'shell' },
  rifle: { model: 'AssaultRifle2_1', s: 0.165, rot: Math.PI / 2, split: (x, y) => (x > 0.58 && x < 1.25 && y < 0.28) ? 'mag' : null, grip: [-0.13, 0.02, 0], fore: [1.75, 0.42, 0], muzzle: [3.6, 0.55, 0], eject: [0.7, 0.62, 0], sight: 0.94, redDot: [0.08, 0.94, 0], hip: [0.15, -0.17, -0.36], adsZ: -0.27, casing: 'rifle' },
  launcher: { model: 'k_rocketlauncherModern', s: 0.62, rot: 0, split: (x, y, z) => (z < -0.3 && y > 0.16) ? 'rocket' : null, grip: [0, 0.02, 0.05], fore: [0, 0.03, -0.22], muzzle: [0, 0.2, -0.42], eject: null, sight: 0.38, hip: [0.19, -0.2, -0.3], adsX: 0.1, adsZ: -0.26, casing: null },
};

// a pickup / display copy of a gun (no hands), roughly real size
function buildGunModel(id) {
  const d = VM_DEF[id], parts = buildModelParts(d.model, null), inner = new THREE.Group();
  for (const k in parts) inner.add(parts[k]);
  inner.scale.setScalar(d.s); inner.rotation.y = d.rot;
  const g = new THREE.Group(); g.add(inner); g.userData.muzzle = new THREE.Object3D(); return g;
}

function makeArm(side) {
  // side: 1 = right hand (grip), -1 = left hand (support). The hand sits at the group origin.
  const g = new THREE.Group();
  const glove = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, roughness: 0.78 }), pad = new THREE.MeshStandardMaterial({ color: 0x45403a, roughness: 0.65 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x46503e, roughness: 0.95 }), cuffM = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.85 });
  const ball = new THREE.SphereGeometry(1, 14, 10), fingerG = new THREE.CapsuleGeometry(0.0105, 0.04, 4, 8);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const limb = (a, b, r0, r1, mat) => { const A = V3().set(...a), B = V3().set(...b), len = A.distanceTo(B); const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 12), mat); m.position.addVectors(A, B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V3().set(0, 1, 0), B.sub(A).normalize()); g.add(m); return m; };
  if (side > 0) {
    // palm on the right of a vertical grip, fingers wrapping its front, thumb over the top-left
    add(ball, glove, 0.022, -0.005, 0.01, 0, 0, 0, 0.022, 0.05, 0.042);
    add(ball, pad, 0.03, 0.0, 0.0, 0, 0, 0, 0.012, 0.035, 0.03);
    for (let i = 0; i < 4; i++) add(fingerG, glove, -0.002, 0.028 - i * 0.02, -0.036, 0, 0.2, Math.PI / 2, 1, 0.92 - i * 0.08, 1);
    add(fingerG, glove, -0.018, 0.042, -0.004, 0.5, 0, Math.PI / 2 - 0.2, 1.05, 1.05, 1.05);
    limb([0.03, -0.035, 0.035], [0.075, -0.09, 0.1], 0.034, 0.03, cuffM);
    limb([0.07, -0.08, 0.09], [0.15, -0.3, 0.42], 0.06, 0.042, sleeve);
  } else {
    // palm under a horizontal handguard, fingers curling up its right side, thumb on the left
    add(ball, glove, 0, -0.03, 0.005, 0, 0, 0, 0.04, 0.02, 0.05);
    for (let i = 0; i < 4; i++) add(fingerG, glove, 0.03, -0.008, -0.03 + i * 0.02, 0, 0, 0.35, 1, 0.92 - i * 0.06, 1);
    add(fingerG, glove, -0.032, -0.012, -0.012, 0.25, 0, -0.35, 1.1, 1.1, 1.1);
    limb([-0.01, -0.045, 0.03], [-0.04, -0.09, 0.09], 0.034, 0.03, cuffM);
    limb([-0.035, -0.085, 0.08], [-0.3, -0.26, 0.4], 0.062, 0.042, sleeve);
  }
  g.traverse(o => { if (o.isMesh) o.material.envMapIntensity = 0.5; });
  return g;
}

// a small studio-like environment (cool night sky above, soft key light, warm lantern bounce) so metal parts reflect something
function makeGunEnv(renderer) {
  const sc = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.07,0.07,0.08), vec3(0.14,0.16,0.24), smoothstep(-0.3, 0.6, h)); c += vec3(0.35,0.3,0.28) * exp(-abs(h) * 6.0) * 0.5; gl_FragColor = vec4(c, 1.0); }' }));
  sc.add(sky);
  const panel = (w, h, col, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
  panel(6, 2, new THREE.Color(1.7, 1.7, 1.75), 0, 7, 2);
  panel(3, 3, new THREE.Color(1.4, 0.8, 0.4), -7, 1, -3);
  panel(2, 4, new THREE.Color(1.0, 0.35, 0.25), 7, 0.5, 2);
  panel(5, 1, new THREE.Color(0.9, 1.1, 1.8), 0, 2, -8);
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(sc, 0.03); pm.dispose();
  return rt.texture;
}

/* casings ejected into the world */
const CASINGS = [];
function makeCasings(scene) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xd8a84a, metalness: 0.95, roughness: 0.25 });
  const shellM = new THREE.MeshStandardMaterial({ color: 0xb3221c, roughness: 0.45 });
  const geos = { pistol: new THREE.CylinderGeometry(0.0045, 0.0045, 0.019, 8), rifle: new THREE.CylinderGeometry(0.0045, 0.006, 0.045, 8), shell: new THREE.CylinderGeometry(0.0105, 0.0105, 0.06, 10) };
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(geos.pistol, brass); m.visible = false; scene.add(m);
    CASINGS.push({ m, vel: V3(), spin: V3(), life: 0, bounced: 0, geos, brass, shellM });
  }
}
let casingNext = 0;
function ejectCasing(kind, p, vel) {
  const c = CASINGS[casingNext]; casingNext = (casingNext + 1) % CASINGS.length;
  c.m.geometry = c.geos[kind]; c.m.material = kind === 'shell' ? c.shellM : c.brass;
  c.m.position.copy(p); c.vel.copy(vel); c.spin.set(rand(-20, 20), rand(-20, 20), rand(-20, 20)); c.life = 4; c.bounced = 0; c.m.visible = true; c.kind = kind;
}
function updateCasings(dt) {
  for (const c of CASINGS) {
    if (!c.m.visible) continue;
    c.life -= dt; if (c.life <= 0) { c.m.visible = false; continue; }
    if (c.bounced < 4) {
      c.vel.y -= 9.8 * dt; c.m.position.addScaledVector(c.vel, dt);
      c.m.rotation.x += c.spin.x * dt; c.m.rotation.y += c.spin.y * dt; c.m.rotation.z += c.spin.z * dt;
      const floor = 0.02;
      if (c.m.position.y < floor) {
        c.m.position.y = floor; c.vel.y = -c.vel.y * 0.35; c.vel.x *= 0.5; c.vel.z *= 0.5; c.spin.multiplyScalar(0.5); c.bounced++;
        if (c.bounced === 1) SND.casing(c.m.position, c.kind === 'shell');
        if (c.bounced >= 4) { c.m.rotation.set(Math.PI / 2, c.m.rotation.y, 0); }
      }
      if (blockedAt(c.m.position.x, c.m.position.z)) { c.vel.x *= -0.4; c.vel.z *= -0.4; }
    }
  }
}

/* muzzle flash texture: a burst star */
function flashTex() {
  const c = mkCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,230,180,.9)'); gr.addColorStop(0.5, 'rgba(255,150,60,.25)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) { g.save(); g.translate(64, 64); g.rotate(i / 7 * TAU + Math.random() * 0.4); const l = 40 + Math.random() * 22; const sg = g.createLinearGradient(0, 0, l, 0); sg.addColorStop(0, 'rgba(255,220,150,.9)'); sg.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = sg; g.beginPath(); g.moveTo(0, -5); g.lineTo(l, 0); g.lineTo(0, 5); g.fill(); g.restore(); }
  return toTex(c, false);
}

class Viewmodel {
  constructor(root) {
    this.root = root; this.vms = {};
    const ftex = flashTex();
    for (const id of W_ORDER) {
      const d = VM_DEF[id], parts = buildModelParts(d.model, d.split);
      const gun = new THREE.Group(), inner = new THREE.Group(); gun.add(inner);
      for (const k in parts) inner.add(parts[k]);
      inner.scale.setScalar(d.s); inner.rotation.y = d.rot;
      // place the grip at the gun origin
      const gp = new THREE.Vector3(...d.grip).multiplyScalar(d.s).applyAxisAngle(new THREE.Vector3(0, 1, 0), d.rot);
      inner.position.copy(gp).negate();
      const anchor = (p) => { const o = new THREE.Object3D(); o.position.set(...p); inner.add(o); return o; };
      const vm = { id, d, gun, inner, parts, muzzle: anchor(d.muzzle), eject: d.eject ? anchor(d.eject) : null, foreA: d.fore ? anchor(d.fore) : null };
      vm.adsY = -(d.sight - d.grip[1]) * d.s;
      // hands
      vm.right = makeArm(1); gun.add(vm.right);
      vm.left = makeArm(-1); gun.add(vm.left);
      if (id === 'pistol') { vm.left.rotation.set(0.1, 0, 0.5); }
      // red-dot sight glass on the rifle
      if (d.redDot) {
        const dotTex = simpleTex(64, 64, (g2) => { g2.clearRect(0, 0, 64, 64); const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 8); gr.addColorStop(0, 'rgba(255,80,60,1)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64); }, false);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(3, 1, 0.8) }));
        glass.position.set(d.redDot[0], d.redDot[1], 0); glass.rotation.y = -Math.PI / 2; inner.add(glass); vm.dot = glass;
      }
      // spare props used by reload animations
      if (id === 'pistol') { const mg = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.07, 0.03), gunMat('Black', [0, 0, 0])); mg.visible = false; gun.add(mg); vm.spareMag = mg; }
      if (id === 'shotgun') { const sh = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0xb3221c, roughness: 0.45 })); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.014, 10), new THREE.MeshStandardMaterial({ color: 0xd8a84a, metalness: 0.9, roughness: 0.3 })); base.position.y = -0.03; sh.add(body, base); sh.visible = false; gun.add(sh); vm.spareShell = sh; }
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, color: new THREE.Color(5, 3.2, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      fl.visible = false; this.root.parent.add(fl); vm.flash = fl;
      gun.visible = false; root.add(gun); this.vms[id] = vm;
    }
    this.kick = 0; this.slide = 0; this.pump = 0; this.flashT = 0; this.cur = null; this.smokeT = 0;
  }
  show(id) { for (const k in this.vms) this.vms[k].gun.visible = k === id; this.cur = id; }
  // camera-space point of an anchor, corrected for the viewmodel's narrower FOV
  camPoint(obj, out) {
    obj.updateWorldMatrix(true, false); obj.getWorldPosition(out);
    const k = Math.tan(THREE.MathUtils.degToRad(S.camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(vmCam.fov / 2));
    out.x *= k; out.y *= k; return out;
  }
  worldPoint(obj, out) { this.camPoint(obj, out); return S.camera.localToWorld(out); }
  muzzleWorld() { return this.worldPoint(this.vms[this.cur].muzzle, V3()); }
  onFire(P) {
    const vm = this.vms[P.cur], d = vm.d;
    this.kick = 1; this.flashT = 0.055; vm.flash.material.rotation = Math.random() * TAU;
    if (P.cur === 'pistol') this.slide = 1;
    const mw = this.muzzleWorld();
    for (let i = 0; i < (P.cur === 'shotgun' ? 6 : 2); i++) SMOKE.emit(mw.x, mw.y, mw.z, rand(-0.3, 0.3), rand(0.2, 0.8), rand(-0.3, 0.3), rand(0.8, 1.6), 0.08, 0.6, 0.55, 0.53, 0.52, -0.25, 1.5, 0.35);
    this.smokeT = Math.min(2.5, this.smokeT + (P.cur === 'rifle' ? 0.12 : 0.4));
    if (P.cur === 'shotgun') { P.pumpT = 0.5; later(0.2, () => { SND.pump(); this.eject('shell', P); }); }
    else if (d.casing) this.eject(d.casing, P);
  }
  eject(kind, P) {
    const vm = this.vms[P.cur]; if (!vm.eject) return;
    const p = this.worldPoint(vm.eject, V3());
    const right = V3().set(1, 0, 0).applyQuaternion(S.camera.quaternion), up = V3().set(0, 1, 0).applyQuaternion(S.camera.quaternion), back = V3().set(0, 0, 1).applyQuaternion(S.camera.quaternion);
    const v = right.multiplyScalar(rand(1.8, 2.6)).addScaledVector(up, rand(1.2, 2)).addScaledVector(back, rand(0.1, 0.6)).add(V3().set(P.vel.x, 0, P.vel.z));
    ejectCasing(kind, p, v);
  }
  update(dt, P, bobX, bobY) {
    const id = P.cur, vm = this.vms[id], d = vm.d; if (!vm.gun.visible) this.show(id);
    const a = P.aim, sw = P.swapT > 0 ? P.swapT / 0.35 : 0, onG = P.onGround ? 1 : 0.3;
    this.kick = Math.max(0, this.kick - dt * 9); this.slide = Math.max(0, this.slide - dt * 14);
    const run = (P.sprintAmt || 0);
    const reloading = P.reloadT > 0, t = reloading ? clamp(1 - P.reloadT / P.reloadDur, 0, 1) : 0;
    const bell = (t0, t1, x) => x <= t0 || x >= t1 ? 0 : Math.sin((x - t0) / (t1 - t0) * Math.PI);
    const ramp = (t0, t1, x) => clamp((x - t0) / (t1 - t0), 0, 1);
    const ease = x => x * x * (3 - 2 * x);
    // base pose
    let px = lerp(d.hip[0], d.adsX || 0, a), py = lerp(d.hip[1], vm.adsY, a), pz = lerp(d.hip[2], d.adsZ, a);
    let rx = 0, ry = 0, rz = 0;
    px += bobX * 0.5 * (1 - a * 0.85) - P.sway.x; py += bobY * 0.35 * onG * (1 - a * 0.85) + P.sway.y;
    pz += this.kick * (id === 'shotgun' ? 0.09 : id === 'launcher' ? 0.07 : 0.045); rx += this.kick * (id === 'shotgun' ? 0.2 : 0.08);
    // sprint: tilt the gun down and inwards
    px -= run * 0.04; py -= run * 0.05; rx -= run * 0.35; ry += run * 0.6; rz += run * 0.25;
    // switching
    py -= sw * 0.35; rx -= sw * 0.9;
    // left hand default: on the fore anchor
    let lh = vm.foreA ? this.camLocal(vm.foreA, vm.gun) : null;
    const magOff = V3(); let rocketOff = 0, pumpOff = 0, slideOff = this.slide;
    if (vm.spareMag) vm.spareMag.visible = false; if (vm.spareShell) vm.spareShell.visible = false;
    if (reloading) {
      if (id === 'rifle') {
        const tilt = bell(0.02, 0.98, t); rz += tilt * 0.55; ry += tilt * 0.25; px -= tilt * 0.03; py += tilt * 0.02; rx += tilt * 0.12;
        // mag out (falls), new mag up, seat, charging handle
        const out = ramp(0.12, 0.3, t), inn = ramp(0.42, 0.62, t);
        if (t < 0.42) magOff.set(0, -out * out * 4.5, out * 0.4); else magOff.set(0, -(1 - ease(inn)) * 3.2, 0);
        if (t > 0.62 && t < 0.68) magOff.y += Math.sin((t - 0.62) / 0.06 * Math.PI) * 0.12;
        const bolt = bell(0.76, 0.9, t); pz += bolt * 0.03; rx += bolt * 0.05;
        const lhMag = t > 0.3 && t < 0.7;
        if (lhMag && vm.parts.mag) { vm.parts.mag.position.copy(magOff); lh = this.camLocal(vm.parts.mag, vm.gun, V3().set(0.9, -0.6, 0.0)); }
        else if (t >= 0.7 && t < 0.82 && lh) { const k = ease(ramp(0.7, 0.82, t)); const mp = this.camLocal(vm.parts.mag, vm.gun, V3().set(0.9, -0.4, 0)); lh.lerpVectors(mp, lh, k); }
      } else if (id === 'pistol') {
        const tilt = bell(0.02, 0.98, t); rz += tilt * 0.4; rx += tilt * 0.25; py += tilt * 0.03;
        slideOff = Math.max(slideOff, t < 0.78 ? (P.ammo.pistol.mag === 0 ? 1 : 0) : 0);
        const m = vm.spareMag; const up = ease(ramp(0.3, 0.55, t)); m.visible = t > 0.25 && t < 0.62;
        m.position.set(0.01, lerp(-0.25, -0.06, up), 0.0); m.rotation.z = -0.2;
        lh = V3().set(m.position.x - 0.01, m.position.y - 0.03, m.position.z + 0.02);
        if (t > 0.78) slideOff = Math.max(slideOff, bell(0.78, 0.86, t) * 0.4);
      } else if (id === 'shotgun') {
        // one shell per cycle: hand dips to the loading port and pushes a shell in
        const tilt = 1; rz += 0.35 * tilt; ry += 0.15; py += 0.02;
        const port = this.camLocal(vm.eject, vm.gun, V3().set(0.2, -0.45, 0));
        const s = vm.spareShell; const c = t; const push = bell(0.25, 0.95, c);
        s.visible = c > 0.1 && c < 0.8; s.position.copy(port).add(V3().set(0, -0.05 * (1 - push), 0.02)); s.rotation.set(Math.PI / 2 - 0.3, 0, 0);
        lh = V3().copy(s.position).add(V3().set(-0.005, -0.03, 0.03));
      } else if (id === 'launcher') {
        const low = bell(0.02, 0.98, t); py -= low * 0.06; rx += low * 0.3; rz -= low * 0.15;
        const inn = ease(ramp(0.25, 0.7, t)); rocketOff = t < 0.25 ? -6 : -(1 - inn) * 0.5;
        if (vm.parts.rocket) { vm.parts.rocket.position.set(0, 0, rocketOff * -1 * 0.6); vm.parts.rocket.visible = t > 0.25 || P.ammo.launcher.mag > 0; }
        if (t > 0.2 && t < 0.75) lh = this.camLocal(vm.parts.rocket, vm.gun, V3().set(0, 0.2, -0.33));
        const lock = bell(0.78, 0.92, t); pz += lock * 0.02;
      }
    } else {
      if (vm.parts.mag) vm.parts.mag.position.set(0, 0, 0);
      if (vm.parts.rocket) { vm.parts.rocket.position.set(0, 0, 0); vm.parts.rocket.visible = P.ammo.launcher.mag > 0; }
    }
    // shotgun pump action after each shot
    if (id === 'shotgun') {
      if (P.pumpT > 0) { P.pumpT -= dt; const k = clamp(1 - P.pumpT / 0.5, 0, 1); pumpOff = bell(0.25, 0.85, k); }
      if (vm.parts.pump) vm.parts.pump.position.set(-pumpOff * 0.9, 0, 0);
      if (lh && !reloading) lh.z += pumpOff * 0.9 * d.s;
    }
    if (vm.parts.slide) vm.parts.slide.position.set(-slideOff * 0.3, 0, 0);
    vm.gun.position.set(px, py, pz); vm.gun.rotation.set(rx, ry, rz);
    // hands
    if (id === 'pistol') { vm.left.visible = true; const base = V3().set(-0.035, -0.035, 0.005); vm.left.position.copy(reloading && lh ? lh : base); vm.left.rotation.set(0.3, 0.2, -0.9); }
    else if (lh) { vm.left.visible = true; vm.left.position.copy(lh); vm.left.rotation.set(0, 0, 0); }
    vm.right.position.set(0, 0, 0);
    // flash and lingering barrel smoke
    this.flashT -= dt; const fl = vm.flash;
    if (this.flashT > 0) { fl.visible = true; vm.gun.updateMatrixWorld(true); vm.muzzle.getWorldPosition(fl.position); fl.scale.setScalar((id === 'shotgun' ? 0.34 : id === 'launcher' ? 0.4 : 0.22) * rand(0.8, 1.2)); } else fl.visible = false;
    this.smokeT = Math.max(0, this.smokeT - dt);
    if (this.smokeT > 0.6 && Math.random() < dt * 14) { const mw = this.muzzleWorld(); SMOKE.emit(mw.x, mw.y, mw.z, rand(-0.05, 0.05), rand(0.3, 0.6), rand(-0.05, 0.05), 1.6, 0.04, 0.35, 0.6, 0.58, 0.56, -0.15, 0.5, 0.22); }
    if (vm.dot) { vm.dot.visible = a > 0.4; vm.dot.material.opacity = ramp(0.4, 0.9, a); }
  }
  // position of obj (plus an optional model-space offset) expressed in the gun group's local space
  camLocal(obj, gun, off) {
    const p = V3(); if (off) p.copy(off); obj.updateWorldMatrix(true, false); obj.localToWorld(p); gun.updateWorldMatrix(true, false); return gun.worldToLocal(p);
  }
}
let VIEW = null;

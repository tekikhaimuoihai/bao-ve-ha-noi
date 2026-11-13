/* ===== shared game state ===== */
const S = {
  scene: null, camera: null, enemies: [], eshots: [], rockets: [], pickups: [], portals: [], boss: null,
  player: null, diff: null, time: 0, score: 0, kills: 0, shots: 0, hits: 0, phase: 0, running: false,
};
const V3 = () => new THREE.Vector3();
const _v = V3(), _v2 = V3(), _v3 = V3();

/* ===== particles ===== */
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.ml = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.a0 = new Float32Array(max); this.next = 0;
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setAttribute('size', this.aSize); g.setAttribute('alpha', this.aAlpha);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale; void main(){ vC=color; vA=alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*uScale/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5,0.0,length(d)); if(vA*a<0.003) discard; gl_FragColor = vec4(vC, a*vA); }'
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, grav = 0, drag = 0, a0 = 1) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.life[i] = life; this.ml[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.grav[i] = grav; this.drag[i] = drag; this.a0[i] = a0;
  }
  burst(p, n, speed, life, s0, s1, col, grav = 0, drag = 2, spread = 1, up = 0) {
    for (let i = 0; i < n; i++) {
      const th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.3 + Math.random() * 0.7);
      const c = Array.isArray(col[0]) ? pick(col) : col;
      this.emit(p.x, p.y, p.z, Math.sin(ph) * Math.cos(th) * sp * spread, Math.cos(ph) * sp + up, Math.sin(ph) * Math.sin(th) * sp * spread, life * (0.6 + Math.random() * 0.6), s0, s1, c[0], c[1], c[2], grav, drag);
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      this.life[i] -= dt; const t = 1 - Math.max(0, this.life[i]) / this.ml[i];
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; }
      this.size[i] = lerp(this.s0[i], this.s1[i], t); this.alpha[i] = this.a0[i] * (1 - t) * Math.min(1, t * 8 + 0.3);
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}
let FX = null, SMOKE = null;
const COL = { purple: [1.6, 0.4, 2.6], pink: [2.6, 0.6, 1.6], dark: [0.08, 0.03, 0.1], spark: [3, 2.2, 1], fire: [3, 1.2, 0.3], wisp: [0.6, 2.6, 1.8], white: [3, 3, 3] };
const FIREWORK = [[3, 0.6, 0.5], [3, 2.4, 0.5], [0.6, 2.8, 1.2], [0.6, 1.4, 3], [2.8, 0.7, 2.6], [3, 3, 2.5]];

/* ===== monster models (simple primitives, moderate violence: they dissolve into smoke) ===== */
const MGEO = {
  sph: new THREE.SphereGeometry(1, 16, 12), cone: new THREE.ConeGeometry(1, 1, 8), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  horn: (() => { const g = new THREE.TorusGeometry(0.45, 0.07, 6, 12, Math.PI * 0.7); return g; })(),
};
function mk(geo, mat, x, y, z, sx, sy, sz, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz == null ? sx : sz); m.castShadow = true; if (parent) parent.add(m); return m; }
function eyeMat(r, g, b) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) }); }
function skinMat(color, emissive) { return new THREE.MeshStandardMaterial({ color, map: TEX.skin, roughness: 0.7, emissive: emissive || 0x000000, emissiveIntensity: 1 }); }

function makeImp() {
  const g = new THREE.Group(), body = skinMat(0x6a3a7a, 0x150520), dark = new THREE.MeshStandardMaterial({ color: 0x1a0d1f, roughness: 0.6 });
  const torso = mk(MGEO.sph, body, 0, 0.7, 0, 0.45, 0.42, 0.5, g);
  mk(MGEO.cone, dark, -0.18, 1.08, 0.05, 0.07, 0.35, 0.07, g).rotation.z = 0.4;
  mk(MGEO.cone, dark, 0.18, 1.08, 0.05, 0.07, 0.35, 0.07, g).rotation.z = -0.4;
  const em = eyeMat(3, 2.4, 0.4); mk(MGEO.sph, em, -0.15, 0.82, 0.4, 0.07, 0.07, 0.05, g); mk(MGEO.sph, em, 0.15, 0.82, 0.4, 0.07, 0.07, 0.05, g);
  const mouth = mk(MGEO.box, dark, 0, 0.6, 0.42, 0.3, 0.06, 0.06, g);
  const legs = [];
  [[-0.25, 0.2], [0.25, 0.2], [-0.25, -0.2], [0.25, -0.2]].forEach(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 0.45, z); g.add(p); mk(MGEO.cyl, dark, 0, -0.22, 0, 0.06, 0.45, 0.06, p); legs.push(p); });
  const arms = [];
  [-1, 1].forEach(s => { const p = new THREE.Group(); p.position.set(s * 0.42, 0.75, 0.1); g.add(p); mk(MGEO.cyl, dark, 0, -0.18, 0.12, 0.05, 0.4, 0.05, p).rotation.x = 0.8; mk(MGEO.cone, dark, 0, -0.3, 0.32, 0.06, 0.18, 0.06, p).rotation.x = 1.8; arms.push(p); });
  return { g, mats: [body], legs, arms, torso, mouth };
}
function makeBrute() {
  const g = new THREE.Group(), body = skinMat(0x7a2e22, 0x200500), dark = new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: 0.7 }), bone = new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 0.5 });
  const torso = mk(MGEO.box, body, 0, 1.6, 0, 1.3, 1.25, 0.85, g);
  mk(MGEO.box, body, 0, 2.2, 0.05, 1.5, 0.4, 0.9, g);
  const head = new THREE.Group(); head.position.set(0, 2.55, 0.15); g.add(head);
  mk(MGEO.box, body, 0, 0, 0, 0.62, 0.55, 0.7, head); mk(MGEO.box, dark, 0, -0.12, 0.38, 0.45, 0.3, 0.2, head);
  const hl = mk(MGEO.horn, bone, -0.45, 0.2, 0, 1, 1, 1, head); hl.rotation.set(0, Math.PI / 2, Math.PI * 0.15);
  const hr = mk(MGEO.horn, bone, 0.45, 0.2, 0, 1, 1, 1, head); hr.rotation.set(0, -Math.PI / 2, -Math.PI * 0.15); hr.scale.x = -1;
  const em = eyeMat(3, 0.4, 0.2); mk(MGEO.sph, em, -0.17, 0.08, 0.36, 0.07, 0.06, 0.04, head); mk(MGEO.sph, em, 0.17, 0.08, 0.36, 0.07, 0.06, 0.04, head);
  mk(MGEO.cyl, new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.3 }), 0, -0.15, 0.5, 0.08, 0.04, 0.08, head).rotation.x = Math.PI / 2;
  const arms = [], legs = [];
  [-1, 1].forEach(s => { const p = new THREE.Group(); p.position.set(s * 0.85, 2.05, 0); g.add(p); mk(MGEO.box, body, 0, -0.55, 0, 0.38, 1.1, 0.4, p); mk(MGEO.box, dark, 0, -1.2, 0.05, 0.5, 0.4, 0.5, p); arms.push(p); });
  [-1, 1].forEach(s => { const p = new THREE.Group(); p.position.set(s * 0.38, 1.0, 0); g.add(p); mk(MGEO.box, dark, 0, -0.5, 0, 0.42, 1.0, 0.45, p); legs.push(p); });
  return { g, mats: [body], legs, arms, torso, head };
}
function makeWisp() {
  const g = new THREE.Group();
  const coreM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 1.6) });
  const core = mk(MGEO.sph, coreM, 0, 0, 0, 0.32, 0.32, 0.32, g); core.castShadow = false;
  const shell = new THREE.Mesh(MGEO.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 0.7), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  shell.scale.setScalar(0.55); g.add(shell);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(0.4, 1.6, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(1.7, 1.7, 1); g.add(halo);
  const dark = new THREE.MeshBasicMaterial({ color: 0x02100a });
  mk(MGEO.sph, dark, -0.12, 0.06, 0.28, 0.06, 0.09, 0.03, g).castShadow = false; mk(MGEO.sph, dark, 0.12, 0.06, 0.28, 0.06, 0.09, 0.03, g).castShadow = false;
  return { g, mats: [coreM], core, shell, halo, basic: true };
}
function makeBomber() {
  const g = new THREE.Group(), body = skinMat(0x3a2418, 0xff5a10), dark = new THREE.MeshStandardMaterial({ color: 0x1a0f0a });
  body.emissiveIntensity = 0.25;
  const torso = mk(MGEO.sph, body, 0, 0.75, 0, 0.6, 0.55, 0.6, g);
  const em = eyeMat(3, 2.6, 0.6); mk(MGEO.sph, em, -0.18, 0.92, 0.5, 0.08, 0.05, 0.04, g); mk(MGEO.sph, em, 0.18, 0.92, 0.5, 0.08, 0.05, 0.04, g);
  mk(MGEO.box, dark, 0, 0.7, 0.55, 0.36, 0.05, 0.05, g);
  const fuse = mk(MGEO.cyl, new THREE.MeshStandardMaterial({ color: 0xc62828 }), 0, 1.38, 0, 0.06, 0.25, 0.06, g);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(3, 2, 0.6), blending: THREE.AdditiveBlending, depthWrite: false })); spark.position.set(0, 1.56, 0); spark.scale.set(0.5, 0.5, 1); g.add(spark);
  const legs = [];
  [-1, 1].forEach(s => { const p = new THREE.Group(); p.position.set(s * 0.25, 0.35, 0); g.add(p); mk(MGEO.cyl, dark, 0, -0.17, 0, 0.08, 0.35, 0.08, p); legs.push(p); });
  return { g, mats: [body], legs, torso, spark };
}

const ETYPES = {
  imp: { hp: 45, speed: 5.0, rad: 0.45, dmg: 8, range: 1.5, cd: 0.9, score: 100, make: makeImp, hs: [[0, 0.7, 0, 0.55, 1]], name: 'eImp' },
  brute: { hp: 260, speed: 2.7, rad: 0.95, dmg: 22, range: 2.7, cd: 1.8, score: 300, make: makeBrute, hs: [[0, 1.6, 0, 0.95, 1], [0, 2.55, 0.15, 0.48, 1.6]], name: 'eBrute' },
  wisp: { hp: 55, speed: 3.6, rad: 0.5, dmg: 11, range: 0, cd: 2.4, score: 150, make: makeWisp, hs: [[0, 0, 0, 0.62, 1]], fly: true, name: 'eWisp' },
  bomber: { hp: 35, speed: 6.0, rad: 0.55, dmg: 34, range: 2.4, cd: 0, score: 120, make: makeBomber, hs: [[0, 0.75, 0, 0.68, 1]], name: 'eBomber' },
};

class Enemy {
  constructor(type, x, z, fromPortal) {
    const T0 = ETYPES[type]; this.type = type; this.cfg = T0;
    this.model = T0.make(); this.g = this.model.g; S.scene.add(this.g);
    this.pos = new THREE.Vector3(x, T0.fly ? 2.4 : 0, z); this.vel = V3();
    this.hp = this.maxHp = T0.hp * S.diff.hp; this.rad = T0.rad; this.cd = rand(0.5, 1.5); this.t = Math.random() * 10;
    this.flash = 0; this.los = false; this.losT = 0; this.spawnT = 0.7; this.dead = false; this.dieT = 0; this.windup = 0; this.fuse = 0;
    this.yaw = Math.random() * TAU; this.strafe = Math.random() < 0.5 ? -1 : 1; this.growlT = rand(2, 6);
    this.speed = T0.speed * rand(0.9, 1.1) * S.diff.speed;
    this.spheres = T0.hs.map(h => ({ c: V3(), r: h[3], mul: h[4], o: h })); this.sync();
    SMOKE.burst(_v.set(x, 0.5, z), 14, 3, 0.9, 0.8, 2.2, COL.dark, -1, 2);
    FX.burst(_v.set(x, 0.3, z), 12, 4, 0.6, 0.25, 0.05, COL.purple, 0, 3);
  }
  sync() {
    const s = this.spawnT > 0 ? 1 - this.spawnT / 0.7 : 1;
    this.g.position.copy(this.pos); if (!this.cfg.fly) this.g.position.y = this.pos.y - (1 - s) * 1.6;
    this.g.rotation.y = this.yaw;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    for (const sp of this.spheres) { const o = sp.o; sp.c.set(this.pos.x + o[0] * cy + o[2] * sy, this.g.position.y + o[1], this.pos.z - o[0] * sy + o[2] * cy); }
  }
  update(dt) {
    const P = S.player.pos, m = this.model, c = this.cfg;
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 7);
    if (this.dead) { this.dieT += dt; this.g.scale.setScalar(Math.max(0.01, 1 - this.dieT * 4)); return this.dieT > 0.25; }
    for (const mm of m.mats) { if (m.basic) mm.color.setRGB(0.5 + this.flash * 3, 2.4 + this.flash, 1.6 + this.flash * 2); else mm.emissive.setRGB(this.flash * 1.5 + (this.type === 'bomber' ? 1 : 0.08), this.flash * 1.5 + (this.type === 'bomber' ? 0.35 : 0.02), this.flash * 1.5 + 0.06); }
    if (this.spawnT > 0) { this.spawnT -= dt; this.sync(); return false; }
    const dx = P.x - this.pos.x, dz = P.z - this.pos.z, dist = Math.hypot(dx, dz);
    this.losT -= dt; if (this.losT <= 0) { this.los = losClear(this.pos.x, this.pos.z, P.x, P.z); this.losT = 0.2 + Math.random() * 0.15; }
    this.growlT -= dt; if (this.growlT <= 0 && dist < 30) { SND.growl(this.type, this.pos); this.growlT = rand(4, 9); }
    let tx = 0, tz = 0, spd = this.speed * (S.player.tea > 0 ? 1 : 1);
    if (this.los && dist < 16) { tx = dx / (dist || 1); tz = dz / (dist || 1); } else { flowDir(this.pos.x, this.pos.z, _v); tx = _v.x; tz = _v.z; }
    this.cd -= dt;
    if (this.type === 'wisp') {
      if (this.los && dist < 18) {
        const px = -dz / (dist || 1), pz = dx / (dist || 1);
        if (dist < 8) { tx = -tx; tz = -tz; } else { tx = px * this.strafe * 0.8 + tx * (dist > 13 ? 0.6 : 0); tz = pz * this.strafe * 0.8 + tz * (dist > 13 ? 0.6 : 0); }
        if (Math.random() < dt * 0.3) this.strafe *= -1;
        if (this.cd <= 0) { this.cd = c.cd * rand(0.8, 1.2); this.shoot(); }
      }
      this.pos.y = 2.3 + Math.sin(this.t * 2) * 0.4;
      if (Math.random() < 0.5) FX.emit(this.pos.x + rand(-0.2, 0.2), this.pos.y - 0.1, this.pos.z + rand(-0.2, 0.2), 0, -0.4, 0, 0.6, 0.35, 0.05, ...COL.wisp);
    } else if (this.type === 'bomber') {
      if (this.fuse > 0) { this.fuse -= dt; spd *= 0.5; m.torso.scale.setScalar(0.6 + Math.sin(this.t * 40) * 0.06 + (0.7 - this.fuse) * 0.15); if (this.fuse <= 0) { this.explode(); return false; } }
      else if (dist < c.range && this.los) { this.fuse = 0.7; SND.fuse(this.pos); }
      if (Math.random() < 0.6) FX.emit(this.pos.x, this.g.position.y + 1.56, this.pos.z, rand(-1, 1), 1.5, rand(-1, 1), 0.3, 0.12, 0.02, ...COL.spark, 4);
    } else {
      if (this.windup > 0) {
        this.windup -= dt; spd *= 0.15;
        if (this.windup <= 0) { if (dist < c.range + 0.7 && Math.abs(P.y - 1.7) < 1.6) { S.player.damage(c.dmg * S.diff.dmg, this.pos); } SND.swipe(this.pos); if (this.type === 'brute') { S.shake = Math.max(S.shake, dist < 8 ? 0.4 : 0.15); SMOKE.burst(_v.set(this.pos.x + Math.sin(this.yaw) * 1.4, 0.2, this.pos.z + Math.cos(this.yaw) * 1.4), 10, 3, 0.7, 0.6, 1.6, [0.25, 0.22, 0.2], -0.5, 3); } }
      } else if (dist < c.range && this.cd <= 0 && this.los) { this.windup = this.type === 'brute' ? 0.5 : 0.18; this.cd = c.cd; }
      if (dist < c.range * 0.7) { spd *= 0.1; }
    }
    // separation
    for (const o of S.enemies) { if (o === this || o.dead) continue; const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, d = Math.hypot(ox, oz), mm = this.rad + o.rad; if (d < mm && d > 0.001) { tx += ox / d * (mm - d) * 2; tz += oz / d * (mm - d) * 2; } }
    const tl = Math.hypot(tx, tz) || 1;
    this.vel.x = lerp(this.vel.x, tx / tl * spd, Math.min(1, dt * 6)); this.vel.z = lerp(this.vel.z, tz / tl * spd, Math.min(1, dt * 6));
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    collide(this.pos, this.rad);
    // face the player when close, else the walk direction
    const want = (dist < 14 && this.los) ? Math.atan2(dx, dz) : Math.atan2(this.vel.x, this.vel.z);
    let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 8);
    // animation
    const sp = Math.hypot(this.vel.x, this.vel.z), ph = this.t * (this.type === 'brute' ? 6 : 13);
    if (m.legs) m.legs.forEach((l, i) => l.rotation.x = Math.sin(ph + i * Math.PI) * Math.min(1, sp / 3) * 0.8);
    if (m.arms) m.arms.forEach((a, i) => { a.rotation.x = this.windup > 0 ? -2.4 * (this.type === 'brute' ? 1 : 0.6) : Math.sin(ph + i * Math.PI + 1) * 0.4 * Math.min(1, sp / 3); });
    if (m.torso && this.type !== 'bomber') m.torso.position.y = (this.type === 'brute' ? 1.6 : 0.7) + Math.abs(Math.sin(ph)) * 0.06;
    if (m.halo) { m.halo.material.rotation += dt; m.shell.scale.setScalar(0.55 + Math.sin(this.t * 6) * 0.05); }
    if (m.spark) m.spark.scale.setScalar(0.35 + Math.random() * 0.3);
    this.sync();
    return false;
  }
  shoot() {
    const P = S.player.pos, o = _v.set(this.pos.x, this.pos.y, this.pos.z);
    const d = _v2.set(P.x - o.x, P.y - 0.4 - o.y, P.z - o.z).normalize();
    spawnShot(o, d, 13 * S.diff.projSpeed, this.cfg.dmg * S.diff.dmg, 0.35, COL.wisp);
    SND.fireball(this.pos);
  }
  explode() {
    if (this.dead) return; this.dead = true; this.hp = 0;
    explosion(_v3.set(this.pos.x, 0.8, this.pos.z), 4.2, this.cfg.dmg, 120, false, this);
    removeEnemy(this, false);
  }
}
function removeEnemy(e, scored = true) {
  e.dead = true;
  SMOKE.burst(_v.set(e.pos.x, e.type === 'wisp' ? e.pos.y : 0.9, e.pos.z), e.type === 'brute' ? 26 : 14, 3.5, 1.1, 0.9, 2.6, COL.dark, -0.8, 2.5);
  FX.burst(_v.set(e.pos.x, e.type === 'wisp' ? e.pos.y : 0.8, e.pos.z), e.type === 'brute' ? 40 : 20, 6, 0.6, 0.3, 0.05, e.type === 'wisp' ? COL.wisp : COL.purple, 3, 3);
  SND.die(e.type, e.pos);
  if (scored) {
    S.kills++; addScore(e.cfg.score, e.pos);
    const r = Math.random();
    if (e.type === 'brute') spawnPickup(r < 0.5 ? 'ammo' : 'health', e.pos.x, e.pos.z);
    else if (r < 0.22) spawnPickup('ammo', e.pos.x, e.pos.z);
    else if (r < 0.32) spawnPickup('health', e.pos.x, e.pos.z);
    else if (r < 0.36) spawnPickup('tea', e.pos.x, e.pos.z);
  }
}
function damageEnemy(e, dmg, mul = 1) {
  if (e.dead) return false;
  e.hp -= dmg * mul; e.flash = 1;
  if (e.hp <= 0) {
    if (e.type === 'bomber') { S.kills++; addScore(e.cfg.score, e.pos); e.explode(); return true; }
    removeEnemy(e, true); return true;
  }
  return false;
}

/* ===== enemy projectiles ===== */
const SHOT_GEO = new THREE.SphereGeometry(1, 10, 8);
function spawnShot(o, dir, speed, dmg, r, col) {
  const m = new THREE.Mesh(SHOT_GEO, new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0], col[1], col[2]) }));
  m.scale.setScalar(r); m.position.copy(o); S.scene.add(m);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(col[0] * 0.6, col[1] * 0.6, col[2] * 0.6), blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.set(r * 7, r * 7, 1); m.add(sp); sp.scale.divideScalar(r);
  S.eshots.push({ m, pos: o.clone(), vel: dir.clone().multiplyScalar(speed), dmg, r, col, life: 6 });
}
function updateShots(dt) {
  const P = S.player.pos;
  for (let i = S.eshots.length - 1; i >= 0; i--) {
    const s = S.eshots[i]; s.life -= dt; s.pos.addScaledVector(s.vel, dt); s.m.position.copy(s.pos);
    if (Math.random() < 0.7) FX.emit(s.pos.x, s.pos.y, s.pos.z, rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), 0.35, s.r * 2.2, 0.05, s.col[0], s.col[1], s.col[2]);
    const dy = s.pos.y - (P.y - 0.6), hit = Math.hypot(s.pos.x - P.x, dy * 0.6, s.pos.z - P.z) < s.r + 0.5;
    let done = s.life <= 0 || s.pos.y < 0.05 || blockedAt(s.pos.x, s.pos.z);
    if (hit) { S.player.damage(s.dmg, s.pos); done = true; }
    if (done) { FX.burst(s.pos, 12, 4, 0.4, 0.3, 0.05, s.col, 2, 3); S.scene.remove(s.m); s.m.material.dispose(); s.m.children[0].material.dispose(); S.eshots.splice(i, 1); }
  }
}

/* ===== explosions (firework launcher, bombers, boss slam) ===== */
const BLAST_LIGHTS = [];
function explosion(p, radius, dmgPlayer, dmgEnemy, firework, source) {
  S.shake = Math.max(S.shake, clamp(1 - p.distanceTo(S.player.pos) / 30, 0, 0.7));
  SND.explosion(p, radius / 5, firework);
  FX.burst(p, 60, 12, 0.5, 0.6, 0.1, COL.fire, 0, 4);
  SMOKE.burst(p, 18, 4, 1.4, 1.2, 3.5, [0.12, 0.1, 0.12], -0.6, 2);
  if (firework) { const cols = [pick(FIREWORK), pick(FIREWORK)]; FX.burst(_v.copy(p).setY(p.y + 0.5), 110, 16, 1.3, 0.3, 0.05, cols, 4, 1.6); }
  const L = BLAST_LIGHTS.find(l => l.userData.t <= 0) || BLAST_LIGHTS[0];
  if (L) { L.position.copy(p).setY(p.y + 1); L.color.setRGB(1, 0.6, 0.3); L.userData.t = 0.35; }
  if (dmgPlayer > 0) { const d = Math.hypot(p.x - S.player.pos.x, p.y - (S.player.pos.y - 0.8), p.z - S.player.pos.z); if (d < radius) S.player.damage(dmgPlayer * S.diff.dmg * (1 - d / radius * 0.6), p); }
  if (dmgEnemy > 0) {
    for (const e of S.enemies.slice()) { if (e === source || e.dead) continue; const d = e.spheres[0].c.distanceTo(p); if (d < radius + e.rad) { const k = 1 - clamp(d / (radius + e.rad), 0, 1) * 0.6; if (damageEnemy(e, dmgEnemy * k * (S.player ? S.player.dmgMul() : 1))) hitMarker(true); } }
    for (const pt of S.portals) if (pt.alive) { const d = pt.center.distanceTo(p); if (d < radius + 2) damagePortal(pt, dmgEnemy * 0.8); }
    if (S.boss && S.boss.alive) S.boss.splash(p, radius, dmgEnemy);
  }
}

/* ===== portals (Shadow Gates) ===== */
const PORTAL_DEF = [
  { x: -26, z: -52, street: 'Hàng Bạc', reward: 'rifle' },
  { x: 26, z: -26, street: 'Hàng Buồm', reward: 'launcher' },
  { x: -52, z: 26, street: 'Mã Mây', reward: 'tea' },
];
function makePortals() {
  const swirl = {
    uniforms: { uTime: { value: 0 }, uHit: { value: 0 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uHit;
      void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); if(r>1.0) discard; float a = atan(p.y,p.x);
        float s = sin(a*5.0 + r*14.0 - uTime*5.0)*0.5+0.5; float s2 = sin(a*3.0 - r*9.0 + uTime*3.0)*0.5+0.5;
        vec3 c = mix(vec3(0.5,0.05,0.9), vec3(1.6,0.3,1.2), s*s2); c *= smoothstep(1.0,0.55,r) * (0.8 + 0.6*s);
        c += vec3(2.0,1.4,2.5) * smoothstep(0.25,0.0,r); c += vec3(uHit*2.0);
        gl_FragColor = vec4(c*1.4, smoothstep(1.0,0.8,r)); }`
  };
  const ringM = new THREE.MeshStandardMaterial({ color: 0x1a0822, emissive: new THREE.Color(1.2, 0.2, 2.0), emissiveIntensity: 1, roughness: 0.4 });
  const beamM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.15, 1.4), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const rockM = new THREE.MeshStandardMaterial({ color: 0x241a2a, roughness: 0.9, flatShading: true });
  PORTAL_DEF.forEach((d, i) => {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); S.scene.add(g);
    const mat = new THREE.ShaderMaterial(swirl); mat.uniforms = { uTime: { value: 0 }, uHit: { value: 0 } };
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), mat); disc.position.y = 2.7; g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.22, 10, 40), ringM); ring.position.y = 2.7; g.add(ring);
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 0.8), 0), rockM); rk.position.set(Math.cos(a) * 2.6, rand(0.1, 0.4), Math.sin(a) * 2.6); rk.rotation.set(rand(0, 3), rand(0, 3), 0); rk.castShadow = true; g.add(rk); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 60, 16, 1, true), beamM); beam.position.y = 30; g.add(beam);
    const light = new THREE.PointLight(0xb040ff, 30, 22, 1.6); light.position.y = 3; g.add(light);
    S.portals.push({ g, disc, ring, beam, light, mat, def: d, idx: i, center: new THREE.Vector3(d.x, 2.7, d.z), hp: 1, maxHp: 1, alive: true, spawnT: 2, hitT: 0 });
  });
}
function resetPortals() {
  S.portals.forEach(p => { p.maxHp = p.hp = 700 * S.diff.hp; p.alive = true; p.g.visible = true; p.light.intensity = 30; p.spawnT = 2; });
}
function damagePortal(p, dmg) {
  if (!p.alive) return; p.hp -= dmg; p.hitT = 0.12;
  if (Math.random() < 0.3) SND.portalHit(p.center);
  if (p.hp <= 0) {
    p.alive = false; p.g.visible = false; p.light.intensity = 0;
    SND.portalBreak(p.center); S.shake = Math.max(S.shake, 0.5);
    FX.burst(p.center, 160, 18, 1.4, 0.6, 0.05, [COL.purple, COL.pink, COL.white], 2, 1.5);
    SMOKE.burst(p.center, 30, 5, 2, 1.5, 4, COL.dark, -0.5, 1.5);
    addScore(1000, p.center);
    const rw = p.def.reward;
    if (rw === 'tea') { spawnPickup('tea', p.def.x + 1.5, p.def.z); spawnPickup('health', p.def.x - 1.5, p.def.z); }
    else spawnPickup('weapon:' + rw, p.def.x, p.def.z);
    spawnPickup('ammo', p.def.x, p.def.z + 2);
    onPortalDestroyed();
  }
}
function updatePortals(dt) {
  S.portals.forEach(p => {
    if (!p.alive) return;
    p.mat.uniforms.uTime.value = S.time; p.hitT = Math.max(0, p.hitT - dt); p.mat.uniforms.uHit.value = p.hitT * 4;
    p.ring.rotation.z += dt * 0.4; p.disc.lookAt(S.player.pos.x, 2.7, S.player.pos.z); p.ring.quaternion.copy(p.disc.quaternion);
    p.light.intensity = 26 + Math.sin(S.time * 4 + p.idx) * 6;
    if (Math.random() < 0.6) FX.emit(p.def.x + rand(-2, 2), 0.2, p.def.z + rand(-2, 2), 0, rand(1.5, 3.5), 0, 1.6, 0.3, 0.05, ...COL.purple);
  });
}

/* ===== pickups ===== */
function makePickupModel(type) {
  const g = new THREE.Group();
  if (type === 'ammo') {
    mk(MGEO.box, new THREE.MeshStandardMaterial({ color: 0x3f5f2a, roughness: 0.6 }), 0, 0, 0, 0.7, 0.4, 0.45, g);
    mk(MGEO.box, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.3) }), 0, 0, 0, 0.72, 0.08, 0.47, g);
  } else if (type === 'health') { // bánh mì
    const bread = new THREE.MeshStandardMaterial({ color: 0xd8a04a, roughness: 0.6, emissive: 0x3a2000 });
    const b = mk(new THREE.CapsuleGeometry(0.16, 0.55, 4, 10), bread, 0, 0, 0, 1, 1, 1, g); b.rotation.z = Math.PI / 2;
    for (let i = -1; i <= 1; i++) { const c = mk(MGEO.box, new THREE.MeshStandardMaterial({ color: 0xf0d39a }), i * 0.2, 0.15, 0, 0.12, 0.03, 0.08, g); c.rotation.y = 0.6; }
    mk(MGEO.box, new THREE.MeshStandardMaterial({ color: 0x4caf50 }), 0, 0.02, 0.12, 0.5, 0.06, 0.05, g);
  } else if (type === 'tea') { // trà sữa
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0xe7c99a, roughness: 0.3, emissive: 0x2a1a08, transparent: true, opacity: 0.95 })); g.add(cup);
    mk(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, 0.26, 0, 1, 1, 1, g);
    mk(MGEO.cyl, new THREE.MeshStandardMaterial({ color: 0x2f6b2a }), 0.05, 0.42, 0, 0.025, 0.4, 0.025, g).rotation.z = 0.2;
    for (let i = 0; i < 8; i++) mk(MGEO.sph, new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.2 }), Math.cos(i) * 0.1, -0.18, Math.sin(i) * 0.1, 0.045, 0.045, 0.045, g);
    mk(MGEO.box, new THREE.MeshStandardMaterial({ color: 0x2f6b2a }), 0, 0.02, 0.19, 0.18, 0.12, 0.01, g);
  } else if (type.startsWith('weapon:')) {
    const m = buildGunModel(type.split(':')[1]); m.scale.setScalar(1.6); g.add(m);
  }
  const glowCol = type === 'tea' ? [0.6, 1.6, 0.6] : type === 'health' ? [1.6, 1.1, 0.4] : type === 'ammo' ? [1.4, 1.4, 0.4] : [1.6, 0.8, 2];
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(...glowCol), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  halo.scale.set(2, 2, 1); g.add(halo);
  return g;
}
function spawnPickup(type, x, z) {
  const p = V3().set(x, 0, z); collide(p, 0.5);
  const m = makePickupModel(type); m.position.set(p.x, 0.7, p.z); S.scene.add(m);
  S.pickups.push({ type, pos: p, m, t: Math.random() * 6, life: type.startsWith('weapon') ? 1e9 : 45 });
}
function updatePickups(dt) {
  const P = S.player.pos;
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const k = S.pickups[i]; k.t += dt; k.life -= dt;
    k.m.position.y = 0.7 + Math.sin(k.t * 3) * 0.12; k.m.rotation.y += dt * 1.6;
    if (k.life < 5) k.m.visible = Math.floor(k.t * 8) % 2 === 0;
    if (Math.hypot(k.pos.x - P.x, k.pos.z - P.z) < 1.5 && S.player.collect(k.type)) { S.scene.remove(k.m); S.pickups.splice(i, 1); continue; }
    if (k.life <= 0) { S.scene.remove(k.m); S.pickups.splice(i, 1); }
  }
}

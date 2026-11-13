/* ===== weapons ===== */
const WEAPONS = {
  pistol: { name: 'wPistol', dmg: 26, rate: 0.17, mag: 12, reserve: Infinity, reload: 1.0, spread: 0.006, moveSpread: 0.018, pellets: 1, kick: 0.016, sound: 'pistol', tracer: 0.3 },
  shotgun: { name: 'wShotgun', dmg: 13, rate: 0.72, mag: 6, reserve: 30, reload: 1.6, spread: 0.07, moveSpread: 0.02, pellets: 10, kick: 0.055, sound: 'shotgun', tracer: 0.25 },
  rifle: { name: 'wRifle', dmg: 19, rate: 0.088, mag: 30, reserve: 150, reload: 1.7, spread: 0.01, moveSpread: 0.03, pellets: 1, kick: 0.011, sound: 'rifle', tracer: 0.5 },
  launcher: { name: 'wLauncher', dmg: 150, rate: 0.9, mag: 4, reserve: 10, reload: 2.0, spread: 0, moveSpread: 0, pellets: 1, kick: 0.05, sound: 'launcher', rocket: true },
};
const W_ORDER = ['pistol', 'shotgun', 'rifle', 'launcher'];
const AMMO_PICK = { shotgun: 12, rifle: 60, launcher: 3 };


function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return -1; const s = Math.sqrt(h); let t = -b - s; if (t < 0) t = -b + s; return t;
}

const TRACERS = [];
function makeTracers(scene) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.2), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 16; i++) { const t = new THREE.Mesh(MGEO.box, m); t.visible = false; t.userData.life = 0; scene.add(t); TRACERS.push(t); }
}
function tracer(a, b) {
  const t = TRACERS.find(x => !x.visible); if (!t) return;
  const len = a.distanceTo(b); if (len < 1) return;
  t.position.copy(a).lerp(b, 0.5); t.lookAt(b); t.scale.set(0.025, 0.025, len); t.visible = true; t.userData.life = 0.05;
}
function updateTracers(dt) { for (const t of TRACERS) if (t.visible) { t.userData.life -= dt; if (t.userData.life <= 0) t.visible = false; } }

// one bullet: walls, ground, monsters, gates, boss
function hitscan(o, d, dmg, muzzleW, tracerChance) {
  let best = rayWall3(o, d, 140), kind = 'wall', target = null, mul = 1;
  if (d.y < -1e-4) { const tg = o.y / -d.y; if (tg < best) { best = tg; kind = 'ground'; } }
  for (const e of S.enemies) { if (e.dead) continue; for (const sp of e.spheres) { const t = raySphere(o, d, sp.c, sp.r); if (t > 0 && t < best) { best = t; kind = 'enemy'; target = e; mul = sp.mul; } } }
  for (const p of S.portals) { if (!p.alive) continue; const t = raySphere(o, d, p.center, 2.1); if (t > 0 && t < best) { best = t; kind = 'portal'; target = p; } }
  if (S.boss && S.boss.alive && S.boss.dyingT === 0) for (const sp of S.boss.spheres) { const t = raySphere(o, d, sp.c, sp.r); if (t > 0 && t < best) { best = t; kind = 'boss'; mul = sp.mul; } }
  const pt = _v3.copy(o).addScaledVector(d, best);
  if (Math.random() < tracerChance) tracer(muzzleW, pt);
  const dm = dmg * S.player.dmgMul();
  if (kind === 'enemy') { S.hits++; const k = damageEnemy(target, dm, mul); hitMarker(k); FX.burst(pt, 6, 4, 0.25, 0.2, 0.03, target.type === 'wisp' ? COL.wisp : COL.purple, 4, 3); if (!k && target.vel) target.vel.addScaledVector(d, 1.2); }
  else if (kind === 'portal') { S.hits++; damagePortal(target, dm); hitMarker(false); FX.burst(pt, 6, 5, 0.3, 0.25, 0.03, COL.pink, 2, 3); }
  else if (kind === 'boss') { S.hits++; const k = S.boss.damage(dm, mul, pt); hitMarker(k || mul > 1); FX.burst(pt, 8, 5, 0.3, 0.3, 0.03, mul > 1 ? COL.white : COL.purple, 3, 3); }
  else if (best < 140) {
    FX.burst(pt, 5, 5, 0.25, 0.12, 0.02, COL.spark, 9, 2);
    SMOKE.emit(pt.x, pt.y, pt.z, rand(-0.3, 0.3), 0.6, rand(-0.3, 0.3), 0.8, 0.2, 0.9, 0.35, 0.33, 0.3, -0.2, 1, 0.6);
    if (Math.random() < 0.25) SND.impact(pt);
  }
}

function spawnRocket(o, d) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8), new THREE.MeshStandardMaterial({ color: 0xc62828, emissive: 0x400000 })); body.rotation.x = Math.PI / 2; g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xd4a83a, metalness: 0.8 })); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.3; g.add(tip);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(3, 1.6, 0.4), blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.z = 0.3; glow.scale.set(0.9, 0.9, 1); g.add(glow);
  g.position.copy(o); g.lookAt(o.clone().add(d)); g.rotateY(Math.PI);
  S.scene.add(g); S.rockets.push({ g, pos: o.clone(), vel: d.clone().multiplyScalar(38), life: 4 });
}
function updateRockets(dt) {
  for (let i = S.rockets.length - 1; i >= 0; i--) {
    const r = S.rockets[i]; r.life -= dt; const step = r.vel.length() * dt, dir = _v.copy(r.vel).normalize();
    let hit = r.life <= 0;
    const tw = rayWall3(r.pos, dir, step + 0.2); if (tw < step + 0.2) hit = true;
    r.pos.addScaledVector(r.vel, dt); r.g.position.copy(r.pos);
    if (r.pos.y < 0.15) hit = true;
    for (const e of S.enemies) { if (e.dead) continue; for (const sp of e.spheres) if (sp.c.distanceTo(r.pos) < sp.r + 0.3) hit = true; }
    for (const p of S.portals) if (p.alive && p.center.distanceTo(r.pos) < 2.3) hit = true;
    if (S.boss && S.boss.alive && S.boss.dyingT === 0) for (const sp of S.boss.spheres) if (sp.c.distanceTo(r.pos) < sp.r + 0.3) hit = true;
    for (let k = 0; k < 3; k++) FX.emit(r.pos.x, r.pos.y, r.pos.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.5, 0.35, 0.05, ...pick(FIREWORK), 1, 2);
    SMOKE.emit(r.pos.x, r.pos.y, r.pos.z, 0, 0.3, 0, 1, 0.3, 1.1, 0.4, 0.38, 0.4, -0.2, 1, 0.45);
    if (hit) { const p = r.pos.clone(); p.y = Math.max(0.3, p.y); explosion(p, 5.2, 0, WEAPONS.launcher.dmg, true, null); S.scene.remove(r.g); S.rockets.splice(i, 1); }
  }
}

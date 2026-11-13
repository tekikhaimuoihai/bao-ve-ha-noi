/* ===== final boss: Thuồng Luồng, a serpent spirit ===== */
class Boss {
  constructor() {
    this.alive = true; this.hp = this.maxHp = 3200 * S.diff.hp * S.diff.bossHp; this.t = 0; this.state = 'intro'; this.stateT = 0;
    this.head = new THREE.Vector3(0, -6, 0); this.vel = V3(); this.ang = 0; this.atkT = 3; this.summonT = 12; this.rage = false; this.flash = 0; this.diveHit = false; this.dyingT = 0;
    this.g = new THREE.Group(); S.scene.add(this.g);
    const scale = new THREE.MeshStandardMaterial({ color: 0x5a3a7a, map: TEX.scales, roughness: 0.45, metalness: 0.2, emissive: new THREE.Color(0.25, 0.04, 0.35) });
    const belly = new THREE.MeshStandardMaterial({ color: 0xc9b27a, roughness: 0.6, emissive: 0x100800 });
    const spikeM = new THREE.MeshStandardMaterial({ color: 0x220a30, emissive: new THREE.Color(1.4, 0.2, 2.2), roughness: 0.4 });
    this.mats = [scale];
    // head
    const h = this.hg = new THREE.Group(); this.g.add(h);
    mk(MGEO.box, scale, 0, 0, 0.2, 1.5, 1.1, 2.1, h);
    mk(MGEO.box, scale, 0, -0.15, 1.45, 1.1, 0.6, 1.0, h);
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.45, 0.7); h.add(this.jaw);
    mk(MGEO.box, belly, 0, -0.1, 0.6, 1.0, 0.3, 1.5, this.jaw);
    const teeth = new THREE.MeshStandardMaterial({ color: 0xf2ead0 });
    for (let i = 0; i < 5; i++) { mk(MGEO.cone, teeth, -0.35 + i * 0.175, -0.62, 1.75, 0.06, 0.25, 0.06, h).rotation.x = Math.PI; mk(MGEO.cone, teeth, -0.35 + i * 0.175, 0.1, 1.2, 0.05, 0.2, 0.05, this.jaw); }
    const hornM = new THREE.MeshStandardMaterial({ color: 0xd8c690, roughness: 0.4 });
    [-1, 1].forEach(s => {
      const hn = mk(MGEO.cone, hornM, s * 0.5, 0.75, -0.4, 0.16, 1.6, 0.16, h); hn.rotation.set(-1.0, 0, s * -0.35);
      const w = mk(MGEO.cyl, hornM, s * 0.85, -0.2, 1.6, 0.025, 1.8, 0.025, h); w.rotation.set(0.2, 0, s * 1.2);
      mk(MGEO.sph, eyeMat(3.2, 0.6, 2.6), s * 0.55, 0.3, 1.0, 0.16, 0.12, 0.12, h);
    });
    for (let i = 0; i < 6; i++) mk(MGEO.cone, spikeM, 0, 0.6, -0.6 + i * 0.25 - 0.6, 0.12, 0.6 - i * 0.05, 0.12, h).rotation.x = -0.6;
    this.eyeLight = new THREE.PointLight(0xff40d0, 0, 14, 1.5); h.add(this.eyeLight); this.eyeLight.position.set(0, 0, 2);
    // body segments
    this.segs = []; const N = 20;
    for (let i = 0; i < N; i++) {
      const r = lerp(1.25, 0.35, i / (N - 1));
      const sg = new THREE.Group(); this.g.add(sg);
      mk(MGEO.sph, scale, 0, 0, 0, r, r * 0.95, r * 1.15, sg);
      mk(MGEO.sph, belly, 0, -r * 0.35, 0, r * 0.8, r * 0.6, r * 1.05, sg);
      if (i % 2 === 0) mk(MGEO.cone, spikeM, 0, r * 0.95, 0, r * 0.22, r * 0.9, r * 0.22, sg).rotation.x = -0.5;
      if (i === 5 || i === 13) [-1, 1].forEach(s => { const leg = mk(MGEO.cone, hornM, s * r, -r * 0.6, 0, r * 0.2, r * 1.2, r * 0.2, sg); leg.rotation.z = s * 2.4; });
      this.segs.push({ g: sg, r, pos: V3().set(0, -8, 0) });
    }
    // trail of head positions (body follows it)
    this.trail = []; for (let i = 0; i < 160; i++) this.trail.push(new THREE.Vector3(0, -6 - i * 0.3, 0));
    this.spheres = [{ c: this.head, r: 1.5, mul: 2 }, ...this.segs.map(s => ({ c: s.pos, r: s.r * 1.05, mul: 1 }))];
    SND.growl('boss', V3()); S.shake = 0.8;
  }
  layoutBody() {
    const tr = this.trail; let seg = 0, need = 1.8, acc = 0;
    for (let i = tr.length - 1; i > 0 && seg < this.segs.length; i--) {
      const a = tr[i], b = tr[i - 1], d = a.distanceTo(b);
      while (acc + d >= need && seg < this.segs.length) {
        const t = (need - acc) / (d || 1); this.segs[seg].pos.copy(a).lerp(b, t); seg++;
        need += seg < this.segs.length ? (this.segs[seg - 1].r + this.segs[seg].r) * 0.72 : 0;
      }
      acc += d;
    }
    for (; seg < this.segs.length; seg++) this.segs[seg].pos.copy(tr[0]);
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i]; s.g.position.copy(s.pos);
      const prev = i === 0 ? this.head : this.segs[i - 1].pos; s.g.lookAt(prev);
    }
  }
  pushTrail() { const last = this.trail[this.trail.length - 1]; if (last.distanceTo(this.head) > 0.25) { this.trail.push(this.head.clone()); if (this.trail.length > 260) this.trail.shift(); } }
  update(dt) {
    if (!this.alive) return;
    this.t += dt; this.stateT += dt; this.flash = Math.max(0, this.flash - dt * 6);
    for (const m of this.mats) m.emissive.setRGB(0.25 + this.flash * 1.5 + (this.rage ? 0.3 : 0), 0.04 + this.flash * 1.5, 0.35 + this.flash * 1.5);
    if (this.dyingT > 0) return this.updateDeath(dt);
    const P = S.player.pos; const spd = this.rage ? 1.35 : 1;
    let target = _v;
    if (this.state === 'intro') {
      target.set(0, 9, 0); this.head.y += dt * 4.5;
      if (this.head.y > 8) { this.state = 'roam'; this.stateT = 0; }
      this.head.x = Math.sin(this.t) * 2; this.head.z = Math.cos(this.t) * 2;
      if (Math.random() < 0.8) SMOKE.burst(_v2.set(rand(-3, 3), 0.3, rand(-3, 3)), 1, 3, 1.2, 1.2, 3, COL.dark, -1, 1);
      this.faceTo(P, dt);
    } else if (this.state === 'roam') {
      this.ang += dt * 0.55 * spd;
      target.set(Math.cos(this.ang) * 10, 7 + Math.sin(this.t * 1.3) * 2, Math.sin(this.ang * 2) * 7);
      this.steer(target, 9 * spd, dt); this.faceTo(P, dt);
      this.atkT -= dt; this.summonT -= dt;
      if (this.summonT <= 0) { this.summonT = this.rage ? 13 : 18; this.summon(); }
      if (this.atkT <= 0) {
        const r = Math.random();
        if (r < 0.32) { this.state = 'dive'; this.stateT = 0; this.diveHit = false; SND.growl('boss', this.head); }
        else if (r < 0.62 || !this.rage) { this.volley(this.rage ? 7 : 5); this.atkT = this.rage ? 1.6 : 2.4; }
        else { this.ring(); this.atkT = 2.0; }
      }
    } else if (this.state === 'dive') {
      if (this.stateT < 0.9) { // wind-up
        this.steer(target.set(this.head.x * 0.9, 11, this.head.z * 0.9), 6, dt); this.faceTo(P, dt);
        this.eyeLight.intensity = 30; this.diveTarget = V3().set(clamp(P.x, -14, 14), 0.9, clamp(P.z, -14, 14));
      } else {
        const d = _v2.copy(this.diveTarget).sub(this.head), l = d.length();
        if (l > 0.8) { d.multiplyScalar(1 / l); this.head.addScaledVector(d, Math.min(l, 28 * spd * dt)); this.faceDir(d, dt * 4); }
        if (!this.diveHit && this.head.distanceTo(_v3.set(P.x, P.y - 0.8, P.z)) < 2.6) { this.diveHit = true; S.player.damage(26 * S.diff.dmg, this.head); }
        if (l <= 0.8 || this.stateT > 2.4) {
          this.state = 'recover'; this.stateT = 0; this.eyeLight.intensity = 0;
          S.shake = Math.max(S.shake, 0.7); SND.boom();
          FX.burst(_v2.copy(this.head).setY(0.3), 70, 14, 0.7, 0.5, 0.05, [COL.purple, COL.pink], 0, 3, 1, 0);
          SMOKE.burst(_v2.copy(this.head).setY(0.3), 26, 7, 1.2, 1.2, 3, [0.15, 0.1, 0.18], -0.3, 2);
          const pd = Math.hypot(P.x - this.head.x, P.z - this.head.z);
          if (pd < 6.5 && P.y < 2.1) S.player.damage(18 * S.diff.dmg * (1 - pd / 9), this.head);
        }
      }
    } else if (this.state === 'recover') { // stunned near the ground: headshot window
      this.head.y = lerp(this.head.y, 1.6, dt * 3); this.faceTo(P, dt * 0.5);
      if (this.stateT > (this.rage ? 1.4 : 2.0)) { this.state = 'roam'; this.stateT = 0; this.atkT = 1.2; }
    }
    this.head.x = clamp(this.head.x, -14, 14); this.head.z = clamp(this.head.z, -14, 14);
    if (this.state !== 'intro') this.head.y = Math.max(1.4, this.head.y);
    this.hg.position.copy(this.head);
    this.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(this.t * 3)) * 0.25 + (this.state === 'dive' ? 0.5 : 0);
    this.pushTrail(); this.layoutBody();
    if (Math.random() < 0.5) FX.emit(this.head.x + rand(-1, 1), this.head.y + rand(-0.5, 0.5), this.head.z + rand(-1, 1), 0, 1, 0, 0.8, 0.4, 0.05, ...COL.purple);
    if (!this.rage && this.hp < this.maxHp * 0.5) { this.rage = true; banner(T('bnRage'), ''); SND.growl('boss', this.head); this.summon(); }
  }
  steer(target, speed, dt) {
    const d = _v2.copy(target).sub(this.head), l = d.length(); if (l < 0.01) return;
    this.vel.lerp(d.multiplyScalar(Math.min(speed, l * 2) / l), Math.min(1, dt * 2)); this.head.addScaledVector(this.vel, dt);
  }
  faceTo(p, dt) { this.faceDir(_v3.set(p.x - this.head.x, p.y - 1 - this.head.y, p.z - this.head.z), dt * 3); }
  faceDir(d, k) { const m = new THREE.Matrix4().lookAt(_v.set(0, 0, 0), d.clone().negate(), new THREE.Vector3(0, 1, 0)); const q = new THREE.Quaternion().setFromRotationMatrix(m); this.hg.quaternion.slerp(q, Math.min(1, k)); }
  mouth() { return _v.set(0, -0.3, 2.1).applyQuaternion(this.hg.quaternion).add(this.head).clone(); }
  volley(n) {
    const o = this.mouth(), P = S.player.pos, base = _v2.set(P.x - o.x, P.y - 0.6 - o.y, P.z - o.z).normalize();
    const yaw = Math.atan2(base.x, base.z), pitch = Math.asin(clamp(base.y, -1, 1));
    for (let i = 0; i < n; i++) { const a = yaw + (i - (n - 1) / 2) * 0.13; const d = new THREE.Vector3(Math.sin(a) * Math.cos(pitch), Math.sin(pitch), Math.cos(a) * Math.cos(pitch)); spawnShot(o, d, 15 * S.diff.projSpeed, 12 * S.diff.dmg, 0.45, COL.pink); }
    SND.fireball(this.head);
  }
  ring() {
    const o = this.mouth(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; spawnShot(o, new THREE.Vector3(Math.cos(a), -0.25, Math.sin(a)).normalize(), 11 * S.diff.projSpeed, 10 * S.diff.dmg, 0.4, COL.purple); }
    SND.fireball(this.head); SND.growl('boss', this.head);
  }
  summon() {
    const n = this.rage ? 4 : 3;
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU; spawnEnemy(i === 0 && this.rage ? 'bomber' : (Math.random() < 0.3 ? 'wisp' : 'imp'), Math.cos(a) * 12, Math.sin(a) * 12); }
  }
  damage(dmg, mul, pt) {
    if (!this.alive || this.dyingT > 0 || this.state === 'intro') return false;
    this.hp -= dmg * mul; this.flash = 1;
    if (this.hp <= 0) { this.hp = 0; this.dyingT = 0.001; this.deathI = 0; SND.growl('boss', this.head); addScore(5000, this.head); return true; }
    return false;
  }
  splash(p, radius, dmg) { let best = 1e9; for (const s of this.spheres) best = Math.min(best, s.c.distanceTo(p) - s.r); if (best < radius) this.damage(dmg * (1 - clamp(best / radius, 0, 1) * 0.6), 1, p); }
  updateDeath(dt) {
    this.dyingT += dt; this.head.y = Math.max(1.2, this.head.y - dt * 2); this.hg.position.copy(this.head); this.hg.rotation.z += dt * 2;
    const step = 0.12;
    while (this.deathI < this.segs.length + 1 && this.dyingT > this.deathI * step) {
      const target = this.deathI === 0 ? this.head : this.segs[this.deathI - 1].pos;
      explosion(target.clone(), 0.1, 0, 0, true, null);
      if (this.deathI > 0) this.segs[this.deathI - 1].g.visible = false; else this.hg.visible = false;
      this.deathI++;
    }
    if (this.dyingT > (this.segs.length + 1) * step + 1.2) { this.alive = false; S.scene.remove(this.g); onBossDefeated(); }
  }
  remove() { this.alive = false; S.scene.remove(this.g); }
}

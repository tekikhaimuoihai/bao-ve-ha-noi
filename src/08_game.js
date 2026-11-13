/* ===== renderer + post-processing ===== */
const DIFFS = {
  easy: { hp: 0.7, dmg: 0.5, speed: 0.92, count: 0.75, regen: 4, regenDelay: 3, mul: 0.8, projSpeed: 0.85, bossHp: 0.8 },
  normal: { hp: 1, dmg: 0.8, speed: 1, count: 1, regen: 2, regenDelay: 5, mul: 1, projSpeed: 1, bossHp: 1 },
  hard: { hp: 1.3, dmg: 1.2, speed: 1.1, count: 1.35, regen: 0, regenDelay: 99, mul: 1.6, projSpeed: 1.15, bossHp: 1.2 },
};
let renderer, post, vmScene, vmCam, moon, hemi, muzzleLight, gunRoot;

class Post {
  constructor(r) {
    this.r = r; const hf = r.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: hf, depthBuffer: true });
    this.a = new THREE.WebGLRenderTarget(4, 4, { type: hf, depthBuffer: false }); this.b = this.a.clone(); this.c = this.a.clone(); this.d = this.a.clone();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.scene.add(this.quad);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }';
    this.bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, th: { value: 0.85 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c = texture2D(t,vUv).rgb; float l = max(c.r,max(c.g,c.b)); gl_FragColor = vec4(c*smoothstep(th, th+0.8, l), 1.0); }' });
    this.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t,vUv).rgb*0.227; c += (texture2D(t,vUv+dir*1.38).rgb + texture2D(t,vUv-dir*1.38).rgb)*0.316; c += (texture2D(t,vUv+dir*3.23).rgb + texture2D(t,vUv-dir*3.23).rgb)*0.07; gl_FragColor = vec4(c,1.0); }' });
    this.comp = new THREE.ShaderMaterial({
      uniforms: { tS: { value: null }, tB: { value: null }, tA: { value: null }, uStreak: { value: 0.0 }, uLetter: { value: 0 }, uFade: { value: 0 }, uAspect: { value: 1.7 }, uBloom: { value: 0.9 }, uTime: { value: 0 }, uDmg: { value: 0 }, uLow: { value: 0 }, uExp: { value: 1.25 }, uTea: { value: 0 } },
      vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tS, tB, tA; uniform float uStreak, uLetter, uFade, uAspect; uniform float uBloom, uTime, uDmg, uLow, uExp, uTea; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){ vec2 d = vUv-0.5; float ca = 0.0012 + uDmg*0.008;
          vec3 c = vec3(texture2D(tS, vUv+d*ca).r, texture2D(tS, vUv).g, texture2D(tS, vUv-d*ca).b);
          c += texture2D(tB, vUv).rgb*uBloom; c += texture2D(tA, vUv).rgb*vec3(0.55,0.7,1.25)*uStreak; c *= uExp; c = aces(c);
          float lg = dot(c, vec3(0.299,0.587,0.114)); c = mix(c, c*vec3(0.86,1.0,1.12), (1.0-smoothstep(0.0,0.45,lg))*0.55); c = mix(c, c*vec3(1.1,1.0,0.86), smoothstep(0.35,0.9,lg)*0.45);
          c = mix(vec3(lg), c, 1.1); c = clamp(c, 0.0, 1.0); c = c*c*(3.0-2.0*c)*0.35 + c*0.65;
          float l = dot(c, vec3(0.299,0.587,0.114)); c = mix(c, vec3(l), uLow*0.65);
          c = mix(c, c*vec3(0.92,1.0,1.12), (1.0-l)*0.5);
          float r = length(d); c *= mix(1.0, smoothstep(0.95,0.25,r), 0.55);
          c = mix(c, vec3(0.55,0.0,0.0), uDmg*smoothstep(0.25,0.75,r));
          c = mix(c, c*vec3(0.85,1.15,0.85), uTea*smoothstep(0.35,0.8,r)*0.6);
          c *= 1.0 - uFade;
          c = pow(c, vec3(1.0/2.2)); c += (hash(vUv*vec2(1920.0,1080.0)+uTime)-0.5)*0.03;
          float bar = uLetter * 0.09; c *= step(bar, vUv.y) * step(vUv.y, 1.0 - bar);
          gl_FragColor = vec4(c,1.0); }`
    });
    this.useBloom = true;
  }
  setSize(w, h) { this.rt.setSize(w, h); const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2); this.a.setSize(bw, bh); this.b.setSize(bw, bh); this.c.setSize(bw, bh); this.d.setSize(bw, bh); this.comp.uniforms.uAspect.value = w / h; this.bw = bw; this.bh = bh; }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  render(scene, cam) {
    const r = this.r;
    wetRender(r, scene, cam);
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, cam);
    if (vmScene && S.running && S.player && S.player.alive) { r.clearDepth(); r.render(vmScene, vmCam); }
    if (this.useBloom) {
      this.bright.uniforms.t.value = this.rt.texture; this.pass(this.bright, this.a);
      for (let i = 0; i < 2; i++) {
        const s = 1 + i * 1.5;
        this.blur.uniforms.t.value = this.a.texture; this.blur.uniforms.dir.value.set(s / this.bw, 0); this.pass(this.blur, this.b);
        this.blur.uniforms.t.value = this.b.texture; this.blur.uniforms.dir.value.set(0, s / this.bh); this.pass(this.blur, this.a);
      }
    }
    if (this.useBloom) {
      // anamorphic streak: wide horizontal blur of the brightest parts
      this.bright.uniforms.t.value = this.rt.texture; this.bright.uniforms.th.value = 1.6; this.pass(this.bright, this.c); this.bright.uniforms.th.value = 0.85;
      for (let i = 0; i < 3; i++) {
        const s = [3, 9, 24][i];
        this.blur.uniforms.t.value = this.c.texture; this.blur.uniforms.dir.value.set(s / this.bw, 0); this.pass(this.blur, this.d);
        const t = this.c; this.c = this.d; this.d = t;
      }
    }
    this.comp.uniforms.tA.value = this.c.texture; this.comp.uniforms.uStreak.value = this.useBloom ? 0.5 : 0;
    this.comp.uniforms.tS.value = this.rt.texture; this.comp.uniforms.tB.value = this.a.texture; this.comp.uniforms.uBloom.value = this.useBloom ? 0.9 : 0;
    this.pass(this.comp, null);
  }
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.autoClear = false; renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('#view').appendChild(renderer.domElement);
  post = new Post(renderer);
  const scene = S.scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x150c20, 0.017);
  S.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 700); S.camera.rotation.order = 'YXZ';
  hemi = new THREE.HemisphereLight(0x6a78b0, 0x3a2418, 0.9); scene.add(hemi);
  scene.add(new THREE.AmbientLight(0x2a2038, 0.6));
  moon = new THREE.DirectionalLight(0xa8b8ff, 1.1); moon.position.set(-40, 70, -60); scene.add(moon); scene.add(moon.target);
  moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 }); moon.shadow.bias = -0.0008; moon.shadow.normalBias = 0.03;
  // fixed-count point lights so shaders never recompile mid-game
  muzzleLight = new THREE.PointLight(0xffc070, 0, 12, 1.6); scene.add(muzzleLight);
  for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffa060, 0, 26, 1.4); l.userData.t = 0; scene.add(l); BLAST_LIGHTS.push(l); }
  const sqL = new THREE.PointLight(0xffb070, 40, 30, 1.3); sqL.position.set(0, 6, 0); scene.add(sqL);
  FX = new Particles(3000, true); SMOKE = new Particles(900, false); scene.add(FX.points); scene.add(SMOKE.points);
  buildTextures(); buildWorld(scene); WORLD.cones = buildLampCones(scene, WORLD.lampHeads); makePortals(); makeTracers(scene);
  // viewmodel scene
  vmScene = new THREE.Scene(); vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
  vmScene.add(new THREE.HemisphereLight(0xa0a8d8, 0x403028, 1.0)); const vd = new THREE.DirectionalLight(0xffe6c0, 1.8); vd.position.set(1, 2, 1); vmScene.add(vd);
  const vmMuzzle = new THREE.PointLight(0xffb060, 0, 3, 1); vmMuzzle.position.set(0.2, -0.1, -0.6); vmScene.add(vmMuzzle); vmScene.userData.flash = vmMuzzle;
  gunRoot = new THREE.Group(); vmScene.add(gunRoot); vmScene.environment = makeGunEnv(renderer);
  VIEW = new Viewmodel(gunRoot); makeCasings(scene);
  applyQuality(); onResize();
}
function applyQuality() {
  const q = settings.quality, dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 1) * 0.7 : q === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 1.75));
  post.useBloom = q !== 'low'; wetSetQuality(q, renderer);
  const sh = q === 'high';
  if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; moon.castShadow = sh; S.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); }
  onResize();
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); const pr = renderer.getPixelRatio(); post.setSize(Math.floor(w * pr), Math.floor(h * pr)); wetResize(Math.floor(w * pr), Math.floor(h * pr));
  S.camera.aspect = w / h; S.camera.updateProjectionMatrix(); vmCam.aspect = w / h; vmCam.updateProjectionMatrix();
  const scale = h * pr * 0.5 * S.camera.projectionMatrix.elements[5];
  FX.mat.uniforms.uScale.value = scale; SMOKE.mat.uniforms.uScale.value = scale;
  $('#rotate').classList.toggle('hidden', !(IS_TOUCH && h > w && S.running));
}

/* ===== player ===== */
class Player {
  constructor() {
    this.pos = new THREE.Vector3(0, 1.7, 51); this.vel = V3(); this.yaw = 0; this.pitch = 0; this.hp = 100; this.alive = true; this.onGround = true;
    this.owned = ['pistol', 'shotgun']; this.cur = 'pistol'; this.ammo = {};
    W_ORDER.forEach(id => this.ammo[id] = { mag: WEAPONS[id].mag, res: WEAPONS[id].reserve === Infinity ? Infinity : Math.round(WEAPONS[id].reserve * 0.8) });
    this.fireCd = 0; this.reloadT = 0; this.swapT = 0; this.tea = 0; this.lastHurt = -99; this.aim = 0; this.kick = 0; this.kickV = 0; this.bob = 0; this.stepD = 0; this.spreadHeat = 0; this.dmgFlash = 0; this.deathT = 0;
    this.sway = { x: 0, y: 0 }; this.reloadDur = 1; this.reloadId = 0; this.pumpT = 0; this.sprintAmt = 0;
    this.showGun();
  }
  dmgMul() { return this.tea > 0 ? 1.3 : 1; }
  showGun() { VIEW.show(this.cur); }
  damage(d, from) {
    if (!this.alive || S.phase === 4) return;
    d = Math.max(1, d); this.hp -= d; this.lastHurt = S.time; this.dmgFlash = Math.min(1, this.dmgFlash + d / 25); S.shake = Math.max(S.shake, Math.min(0.5, d / 40));
    SND.hurt();
    if (from) { const a = Math.atan2(from.x - this.pos.x, from.z - this.pos.z), rel = Math.atan2(Math.sin(a - (this.yaw + Math.PI)), Math.cos(a - (this.yaw + Math.PI))); showDmgDir(rel); }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.deathT = 0; later(1.8, () => endGame(false)); }
  }
  collect(type) {
    if (type === 'health') { if (this.hp >= 100) return false; this.hp = Math.min(100, this.hp + 35); toast(T('tHealth'), '#ffd27a'); SND.pickup('health'); return true; }
    if (type === 'tea') { this.hp = Math.min(100, this.hp + 25); this.tea = 15; toast(T('tTea'), '#b7f5a5'); SND.pickup('tea'); return true; }
    if (type === 'ammo') {
      let need = false; for (const id of this.owned) if (AMMO_PICK[id] && this.ammo[id].res < WEAPONS[id].reserve) need = true;
      if (!need) return false;
      for (const id of W_ORDER) if (AMMO_PICK[id]) this.ammo[id].res = Math.min(WEAPONS[id].reserve, this.ammo[id].res + AMMO_PICK[id]);
      toast(T('tAmmo'), '#ffe082'); SND.pickup('ammo'); return true;
    }
    if (type.startsWith('weapon:')) {
      const id = type.split(':')[1]; if (!this.owned.includes(id)) { this.owned.push(id); this.owned.sort((a, b) => W_ORDER.indexOf(a) - W_ORDER.indexOf(b)); }
      this.ammo[id].mag = WEAPONS[id].mag; this.ammo[id].res = WEAPONS[id].reserve; this.switchTo(id);
      toast(T('tNewWeapon', { w: T(WEAPONS[id].name) }), '#e9c8ff'); SND.pickup('weapon'); return true;
    }
    return false;
  }
  switchTo(id) { if (!this.owned.includes(id) || id === this.cur) return; this.cur = id; this.swapT = 0.35; this.reloadT = 0; this.reloadId++; this.pumpT = 0; this.showGun(); SND.swap(); }
  cycle(dir) { const i = this.owned.indexOf(this.cur); this.switchTo(this.owned[(i + dir + this.owned.length) % this.owned.length]); }
  reload() {
    const w = WEAPONS[this.cur], a = this.ammo[this.cur]; if (this.reloadT > 0 || this.swapT > 0 || a.mag >= w.mag || a.res <= 0) return;
    const dur = this.reloadDur = this.cur === 'shotgun' ? 0.5 : w.reload; this.reloadT = dur;
    const id = ++this.reloadId, cur = this.cur, empty = a.mag === 0;
    const at = (f, fn) => later(f * dur, () => { if (this.reloadId === id && this.reloadT > 0 && this.cur === cur && S.player === this) fn(); });
    if (cur === 'rifle') { at(0.14, SND.magOut); at(0.6, SND.magIn); at(0.78, SND.bolt); }
    else if (cur === 'pistol') { at(0.1, SND.magOut); at(0.52, SND.magIn); if (empty) at(0.8, SND.slide); }
    else if (cur === 'shotgun') at(0.62, SND.shellIn);
    else { at(0.3, SND.magOut); at(0.66, SND.magIn); at(0.8, SND.bolt); }
  }
  finishReload() {
    const w = WEAPONS[this.cur], a = this.ammo[this.cur];
    if (this.cur === 'shotgun') {
      // one shell at a time; pump once the tube is full (or out of shells)
      a.mag++; if (a.res !== Infinity) a.res--;
      if (a.mag < w.mag && a.res > 0) this.reload();
      else { this.pumpT = 0.5; later(0.12, () => SND.pump()); }
      return;
    }
    const n = Math.min(w.mag - a.mag, a.res); a.mag += n; if (a.res !== Infinity) a.res -= n;
  }
  fire() {
    const w = WEAPONS[this.cur], a = this.ammo[this.cur];
    // a shotgun reload can be interrupted by firing once a shell is in
    if (this.reloadT > 0 && this.cur === 'shotgun' && a.mag > 0 && this.fireCd <= 0) { this.reloadT = 0; this.reloadId++; }
    if (this.reloadT > 0 || this.swapT > 0 || this.fireCd > 0 || this.pumpT > 0.15) return;
    if (a.mag <= 0) { if (a.res > 0) this.reload(); else { SND.empty(); this.fireCd = 0.3; if (S.time - (this.noAmmoT || 0) > 2) { toast(T('tNoAmmo'), '#ff9b7a'); this.noAmmoT = S.time; } } return; }
    a.mag--; this.fireCd = w.rate; S.shots++;
    SND.shot(w.sound);
    const cam = S.camera, o = cam.position.clone(), fwd = V3().set(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = V3().set(1, 0, 0).applyQuaternion(cam.quaternion), up = V3().set(0, 1, 0).applyQuaternion(cam.quaternion);
    const muzzleW = VIEW.muzzleWorld();
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1 ? 1 : 0;
    const spread = (w.spread + w.moveSpread * moving + this.spreadHeat * 0.02) * (1 - this.aim * 0.6) * (this.onGround ? 1 : 1.6);
    if (w.rocket) spawnRocket(muzzleW, fwd);
    else for (let i = 0; i < w.pellets; i++) {
      const d = fwd.clone().addScaledVector(right, (Math.random() - 0.5) * 2 * spread).addScaledVector(up, (Math.random() - 0.5) * 2 * spread).normalize();
      hitscan(o, d, w.dmg, muzzleW, w.tracer);
    }
    this.kickV += w.kick * (1 - this.aim * 0.4); this.spreadHeat = Math.min(1, this.spreadHeat + (this.cur === 'rifle' ? 0.12 : 0.2));
    VIEW.onFire(this);
    muzzleLight.position.copy(muzzleW); muzzleLight.intensity = 25; vmScene.userData.flash.intensity = 6;
    if (a.mag === 0 && a.res > 0) later(0.25, () => { if (S.player === this && this.ammo[this.cur].mag === 0) this.reload(); });
  }
  update(dt, inp) {
    if (!this.alive) { this.deathT += dt; this.pos.y = Math.max(0.4, this.pos.y - dt * 2); this.pitch = lerp(this.pitch, 0.4, dt * 2); return; }
    // look
    const sens = 0.0022 * settings.sens * (1 - this.aim * 0.35);
    this.yaw -= inp.lookX * sens; this.pitch -= inp.lookY * sens * (settings.invert ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.5, 1.5);
    this.sway.x = lerp(this.sway.x, clamp(inp.lookX * 0.0006, -0.05, 0.05), dt * 10); this.sway.y = lerp(this.sway.y, clamp(inp.lookY * 0.0006, -0.05, 0.05), dt * 10);
    // aim
    this.aim = lerp(this.aim, inp.aim && this.reloadT <= 0 ? 1 : 0, Math.min(1, dt * 12));
    // move
    let mx = inp.moveX, mz = inp.moveY; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const sprint = inp.sprint && mz > 0.3 && this.aim < 0.3;
    this.sprintAmt = lerp(this.sprintAmt, sprint && this.onGround && this.reloadT <= 0 ? 1 : 0, Math.min(1, dt * 8));
    const speed = 6.2 * (sprint ? 1.5 : 1) * (1 - this.aim * 0.4) * (this.tea > 0 ? 1.25 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const wx = (fx * mz + rx * mx) * speed, wz = (fz * mz + rz * mx) * speed, acc = this.onGround ? 12 : 3;
    this.vel.x = lerp(this.vel.x, wx, Math.min(1, dt * acc)); this.vel.z = lerp(this.vel.z, wz, Math.min(1, dt * acc));
    if (inp.jump && this.onGround) { this.vel.y = 7; this.onGround = false; SND.jump(); }
    this.vel.y -= 22 * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 1.7) { if (!this.onGround && this.vel.y < -6) SND.step(true); this.pos.y = 1.7; this.vel.y = 0; this.onGround = true; }
    collide(this.pos, 0.4);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 0.5) { this.bob += dt * hs * 1.6; this.stepD += hs * dt; if (this.stepD > (sprint ? 2.6 : 2.1)) { this.stepD = 0; SND.step(sprint); } }
    // weapon timers
    this.fireCd -= dt; this.spreadHeat = Math.max(0, this.spreadHeat - dt * 2.5);
    if (this.swapT > 0) this.swapT -= dt;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(); }
    if (inp.fire) this.fire();
    if (inp.reload) this.reload();
    if (inp.swap) this.cycle(inp.swap);
    if (inp.slot && this.owned[inp.slot - 1]) this.switchTo(this.owned[inp.slot - 1]);
    // recoil spring
    this.kick += this.kickV; this.kickV = 0; this.kick = lerp(this.kick, 0, Math.min(1, dt * 9));
    // healing
    if (this.tea > 0) { this.tea -= dt; this.hp = Math.min(100, this.hp + dt * 3); }
    if (S.diff.regen > 0 && S.time - this.lastHurt > S.diff.regenDelay && this.hp < 100) this.hp = Math.min(100, this.hp + S.diff.regen * dt);
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 1.5);
  }
  applyCamera(dt) {
    const cam = S.camera, sh = S.shake * S.shake;
    const bobY = Math.sin(this.bob * 2) * 0.05 * (this.onGround ? 1 : 0), bobX = Math.cos(this.bob) * 0.03;
    cam.position.set(this.pos.x + bobX * Math.cos(this.yaw), this.pos.y + bobY, this.pos.z - bobX * Math.sin(this.yaw));
    cam.rotation.set(this.pitch + this.kick + (Math.random() - 0.5) * sh * 0.08, this.yaw + (Math.random() - 0.5) * sh * 0.08, (Math.random() - 0.5) * sh * 0.05);
    const fov = settings.fov * (1 - this.aim * (this.cur === 'rifle' ? 0.38 : 0.25)) * (1 + Math.min(0.08, Math.hypot(this.vel.x, this.vel.z) > 8 ? 0.06 : 0));
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 12)); cam.updateProjectionMatrix(); }
    SND.listener(this.pos.x, this.pos.z, this.yaw);
    // viewmodel
    VIEW.update(dt, this, bobX, bobY);
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 400); vmScene.userData.flash.intensity = Math.max(0, vmScene.userData.flash.intensity - dt * 100);
  }
}

/* ===== input ===== */
const keys = {}; const inp = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, aim: false, jump: false, reload: false, swap: 0, slot: 0, sprint: false };
const mouse = { dx: 0, dy: 0, l: false, r: false, wheel: 0 };
const touch = { stickId: null, sx: 0, sy: 0, jx: 0, jy: 0, lookId: null, lx: 0, ly: 0, fireId: null, fx: 0, fy: 0, dx: 0, dy: 0, aim: false, jump: false, reload: false, swap: 0 };
let padPrev = [], lockAt = 0;
function locked() { return document.pointerLockElement === renderer.domElement; }
function requestLock() { if (IS_TOUCH) return; try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
function setupInput() {
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (S.running && !S.paused) {
      if (e.code === 'KeyR') inp.reloadQ = true;
      if (/^Digit[1-4]$/.test(e.code)) inp.slotQ = +e.code.slice(5);
      if (e.code === 'KeyQ') inp.swapQ = -1;
      if (e.code === 'KeyE') inp.swapQ = 1;
      if (e.code === 'Space') e.preventDefault();
    }
    if ((e.code === 'Escape' || e.code === 'KeyP') && S.running) { if (S.paused) { if (e.code === 'KeyP') resume(); } else pauseGame(); }
  });
  addEventListener('keyup', e => keys[e.code] = false);
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; if (S.running && !S.paused && !IS_TOUCH) pauseGame(); });
  const cv = renderer.domElement;
  cv.addEventListener('mousedown', e => { if (!S.running || S.paused) return; if (!locked()) { requestLock(); return; } if (e.button === 0) mouse.l = true; if (e.button === 2) mouse.r = true; });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
  addEventListener('mousemove', e => { if (!locked()) return; if (performance.now() - lockAt < 120 || Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return; mouse.dx += e.movementX; mouse.dy += e.movementY; });
  addEventListener('wheel', e => { if (S.running && locked()) mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { if (locked()) lockAt = performance.now(); if (!locked() && S.running && !S.paused && S.player && S.player.alive && !IS_TOUCH) pauseGame(); updateLockHint(); });
  // touch
  const stick = $('#tStick'), knob = $('#tKnob');
  const tStart = (el, fn) => el.addEventListener('touchstart', e => { e.preventDefault(); SND.init(); for (const t of e.changedTouches) fn(t); }, { passive: false });
  tStart(stick, t => { if (touch.stickId !== null) return; touch.stickId = t.identifier; const r = stick.getBoundingClientRect(); touch.sx = r.left + r.width / 2; touch.sy = r.top + r.height / 2; moveStick(t); });
  tStart($('#tLook'), t => { if (touch.lookId !== null) return; touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; });
  tStart($('#tFire'), t => { touch.fireId = t.identifier; touch.fx = t.clientX; touch.fy = t.clientY; $('#tFire').classList.add('on'); });
  tStart($('#tAim'), () => { touch.aim = !touch.aim; $('#tAim').classList.toggle('on', touch.aim); });
  tStart($('#tJump'), () => touch.jump = true);
  tStart($('#tReload'), () => touch.reload = true);
  tStart($('#tSwap'), () => touch.swap = 1);
  tStart($('#tPause'), () => pauseGame());
  function moveStick(t) { let dx = t.clientX - touch.sx, dy = t.clientY - touch.sy; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; } touch.jx = dx / m; touch.jy = -dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; }
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) moveStick(t);
      if (t.identifier === touch.lookId) { touch.dx += t.clientX - touch.lx; touch.dy += t.clientY - touch.ly; touch.lx = t.clientX; touch.ly = t.clientY; }
      if (t.identifier === touch.fireId) { touch.dx += t.clientX - touch.fx; touch.dy += t.clientY - touch.fy; touch.fx = t.clientX; touch.fy = t.clientY; }
    }
    if (S.running) e.preventDefault();
  }, { passive: false });
  const tEnd = e => { for (const t of e.changedTouches) { if (t.identifier === touch.stickId) { touch.stickId = null; touch.jx = touch.jy = 0; knob.style.transform = ''; } if (t.identifier === touch.lookId) touch.lookId = null; if (t.identifier === touch.fireId) { touch.fireId = null; $('#tFire').classList.remove('on'); } } };
  addEventListener('touchend', tEnd); addEventListener('touchcancel', tEnd);
}
function updateLockHint() { $('#lockhint').classList.toggle('hidden', IS_TOUCH || !S.running || S.paused || locked() || !S.player || !S.player.alive); }
function pollInput() {
  const k = c => keys[c] ? 1 : 0;
  inp.moveX = k('KeyD') - k('KeyA') + k('ArrowRight') - k('ArrowLeft') + touch.jx;
  inp.moveY = k('KeyW') - k('KeyS') + k('ArrowUp') - k('ArrowDown') + touch.jy;
  inp.lookX = mouse.dx + touch.dx * 2.2 * settings.touchSens / settings.sens; inp.lookY = mouse.dy + touch.dy * 2.2 * settings.touchSens / settings.sens;
  mouse.dx = mouse.dy = 0; touch.dx = touch.dy = 0;
  inp.fire = mouse.l || touch.fireId !== null; inp.aim = mouse.r || touch.aim;
  inp.jump = !!keys.Space || touch.jump; touch.jump = false;
  inp.sprint = !!(keys.ShiftLeft || keys.ShiftRight) || Math.hypot(touch.jx, touch.jy) > 0.95;
  inp.reload = !!inp.reloadQ || touch.reload; inp.reloadQ = false; touch.reload = false;
  inp.swap = (inp.swapQ || 0) + touch.swap + (mouse.wheel ? Math.sign(mouse.wheel) : 0); inp.swapQ = 0; touch.swap = 0; mouse.wheel = 0;
  inp.slot = inp.slotQ || 0; inp.slotQ = 0;
  // gamepad
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || p.mapping !== 'standard') continue;
    const dz = v => Math.abs(v) < 0.15 ? 0 : v, b = i => p.buttons[i] && p.buttons[i].pressed, was = i => padPrev[i];
    inp.moveX += dz(p.axes[0]); inp.moveY -= dz(p.axes[1]);
    const lx = dz(p.axes[2]), ly = dz(p.axes[3]);
    inp.lookX += Math.sign(lx) * lx * lx * 22 * settings.sens; inp.lookY += Math.sign(ly) * ly * ly * 16 * settings.sens;
    if (b(7)) inp.fire = true; if (b(6)) inp.aim = true; if (b(0)) inp.jump = true; if (b(10)) inp.sprint = true;
    if (b(2) && !was(2)) inp.reload = true; if ((b(3) && !was(3)) || (b(5) && !was(5))) inp.swap = 1; if (b(4) && !was(4)) inp.swap = -1;
    if (b(9) && !was(9)) { if (S.paused) resume(); else if (S.running) pauseGame(); }
    padPrev = p.buttons.map(x => x.pressed);
    break;
  }
}

/* ===== HUD helpers ===== */
let bannerTimer = 0;
function banner(a, b, dur = 3.2) { const el = $('#banner'); el.querySelector('.b1').textContent = a; el.querySelector('.b2').textContent = b || ''; el.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => el.classList.remove('show'), dur * 1000); }
function toast(text, color) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = text; if (color) el.style.color = color; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 2300); while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove(); }
let hmT = 0;
function hitMarker(kill) { const el = $('#hitmark'); el.classList.toggle('kill', !!kill); el.style.opacity = 1; hmT = kill ? 0.25 : 0.12; SND.hit(kill); }
const dmgDirT = { l: 0, r: 0, t: 0, b: 0 };
function showDmgDir(rel) { const a = Math.abs(rel); if (a < Math.PI / 4) dmgDirT.t = 1; else if (a > Math.PI * 0.75) dmgDirT.b = 1; else if (rel > 0) dmgDirT.l = 1; else dmgDirT.r = 1; }
function addScore(v, pos) { S.score += Math.round(v * S.diff.mul); }
function fmtTime(t) { t = Math.floor(t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }

let mmBase = null;
function buildMinimapBase() {
  const c = mkCanvas(256, 256), g = c.getContext('2d'), s = 256 / G;
  g.fillStyle = '#0d0a14'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < G; r++) for (let cc = 0; cc < G; cc++) { const v = grid[r * G + cc]; g.fillStyle = v === 1 ? '#2a2236' : v === 2 ? '#7a6a50' : '#5a5368'; g.fillRect(cc * s, r * s, s + 0.5, s + 0.5); }
  mmBase = c;
}
function drawMinimap() {
  const cv = $('#minimap'), g = cv.getContext('2d'), W = cv.width, P = S.player.pos, scale = W / 110; // 110 m across
  g.clearRect(0, 0, W, W); g.save(); g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, TAU); g.clip();
  g.fillStyle = '#0d0a14'; g.fillRect(0, 0, W, W);
  g.translate(W / 2, W / 2); g.rotate(S.player.yaw); g.scale(scale, scale); g.translate(-P.x, -P.z);
  g.globalAlpha = 0.9; g.drawImage(mmBase, -HALF, -HALF, HALF * 2, HALF * 2); g.globalAlpha = 1;
  for (const p of S.pickups) { g.fillStyle = p.type === 'tea' ? '#9be36b' : p.type === 'health' ? '#ffd27a' : p.type.startsWith('weapon') ? '#e9c8ff' : '#ffe082'; g.fillRect(p.pos.x - 0.9, p.pos.z - 0.9, 1.8, 1.8); }
  for (const p of S.portals) if (p.alive) { g.fillStyle = '#c050ff'; g.beginPath(); g.arc(p.def.x, p.def.z, 3.2, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 0.6; g.stroke(); }
  g.fillStyle = '#ff4a3c'; for (const e of S.enemies) if (!e.dead) { g.beginPath(); g.arc(e.pos.x, e.pos.z, e.type === 'brute' ? 1.6 : 1.1, 0, TAU); g.fill(); }
  if (S.boss && S.boss.alive) { g.fillStyle = '#ff40d0'; g.beginPath(); g.arc(S.boss.head.x, S.boss.head.z, 3, 0, TAU); g.fill(); }
  g.restore();
  // player arrow (always pointing up)
  g.fillStyle = '#ffd76a'; g.beginPath(); g.moveTo(W / 2, W / 2 - 8); g.lineTo(W / 2 - 5, W / 2 + 6); g.lineTo(W / 2 + 5, W / 2 + 6); g.closePath(); g.fill();
}

function objectiveTarget() {
  if (S.phase === 1) { let best = null, bd = 1e9; for (const p of S.portals) if (p.alive) { const d = Math.hypot(p.def.x - S.player.pos.x, p.def.z - S.player.pos.z); if (d < bd) { bd = d; best = p; } } return best ? best.center : null; }
  if (S.phase === 2 && S.wave.state === 'goto') return _v2.set(0, 1.5, 0);
  return null;
}
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
let mmT = 0;
function updateHUD(dt) {
  const p = S.player, w = WEAPONS[p.cur], a = p.ammo[p.cur];
  $('#hpfill').style.width = p.hp + '%'; $('#hpfill').classList.toggle('low', p.hp < 30); setText('#hpnum', String(Math.ceil(p.hp)));
  setText('#ammoMag', p.reloadT > 0 ? '...' : String(a.mag)); setText('#ammoRes', '/ ' + (a.res === Infinity ? '∞' : a.res)); setText('#wepname', T(w.name));
  $('#reloadhint').classList.toggle('hidden', !(a.mag === 0 && a.res > 0 && p.reloadT <= 0) || IS_TOUCH);
  const wl = p.owned.map((id, i) => `<span class="${id === p.cur ? 'on' : ''}">${i + 1} ${T(WEAPONS[id].name)}</span>`).join('');
  if (hudCache.wl !== wl) { hudCache.wl = wl; $('#weplist').innerHTML = wl; }
  setText('#score', String(S.score)); setText('#timer', fmtTime(S.time));
  $('#buff').classList.toggle('hidden', p.tea <= 0); if (p.tea > 0) setText('#buff', T('buffTea', { t: Math.ceil(p.tea) }));
  // objective text
  let o1 = '', o2 = '';
  if (S.phase === 1) { const n = S.portals.filter(x => !x.alive).length; o1 = T('objPortals', { n }); const t = objectiveTarget(); const pt = t && S.portals.find(x => x.center === t); o2 = pt ? T('objPortalsSub', { s: pt.def.street }) : ''; }
  else if (S.phase === 2) { const W2 = S.wave; if (W2.state === 'goto') { o1 = T('objGoSquare'); o2 = T('objGoSquareSub'); } else if (W2.state === 'active') { o1 = T('objWave', { w: W2.n }); o2 = T('objWaveSub', { n: W2.toSpawn + S.enemies.filter(e => !e.dead).length }); } else { o1 = T('objWave', { w: W2.n }); o2 = T('objNext', { t: Math.ceil(W2.breakT) }); } }
  else if (S.phase === 3) { o1 = T('objBoss'); o2 = T('objBossSub'); }
  setText('#objective', o1); setText('#objsub', o2);
  // boss / portal bars
  const bossOn = S.boss && S.boss.alive; $('#bossbar').classList.toggle('hidden', !bossOn); if (bossOn) $('#bossfill').style.width = (S.boss.hp / S.boss.maxHp * 100) + '%';
  let near = null; for (const pt of S.portals) if (pt.alive && pt.center.distanceTo(p.pos) < 26) near = pt;
  $('#portalbar').classList.toggle('hidden', !near || bossOn); if (near) $('#portalfill').style.width = (near.hp / near.maxHp * 100) + '%';
  // crosshair spread
  const sp = (w.spread + (Math.hypot(p.vel.x, p.vel.z) > 1 ? w.moveSpread : 0) + p.spreadHeat * 0.02) * (1 - p.aim * 0.6);
  $('#cross').style.setProperty('--g', (4 + sp * 400) + 'px'); $('#cross').style.opacity = w.rocket && p.aim > 0.5 ? 0.6 : 1 - p.aim * 0.3;
  hmT -= dt; if (hmT <= 0) $('#hitmark').style.opacity = 0;
  for (const k in dmgDirT) { dmgDirT[k] = Math.max(0, dmgDirT[k] - dt * 1.4); $('#dmg' + k.toUpperCase()).style.opacity = dmgDirT[k]; }
  // waypoint
  const tgt = objectiveTarget(), wp = $('#waypoint');
  if (tgt) {
    const v = _v.copy(tgt).project(S.camera); let x = v.x, y = v.y; const behind = v.z > 1;
    if (behind) { x = -x; y = -y; }
    const m = Math.max(Math.abs(x), Math.abs(y)); if (behind || m > 0.9) { x = x / m * 0.9; y = y / m * 0.9; }
    wp.style.display = ''; wp.style.left = ((x + 1) / 2 * innerWidth) + 'px'; wp.style.top = ((1 - y) / 2 * innerHeight) + 'px';
    wp.querySelector('.wp-dist').textContent = Math.round(Math.hypot(tgt.x - p.pos.x, tgt.z - p.pos.z)) + 'm';
  } else wp.style.display = 'none';
  mmT -= dt; if (mmT <= 0) { mmT = 0.08; drawMinimap(); }
}

/* ===== game flow ===== */
const MAX_ENEMIES = 28;
let timers = [];
function later(sec, fn) { timers.push({ t: S.time + sec, fn }); }
function runTimers() { const due = timers.filter(x => x.t <= S.time); timers = timers.filter(x => x.t > S.time); due.forEach(x => x.fn()); }
S.wave = { state: 'goto', n: 0, toSpawn: 0, spawnT: 0, breakT: 0 };
let dirT = 0;
function spawnEnemy(type, x, z) { if (S.enemies.filter(e => !e.dead).length >= MAX_ENEMIES) return null; const e = new Enemy(type, x, z); S.enemies.push(e); return e; }
function pickType(level) {
  const W = [[0.72, 0.2, 0.08, 0], [0.5, 0.24, 0.14, 0.12], [0.4, 0.25, 0.15, 0.2], [0.34, 0.26, 0.16, 0.24]][Math.min(3, level)];
  let r = Math.random(); const types = ['imp', 'wisp', 'bomber', 'brute'];
  for (let i = 0; i < 4; i++) { r -= W[i]; if (r <= 0) return types[i]; } return 'imp';
}
function farSpawn(minD, maxD, around) {
  const c = around || S.player.pos, P = S.player.pos;
  const cands = spawnPoints.filter(p => { const d = Math.hypot(p.x - c.x, p.z - c.z), dp = Math.hypot(p.x - P.x, p.z - P.z); return d > minD && d < maxD && dp > 16; });
  if (!cands.length) return null;
  // prefer points the player cannot see
  for (let i = 0; i < 6; i++) { const p = pick(cands); if (!losClear(P.x, P.z, p.x, p.z)) return p; }
  return pick(cands);
}
function director(dt) {
  const alive = S.enemies.filter(e => !e.dead).length, P = S.player.pos;
  if (S.phase === 1) {
    const broken = S.portals.filter(p => !p.alive).length;
    const target = Math.round(S.diff.count * (5 + broken * 2.5));
    dirT -= dt;
    if (dirT <= 0 && alive < target) {
      dirT = 1.6 / S.diff.count;
      const sp = farSpawn(20, 46); if (sp) spawnEnemy(pickType(broken), sp.x + rand(-1, 1), sp.z + rand(-1, 1));
    }
    for (const p of S.portals) {
      if (!p.alive) continue; const d = Math.hypot(p.def.x - P.x, p.def.z - P.z);
      if (d < 34) { p.spawnT -= dt; if (p.spawnT <= 0) { p.spawnT = 4.2 / S.diff.count; if (alive < target + 4) { const a = Math.random() * TAU; spawnEnemy(pickType(broken + 1), p.def.x + Math.cos(a) * 2.5, p.def.z + Math.sin(a) * 2.5); FX.burst(p.center, 30, 8, 0.6, 0.4, 0.05, COL.purple, 0, 2); } } }
    }
  } else if (S.phase === 2) {
    const W = S.wave;
    if (W.state === 'goto') { if (inSquare(P.x, P.z)) startWave(1); }
    else if (W.state === 'active') {
      W.spawnT -= dt;
      if (W.toSpawn > 0 && W.spawnT <= 0 && alive < 12 * S.diff.count) {
        W.spawnT = 0.85 / S.diff.count; const sp = farSpawn(20, 36, _v2.set(0, 0, 0));
        if (sp) { const t = W.n === 3 && W.toSpawn % 6 === 0 ? 'brute' : pickType(W.n); if (spawnEnemy(t, sp.x, sp.z)) W.toSpawn--; }
      }
      if (W.toSpawn <= 0 && alive === 0) {
        banner(T('bnWaveClear'), ''); SND.pickup('weapon');
        spawnPickup('ammo', rand(-6, 6), 6); spawnPickup('health', rand(-6, 6), -6);
        if (W.n === 2) spawnPickup('tea', 6, rand(-6, 6));
        if (W.n >= 3) { W.state = 'done'; later(4, startBoss); } else { W.state = 'break'; W.breakT = 8; }
      }
    } else if (W.state === 'break') { W.breakT -= dt; if (W.breakT <= 0) startWave(W.n + 1); }
  }
}
function startWave(n) {
  const W = S.wave; W.n = n; W.state = 'active'; W.toSpawn = Math.round([10, 14, 18][n - 1] * S.diff.count); W.spawnT = 1;
  SND.gong(); banner(T('bnWave', { w: n }), T('bnWaveSub'));
  if (n === 1) MUSIC.play('battle');
}
function onPortalDestroyed() {
  const left = S.portals.filter(p => p.alive).length;
  if (left > 0) banner(T('bnPortal'), T('objPortals', { n: 3 - left }));
  else { S.phase = 2; S.wave.state = 'goto'; banner(T('bnAllPortals'), T('bnAllPortalsSub'), 4.5); }
}
function startBoss() {
  if (!S.running || S.phase !== 2) return;
  S.phase = 3; S.boss = new Boss(); banner(T('bnBoss'), T('bnBossSub'), 4); MUSIC.play('boss'); SND.gong();
}
function onBossDefeated() {
  S.phase = 4; MUSIC.play('victory'); banner(T('victory'), '', 5);
  for (const e of S.enemies) if (!e.dead) removeEnemy(e, false);
  // a last celebration of fireworks over the square
  for (let i = 0; i < 10; i++) later(i * 0.38, () => explosion(new THREE.Vector3(rand(-14, 14), rand(14, 22), rand(-14, 14)), 0.1, 0, 0, true, null));
  later(4.5, () => endGame(true));
}

function clearWorld() {
  timers = [];
  for (const e of S.enemies) S.scene.remove(e.g); S.enemies.length = 0;
  for (const s of S.eshots) S.scene.remove(s.m); S.eshots.length = 0;
  for (const r of S.rockets) S.scene.remove(r.g); S.rockets.length = 0;
  for (const p of S.pickups) S.scene.remove(p.m); S.pickups.length = 0;
  if (S.boss) { S.boss.remove(); S.boss = null; }
  FX.clear(); SMOKE.clear();
}
function startGame(diffKey) {
  clearWorld();
  S.diffKey = diffKey; S.diff = DIFFS[diffKey]; S.time = 0; S.score = 0; S.kills = 0; S.shots = 0; S.hits = 0; S.shake = 0; S.phase = 1;
  S.wave = { state: 'goto', n: 0, toSpawn: 0, spawnT: 0, breakT: 0 };
  S.player = new Player(); resetPortals(); updateFlow(S.player.pos.x, S.player.pos.z, true);
  // supplies scattered around the quarter
  const sp = spawnPoints.filter(p => Math.hypot(p.x, p.z - 51) > 15);
  for (let i = 0; i < 6; i++) { const p = pick(sp); spawnPickup('ammo', p.x, p.z); }
  for (let i = 0; i < 4; i++) { const p = pick(sp); spawnPickup('health', p.x, p.z); }
  for (let i = 0; i < 3; i++) { const p = pick(sp); spawnPickup('tea', p.x, p.z); }
  spawnPickup('tea', 3, 47);
  S.running = true; S.paused = false; dirT = 3;
  showScreen(null); $('#hud').classList.remove('hidden'); $('#touch').classList.toggle('hidden', !IS_TOUCH);
  MUSIC.play('battle'); banner(T('bnStart'), T('bnStartSub'), 4);
  requestLock(); updateLockHint(); onResize();
  if (IS_TOUCH) { try { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => { })).call(d); screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }
}
function pauseGame() {
  if (!S.running || S.paused) return; S.paused = true; showScreen('pause'); updateLockHint();
  if (locked()) document.exitPointerLock();
}
function resume() { if (!S.running) return; S.paused = false; showScreen(null); requestLock(); updateLockHint(); }
function quitToMenu() { S.running = false; S.paused = false; clearWorld(); $('#hud').classList.add('hidden'); $('#touch').classList.add('hidden'); if (locked()) document.exitPointerLock(); showScreen('menu'); MUSIC.play('menu'); onResize(); }
let lastResult = null;
function endGame(win) {
  if (!S.running) return;
  S.running = false; if (locked()) document.exitPointerLock();
  $('#hud').classList.add('hidden'); $('#touch').classList.add('hidden');
  let bonus = 0; if (win) bonus = Math.round((Math.max(0, 600 - S.time) * 8 + S.player.hp * 20) * S.diff.mul);
  S.score += bonus;
  lastResult = { win, score: S.score, time: S.time, kills: S.kills, acc: S.shots ? S.hits / S.shots : 0, diff: S.diffKey, bonus, saved: false };
  fillOver();
  if (win) { showCredits(true); } else { MUSIC.play('menu'); showScreen('over'); }
}
function fillOver() {
  const r = lastResult; if (!r) return;
  $('#overTitle').textContent = r.win ? T('victory') : T('defeat');
  $('#overStats').innerHTML = [[T('stScore'), r.score], [T('stKills'), r.kills], [T('stTime'), fmtTime(r.time)], [T('stAcc'), Math.round(r.acc * 100) + '%'], [T('stDiff'), T({ easy: 'dEasy', normal: 'dNormal', hard: 'dHard' }[r.diff])], ...(r.win ? [[T('stBonus'), '+' + r.bonus]] : [])].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  $('#nameIn').value = store.get('bvhn_name', T('defName')); $('#saveRow').classList.toggle('hidden', r.saved); $('#savedMsg').classList.toggle('hidden', !r.saved);
}
function saveScore() {
  const r = lastResult; if (!r || r.saved) return;
  const name = ($('#nameIn').value || T('defName')).trim().slice(0, 16); store.set('bvhn_name', name);
  const lb = store.get('bvhn_lb', { easy: [], normal: [], hard: [] }); const list = lb[r.diff] || (lb[r.diff] = []);
  const entry = { n: name, s: r.score, t: Math.round(r.time), w: r.win, d: new Date().toISOString().slice(0, 10), id: Date.now() };
  list.push(entry); list.sort((a, b) => b.s - a.s); lb[r.diff] = list.slice(0, 10); store.set('bvhn_lb', lb);
  const rank = lb[r.diff].findIndex(e => e.id === entry.id) + 1;
  r.saved = true; $('#saveRow').classList.add('hidden'); const m = $('#savedMsg'); m.classList.remove('hidden');
  m.textContent = rank > 0 ? T('saved', { r: rank, d: T({ easy: 'dEasy', normal: 'dNormal', hard: 'dHard' }[r.diff]) }) : '';
  lbTab = r.diff;
}

/* ===== screens ===== */
let screenStack = [], lbTab = 'normal', creditsAfter = null;
function showScreen(id) { $$('.screen').forEach(s => s.classList.toggle('show', s.id === id)); S.screen = id; }
function openScreen(id) { screenStack.push(S.screen); showScreen(id); }
function back() { const prev = screenStack.pop(); showScreen(prev === undefined ? 'menu' : prev); }
function renderLB() {
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.lb === lbTab));
  const lb = store.get('bvhn_lb', { easy: [], normal: [], hard: [] }), list = lb[lbTab] || [];
  $('#lbTable').innerHTML = list.length ? `<tr><th>${T('rank')}</th><th>${T('name')}</th><th>${T('score')}</th><th>${T('time')}</th><th>${T('result')}</th><th>${T('date')}</th></tr>` + list.map((e, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(e.n)}</td><td>${e.s}</td><td>${fmtTime(e.t)}</td><td>${e.w ? T('win') : T('lose')}</td><td>${e.d}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--mut);padding:20px">${T('empty')}</td></tr>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let creditsTimer = 0;
function showCredits(afterGame) {
  creditsAfter = afterGame ? 'over' : null; if (!afterGame) screenStack.push(S.screen);
  showScreen('credits'); const roll = $('#roll'); roll.style.animation = 'none'; void roll.offsetWidth; roll.style.animation = '';
  clearTimeout(creditsTimer); creditsTimer = setTimeout(closeCredits, 34500);
}
function closeCredits() { clearTimeout(creditsTimer); if (S.screen !== 'credits') return; if (creditsAfter) { creditsAfter = null; MUSIC.play('menu'); showScreen('over'); } else back(); }
function bindSettings() {
  const bind = (id, key, fmt, num = true) => { const el = $(id), out = $('#v' + id.slice(2)); el.value = settings[key]; const upd = () => { settings[key] = num ? +el.value : el.value; if (out) out.textContent = fmt ? fmt(settings[key]) : settings[key]; saveSettings(); onSetting(key); }; el.addEventListener('input', upd); if (out) out.textContent = fmt ? fmt(settings[key]) : settings[key]; };
  bind('#sSens', 'sens', v => v.toFixed(2)); bind('#sTouchSens', 'touchSens', v => v.toFixed(2)); bind('#sFov', 'fov', v => v + '°');
  bind('#sMusic', 'music', v => Math.round(v * 100) + '%'); bind('#sSfx', 'sfx', v => Math.round(v * 100) + '%');
  bind('#sLang', 'lang', null, false); bind('#sQuality', 'quality', null, false);
  $('#sInvert').checked = settings.invert; $('#sInvert').addEventListener('change', e => { settings.invert = e.target.checked; saveSettings(); });
  $('#sFps').checked = settings.fps; $('#sFps').addEventListener('change', e => { settings.fps = e.target.checked; saveSettings(); $('#fps').classList.toggle('hidden', !settings.fps); });
}
function onSetting(k) {
  if (k === 'music' || k === 'sfx') SND.volumes();
  if (k === 'lang') { applyLang(); $('#sLang').value = settings.lang; renderLB(); fillOver(); }
  if (k === 'quality') applyQuality();
  if (k === 'fov' && S.camera) { S.camera.fov = settings.fov; S.camera.updateProjectionMatrix(); onResize(); }
}
function setupUI() {
  applyLang(); bindSettings(); $('#fps').classList.toggle('hidden', !settings.fps);
  if (IS_TOUCH) document.body.classList.add('touch');
  $('#splash').addEventListener('click', () => { SND.init(); MUSIC.play('menu'); showScreen('menu'); SND.ui(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act],[data-diff],[data-lang],[data-lb]'); if (!b) return;
    SND.init(); SND.ui();
    if (b.dataset.lang) { settings.lang = b.dataset.lang; saveSettings(); onSetting('lang'); return; }
    if (b.dataset.lb) { lbTab = b.dataset.lb; renderLB(); return; }
    if (b.dataset.diff) { store.set('bvhn_diff', b.dataset.diff); screenStack = []; startGame(b.dataset.diff); return; }
    const act = b.dataset.act;
    if (act === 'play') openScreen('diff');
    else if (act === 'leader') { renderLB(); openScreen('leader'); }
    else if (act === 'settings') { $('#sLang').value = settings.lang; $('#sQuality').value = settings.quality; openScreen('settings'); }
    else if (act === 'howto') openScreen('howto');
    else if (act === 'credits') showCredits(false);
    else if (act === 'back') { if (S.screen === 'credits') closeCredits(); else back(); }
    else if (act === 'resume') resume();
    else if (act === 'quit') { screenStack = []; quitToMenu(); }
    else if (act === 'save') saveScore();
    else if (act === 'again') { screenStack = []; startGame(lastResult ? lastResult.diff : 'normal'); }
    else if (act === 'menu') { screenStack = []; showScreen('menu'); MUSIC.play('menu'); }
  });
  $('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') saveScore(); e.stopPropagation(); });
  const lastDiff = store.get('bvhn_diff', 'normal'); const card = document.querySelector(`[data-diff="${lastDiff}"]`); if (card) card.style.borderColor = 'var(--gold)';
}

/* ===== main loop ===== */
function tick(dt) {
    S.time += dt; runTimers(); if (!S.running) return; pollInput(); const P = S.player;
    P.update(dt, inp); updateFlow(P.pos.x, P.pos.z, false);
    director(dt);
    for (let i = S.enemies.length - 1; i >= 0; i--) if (S.enemies[i].update(dt)) { S.scene.remove(S.enemies[i].g); S.enemies.splice(i, 1); }
    if (S.boss) S.boss.update(dt);
    updateShots(dt); updateRockets(dt); updatePickups(dt); updatePortals(dt); updateTracers(dt); updateCasings(dt);
    S.shake = Math.max(0, S.shake - dt * 1.6);
    P.applyCamera(dt);
    moon.position.set(P.pos.x - 40, 70, P.pos.z - 60); moon.target.position.set(P.pos.x, 0, P.pos.z);
    updateHUD(dt);
    post.comp.uniforms.uDmg.value = Math.min(1, P.dmgFlash); post.comp.uniforms.uLow.value = P.hp < 35 ? (1 - P.hp / 35) : 0; post.comp.uniforms.uTea.value = P.tea > 0 ? Math.min(1, P.tea / 2) : 0;
}
let lastT = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0;
// cinematic menu shots: [from, to, look-from, look-to, fov]
const MENU_SHOTS = [
  [[0.6, 2.1, 57], [0.2, 2.3, 45], [0, 3.2, 20], [0, 3.6, 0], 62],
  [[-13, 1.1, 13], [-8, 1.5, 9], [0, 5, 0], [0, 4.5, 0], 58],
  [[-58, 3.2, -25.5], [-44, 2.6, -26.5], [-20, 4, -26], [-10, 3.4, -26], 55],
  [[13, 25, 17], [8, 17, 11], [-2, 3, -3], [0, 3, 0], 55],
  [[-26.5, 1.8, 40], [-25.5, 2.4, 22], [-26, 3.4, 0], [-26, 3, -10], 60],
];
let menuShot = 0, menuShotT = 0;
const MENU_SHOT_LEN = 9;
function menuCamera(dt, cam) {
  menuShotT += dt; if (menuShotT > MENU_SHOT_LEN) { menuShotT = 0; menuShot = (menuShot + 1) % MENU_SHOTS.length; }
  const sh = MENU_SHOTS[menuShot], k = menuShotT / MENU_SHOT_LEN, e = k * k * (3 - 2 * k) * 0.6 + k * 0.4;
  const L = (a, b) => [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)];
  const p = L(sh[0], sh[1]), l = L(sh[2], sh[3]), t = performance.now() / 1000;
  cam.position.set(p[0] + Math.sin(t * 0.7) * 0.05, p[1] + Math.sin(t * 0.9) * 0.04, p[2]); cam.lookAt(l[0], l[1], l[2]);
  cam.rotation.z += Math.sin(t * 0.4) * 0.006;
  if (Math.abs(cam.fov - sh[4]) > 0.1) { cam.fov = sh[4]; cam.updateProjectionMatrix(); }
  const fade = Math.max(1 - menuShotT / 0.9, 1 - (MENU_SHOT_LEN - menuShotT) / 0.9, 0);
  post.comp.uniforms.uFade.value = fade * fade;
  const cap = $('#mCap'); if (cap) { const names = T('shots'); const txt = Array.isArray(names) ? names[menuShot % names.length] : ''; if (cap.textContent !== txt) cap.textContent = txt; cap.parentNode.style.opacity = fade > 0.5 ? 0 : 1; const tm = $('#mTime'); if (tm) tm.textContent = 'REC ' + fmtTime(menuShotT + menuShot * MENU_SHOT_LEN); }
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  fpsAcc += dt; fpsN++; fpsT += dt; if (fpsT > 0.5 && settings.fps) { $('#fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; fpsT = 0; }
  WORLD.sky.uniforms.uTime.value = now / 1000;
  if (S.running && !S.paused) tick(dt);
  if (!S.running) {
    // menu: slow street-level camera shots with fades, letterboxed
    menuCamera(dt, S.camera);
    S.time += dt; if (!S.player) S.player = { pos: S.camera.position }; updatePortals(dt);
    post.comp.uniforms.uDmg.value = 0; post.comp.uniforms.uLow.value = 0; post.comp.uniforms.uTea.value = 0;
    post.comp.uniforms.uLetter.value = Math.min(1, post.comp.uniforms.uLetter.value + dt * 2);
    moon.position.set(-40, 70, -60); moon.target.position.set(0, 0, 0);
  } else { post.comp.uniforms.uLetter.value = Math.max(0, post.comp.uniforms.uLetter.value - dt * 3); post.comp.uniforms.uFade.value = 0; }
  FX.update(dt); SMOKE.update(dt);
  for (const l of BLAST_LIGHTS) { if (l.userData.t > 0) { l.userData.t -= dt; l.intensity = 120 * Math.max(0, l.userData.t / 0.35); } else l.intensity = 0; }
  post.comp.uniforms.uTime.value = (now / 1000) % 100;
  if (!window.__noRender) post.render(S.scene, S.camera);
}

function boot() {
  initRenderer(); buildMinimapBase(); setupInput(); setupUI();
  addEventListener('resize', onResize); addEventListener('orientationchange', () => setTimeout(onResize, 200));
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.running && !S.paused) pauseGame(); });
  requestAnimationFrame(frame);
  window.__menuJump = (n) => { menuShot = n; menuShotT = 4.5; menuCamera(0, S.camera); post.comp.uniforms.uLetter.value = 1; FX.update(0.016); post.render(S.scene, S.camera); };
  window.__game = { S, startGame, settings, tick, mouse, keys, inp, WEAPONS, endGame, render: () => { FX.update(0.016); SMOKE.update(0.016); post.render(S.scene, S.camera); }, spawnEnemy, Boss, applyQuality };
}
boot();

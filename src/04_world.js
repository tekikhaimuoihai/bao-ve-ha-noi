/* ===== world: Hanoi Old Quarter street grid ===== */
const CELL = 4, G = 32, HALF = G * CELL / 2;
const STREET_ROWS = new Set([2, 3, 9, 15, 16, 22, 28, 29]);
const STREET_COLS = new Set([2, 3, 9, 15, 16, 22, 28, 29]);
const SQ0 = 12, SQ1 = 19; // square rows/cols inclusive
const H_BANDS = [[2, 3], [9], [15, 16], [22], [28, 29]];
const V_BANDS = [[2, 3], [9], [15, 16], [22], [28, 29]];
const H_NAMES = ['Hàng Bạc', 'Hàng Buồm', 'Hàng Ngang', 'Mã Mây', 'Hàng Bè'];
const V_NAMES = ['Hàng Mã', 'Hàng Chiếu', 'Hàng Đào', 'Tạ Hiện', 'Hàng Giầy'];
const grid = new Uint8Array(G * G);   // 0 open street, 1 building, 2 square
const heights = new Float32Array(G * G);
const NG = G * 2, NC = CELL / 2;      // navigation grid (2 m)
const navBlocked = new Uint8Array(NG * NG);
const circles = [];                   // round obstacles {x,z,r}
const spawnPoints = [];
const WORLD = { lights: [], portalsDef: [], lampGlows: null, animated: [] };

const cx = c => (c - G / 2 + 0.5) * CELL;      // cell center x
const cz = r => (r - G / 2 + 0.5) * CELL;
const cellOf = v => Math.floor((v + HALF) / CELL);
function blockedCell(r, c) { return r < 0 || c < 0 || r >= G || c >= G || grid[r * G + c] === 1; }
function blockedAt(x, z) { return blockedCell(cellOf(z), cellOf(x)); }
function inSquare(x, z) { return Math.abs(x) < (SQ1 - SQ0 + 1) * CELL / 2 - 0.5 && Math.abs(z) < (SQ1 - SQ0 + 1) * CELL / 2 - 0.5; }
function streetName(x, z) {
  const r = cellOf(z), c = cellOf(x);
  for (let i = 0; i < H_BANDS.length; i++) if (H_BANDS[i].includes(r)) return H_NAMES[i];
  for (let i = 0; i < V_BANDS.length; i++) if (V_BANDS[i].includes(c)) return V_NAMES[i];
  return H_NAMES[2];
}

function buildGrid() {
  const rng = mulberry32(1911);
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    let v = 1;
    if (r >= 2 && r <= 29 && c >= 2 && c <= 29 && (STREET_ROWS.has(r) || STREET_COLS.has(c))) v = 0;
    if (r >= SQ0 && r <= SQ1 && c >= SQ0 && c <= SQ1) v = 2;
    grid[r * G + c] = v;
  }
  // alleys (ngõ) through some blocks
  const starts = [4, 10, 17, 23], size = 5;
  for (const br of starts) for (const bc of starts) {
    if (br + size > SQ0 && br <= SQ1 && bc + size > SQ0 && bc <= SQ1) continue;
    const roll = rng();
    if (roll < 0.35) { const rr = br + 2; for (let c = bc; c < bc + size; c++) grid[rr * G + c] = 0; }
    else if (roll < 0.7) { const cc = bc + 2; for (let r = br; r < br + size; r++) grid[r * G + cc] = 0; }
    else if (roll < 0.85) { const rr = br + 2; for (let c = bc; c < bc + 3; c++) grid[rr * G + c] = 0; }
  }
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    const near = Math.max(0, 1 - Math.hypot(r - 15.5, c - 15.5) / 18);
    heights[r * G + c] = 3.6 + 3.2 * (1 + Math.floor(rng() * 3 + near * 2.2));
  }
}

/* --- geometry batching --- */
class Geo {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  quad(a, b, c, d, n, uv, col = [1, 1, 1]) {
    this.p.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) { this.n.push(n[0], n[1], n[2]); this.c.push(col[0], col[1], col[2]); }
    const [u0, v0, u1, v1] = uv; this.u.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  }
  tri(a, b, c, n, ua, ub, uc, col = [1, 1, 1]) {
    this.p.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { this.n.push(...n); this.c.push(...col); } this.u.push(...ua, ...ub, ...uc);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); return g;
  }
}
const GEO = {};
const geoOf = k => GEO[k] || (GEO[k] = new Geo());
// faces: bitmask px=1 nx=2 pz=4 nz=8 top=16
function box(key, x0, y0, z0, x1, y1, z1, o = {}) {
  const g = geoOf(key), us = o.us || 1, vs = o.vs || 1, col = o.col, faces = o.faces == null ? 31 : o.faces;
  const wX = (x1 - x0) / us, wZ = (z1 - z0) / us, hV = (y1 - y0) / vs;
  if (faces & 1) g.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [0, 0, wZ, hV], col);
  if (faces & 2) g.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [0, 0, wZ, hV], col);
  if (faces & 4) g.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [0, 0, wX, hV], col);
  if (faces & 8) g.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [0, 0, wX, hV], col);
  if (faces & 16) { const tg = o.top ? geoOf(o.top) : g, ts = o.ts || us; tg.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0 / ts, z1 / ts, x1 / ts, z0 / ts], o.topCol || col); }
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function quadAuto(key, a, b, c, d, uv, col) { const n = norm(cross(sub(b, a), sub(d, a))); geoOf(key).quad(a, b, c, d, n, uv, col); }

// merge simple primitive geometries into one, with a vertex colour per part
function mergeParts(parts) {
  const pos = [], nor = [], col = [], m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const [geo, color, matrix] of parts) {
    const gg = geo.index ? geo.toNonIndexed() : geo; const p = gg.attributes.position, n = gg.attributes.normal;
    m.copy(matrix || new THREE.Matrix4()); nm.getNormalMatrix(m); const c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere(); return g;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function buildWorld(scene) {
  buildGrid();
  const rng = mulberry32(2026);
  const R = () => rng();
  const mats = {};
  TEX.facades.forEach((f, i) => mats['f' + i] = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.92, vertexColors: true }));
  TEX.shops.forEach((s, i) => mats['s' + i] = new THREE.MeshStandardMaterial({ map: s.map, emissiveMap: s.emissive, emissive: 0xffffff, emissiveIntensity: s.kind === 'shutter' ? 0 : 0.6, roughness: 0.85, vertexColors: true }));
  mats.roof = new THREE.MeshStandardMaterial({ map: TEX.roof, roughness: 1, vertexColors: true });
  mats.tile = new THREE.MeshStandardMaterial({ map: TEX.tile, roughness: 0.9, vertexColors: true });
  mats.walk = new THREE.MeshStandardMaterial({ map: TEX.sidewalk, roughness: 0.95, vertexColors: true });
  mats.rail = new THREE.MeshStandardMaterial({ map: TEX.rail, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4, vertexColors: true });
  mats.awn = new THREE.MeshStandardMaterial({ map: TEX.awning, side: THREE.DoubleSide, roughness: 0.8, vertexColors: true });
  mats.plain = new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: true });
  mats.metal = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.7, vertexColors: true });

  const facing = (r, c) => { const d = []; if (!blockedCell(r - 1, c)) d.push('n'); if (!blockedCell(r + 1, c)) d.push('s'); if (!blockedCell(r, c - 1)) d.push('w'); if (!blockedCell(r, c + 1)) d.push('e'); return d; };
  const signSpots = [], teaSpots = [];
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    if (grid[r * G + c] !== 1) continue;
    const f = facing(r, c);
    const x0 = cx(c) - 2, x1 = cx(c) + 2, z0 = cz(r) - 2, z1 = cz(r) + 2;
    if (!f.length) { box('roof', x0, 0, z0, x1, 7.5, z1, { faces: 16, us: 4 }); continue; }
    const h = heights[r * G + c], fi = Math.floor(R() * TEX.facades.length), si = Math.floor(R() * TEX.shops.length);
    const tint = 0.88 + R() * 0.12, col = [tint, tint, tint];
    box('s' + si, x0, 0, z0, x1, 3.6, z1, { us: 4, vs: 3.6, faces: 15, col });
    const roofKind = R() < 0.35 ? 'tile' : 'flat';
    box('f' + fi, x0, 3.6, z0, x1, h, z1, { us: 4, vs: 6.4, col, top: 'roof', ts: 4, faces: roofKind === 'tile' ? 15 : 31 });
    if (roofKind === 'tile') {
      const alongX = f.includes('n') || f.includes('s'), rh = 1.5;
      if (alongX) {
        const zm = (z0 + z1) / 2;
        quadAuto('tile', [x0 - 0.2, h, z1 + 0.3], [x1 + 0.2, h, z1 + 0.3], [x1 + 0.2, h + rh, zm], [x0 - 0.2, h + rh, zm], [0, 0, 1.1, 1]);
        quadAuto('tile', [x1 + 0.2, h, z0 - 0.3], [x0 - 0.2, h, z0 - 0.3], [x0 - 0.2, h + rh, zm], [x1 + 0.2, h + rh, zm], [0, 0, 1.1, 1]);
        geoOf('f' + fi).tri([x0, h, z1], [x0, h + rh, zm], [x0, h, z0], [-1, 0, 0], [0, 0], [0.5, 0.2], [1, 0], col);
        geoOf('f' + fi).tri([x1, h, z0], [x1, h + rh, zm], [x1, h, z1], [1, 0, 0], [0, 0], [0.5, 0.2], [1, 0], col);
      } else {
        const xm = (x0 + x1) / 2;
        quadAuto('tile', [x1 + 0.3, h, z1 + 0.2], [x1 + 0.3, h, z0 - 0.2], [xm, h + rh, z0 - 0.2], [xm, h + rh, z1 + 0.2], [0, 0, 1.1, 1]);
        quadAuto('tile', [x0 - 0.3, h, z0 - 0.2], [x0 - 0.3, h, z1 + 0.2], [xm, h + rh, z1 + 0.2], [xm, h + rh, z0 - 0.2], [0, 0, 1.1, 1]);
        geoOf('f' + fi).tri([x0, h, z0], [xm, h + rh, z0], [x1, h, z0], [0, 0, -1], [0, 0], [0.5, 0.2], [1, 0], col);
        geoOf('f' + fi).tri([x1, h, z1], [xm, h + rh, z1], [x0, h, z1], [0, 0, 1], [0, 0], [0.5, 0.2], [1, 0], col);
      }
    } else if (R() < 0.5) {
      WORLD.tanks = WORLD.tanks || []; WORLD.tanks.push([cx(c) + (R() - 0.5) * 2, h, cz(r) + (R() - 0.5) * 2]);
    }
    // per street-facing side details
    for (const d of f) {
      const n = { n: [0, 0, -1], s: [0, 0, 1], w: [-1, 0, 0], e: [1, 0, 0] }[d];
      const fx = cx(c) + n[0] * 2, fz = cz(r) + n[2] * 2, tx = -n[2], tz = n[0]; // tangent
      const P = (along, y, out) => [fx + tx * along + n[0] * out, y, fz + tz * along + n[2] * out];
      // balconies
      const floors = Math.round((h - 3.6) / 3.2);
      for (let k = 0; k < floors; k++) {
        if (R() < 0.45) continue;
        const y = 3.6 + k * 3.2 + 0.1, w = 1.3;
        // slab
        const a = P(-w, y, 0), b = P(w, y, 0.75);
        box('plain', Math.min(a[0], b[0]), y - 0.14, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y, Math.max(a[2], b[2]), { col: [0.75, 0.72, 0.68] });
        quadAuto('rail', P(-w, y, 0.75), P(w, y, 0.75), P(w, y + 1, 0.75), P(-w, y + 1, 0.75), [0, 0, 2.6, 1]);
        quadAuto('rail', P(w, y, 0.75), P(w, y, 0), P(w, y + 1, 0), P(w, y + 1, 0.75), [0, 0, 0.75, 1]);
        quadAuto('rail', P(-w, y, 0), P(-w, y, 0.75), P(-w, y + 1, 0.75), P(-w, y + 1, 0), [0, 0, 0.75, 1]);
        if (R() < 0.6) for (let q = 0; q < 3; q++) { const pp = P(-w + 0.4 + q * 0.9, y, 0.45); const s = 0.25 + R() * 0.15; box('plain', pp[0] - s, y, pp[2] - s, pp[0] + s, y + 0.3 + R() * 0.5, pp[2] + s, { col: [0.2 + R() * 0.1, 0.45 + R() * 0.2, 0.18] }); }
      }
      // AC unit
      if (R() < 0.3 && h > 7) { const pp = P(1.2 * (R() < 0.5 ? -1 : 1), 6 + R() * (h - 8), 0.3); const ex = Math.abs(tx) * 0.45 + Math.abs(n[0]) * 0.3, ez = Math.abs(tz) * 0.45 + Math.abs(n[2]) * 0.3; box('plain', pp[0] - ex, pp[1], pp[2] - ez, pp[0] + ex, pp[1] + 0.6, pp[2] + ez, { col: [0.9, 0.9, 0.88] }); }
      // awning or sign
      const kind = TEX.shops[si].kind;
      if (kind !== 'shutter' && R() < 0.55) {
        const cols = [[0.85, 0.2, 0.2], [0.2, 0.4, 0.85], [0.2, 0.6, 0.3], [0.95, 0.55, 0.15], [0.9, 0.85, 0.3]];
        const cc = cols[Math.floor(R() * cols.length)];
        quadAuto('awn', P(-1.8, 2.7, 1.3), P(1.8, 2.7, 1.3), P(1.8, 3.3, 0.02), P(-1.8, 3.3, 0.02), [0, 0, 2, 1], cc);
      }
      if (R() < 0.55) signSpots.push({ p: P(0, 3.95, 0.06), n, w: 3.4, h: 0.85, idx: Math.floor(R() * SIGNS.length) });
      if (f.length && (r === 11 || r === 20 || c === 11 || c === 20 || R() < 0.04)) teaSpots.push({ p: P(0, 5.2, 0.08), n, r, c, sq: (r === 11 || r === 20 || c === 11 || c === 20) });
    }
  }
  // sidewalks along building frontage
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    if (grid[r * G + c] !== 0) continue;
    const x0 = cx(c) - 2, x1 = cx(c) + 2, z0 = cz(r) - 2, z1 = cz(r) + 2, w = 1.0;
    if (blockedCell(r - 1, c)) box('walk', x0, 0, z0, x1, 0.14, z0 + w, { us: 2, faces: 4 | 16, top: 'walk', ts: 2 });
    if (blockedCell(r + 1, c)) box('walk', x0, 0, z1 - w, x1, 0.14, z1, { us: 2, faces: 8 | 16, top: 'walk', ts: 2 });
    const zs = blockedCell(r - 1, c) ? z0 + w : z0, ze = blockedCell(r + 1, c) ? z1 - w : z1;
    if (blockedCell(r, c - 1)) box('walk', x0, 0, zs, x0 + w, 0.12, ze, { us: 2, faces: 1 | 16, top: 'walk', ts: 2 });
    if (blockedCell(r, c + 1)) box('walk', x1 - w, 0, zs, x1, 0.12, ze, { us: 2, faces: 2 | 16, top: 'walk', ts: 2 });
    if (!inSquare(cx(c), cz(r))) spawnPoints.push(new THREE.Vector3(cx(c), 0, cz(r)));
  }

  // shop signs, batched per texture
  TEX.signs.forEach((t, i) => mats['sign' + i] = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.6, vertexColors: true }));
  signSpots.forEach(sp => {
    const n = sp.n, rx = n[2], rz = -n[0], hw = sp.w / 2, hh = sp.h / 2, p = sp.p;
    geoOf('sign' + sp.idx).quad([p[0] - rx * hw, p[1] - hh, p[2] - rz * hw], [p[0] + rx * hw, p[1] - hh, p[2] + rz * hw], [p[0] + rx * hw, p[1] + hh, p[2] + rz * hw], [p[0] - rx * hw, p[1] + hh, p[2] - rz * hw], n, [0, 0, 1, 1]);
  });
  // finalize batched meshes
  for (const k in GEO) {
    const mat = mats[k] || (k.startsWith('f') ? mats.f0 : mats.plain);
    const mesh = new THREE.Mesh(GEO[k].geometry(), mat);
    mesh.castShadow = k !== 'rail' && k !== 'walk'; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(G * CELL, G * CELL), new THREE.MeshStandardMaterial({ map: TEX.asphalt, roughness: 0.85, metalness: 0.05 }));
  TEX.asphalt.repeat.set(16, 16); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sqW = (SQ1 - SQ0 + 1) * CELL;
  const sq = new THREE.Mesh(new THREE.PlaneGeometry(sqW, sqW), new THREE.MeshStandardMaterial({ map: TEX.paving, roughness: 0.8 }));
  TEX.paving.repeat.set(4, 4); sq.rotation.x = -Math.PI / 2; sq.position.y = 0.02; sq.receiveShadow = true; scene.add(sq);

  // signs
  const planeG = new THREE.PlaneGeometry(1, 1);
  const placePlane = (mat, p, n, w, h) => { const m = new THREE.Mesh(planeG, mat); m.scale.set(w, h, 1); m.position.set(p[0], p[1], p[2]); m.lookAt(p[0] + n[0], p[1], p[2] + n[2]); scene.add(m); return m; };
  // tea shop signs: a few around the square and one or two in the streets
  const teaMat = new THREE.MeshStandardMaterial({ map: TEX.tea, emissiveMap: TEX.tea, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.5 });
  const sqTea = teaSpots.filter(t => t.sq), stTea = teaSpots.filter(t => !t.sq);
  const chosen = [];
  for (const t of sqTea) if (chosen.every(o => Math.hypot(o.p[0] - t.p[0], o.p[2] - t.p[2]) > 14)) chosen.push(t);
  stTea.slice(0, 4).forEach(t => chosen.push(t));
  chosen.slice(0, 9).forEach(t => {
    placePlane(teaMat, t.p, t.n, 3.9, 1.3);
    const fr = placePlane(new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 0.6 }), [t.p[0] - t.n[0] * 0.02, t.p[1], t.p[2] - t.n[2] * 0.02], t.n, 4.1, 1.5);
    WORLD.teaSigns = (WORLD.teaSigns || 0) + 1;
  });
  // the cafe at the start street gets a sign right where the player spawns
  placePlane(teaMat, [0, 5.0, 55.9], [0, 0, -1], 5.4, 1.8);
  if (blockedCell(27, 14)) placePlane(teaMat, [-6, 5.0, 48.1], [0, 0, 1], 5.4, 1.8);

  // street name plates at corners
  const plates = {};
  const plateMat = name => plates[name] || (plates[name] = new THREE.MeshBasicMaterial({ map: plateTex(name) }));
  H_BANDS.forEach((band, i) => V_BANDS.forEach((vb) => {
    const r = band[0] - 1, c = vb[vb.length - 1] + 1;
    if (blockedCell(r, c) && !inSquare(cx(c), cz(r + 1))) placePlane(plateMat(H_NAMES[i]), [cx(c) - 1, 3.0, cz(r) + 2.05], [0, 0, 1], 1.2, 0.38);
    const r2 = band[band.length - 1] + 1, c2 = vb[0] - 1;
    if (blockedCell(r2, c2) && !inSquare(cx(c2), cz(r2 - 1))) placePlane(plateMat(V_NAMES[V_BANDS.indexOf(vb)]), [cx(c2) + 2.05, 3.0, cz(r2) - 1], [1, 0, 0], 1.2, 0.38);
  }));

  buildProps(scene, rng);
  buildSquare(scene);
  buildSky(scene);
  // nav grid
  for (let r = 0; r < NG; r++) for (let c = 0; c < NG; c++) {
    const x = (c + 0.5) * NC - HALF, z = (r + 0.5) * NC - HALF;
    let b = blockedAt(x, z) ? 1 : 0;
    for (const o of circles) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.3) b = 1;
    navBlocked[r * NG + c] = b;
  }
}

function instanced(geo, mat, list, colorFn, shadow = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((m, i) => { im.setMatrixAt(i, m); if (colorFn) im.setColorAt(i, new THREE.Color(colorFn(i))); });
  im.castShadow = shadow; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

function buildProps(scene, rng) {
  const R = () => rng();
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
  const motoGeo = mergeParts([
    [new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), '#111', M4(0, 0.28, 0.62, 0, 0, Math.PI / 2)],
    [new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), '#111', M4(0, 0.28, -0.62, 0, 0, Math.PI / 2)],
    [new THREE.BoxGeometry(0.34, 0.36, 1.05), '#ffffff', M4(0, 0.58, -0.1)],
    [new THREE.BoxGeometry(0.3, 0.12, 0.6), '#2a2220', M4(0, 0.82, -0.25)],
    [new THREE.BoxGeometry(0.22, 0.6, 0.18), '#ffffff', M4(0, 0.85, 0.5, 0.35)],
    [new THREE.BoxGeometry(0.7, 0.05, 0.05), '#222', M4(0, 1.15, 0.6)],
    [new THREE.BoxGeometry(0.14, 0.12, 0.1), '#ffe9a0', M4(0, 1.05, 0.7)],
  ]);
  const stoolGeo = mergeParts([[new THREE.BoxGeometry(0.32, 0.05, 0.32), '#ffffff', M4(0, 0.42, 0)], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [new THREE.BoxGeometry(0.05, 0.42, 0.05), '#ffffff', M4(a * 0.13, 0.21, b * 0.13)])]);
  const treeGeo = mergeParts([
    [new THREE.CylinderGeometry(0.14, 0.22, 3.2, 7), '#4a3423', M4(0, 1.6, 0)],
    [new THREE.IcosahedronGeometry(1.4, 0), '#2c5a2a', M4(0, 3.6, 0)], [new THREE.IcosahedronGeometry(1.0, 0), '#3a6e30', M4(0.8, 3.2, 0.3)], [new THREE.IcosahedronGeometry(1.05, 0), '#30602c', M4(-0.6, 4.2, -0.4)]
  ]);
  const lampGeo = mergeParts([
    [new THREE.CylinderGeometry(0.07, 0.1, 5.2, 6), '#3a3a3a', M4(0, 2.6, 0)],
    [new THREE.BoxGeometry(0.06, 0.06, 1.2), '#3a3a3a', M4(0, 5.1, 0.6)],
  ]);
  const poleGeo = mergeParts([[new THREE.CylinderGeometry(0.12, 0.18, 7.5, 6), '#8a8580', M4(0, 3.75, 0)], [new THREE.BoxGeometry(1.0, 0.08, 0.08), '#555', M4(0, 6.8, 0)], [new THREE.BoxGeometry(0.4, 0.5, 0.3), '#6a6a6a', M4(0, 5.6, 0.15)]]);
  const motos = [], motoCols = [], stools = [], stoolCols = [], trees = [], lamps = [], poles = [], lampHeads = [], glows = [];
  const wires = [], lanternM = [], lanternC = [], starM = [], starC = [];
  const lanternPal = [0xff3b2f, 0xffc02e, 0xff7a1a, 0xff4fa0, 0xff2a2a, 0x9ad84a];

  function band(rows, horiz) {
    // run along the band; lateral edges are the band edges
    const lo = (rows[0] - G / 2) * CELL, hi = (rows[rows.length - 1] + 1 - G / 2) * CELL;
    const open = k => rows.every(r => horiz ? !blockedCell(r, k) : !blockedCell(k, r)) && grid[horiz ? rows[0] * G + k : k * G + rows[0]] !== 2;
    let k = 0;
    while (k < G) {
      if (!open(k)) { k++; continue; }
      let e = k; while (e + 1 < G && open(e + 1)) e++;
      const s0 = (k - G / 2) * CELL, s1 = (e + 1 - G / 2) * CELL;
      const P = (s, lat, y = 0) => horiz ? new THREE.Vector3(s, y, lat) : new THREE.Vector3(lat, y, s);
      const wallAt = (s, side) => { const kk = Math.floor((s + HALF) / CELL); const rr = side < 0 ? rows[0] - 1 : rows[rows.length - 1] + 1; return horiz ? blockedCell(rr, kk) : blockedCell(kk, rr); };
      const rotY = horiz ? 0 : Math.PI / 2;
      // lamps and electric poles
      let alt = 1;
      const polesHere = [];
      for (let s = s0 + 5; s < s1 - 2; s += 11) {
        alt = -alt; const lat = alt < 0 ? lo + 1.15 : hi - 1.15;
        if (!wallAt(s, alt)) continue;
        const pm = new THREE.Matrix4().compose(P(s, lat), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, horiz ? (alt < 0 ? 0 : Math.PI) : (alt < 0 ? Math.PI / 2 : -Math.PI / 2), 0)), new THREE.Vector3(1, 1, 1));
        lamps.push(pm);
        const head = P(s, lat + (alt < 0 ? 1.15 : -1.15), 5.0); lampHeads.push(head);
        glows.push(P(s, lat + (alt < 0 ? 1.2 : -1.2), 0.03));
        const pl = alt < 0 ? lo + 0.6 : hi - 0.6; const pp = P(s + 2.5, pl); poles.push(M4(pp.x, 0, pp.z, 0, rotY)); polesHere.push({ p: pp, side: alt });
      }
      // wires: messy cables between poles on the same side and across
      for (let i = 0; i < polesHere.length; i++) for (let j = i + 1; j < Math.min(polesHere.length, i + 3); j++) {
        const a = polesHere[i].p, b = polesHere[j].p; const n = 3 + Math.floor(R() * 4);
        for (let q = 0; q < n; q++) wires.push([new THREE.Vector3(a.x, 5.3 + R() * 1.6, a.z), new THREE.Vector3(b.x, 5.3 + R() * 1.6, b.z), 0.4 + R() * 1.2]);
      }
      // lantern strings across the street
      for (let s = s0 + 3; s < s1 - 1; s += 8 + R() * 5) {
        if (horiz && rows[0] === 28 && Math.abs(s) < 7) continue;
        const a = P(s, lo + 0.1, 5.6 + R() * 0.6), b = P(s + (R() - 0.5) * 2, hi - 0.1, 5.6 + R() * 0.6), sag = 0.8;
        wires.push([a, b, sag]);
        const n = Math.max(3, Math.round((hi - lo) / 1.3));
        for (let i = 1; i < n; i++) {
          const t = i / n, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag + 0.35;
          const col = lanternPal[Math.floor(R() * lanternPal.length)];
          if (R() < 0.3) { starM.push(M4(p.x, p.y, p.z, 0, R() * 3, 0, 0.42, 0.42, 0.42)); starC.push(col); }
          else { lanternM.push(M4(p.x, p.y, p.z, 0, 0, 0, 1, 1, 1)); lanternC.push(col); }
        }
      }
      // parked motorbikes and plastic stools on the sidewalks
      for (let s = s0 + 1; s < s1 - 1; s += 0.75) {
        const side = R() < 0.5 ? -1 : 1; if (!wallAt(s, side)) continue;
        const lat = side < 0 ? lo + 0.55 : hi - 0.55;
        const roll = R();
        if (roll < 0.22) {
          const p = P(s, lat); motos.push(M4(p.x, 0.12, p.z, 0, (horiz ? Math.PI / 2 : 0) + (R() - 0.5) * 0.5 + (R() < 0.5 ? Math.PI : 0)));
          motoCols.push(pick(['#c62828', '#1565c0', '#eeeeee', '#212121', '#2e7d32', '#f9a825', '#6a1b9a']));
        } else if (roll < 0.27) {
          for (let q = 0; q < 4; q++) { const p = P(s + (R() - 0.5) * 1.6, lat + (R() - 0.5) * 0.4 - side * 0.2); stools.push(M4(p.x, 0.12, p.z, 0, R() * 3)); stoolCols.push(R() < 0.6 ? '#d32f2f' : '#1976d2'); }
          s += 2;
        } else if (roll < 0.29 && hi - lo > 5) { const p = P(s, lat - side * 0.1); trees.push(M4(p.x, 0.1, p.z, 0, R() * 3, 0, 0.9 + R() * 0.3, 0.9 + R() * 0.3, 0.9 + R() * 0.3)); s += 3; }
      }
      k = e + 1;
    }
  }
  H_BANDS.forEach(b => band(b, true));
  V_BANDS.forEach(b => band(b, false));
  // alleys get a few lanterns too
  const add = im => im && scene.add(im);
  add(instanced(motoGeo, vc, motos, i => motoCols[i]));
  add(instanced(stoolGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), stools, i => stoolCols[i], false));
  add(instanced(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), trees));
  add(instanced(lampGeo, vc, lamps));
  add(instanced(poleGeo, vc, poles));
  if (WORLD.tanks) add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1.3, 12), new THREE.MeshStandardMaterial({ color: 0xc9d2d8, metalness: 0.8, roughness: 0.3 }), WORLD.tanks.map(p => M4(p[0], p[1] + 0.65, p[2]))));
  // lamp heads (unlit, bloom does the glow)
  add(instanced(new THREE.BoxGeometry(0.35, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lampHeads.map(p => M4(p.x, p.y, p.z)), null, false));
  const glowMat = new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffb060, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  add(instanced(new THREE.PlaneGeometry(7, 7), glowMat, glows.map(p => M4(p.x, 0.05, p.z, -Math.PI / 2)), null, false));
  WORLD.lampHeads = lampHeads;
  // lanterns
  const lanG = mergeParts([[new THREE.SphereGeometry(0.24, 10, 8), '#ffffff', M4(0, 0, 0, 0, 0, 0, 1, 1.25, 1)], [new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), '#ffd27a', M4(0, 0.31, 0)], [new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4), '#ffd27a', M4(0, -0.38, 0)]]);
  add(instanced(lanG, new THREE.MeshBasicMaterial({ vertexColors: true }), lanternM, i => lanternC[i], false));
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + Math.PI / 2, rr = i % 2 ? 0.42 : 1; star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
  const starG = new THREE.ExtrudeGeometry(star, { depth: 0.2, bevelEnabled: false }); starG.translate(0, 0, -0.1);
  add(instanced(starG, new THREE.MeshBasicMaterial({ color: 0xffffff }), starM, i => starC[i], false));
  // wires
  const wp = [];
  wires.forEach(([a, b, sag]) => { const n = 10; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; const p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1); p0.y -= Math.sin(t0 * Math.PI) * sag; p1.y -= Math.sin(t1 * Math.PI) * sag; wp.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); } });
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x0a0a0c })));
}

function buildSquare(scene) {
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  // central planter with a big banyan-ish tree
  const planter = mergeParts([
    [new THREE.CylinderGeometry(3.2, 3.4, 0.7, 24), '#8d8578', M4(0, 0.35, 0)],
    [new THREE.CylinderGeometry(2.9, 2.9, 0.1, 24), '#2e4a22', M4(0, 0.72, 0)],
    [new THREE.CylinderGeometry(0.4, 0.7, 5, 8), '#4a3423', M4(0, 3, 0)],
    [new THREE.IcosahedronGeometry(3, 1), '#2a5228', M4(0, 6.5, 0)], [new THREE.IcosahedronGeometry(2.2, 1), '#336a2e', M4(1.8, 5.6, 1)], [new THREE.IcosahedronGeometry(2.3, 1), '#29502a', M4(-1.6, 6, -1.2)],
  ]);
  const pm = new THREE.Mesh(planter, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })); pm.castShadow = pm.receiveShadow = true; scene.add(pm);
  circles.push({ x: 0, z: 0, r: 3.4 });
  // four low planters as cover
  const small = mergeParts([[new THREE.CylinderGeometry(1.2, 1.3, 0.9, 16), '#8d8578', M4(0, 0.45, 0)], [new THREE.SphereGeometry(1.05, 10, 6), '#3d7a34', M4(0, 1.0, 0, 0, 0, 0, 1, 0.55, 1)]]);
  [[-9, -9], [9, -9], [-9, 9], [9, 9]].forEach(([x, z]) => { const m = new THREE.Mesh(small, vc); m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; scene.add(m); circles.push({ x, z, r: 1.3 }); });
  // festival banner on the north edge
  const b = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.9), new THREE.MeshStandardMaterial({ map: bannerTex(), emissiveMap: null, emissive: 0x330000, side: THREE.DoubleSide }));
  b.position.set(0, 6.5, -15.7); scene.add(b);
  const postG = new THREE.CylinderGeometry(0.1, 0.1, 7.6, 6), postM = new THREE.MeshStandardMaterial({ color: 0x444444 });
  [-6.2, 6.2].forEach(x => { const p = new THREE.Mesh(postG, postM); p.position.set(x, 3.8, -15.7); scene.add(p); });
  // lantern strings from the tree to the square corners
  const wp = [], lanM = [], lanC = [], pal = [0xff3b2f, 0xffc02e, 0xff7a1a, 0xff4fa0];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, top = new THREE.Vector3(Math.cos(a) * 1.5, 7.5, Math.sin(a) * 1.5), end = new THREE.Vector3(Math.cos(a) * 15.5, 5.2, Math.sin(a) * 15.5);
    const n = 9; for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const p0 = top.clone().lerp(end, t0), p1 = top.clone().lerp(end, t1); p0.y -= Math.sin(t0 * Math.PI) * 0.9; p1.y -= Math.sin(t1 * Math.PI) * 0.9; wp.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); if (k > 0) { lanM.push(M4(p0.x, p0.y - 0.35, p0.z)); lanC.push(pal[(i + k) % 4]); } }
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x0a0a0c })));
  const lg = new THREE.SphereGeometry(0.26, 10, 8); lg.scale(1, 1.25, 1);
  const im = instanced(lg, new THREE.MeshBasicMaterial({ color: 0xffffff }), lanM, i => lanC[i], false); scene.add(im);
}

function buildSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(0x3a1050) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vDir; uniform float uTime; uniform vec3 uTint;
      float h(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){ float y = clamp(vDir.y,-0.2,1.0);
        vec3 top = vec3(0.012,0.016,0.05), mid = vec3(0.05,0.035,0.11), hor = vec3(0.16,0.07,0.16);
        vec3 c = mix(hor, mid, smoothstep(0.0,0.25,y)); c = mix(c, top, smoothstep(0.25,0.9,y));
        c += uTint * 0.12 * pow(1.0-abs(y),6.0);
        vec3 sp = floor(vDir*260.0); float s = h(sp); float tw = 0.6+0.4*sin(uTime*2.0+s*50.0);
        c += vec3(step(0.9965,s)*tw*smoothstep(0.05,0.4,y));
        gl_FragColor = vec4(c,1.0); }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky); WORLD.sky = skyMat;
  // full Mid-Autumn moon
  const moonTex = simpleTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(118, 112, 10, 128, 128, 120); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.8, '#f4e2b0'); gr.addColorStop(1, '#e8c98a'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 118, 0, TAU); g.fill(); for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(170,140,90,${0.1 + Math.random() * 0.15})`; g.beginPath(); g.arc(60 + Math.random() * 140, 60 + Math.random() * 140, 6 + Math.random() * 22, 0, TAU); g.fill(); } }, false);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false }));
  moon.scale.set(38, 38, 1); moon.position.set(-120, 150, -260); scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffd9a0, fog: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(140, 140, 1); halo.position.copy(moon.position); scene.add(halo);
}

/* ===== grid queries ===== */
// distance along a ray to the first building (DDA over the 4 m grid)
function rayWall(ox, oz, dx, dz, maxD) {
  const len = Math.hypot(dx, dz); if (len < 1e-6) return maxD; dx /= len; dz /= len;
  let c = cellOf(ox), r = cellOf(oz);
  if (blockedCell(r, c)) return 0;
  const stepC = dx > 0 ? 1 : -1, stepR = dz > 0 ? 1 : -1;
  const tdx = Math.abs(CELL / dx), tdz = Math.abs(CELL / dz);
  let tmx = dx !== 0 ? (((dx > 0 ? c + 1 : c) * CELL - HALF) - ox) / dx : Infinity;
  let tmz = dz !== 0 ? (((dz > 0 ? r + 1 : r) * CELL - HALF) - oz) / dz : Infinity;
  let t = 0;
  while (t < maxD) {
    if (tmx < tmz) { t = tmx; tmx += tdx; c += stepC; } else { t = tmz; tmz += tdz; r += stepR; }
    if (blockedCell(r, c)) return t / len * len;
  }
  return maxD;
}
// horizontal distance before a 3D ray hits a wall, converted to 3D length
function rayWall3(o, d, maxD) {
  const hl = Math.hypot(d.x, d.z); if (hl < 1e-4) return maxD;
  const th = rayWall(o.x, o.z, d.x, d.z, maxD * hl);
  return th / hl;
}
function losClear(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az); return rayWall(ax, az, bx - ax, bz - az, d) >= d - 0.01; }
// push a circle out of buildings and round obstacles
function collide(p, rad) {
  const c0 = cellOf(p.x), r0 = cellOf(p.z);
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
    if (!blockedCell(r, c)) continue;
    const x0 = (c * CELL) - HALF, z0 = (r * CELL) - HALF;
    const qx = clamp(p.x, x0, x0 + CELL), qz = clamp(p.z, z0, z0 + CELL);
    const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
    if (d2 < rad * rad) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (rad - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // centre inside the box: push out the shortest way
        const l = p.x - x0, rr = x0 + CELL - p.x, t = p.z - z0, b = z0 + CELL - p.z, m = Math.min(l, rr, t, b);
        if (m === l) p.x = x0 - rad; else if (m === rr) p.x = x0 + CELL + rad; else if (m === t) p.z = z0 - rad; else p.z = z0 + CELL + rad;
      }
    }
  }
  for (const o of circles) { const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + rad; if (d < m && d > 1e-6) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; } }
  p.x = clamp(p.x, -HALF + 8 + rad, HALF - 8 - rad); p.z = clamp(p.z, -HALF + 8 + rad, HALF - 8 - rad);
}

/* ===== flow field toward the player ===== */
const flow = new Float32Array(NG * NG);
const flowQ = new Int32Array(NG * NG);
let flowCell = -1;
function updateFlow(px, pz, force) {
  const c = clamp(Math.floor((px + HALF) / NC), 0, NG - 1), r = clamp(Math.floor((pz + HALF) / NC), 0, NG - 1), start = r * NG + c;
  if (start === flowCell && !force) return; flowCell = start;
  flow.fill(1e9); flow[start] = 0; let h = 0, t = 0; flowQ[t++] = start;
  while (h < t) {
    const i = flowQ[h++], ir = (i / NG) | 0, ic = i % NG, d = flow[i] + 1;
    if (ic > 0) { const j = i - 1; if (!navBlocked[j] && flow[j] > d) { flow[j] = d; flowQ[t++] = j; } }
    if (ic < NG - 1) { const j = i + 1; if (!navBlocked[j] && flow[j] > d) { flow[j] = d; flowQ[t++] = j; } }
    if (ir > 0) { const j = i - NG; if (!navBlocked[j] && flow[j] > d) { flow[j] = d; flowQ[t++] = j; } }
    if (ir < NG - 1) { const j = i + NG; if (!navBlocked[j] && flow[j] > d) { flow[j] = d; flowQ[t++] = j; } }
  }
}
// returns a unit direction (written into out) that follows the field
function flowDir(x, z, out) {
  const c = clamp(Math.floor((x + HALF) / NC), 0, NG - 1), r = clamp(Math.floor((z + HALF) / NC), 0, NG - 1);
  let best = flow[r * NG + c], br = r, bc = c;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= NG || cc >= NG) continue;
    if (dr && dc && (navBlocked[r * NG + cc] || navBlocked[rr * NG + c])) continue;
    const v = flow[rr * NG + cc] + (dr && dc ? 0.4 : 0); if (v < best) { best = v; br = rr; bc = cc; }
  }
  const tx = (bc + 0.5) * NC - HALF, tz = (br + 0.5) * NC - HALF; let dx = tx - x, dz = tz - z; const l = Math.hypot(dx, dz) || 1;
  out.x = dx / l; out.z = dz / l; return best;
}

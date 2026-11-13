/* ===== procedural textures (canvas) ===== */
const TEX = {};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8; t.needsUpdate = true; return t;
}
function speckle(g, w, h, n, a, r) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; const s = 1 + Math.random() * (r || 2); g.fillRect(Math.random() * w, Math.random() * h, s, s); } }
function grime(g, w, h, y0, y1, a) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(30,25,20,0)'); gr.addColorStop(1, `rgba(30,25,20,${a})`); g.fillStyle = gr; g.fillRect(0, y0, w, y1 - y0); for (let i = 0; i < 8; i++) { const x = Math.random() * w, ww = 4 + Math.random() * 14; const s = g.createLinearGradient(0, y0, 0, y1); s.addColorStop(0, `rgba(40,35,30,${a * 0.6})`); s.addColorStop(1, 'rgba(40,35,30,0)'); g.fillStyle = s; g.fillRect(x, y0, ww, (y1 - y0) * Math.random()); } }

const WALL_COLORS = ['#d9b45a', '#e6cf86', '#d98f78', '#9fb7c2', '#e8dcc0', '#a9b98e', '#c9a0a8', '#e0a85a'];
function facadeTex(base, seed) {
  const r = mulberry32(seed), W = 256, H = 512;
  const c = mkCanvas(W, H), g = c.getContext('2d'), ce = mkCanvas(W, H), ge = ce.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  for (let f = 0; f < 2; f++) {
    const y0 = f * 256;
    g.fillStyle = base; g.fillRect(0, y0, W, 256);
    speckle(g, W, 256, 900, 0.08, 2);
    g.save(); g.translate(0, y0); grime(g, W, 256, 0, 256, 0.25); g.restore();
    // floor band / cornice
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y0 + 244, W, 12);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y0 + 240, W, 4);
    // pilasters
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y0, 10, 256); g.fillRect(W - 10, y0, 10, 256);
    const style = r() < 0.55 ? 0 : 1, lit = r() < 0.45;
    const shutter = pick(['#2f6b4a', '#3b5f7a', '#6b4a2f', '#4f7a3b']);
    const wins = style === 0 ? [[68, 50, 120, 180]] : [[34, 70, 72, 130], [150, 70, 72, 130]];
    wins.forEach(([x, y, w, h], wi) => {
      const yy = y0 + y, isLit = lit && (wi === 0 || r() < 0.6);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 6, yy - 6, w + 12, h + 10);
      if (isLit) {
        const gr = g.createLinearGradient(0, yy, 0, yy + h); gr.addColorStop(0, '#ffe2a0'); gr.addColorStop(1, '#f09a3e');
        g.fillStyle = gr; g.fillRect(x, yy, w, h);
        g.fillStyle = 'rgba(160,60,40,.55)'; g.fillRect(x, yy, w * 0.28, h); g.fillRect(x + w * 0.72, yy, w * 0.28, h);
        ge.fillStyle = '#ffb860'; ge.fillRect(x, yy, w, h); ge.fillStyle = '#6a2a10'; ge.fillRect(x, yy, w * 0.28, h); ge.fillRect(x + w * 0.72, yy, w * 0.28, h);
      } else {
        const gr = g.createLinearGradient(0, yy, 0, yy + h); gr.addColorStop(0, '#2a3346'); gr.addColorStop(1, '#141824');
        g.fillStyle = gr; g.fillRect(x, yy, w, h);
      }
      g.strokeStyle = 'rgba(240,240,230,.7)'; g.lineWidth = 3; g.strokeRect(x, yy, w, h);
      g.beginPath(); g.moveTo(x + w / 2, yy); g.lineTo(x + w / 2, yy + h); g.moveTo(x, yy + h * 0.35); g.lineTo(x + w, yy + h * 0.35); g.stroke();
      // open shutters either side
      g.fillStyle = shutter; const sw = w * 0.42;
      g.fillRect(x - sw - 4, yy, sw, h); g.fillRect(x + w + 4, yy, sw, h);
      g.fillStyle = 'rgba(0,0,0,.3)';
      for (let k = 6; k < h; k += 9) { g.fillRect(x - sw - 4, yy + k, sw, 3); g.fillRect(x + w + 4, yy + k, sw, 3); }
      // arch above
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x - 8, yy - 14, w + 16, 6);
    });
  }
  return { map: toTex(c), emissive: toTex(ce) };
}

function shopTex(kind, seed) {
  const r = mulberry32(seed), W = 256, H = 256;
  const c = mkCanvas(W, H), g = c.getContext('2d'), ce = mkCanvas(W, H), ge = ce.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  g.fillStyle = '#5a5045'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#3c342d'; g.fillRect(0, 0, 12, H); g.fillRect(W - 12, 0, 12, H); g.fillRect(0, 0, W, 26);
  const x0 = 12, y0 = 26, w = W - 24, h = H - 26;
  if (kind === 'shutter') {
    g.fillStyle = '#8a8f94'; g.fillRect(x0, y0, w, h);
    for (let y = y0; y < H; y += 7) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, y, w, 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x0, y + 2, w, 1); }
    grime(g, W, H, 100, H, 0.35);
    g.fillStyle = 'rgba(20,20,20,.75)'; g.font = 'bold 15px Arial'; g.textAlign = 'center';
    if (r() < 0.7) { g.save(); g.translate(W / 2, 140 + r() * 40); g.rotate((r() - 0.5) * 0.15); g.fillText('KHOAN CẮT BÊ TÔNG', 0, 0); g.fillText('09xx.xxx.xxx', 0, 18); g.restore(); }
  } else {
    const pal = {
      shop: ['#ffd9a0', '#c77d3a'], hangma: ['#ffb070', '#c0392b'], cafe: ['#e8b070', '#5a3418'], tea: ['#e9f5d0', '#5f9a4a'], pho: ['#fff0c0', '#b8741a']
    }[kind] || ['#ffd9a0', '#c77d3a'];
    const gr = g.createLinearGradient(0, y0, 0, H); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
    g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    // shelves / goods
    for (let s = 0; s < 3; s++) {
      const sy = y0 + 30 + s * 52;
      g.fillStyle = 'rgba(60,30,10,.7)'; g.fillRect(x0 + 6, sy + 36, w - 12, 5);
      for (let i = 0; i < 9; i++) {
        const bx = x0 + 10 + i * 24 + r() * 4, bh = 14 + r() * 20;
        g.fillStyle = kind === 'hangma' ? pick(['#e53935', '#fdd835', '#fb8c00', '#8e24aa', '#43a047']) : kind === 'tea' ? pick(['#f3e2c0', '#9ccc65', '#8d6e63', '#ffffff']) : pick(['#e57373', '#64b5f6', '#ffd54f', '#81c784', '#ba68c8', '#ffffff', '#a1887f']);
        if (kind === 'hangma' && s === 0) { g.beginPath(); g.arc(bx + 8, sy + 18, 10, 0, TAU); g.fill(); }
        else g.fillRect(bx, sy + 36 - bh, 16, bh);
      }
    }
    // counter + person silhouette
    g.fillStyle = 'rgba(40,20,10,.85)'; g.fillRect(x0 + 20, H - 60, w - 40, 60);
    if (kind === 'tea') { g.fillStyle = '#2f6b2a'; g.fillRect(x0 + 20, H - 60, w - 40, 10); g.fillStyle = '#f6ecd2'; g.font = 'bold 18px Georgia'; g.textAlign = 'center'; g.fillText('MENU', W / 2, y0 + 22); }
    if (kind === 'cafe') { g.fillStyle = 'rgba(255,220,160,.9)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x0 + 20 + i * 32, y0 + 10, 4, 0, TAU); g.fill(); } }
    // emissive copy (dim)
    ge.globalAlpha = 0.85; ge.drawImage(c, 0, 0); ge.globalAlpha = 1;
    ge.fillStyle = '#000'; ge.fillRect(0, 0, W, 26); ge.fillRect(0, 0, 12, H); ge.fillRect(W - 12, 0, 12, H);
    // half-open shutter at top
    g.fillStyle = '#7d8287'; g.fillRect(x0, y0, w, 22); ge.fillStyle = '#000'; ge.fillRect(x0, y0, w, 22);
    for (let y = y0; y < y0 + 22; y += 6) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, y, w, 2); }
  }
  return { map: toTex(c), emissive: toTex(ce) };
}

function simpleTex(w, h, fn, repeat = true) { const c = mkCanvas(w, h), g = c.getContext('2d'); fn(g, w, h); return toTex(c, repeat); }

function buildTextures() {
  TEX.facades = WALL_COLORS.map((col, i) => facadeTex(col, 100 + i));
  TEX.shops = ['shutter', 'shop', 'hangma', 'cafe', 'shutter', 'pho', 'shop', 'tea'].map((k, i) => ({ kind: k, ...shopTex(k, 300 + i) }));
  TEX.roof = simpleTex(256, 256, (g, w, h) => { g.fillStyle = '#6d6a66'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 0.15, 3); for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(30,30,30,.15)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 50, 0, TAU); g.fill(); } });
  TEX.tile = simpleTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7a3a24'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 22) {
      const off = (y / 16) % 2 ? 11 : 0; g.fillStyle = `hsl(${12 + Math.random() * 10},${45 + Math.random() * 15}%,${26 + Math.random() * 10}%)`;
      g.beginPath(); g.ellipse(x + off, y + 10, 12, 9, 0, 0, Math.PI); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + off - 11, y + 14, 22, 2);
    }
    grime(g, w, h, 0, h, 0.3);
  });
  TEX.asphalt = simpleTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b2b2e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 14000, 0.18, 2);
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(10,10,10,${Math.random() * 0.4})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(60,60,70,${Math.random() * 0.25})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 10 + Math.random() * 20, Math.random() * 3, 0, TAU); g.fill(); }
  });
  TEX.sidewalk = simpleTex(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { const l = 38 + Math.random() * 10; g.fillStyle = (x + y) / 32 % 2 ? `hsl(8,35%,${l}%)` : `hsl(30,8%,${l + 8}%)`; g.fillRect(x, y, 32, 32); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, 32, 2); g.fillRect(x, y, 2, 32); }
    speckle(g, w, h, 2500, 0.15, 2); grime(g, w, h, 0, h, 0.2);
  });
  TEX.paving = simpleTex(512, 512, (g, w, h) => {
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = `hsl(40,10%,${44 + Math.random() * 10}%)`; g.fillRect(x + 2, y + 2, 60, 60); }
    g.strokeStyle = 'rgba(120,40,30,.6)'; g.lineWidth = 6; for (let i = 0; i <= w; i += 256) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    speckle(g, w, h, 6000, 0.15, 2);
  });
  TEX.rail = (() => { const c = mkCanvas(128, 64), g = c.getContext('2d'); g.clearRect(0, 0, 128, 64); g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 58, 128, 6); for (let x = 2; x < 128; x += 10) g.fillRect(x, 0, 3, 64); g.strokeStyle = '#1c1c1c'; g.lineWidth = 2; for (let x = 0; x < 128; x += 20) { g.beginPath(); g.arc(x + 10, 32, 8, 0, TAU); g.stroke(); } return toTex(c); })();
  TEX.awning = simpleTex(128, 128, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = '#ffffff'; g.fillRect(x, 0, 16, h); g.fillStyle = '#d0d0d0'; g.fillRect(x + 16, 0, 16, h); } g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, h - 10, w, 10); });
  TEX.glow = (() => { const c = mkCanvas(128, 128), g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return toTex(c, false); })();
  TEX.flame = (() => { const c = mkCanvas(64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return toTex(c, false); })();
  TEX.scales = simpleTex(128, 128, (g, w, h) => { g.fillStyle = '#1a0f22'; g.fillRect(0, 0, w, h); for (let y = 0; y < h + 16; y += 14) for (let x = 0; x < w + 16; x += 16) { const o = (y / 14) % 2 ? 8 : 0; g.fillStyle = `hsl(${270 + Math.random() * 30},40%,${14 + Math.random() * 10}%)`; g.beginPath(); g.arc(x + o, y, 9, 0, Math.PI); g.fill(); g.strokeStyle = 'rgba(200,120,255,.25)'; g.stroke(); } });
  TEX.skin = simpleTex(128, 128, (g, w, h) => { g.fillStyle = '#2a1830'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1500, 0.3, 3); for (let i = 0; i < 20; i++) { g.strokeStyle = 'rgba(255,80,160,.25)'; g.lineWidth = 1; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); } });
  // tea sign: the user's own sign artwork, with a drawn fallback until the image decodes
  TEX.tea = simpleTex(1024, 342, drawTeaSignFallback, false);
  const img = new Image();
  img.onload = () => { const g = TEX.tea.image.getContext('2d'); g.drawImage(img, 0, 0, 1024, 342); TEX.tea.needsUpdate = true; };
  img.src = TEA_SIGN_SRC;
  TEX.signs = SIGNS.map(s => signTex(s));
}
function drawTeaSignFallback(g, w, h) {
  g.fillStyle = '#f6ecd2'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2f6b2a'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
  g.textAlign = 'center'; g.fillStyle = '#2f6b2a'; g.font = '900 110px Georgia,serif'; g.fillText('TRÀ SỮA', w / 2, 140);
  g.fillStyle = '#7a3f12'; g.font = '900 92px Georgia,serif'; g.fillText('ÔNG TUẤN ANH', w / 2, 240);
  g.fillStyle = '#2f6b2a'; g.fillRect(w / 2 - 260, 262, 520, 50); g.fillStyle = '#f6ecd2'; g.font = 'bold 30px Arial'; g.fillText('5 Nguyễn Văn Cừ, Bồ Đề, Hà Nội', w / 2, 298);
}
const SIGNS = [
  ['PHỞ GÀ', 'Gia truyền từ 1985', '#b71c1c', '#ffe082'], ['BÚN CHẢ', 'Ngon nhất phố', '#1b5e20', '#fff59d'], ['BÁNH MÌ', 'Pate - Trứng - Xíu mại', '#e65100', '#ffffff'],
  ['CÀ PHÊ', 'Cà phê trứng', '#3e2723', '#ffcc80'], ['HÀNG MÃ', 'Đồ chơi Trung thu', '#c62828', '#ffd54f'], ['SỬA XE', 'Vá săm - Thay dầu', '#0d47a1', '#ffffff'],
  ['TẠP HOÁ', 'Bán buôn - Bán lẻ', '#4a148c', '#ffeb3b'], ['BIA HƠI', 'Lạc rang - Nem chua', '#f9a825', '#3e2723'], ['CƠM RANG', 'Dưa bò - Thập cẩm', '#2e7d32', '#ffffff'],
  ['VÀNG BẠC', 'Kim hoàn', '#880e4f', '#ffd700'], ['NHÀ NGHỈ', 'Phòng sạch - Giá rẻ', '#006064', '#ffffff'], ['ẢNH VIỆN', 'Chụp ảnh thẻ lấy ngay', '#37474f', '#ffe082'],
];
function signTex([t, sub, bg, fg]) {
  return simpleTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.font = '900 62px Georgia,serif'; g.fillText(t, w / 2, 72); g.font = 'bold 22px Arial'; g.fillText(sub, w / 2, 108);
  }, false);
}
function plateTex(name) {
  return simpleTex(256, 80, (g, w, h) => {
    g.fillStyle = '#1565c0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 16px Arial'; g.fillText('PHỐ', w / 2, 28); g.font = 'bold 30px Arial'; g.fillText(name.toUpperCase(), w / 2, 62);
  }, false);
}
function bannerTex() {
  return simpleTex(1024, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c62828'); gr.addColorStop(1, '#8e1414'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd54f'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#ffd54f'; g.textAlign = 'center'; g.font = '900 72px Georgia,serif'; g.fillText('VUI TẾT TRUNG THU 2026', w / 2, 105);
  }, false);
}

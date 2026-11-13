'use strict';
/* ===== utilities ===== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function mulberry32(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches);
const PHONE = '0904641180';

/* ===== i18n ===== */
const STR = {
  vi: {
    presents: 'Vũ Tuấn Anh giới thiệu',
    titleSub: 'cùng đại ca Vũ Tuấn Anh',
    madeBy: 'Game được tạo bởi Vũ Tuấn Anh',
    contact: 'Liên hệ',
    tapToStart: 'Nhấn để bắt đầu',
    play: 'Chơi ngay', leaderboard: 'Bảng xếp hạng', settings: 'Cài đặt', howto: 'Hướng dẫn', credits: 'Giới thiệu',
    back: 'Quay lại', close: 'Đóng',
    chooseDiff: 'Chọn mức khó',
    dEasy: 'Dễ', dNormal: 'Thường', dHard: 'Khó',
    dEasyD: 'Quái yếu, hồi máu nhanh. Chơi cho vui.', dNormalD: 'Cân bằng, vẫn dễ thở. Nên chọn.', dHardD: 'Quái đông và đau. Không tự hồi máu.',
    story: 'Đêm Trung thu 2026, ba Cổng Bóng bất ngờ mở ra giữa Phố Cổ, quái vật tràn ra khắp ngõ ngách. Đại ca Vũ Tuấn Anh xách súng ra phố.<br><b>1.</b> Phá cả 3 Cổng Bóng. <b>2.</b> Giữ quảng trường qua 3 đợt quái. <b>3.</b> Hạ Thuồng Luồng, trùm cuối.',
    sLang: 'Ngôn ngữ', sQuality: 'Đồ họa', qLow: 'Thấp', qMed: 'Trung bình', qHigh: 'Cao',
    sSens: 'Độ nhạy chuột', sTouchSens: 'Độ nhạy cảm ứng', sMusic: 'Nhạc nền', sSfx: 'Hiệu ứng âm thanh', sInvert: 'Đảo trục dọc', sFps: 'Hiện FPS',
    hGoal: 'Mục tiêu', hGoalT: 'Đi theo dấu kim cương vàng trên màn hình.\n1. Bắn vỡ 3 Cổng Bóng (chấm tím trên bản đồ).\n2. Về quảng trường, sống sót qua 3 đợt.\n3. Hạ trùm Thuồng Luồng. Bắn vào đầu gây gấp đôi sát thương.',
    hPC: 'Máy tính', hPCT: 'WASD: di chuyển · Chuột: ngắm\nChuột trái: bắn · Chuột phải: ngắm sâu\nShift: chạy · Space: nhảy · R: nạp đạn\n1-4 hoặc lăn chuột: đổi súng · Esc: tạm dừng',
    hTouch: 'Điện thoại', hTouchT: 'Cần gạt trái: di chuyển (đẩy hết cỡ để chạy)\nVuốt nửa phải màn hình: ngắm\nGiữ nút BẮN, vừa giữ vừa kéo để ngắm\nCác nút: Ngắm, Nhảy, Nạp, Đổi súng',
    hPad: 'Tay cầm', hPadT: 'Cần trái: đi · Cần phải: ngắm\nRT: bắn · LT: ngắm sâu · A: nhảy\nX: nạp · Y/RB: đổi súng · L3: chạy · Start: dừng',
    hItems: 'Vật phẩm', hItemsT: 'Bánh mì: hồi 35 máu.\nTrà sữa: hồi máu, chạy nhanh và bắn mạnh hơn trong 15 giây.\nHộp đạn: thêm đạn cho mọi súng.\nPhá cổng sẽ rơi ra súng mới.',
    hFoes: 'Quái vật', hFoesT: 'Quỷ Lóc Chóc: nhỏ, nhanh.\nMa Trơi: bay, bắn cầu lửa từ xa.\nQuỷ Pháo: lao tới rồi nổ, bắn từ xa.\nQuỷ Đầu Trâu: to, chậm, đánh đau.\nThuồng Luồng: trùm cuối.',
    lbNote: 'Điểm được lưu trên trình duyệt của máy này.',
    rank: '#', name: 'Tên', score: 'Điểm', time: 'Thời gian', result: 'Kết quả', date: 'Ngày', win: 'Thắng', lose: 'Thua', empty: 'Chưa có ai. Vào chơi để ghi tên đầu tiên!',
    paused: 'Tạm dừng', resume: 'Tiếp tục', quit: 'Thoát ra menu',
    victory: 'Hà Nội bình yên!', defeat: 'Đại ca gục rồi...',
    saveScore: 'Lưu điểm', again: 'Chơi lại', toMenu: 'Menu chính', saved: 'Đã lưu! Hạng {r} mức {d}.', defName: 'Đại ca',
    stScore: 'Điểm', stKills: 'Quái hạ', stTime: 'Thời gian', stAcc: 'Độ chính xác', stDiff: 'Mức khó', stBonus: 'Thưởng',
    crIdea: 'Ý tưởng & thực hiện', crSetting: 'Bối cảnh', crSettingT: 'Phố Cổ Hà Nội, đêm Trung thu', crTea: 'Nhà tài trợ trà sữa', crTech: 'Công nghệ', crAudio: 'Âm thanh & nhạc', crAudioT: 'Tổng hợp trực tiếp bằng code', thanks: 'Cảm ơn bạn đã chơi!',
    rotate: 'Xoay ngang điện thoại để chơi', clickToLock: 'Nhấn chuột để điều khiển',
    tFire: 'BẮN', tAim: 'NGẮM', tJump: 'NHẢY', tReload: 'NẠP', tSwap: 'ĐỔI',
    reloadHint: 'Nhấn R để nạp đạn', bossName: 'THUỒNG LUỒNG', portal: 'CỔNG BÓNG',
    objPortals: 'Phá Cổng Bóng ({n}/3)', objPortalsSub: 'Cổng gần nhất: phố {s}',
    objGoSquare: 'Về quảng trường', objGoSquareSub: 'Chuẩn bị chặn các đợt quái',
    objWave: 'Đợt {w}/3', objWaveSub: 'Còn {n} quái',
    objNext: 'Đợt tiếp theo sau {t}s', objBoss: 'Hạ Thuồng Luồng', objBossSub: 'Bắn vào đầu để gây gấp đôi sát thương',
    bnStart: 'Bảo vệ Phố Cổ!', bnStartSub: 'Tìm và phá 3 Cổng Bóng',
    bnPortal: 'Cổng Bóng đã vỡ!', bnAllPortals: 'Cả 3 cổng đã vỡ!', bnAllPortalsSub: 'Quái kéo về quảng trường. Ra đó chặn lại!',
    bnWave: 'Đợt {w}', bnWaveSub: 'Giữ vững quảng trường', bnWaveClear: 'Sạch bóng quái!',
    bnBoss: 'THUỒNG LUỒNG TRỖI DẬY', bnBossSub: 'Trùm cuối đã xuất hiện', bnRage: 'Thuồng Luồng nổi giận!',
    tNewWeapon: 'Nhặt được: {w}', tAmmo: '+ Đạn', tHealth: '+ Bánh mì (+35 máu)', tTea: 'Trà Sữa Ông Tuấn Anh! Mạnh lên 15 giây', tNoAmmo: 'Hết đạn!',
    buffTea: 'Trà sữa: {t}s',
    wPistol: 'Súng lục', wShotgun: 'Súng săn', wRifle: 'Súng trường', wLauncher: 'Pháo hoa',
    eImp: 'Quỷ Lóc Chóc', eWisp: 'Ma Trơi', eBomber: 'Quỷ Pháo', eBrute: 'Quỷ Đầu Trâu',
    killed: 'Hạ {e}',
  },
  en: {
    presents: 'Vu Tuan Anh presents',
    titleSub: 'with Big Bro Vu Tuan Anh',
    madeBy: 'Game created by Vu Tuan Anh',
    contact: 'Contact',
    tapToStart: 'Tap to start',
    play: 'Play', leaderboard: 'Leaderboard', settings: 'Settings', howto: 'How to play', credits: 'Credits',
    back: 'Back', close: 'Close',
    chooseDiff: 'Choose difficulty',
    dEasy: 'Easy', dNormal: 'Normal', dHard: 'Hard',
    dEasyD: 'Weak monsters, fast healing. Just for fun.', dNormalD: 'Balanced and still relaxed. Recommended.', dHardD: 'More monsters, more pain. No auto heal.',
    story: 'Mid-Autumn night, 2026. Three Shadow Gates tear open in Hanoi\'s Old Quarter and monsters pour into every alley. Big Bro Vu Tuan Anh grabs his gun and heads out.<br><b>1.</b> Destroy all 3 Shadow Gates. <b>2.</b> Hold the square through 3 waves. <b>3.</b> Slay the Thuong Luong, the final boss.',
    sLang: 'Language', sQuality: 'Graphics', qLow: 'Low', qMed: 'Medium', qHigh: 'High',
    sSens: 'Mouse sensitivity', sTouchSens: 'Touch sensitivity', sMusic: 'Music', sSfx: 'Sound effects', sInvert: 'Invert Y axis', sFps: 'Show FPS',
    hGoal: 'Goal', hGoalT: 'Follow the gold diamond on screen.\n1. Shoot down the 3 Shadow Gates (purple dots on the map).\n2. Go to the square and survive 3 waves.\n3. Slay the Thuong Luong boss. Headshots deal double damage.',
    hPC: 'Desktop', hPCT: 'WASD: move · Mouse: look\nLeft click: shoot · Right click: aim\nShift: sprint · Space: jump · R: reload\n1-4 or wheel: switch weapon · Esc: pause',
    hTouch: 'Phone', hTouchT: 'Left stick: move (push fully to sprint)\nSwipe the right half: look\nHold FIRE and drag it to aim while shooting\nButtons: Aim, Jump, Reload, Swap',
    hPad: 'Gamepad', hPadT: 'Left stick: move · Right stick: look\nRT: shoot · LT: aim · A: jump\nX: reload · Y/RB: switch · L3: sprint · Start: pause',
    hItems: 'Items', hItemsT: 'Banh mi: restores 35 HP.\nMilk tea: heals, plus faster movement and stronger shots for 15 s.\nAmmo box: refills every gun.\nDestroyed gates drop new weapons.',
    hFoes: 'Monsters', hFoesT: 'Imp: small and quick.\nWisp: floats and throws fireballs.\nBomber: rushes in and explodes. Shoot it early.\nBuffalo Demon: big, slow, hits hard.\nThuong Luong: the final boss.',
    lbNote: 'Scores are saved in this browser on this device.',
    rank: '#', name: 'Name', score: 'Score', time: 'Time', result: 'Result', date: 'Date', win: 'Win', lose: 'Lose', empty: 'No scores yet. Play to be the first!',
    paused: 'Paused', resume: 'Resume', quit: 'Quit to menu',
    victory: 'Hanoi is safe!', defeat: 'Big Bro is down...',
    saveScore: 'Save score', again: 'Play again', toMenu: 'Main menu', saved: 'Saved! Rank {r} on {d}.', defName: 'Big Bro',
    stScore: 'Score', stKills: 'Kills', stTime: 'Time', stAcc: 'Accuracy', stDiff: 'Difficulty', stBonus: 'Bonus',
    crIdea: 'Idea & production', crSetting: 'Setting', crSettingT: 'Hanoi Old Quarter, Mid-Autumn night', crTea: 'Milk tea sponsor', crTech: 'Technology', crAudio: 'Sound & music', crAudioT: 'Synthesized live in code', thanks: 'Thanks for playing!',
    rotate: 'Rotate your phone to landscape to play', clickToLock: 'Click to take control',
    tFire: 'FIRE', tAim: 'AIM', tJump: 'JUMP', tReload: 'RLD', tSwap: 'SWAP',
    reloadHint: 'Press R to reload', bossName: 'THUONG LUONG', portal: 'SHADOW GATE',
    objPortals: 'Destroy the Shadow Gates ({n}/3)', objPortalsSub: 'Nearest gate: {s} street',
    objGoSquare: 'Go to the square', objGoSquareSub: 'Get ready to hold off the waves',
    objWave: 'Wave {w}/3', objWaveSub: '{n} monsters left',
    objNext: 'Next wave in {t}s', objBoss: 'Slay the Thuong Luong', objBossSub: 'Headshots deal double damage',
    bnStart: 'Defend the Old Quarter!', bnStartSub: 'Find and destroy 3 Shadow Gates',
    bnPortal: 'Shadow Gate destroyed!', bnAllPortals: 'All 3 gates destroyed!', bnAllPortalsSub: 'The horde is heading to the square. Stop them!',
    bnWave: 'Wave {w}', bnWaveSub: 'Hold the square', bnWaveClear: 'Wave cleared!',
    bnBoss: 'THE THUONG LUONG RISES', bnBossSub: 'The final boss is here', bnRage: 'The Thuong Luong is enraged!',
    tNewWeapon: 'Picked up: {w}', tAmmo: '+ Ammo', tHealth: '+ Banh mi (+35 HP)', tTea: 'Milk tea from Ong Tuan Anh! Power up for 15 s', tNoAmmo: 'Out of ammo!',
    buffTea: 'Milk tea: {t}s',
    wPistol: 'Pistol', wShotgun: 'Shotgun', wRifle: 'Rifle', wLauncher: 'Firework launcher',
    eImp: 'Imp', eWisp: 'Wisp', eBomber: 'Bomber', eBrute: 'Buffalo Demon',
    killed: 'Killed {e}',
  }
};

/* ===== settings ===== */
const DEFAULT_SETTINGS = { lang: 'vi', quality: IS_TOUCH ? 'medium' : 'high', sens: 1, touchSens: 1, fov: 80, music: 0.55, sfx: 0.85, invert: false, fps: false };
const settings = Object.assign({}, DEFAULT_SETTINGS, store.get('bvhn_settings', {}));
function saveSettings() { store.set('bvhn_settings', settings); }
function T(k, vars) {
  let s = (STR[settings.lang] && STR[settings.lang][k]) || STR.vi[k] || k;
  if (vars) for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
  return s;
}
function applyLang() {
  document.documentElement.lang = settings.lang;
  $$('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (k === 'story') el.innerHTML = T(k); else el.textContent = T(k);
  });
  $$('.phone').forEach(el => el.textContent = PHONE);
  $$('.lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === settings.lang));
  document.title = settings.lang === 'vi' ? 'Bảo vệ HN cùng đại ca Vũ Tuấn Anh' : 'Defend Hanoi with Big Bro Vu Tuan Anh';
}

/* ===== audio: everything synthesized ===== */
const SND = (() => {
  let ctx = null, master, sfxG, musG, comp, noiseBuf, verb, verbG;
  const L = { x: 0, z: 0, yaw: 0 };
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.connect(master);
    musG = ctx.createGain(); musG.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; verbG = ctx.createGain(); verbG.gain.value = 0.22; verb.connect(verbG); verbG.connect(master);
    volumes();
  }
  function volumes() { if (!ctx) return; sfxG.gain.value = settings.sfx; musG.gain.value = settings.music * 0.6; }
  const now = () => ctx.currentTime;
  function noise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random(); return s; }
  function out(pos, vol = 1, wet = 0.3) {
    // returns a node to connect a source chain into, positioned in the world
    const g = ctx.createGain(); let v = vol, pan = 0;
    if (pos) {
      const dx = pos.x - L.x, dz = pos.z - L.z, dist = Math.hypot(dx, dz);
      v *= 1 / (1 + dist * dist / 160);
      if (dist > 0.01) { const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw); pan = clamp((dx * rx + dz * rz) / dist, -1, 1) * 0.8; }
    }
    g.gain.value = v;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sfxG); if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w); w.connect(verb); } }
    else { g.connect(sfxG); }
    return g;
  }
  function envGain(t, a, d, peak, dest) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(dest); return g;
  }
  function burst(dest, t, dur, type, f0, f1, q = 1, peak = 1, a = 0.002) {
    const n = noise(), f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    n.connect(f); f.connect(envGain(t, a, dur, peak, dest)); n.start(t); n.stop(t + dur + a + 0.05);
  }
  function tone(dest, t, dur, type, f0, f1, peak = 0.5, a = 0.003) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    o.connect(envGain(t, a, dur, peak, dest)); o.start(t); o.stop(t + dur + a + 0.05);
  }
  const api = {
    init, volumes, listener(x, z, yaw) { L.x = x; L.z = z; L.yaw = yaw; },
    get ctx() { return ctx; }, get musG() { return musG; }, get verb() { return verb; },
    shot(kind) {
      if (!ctx) return; const t = now(), o = out(null, 1, 0.35);
      if (kind === 'pistol') { burst(o, t, 0.16, 'lowpass', 4200, 600, 0.7, 0.9); tone(o, t, 0.12, 'sine', 160, 45, 0.9); burst(o, t, 0.03, 'highpass', 3000, 3000, 1, 0.4); }
      else if (kind === 'shotgun') { burst(o, t, 0.42, 'lowpass', 2600, 200, 0.6, 1.2); tone(o, t, 0.22, 'sine', 120, 35, 1.2); burst(o, t + 0.25, 0.05, 'bandpass', 1800, 1800, 4, 0.25); burst(o, t + 0.36, 0.05, 'bandpass', 1400, 1400, 4, 0.25); }
      else if (kind === 'rifle') { burst(o, t, 0.1, 'lowpass', 5200, 900, 0.8, 0.75); tone(o, t, 0.08, 'square', 140, 60, 0.25); burst(o, t, 0.02, 'highpass', 4000, 4000, 1, 0.35); }
      else if (kind === 'launcher') { burst(o, t, 0.5, 'bandpass', 300, 1800, 2, 0.8, 0.01); tone(o, t, 0.15, 'sine', 90, 40, 0.8); }
    },
    explosion(pos, big = 1, firework = true) {
      if (!ctx) return; const t = now(), o = out(pos, 1.2 * big, 0.6);
      burst(o, t, 1.3 * big, 'lowpass', 1400, 60, 0.8, 1.4); tone(o, t, 0.6, 'sine', 80, 25, 1.3);
      if (firework) for (let i = 0; i < 14; i++) { const tt = t + 0.18 + Math.random() * 0.9; burst(o, tt, 0.04, 'highpass', 3000 + Math.random() * 4000, 2000, 1, 0.25 + Math.random() * 0.3); }
    },
    hit(kill) { if (!ctx) return; const t = now(), o = out(null, 0.5, 0); tone(o, t, 0.05, 'sine', kill ? 1300 : 1900, kill ? 900 : 1700, 0.4); if (kill) tone(o, t + 0.05, 0.08, 'sine', 900, 600, 0.35); },
    impact(pos) { if (!ctx) return; const t = now(), o = out(pos, 0.35, 0.2); burst(o, t, 0.05, 'bandpass', 2500 + Math.random() * 1500, 1200, 3, 0.6); },
    hurt() { if (!ctx) return; const t = now(), o = out(null, 0.8, 0.1); burst(o, t, 0.2, 'lowpass', 900, 200, 1, 0.8); tone(o, t, 0.25, 'sawtooth', 150, 70, 0.25); },
    pickup(kind) { if (!ctx) return; const t = now(), o = out(null, 0.6, 0.4); const base = kind === 'tea' ? 660 : kind === 'weapon' ? 440 : 520; [0, 1, 2].forEach(i => tone(o, t + i * 0.07, 0.25, 'triangle', base * [1, 1.25, 1.5][i], base * [1, 1.25, 1.5][i], 0.35)); },
    reload() { if (!ctx) return; const t = now(), o = out(null, 0.5, 0.1); burst(o, t + 0.05, 0.03, 'bandpass', 2200, 2200, 5, 0.7); burst(o, t + 0.45, 0.04, 'bandpass', 1500, 1500, 5, 0.8); burst(o, t + 0.75, 0.03, 'bandpass', 2600, 2600, 5, 0.7); },
    empty() { if (!ctx) return; const t = now(); burst(out(null, 0.4, 0), t, 0.02, 'bandpass', 3000, 3000, 6, 0.6); },
    step(run) { if (!ctx) return; const t = now(); burst(out(null, run ? 0.22 : 0.15, 0), t, 0.06, 'lowpass', 500 + Math.random() * 300, 120, 1, 0.7); },
    jump() { if (!ctx) return; const t = now(); burst(out(null, 0.2, 0), t, 0.08, 'lowpass', 700, 200, 1, 0.6); },
    swap() { if (!ctx) return; const t = now(); burst(out(null, 0.35, 0), t, 0.04, 'bandpass', 1800, 1800, 4, 0.6); burst(out(null, 0.35, 0), t + 0.12, 0.04, 'bandpass', 1200, 1200, 4, 0.6); },
    growl(kind, pos) {
      if (!ctx) return; const t = now(), o = out(pos, kind === 'boss' ? 1.6 : 0.7, 0.5);
      const f = { imp: 220, brute: 70, wisp: 500, bomber: 160, boss: 55 }[kind] || 150, dur = kind === 'boss' ? 2.2 : kind === 'brute' ? 0.9 : 0.5;
      const osc = ctx.createOscillator(); osc.type = kind === 'wisp' ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(f * rand(0.9, 1.2), t); osc.frequency.exponentialRampToValueAtTime(f * (kind === 'wisp' ? 2 : 0.6), t + dur);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = kind === 'wisp' ? 7 : 28; lg.gain.value = f * 0.15; lfo.connect(lg); lg.connect(osc.frequency);
      const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f * 4; flt.Q.value = 1.2;
      osc.connect(flt); flt.connect(envGain(t, 0.05, dur, kind === 'wisp' ? 0.25 : 0.6, o)); osc.start(t); osc.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
      if (kind === 'boss' || kind === 'brute') burst(o, t, dur, 'lowpass', 600, 100, 1, 0.5, 0.05);
    },
    swipe(pos) { if (!ctx) return; const t = now(); burst(out(pos, 0.6, 0.2), t, 0.18, 'bandpass', 600, 2400, 2, 0.7, 0.02); },
    fireball(pos) { if (!ctx) return; const t = now(); burst(out(pos, 0.5, 0.3), t, 0.4, 'bandpass', 400, 1200, 1.5, 0.6, 0.03); },
    fuse(pos) { if (!ctx) return; const t = now(); for (let i = 0; i < 4; i++) tone(out(pos, 0.5, 0), t + i * 0.13, 0.06, 'square', 1100, 1100, 0.3); },
    die(kind, pos) { if (!ctx) return; const t = now(), o = out(pos, 0.7, 0.4); burst(o, t, 0.35, 'lowpass', 1600, 200, 1, 0.7); tone(o, t, 0.3, 'triangle', kind === 'brute' ? 120 : 320, 60, 0.4); },
    portalHit(pos) { if (!ctx) return; const t = now(); tone(out(pos, 0.25, 0.4), t, 0.15, 'sine', 300 + Math.random() * 200, 200, 0.3); },
    portalBreak(pos) { if (!ctx) return; const t = now(), o = out(pos, 1.4, 0.8); burst(o, t, 1.8, 'lowpass', 2000, 50, 0.8, 1.2); for (let i = 0; i < 6; i++) tone(o, t + i * 0.05, 1.5, 'sine', 1200 - i * 150, 120, 0.15); },
    gong() {
      if (!ctx) return; const t = now(), o = out(null, 0.9, 0.9);
      [[110, 0.6], [167, 0.35], [231, 0.25], [302, 0.18], [395, 0.12]].forEach(([f, a]) => tone(o, t, 3.5, 'sine', f, f * 0.985, a, 0.005));
      burst(o, t, 0.08, 'lowpass', 2000, 400, 1, 0.4);
    },
    boom() { if (!ctx) return; const t = now(), o = out(null, 1.3, 0.7); tone(o, t, 1.2, 'sine', 60, 22, 1.3); burst(o, t, 1.2, 'lowpass', 500, 40, 1, 0.9); },
    ui() { if (!ctx) return; const t = now(); tone(out(null, 0.25, 0.2), t, 0.06, 'triangle', 880, 990, 0.3); },
    // building blocks reused by the music sequencer
    _tone: tone, _burst: burst, _env: envGain,
  };
  return api;
})();

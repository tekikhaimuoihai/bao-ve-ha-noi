/* ===== procedural music: Vietnamese-flavoured pentatonic (D F G A C) ===== */
const MUSIC = (() => {
  const SCALE = [0, 3, 5, 7, 10];
  const deg = (d, base = 62) => { const o = Math.floor(d / 5), i = ((d % 5) + 5) % 5; return base + o * 12 + SCALE[i]; };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  let cur = null, timer = null, step = 0, nextT = 0, bus = null;

  function makeMelody(seed, bars, density) {
    const r = mulberry32(seed), notes = [];
    let d = 5;
    for (let s = 0; s < bars * 16; s++) {
      const strong = s % 4 === 0;
      if (r() < (strong ? density : density * 0.35)) {
        d = clamp(d + Math.round((r() - 0.5) * 4), 2, 10);
        const len = strong ? (r() < 0.5 ? 4 : 6) : 2;
        notes.push({ s, d, len });
      }
    }
    return notes;
  }
  // "đàn bầu"-like voice: pure tone, scoop into pitch, delayed vibrato
  function danBau(t, midi, dur, vol, dest) {
    const ctx = SND.ctx, f = hz(midi);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2 * 0.94, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.09);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.35); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(dest);
    const send = ctx.createGain(); send.gain.value = 0.5; g.connect(send); send.connect(SND.verb);
    [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.4); });
  }
  function pad(t, midis, dur, vol, dest) {
    const ctx = SND.ctx;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g); g.connect(dest);
    const send = ctx.createGain(); send.gain.value = 0.6; g.connect(send); send.connect(SND.verb);
    midis.forEach((m, i) => { [-6, 6].forEach(det => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det; const og = ctx.createGain(); og.gain.value = 0.18; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05); }); });
  }
  function bass(t, midi, dur, vol, dest, dist) {
    const ctx = SND.ctx, o = ctx.createOscillator(); o.type = dist ? 'sawtooth' : 'triangle'; o.frequency.value = hz(midi);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(dist ? 1400 : 700, t); lp.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  const kick = (t, v, d) => { SND._tone(d, t, 0.28, 'sine', 140, 38, v, 0.002); };
  const snare = (t, v, d) => { SND._burst(d, t, 0.16, 'bandpass', 1800, 900, 0.8, v); SND._tone(d, t, 0.08, 'triangle', 220, 160, v * 0.4); };
  const hat = (t, v, d) => { SND._burst(d, t, 0.035, 'highpass', 7000, 7000, 1, v); };
  const tom = (t, v, d, f = 110) => { SND._tone(d, t, 0.35, 'sine', f * 1.6, f, v); SND._burst(d, t, 0.05, 'lowpass', 900, 300, 1, v * 0.3); };
  const block = (t, v, d) => { SND._tone(d, t, 0.05, 'sine', 1250, 1150, v); };   // wood block (mõ)

  const CH = [[50, 62, 65, 69], [53, 60, 65, 69], [55, 62, 67, 70], [48, 60, 64, 67]]; // Dm, F, Gm-ish, C

  const TRACKS = {
    menu: {
      bpm: 72, mel: makeMelody(7, 8, 0.55),
      fn(s, t, sp, d) {
        const bar = Math.floor(s / 16) % 8, inBar = s % 16, ch = CH[Math.floor(bar / 2) % 4];
        if (s % 32 === 0) pad(t, ch.slice(1), sp * 32, 0.16, d);
        if (inBar === 0) bass(t, ch[0] - 12 + 12, sp * 12, 0.35, d);
        if (inBar === 0 || inBar === 10) tom(t, 0.25, d, 90);
        if (inBar === 4 || inBar === 12) block(t, 0.12, d);
        const ms = s % (8 * 16);
        this.mel.forEach(n => { if (n.s === ms) danBau(t, deg(n.d), sp * n.len * 1.6, 0.22, d); });
      }
    },
    battle: {
      bpm: 124, mel: makeMelody(31, 4, 0.5), mel2: makeMelody(77, 4, 0.6),
      fn(s, t, sp, d) {
        const bar = Math.floor(s / 16), inBar = s % 16, ch = CH[[0, 0, 1, 3][bar % 4]];
        if ([0, 6, 8, 11].includes(inBar)) kick(t, 0.85, d);
        if (inBar === 4 || inBar === 12) snare(t, 0.4, d);
        if (inBar % 2 === 0) hat(t, inBar % 4 === 2 ? 0.22 : 0.12, d);
        if (inBar % 2 === 0) bass(t, ch[0] - 12 + (inBar % 8 === 6 ? 12 : 0), sp * 1.8, 0.4, d, true);
        if (s % 64 === 0) pad(t, ch.slice(1), sp * 64, 0.08, d);
        const phrase = Math.floor(bar / 4) % 4;
        if (phrase === 1 || phrase === 3) { const mel = phrase === 1 ? this.mel : this.mel2, ms = s % 64; mel.forEach(n => { if (n.s === ms) danBau(t, deg(n.d, 62), sp * n.len, 0.2, d); }); }
        if (phrase === 2 && inBar % 4 === 0) danBau(t, deg([5, 7, 6, 4][Math.floor(inBar / 4)], 62), sp * 3, 0.12, d);
      }
    },
    boss: {
      bpm: 146, mel: makeMelody(99, 4, 0.7),
      fn(s, t, sp, d) {
        const bar = Math.floor(s / 16), inBar = s % 16, ch = CH[[0, 3, 1, 2][bar % 4]];
        if (inBar % 4 === 0 || inBar === 14) kick(t, 0.95, d);
        if (inBar === 4 || inBar === 12) snare(t, 0.5, d);
        if (inBar === 15) snare(t, 0.25, d);
        hat(t, inBar % 2 ? 0.08 : 0.16, d);
        bass(t, ch[0] - 12 + (inBar % 4 === 3 ? 7 : 0), sp * 0.9, 0.45, d, true);
        if (s % 64 === 0) { SND.gong(); pad(t, ch.slice(1), sp * 64, 0.09, d); }
        if (bar % 8 >= 2) { const ms = s % 64; this.mel.forEach(n => { if (n.s === ms) danBau(t, deg(n.d, 62), sp * n.len, 0.22, d); }); }
        if (inBar === 8 && bar % 2) tom(t, 0.35, d, 70);
      }
    },
    victory: {
      bpm: 92, mel: makeMelody(2026, 4, 0.6),
      fn(s, t, sp, d) {
        const bar = Math.floor(s / 16), inBar = s % 16, ch = CH[[1, 3, 0, 1][bar % 4]];
        if (s % 16 === 0) pad(t, ch.slice(1).map(x => x + 3), sp * 16, 0.12, d);
        if (inBar === 0 || inBar === 8) bass(t, ch[0] - 9, sp * 6, 0.35, d);
        if (inBar % 4 === 2) block(t, 0.1, d);
        if (inBar === 0) tom(t, 0.3, d, 100);
        const ms = s % 64; this.mel.forEach(n => { if (n.s === ms) danBau(t, deg(n.d, 65), sp * n.len * 1.4, 0.2, d); });
      }
    }
  };

  function tick() {
    const ctx = SND.ctx; if (!cur || !ctx) return;
    const sp = 60 / cur.bpm / 4;
    while (nextT < ctx.currentTime + 0.15) { try { cur.fn(step, nextT, sp, bus); } catch (e) { } nextT += sp; step++; }
  }
  return {
    play(name) {
      const ctx = SND.ctx; if (!ctx) return;
      if (cur === TRACKS[name]) return;
      if (bus) { const old = bus; old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); setTimeout(() => old.disconnect(), 2500); }
      bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, ctx.currentTime); bus.gain.setTargetAtTime(1, ctx.currentTime + 0.05, 0.5); bus.connect(SND.musG);
      cur = TRACKS[name] || null; step = 0; nextT = ctx.currentTime + 0.1;
      if (!timer) timer = setInterval(tick, 25);
    },
    stop() { const ctx = SND.ctx; if (bus && ctx) bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); cur = null; }
  };
})();

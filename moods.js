'use strict';

/* Moods: every song gets one. It picks the colours of the now-playing animation and the lock-screen picture. */
const MOODS = {
  happy:     { name: 'Happy',     c: ['#ffd23d', '#ff8a3d', '#ff5fa2'], glow: '#ffb02e' },
  sad:       { name: 'Sad',       c: ['#6aa6ff', '#8fb3e8', '#3b4a8a'], glow: '#4a74d9' },
  romantic:  { name: 'Romantic',  c: ['#ff7aa8', '#ff4f81', '#ffc2d6'], glow: '#ff4f81' },
  chill:     { name: 'Chill',     c: ['#4fe3d0', '#2fb7d6', '#a8f0e6'], glow: '#2fb7d6' },
  energetic: { name: 'Energetic', c: ['#ff3d71', '#7cff6b', '#3dd5ff'], glow: '#ff3d71' },
  nostalgic: { name: 'Nostalgic', c: ['#ffb35c', '#e08a4a', '#f4e1b8'], glow: '#e08a4a' }
};
const MOOD_KEYS = Object.keys(MOODS);

/* first guess from the genre tag in the file, if there is one */
function moodFromGenre(g) {
  g = String(g || '').toLowerCase();
  if (!g) return null;
  if (/blues|sad|emo|ballad|melanch/.test(g)) return 'sad';
  if (/r&b|rnb|soul|love|romantic|bossa|smooth/.test(g)) return 'romantic';
  if (/rock|metal|punk|dance|edm|electro|techno|house|trance|drum|hip.?hop|rap|trap|hard/.test(g)) return 'energetic';
  if (/classical|ambient|jazz|lounge|new age|acoustic|lo-?fi|chill|instrumental|folk/.test(g)) return 'chill';
  if (/oldies|disco|retro|vintage|swing|schlager|easy|60s|70s|80s/.test(g)) return 'nostalgic';
  if (/pop|happy|reggae|latin|funk|ska|summer|party/.test(g)) return 'happy';
  return null;
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------- live animation behind the now-playing cover ---------- */
function createViz(canvas, getCover) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, raf = 0, last = 0, mood = 'chill', parts = [], rings = [];
  let ac = null, analyser = null, freq = null, src = null, real = false;
  const st = { level: 0, bass: 0, avg: 0.2, lastBeat: 0, beat: false, bright: 0 };
  const stats = { n: 0, level: 0, bright: 0, beats: 0, t0: 0 };
  const api = { onPulse: null };
  /* quality: lite = smaller canvas, 30 fps, half the particles; full = sharp, 60 fps */
  const QUALITY = { lite: { scale: 0.6, fps: 30, count: 0.5 }, full: { scale: 1, fps: 60, count: 1 }, off: null };
  let q = QUALITY.lite, K = 0.5, lastDraw = 0;

  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const sc = q ? (q.scale >= 1 ? dpr : q.scale) : 1;
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * sc)); canvas.height = Math.max(1, Math.round(h * sc));
    ctx.setTransform(canvas.width / (w || 1), 0, 0, canvas.height / (h || 1), 0, 0);
  }

  /* read the music if the browser lets us listen in; otherwise fake a steady beat */
  api.connect = audio => {
    try {
      if (src) { src.disconnect(); src = null; }
      real = false;
      const cap = audio.captureStream || audio.mozCaptureStream;
      if (!cap) return false;
      const s = cap.call(audio);
      if (!s.getAudioTracks().length) return false;
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      src = ac.createMediaStreamSource(s);
      analyser = ac.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      freq = new Uint8Array(analyser.frequencyBinCount);
      if (ac.resume) ac.resume();
      real = true;
      return true;
    } catch { real = false; return false; }
  };
  api.isReal = () => real;

  function sample(now) {
    st.beat = false;
    if (real && analyser) {
      analyser.getByteFrequencyData(freq);
      let b = 0, all = 0, cen = 0, mag = 0;
      for (let i = 0; i < freq.length; i++) { all += freq[i]; cen += i * freq[i]; mag += freq[i]; if (i < 6) b += freq[i]; }
      st.bass = b / 6 / 255; st.level = all / freq.length / 255;
      st.bright = mag ? cen / mag / freq.length : 0;
      st.avg = st.avg * 0.96 + st.bass * 0.04;
      if (st.bass > st.avg * 1.25 && st.bass > 0.3 && now - st.lastBeat > 260) { st.beat = true; st.lastBeat = now; }
      stats.n++; stats.level += st.level; stats.bright += st.bright; if (st.beat) stats.beats++;
    } else {
      const ph = (now / 555) % 1;           // pretend ~108 bpm
      st.bass = 0.25 + 0.5 * Math.pow(1 - ph, 3); st.level = 0.3 + 0.12 * Math.sin(now / 900);
      st.bright = 0.2;
      if (ph < 0.04 && now - st.lastBeat > 300) { st.beat = true; st.lastBeat = now; }
    }
  }
  api.resetStats = () => { stats.n = 0; stats.level = 0; stats.bright = 0; stats.beats = 0; stats.t0 = performance.now(); };
  /* after ~20 s of real listening: rough mood guess from tempo, loudness and brightness */
  api.guess = () => {
    const secs = (performance.now() - stats.t0) / 1000;
    if (!real || secs < 20 || stats.n < 200) return null;
    const bpm = Math.max(50, Math.min(180, (stats.beats / secs) * 60)), energy = stats.level / stats.n, bright = stats.bright / stats.n;
    if (energy > 0.28 && bpm >= 115) return 'energetic';
    if (bpm >= 105 && bright > 0.16) return 'happy';
    if (bpm <= 80 && energy < 0.22) return 'sad';
    if (bpm <= 95) return 'romantic';
    return 'chill';
  };

  const heart = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y + s * 0.35); ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.5, y - s, x, y - s * 0.4); ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.4, x, y + s * 0.35); ctx.fill(); };
  const glow = (cv, col) => {
    const R = cv.s * (0.95 + st.bass * 0.6);
    const g = ctx.createRadialGradient(cv.x, cv.y, cv.s * 0.2, cv.x, cv.y, R);
    g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
    ctx.globalAlpha = 0.45 + st.bass * 0.4; ctx.fillStyle = g; ctx.fillRect(cv.x - R, cv.y - R, R * 2, R * 2); ctx.globalAlpha = 1;
  };
  const alive = p => p.y > -60 && p.y < h + 60 && p.x > -60 && p.x < w + 60 && (p.a === undefined || p.a > 0.01);

  const MODES = {
    happy(dt, now, cv, c) {
      glow(cv, MOODS.happy.glow);
      if (parts.length < 140) for (let i = 0; i < (30 + st.level * 160) * dt * K; i++) parts.push({ x: rand(0, w), y: h + 10, vx: rand(-20, 20), vy: -rand(70, 190), s: rand(4, 9), r: rand(0, 6), vr: rand(-4, 4), c: pick(c), sq: Math.random() < 0.5, ph: rand(0, 6) });
      if (st.beat) for (let i = 0; i < 16; i++) { const a = rand(0, 6.28), sp = rand(120, 280); parts.push({ x: cv.x, y: cv.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: rand(4, 8), r: 0, vr: rand(-6, 6), c: pick(c), sq: Math.random() < 0.5, ph: 0, g: 160 }); }
      for (const p of parts) { p.ph += dt * 3; p.x += (p.vx + Math.sin(p.ph) * 22) * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; p.r += p.vr * dt; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = 0.85; if (p.sq) ctx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); else { ctx.beginPath(); ctx.arc(0, 0, p.s * 0.7, 0, 6.3); ctx.fill(); } ctx.restore(); }
    },
    sad(dt, now, cv, c) {
      glow(cv, MOODS.sad.glow);
      for (let i = 0; i < (70 + st.level * 90) * dt * K; i++) parts.push({ x: rand(-60, w + 60), y: -20, vy: rand(380, 620), len: rand(12, 28), a: rand(0.25, 0.6) });
      for (const p of parts) { if (p.rip) { p.r += 40 * dt; p.a -= dt * 0.7; ctx.strokeStyle = c[1]; ctx.globalAlpha = Math.max(0, p.a); ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.28, 0, 0, 6.3); ctx.stroke(); continue; } p.y += p.vy * dt; p.x -= p.vy * dt * 0.12; ctx.strokeStyle = c[0]; ctx.globalAlpha = p.a; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.len * 0.12, p.y - p.len); ctx.stroke(); if (p.y > h * 0.86 && !p.done) { p.done = true; p.a = 0; if (Math.random() < 0.35) parts.push({ rip: true, x: p.x, y: p.y, r: 2, a: 0.5 }); } }
      parts = parts.filter(p => p.rip ? p.a > 0 : (p.a > 0 && p.y < h + 40));
      if (st.beat) rings.push({ r: cv.s * 0.55, a: 0.45, v: 90 });
      ctx.lineWidth = 2; for (const r of rings) { r.r += r.v * dt; r.a -= dt * 0.4; ctx.strokeStyle = c[1]; ctx.globalAlpha = Math.max(0, r.a); ctx.beginPath(); ctx.arc(cv.x, cv.y, r.r, 0, 6.3); ctx.stroke(); }
      rings = rings.filter(r => r.a > 0);
    },
    romantic(dt, now, cv, c) {
      glow(cv, MOODS.romantic.glow);
      if (parts.length < 60) for (let i = 0; i < (5 + st.level * 12) * dt * K; i++) parts.push({ x: rand(0, w), y: h + 30, vy: -rand(35, 85), s: rand(9, 24), ph: rand(0, 6), a: rand(0.4, 0.85), c: pick(c) });
      if (st.beat) for (let i = 0; i < 3; i++) parts.push({ x: cv.x + rand(-cv.s * 0.6, cv.s * 0.6), y: cv.y + cv.s * 0.5, vy: -rand(80, 140), s: rand(18, 34), ph: rand(0, 6), a: 0.9, c: pick(c) });
      for (const p of parts) { p.ph += dt * 1.6; p.y += p.vy * dt; p.x += Math.sin(p.ph) * 18 * dt; p.a -= dt * 0.05; ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = p.c; heart(p.x, p.y, p.s); }
      parts = parts.filter(alive);
    },
    chill(dt, now, cv, c) {
      glow(cv, MOODS.chill.glow);
      const amp = 16 + st.level * 70;
      [0, 1, 2].forEach(i => { ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += (q && q.scale < 1 ? 24 : 12)) ctx.lineTo(x, h * (0.8 + i * 0.045) + Math.sin(x * 0.012 + now / (1400 - i * 260) + i) * amp * (1 - i * 0.25)); ctx.lineTo(w, h); ctx.closePath(); ctx.globalAlpha = 0.2 - i * 0.05; ctx.fillStyle = c[i]; ctx.fill(); });
      if (parts.length < 24) for (let i = 0; i < 2.5 * dt * K; i++) parts.push({ x: rand(0, w), y: h + 10, vy: -rand(25, 60), s: rand(3, 11), ph: rand(0, 6), a: rand(0.25, 0.55) });
      for (const p of parts) { p.ph += dt; p.y += p.vy * dt; p.x += Math.sin(p.ph) * 12 * dt; p.a -= dt * 0.03; ctx.globalAlpha = Math.max(0, p.a); ctx.strokeStyle = c[2]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.3); ctx.stroke(); }
      parts = parts.filter(alive);
    },
    energetic(dt, now, cv, c) {
      glow(cv, MOODS.energetic.glow);
      if (st.beat) rings.push({ r: cv.s * 0.5, a: 0.9, v: 420, c: pick(c) });
      ctx.lineWidth = 3; for (const r of rings) { r.r += r.v * dt; r.a -= dt * 1.1; ctx.strokeStyle = r.c; ctx.globalAlpha = Math.max(0, r.a); ctx.beginPath(); ctx.arc(cv.x, cv.y, r.r, 0, 6.3); ctx.stroke(); }
      rings = rings.filter(r => r.a > 0);
      const n = 32, bw = w / n;
      for (let i = 0; i < n; i++) { const v = real && freq ? freq[Math.min(freq.length - 1, Math.floor(i * freq.length / n * 0.7))] / 255 : 0.25 + 0.5 * Math.abs(Math.sin(now / 260 + i * 0.7)) * (0.5 + st.bass); ctx.globalAlpha = 0.85; ctx.fillStyle = c[i % 3]; const bh = 8 + v * h * 0.22; ctx.fillRect(i * bw + 2, h - bh, bw - 4, bh); }
    },
    nostalgic(dt, now, cv, c) {
      glow(cv, MOODS.nostalgic.glow);
      if (parts.length < 45) parts.push({ x: rand(0, w), y: rand(0, h), vx: rand(-8, 8), vy: rand(-12, -3), s: rand(1, 3), a: rand(0.2, 0.6) });
      for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(now / 500 + p.x)); ctx.fillStyle = c[2]; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.3); ctx.fill(); }
      parts = parts.filter(alive);
      ctx.strokeStyle = c[0]; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.07 + 0.05 * st.bass; ctx.beginPath(); ctx.arc(cv.x, cv.y, cv.s * (0.62 + i * 0.06), 0, 6.3); ctx.stroke(); }
      ctx.globalAlpha = 0.25; ctx.lineWidth = 2; const a0 = now / 2600;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cv.x, cv.y, cv.s * 0.68, a0 + k * 1.57, a0 + k * 1.57 + 0.3); ctx.stroke(); }
    }
  };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || !q) return;
    if (now - lastDraw < 1000 / q.fps - 3) return;
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    sample(now);
    ctx.clearRect(0, 0, w, h);
    const cv = getCover();
    ctx.lineWidth = 1;
    (MODES[mood] || MODES.chill)(dt, now, cv, MOODS[mood] ? MOODS[mood].c : MOODS.chill.c);
    ctx.globalAlpha = 1;
    if (api.onPulse) api.onPulse(reduce ? 0 : st.bass);
  }
  api.setQuality = name => { q = QUALITY[name] || null; K = q ? q.count : 1; parts = []; rings = []; if (raf) { if (q) resize(); else api.stop(); } };
  api.start = () => { if (raf || !q) return; resize(); last = performance.now(); if (reduce) { sample(last); ctx.clearRect(0, 0, w, h); MODES[mood](0.016, last, getCover(), MOODS[mood].c); return; } raf = requestAnimationFrame(frame); };
  api.stop = () => { cancelAnimationFrame(raf); raf = 0; if (api.onPulse) api.onPulse(null); };
  api.setMood = k => { mood = MOODS[k] ? k : 'chill'; parts = []; rings = []; };
  api.resize = resize;
  window.addEventListener('resize', () => { if (raf) resize(); });
  return api;
}

/* ---------- lock-screen picture for songs without cover art (the phone can only show a still image) ---------- */
function moodArt(letter, moodKey, asData) {
  const m = MOODS[moodKey] || MOODS.chill, c = m.c, S = 512;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#05121a'); g.addColorStop(1, c[2] + '55'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  const rg = x.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.6); rg.addColorStop(0, m.glow + 'cc'); rg.addColorStop(1, m.glow + '00'); x.fillStyle = rg; x.fillRect(0, 0, S, S);
  x.globalAlpha = 0.55; x.lineWidth = 3;
  if (moodKey === 'happy') for (let i = 0; i < 38; i++) { x.fillStyle = c[i % 3]; x.beginPath(); x.arc((i * 97) % S, (i * 53) % S, 5 + (i % 5) * 2, 0, 6.3); x.fill(); }
  else if (moodKey === 'sad') { x.strokeStyle = c[0]; for (let i = 0; i < 46; i++) { const px = (i * 61) % S, py = (i * 37) % S; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 8, py + 34); x.stroke(); } }
  else if (moodKey === 'romantic') for (let i = 0; i < 12; i++) { x.fillStyle = c[i % 3]; const px = 40 + (i * 83) % 440, py = 40 + (i * 131) % 440, s = 16 + (i % 4) * 8; x.beginPath(); x.moveTo(px, py + s * 0.35); x.bezierCurveTo(px - s, py - s * 0.4, px - s * 0.5, py - s, px, py - s * 0.4); x.bezierCurveTo(px + s * 0.5, py - s, px + s, py - s * 0.4, px, py + s * 0.35); x.fill(); }
  else if (moodKey === 'chill') for (let i = 0; i < 4; i++) { x.fillStyle = c[i % 3]; x.globalAlpha = 0.25; x.beginPath(); x.moveTo(0, S); for (let px = 0; px <= S; px += 8) x.lineTo(px, 330 + i * 40 + Math.sin(px * 0.02 + i) * 22); x.lineTo(S, S); x.fill(); }
  else if (moodKey === 'energetic') for (let i = 0; i < 5; i++) { x.strokeStyle = c[i % 3]; x.lineWidth = 6; x.beginPath(); x.arc(S / 2, S / 2, 120 + i * 42, 0, 6.3); x.stroke(); }
  else for (let i = 0; i < 9; i++) { x.strokeStyle = c[0]; x.lineWidth = 2; x.beginPath(); x.arc(S / 2, S / 2, 130 + i * 18, 0, 6.3); x.stroke(); }
  x.globalAlpha = 1; x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 24;
  x.font = '800 230px "Syne", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(letter || '♪').toUpperCase(), S / 2, S / 2 + 10);
  x.shadowBlur = 0; x.font = '700 30px system-ui, sans-serif'; x.fillStyle = c[2]; x.fillText(m.name.toUpperCase(), S / 2, S - 44);
  if (asData) return Promise.resolve(cv.toDataURL('image/png'));
  return new Promise(res => cv.toBlob(b => res(b ? URL.createObjectURL(b) : null), 'image/png'));
}

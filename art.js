'use strict';

/* Unique cover art, drawn on the phone from a song's name.
   The same song always gets the same picture and every song gets a different one, so there is nothing to
   prepare when you add more songs: the art is made the moment a song is added. If the song has a mood, the
   picture uses that mood's colours. */

function artHash(str) {
  let h = 2166136261 >>> 0;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function artRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const ART_PALETTES = [
  { bg: ['#041a22', '#0b3d4a'], c: ['#4fe3d0', '#2fb7d6', '#a8f0e6'] },   // aqua
  { bg: ['#1f0c0c', '#4a2018'], c: ['#ff8a65', '#ff5f7e', '#ffd1b8'] },   // coral
  { bg: ['#1c1105', '#4a2c0c'], c: ['#ffb347', '#ff8a3d', '#ffe3a8'] },   // amber
  { bg: ['#1f0a14', '#4a1428'], c: ['#ff7aa8', '#ff4f81', '#ffc2d6'] },   // rose
  { bg: ['#0a1a0c', '#17401f'], c: ['#7bff9e', '#c6ff5c', '#d8ffe0'] },   // lime
  { bg: ['#06101f', '#102a52'], c: ['#6aa6ff', '#4fd0ff', '#cfe4ff'] },   // sky
  { bg: ['#1d0d08', '#4a2012'], c: ['#ff9a5a', '#ff5fa2', '#ffd23d'] },   // sunset
  { bg: ['#041b17', '#0c4a3f'], c: ['#5dffc0', '#3dd5b0', '#c8fff0'] }    // mint
];

const artMix = (a, b, t) => {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

function artPalette(h, moodKey) {
  if (moodKey && typeof MOODS !== 'undefined' && MOODS[moodKey]) {
    const c = MOODS[moodKey].c;
    return { bg: ['#05121a', artMix('#05121a', c[0], 0.28)], c };
  }
  return ART_PALETTES[h % ART_PALETTES.length];
}

/* ---- the 14 styles. Each draws on a 512x512 canvas using the song's own random numbers ---- */
const ART_STYLES = [
  function waves(x, S, r, P) {
    for (let i = 0; i < 6; i++) {
      const base = S * (0.32 + i * 0.12), amp = 16 + r() * 26, f1 = 0.008 + r() * 0.012, f2 = 0.02 + r() * 0.02, ph = r() * 6;
      x.beginPath(); x.moveTo(0, S);
      for (let px = 0; px <= S; px += 8) x.lineTo(px, base + Math.sin(px * f1 + ph) * amp + Math.sin(px * f2 + ph * 2) * amp * 0.4);
      x.lineTo(S, S); x.closePath(); x.globalAlpha = 0.28 + i * 0.1; x.fillStyle = P.c[i % 3]; x.fill();
    }
    x.globalAlpha = 1;
  },
  function dunes(x, S, r, P) {
    const sx = S * (0.25 + r() * 0.5), sy = S * (0.34 + r() * 0.16), sr = 34 + r() * 36;
    const g = x.createRadialGradient(sx, sy, 4, sx, sy, sr * 3); g.addColorStop(0, P.c[0] + 'cc'); g.addColorStop(1, P.c[0] + '00');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.fillStyle = P.c[2]; x.beginPath(); x.arc(sx, sy, sr, 0, 6.3); x.fill();
    for (let i = 0; i < 4; i++) {
      const base = S * (0.58 + i * 0.1), amp = 22 + r() * 22, f = 0.006 + r() * 0.006, ph = r() * 6;
      x.beginPath(); x.moveTo(0, S);
      for (let px = 0; px <= S; px += 8) x.lineTo(px, base + Math.sin(px * f + ph) * amp);
      x.lineTo(S, S); x.closePath(); x.fillStyle = artMix(P.bg[1], '#000000', 0.25 + i * 0.2); x.fill();
    }
  },
  function forest(x, S, r, P) {
    for (let l = 0; l < 4; l++) {
      const y = S * (0.5 + l * 0.14), h = 70 + l * 26;
      x.fillStyle = artMix(P.c[1], P.bg[0], 0.55 + l * 0.15);
      for (let px = -20; px < S + 30; px += 26 + l * 8) {
        const hh = h * (0.7 + r() * 0.6), w = hh * 0.4, x0 = px + (r() - 0.5) * 14;
        for (let k = 0; k < 3; k++) { const yy = y - k * hh * 0.3, ww = w * (1 - k * 0.27); x.beginPath(); x.moveTo(x0 - ww, yy); x.lineTo(x0, yy - hh * 0.5); x.lineTo(x0 + ww, yy); x.fill(); }
      }
      x.fillRect(0, y - 4, S, S);
      const m = x.createLinearGradient(0, y - 40, 0, y + 10); m.addColorStop(0, P.c[2] + '00'); m.addColorStop(1, P.c[2] + '22'); x.fillStyle = m; x.fillRect(0, y - 40, S, 50);
    }
  },
  function orbit(x, S, r, P) {
    for (let i = 0; i < 70; i++) { x.globalAlpha = 0.2 + r() * 0.7; x.fillStyle = '#fff'; x.beginPath(); x.arc(r() * S, r() * S * 0.7, 0.5 + r() * 1.3, 0, 6.3); x.fill(); }
    x.globalAlpha = 1;
    const cx = S * (0.3 + r() * 0.4), cy = S * (1.15 + r() * 0.2), R = S * (0.62 + r() * 0.2);
    const a = x.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25); a.addColorStop(0, P.c[0] + '88'); a.addColorStop(1, P.c[0] + '00'); x.fillStyle = a; x.fillRect(0, 0, S, S);
    const g = x.createLinearGradient(0, cy - R, 0, cy + R); g.addColorStop(0, P.c[1]); g.addColorStop(0.3, P.bg[1]); g.addColorStop(1, P.bg[0]);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.3); x.fill();
    x.strokeStyle = P.c[2]; x.globalAlpha = 0.7; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R, 0, 6.3); x.stroke(); x.globalAlpha = 1;
  },
  function rain(x, S, r, P) {
    const ang = 0.12 + r() * 0.2;
    for (let i = 0; i < 130; i++) {
      const px = r() * (S + 160) - 80, py = r() * S, l = 40 + r() * 110;
      x.strokeStyle = P.c[i % 3]; x.globalAlpha = 0.1 + r() * 0.4; x.lineWidth = 0.8 + r() * 1.8; x.lineCap = 'round';
      x.beginPath(); x.moveTo(px, py); x.lineTo(px - l * ang, py + l); x.stroke();
    }
    x.globalAlpha = 1;
    const g = x.createRadialGradient(S / 2, S * 1.05, 10, S / 2, S * 1.05, S * 0.7); g.addColorStop(0, P.c[0] + '55'); g.addColorStop(1, P.c[0] + '00'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  },
  function lanterns(x, S, r, P) {
    for (let i = 0; i < 22; i++) {
      const px = r() * S, py = S * (0.12 + r() * 0.85), w = 14 + r() * 28, h = w * 1.25, c = P.c[i % 2];
      const g = x.createRadialGradient(px, py, 2, px, py, w * 2); g.addColorStop(0, c + '88'); g.addColorStop(1, c + '00'); x.fillStyle = g; x.fillRect(px - w * 2, py - w * 2, w * 4, w * 4);
      x.globalAlpha = 0.55 + r() * 0.4; x.fillStyle = i % 3 ? c : P.c[2];
      x.beginPath(); x.roundRect ? x.roundRect(px - w / 2, py - h / 2, w, h, w * 0.3) : x.rect(px - w / 2, py - h / 2, w, h); x.fill();
    }
    x.globalAlpha = 1;
  },
  function aurora(x, S, r, P) {
    for (let i = 0; i < 70; i++) { x.globalAlpha = 0.2 + r() * 0.6; x.fillStyle = '#fff'; x.beginPath(); x.arc(r() * S, r() * S * 0.6, 0.5 + r() * 1.1, 0, 6.3); x.fill(); }
    for (let k = 0; k < 3; k++) {
      const col = P.c[k % 3], ph = r() * 6, f = 0.01 + r() * 0.01, top = S * (0.08 + k * 0.08), bot = S * (0.55 + r() * 0.15);
      const g = x.createLinearGradient(0, top, 0, bot); g.addColorStop(0, col + '00'); g.addColorStop(0.35, col + 'cc'); g.addColorStop(1, col + '00'); x.fillStyle = g;
      for (let px = 0; px < S; px += 3) { const o = Math.sin(px * f + ph) * 40 + Math.sin(px * f * 2.3 + ph) * 18; x.globalAlpha = 0.18 + 0.28 * Math.abs(Math.sin(px * 0.02 + ph)); x.fillRect(px, top + o, 3, bot - top); }
    }
    x.globalAlpha = 1;
    const h = x.createLinearGradient(0, S * 0.7, 0, S); h.addColorStop(0, '#00000000'); h.addColorStop(1, '#000000cc'); x.fillStyle = h; x.fillRect(0, S * 0.7, S, S * 0.3);
  },
  function starfield(x, S, r, P) {
    x.save(); x.translate(S / 2, S / 2); x.rotate(-0.6 + r() * 0.4);
    const g = x.createLinearGradient(0, -90, 0, 90); g.addColorStop(0, P.c[0] + '00'); g.addColorStop(0.5, P.c[0] + '55'); g.addColorStop(1, P.c[0] + '00'); x.fillStyle = g; x.fillRect(-S, -90, S * 2, 180); x.restore();
    for (let i = 0; i < 170; i++) { const big = r() > 0.95; x.globalAlpha = 0.25 + r() * 0.75; x.fillStyle = big ? P.c[2] : '#fff'; x.beginPath(); x.arc(r() * S, r() * S, big ? 2.2 : 0.5 + r() * 1.2, 0, 6.3); x.fill(); }
    x.globalAlpha = 1;
  },
  function ripples(x, S, r, P) {
    const cx = S * (0.2 + r() * 0.6), cy = S * (0.2 + r() * 0.6), step = 20 + r() * 16;
    for (let i = 1; i < 26; i++) { x.strokeStyle = P.c[i % 3]; x.globalAlpha = Math.max(0.05, 0.7 - i * 0.03); x.lineWidth = 2 + (i % 4); x.beginPath(); x.arc(cx, cy, i * step, 0, 6.3); x.stroke(); }
    x.globalAlpha = 1; x.fillStyle = P.c[2]; x.beginPath(); x.arc(cx, cy, 10 + r() * 8, 0, 6.3); x.fill();
  },
  function ridges(x, S, r, P) {
    const mx = S * (0.2 + r() * 0.6), my = S * (0.2 + r() * 0.1);
    const g = x.createRadialGradient(mx, my, 2, mx, my, 120); g.addColorStop(0, P.c[2] + 'aa'); g.addColorStop(1, P.c[2] + '00'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.fillStyle = P.c[2]; x.beginPath(); x.arc(mx, my, 26 + r() * 14, 0, 6.3); x.fill();
    for (let l = 0; l < 6; l++) {
      const base = S * (0.42 + l * 0.1);
      x.beginPath(); x.moveTo(0, S); let yy = base;
      for (let px = 0; px <= S + 40; px += 36) { yy = base + (r() - 0.5) * (60 - l * 4); x.lineTo(px, yy); }
      x.lineTo(S, S); x.closePath(); x.fillStyle = artMix(P.c[1], P.bg[0], 0.45 + l * 0.11); x.fill();
    }
  },
  function bokeh(x, S, r, P) {
    for (let i = 0; i < 36; i++) {
      const px = r() * S, py = r() * S, rad = 14 + r() * 62, c = P.c[i % 3];
      const g = x.createRadialGradient(px, py, rad * 0.2, px, py, rad); g.addColorStop(0, c + '66'); g.addColorStop(0.85, c + '22'); g.addColorStop(1, c + '00');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 6.3); x.fill();
      x.strokeStyle = c; x.globalAlpha = 0.25; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, rad * 0.9, 0, 6.3); x.stroke(); x.globalAlpha = 1;
    }
  },
  function overlap(x, S, r, P) {
    x.globalCompositeOperation = 'lighter';
    const n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { const px = S * (0.2 + r() * 0.6), py = S * (0.2 + r() * 0.6), rad = S * (0.16 + r() * 0.22); x.fillStyle = P.c[i % 3] + '55'; x.beginPath(); x.arc(px, py, rad, 0, 6.3); x.fill(); x.strokeStyle = P.c[(i + 1) % 3] + '99'; x.lineWidth = 2; x.stroke(); }
    x.globalCompositeOperation = 'source-over';
  },
  function skyline(x, S, r, P) {
    const n = 22, bw = S / n, ph = r() * 6, f = 0.35 + r() * 0.5;
    for (let i = 0; i < n; i++) {
      const v = 0.25 + 0.55 * Math.abs(Math.sin(i * f + ph)) * (0.6 + 0.4 * r()), bh = S * v;
      const g = x.createLinearGradient(0, S - bh, 0, S); g.addColorStop(0, P.c[i % 3]); g.addColorStop(1, P.c[(i + 1) % 3] + '33');
      x.fillStyle = g; x.fillRect(i * bw + 3, S - bh, bw - 6, bh);
      x.fillStyle = P.c[2]; x.fillRect(i * bw + 3, S - bh - 8, bw - 6, 4);
    }
  },
  function vinyl(x, S, r, P) {
    const cx = S * (0.35 + r() * 0.3), cy = S * (0.35 + r() * 0.3);
    x.fillStyle = '#05080c'; x.beginPath(); x.arc(cx, cy, S * 0.46, 0, 6.3); x.fill();
    for (let i = 0; i < 26; i++) { x.strokeStyle = '#ffffff'; x.globalAlpha = 0.05 + (i % 3) * 0.03; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, S * 0.16 + i * 6.5, 0, 6.3); x.stroke(); }
    x.globalAlpha = 1;
    const g = x.createLinearGradient(cx - 80, cy - 80, cx + 80, cy + 80); g.addColorStop(0, P.c[0]); g.addColorStop(1, P.c[1]); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, S * 0.14, 0, 6.3); x.fill();
    x.fillStyle = '#05121a'; x.beginPath(); x.arc(cx, cy, 6, 0, 6.3); x.fill();
    x.strokeStyle = P.c[2]; x.globalAlpha = 0.5; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, S * 0.42, -0.9, -0.2); x.stroke(); x.globalAlpha = 1;
  }
];

/* returns a JPEG Blob. seedText: whatever identifies the song; moodKey: optional */
function makeSongArt(seedText, moodKey) {
  const S = 480, h = artHash(seedText), r = artRng(h ^ 0x9e3779b9), P = artPalette(h, moodKey);
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, S * (0.3 + r() * 0.5), S); g.addColorStop(0, P.bg[0]); g.addColorStop(1, P.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  ART_STYLES[(h >>> 3) % ART_STYLES.length](x, S, r, P);
  const v = x.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.75); v.addColorStop(0, '#00000000'); v.addColorStop(1, '#00000066');
  x.fillStyle = v; x.fillRect(0, 0, S, S);
  return new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', 0.86));
}

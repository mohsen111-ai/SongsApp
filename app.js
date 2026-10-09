'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = t => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('songsapp.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('songsapp.' + k, JSON.stringify(v)); } catch { /* private mode */ } }
};

const P = {
  library: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  lists: '<path d="M4 7h11M4 12h11M4 17h7"/><circle cx="18.5" cy="16.5" r="2.5"/><path d="M21 16.5V8"/>',
  recent: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<rect x="6" y="5" width="4.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/>',
  next: '<path d="M6 5l9 7-9 7z"/><path d="M18.5 5v14"/>',
  prev: '<path d="M18 5l-9 7 9 7z"/><path d="M5.5 5v14"/>',
  shuffle: '<path d="M3 7h3c4 0 6 10 10 10h5M3 17h3c1.6 0 2.8-1.2 3.8-2.8M14 8.6C15 7.6 16 7 17 7h4"/><path d="M19 5l2 2-2 2M19 15l2 2-2 2"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h13M20 13v2a3 3 0 0 1-3 3H4"/><path d="M17 3l3 3-3 3M7 21l-3-3 3-3"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
  queue: '<path d="M4 7h11M4 12h11M4 17h6"/><path d="M18 14v6M15 17h6"/>',
  next2: '<path d="M5 6l7 6-7 6zM13 6l7 6-7 6z"/>',
  looks: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9.5" r="1.6"/><path d="M5 17l5-5 4 4 2-2 3 3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>'
};

/* wallpapers: used as the app backdrop, as cover art for songs without any, and as the gallery in "Looks" */
const WALLPAPERS = [
  { id: 'night-tide', name: 'Night Tide' },
  { id: 'ember-dunes', name: 'Ember Dunes' },
  { id: 'glass-forest', name: 'Glass Forest' },
  { id: 'low-orbit', name: 'Low Orbit' },
  { id: 'cold-rain', name: 'Cold Rain' },
  { id: 'paper-lanterns', name: 'Paper Lanterns', live: true },
  { id: 'aurora-veil', name: 'Aurora Veil', live: true },
  { id: 'starfield-drift', name: 'Starfield Drift', live: true }
];
const wpUrl = w => `wallpapers/${w.id}.svg`;
const wpFor = str => WALLPAPERS[[...String(str)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) % WALLPAPERS.length];
const FILLED = new Set(['play', 'pause', 'more', 'next2']);
const ico = (n, extra = '') => `<svg class="i ${FILLED.has(n) || extra === 'fill' ? 'fill' : ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
// next/prev look better as strokes + fill mix; keep outline paths filled for the triangle only
const icoMedia = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor">${P[n]}</svg>`;

/* ================= storage (IndexedDB, files stay on this phone) ================= */
const DB = {
  open() {
    return this.p || (this.p = new Promise((res, rej) => {
      const r = indexedDB.open('songsapp', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
        d.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  },
  async run(store, mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
      t.onerror = t.onabort = () => rej(t.error);
    });
  },
  all: store => DB.run(store, 'readonly', s => s.getAll()),
  put: (store, v) => DB.run(store, 'readwrite', s => s.put(v)),
  del: (store, id) => DB.run(store, 'readwrite', s => s.delete(id))
};

/* ================= ID3 tags (title / artist / album / cover) ================= */
const synch = (b, i) => (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3];
function decodeText(enc, b) {
  if (enc === 1) {
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
    return new TextDecoder('utf-16le').decode(b);
  }
  if (enc === 2) return new TextDecoder('utf-16be').decode(b);
  return new TextDecoder(enc === 3 ? 'utf-8' : 'iso-8859-1').decode(b);
}
const frameText = body => decodeText(body[0], body.subarray(1)).replace(/\0+$/g, '').split('\0')[0].trim();
function framePicture(body) {
  const enc = body[0];
  let i = 1;
  while (i < body.length && body[i] !== 0) i++;
  const mime = decodeText(0, body.subarray(1, i)) || 'image/jpeg';
  i += 2; // null + picture type
  if (enc === 1 || enc === 2) { while (i + 1 < body.length && !(body[i] === 0 && body[i + 1] === 0)) i += 2; i += 2; }
  else { while (i < body.length && body[i] !== 0) i++; i++; }
  return body.length > i ? new Blob([body.subarray(i)], { type: mime.includes('/') ? mime : 'image/jpeg' }) : null;
}
async function readTags(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (String.fromCharCode(head[0], head[1], head[2]) !== 'ID3') return {};
    const ver = head[3];
    const size = synch(head, 6);
    const buf = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());
    const out = {};
    let p = 0;
    while (p + 10 <= buf.length) {
      const id = String.fromCharCode(buf[p], buf[p + 1], buf[p + 2], buf[p + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fs = ver === 4 ? synch(buf, p + 4) : ((buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]) >>> 0;
      const body = buf.subarray(p + 10, p + 10 + fs);
      p += 10 + fs;
      if (!body.length) continue;
      if (id === 'TIT2') out.title = frameText(body);
      else if (id === 'TPE1') out.artist = frameText(body);
      else if (id === 'TALB') out.album = frameText(body);
      else if (id === 'TCON') out.genre = frameText(body);
      else if (id === 'APIC' && !out.cover) out.cover = framePicture(body);
    }
    return out;
  } catch { return {}; }
}

/* ================= state ================= */
let songs = [], lists = [];
let view = store.get('view', 'library');
let openList = null;       // playlist id being viewed
let shown = [];            // song ids on screen (what "play" queues)
let queue = [], qi = -1;
let shuffle = store.get('shuffle', false);
let repeat = store.get('repeat', 'off'); // off | all | one
let curUrl = null;
const audio = new Audio();
audio.preload = 'auto';
const coverUrls = new Map();
const moodOf = s => (s && s.mood) || 'chill';
const viz = createViz($('#viz'), () => { const r = $('#fullCov').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / 2 }; });
viz.onPulse = b => $('#fullCov').style.setProperty('--pulse', (b * 0.045).toFixed(3));
let vizFor = null;

const byId = id => songs.find(s => s.id === id);
const cur = () => byId(queue[qi]);
const isPlaying = () => !audio.paused && !audio.ended;

function coverUrl(s) {
  if (!s || !s.cover) return null;
  if (!coverUrls.has(s.id)) coverUrls.set(s.id, URL.createObjectURL(s.cover));
  return coverUrls.get(s.id);
}
function thumb(s, cls = 'cov') {
  const u = coverUrl(s);
  return u ? `<img class="${cls}" src="${u}" alt="" loading="lazy">`
    : `<div class="${cls} art" style="background-image:url(${wpUrl(wpFor(s.title + s.artist))})">${esc((s.title || '?').trim().charAt(0).toUpperCase())}</div>`;
}

/* ================= look: wallpaper + theme ================= */
let wallpaper = store.get('wallpaper', 'night-tide');
let theme = store.get('theme', 'auto'); // auto | light | dark
function applyLook() {
  const w = WALLPAPERS.find(x => x.id === wallpaper) || WALLPAPERS[0];
  document.documentElement.style.setProperty('--wp', `url(${wpUrl(w)})`);
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

/* ================= toast + sheet ================= */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2300);
}
const sheet = $('#sheet');
function openSheet(title, items) {
  $('#sheetTitle').textContent = title;
  const body = $('#sheetBody');
  body.innerHTML = items.map((it, i) => `<button type="button" data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? ico(it.icon) : ''}<span>${esc(it.label)}</span></button>`).join('');
  body.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    sheet.close();
    items[+b.dataset.i].fn();
  };
  sheet.showModal();
}
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

/* in-app replacement for prompt()/confirm(): resolves to an array of the field values, or null if cancelled */
const askDlg = $('#ask');
function ask(title, { fields = [], message = '', ok = 'OK', danger = false } = {}) {
  return new Promise(resolve => {
    $('#askTitle').textContent = title;
    $('#askMsg').textContent = message;
    $('#askMsg').hidden = !message;
    $('#askFields').innerHTML = fields.map((f, i) => `<label>${esc(f.label)}<input data-i="${i}" value="${esc(f.value || '')}" autocomplete="off" maxlength="120"></label>`).join('');
    const okBtn = $('#askOk');
    okBtn.textContent = ok;
    okBtn.classList.toggle('danger', danger);
    const form = $('#askForm');
    let result = null;
    const onSubmit = e => { e.preventDefault(); result = [...form.querySelectorAll('input')].map(i => i.value); askDlg.close(); };
    const onCancel = () => askDlg.close();
    const onBackdrop = e => { if (e.target === askDlg) askDlg.close(); };
    const onClose = () => {
      form.removeEventListener('submit', onSubmit); $('#askCancel').removeEventListener('click', onCancel);
      askDlg.removeEventListener('click', onBackdrop); askDlg.removeEventListener('close', onClose);
      resolve(result);
    };
    form.addEventListener('submit', onSubmit); $('#askCancel').addEventListener('click', onCancel);
    askDlg.addEventListener('click', onBackdrop); askDlg.addEventListener('close', onClose);
    askDlg.showModal();
    const first = form.querySelector('input');
    if (first) { first.focus(); first.select(); }
  });
}

/* ================= rendering ================= */
const TITLES = { library: 'Your library', favs: 'Favourites', lists: 'Playlists', recent: 'Recently played' };

function looksHtml() {
  const fig = w => `<figure><button class="ph ${w.id === wallpaper ? 'sel' : ''}" data-act="wp" data-id="${w.id}" type="button" aria-label="Use ${esc(w.name)}"><img src="${wpUrl(w)}" alt="${esc(w.name)} wallpaper" loading="lazy">${w.live ? '<span class="live">LIVE</span>' : ''}<span class="tick">${ico('check')}</span></button><figcaption>${esc(w.name)}</figcaption></figure>`;
  return `<div class="head"><h2>Looks</h2><div class="actions"><button class="btn" data-act="theme" type="button">${ico('theme')} ${{ auto: 'Auto', light: 'Light', dark: 'Dark' }[theme]}</button></div></div>
    <p class="lead">Pick a wallpaper for the whole app. The live ones move. Songs without cover art borrow a wallpaper as their cover.</p>
    <div class="lgrid"><h2>Still</h2>${WALLPAPERS.filter(w => !w.live).map(fig).join('')}<h2>Live</h2>${WALLPAPERS.filter(w => w.live).map(fig).join('')}</div>`;
}

function render() {
  const main = $('#main');
  const q = $('#q').value.trim().toLowerCase();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view && !q));
  let html = '';

  if (q) {
    const list = songs.filter(s => `${s.title} ${s.artist} ${s.album}`.toLowerCase().includes(q));
    shown = list.map(s => s.id);
    html = head(`Results`, `${list.length} found`) + (list.length ? list.map(rowHtml).join('') : emptyHtml('No matches', 'Try a different word.', false));
  } else if (view === 'looks') {
    shown = [];
    html = looksHtml();
  } else if (view === 'lists' && openList === null) {
    html = head('Playlists', `${lists.length}`) + `<div class="grid">${lists.map(plCard).join('')}<button class="pl new" data-act="newlist" type="button">＋ New playlist</button></div>`;
    shown = [];
  } else if (view === 'lists') {
    const pl = lists.find(l => l.id === openList);
    if (!pl) { openList = null; return render(); }
    const list = pl.songIds.map(byId).filter(Boolean);
    shown = list.map(s => s.id);
    html = `<div class="head"><div><h2>${esc(pl.name)}</h2><small>${list.length} songs</small></div><div class="actions"><button class="btn" data-act="back" type="button">‹ Back</button><button class="btn" data-act="plmenu" type="button">${ico('more')}</button></div></div>`
      + playBar(list.length) + (list.length ? list.map(rowHtml).join('') : emptyHtml('Empty playlist', 'Open a song’s ⋯ menu and choose “Add to playlist”.', false));
  } else {
    let list = songs.slice();
    if (view === 'favs') list = list.filter(s => s.fav).sort(byTitle);
    else if (view === 'recent') list = list.filter(s => s.last).sort((a, b) => b.last - a.last).slice(0, 60);
    else list.sort(byTitle);
    shown = list.map(s => s.id);
    if (!songs.length) html = emptyHtml('Hi, I’m Drift!', 'Add songs from your phone and I’ll keep them here — private, offline, no ads.', true);
    else html = head(TITLES[view], `${list.length} songs`) + playBar(list.length)
      + (list.length ? list.map(rowHtml).join('') : emptyHtml(view === 'favs' ? 'No favourites yet' : 'Nothing played yet', view === 'favs' ? 'Tap the heart on any song.' : 'Play a song and it shows up here.', false));
  }
  main.innerHTML = html;
}
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
const head = (t, sub) => `<div class="head"><h2>${esc(t)}</h2><small>${esc(sub)}</small></div>`;
const playBar = n => n ? `<div class="head" style="padding-top:0"><div class="actions"><button class="btn main" data-act="playall" type="button">${ico('play')} Play</button><button class="btn" data-act="shuffleall" type="button">${ico('shuffle')} Shuffle</button></div></div>` : '';
function emptyHtml(t, p, withAdd) {
  return `<div class="empty"><img src="icons/mascot.svg" alt=""><h3>${esc(t)}</h3><p>${esc(p)}</p>${withAdd ? '<button class="pill" data-act="add" type="button">＋ Add songs</button>' : ''}</div>`;
}
function rowHtml(s) {
  const now = cur() && cur().id === s.id;
  return `<div class="row ${now ? 'now' : ''}" data-id="${s.id}">${thumb(s)}
    <div class="meta"><b>${esc(s.title)}</b><span>${esc(s.artist || 'Unknown artist')}${s.album ? ' · ' + esc(s.album) : ''}</span></div>
    ${now ? `<i class="eq ${isPlaying() ? '' : 'paused'}"><u></u><u></u><u></u></i>` : ''}
    <button class="ic heart ${s.fav ? 'on' : ''}" data-act="fav" type="button" aria-label="Favourite">${ico('heart', s.fav ? 'fill' : '')}</button>
    <button class="ic" data-act="more" type="button" aria-label="More">${ico('more')}</button></div>`;
}
function plCard(l) {
  const first = l.songIds.map(byId).find(Boolean);
  const u = first && coverUrl(first);
  return `<button class="pl" data-act="openlist" data-id="${l.id}" type="button"><div class="art" style="background-image:url(${wpUrl(wpFor(l.name))})">${u ? `<img src="${u}" alt="">` : esc(l.name.charAt(0).toUpperCase())}</div><div><b>${esc(l.name)}</b><br><small>${l.songIds.filter(id => byId(id)).length} songs</small></div></button>`;
}

/* ================= list interactions ================= */
$('#main').addEventListener('click', e => {
  const actEl = e.target.closest('[data-act]');
  const rowEl = e.target.closest('.row');
  const act = actEl && actEl.dataset.act;
  if (act === 'fav' && rowEl) return toggleFav(+rowEl.dataset.id);
  if (act === 'more' && rowEl) return songMenu(+rowEl.dataset.id);
  if (act === 'add') return $('#file').click();
  if (act === 'playall') return playIds(shown, shown[0], false);
  if (act === 'shuffleall') return playIds(shown, shown[Math.floor(Math.random() * shown.length)], true);
  if (act === 'wp') { wallpaper = actEl.dataset.id; store.set('wallpaper', wallpaper); applyLook(); updatePlayerUI(); return render(); }
  if (act === 'theme') { theme = { auto: 'light', light: 'dark', dark: 'auto' }[theme]; store.set('theme', theme); applyLook(); return render(); }
  if (act === 'newlist') return newPlaylist();
  if (act === 'openlist') { openList = +actEl.dataset.id; return render(); }
  if (act === 'back') { openList = null; return render(); }
  if (act === 'plmenu') return playlistMenu();
  if (rowEl) playIds(shown, +rowEl.dataset.id, shuffle);
});

$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  view = b.dataset.view;
  openList = null;
  $('#q').value = '';
  store.set('view', view);
  render();
  $('#main').scrollTop = 0;
});
$('#q').addEventListener('input', render);

/* ================= library actions ================= */
async function toggleFav(id) {
  const s = byId(id);
  if (!s) return;
  s.fav = !s.fav;
  await DB.put('songs', s);
  render();
  updatePlayerUI();
  if (s.fav) toast('Added to favourites');
}

function songMenu(id) {
  const s = byId(id);
  if (!s) return;
  const items = [
    { icon: 'next2', label: 'Play next', fn: () => enqueue(id, true) },
    { icon: 'queue', label: 'Add to queue', fn: () => enqueue(id, false) },
    { icon: 'plus', label: 'Add to playlist…', fn: () => pickPlaylist(id) },
    { icon: 'heart', label: s.fav ? 'Remove from favourites' : 'Add to favourites', fn: () => toggleFav(id) },
    { icon: 'looks', label: 'Set mood…', fn: () => moodMenu(id) },
    { icon: 'edit', label: 'Edit title & artist', fn: () => editSong(id) }
  ];
  if (view === 'lists' && openList !== null && !$('#q').value.trim()) {
    items.push({ icon: 'trash', label: 'Remove from this playlist', fn: () => removeFromPlaylist(openList, id) });
  }
  items.push({ icon: 'trash', label: 'Delete from this phone', danger: true, fn: () => deleteSong(id) });
  openSheet(s.title, items);
}

function enqueue(id, next) {
  if (qi < 0) return playIds([id], id, false);
  const at = next ? qi + 1 : queue.length;
  queue.splice(at, 0, id);
  toast(next ? 'Playing next' : 'Added to queue');
  updatePlayerUI();
}

async function editSong(id) {
  const s = byId(id);
  const r = await ask('Edit song', { fields: [{ label: 'Title', value: s.title }, { label: 'Artist', value: s.artist || '' }], ok: 'Save' });
  if (!r) return;
  s.title = r[0].trim() || s.title;
  s.artist = r[1].trim();
  await DB.put('songs', s);
  render();
  updatePlayerUI();
}

async function deleteSong(id) {
  const s = byId(id);
  if (!s || !(await ask('Delete this song?', { message: `“${s.title}” will be removed from this phone.`, ok: 'Delete', danger: true }))) return;
  const wasCurrent = cur() && cur().id === id;
  await DB.del('songs', id);
  songs = songs.filter(x => x.id !== id);
  for (const l of lists) {
    if (l.songIds.includes(id)) { l.songIds = l.songIds.filter(x => x !== id); await DB.put('playlists', l); }
  }
  if (coverUrls.has(id)) { URL.revokeObjectURL(coverUrls.get(id)); coverUrls.delete(id); }
  const before = queue.slice(0, qi).filter(x => x === id).length;
  queue = queue.filter(x => x !== id);
  if (wasCurrent) { qi = Math.min(qi - before, queue.length - 1); if (queue.length) loadCurrent(true); else stopAll(); }
  else qi -= before;
  render();
  updatePlayerUI();
  toast('Deleted');
}

async function newPlaylist(thenAdd) {
  const r = await ask('New playlist', { fields: [{ label: 'Name' }], ok: 'Create' });
  const name = ((r && r[0]) || '').trim();
  if (!name) return;
  const l = { name, songIds: thenAdd ? [thenAdd] : [] };
  l.id = await DB.put('playlists', l);
  lists.push(l);
  render();
  toast(thenAdd ? `Added to “${name}”` : 'Playlist created');
}
function pickPlaylist(songId) {
  const items = lists.map(l => ({ icon: 'lists', label: l.name, fn: () => addToPlaylist(l.id, songId) }));
  items.push({ icon: 'plus', label: 'New playlist…', fn: () => newPlaylist(songId) });
  openSheet('Add to playlist', items);
}
async function addToPlaylist(listId, songId) {
  const l = lists.find(x => x.id === listId);
  if (l.songIds.includes(songId)) return toast('Already in that playlist');
  l.songIds.push(songId);
  await DB.put('playlists', l);
  render();
  toast(`Added to “${l.name}”`);
}
async function removeFromPlaylist(listId, songId) {
  const l = lists.find(x => x.id === listId);
  l.songIds = l.songIds.filter(x => x !== songId);
  await DB.put('playlists', l);
  render();
}
function playlistMenu() {
  const l = lists.find(x => x.id === openList);
  openSheet(l.name, [
    { icon: 'edit', label: 'Rename', fn: async () => { const r = await ask('Rename playlist', { fields: [{ label: 'Name', value: l.name }], ok: 'Save' }); const n = ((r && r[0]) || '').trim(); if (n) { l.name = n; await DB.put('playlists', l); render(); } } },
    { icon: 'trash', label: 'Delete playlist', danger: true, fn: async () => { if (await ask('Delete playlist?', { message: `“${l.name}” goes away. Your songs stay.`, ok: 'Delete', danger: true })) { await DB.del('playlists', l.id); lists = lists.filter(x => x.id !== l.id); openList = null; render(); } } }
  ]);
}

/* ================= adding songs ================= */
$('#addBtn').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  let added = 0, skipped = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    toast(`Adding ${i + 1} of ${files.length}…`);
    const looksAudio = f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|weba|mp4)$/i.test(f.name);
    if (!looksAudio || songs.some(s => s.fileName === f.name && s.size === f.size)) { skipped++; continue; }
    const tags = await readTags(f);
    const base = f.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
    let title = tags.title, artist = tags.artist;
    if (!title) {
      const m = base.match(/^(.+?)\s+-\s+(.+)$/);
      if (m && !artist) { artist = m[1].trim(); title = m[2].trim(); } else title = base;
    }
    const gm = moodFromGenre(tags.genre);
    const song = { title, artist: artist || '', album: tags.album || '', genre: tags.genre || '', mood: gm || '', moodSource: gm ? 'genre' : '', cover: tags.cover || null, blob: f, fileName: f.name, size: f.size, mime: f.type, fav: false, added: Date.now() + i, last: 0, plays: 0 };
    song.id = await DB.put('songs', song);
    songs.push(song);
    added++;
  }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* ignore */ }
  render();
  toast(added ? `Added ${added} song${added > 1 ? 's' : ''}${skipped ? ` · skipped ${skipped}` : ''}` : (skipped ? 'Nothing new to add' : 'Nothing added'));
});

/* ================= player ================= */
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function playIds(ids, startId, forceShuffle) {
  if (!ids.length) return;
  if (forceShuffle) shuffle = true, store.set('shuffle', true);
  queue = ids.slice();
  if (shuffle) { queue = [startId, ...shuffled(queue.filter(x => x !== startId))]; qi = 0; }
  else qi = Math.max(0, queue.indexOf(startId));
  loadCurrent(true);
}
function loadCurrent(autoplay) {
  const s = cur();
  if (!s) return stopAll();
  if (curUrl) URL.revokeObjectURL(curUrl);
  curUrl = URL.createObjectURL(s.blob);
  audio.src = curUrl;
  if (autoplay) audio.play().catch(() => toast('Tap play to start'));
  s.plays = (s.plays || 0) + 1;
  s.last = Date.now();
  DB.put('songs', s).catch(() => {});
  viz.setMood(moodOf(s));
  viz.resetStats();
  vizFor = null;
  setMediaSession(s);
  updatePlayerUI();
  render();
}
function stopAll() {
  audio.pause();
  audio.removeAttribute('src');
  queue = []; qi = -1;
  closeFull();
  updatePlayerUI();
  render();
}
function next(auto) {
  if (!queue.length) return;
  if (auto && repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  if (qi + 1 < queue.length) qi++;
  else if (repeat === 'all' || !auto) qi = 0;
  else { audio.pause(); audio.currentTime = 0; updatePlayerUI(); render(); return; }
  loadCurrent(true);
}
function prev() {
  if (audio.currentTime > 3 || qi <= 0) { audio.currentTime = 0; return; }
  qi--;
  loadCurrent(true);
}
function togglePlay() {
  if (qi < 0) { if (shown.length) playIds(shown, shown[0], shuffle); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

audio.addEventListener('ended', () => next(true));
audio.addEventListener('playing', () => { if (vizFor !== curUrl) { vizFor = curUrl; viz.connect(audio); } updatePlayerUI(); });
audio.addEventListener('timeupdate', () => {
  const s = cur();
  if (s && !s.mood && !s.moodSource) { const g = viz.guess(); if (g) setMood(s, g, 'audio'); }
});
audio.addEventListener('play', () => { updatePlayerUI(); render(); });
audio.addEventListener('pause', () => { updatePlayerUI(); render(); });
audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('loadedmetadata', updateProgress);
audio.addEventListener('error', () => { if (queue.length) { toast('Can’t play this file'); if (qi + 1 < queue.length) { qi++; loadCurrent(true); } } });

let seeking = false;
function updateProgress() {
  const d = audio.duration || 0, t = audio.currentTime || 0;
  const pct = d ? (t / d) * 100 : 0;
  $('#miniBar').style.width = pct + '%';
  if (!seeking) {
    const seek = $('#seek');
    seek.value = d ? Math.round((t / d) * 1000) : 0;
    seek.style.setProperty('--p', pct + '%');
  }
  $('#tCur').textContent = fmt(t);
  $('#tDur').textContent = fmt(d);
  if ('mediaSession' in navigator && d && navigator.mediaSession.setPositionState) {
    try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(t, d), playbackRate: audio.playbackRate }); } catch { /* ignore */ }
  }
}

function updatePlayerUI() {
  const s = cur();
  const mini = $('#mini');
  mini.hidden = !s;
  const playing = isPlaying();
  $('#miniPlay').innerHTML = icoMedia(playing ? 'pause' : 'play');
  $('#miniNext').innerHTML = icoMedia('next');
  $('#bPlay').innerHTML = icoMedia(playing ? 'pause' : 'play');
  $('#bPrev').innerHTML = icoMedia('prev');
  $('#bNext').innerHTML = icoMedia('next');
  $('#bShuffle').innerHTML = ico('shuffle');
  $('#bShuffle').classList.toggle('on', shuffle);
  $('#bRepeat').innerHTML = ico('repeat') + (repeat === 'one' ? '<b style="position:absolute;font-size:10px;margin-top:1px">1</b>' : '');
  $('#bRepeat').style.position = 'relative';
  $('#bRepeat').classList.toggle('on', repeat !== 'off');
  $('#fullClose').innerHTML = ico('down');
  $('#fullMore').innerHTML = ico('more');
  $('#full').classList.toggle('playing', playing);
  if (playing && $('#full').classList.contains('open')) viz.start(); else viz.stop();
  if (!s) return;
  const w = wpUrl(wpFor(s.title + s.artist));
  $('#miniCov').innerHTML = thumb(s);
  $('#miniTitle').textContent = s.title;
  $('#miniArtist').textContent = s.artist || 'Unknown artist';
  $('#fullCov').innerHTML = coverUrl(s) ? `<img src="${coverUrl(s)}" alt="">` : esc((s.title || '?').charAt(0).toUpperCase());
  $('#fullCov').style.backgroundImage = coverUrl(s) ? 'none' : `url(${w})`;
  $('#full').style.setProperty('--fwp', coverUrl(s) ? `url(${coverUrl(s)})` : `url(${w})`);
  $('#fullTitle').textContent = s.title;
  $('#fullArtist').textContent = s.artist || 'Unknown artist';
  const mk = moodOf(s);
  $('#moodBtn').innerHTML = `<i style="background:${MOODS[mk].c[0]};color:${MOODS[mk].c[0]}"></i>${MOODS[mk].name}${s.moodSource === 'audio' ? ' · guess' : ''}`;
  $('#fullFav').innerHTML = ico('heart', s.fav ? 'fill' : '');
  $('#fullFav').classList.toggle('on', !!s.fav);
  const up = queue.slice(qi + 1, qi + 31).map(byId).filter(Boolean);
  $('#upNext').innerHTML = up.length ? up.map((x, i) => `<div class="row" data-q="${qi + 1 + i}">${thumb(x)}<div class="meta"><b>${esc(x.title)}</b><span>${esc(x.artist || 'Unknown artist')}</span></div></div>`).join('')
    : '<p style="color:var(--mute);font-weight:700;margin:6px 4px">Nothing queued after this song.</p>';
  updateProgress();
}

/* mini + full controls */
$('#miniPlay').addEventListener('click', togglePlay);
$('#miniNext').addEventListener('click', () => next(false));
$('.mini-open').addEventListener('click', openFull);
$('#bPlay').addEventListener('click', togglePlay);
$('#bNext').addEventListener('click', () => next(false));
$('#bPrev').addEventListener('click', prev);
$('#fullClose').addEventListener('click', closeFull);
$('#fullFav').addEventListener('click', () => cur() && toggleFav(cur().id));
$('#fullMore').addEventListener('click', () => cur() && songMenu(cur().id));
$('#bShuffle').addEventListener('click', () => {
  shuffle = !shuffle;
  store.set('shuffle', shuffle);
  if (shuffle && qi >= 0) queue = [...queue.slice(0, qi + 1), ...shuffled(queue.slice(qi + 1))];
  updatePlayerUI();
  toast(shuffle ? 'Shuffle on' : 'Shuffle off');
});
$('#bRepeat').addEventListener('click', () => {
  repeat = { off: 'all', all: 'one', one: 'off' }[repeat];
  store.set('repeat', repeat);
  updatePlayerUI();
  toast({ off: 'Repeat off', all: 'Repeat all', one: 'Repeat this song' }[repeat]);
});
$('#upNext').addEventListener('click', e => {
  const r = e.target.closest('.row');
  if (!r) return;
  qi = +r.dataset.q;
  loadCurrent(true);
});

const seekEl = $('#seek');
seekEl.addEventListener('input', () => {
  seeking = true;
  const pct = seekEl.value / 10;
  seekEl.style.setProperty('--p', pct + '%');
  if (audio.duration) $('#tCur').textContent = fmt((seekEl.value / 1000) * audio.duration);
});
seekEl.addEventListener('change', () => {
  if (audio.duration) audio.currentTime = (seekEl.value / 1000) * audio.duration;
  seeking = false;
});

function openFull() { const f = $('#full'); f.classList.add('open'); f.setAttribute('aria-hidden', 'false'); viz.resize(); updatePlayerUI(); }
function closeFull() { const f = $('#full'); f.classList.remove('open'); f.setAttribute('aria-hidden', 'true'); viz.stop(); }

/* lock-screen / headphone controls (the phone draws that widget itself, so it can only show a still picture) */
let artUrl = null;
async function setMediaSession(s) {
  if (!('mediaSession' in navigator)) return;
  const meta = art => new MediaMetadata({ title: s.title, artist: s.artist || 'Unknown artist', album: s.album || 'SongsApp', artwork: art });
  const u = coverUrl(s);
  navigator.mediaSession.metadata = meta(u ? [{ src: u, sizes: '512x512', type: s.cover.type || 'image/jpeg' }] : []);
  if (!u) {
    const url = await moodArt((s.title || '?').charAt(0), moodOf(s));
    if (url && cur() && cur().id === s.id) {
      navigator.mediaSession.metadata = meta([{ src: url, sizes: '512x512', type: 'image/png' }]);
      if (artUrl) URL.revokeObjectURL(artUrl);
      artUrl = url;
    } else if (url) URL.revokeObjectURL(url);
  }
  const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch { /* unsupported */ } };
  set('play', () => audio.play());
  set('pause', () => audio.pause());
  set('previoustrack', prev);
  set('nexttrack', () => next(false));
  set('seekto', d => { if (d.seekTime != null) audio.currentTime = d.seekTime; });
}

/* ================= moods ================= */
async function setMood(s, key, source) {
  s.mood = key; s.moodSource = source;
  await DB.put('songs', s).catch(() => {});
  if (cur() && cur().id === s.id) { viz.setMood(moodOf(s)); setMediaSession(s); }
  updatePlayerUI();
}
function moodMenu(id) {
  const s = byId(id);
  if (!s) return;
  const items = MOOD_KEYS.map(k => ({ label: MOODS[k].name + (s.mood === k ? '  ✓' : ''), fn: () => setMood(s, k, 'user') }));
  items.push({ label: 'Let SongsApp guess', fn: () => { s.mood = ''; s.moodSource = ''; viz.resetStats(); setMood(s, '', ''); toast('I’ll guess after 20 seconds of listening'); } });
  openSheet('Mood for “' + s.title + '”', items);
}
$('#moodBtn').addEventListener('click', () => cur() && moodMenu(cur().id));

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'Escape') closeFull();
});

/* ================= boot ================= */
function drawTabIcons() {
  document.querySelectorAll('#tabs button').forEach(b => { b.firstElementChild.innerHTML = ico({ library: 'library', favs: 'heart', lists: 'lists', recent: 'recent', looks: 'looks' }[b.dataset.view]); });
}
(async function boot() {
  applyLook();
  drawTabIcons();
  updatePlayerUI();
  try {
    [songs, lists] = await Promise.all([DB.all('songs'), DB.all('playlists')]);
  } catch {
    toast('Storage is unavailable in this browser mode');
  }
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

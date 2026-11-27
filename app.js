import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, addDoc, setDoc, updateDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, arrayUnion, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const $ = id => document.getElementById(id);
const PASSWORD = 'l+s';                      // not case sensitive
const COL = 'game2026_chat';
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const META = doc(db, 'game2026_meta', 'settings');

/* ---------- who am I ---------- */
let me = localStorage.getItem('g26who');
const qp = new URLSearchParams(location.search).get('who');
if (qp && /^[sl]$/i.test(qp)) { me = qp.toUpperCase(); localStorage.setItem('g26who', me); history.replaceState(null, '', location.pathname); }
const other = () => (me === 'S' ? 'L' : 'S');

/* ---------- themes ---------- */
const pat = (sym, col) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><text x='8' y='36' font-size='26' fill='${col}'>${sym}</text><text x='52' y='82' font-size='20' fill='${col}'>${sym}</text></svg>`)}")`;
const THEMES = {
  black: { sw: '#17171d', bg: '#0f0f14', hd: '#17171d', me: '#3a3a48', meT: '#fff', th: '#1e1e27', thT: '#eee', tx: '#eee', sub: '#8d8d9a', bar: '#1e1e27', acc: '#4a4a5c', pat: pat('♥', '#191921') },
  white: { sw: '#f7f2ee', bg: '#fbf7f4', hd: '#ff8fa3', me: '#ff8fa3', meT: '#fff', th: '#fff', thT: '#333', tx: '#333', sub: '#a08c8c', bar: '#fff', acc: '#ff6b8b', pat: pat('✦', '#f1e4dd') },
  blue: { sw: '#3b82f6', bg: '#e8f1ff', hd: '#2563eb', me: '#3b82f6', meT: '#fff', th: '#fff', thT: '#1e2a44', tx: '#1e2a44', sub: '#6b7fa3', bar: '#fff', acc: '#2563eb', pat: pat('○', '#cfe0fb') },
  green: { sw: '#22a06b', bg: '#e9f7ee', hd: '#16875a', me: '#22a06b', meT: '#fff', th: '#fff', thT: '#1d3a2c', tx: '#1d3a2c', sub: '#6d9380', bar: '#fff', acc: '#16875a', pat: pat('❀', '#cfeeda') },
  red: { sw: '#e63950', bg: '#fff0f0', hd: '#d62839', me: '#e63950', meT: '#fff', th: '#fff', thT: '#3a1f24', tx: '#3a1f24', sub: '#a37b80', bar: '#fff', acc: '#d62839', pat: pat('♥', '#ffd9dc') }
};
let S = { nickS: 'S', nickL: 'L', theme: 'red' };
function applyAll() {
  const t = THEMES[S.theme] || THEMES.red, st = $('chat').style;
  for (const k of ['bg', 'hd', 'me', 'meT', 'th', 'thT', 'tx', 'sub', 'bar', 'acc', 'pat']) st.setProperty('--' + k, t[k]);
  document.querySelector('meta[name=theme-color]').content = t.hd;
  const n = S['nick' + other()] || other();
  $('hName').textContent = n; $('av').textContent = [...n][0] || '♥';
}

/* ---------- game screen + password ---------- */
$('bPlay').onclick = $('bExit').onclick = () => {};
$('bSet').onclick = () => { $('pwIn').value = ''; $('pwErr').textContent = ''; $('pw').classList.remove('hidden'); setTimeout(() => $('pwIn').focus(), 50); };
$('pwNo').onclick = () => $('pw').classList.add('hidden');
const tryPw = () => {
  if ($('pwIn').value.replace(/\s/g, '').toLowerCase() === PASSWORD) { $('pw').classList.add('hidden'); openChat(); }
  else { $('pwErr').textContent = 'Wrong password'; const c = $('pw').firstElementChild; c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
};
$('pwOk').onclick = tryPw; $('pwIn').onkeydown = e => { if (e.key === 'Enter') tryPw(); };
document.querySelectorAll('#who button').forEach(b => b.onclick = () => { me = b.dataset.w; localStorage.setItem('g26who', me); $('who').classList.add('hidden'); openChat(); });

let started = false;
function openChat() {
  if (!me) { $('who').classList.remove('hidden'); return; }
  $('home').classList.add('hidden'); $('chat').classList.remove('hidden'); applyAll();
  if (!started) { started = true; start(); }
  markSeen(); setTimeout(() => ($('msgs').scrollTop = 1e9), 50);
}
function lock() { $('chat').classList.add('hidden'); $('home').classList.remove('hidden'); $('emo').classList.add('hidden'); document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); $('view').classList.add('hidden'); }
$('lock').onclick = lock;
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else { if (hiddenAt && Date.now() - hiddenAt > 15000) lock(); markSeen(); }
});

/* ---------- firebase ---------- */
const map = new Map(); let lastDocs = [];
async function start() {
  try { await signInAnonymously(auth); } catch (e) { alert('Firebase sign-in failed. Check the setup steps.'); return; }
  onSnapshot(META, s => { if (s.exists()) S = { ...S, ...s.data() }; applyAll(); });
  onSnapshot(query(collection(db, COL), orderBy('ts', 'desc'), limit(150)), snap => {
    const box = $('msgs'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
    const docs = snap.docs.map(d => ({ id: d.id, d: d.data({ serverTimestamps: 'estimate' }), pending: d.metadata.hasPendingWrites })).reverse();
    lastDocs = docs; let prev = null;
    for (const { id, d, pending } of docs) {
      const hide = (d.deletedFor || []).includes(me);
      const sig = `${d.deletedAll ? 1 : 0}|${hide ? 1 : 0}`;
      let r = map.get(id);
      if (!r) { r = { id, d, pending, sig, el: hide ? null : build(id, d) }; map.set(id, r); if (r.el) box.insertBefore(r.el, prev ? prev.nextSibling : box.firstChild); }
      else {
        r.d = d; r.pending = pending;
        if (r.sig !== sig) { r.sig = sig; const n = hide ? null : build(id, d); if (r.el && n) r.el.replaceWith(n); else if (r.el) r.el.remove(); else if (n) box.insertBefore(n, prev ? prev.nextSibling : box.firstChild); r.el = n; }
      }
      if (r.el) prev = r.el;
    }
    status(); markSeen();
    if (stick) requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
  });
}
function markSeen() {
  if (document.hidden || $('chat').classList.contains('hidden')) return;
  const un = lastDocs.filter(x => x.d.from !== me && !x.d.seenAt && !x.d.deletedAll);
  if (!un.length) return;
  const b = writeBatch(db); un.forEach(x => b.update(doc(db, COL, x.id), { seenAt: serverTimestamp() })); b.commit().catch(() => {});
}
const send = o => addDoc(collection(db, COL), { from: me, ts: serverTimestamp(), seenAt: null, deletedAll: false, deletedFor: [], ...o }).catch(() => alert('Could not send. Check internet.'));

/* ---------- render ---------- */
const ms = v => (v && v.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : Date.now());
const hm = v => new Date(ms(v)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function ago(t) {
  const s = (Date.now() - t) / 1000; if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return Math.floor(s / 86400) + ' d ago';
}
let cur = null;
function voiceEl(d) {
  const w = document.createElement('div'); w.className = 'vm';
  const b = document.createElement('button'); b.textContent = '▶';
  const bar = document.createElement('div'); bar.className = 'bar'; const i = document.createElement('i'); bar.append(i);
  const t = document.createElement('span'); t.textContent = fmt(d.dur || 0);
  const a = new Audio(d.data);
  a.ontimeupdate = () => (i.style.width = Math.min(100, a.currentTime / (isFinite(a.duration) ? a.duration : d.dur || 1) * 100) + '%');
  a.onended = a.onpause = () => { b.textContent = '▶'; if (a.ended) i.style.width = '0'; };
  b.onclick = () => { if (a.paused) { if (cur && cur !== a) cur.pause(); cur = a; a.play(); b.textContent = '⏸'; } else a.pause(); };
  w.append(b, bar, t); return w;
}
function build(id, d) {
  const mine = d.from === me, row = document.createElement('div');
  row.className = 'msg ' + (mine ? 'mine' : 'them'); row.dataset.id = id;
  const b = document.createElement('div'); b.className = 'b';
  if (d.deletedAll) { b.classList.add('del'); b.textContent = '🚫 This message was deleted'; }
  else {
    if (d.type === 'img') { b.classList.add('pic'); const im = new Image(); im.src = d.data; if (d.w) im.style.aspectRatio = d.w + '/' + d.h; im.onclick = () => { $('view').firstElementChild.src = d.data; $('view').classList.remove('hidden'); }; b.append(im); }
    else if (d.type === 'voice') b.append(voiceEl(d));
    else b.append(document.createTextNode(d.text || ''));
    const s = document.createElement('small'); s.textContent = hm(d.ts); b.append(s);
  }
  row.append(b); press(b, () => actions(id, mine, d.deletedAll)); return row;
}
function status() {
  document.querySelectorAll('.st').forEach(e => e.remove());
  const mineList = [...map.values()].filter(r => r.el && r.d.from === me && !r.d.deletedAll);
  const l = mineList.sort((a, b) => ms(a.d.ts) - ms(b.d.ts)).pop(); if (!l) return;
  const s = document.createElement('div'); s.className = 'st';
  s.textContent = l.pending ? 'Sending…' : l.d.seenAt ? 'Seen · ' + ago(ms(l.d.seenAt)) : 'Sent';
  l.el.append(s);
}
setInterval(status, 20000);

/* ---------- long press: delete ---------- */
function press(el, fn) {
  let tm = 0, x = 0, y = 0; const c = () => { clearTimeout(tm); tm = 0; };
  el.addEventListener('pointerdown', e => { x = e.clientX; y = e.clientY; tm = setTimeout(() => { tm = 0; fn(); }, 450); });
  el.addEventListener('pointermove', e => { if (tm && Math.hypot(e.clientX - x, e.clientY - y) > 10) c(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(v => el.addEventListener(v, c));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function actions(id, mine, gone) {
  const card = $('act').firstElementChild; card.innerHTML = '';
  const add = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'act-b ' + cls; b.textContent = txt; b.onclick = () => { $('act').classList.add('hidden'); fn && fn(); }; card.append(b); };
  add('Delete for me', '', () => updateDoc(doc(db, COL, id), { deletedFor: arrayUnion(me) }));
  if (mine && !gone) add('Delete for everyone', 'red', () => updateDoc(doc(db, COL, id), { deletedAll: true, text: '', data: '' }));
  add('Cancel', '', null); $('act').classList.remove('hidden');
}
$('act').onclick = e => { if (e.target === $('act')) $('act').classList.add('hidden'); };

/* ---------- text + emoji ---------- */
const txt = $('txt');
const EM = '😀😁😂🤣😊😍🥰😘😗😙😚😋😛😜🤪😎🤩🥳😏😒😞😔😢😭😤😡🥺😳😱😴🤗🤭🤫🙄😬🤤😇🥹❤️🧡💛💚💙💜🖤🤍💔💕💞💓💗💖💘💝💋🔥✨⭐🌹🌸🌙☀️🎉🎁🍫🍕🍦☕👍👏🙏🤝💪👀🫶🫂🐻🐱🦋'.match(/\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*/gu);
EM.forEach(e => { const b = document.createElement('button'); b.textContent = e; b.onclick = () => { txt.value += e; sync(); }; $('emo').append(b); });
$('bEmo').onclick = () => $('emo').classList.toggle('hidden');
const sync = () => { const has = txt.value.trim().length > 0; $('bSend').classList.toggle('hidden', !has); $('bMic').classList.toggle('hidden', has); };
txt.oninput = sync;
const sendText = () => { const t = txt.value.trim(); if (!t) return; txt.value = ''; sync(); send({ type: 'text', text: t }); setTimeout(() => ($('msgs').scrollTop = 1e9), 80); };
$('bSend').onclick = sendText; txt.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); sendText(); } };

/* ---------- pictures ---------- */
$('bImg').onclick = () => $('file').click();
$('file').onchange = e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const im = new Image(); im.onload = () => {
    const sc = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    let q = .6, data = c.toDataURL('image/jpeg', q); while (data.length > 800000 && q > .2) { q -= .1; data = c.toDataURL('image/jpeg', q); }
    URL.revokeObjectURL(im.src); send({ type: 'img', data, w: c.width, h: c.height }); setTimeout(() => ($('msgs').scrollTop = 1e9), 150);
  };
  im.src = URL.createObjectURL(f);
};
$('view').onclick = () => $('view').classList.add('hidden');

/* ---------- voice (max 1 min) ---------- */
let mr, chunks = [], t0 = 0, tick = 0, cancelled = false;
$('bMic').onclick = async () => {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    mr = new MediaRecorder(st, type ? { mimeType: type, audioBitsPerSecond: 24000 } : undefined); chunks = []; cancelled = false;
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      st.getTracks().forEach(t => t.stop()); clearInterval(tick); $('rec').classList.add('hidden');
      if (cancelled) return; const dur = Math.min(60, Math.round((Date.now() - t0) / 1000)); if (dur < 1) return;
      const fr = new FileReader(); fr.onload = () => { if (fr.result.length > 900000) return alert('Voice message too big'); send({ type: 'voice', data: fr.result, dur }); setTimeout(() => ($('msgs').scrollTop = 1e9), 150); };
      fr.readAsDataURL(new Blob(chunks, { type: mr.mimeType }));
    };
    mr.start(); t0 = Date.now(); $('rec').classList.remove('hidden'); $('recT').textContent = '0:00';
    tick = setInterval(() => { const s = (Date.now() - t0) / 1000; $('recT').textContent = fmt(s) + ' / 1:00'; if (s >= 60) mr.stop(); }, 250);
  } catch (e) { alert('Please allow microphone access.'); }
};
$('recOk').onclick = () => mr && mr.state !== 'inactive' && mr.stop();
$('recX').onclick = () => { cancelled = true; mr && mr.state !== 'inactive' && mr.stop(); };

/* ---------- edit stuff ---------- */
$('gear').onclick = () => {
  $('nS').value = S.nickS; $('nL').value = S.nickL; drawThemes(); $('set').classList.remove('hidden');
};
function drawThemes() {
  $('themes').innerHTML = '';
  Object.entries(THEMES).forEach(([k, t]) => {
    const b = document.createElement('button'); b.className = 'sw' + (S.theme === k ? ' on' : ''); b.style.background = t.sw; b.title = k;
    b.onclick = () => { S.theme = k; applyAll(); drawThemes(); setDoc(META, { theme: k }, { merge: true }); }; $('themes').append(b);
  });
}
$('setNo').onclick = () => $('set').classList.add('hidden');
$('setOk').onclick = () => {
  S.nickS = $('nS').value.trim() || 'S'; S.nickL = $('nL').value.trim() || 'L'; applyAll();
  setDoc(META, { nickS: S.nickS, nickL: S.nickL, theme: S.theme }, { merge: true }); $('set').classList.add('hidden');
};

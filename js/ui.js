// Small DOM toolkit: element builder, sprite animation, effects, voice notes.
import { MANIFEST } from './manifest.js';
import { sfx } from './sfx.js';

export const $ = s => document.querySelector(s);

/* Entrance animations must never decide final layout. If the browser pauses animation frames
   (background window, embedded preview, tablet power saving), a GSAP "from" tween freezes half-way
   and cards stay shifted. A plain timer snaps every finite entrance tween to its end state. */
function settleLater(tw) {
  if (!tw || tw.repeat?.() === -1) return tw;
  const ms = (tw.delay() + tw.totalDuration() + .25) * 1000;
  setTimeout(() => { if (tw.parent && tw.progress() < 1) tw.progress(1); }, ms);   // killed tweens (parent null) are left alone
  return tw;
}
if (window.gsap && !gsap.__settle) {
  const from = gsap.from.bind(gsap), fromTo = gsap.fromTo.bind(gsap);
  // DOM entrance tweens hand transform/opacity back to CSS when done (keeps :active presses and .on lifts working)
  const isDom = t => { const a = gsap.utils.toArray(t); return a.length && a.every(e => e instanceof Element && !e.style.transform); };
  gsap.from = (t, v) => settleLater(from(t, v && v.clearProps === undefined && isDom(t) ? { ...v, clearProps: 'transform,opacity' } : v));
  gsap.fromTo = (t, a, b) => settleLater(fromTo(t, a, b));
  gsap.__settle = true;
}
export const A = k => MANIFEST[k] ? MANIFEST[k].src : '';
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
export const img = (k, cls = '', extra = {}) => h('img', { src: A(k), alt: '', class: cls, draggable: 'false', ...extra });
export const wait = ms => new Promise(r => setTimeout(r, ms));
// tap handler that ignores ghost double-fires
const FAST = /[?&]test=1/.test(location.search); // test hook: simulated players tap faster than a finger can
export function tap(el, fn) { let t = 0; el.addEventListener('pointerup', e => { const n = performance.now(); if (n - t < 120 && !FAST) return; t = n; fn(e); }); return el; }

/* stage scale: fit 1920×1200 into the window */
export function fit() {
  const app = $('#app'), s = Math.min(innerWidth / 1920, innerHeight / 1200);
  app.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px,${(innerHeight - 1200 * s) / 2}px) scale(${s})`;
  return s;
}
// convert a client point into stage coordinates
export function toStage(x, y) { const r = $('#app').getBoundingClientRect(), s = r.width / 1920; return [(x - r.left) / s, (y - r.top) / s]; }
export function centerOf(el) { if (typeof el === 'string') el = document.querySelector(el); if (!el) return [960, 600]; const r = el.getBoundingClientRect(), a = $('#app').getBoundingClientRect(), s = a.width / 1920; return [(r.left + r.width / 2 - a.left) / s, (r.top + r.height / 2 - a.top) / s]; }

/* sprite strip player (4-frame strips from the sheets) */
export class Sprite {
  constructor(el, key, { fps = 6, loop = true, height } = {}) { this.el = el; this.fps = fps; this.loop = loop; this.h = height; this.set(key); }
  set(key, { loop = this.loop, fps = this.fps, then } = {}) {
    const m = MANIFEST[key]; if (!m) return; this.m = m; this.loop = loop; this.fps = fps; this.f = 0; this.then = then; this.acc = 0;
    const H = this.h || this.el.clientHeight || m.fh, W = H * m.fw / m.fh;
    Object.assign(this.el.style, { width: W + 'px', height: H + 'px', backgroundImage: `url(${m.src})`, backgroundSize: `${W * m.frames}px ${H}px`, backgroundPosition: '0 0' });
    this.W = W; this.draw();
  }
  draw() { this.el.style.backgroundPosition = `${-this.f * this.W}px 0`; }
  step(dt) { this.acc += dt; const per = 1000 / this.fps; while (this.acc >= per) { this.acc -= per; this.f++; if (this.f >= this.m.frames) { if (this.loop) this.f = 0; else { this.f = this.m.frames - 1; this.done = true; if (this.then) { const t = this.then; this.then = null; t(); } } } } this.draw(); }
}
const sprites = new Set();
export function addSprite(s) { sprites.add(s); return s; }
export function removeSprite(s) { sprites.delete(s); }
export function tickSprites(dt) { for (const s of sprites) { if (!s.el.isConnected) { sprites.delete(s); continue; } s.step(dt); } }

/* one-shot effect at a stage point */
export function fx(key, x, y, { size = 180, fps = 12, loops = 1, rot = 0, parent } = {}) {
  const m = MANIFEST[key]; if (!m) return;
  const e = h('div', { class: 'fxs' }); const H = size, W = size * m.fw / m.fh;
  Object.assign(e.style, { left: x - W / 2 + 'px', top: y - H / 2 + 'px', transform: rot ? `rotate(${rot}deg)` : '' });
  (parent || $('#fx')).append(e);
  let n = 0; const s = new Sprite(e, key, { fps, loop: true, height: H });
  s.step = function (dt) { this.acc += dt; const per = 1000 / this.fps; while (this.acc >= per) { this.acc -= per; this.f++; if (this.f >= this.m.frames) { this.f = 0; n++; if (n >= loops) { e.remove(); sprites.delete(this); return; } } } this.draw(); };
  addSprite(s); return e;
}
export function fxAt(key, el, opts) { const [x, y] = centerOf(el); return fx(key, x, y, opts); }

/* fly an image from one element to another (drag-to-pass feel) */
export function flyImg(key, from, to, { size = 80, dur = .6 } = {}) {
  const [x1, y1] = Array.isArray(from) ? from : centerOf(from), [x2, y2] = Array.isArray(to) ? to : centerOf(to);
  const e = img(key, 'fly'); Object.assign(e.style, { width: size + 'px', height: size + 'px', left: x1 - size / 2 + 'px', top: y1 - size / 2 + 'px' });
  $('#fx').append(e);
  const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 120;
  const o = { t: 0 };
  return new Promise(res => gsap.to(o, { t: 1, duration: dur, ease: 'power2.inOut', onUpdate() { const t = o.t, x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2; e.style.left = x - size / 2 + 'px'; e.style.top = y - size / 2 + 'px'; e.style.transform = `scale(${1 + Math.sin(t * Math.PI) * .25})`; }, onComplete() { e.remove(); res(); } }));
}

/* ---------- voice notes ---------- */
const CH = { meher: { name: 'Meher Didi', still: 'meher_warm' }, kabir: { name: 'Kabir · rider captain', still: 'kabir_radio' }, anya: { name: 'Anya · Desai family', still: 'anya_phone' } };
let voiceOn = true, talkSprite = null, lastSay = null;
export function replayNarration() { if (lastSay) speak(lastSay.text, lastSay.who); return !!lastSay; }
export function setVoice(v) { voiceOn = v; if (!v) stopVoice(); }
export function readAloud(text) { return speak(text, 'meher'); }
/* Recorded voices (ElevenLabs, Multilingual v2; Meher = Anamika, Kabir = Vishal) live in assets/voice/<key>.ogg,
   listed in assets/voice/index.json. Lines with no clip fall back to the browser's speech. tools/voice_gen.py makes them. */
let VO = {}, vAudio = null;
const OGG = (() => { try { return new Audio().canPlayType('audio/ogg; codecs="opus"') !== ''; } catch (e) { return false; } })();   // clips are Ogg Opus
if (OGG) fetch('assets/voice/index.json').then(r => (r.ok ? r.json() : {})).then(j => { VO = j || {}; }).catch(() => { });
export function vkey(text) { const s = text.replace(/[“”"‘’'.,?!:;·=]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(36); }
export function stopVoice() { if (vAudio) { vAudio.pause(); vAudio = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); }
function speak(text, who) {
  if (!voiceOn) return null;
  stopVoice(); const clean = text.replace(/[“”"]/g, ''), f = VO[vkey(clean)];
  if (f) return playClips([f], clean, who);
  // a heading that changes with play: say it piece by piece if every piece was recorded (one voice, never mixed)
  const parts = clean.split(/(?<=[.?!:])\s+|\s+·\s+/).map(x => x.trim()).filter(x => /\w/.test(x)), fs = parts.map(x => VO[vkey(x)]);
  if (parts.length > 1 && fs.every(Boolean)) return playClips(fs, clean, who);
  return tts(clean, who);
}
function playClips(files, text, who) {
  let i = 0, a = null; const next = () => { if (i >= files.length) { if (vAudio === a) vAudio = null; return; } a = new Audio('assets/voice/' + files[i++]); vAudio = a; const me = a;
    me.onended = () => { if (vAudio === me) next(); }; me.play().catch(() => { if (vAudio === me) { vAudio = null; if (i === 1) tts(text, who); } }); };
  next(); return a;
}
function tts(text, who) {
  if (!('speechSynthesis' in window)) return null;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const vs = speechSynthesis.getVoices(); const v = vs.find(v => /en-IN/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang));
    if (v) u.voice = v; u.lang = v ? v.lang : 'en-IN'; u.rate = 1.0; u.pitch = who === 'anya' ? 1.35 : who === 'kabir' ? .9 : 1.08;
    speechSynthesis.speak(u); return u;
  } catch (e) { return null; }
}
/* say(who, text, {mode:'react'|'talk', top, auto, button}) → resolves when the child taps next */
export function say(who, text, o = {}) {
  const box = $('#talk'); gsap.killTweensOf(box); box.style.opacity = ''; box.innerHTML = ''; box.classList.remove('hide', 'quiet'); box.classList.toggle('top', !!o.top); box.classList.toggle('nonext', !!o.noNext);
  const who_ = h('div', { class: 'who' }), spr = h('div', { class: 'spr' }); who_.append(spr);
  const tx = h('div', { class: 'tx' }), nx = h('button', { class: 'nx' }, o.button || 'Next ›');
  const bub = h('div', { class: 'bub' }, h('div', { class: 'n' }, CH[who].name), tx, o.noNext ? null : nx);
  box.append(who_, bub);
  if (talkSprite) removeSprite(talkSprite);
  talkSprite = addSprite(new Sprite(spr, `char_${who}_talk`, { fps: 7, height: 290 }));
  gsap.fromTo(box, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'back.out(1.6)' });
  sfx.pop();
  // words animate in with GSAP
  const full = text; const words = full.split(' ');
  const dur = animText(tx, full, { stagger: .07, delay: .15 });
  lastSay = { text: full, who }; const u = speak(full, who);
  let finished = false; const iv = 0;
  setTimeout(finishTalk, dur * 1000 + 300);
  function finishTalk() { if (finished) return; finished = true; setTimeout(() => { if (!spr.isConnected) return; talkSprite.set(o.mode === 'react' ? `char_${who}_react` : `char_${who}_idle`, { fps: o.mode === 'react' ? 6 : 3, loop: true }); box.classList.add('quiet'); }, 400); }
  return new Promise(res => {
    if (o.noNext) { setTimeout(() => res(() => hideTalk()), Math.max(1800, words.length * 260)); return; }
    nx.classList.add('hide'); setTimeout(() => { nx.classList.remove('hide'); gsap.from(nx, { scale: .6, opacity: 0, duration: .3, ease: 'back.out(2)' }); }, Math.min(2200, words.length * 170 + 300));
    tap(nx, () => { gsap.killTweensOf(tx.querySelectorAll('.w')); gsap.set(tx.querySelectorAll('.w'), { clearProps: 'all' }); sfx.select(); stopVoice(); hideTalk(); res(); });
    if (o.auto) setTimeout(() => { if (box.contains(nx)) { hideTalk(); res(); } }, o.auto);
  });
}
export function hideTalk() { const b = $('#talk'); gsap.killTweensOf(b); gsap.to(b, { y: 40, opacity: 0, duration: .25, onComplete: () => { b.classList.add('hide'); b.style.opacity = ''; gsap.set(b, { y: 0 }); } }); }
export function stillChar(key, h_ = 200) { return img(key, '', { style: `height:${h_}px;width:auto` }); }

/* ---------- SKAI skin: card paper/backing/pin + clipboard panels that always fit ---------- */
function decorate(root) {
  root.querySelectorAll?.('.card:not([data-sk])').forEach(c => { c.dataset.sk = '1'; c.prepend(h('i', { class: 'sk-back' }), h('i', { class: 'sk-paper' }), h('i', { class: 'sk-pin' })); });
}
const panelRO = new ResizeObserver(es => es.forEach(e => fitPanel(e.target)));
function fitPanel(p) {
  // the clip sits ~120px above the sheet; keep the whole clipboard inside 1920×1200 without changing its layout
  const w = p.offsetWidth, hh = p.offsetHeight; if (!w || !hh) return;
  const s = Math.min(1, (1200 - 170) / hh, 1700 / w); p.style.setProperty('--fit', s.toFixed(3));
}
export function initSkin() {
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.matches?.('.card')) decorate(n.parentNode); decorate(n);
    (n.matches?.('.panel') ? [n] : [...(n.querySelectorAll?.('.panel') || [])]).forEach(p => { panelRO.observe(p); fitPanel(p); }); }))).observe($('#app'), { childList: true, subtree: true });
}

/* screen helpers */
export function screen(...kids) { const s = $('#screen'); s.innerHTML = ''; kids.forEach(k => k && s.append(k)); document.body.classList.add('modal'); return s; }
export function clearScreen() { $('#screen').innerHTML = ''; document.body.classList.remove('modal'); }
export function dim(on) { $('#dim').classList.toggle('on', on); }
/* Entrance animations use explicit end values (fromTo), never gsap.from: with a stagger, from() reads each
   element's resting transform only when that element starts, and the CSS transform transitions on cards,
   chips and clues have already moved it by then, so later items "rest" part-way down (a staircase).
   clearProps hands the transform back to CSS afterwards, so .card.on / .clue.on lifts still work. */
export function popIn(el, d = 0) {
  const keep = !!el.style.transform;   // elements positioned with an inline transform keep it
  gsap.fromTo(el, { scale: .85, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: .45, delay: d, ease: 'back.out(1.7)', clearProps: keep ? 'opacity' : 'transform,opacity' }); return el;
}
export function stagger(els, d = .07) {
  gsap.fromTo(els, { y: 40, opacity: 0, scale: .9 }, { y: 0, opacity: 1, scale: 1, duration: .45, stagger: d, ease: 'back.out(1.6)', clearProps: 'transform,opacity' });
}

/* ---------- GSAP text animation ---------- */
// split text into word spans and animate them in (no SplitText needed)
export function animText(el, text, { stagger = .045, delay = 0, y = 18 } = {}) {
  el.innerHTML = '';
  const words = String(text).split(' ').map(w => { const s = h('span', { class: 'w' }, w); el.append(s, ' '); return s; });
  gsap.fromTo(words, { y, opacity: 0, rotateX: -60, filter: 'blur(4px)' }, { y: 0, opacity: 1, rotateX: 0, filter: 'blur(0px)', duration: .45, stagger, delay, ease: 'back.out(2)' });
  return words.length * stagger + .45 + delay;
}
export function countUp(el, to, { suffix = '', dur = 1, delay = 0 } = {}) { const o = { v: 0 }; gsap.to(o, { v: to, duration: dur, delay, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } }); }

/* ---------- chat thread (customer phone / rider radio) ---------- */
export function chatBox(who, title, theme = 'cust') {
  const list = h('div', { class: 'chat' });
  const el = h('div', { class: `chatwrap ${theme}` }, h('div', { class: 'chead' }, img(who === 'anya' ? 'anya_phone' : who === 'kabir' ? 'kabir_radio' : 'meher_warm', 'cav'), h('div', {}, h('b', {}, title), h('span', { class: 'online' }, 'online'))), list);
  async function msg(text, { side = 'in', icon, pick, delay = 600, cls = '' } = {}) {
    const row = h('div', { class: `cm ${side} ${cls}` });
    if (side === 'in') { const dots = h('div', { class: 'bubble typing' }, h('i'), h('i'), h('i')); row.append(dots); list.append(row); scroll(); gsap.from(dots, { scale: .5, opacity: 0, duration: .25 }); await wait(delay); dots.remove(); }
    else list.append(row);
    const b = h('div', { class: 'bubble' }); if (icon) b.append(img(icon, 'bi')); const tx = h('span'); b.append(tx); row.append(b);
    gsap.from(b, { scale: .6, opacity: 0, y: 20, duration: .4, ease: 'back.out(2)', transformOrigin: side === 'in' ? '0% 100%' : '100% 100%' });
    sfx.pop(); const t = animText(tx, text, { stagger: .035 }); scroll();
    if (pick) { b.classList.add('pickable'); tap(b, () => pick(b)); }
    await wait(t * 1000); return b;
  }
  function scroll() { requestAnimationFrame(() => list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })); }
  return { el, list, msg };
}

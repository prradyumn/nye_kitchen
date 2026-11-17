// The 11 stages from the storyboard. Each one: learning first, game second.
// Rules kept everywhere: no stars/scores/"good" labels, reviews describe, Meher never gives a number,
// riders are never rushed, nudges show WHERE to tap and never WHICH answer.
import { G, log, barText, nameOf, fmtClock } from './state.js';
import { DISHES, DISH_FACTS, PACKS, STATIONS, CLUES, CLUE_LATE, REPLAN, TRANSFER, PHOTOS } from './data.js';
import { $, h, img, tap, say, hideTalk, screen, clearScreen, dim, popIn, stagger, fx, fxAt, wait, chatBox, readAloud } from './ui.js';
import { sfx } from './sfx.js';
import * as K3 from './scene3d.js';
import { startShift, stopShift, shiftStats, leftovers, currentShift, updateRidersHud, practiceOrder } from './kitchen.js';
import { guide, unguide } from './coach.js';

/* ---------- small helpers ---------- */
const btn = (label, cls = '', fn) => { const b = h('button', { class: 'btn ' + cls }, label); if (fn) tap(b, () => { sfx.select(); fn(b); }); return b; };
const panel = (...kids) => h('div', { class: 'panel glass' }, ...kids);
// every heading can be read aloud (younger readers)
const rd = text => { const b = h('button', { class: 'rd', 'aria-label': 'Read aloud' }, '🔊'); tap(b, () => { readAloud(text); log('read_aloud', { text: text.slice(0, 60) }); }); return b; };
const plain = s => String(s || '').replace(/<[^>]+>/g, '');
// one read-aloud per screen (on the heading, reading the line under it too); the eyebrow only appears when it adds something
const head = (eye, title, sub) => h('div', { class: 'head' }, eye ? h('div', { class: 'eyebrow' }, eye) : null, h('div', { class: 'h2' }, title, rd(`${title}. ${plain(sub)}`)), sub ? h('div', { class: 'sub', style: { maxWidth: '1150px' }, html: sub }) : null);
const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
// "5 of 7" with a row of little boxes: easier than percentages for 10-year-olds
function xofy(a, b, cap) {
  const el = h('div', { class: 'xofy' }, h('b', {}, b ? `${a} of ${b}` : 'none yet'));
  if (b) el.append(h('div', { class: 'fillbar' }, h('i', { style: { width: `${Math.round(a / b * 100)}%` } })));   // one bar, not 30 little squares
  if (cap) el.append(h('small', {}, cap));
  return el;
}
function hud(on) { ['#hud', '#barSign', '#wall', '#riders'].forEach(s => $(s).classList.toggle('hide', !on)); document.body.classList.toggle('playing', on); }
function zones(on) { $('#zones').classList.toggle('hide', !on); }
function setBarSign(text, flick = true) { const b = $('#barSign'); b.querySelector('.v').textContent = text; b.classList.remove('hide'); if (flick) { b.classList.remove('flick'); void b.offsetWidth; b.classList.add('flick'); sfx.shutter(); } }
function setClock(min) { const [c, ap] = fmtClock(min); $('#clock .t').innerHTML = `${c}<small>${ap}</small>`; }
const players = () => STATIONS.filter(s => !(G.three && s.k === 'prep'));
// turn-by-turn stages: the facilitator can skip the remaining turns from the menu
async function turns(fn) { G.skipTurns = false; for (const p of players()) { if (G.skipTurns) break; await fn(p); } G.onSkip = null; G.skipTurns = false; }

export function ensureDefaults() {
  if (!G.menu.length) G.menu = ['biryani', 'fries', 'cake'];
  for (const s of STATIONS) if (!G.names[s.k]) G.names[s.k] = `Chef ${STATIONS.indexOf(s) + 1}`;
  if (!G.bar.set) Object.assign(G.bar, { min: 35, arrive: 'hot', custom: 'dessert', set: true });
  G.box1 ||= { menu: G.menu.slice(), pack: G.pack }; G.bar1 ||= { ...G.bar, text: barText(G.bar) };
}

/* ================= 1 · The Kitchen Opens ================= */
export async function s1() {
  hud(false); zones(false); K3.setOpen(false);
  // title screen = mission name + Start only. When the cinematic played, its gate already was the title screen.
  if (!G.introPlayed) {
    K3.setCam('dark', 0); K3.lightsOn(false);
    await new Promise(res => {
      const t = img('title', '', { style: 'width:980px;filter:drop-shadow(0 20px 40px rgba(0,0,0,.5))' });
      const go = btn('Let’s investigate', 'start pulse', res);
      screen(h('div', { class: 'center' }, t, go));
      gsap.from(t, { y: -40, scale: .9, opacity: 0, duration: 1, ease: 'back.out(1.5)' });
      gsap.from(go, { y: 30, opacity: 0, delay: .6, duration: .6 });
    });
    gsap.to('#screen .center', { opacity: 0, y: -40, duration: .5 }); await wait(400); clearScreen();
    K3.lightsOn(true); K3.setCam('wide', 3.2, 'power2.inOut');
  }
  sfx.clack(); await wait(G.introPlayed ? 400 : 1600);
  // character intro + stakes: who she is, what is at risk tonight, and for whom
  await say('meher', 'Hi, I’m Meher Didi, and this is my kitchen. Tonight families order party boxes until midnight. If a box comes late or cold, a party goes without food.');
  await new Promise(res => {
    const claimed = {};
    const three = h('button', { class: 'chip' }, 'We are 3 players');
    const go = btn('Open the kitchen', 'teal', () => res()); go.disabled = true;
    const cards = STATIONS.map((st, i) => {
      // no typed names: free text on a shared class screen is a child-safety risk. Each chef is "Chef N".
      const who = h('div', { class: 'who' }, 'Tap to claim');
      const c = h('div', { class: 'card' }, img(st.icon, 'art', { style: 'width:150px;height:150px' }), h('b', {}, st.name), h('span', {}, st.job), who);
      tap(c, () => { if (G.three && st.k === 'prep') return; if (claimed[st.k]) return;
        claimed[st.k] = true; G.names[st.k] = `Chef ${i + 1}`; c.classList.add('on'); who.textContent = `You’re Chef ${i + 1}`; sfx.coin(); fxAt('fx_sparkle', c, { size: 200 });
        log('station_picked', { station: st.k }); check(); });
      return c;
    });
    function check() { const need = STATIONS.filter(s => !(G.three && s.k === 'prep')); go.disabled = !need.every(s => claimed[s.k]); if (!go.disabled) go.classList.add('pulse'); }
    tap(three, () => { G.three = !G.three; three.classList.toggle('on', G.three); cards[0].classList.toggle('taken', G.three); cards[0].querySelector('.who').textContent = G.three ? 'Cook runs Prep too' : 'Tap to claim'; check(); });
    const row = h('div', { class: 'cards' }, cards);
    guide(() => STATIONS.some((st, i) => !claimed[st.k] && !(G.three && i === 0)) ? { el: row, text: 'Each player: tap a station to make it yours', id: 's1_claim' } : { el: go, text: 'Everyone has a station? Tap here!', id: 's1_go' });
    screen(panel(head(null, 'Which station is yours tonight?', 'Each of you runs one part, so every box needs all of you.'), row, h('div', { class: 'row' }, three, go)));
    stagger(cards);
  });
  log('all_ready', { three: G.three, names: { ...G.names } });
  clearScreen(); K3.setOpen(true); sfx.fanfare(); await wait(700);
  await missionBrief();
}
/* the problem statement, in kid words, before anything is decided */
async function missionBrief() {
  await new Promise(res => {
    const go = btn('Let’s go!', 'teal pulse', res);
    const steps = [['clue_party', '1', 'Set our bar', 'What every box should manage'], ['st_cook', '2', 'Run it and check', 'Did we reach our bar?'], ['opt_batch', '3', 'Change the plan', 'When the night changes']];
    const cards = steps.map(([i, n, t]) => h('div', { class: 'card', style: { width: '340px' } }, h('div', { class: 'badge' }, n), img(i, 'art'), h('b', {}, t)));
    guide(() => ({ el: go, text: 'Ready? Tap here', id: 'brief_go' }));
    screen(panel(head(null, 'Nobody will tell you what “good enough” means tonight.', 'Our name is on every box. Your team decides what good enough means, tests it and changes it. At midnight, you judge the night.'),
      h('div', { class: 'cards' }, cards), h('div', { class: 'row' }, go)));
    stagger(cards, .12);
  });
  log('mission_brief', {}); clearScreen();
}

/* ================= 2 · Design the Party Box ================= */
export async function s2() {
  K3.setCam('plan', 1.4);
  await say('meher', 'One party box for the whole night. Three foods. Pick what you think works. Tonight will tell us.');
  const t0 = performance.now(); let changes = 0;
  G.menu = [];
  await new Promise(res => {
    const slots = h('div', { class: 'slotbar' }, [0, 1, 2].map(() => h('div', { class: 's' })));
    const go = btn('Pick 3 foods', 'teal', res); go.disabled = true;
    const cards = Object.entries(DISHES).map(([k, d]) => {
      const c = h('div', { class: 'card flip' }, h('div', { class: 'inner' }, h('div', { class: 'face' }, img(d.img, 'art'), h('b', {}, d.name), h('span', {}, d.line)), h('div', { class: 'backf' }, h('i', {}, '?'), h('i', {}, '?'), h('i', {}, '?'))));
      tap(c, () => { const i = G.menu.indexOf(k); if (i >= 0) { G.menu.splice(i, 1); changes++; } else if (G.menu.length < 3) G.menu.push(k); else return;
        c.classList.toggle('on', G.menu.includes(k)); sfx.select(); c.classList.add('back'); setTimeout(() => c.classList.remove('back'), 900); draw(); });
      return c;
    });
    function draw() { [...slots.children].forEach((s, i) => { s.innerHTML = ''; if (G.menu[i]) { const im = img(DISHES[G.menu[i]].img); s.append(im); gsap.from(im, { scale: .4, duration: .35, ease: 'back.out(2)' }); } }); go.disabled = G.menu.length !== 3; go.classList.toggle('pulse', G.menu.length === 3); go.textContent = G.menu.length === 3 ? 'Next: how will it travel?' : `Pick ${3 - G.menu.length} more`; }
    guide(() => G.menu.length < 3 ? { el: slots, text: `Tap any ${3 - G.menu.length} more food${G.menu.length === 2 ? '' : 's'}. They show up here.`, id: 's2_dishes' } : { el: go, text: 'Happy with your box? Tap here', id: 's2_next' });
    screen(panel(head(null, 'Pick 3 foods for the party box', 'A quick first try. Tonight’s orders will show how each food travels.'), h('div', { class: 'cards' }, cards), h('div', { class: 'row', style: { gap: '40px' } }, slots, go)));
    stagger(cards, .05);
  });
  await new Promise(res => {
    const go = btn('Pick a box first', 'teal', res); go.disabled = true;
    const cards = Object.entries(PACKS).map(([k, p]) => { const c = h('div', { class: 'card' }, img(p.img, 'art'), h('b', {}, p.name), h('span', {}, p.line));
      tap(c, () => { G.pack = k; cards.forEach(x => x.classList.remove('on')); c.classList.add('on'); sfx.select(); go.disabled = false; go.classList.add('pulse'); go.textContent = 'Lock the box'; }); return c; });
    const row = h('div', { class: 'cards' }, cards);
    guide(() => go.disabled ? { el: row, text: 'Tap one way to pack the food', id: 's2_pack' } : { el: go, text: 'Tap here to lock it in', id: 's2_lock' });
    screen(panel(head(null, 'How will the food travel?', 'Every order goes out in this box. Pick the one you think gets food to families best.'), row, h('div', { class: 'row' }, go)));
    stagger(cards);
  });
  G.box1 = { menu: G.menu.slice(), pack: G.pack };
  log('party_box_v1', { dishes: [...G.menu], packaging: G.pack, ms_to_commit: Math.round(performance.now() - t0), vote_changes: changes });
  await stampBox('stamp_v1', 'Party box v1 · rough');
}
async function stampBox(stamp, label) {
  const box = img('box_closed', '', { style: 'width:360px' });
  const dishes = h('div', { class: 'row', style: { gap: '14px' } }, G.menu.map(d => img(DISHES[d].img, '', { style: 'width:110px' })), img(PACKS[G.pack].img, '', { style: 'width:110px' }));
  const st = img(stamp, 'stamp', { style: 'position:absolute;width:230px;left:210px;top:-30px' });
  const wrap = h('div', { style: { position: 'relative' } }, box, st);
  screen(h('div', { class: 'center' }, dishes, wrap, h('div', { class: 'h2' }, label)));
  popIn(box); stagger([...dishes.children]);
  gsap.fromTo(st, { scale: 3, opacity: 0, rotate: -30 }, { scale: 1, opacity: 1, rotate: -12, duration: .45, delay: .8, ease: 'power4.in', onComplete: () => { sfx.bump(); fxAt('fx_dust', st, { size: 300 }); gsap.fromTo(wrap, { x: -8 }, { x: 0, duration: .4, ease: 'elastic.out(1,.3)' }); } });
  await wait(2600); clearScreen();
}

/* ================= 3 · Set Tonight's Bar ================= */
/* bar builder: every part starts EMPTY (no pre-filled number to copy), and each part is pinned to the message that justifies it */
function barEditor({ kind = 1, clues, title, sub, old }) {
  return new Promise(res => {
    const b = kind === 1 ? { min: null, arrive: null, custom: null, links: {} } : { when: null, min: null, arrive: null, custom2: null, links: {}, kind: 2 };
    let asks = 0, step = 0;
    const custList = kind === 1 ? [['dessert', 'dessert intact'], ['party', 'Anya’s box before 10 pm'], ['fries', 'fries still crisp']] : [['we tell people the real time', 'we tell people the real time'], ['dessert intact', 'dessert intact'], ['fries still crisp', 'fries still crisp']];
    const has = k => k === 'time' ? (kind === 2 ? b.when === 'midnight' || (b.when === 'mins' && b.min != null) : b.min != null) : k === 'arrive' ? b.arrive != null : (kind === 1 ? b.custom : b.custom2) != null;
    const partText = k => !has(k) ? '…' : k === 'time' ? (kind === 2 && b.when === 'midnight' ? 'Before midnight' : `On time within ${b.min} min`) : k === 'arrive' ? (b.arrive === 'any' ? 'any temperature' : `arrives ${b.arrive}`) : (kind === 1 ? custList.find(x => x[0] === b.custom)[1] : b.custom2);
    const STEPS = [
      { k: 'time', q: kind === 1 ? 'How many minutes counts as “on time”?' : 'When does food need to arrive now?', tip: kind === 1 ? 'Tap a number. Then use − and + to fine-tune it.' : 'Tap one.' },
      { k: 'arrive', q: 'How should the food arrive?', tip: 'Tap one.' },
      { k: 'custom', q: 'Add one more line of your own', tip: 'Tap the one that matters most tonight.' },
    ];
    const pv = { time: h('span', { class: 'pp' }), arrive: h('span', { class: 'pp' }), fixed: h('span', { class: 'pp set' }, 'all items correct'), custom: h('span', { class: 'pp' }) };
    const preview = h('div', { class: 'preview' }, pv.time, '·', pv.arrive, '·', pv.fixed, '·', pv.custom);
    const stepsBar = h('div', { class: 'steps' }, STEPS.map(() => h('i')));
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center', minHeight: '360px' } });
    const ask = btn('Ask Meher', 'ghost', async () => { asks++; log('ask_owner', { stage: kind === 1 ? 3 : 7 }); await say('meher', 'You know these customers. You decide.', { mode: 'react', button: 'OK' }); });
    const nextB = btn('Next', 'teal', () => go(step + 1));
    let upd = () => { };
    function paintPreview() { STEPS.forEach((s, i) => { const el = pv[s.k]; el.textContent = i <= step || b.links[s.k] ? partText(s.k) : '…'; el.className = 'pp' + (i === step ? ' cur' : b.links[s.k] ? ' set' : ''); }); [...stepsBar.children].forEach((d, i) => d.className = i < step ? 'done' : i === step ? 'on' : ''); }
    const chipRow = (list, isOn, onPick, big = true) => { const row = h('div', { class: 'opts' }); list.forEach(([v, l]) => { const c = h('button', { class: 'chip' + (isOn(v) ? ' on' : ''), style: big ? { fontSize: '28px', minHeight: '72px', padding: '0 30px' } : {} }, l); tap(c, () => { onPick(v); [...row.children].forEach(x => x.classList.toggle('on', x === c)); sfx.tick(); paintPreview(); upd(); }); row.append(c); }); return row; };
    function minutesPicker(choices) {
      const minV = h('div', { class: 'v' }, b.min ?? '—');
      const fine = h('div', { class: 'slider', style: { visibility: b.min == null ? 'hidden' : 'visible' } });
      const row = chipRow(choices.map(v => [v, `${v} min`]), v => b.min === v, v => { b.min = v; minV.textContent = v; fine.style.visibility = 'visible'; });
      const nudge = d => { b.min = Math.max(15, Math.min(120, b.min + d)); minV.textContent = b.min; [...row.children].forEach(x => x.classList.toggle('on', x.textContent === `${b.min} min`)); sfx.tick(); paintPreview(); upd(); };
      fine.append(h('button', { onpointerup: () => nudge(-5) }, '−'), minV, h('div', { style: { font: '800 28px Nunito', color: '#BCC1E6' } }, 'min'), h('button', { onpointerup: () => nudge(5) }, '+'));
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' } }, row, fine);
    }
    function go(n) {
      if (n >= STEPS.length) { b.set = true; res({ b, asks }); return; }
      step = n; const S = STEPS[n]; body.innerHTML = ''; paintPreview();
      let picker;
      if (S.k === 'time') {
        if (kind === 1) picker = minutesPicker([20, 30, 40, 50, 60]);
        else { const mp = minutesPicker([30, 45, 60, 75, 90]); mp.style.display = b.when === 'mins' ? 'flex' : 'none';
          picker = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' } }, chipRow([['midnight', 'Before midnight'], ['mins', 'Within a set time']], v => b.when === v, v => { b.when = v; mp.style.display = v === 'mins' ? 'flex' : 'none'; }), mp); }
      } else if (S.k === 'arrive') picker = chipRow([['hot', 'hot'], ['warm', 'warm'], ['any', 'any temperature']], v => b.arrive === v, v => { b.arrive = v; });
      else picker = chipRow(custList, v => (kind === 1 ? b.custom : b.custom2) === v, v => { if (kind === 1) b.custom = v; else b.custom2 = v; });
      const clueEls = clues.map(c => { const e = h('button', { class: 'clue' + (b.links[S.k] === c.id ? ' on' : '') + (c.fresh ? ' new' : '') }, img(c.img), c.text);
        tap(e, () => { b.links[S.k] = c.id; clueEls.forEach(x => x.classList.toggle('on', x === e)); sfx.chime(); fxAt('fx_ting', e, { size: 80, fps: 12 }); paintPreview(); upd(); }); return e; });
      upd = () => { const v = has(S.k), l = !!b.links[S.k]; if (v && clueWrap.style.visibility !== 'visible') { clueWrap.style.visibility = 'visible'; gsap.fromTo(clueWrap, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .35 }); } nextB.disabled = !(v && l); nextB.classList.toggle('pulse', v && l); nextB.textContent = !v ? 'Choose first' : !l ? 'Pick the message that helped' : n === STEPS.length - 1 ? 'Lock our bar' : 'Next part'; };
      const q = h('div', { class: 'q' }); const clueRow = h('div', { class: 'clues', style: { maxWidth: '1500px' } }, clueEls);
      // one decision at a time: the clues appear once a setting is chosen (space is kept, so nothing jumps)
      const clueWrap = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', visibility: has(S.k) ? 'visible' : 'hidden' } }, h('div', { class: 'qlab', style: { marginTop: '6px', color: '#8FF0E2' } }, 'Which clue helped?'), clueRow);
      body.append(h('div', { class: 'qlab' }, `Part ${n + 1} of 3`), q, picker, clueWrap);
      guide(() => !has(S.k) ? { el: picker, text: 'First, choose here', id: 'bar_pick' } : !b.links[S.k] ? { el: clueRow, text: 'Which message helped you choose? Tap it.', id: 'bar_clue' } : { el: nextB, text: 'Tap to go on', id: 'bar_next' });
      q.textContent = S.q; gsap.from(picker, { y: 20, opacity: 0, duration: .4, delay: .1 }); stagger(clueEls, .05); upd();
    }
    screen(panel(head(null, title[1], sub || 'Our <b>bar</b> is what every box should manage tonight. There is no right answer.'), old ? h('div', { class: 'oldbar' }, old) : null, preview, body, h('div', { class: 'row' }, ask, nextB)));
    go(0);
  });
}
async function clueChat(list, { eye = null, title = 'Messages from tonight’s customers', sub = 'These messages are your clues.', button = 'Write our bar' } = {}) {
  const chat = chatBox('anya', 'Anya’s family + other customers');
  const go = btn(button, 'teal'); go.style.visibility = 'hidden';
  guide(() => go.style.visibility === 'visible' ? { el: go, text: 'Read them all? Tap here', id: 'chat_go' } : null);
  screen(panel(head(eye, title, sub), h('div', { class: 'row' }, chat.el), h('div', { class: 'row' }, go)));
  popIn(chat.el); await wait(500);
  for (const c of list) await chat.msg(c.text, { icon: c.img, delay: 700, cls: c.fresh ? 'new' : '' });
  go.style.visibility = 'visible'; gsap.from(go, { scale: .7, opacity: 0, duration: .35, ease: 'back.out(2)' }); go.classList.add('pulse');
  await new Promise(r => tap(go, () => { sfx.select(); r(); }));
}
const clueText = id => [...CLUES, CLUE_LATE, { id: 'riders6', text: 'Riders: 6 · far trip 48 min' }].find(c => c.id === id)?.text;

export async function s3() {
  K3.setCam('wide', 1.2);
  await say('meher', 'Tonight your team sets the bar. A bar is like the bar in a high jump: the line you aim to get over. First, read what our customers say.');
  await clueChat(CLUES);
  const { b, asks } = await barEditor({ kind: 1, clues: CLUES, title: [null, 'What does “good enough” mean tonight?'], sub: null });
  Object.assign(G.bar, b); clearScreen(); G.bar1 = { ...G.bar, text: barText(G.bar) };
  log('bar_set', { on_time_min: b.min, arrival: b.arrive, custom_slot: b.custom, clue_links: b.links, ask_owner_count: asks });
  setBarSign(barText(G.bar)); fx('fx_sparkle', 960, 180, { size: 220 });
  await wait(1200);
}

/* ================= 4 · Shift 1 ================= */
export async function s4() {
  ensureDefaults(); clearScreen(); hud(true); setBarSign(barText(G.bar), false); $('#reviews').innerHTML = ''; K3.setCam('play', 1.4);
  await say('meher', 'Before the real orders, let’s try one practice order together. Nothing counts yet.', { button: 'Show us how' });
  await practice();
  await say('meher', 'Here come the real orders! Look after your own station, and keep an eye on the others.', { button: 'Start the rush' });
  await new Promise(res => {
    let tipped = false;
    const S = startShift({ shift: 1, n: 24, startMin: 21 * 60, minutes: 60, msPerMin: 6000, riders: 12, desaiAt: 3.5, seed: 11, onEnd: res });
    const iv = setInterval(() => { if (!S.running) { clearInterval(iv); return; } if (!tipped && S.t > 20) { tipped = true; say('kabir', 'Far side is slow tonight. Twenty-four minutes each way.', { top: true, noNext: true }).then(() => setTimeout(() => { if (/^Kabir/.test($('#talk .bub .n')?.textContent || '')) hideTalk(); }, 2600)); } }, 500);
  });
  zones(false); sfx.fanfare();
}
function spot(k) { document.querySelectorAll('.zone').forEach(z => z.classList.toggle('dimz', !!k && z.id !== `z-${k}`)); }
async function practice() {
  const S = startShift({ shift: 0, practice: true, n: 0, startMin: 21 * 60, minutes: 1e9, msPerMin: 700, riders: 12, seed: 3 });
  await wait(900); const o = practiceOrder();
  const TXT = {
    prep: ['prep', `${nameOf('prep')}, you’re ${G.three ? 'running Prep too' : 'Prep'}. Tap the chopping board until every dot is filled.`],
    cook: ['cook', `${nameOf('cook')}, you’re Cook. Tap an empty burner to start cooking.`],
    cooking: ['cook', 'Watch the ring fill up. That’s the food cooking.'],
    ready: ['cook', `It’s ready! ${nameOf('cook')}, tap the food. In the real rush, food left too long burns.`],
    pack: ['pack', `${nameOf('pack')}, you’re Pack. Tap each food into the box, then tap Seal and label.`],
    disp: ['disp', `${nameOf('disp')}, you’re Dispatch. Tap Send to give the box to a rider.`],
  };
  let last = '';
  await new Promise(res => { const iv = setInterval(() => {
    let st = o.stage; if (st === 'cooking') st = S.burners.some(b => b.order === o && b.state === 'done') ? 'ready' : 'cooking';
    if (st === last) return; last = st;
    if (st === 'out') { spot(null); hideTalk(); guide(() => ({ el: '#wall', text: 'A rider is on the way. The family’s reaction will pop up here!', id: 'practice_wall', below: true }), { idle: 0 }); }
    else if (st === 'done') { clearInterval(iv); setTimeout(res, 2200); }
    else if (TXT[st]) { spot(TXT[st][0]); say('meher', TXT[st][1], { top: true, noNext: true }); }
  }, 150); });
  unguide();
  $('#zones').classList.add('showhelp');
  await say('meher', 'That’s the whole trip: Prep, Cook, Pack, Dispatch. The bar under each station shows how many orders wait there. If a station glows gold, it’s falling behind, and anyone can tap HELP to jump in.', { top: true, button: 'Got it' });
  $('#zones').classList.remove('showhelp');
  stopShift(); spot(null); $('#reviews').innerHTML = ''; $('#tickets').innerHTML = ''; $('#tickets').dataset.k = ''; K3.setStacks(0, 0);
}

/* ================= 5 · Check the Bar → why → what tonight taught us → change one thing ================= */
function barLines(b, st, shift) {
  const c = st.counts, L = [];
  const lim = b.kind === 2 && b.when === 'midnight' ? 'Before midnight' : `On time within ${b.min} min`;
  L.push([lim, c.dueOnTime ?? c.onTime, c.due ?? c.n, 'time', shift === 1 ? 'orders that were due by 10 pm' : 'orders tonight after the crisis']);
  L.push([b.arrive === 'any' ? 'Any temperature' : `Arrives ${b.arrive}`, b.arrive === 'any' ? c.n : b.arrive === 'warm' ? c.warm : c.hot, c.n, 'arrive', null]);
  L.push(['All items correct', c.correct, c.n, 'correct', null]);
  const fries = G.menu.includes('fries') ? c.n : 0, cust = b.kind === 2 ? b.custom2 : b.custom;
  if (cust === 'dessert' || cust === 'dessert intact') L.push(['Dessert intact', c.dessert, c.dessertOf, 'custom', c.dessertOf ? 'boxes with dessert' : 'no dessert on the menu']);
  if (cust === 'fries' || cust === 'fries still crisp') L.push(['Fries still crisp', fries - st.tally.soggy, fries, 'custom', fries ? 'boxes with fries' : 'no fries on the menu']);
  if (cust === 'party') L.push(['Anya’s box before 10 pm', st.desai && st.desai.clockAt <= 1320 ? 1 : 0, 1, 'custom', 'Anya’s box']);
  if (cust === 'we tell people the real time') L.push(['We told people the real time', c.promise, c.promiseOf, 'custom', c.promiseOf ? 'came when we said' : 'we didn’t give a time']);
  return L;
}
function judgeScreen({ lines, eyebrow, title, side, logEv, button, why = true }) {
  const marks = {};
  return new Promise(res => {
    const go = btn('Mark every line first', 'teal', () => res(marks)); go.disabled = true;
    const grid = h('div', { class: 'results' });
    lines.forEach(([l, a, b, k, cap]) => { const p = h('button', { class: 'pfb p' }, 'Pass'), f = h('button', { class: 'pfb f' }, 'Fail');
      const set = m => { marks[k] = m; p.classList.toggle('on', m === 'pass'); f.classList.toggle('on', m === 'fail'); sfx.tick(); go.disabled = Object.keys(marks).length < lines.length; go.classList.toggle('pulse', !go.disabled); go.textContent = go.disabled ? 'Mark every line first' : button; log(logEv, { line: k, team_mark: m, actual: `${a} of ${b}` }); };
      tap(p, () => set('pass')); tap(f, () => set('fail')); grid.append(h('div', { class: 'ln' }, l), xofy(a, b, cap), h('div', { class: 'pf' }, p, f)); });
    guide(() => { const i = lines.findIndex(l => !marks[l[3]]); return i >= 0 ? { el: grid.querySelectorAll('.pf')[i], text: 'Did this line reach your bar? Tap Pass or Fail.', id: logEv + '_mark' } : { el: go, text: 'Tap here to go on', id: logEv + '_next' }; });
    screen(panel(head(eyebrow, title, '<b>Pass</b> = it reached your bar. <b>Fail</b> = it didn’t.' + (why ? ' An honest mark shows what to change.' : '')),
      side ? h('div', { class: 'row', style: { gap: '50px', alignItems: 'flex-start', flexWrap: 'nowrap' } }, grid, side) : grid, h('div', { class: 'row' }, go)));
    gsap.from('.results > *', { opacity: 0, y: 20, stagger: .05, duration: .4 });
  });
}
export async function s5() {
  ensureDefaults(); stopShift(); hud(true); zones(false); setBarSign(barText(G.bar), false); K3.setCam('plan', 1.4); $('#tickets').innerHTML = ''; $('#tickets').dataset.k = '';
  const st = shiftStats(1); G.stats.s1 = st; const c = st.counts;
  await say('meher', 'First tries are for learning. Let’s look at what really happened.', { top: true });
  const lines = barLines(G.bar, st, 1);
  const mx = Math.max(1, ...Object.values(st.waits)); const pk = PACKS[G.pack];
  const side = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', width: '480px' } },
    h('div', { class: 'eyebrow' }, 'Where orders waited'),
    h('div', { class: 'waits' }, STATIONS.map(s => h('div', { class: 'w' }, h('b', {}, `${Math.round(st.waits[s.k])} min`), h('i', { style: { height: `${8 + st.waits[s.k] / mx * 100}px`, background: s.col } }), s.name))),
    h('div', { class: 'eyebrow', style: { marginTop: '6px' } }, 'What customers said'),
    ...topReviews(st.reviews, 3).map(r => h('div', { class: 'rv' }, img(r.emoji), `${r.text} ×${r.count}`)),
    null);
  const marks = await judgeScreen({ lines, eyebrow: '10:00 pm', title: `${c.n} ${c.n === 1 ? 'box' : 'boxes'} delivered. Did tonight reach your bar?`, side: null, logEv: 'bar_judged', button: 'Next: why?' });
  await reflect(marks, lines, side);
  await reveal(st);
  await changeOne(st);
}
/* separate "the bar was wrong" from "the kitchen got stuck": this is the heart of Objective 1 */
async function reflect(marks, lines, side) {
  const failed = lines.filter(l => marks[l[3]] === 'fail');
  const opts = failed.length ? [['bar', 'Our bar was too hard for tonight'], ['kitchen', 'The kitchen got stuck'], ['travel', 'The food or the box didn’t travel well'], ['unsure', 'We’re not sure yet']] : [['easy', 'Our bar was too easy'], ['right', 'Our bar was just right'], ['unsure', 'We’re not sure yet']];
  const reason = await new Promise(res => {
    const row = h('div', { class: 'opts', style: { flexDirection: 'column', alignItems: 'center' } }, opts.map(([v, l]) => { const b = h('button', { class: 'chip big' }, l); tap(b, () => { sfx.select(); res(v); }); return b; }));
    guide(() => ({ el: row, text: 'Talk about it, then tap one', id: 's5_why' }));
    screen(panel(head(null, failed.length ? 'Why do you think those lines failed?' : 'Every line passed. What does that tell you?', failed.length ? `Knowing why helps you change the right thing. Failed: ${failed.map(l => l[0]).join(' · ')}` : 'Was it easy because the kitchen did well, or because the bar was low?'), side ? h('div', { class: 'row', style: { gap: '60px', alignItems: 'center', flexWrap: 'nowrap' } }, row, side) : row));
    stagger([...row.children]);
  });
  G.failReason = reason; log('fail_reason', { failed: failed.map(l => l[3]), reason });
}
/* the prototype meets the market: the hidden backs of the cards are revealed */
async function reveal(st) {
  const t = st.tally;
  const note = { fries: t.soggy && `“fries were soggy” ×${t.soggy}`, cake: t.squashed && `“cake was squashed” ×${t.squashed}`, raita: t.raitaWarm && `“raita was warm” ×${t.raitaWarm}` };
  await new Promise(res => {
    const go = btn('Next: change one thing', 'teal', res); go.style.visibility = 'hidden';
    const cards = G.menu.map(d => h('div', { class: 'card flip tall' }, h('div', { class: 'inner' },
      h('div', { class: 'face' }, img(DISHES[d].img, 'art'), h('b', {}, DISHES[d].name), h('span', {}, DISHES[d].line)),
      h('div', { class: 'backf facts' }, h('b', {}, DISHES[d].name), ...DISH_FACTS[d].map(x => h('div', { class: 'tl' }, x)), note[d] ? h('div', { class: 'tl rvq' }, note[d]) : null))));
    const pk = PACKS[G.pack], c = st.counts;
    const pcard = h('div', { class: 'card tall' }, img(pk.img, 'art'), h('b', {}, pk.name), h('span', {}, `Arrived hot: ${c.hot} of ${c.n}`), h('span', {}, `Cost tonight: ₹${c.n * pk.cost}`), t.squashed ? h('span', {}, `Squashed cakes: ${t.squashed}`) : null);
    const row = h('div', { class: 'cards' }, cards, pcard);
    screen(panel(head(null, 'Your first box met real orders', null), row, h('div', { class: 'row' }, go)));
    stagger([...row.children], .1);
    cards.forEach((c, i) => setTimeout(() => { c.classList.add('back'); sfx.chime(); }, 900 + i * 700));
    setTimeout(() => { go.style.visibility = 'visible'; go.classList.add('pulse'); }, 900 + cards.length * 700);
    guide(() => go.style.visibility === 'visible' ? { el: go, text: 'Read the backs together, then tap here', id: 's5_reveal' } : null);
  });
  log('prototype_reveal', { dishes: [...G.menu], tally: t });
}
// "took 32 / 37 / 39 minutes" are one finding, not three: group them as "took over 30 minutes ×3"
function topReviews(rs, n) { const m = {}; let low = Infinity; rs.forEach(r => { const t = /^took \d+ minutes$/.test(r.text); if (t) low = Math.min(low, +r.text.match(/\d+/)[0]); const k = t ? 'took' : r.text; m[k] ||= { ...r, count: 0 }; m[k].count++; });
  if (m.took) m.took.text = `took over ${Math.floor(low / 5) * 5} minutes`; return Object.values(m).sort((a, b) => b.count - a.count).slice(0, n); }
function evidenceChips(st, extra = []) {
  const c = st.counts;
  const chips = topReviews(st.reviews, 3).map(r => ({ id: 'rv:' + r.text, text: `“${r.text}” ×${r.count}`, img: r.emoji, tags: tagsFor(r.text) }));
  const w = Object.entries(st.waits).sort((a, b) => b[1] - a[1])[0]; if (w) chips.push({ id: 'wait:' + w[0], text: `Orders waited longest at ${STATIONS.find(s => s.k === w[0]).name} (${Math.round(w[1])} min)`, img: STATIONS.find(s => s.k === w[0]).icon, tags: ['balance', w[0], 'batch', 'move', 'simplify'] });
  chips.push({ id: 'ontime', text: `${c.dueOnTime} of ${c.due} orders on time`, img: 'emo_wait', tags: ['bar', 'time', 'batch', 'pause', 'pickup', 'balance'] });
  if (c.n) chips.push({ id: 'hot', text: `${c.hot} of ${c.n} boxes arrived hot`, img: 'clue_cold', tags: ['packaging', 'dish', 'bar'] });
  return chips.concat(extra);
}
function tagsFor(t) { if (/soggy/.test(t)) return ['dish', 'fries', 'packaging']; if (/squash/.test(t)) return ['packaging', 'dish', 'cake']; if (/cold|warm/.test(t)) return ['packaging', 'dish', 'bar']; if (/missing/.test(t)) return ['balance', 'pack']; if (/took|later/.test(t)) return ['bar', 'balance', 'batch', 'pause', 'pickup', 'move', 'simplify']; return ['bar']; }
async function changeOne(st) {
  const doors = [['dish', 'Swap a food', 'opt_simplify', 'Take one food out, put a new one in'], ['packaging', 'Change the box', 'pkg_insulated', 'A different way to pack the food'], ['balance', 'Balance stations', 'ico_highfive', 'Give a busy station an extra helper'], ['bar', 'Change the bar', 'clue_party', 'Rewrite what good enough means']];
  const kind = await new Promise(res => {
    const cards = doors.map(([k, l, i, e]) => { const c = h('div', { class: 'card' }, img(i, 'art'), h('b', {}, l), h('span', { class: 'eff' }, e)); tap(c, () => { sfx.select(); res(k); }); return c; });
    const row = h('div', { class: 'cards' }, cards);
    guide(() => ({ el: row, text: 'Tap the one change you want to make', id: 's5_door' }));
    screen(panel(head(null, 'Change one thing for Shift 2', 'Think about where orders waited and what customers said.'), row));
    stagger(cards);
  });
  let detail = {};
  if (kind === 'dish') detail = await new Promise(res => {
    let out = null, inn = null; const go = btn('Make the swap', 'teal', () => res({ out, in: inn })); go.disabled = true;
    const outs = G.menu.map(d => { const c = h('div', { class: 'card' }, img(DISHES[d].img, 'art'), h('b', {}, DISHES[d].name)); tap(c, () => { out = d; outs.forEach(x => x.classList.toggle('on', x === c)); sfx.tick(); go.disabled = !(out && inn); }); return c; });
    const ins = Object.keys(DISHES).filter(d => !G.menu.includes(d)).map(d => { const c = h('div', { class: 'card' }, img(DISHES[d].img, 'art'), h('b', {}, DISHES[d].name)); tap(c, () => { inn = d; ins.forEach(x => x.classList.toggle('on', x === c)); sfx.tick(); go.disabled = !(out && inn); }); return c; });
    const outRow = h('div', { class: 'cards' }, outs), inRow = h('div', { class: 'cards' }, ins);
    guide(() => !out ? { el: outRow, text: 'Tap a food to take out', id: 'swap_out' } : !inn ? { el: inRow, text: 'Tap a food to put in', id: 'swap_in' } : { el: go, text: 'Tap to make the swap', id: 'swap_go' });
    screen(panel(head('Swap a food', 'Take one out, put one in'), h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, 'Take out'), outRow, h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, 'Put in'), inRow, h('div', { class: 'row' }, go)));
  });
  if (kind === 'packaging') detail = await new Promise(res => { const cards = Object.entries(PACKS).filter(([k]) => k !== G.pack).map(([k, p]) => { const c = h('div', { class: 'card' }, img(p.img, 'art'), h('b', {}, p.name), h('span', {}, p.line)); tap(c, () => res({ from: G.pack, to: k })); return c; }); const row = h('div', { class: 'cards' }, cards); guide(() => ({ el: row, text: 'Tap the new box', id: 'swap_pack' })); screen(panel(head('Change the box', 'Pick the new box'), row)); stagger(cards); });
  if (kind === 'balance') detail = await new Promise(res => { const cards = STATIONS.map(s => { const c = h('div', { class: 'card' }, img(s.icon, 'art'), h('b', {}, s.name), h('span', {}, 'an extra helper all of Shift 2')); tap(c, () => res({ station: s.k })); return c; }); const row = h('div', { class: 'cards' }, cards); guide(() => ({ el: row, text: 'Tap the station that gets the helper', id: 'balance' })); screen(panel(head('Balance the stations', 'Which station gets an extra helper for all of Shift 2?', 'The helper comes from the rest of the team.'), row)); stagger(cards); });
  if (kind === 'bar') { const { b } = await barEditor({ kind: 1, clues: CLUES, title: ['Change the bar', 'Rewrite tonight’s bar'], old: barText(G.bar) }); detail = { from: barText(G.bar), to: null }; Object.assign(G.bar, b); detail.to = barText(G.bar); setBarSign(barText(G.bar)); }
  const ev = await new Promise(res => {
    const chips = evidenceChips(st).map(c => { const e = h('button', { class: 'clue' }, img(c.img), c.text); tap(e, () => { sfx.select(); res(c); }); return e; });
    const row = h('div', { class: 'clues', style: { maxWidth: '1400px' } }, chips);
    guide(() => ({ el: row, text: 'Tap the clue that made you choose', id: 's5_ev' }));
    screen(panel(head('Why this change?', 'Which clue made you choose it?', 'A clue is something that really happened tonight.'), row));
    stagger(chips);
  });
  if (kind === 'dish') G.menu = G.menu.map(d => d === detail.out ? detail.in : d);
  if (kind === 'packaging') G.pack = detail.to;
  if (kind === 'balance') G.permHelp[detail.station] = true;
  G.change1 = { kind, detail, evidence: ev };
  G.box2 = { menu: G.menu.slice(), pack: G.pack };
  log('change_one', { type: kind, detail, evidence_ref: ev.id, evidence_matches_change: ev.tags.includes(kind), fail_reason: G.failReason });
  G.boxVersion = 2;
  await stampBox('stamp_v2', 'Party box v2');
}

/* ================= 6 · The Rider Crisis ================= */
export async function s6() {
  ensureDefaults(); hud(true); zones(false); setBarSign(barText(G.bar), false); clearScreen(); $('#tickets').innerHTML = ''; $('#reviews').innerHTML = '';
  const o = { m: 22 * 60 }; await new Promise(r => gsap.to(o, { m: 22 * 60 + 30, duration: 1.8, ease: 'power1.inOut', onUpdate: () => setClock(o.m), onComplete: r }));
  K3.setCam('disp', 1.8); await wait(900);
  K3.setStacks(0, 8);
  const icons = Array.from({ length: 12 }, () => img('ico_rider', '', { style: 'width:96px;height:96px' }));
  screen(h('div', { class: 'center', style: { justifyContent: 'flex-start', paddingTop: '250px' } }, h('div', { class: 'eyebrow' }, 'Riders on shift'), h('div', { class: 'row', style: { gap: '14px', flexWrap: 'nowrap' } }, icons)));
  stagger(icons, .04);
  setTimeout(() => icons.slice(6).forEach((e, i) => gsap.to(e, { opacity: .12, y: 30, filter: 'grayscale(1)', duration: .5, delay: i * .25, onStart: () => sfx.tick() })), 2600);
  await say('kabir', 'Bad news, team. Six of our riders are heading home, family stuff. We are down to six. We will ride safe, not fast.', { mode: 'talk' });
  updateRidersHud(); K3.setRiders(6, 12); await wait(1400);
  const t0 = performance.now(); let pings = 0, peeks = 0, wrap;
  await new Promise(res => {
    const ask = btn(`Ask ${nameOf('disp')}`, 'ghost', () => { pings++; gsap.fromTo(wrap, { x: -10 }, { x: 0, duration: .4, ease: 'elastic.out(1,.3)' }); });
    const share = btn(`${nameOf('disp')}: I told the team`, 'teal', () => res()); share.disabled = true;
    const card = h('div', { class: 'glass', style: { padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: '14px', width: '700px' } },
            h('div', { class: 'stat' }, 'Riders free right now', h('b', {}, '6 of 6 · was 12')),
      h('div', { class: 'stat' }, 'Boxes waiting at the door', h('b', {}, '8')),
      h('div', { class: 'stat' }, 'One far trip (there and back)', h('b', {}, '48 min')),
      h('div', { class: 'stat' }, 'One near trip (there and back)', h('b', {}, '16 min')),
      h('div', { class: 'stat', style: { border: 0 } }, 'Boxes one rider can carry', h('b', {}, `${PACKS[G.pack].cap} · same area`)));
    const cover = h('button', { class: 'peekcover' }, img('ico_rider'), `${nameOf('disp')} only!`, h('small', {}, 'Tap to peek. Then tell your team what you see.'));
    wrap = h('div', { class: 'peekwrap' }, card, cover);
    tap(cover, () => { peeks++; sfx.shutter(); wrap.classList.add('open'); share.disabled = false; share.classList.add('pulse'); clearTimeout(wrap._t); wrap._t = setTimeout(() => wrap.classList.remove('open'), 7000); });
    guide(() => !peeks ? { el: cover, text: `${nameOf('disp')}: tap here to peek`, id: 's6_peek' } : { el: share, text: 'Told everyone what you saw? Tap here', id: 's6_share' });
    screen(h('div', { class: 'center', style: { gap: '22px' } }, head('10:30 pm', 'Boxes are piling up at the door!', `Only ${nameOf('disp')} (Dispatch) can see the rider card. Everyone else: ask them!`), wrap, h('div', { class: 'row' }, ask, share)));
    popIn(wrap);
  });
  G.sharedRiders = true; log('dispatch_share', { ms_after_crisis: Math.round(performance.now() - t0), ask_dispatch_pings: pings, dispatch_peeks: peeks });
  await teamCheck();
  clearScreen(); updateRidersHud();
  await clueChat([{ id: 'hi', img: 'emo_wait', text: 'Hi again! We heard it’s super busy tonight.' }, { ...CLUE_LATE, fresh: true }], { eye: null, title: 'Anya’s family wrote back', sub: 'Conditions changed. Does your bar still fit?', button: 'Re-plan the kitchen' });
}
/* did the information actually reach the team? (a fact check, not a quiz on the lesson) */
/* SKAI retry rule: 1st miss = gentle nudge, 2nd miss = stronger clue, 3rd miss = show the answer and move on (never trapped) */
async function teamCheck() {
  let tries = 0, misses = 0, first = null, done = false;
  await new Promise(res => {
    const msg = h('div', { class: 'hint', style: { minHeight: '30px' } });
    const finish = (b, revealed) => { done = true; sfx.chime(); fxAt('fx_sparkle', b, { size: 160 }); b.classList.add('on');
      msg.textContent = revealed ? `It’s 6: half of the 12 riders went home. ${nameOf('disp')}, say it out loud so everyone hears it.` : `Yes: ${nameOf('disp')}’s card said 6.`;
      log('dispatch_check', { first_answer: first, correct_first: first === 6, tries, revealed }); setTimeout(res, revealed ? 3200 : 1100); };
    const chips = shuffle([12, 8, 6, 4]).map(v => { const b = h('button', { class: 'chip big' }, String(v)); tap(b, () => { if (done || b.classList.contains('off')) return; tries++; first ??= v;
      if (v === 6) return finish(b, false);
      misses++; sfx.bump(); b.classList.add('off');
      if (misses === 1) msg.textContent = `Almost! Ask ${nameOf('disp')} again what the card said.`;
      else if (misses === 2) msg.textContent = `Here’s a clue: there were 12 riders, and half of them went home.`;
      else finish(chips.find(x => x.textContent === '6'), true); }); return b; });
    const row = h('div', { class: 'opts' }, chips);
    guide(() => ({ el: row, text: 'Answer together', id: 's6_check' }));
    screen(panel(head(null, 'How many riders are free now?', `Everyone except ${nameOf('disp')} answers, using only what ${nameOf('disp')} told you, so the whole team plans with the same facts.`), row, msg));
  });
}

/* ================= 7 · Re-plan + two messages ================= */
export async function s7() {
  ensureDefaults(); hud(true); zones(false); setBarSign(barText(G.bar), false); G.sharedRiders = true; updateRidersHud(); K3.setCam('plan', 1.4);
  await say('meher', 'There is no one right answer. Pick a plan you can explain.', { top: true });
  G.replan = await new Promise(res => {
    const sel = new Set(); const go = btn('Pick 1 or 2 changes', 'teal', () => res([...sel])); go.disabled = true;
    const cards = REPLAN.map(o => { const c = h('div', { class: 'card', style: { width: '270px' } }, img(o.img, 'art'), h('b', {}, o.name), h('span', {}, o.line));
      tap(c, () => { if (sel.has(o.id)) sel.delete(o.id); else if (sel.size < 2) sel.add(o.id); else return; c.classList.toggle('on', sel.has(o.id)); sfx.select(); go.disabled = !sel.size; go.classList.toggle('pulse', !!sel.size); go.textContent = sel.size ? 'Lock the plan' : 'Pick 1 or 2 changes'; }); return c; });
    const row = h('div', { class: 'cards' }, cards);
    guide(() => !sel.size ? { el: row, text: 'Tap 1 or 2 changes', id: 's7_pick' } : { el: go, text: 'Done picking? Tap here', id: 's7_lock' });
    screen(panel(head(null, 'Pick one or two changes', 'Six riders, eight boxes at the door. No change is the one right answer.'), row, h('div', { class: 'row' }, go)));
    stagger(cards);
  });
  log('replan', { options: G.replan });
  const clues2 = [...CLUES, { ...CLUE_LATE, fresh: true }, { id: 'riders6', img: 'ico_rider', text: 'Riders: 6 · far trip 48 min', fresh: true }];
  const from = barText(G.bar);
  const { b } = await barEditor({ kind: 2, clues: clues2, title: [null, 'Does our bar still fit tonight?'], sub: 'Fewer riders means slower trips. Your bar can change too.', old: from });
  G.bar2 = b; setBarSign(barText(b)); log('bar_changed', { from, to: barText(b), clue_links: b.links });
  await messages();
}
/* Same facts, two audiences. The team agrees the facts ONCE, then chooses the words for each audience.
   Every fact has an everyday wording and a job-talk wording (shown in random order, never labelled),
   so adjusting to the audience is the children's decision, not the form's. Replies react to what was sent. */
const WHEN = { '35': ['within 35 minutes', 'Each box: within 35 min.'], '60': ['within an hour', 'Each box: within 60 min.'], '1130': ['by 11:30 pm', 'Last drop by 11:30 pm.'], 'mid': ['before midnight', 'Last drop before midnight.'] };
const ROUTE = { far: ['We’re starting with homes that are far away.', 'Far side first, then mid, then near.'], near: ['We’re starting with homes close by.', 'Near side first, then mid, then far.'], any: ['We deliver boxes as soon as they’re ready.', 'Any area: oldest box first.'] };
const CHG = { batch: ['We’re sending nearby orders together.', 'Batch: boxes for the same area go on one trip.'], pickup: ['Live close by? You can collect your box.', 'Near orders: customer pickup. Skip those.'], pause: ['We paused new orders for 10 minutes to catch up.', 'No new orders for 10 min. Clear the door first.'], simplify: ['Our menu is a little smaller tonight.', 'Smaller menu: boxes ready faster.'], move: ['One of our cooks is helping with deliveries.', 'Extra person on Dispatch from now.'] };
const FRIENDLY = ['Thank you for waiting!', 'Happy New Year from all of us!', 'Ride safe, see you soon.'];
// replies screen: the sent message was just read aloud on the compose screen, so show its opening only
const brief = t => { const w = String(t).split(' '); return w.length > 12 ? w.slice(0, 12).join(' ') + ' …' : t; };
const DECOY = 'Dear all, due to unforeseen operational circumstances our delivery schedule has been revised. Please be advised orders will be fulfilled as soon as possible. Regards, Kitchen.';
async function messages() {
  hud(false); $('#barSign').classList.add('hide');
  const cap = PACKS[G.pack].cap;
  const F = await new Promise(res => {
    const f = { when: null, route: null, boxes: null, pickup: null };
    const groups = [
      ['when', 'When will food arrive?', [['35', 'Within 35 minutes'], ['60', 'Within an hour'], ['1130', 'By 11:30 pm'], ['mid', 'Before midnight']]],
      ['route', 'Which area goes first?', [['far', 'Far side first'], ['near', 'Near side first'], ['any', 'Any order']]],
      ['boxes', 'Boxes per trip', [...new Set([1, 2, cap])].map(n => [String(n), `${n} box${n > 1 ? 'es' : ''}`])],
      ['pickup', 'Riders leave the door every…', [['10', '10 minutes'], ['15', '15 minutes'], ['20', '20 minutes']]],
    ];
    const go = btn('Agree every fact first', 'teal', () => res(f)); go.disabled = true;
    const rows = groups.map(([k, label, list]) => { const opts = h('div', { class: 'opts' }, list.map(([v, l]) => { const c = h('button', { class: 'chip' }, l); tap(c, () => { f[k] = v; [...opts.children].forEach(x => x.classList.toggle('on', x === c)); sfx.tick(); upd(); }); return c; })); return h('div', { class: 'factrow' }, h('div', { class: 'k' }, label), opts); });
    function upd() { const ok = Object.values(f).every(Boolean); go.disabled = !ok; go.classList.toggle('pulse', ok); go.textContent = ok ? 'Next: write to families' : 'Agree every fact first'; }
    guide(() => { const i = groups.findIndex(g => !f[g[0]]); return i >= 0 ? { el: rows[i], text: 'Agree this one together', id: 'facts_' + groups[i][0] } : { el: go, text: 'Tap here', id: 'facts_go' }; });
    screen(panel(head(null, 'Agree the facts once', null), h('div', { class: 'factgrid' }, rows), h('div', { class: 'row' }, go)));
    stagger(rows, .06);
  });
  log('message_facts', { ...F });
  const facts = [
    ...G.replan.map(r => ({ k: 'chg_' + r, label: 'What changed', fam: CHG[r][0], rid: CHG[r][1] })),
    { k: 'riders', label: 'Riders', fam: 'Some of our riders had to go home tonight.', rid: '6 riders on shift, not 12.' },
    { k: 'when', label: 'When food comes', fam: `Your food will arrive ${WHEN[F.when][0]}.`, rid: WHEN[F.when][1] },
    { k: 'route', label: 'Which area first', fam: ROUTE[F.route][0], rid: ROUTE[F.route][1] },
    { k: 'boxes', label: 'Boxes per trip', fam: 'Some boxes will travel together.', rid: `${F.boxes} box${F.boxes > 1 ? 'es' : ''} per trip, same area.` },
    { k: 'pickup', label: 'Pickup times', fam: 'Riders leave the kitchen often.', rid: `Pickups at the door every ${F.pickup} min.` },
  ];
  const order = Object.fromEntries(facts.map(f => [f.k, Math.random() < .5]));   // which wording shows first, per fact
  const pick = { c: {}, r: {} }, fr = { c: null, r: null };
  const textOf = side => [...facts.filter(f => pick[side][f.k]).map(f => f[pick[side][f.k]]), fr[side]].filter(Boolean).join(' ');
  let decoy = false, attempt = 0;
  async function compose(side) {
    const fam = side === 'c';
    return new Promise(res => {
      const out = h('div', { class: 'msgout' });
      const send = btn('Choose at least one line', 'teal'); send.disabled = true;
      const decoyB = fam && !attempt ? btn('Send one long message to both', 'ghost', () => { decoy = true; res('decoy'); }) : null;
      const upd = () => { const t = textOf(side); out.textContent = t || '…'; send.disabled = !t; send.classList.toggle('pulse', !!t); send.textContent = t ? 'Send' : 'Choose at least one line'; };
      const row = (label, opts, get, set) => { const o = h('div', { class: 'opts' }, opts.map(v => { const c = h('button', { class: 'chip' + (get() === v.key ? ' on' : '') }, v.text); tap(c, () => { set(get() === v.key ? null : v.key); [...o.children].forEach((x, i) => x.classList.toggle('on', get() === opts[i].key)); sfx.tick(); upd(); }); return c; })); return h('div', { class: 'frow' }, o); };   // the two wordings of one fact sit on one row; no row label needed
      const rows = facts.map(f => { const w = [{ key: 'fam', text: f.fam }, { key: 'rid', text: f.rid }]; if (order[f.k]) w.reverse(); return row(f.label, w, () => pick[side][f.k] || null, v => { if (v) pick[side][f.k] = v; else delete pick[side][f.k]; }); });
      rows.push(row('A friendly line', FRIENDLY.map(t => ({ key: t, text: t })), () => fr[side], v => { fr[side] = v; }));
      const phone = h('div', { class: `phone wide ${fam ? 'cust' : 'rid'}` }, h('div', { class: 'ph' }, img(fam ? 'anya_phone' : 'kabir_radio')), ...rows, h('div', { class: 'k', style: { font: '800 16px Nunito', letterSpacing: '.1em', color: '#4F5577' } }, 'YOUR MESSAGE'), out);
      tap(send, () => { sfx.whoosh(); gsap.to(phone, { y: -30, scale: .96, opacity: 0, duration: .45, ease: 'power2.in', onComplete: () => res('sent') }); });
      guide(() => !textOf(side) ? { el: phone, text: 'Tap the lines you want', id: `msg_${side}_pick` } : { el: send, text: 'Read it out loud. Then tap Send', id: `msg_${side}_send` });
      screen(h('div', { class: 'center', style: { gap: '14px', justifyContent: 'flex-start', paddingTop: '24px' } },
        head(`Message ${fam ? '1' : '2'} of 2`, fam ? 'What do families need to hear?' : 'What do riders need to know?', fam ? 'They’re getting ready for a party. Pick only what <b>they</b> need, in words <b>they</b> understand.' : 'They’re on a scooter, about to leave. Pick what <b>they</b> need to do the job.'),
        phone, h('div', { class: 'row' }, decoyB, send)));
      popIn(phone); upd();
    });
  }
  const famReply = () => {
    if (decoy) return 'Umm… so when is our food coming?';
    const p = pick.c, jar = facts.filter(f => p[f.k] === 'rid'), n = Object.keys(p).length + (fr.c ? 1 : 0);
    if (!p.when) return 'Thanks for telling us! But when will our food come?';
    if (jar.length) return `What does “${jar[0].rid}” mean? We just want our party box!`;
    if (n > 4) return 'That’s a lot to read! But thank you, see you soon.';
    return `Thank you! See you ${WHEN[F.when][0]}!`;
  };
  const ridAsks = () => { const p = pick.r, a = []; if (!p.route) a.push('Which area first?'); if (p.boxes !== 'rid') a.push('How many boxes per trip?'); if (p.pickup !== 'rid') a.push('When do we pick up?'); return a; };
  const ridReply = () => { if (decoy) return 'Which area first? How many boxes?'; const a = ridAsks(); return a.length ? `Got it. ${a.join(' ')}` : `On it. ${ROUTE[F.route][1].split(',')[0]}.`; };
  while (true) {
    attempt++;
    const r1 = await compose('c');
    if (r1 !== 'decoy') await compose('r');
    const custTxt = decoy ? DECOY : textOf('c'), ridTxt = decoy ? DECOY : textOf('r');
    const words = s => new Set(String(s).toLowerCase().match(/[a-z]+/g) || []); const a = words(custTxt), bb = words(ridTxt); const overlap = [...a].filter(w => bb.has(w)).length / Math.max(1, Math.min(a.size, bb.size));
    const jargon = facts.filter(f => pick.c[f.k] === 'rid').length, plainForRiders = facts.filter(f => pick.r[f.k] === 'fam').length;
    G.promise = decoy || !pick.c.when ? null : F.when === '35' ? { kind: 'mins', v: 35 } : F.when === '60' ? { kind: 'mins', v: 60 } : F.when === '1130' ? { kind: 'clock', v: 23 * 60 + 30 } : { kind: 'clock', v: 24 * 60 };
    G.msgs = { customer: custTxt, rider: ridTxt, facts: F, whenText: WHEN[F.when][0] };
    const custFit = !decoy && !!pick.c.when && !jargon, ridFit = !decoy && !ridAsks().length;
    log('messages', { attempt, customer_lines: { ...pick.c }, rider_lines: { ...pick.r }, friendly: { ...fr }, overlap_ratio: Math.round(overlap * 100) / 100, decoy_used: decoy, jargon_to_families: jargon, plain_to_riders: plainForRiders, customer_fit: custFit, rider_fit: ridFit, promise: G.promise });
    const cc = chatBox('anya', 'Anya’s family', 'cust'), rc = chatBox('kabir', 'Riders · Kabir', 'rid');
    const again = btn('Change our messages', 'ghost'), go = btn('Start Shift 2', 'teal'); again.style.visibility = go.style.visibility = 'hidden';
    guide(() => go.style.visibility === 'visible' ? { el: go.parentNode, text: 'Happy with how they heard you? Or change the messages', id: 's7_after' } : null);
    screen(h('div', { class: 'center', style: { gap: '22px' } }, head('Same facts, two audiences', 'How each audience heard you', null), h('div', { class: 'row', style: { gap: '50px', flexWrap: 'nowrap', alignItems: 'stretch' } }, cc.el, rc.el), h('div', { class: 'row' }, again, go)));
    popIn(cc.el); popIn(rc.el, .1); await wait(400);
    await Promise.all([
      (async () => { await cc.msg(brief(custTxt), { side: 'out' }); await cc.msg(famReply(), { delay: 900 }); })(),
      (async () => { await wait(300); await rc.msg(brief(ridTxt), { side: 'out' }); await rc.msg(ridReply(), { delay: 1100 }); })(),
    ]);
    again.style.visibility = go.style.visibility = 'visible'; go.classList.add('pulse'); gsap.from([again, go], { scale: .7, opacity: 0, duration: .35, ease: 'back.out(2)' });
    const next = await new Promise(r => { tap(go, () => { sfx.select(); r('go'); }); tap(again, () => { sfx.select(); r('again'); }); });
    if (next === 'go') break;
    decoy = false;
  }
  hud(true); $('#barSign').classList.remove('hide');
}

/* ================= 8 · Shift 2 ================= */
export async function s8() {
  ensureDefaults(); if (!G.bar2) G.bar2 = { kind: 2, when: 'midnight', arrive: 'warm', custom2: 'we tell people the real time', links: {}, set: true };
  clearScreen(); hud(true); setBarSign(barText(G.bar2), false); $('#reviews').innerHTML = ''; K3.setCam('play', 1.4); G.sharedRiders = true;
  const carry = leftovers(); let no = 100; const extra = 8 - carry.length;
  for (let i = 0; i < extra; i++) carry.push({ no: no++, area: ['far', 'mid', 'near', 'far', 'mid', 'near', 'mid', 'far'][i], items: G.menu.slice(), stage: 'disp', t: { created: -10 - i * 2, cookDone: -6 }, packed: G.menu.slice(), missing: [], waits: {} });
  const simplifyDrop = G.replan.includes('simplify') ? [...G.menu].sort((a, b) => DISHES[b].cook - DISHES[a].cook)[0] : null;
  if (G.replan.includes('move')) G.permHelp.disp = true;
  await say('meher', 'Ninety minutes to midnight. Same jobs, new plan, new bar. Let’s see how it works.', { button: 'Start the final rush' });
  await new Promise(res => {
    startShift({ shift: 2, n: 30, startMin: 22 * 60 + 30, minutes: 90, msPerMin: 4000, riders: 6, carry, batch: G.replan.includes('batch'), pickup: G.replan.includes('pickup'), pauseUntil: G.replan.includes('pause') ? 10 : 0, simplify: !!simplifyDrop, dropDish: simplifyDrop, firstNo: 40, seed: 23, onEnd: res });
    Object.keys(G.permHelp).forEach(k => { const S = currentShift(); S.help[k] = true; const b = document.querySelector(`#help-${k}`); b && b.classList.add('on'); if (k === 'cook') S.burnerN = 4; S.zonesDirty[k] = 1; });
  });
  zones(false); G.stats.s2 = shiftStats(2); $('#tickets').innerHTML = '';
}

/* ================= 9 · Justify ================= */
/* what happened to the thing we changed? (closes the prototype loop, honestly: Shift 2 changed other things too) */
function effectLines(s1, s2) {
  const L = [], c1 = s1.counts, c2 = s2.counts, ch = G.change1;
  if (ch) {
    if (ch.kind === 'dish') { const o = ch.detail.out, i = ch.detail.in; L.push(`We swapped ${DISHES[o].name} for ${DISHES[i].name}.`);
      if (o === 'fries') L.push(`Soggy-fries reviews: ${s1.tally.soggy} in Shift 1 → ${s2.tally.soggy} in Shift 2.`);
      else if (o === 'cake') L.push(`Squashed-cake reviews: ${s1.tally.squashed} → ${s2.tally.squashed}.`);
      else if (o === 'raita') L.push(`Warm-raita reviews: ${s1.tally.raitaWarm} → ${s2.tally.raitaWarm}.`);
      else L.push(`Average wait at Cook: ${Math.round(s1.waits.cook)} min → ${Math.round(s2.waits.cook)} min.`); }
    if (ch.kind === 'packaging') { L.push(`We changed ${PACKS[ch.detail.from].name.toLowerCase()} to ${PACKS[ch.detail.to].name.toLowerCase()}.`); L.push(`Arrived hot: ${c1.hot} of ${c1.n} → ${c2.hot} of ${c2.n}.`); }
    if (ch.kind === 'balance') { const k = ch.detail.station; L.push(`We gave ${STATIONS.find(s => s.k === k).name} an extra helper.`); L.push(`Average wait there: ${Math.round(s1.waits[k])} min → ${Math.round(s2.waits[k])} min.`); }
    if (ch.kind === 'bar') L.push(`We rewrote the bar: “${ch.detail.from}” → “${ch.detail.to}”.`);
  }
  return L;
}
function promiseLine(s2) { return G.promise ? `We told families: ${G.msgs.whenText}. Came when we said: ${s2.counts.promise} of ${s2.counts.promiseOf}.` : 'We didn’t give families a time.'; }
const boxIcons = bx => h('div', { class: 'row', style: { gap: '6px' } }, bx.menu.map(d => img(DISHES[d].img, '', { style: 'width:56px' })), img(PACKS[bx.pack].img, '', { style: 'width:56px' }));
export async function s9() {
  ensureDefaults(); hud(false); zones(false); K3.setCam('plan', 1.2);
  const s1 = G.stats.s1 || shiftStats(1), s2 = G.stats.s2 || shiftStats(2), c2 = s2.counts;
  const eff = effectLines(s1, s2); G.effect = eff;
  log('change_effect', { lines: eff, promise: promiseLine(s2) });
  // a shared look-back before the turns
  await new Promise(res => {
    const go = btn('Start the turns', 'teal pulse', res);
    const card = h('div', { class: 'glass lookback' },
      h('div', { class: 'eyebrow' }, 'Our box'), h('div', { class: 'row', style: { gap: '18px' } }, boxIcons(G.box1 || G.box2), h('span', { class: 'dot' }, '→'), boxIcons(G.box2 || G.box1)),
      h('div', { class: 'eyebrow' }, 'What happened to our change'), ...(eff.length ? eff : ['We didn’t change one thing in Step 5.']).map(t => h('div', { class: 'lb' }, t)),
      h('div', { class: 'lb muted' }, 'Other things changed in Shift 2 too: fewer riders, a new plan.'),
      h('div', { class: 'eyebrow' }, 'Our promise'), h('div', { class: 'lb' }, promiseLine(s2)));
    guide(() => ({ el: go, text: 'Look together, then tap here', id: 's9_look' }));
    screen(panel(head(null, 'What did our changes do?', null), card, h('div', { class: 'row' }, go)));
    popIn(card);
  });
  const changes = [];
  if (G.change1) changes.push({ id: 'c1', text: { dish: 'We swapped a food', packaging: 'We changed the box', balance: 'We gave a station an extra helper', bar: 'We changed the bar' }[G.change1.kind], tag: G.change1.kind });
  (G.replan || []).forEach(r => changes.push({ id: r, text: { batch: 'We batched orders by area', pickup: 'We offered customer pickup', pause: 'We paused new orders', simplify: 'We simplified the menu', move: 'We moved a child to Dispatch' }[r], tag: r }));
  changes.push({ id: 'bar2', text: `We changed the bar to “${barText(G.bar2).split(' · ')[0]}”`, tag: 'bar' });
  // general Shift 1 counts are left out here: the new-bar and change-effect clues below cover them
  const evs = evidenceChips(s1, [
    { id: 'riders', text: 'Riders went from 12 to 6', img: 'ico_rider', tags: ['batch', 'pickup', 'pause', 'move', 'bar', 'simplify'] },
    { id: 'midclue', text: '“Just make it before midnight”', img: 'clue_midnight', tags: ['bar'] },
    { id: 's2ontime', text: `Shift 2: ${c2.dueOnTime} of ${c2.due} orders on time by our new bar`, img: 'emo_party', tags: ['bar', 'batch', 'pickup', 'pause', 'simplify', 'move', 'dish', 'packaging', 'balance'] },
    ...eff.slice(1).map((t, i) => ({ id: 'eff' + i, text: t, img: 'ico_template', tags: [G.change1?.kind] })),
  ]).filter(e => e.id !== 'ontime' && e.id !== 'hot');
  await turns(p => new Promise(res => {
    G.onSkip = () => res('skip');
    let c = null, e = null; const go = btn('Pick a change and a reason', 'teal', () => res()); go.disabled = true;
    const sent = h('div', { class: 'sentence', style: { fontSize: '34px', minHeight: '60px' } }, '…');
    const upd = () => { sent.textContent = c && e ? `${c.text} because ${reason(e)}.` : c ? `${c.text} because …` : '…'; go.disabled = !(c && e); go.classList.toggle('pulse', !go.disabled); go.textContent = go.disabled ? 'Pick a change and a reason' : 'I said it out loud'; };
    const cs = changes.map(x => { const b = h('button', { class: 'chip' }, x.text); tap(b, () => { c = x; cs.forEach(y => y.classList.toggle('on', y === b)); sfx.tick(); upd(); }); return b; });
    const es = evs.map(x => { const b = h('button', { class: 'clue' }, img(x.img), x.text); tap(b, () => { e = x; es.forEach(y => y.classList.toggle('on', y === b)); sfx.tick(); upd(); }); return b; });
    tap(go, () => log('justify', { child: p.k, change_ref: c.id, evidence_ref: e.id, sentence: sent.textContent, evidence_matches_change: e.tags.includes(c.tag) }));
    const cRow = h('div', { class: 'opts' }, cs), eRow = h('div', { class: 'clues', style: { maxWidth: '1500px' } }, es);
    guide(() => !c ? { el: cRow, text: 'Tap one change your team made', id: 's9_change' } : !e ? { el: eRow, text: 'Tap the clue that shows why', id: 's9_ev' } : { el: go, text: 'Read it out loud, then tap here', id: 's9_go' });
    screen(panel(head(`${nameOf(p.k)}’s turn`, 'One change, and the clue that shows why', null), h('div', { class: 'qlab' }, '1 · The change'), cRow, h('div', { class: 'qlab' }, '2 · The clue'), eRow, sent, h('div', { class: 'row' }, go)));
  }).then(() => { sfx.coin(); fx('fx_sparkle', 960, 600, { size: 240 }); }));
}

// turn a clue chip into the end of a spoken sentence: "…because customers said “fries were soggy”."
function reason(e) {
  const raw = e.text.replace(/[“”]/g, '').replace(/\s×\d+$/, '').replace(/\.$/, '');
  if (e.id.startsWith('rv:')) return `customers said “${raw}”`;
  if (e.id === 'midclue') return `Anya said “${raw}”`;
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

/* ================= 10 · Transfer ================= */
/* same thinking frame as the kitchen: WHO is it for → WHAT do they need → what is good enough there.
   Options are shuffled (no "first one is right"), and every picture is shown beside its twin. */
export async function s10() {
  ensureDefaults(); hud(false); zones(false); K3.setCam('plan', 1.2);
  await say('meher', 'Good enough changed tonight because the night changed. Where else is that true?', { top: true });
  await turns(async p => {
    let attempt = 0;
    while (true) {
      attempt++;
      const card = await new Promise(res => {
        G.onSkip = () => res(null);
        const pool = TRANSFER.filter(t => !(attempt > 1 && t.decoy));
        const cards = pool.map(t => { const c = h('button', { class: 'pc' }, img(t.img)); tap(c, () => { sfx.select(); res(t); }); return c; });
        const row = h('div', { class: 'pcards' }, cards);
        guide(() => ({ el: row, text: 'Tap one picture', id: 's10_card' }));
        screen(panel(head(`${nameOf(p.k)}’s turn`, 'Where else does “good enough” depend on the situation?', null), row));
        stagger(cards, .05);
      });
      if (!card) return;
      const twin = TRANSFER.find(t => t.pair === card.pair && t.id !== card.id && !t.decoy);
      const whoOpts = card.decoy ? shuffle([card.who, TRANSFER.find(t => t.id === 'sandcastle').who, TRANSFER.find(t => t.id === 'house').who])
        : shuffle([card.who, twin.who, shuffle(TRANSFER.filter(t => t.pair !== card.pair && !t.decoy))[0].who]);
      // decoy: no "right" person, any pick leads to Meher's question. Real cards: gentle retry, then show who it is for.
      const whoTries = [];
      const who = await ask(card, 'Who is it for?', whoOpts, 'Think about the person, not the thing.', card.decoy ? null : card.who, whoTries);
      if (who == null) return;
      if (card.decoy) {
        log('transfer', { child: p.k, card: card.id, card_pair: 0, decoy_chosen: true, who, attempt });
        await say('meher', 'Hmm. Would “your best” look the same for a sandcastle at the beach and a real house?', { button: 'Pick another picture', mode: 'react' });
        continue;
      }
      const said = await ask(card, `For ${who}, good enough means…`, shuffle([...new Set(card.opts)]), 'Tap the one that fits this situation.');
      if (said == null) return;
      log('transfer', { child: p.k, card_pair: card.pair, card: card.id, decoy_chosen: false, who, who_matches: whoTries[0] === card.who, who_tries: whoTries, said_good_enough: said, attempt });
      // the twin: same thing, different situation, said out loud (no answer shown)
      await new Promise(res => {
        G.onSkip = () => res();
        const go = btn('We said it', 'teal pulse', res);
        guide(() => ({ el: go, text: 'Say it out loud, then tap here', id: 's10_twin' }));
        screen(panel(head('Same thing, different situation', `Now: ${twin.who}`, 'What would good enough be here? Say it out loud together.'),
          h('div', { class: 'row', style: { gap: '60px', alignItems: 'flex-start' } },
            h('div', { class: 'twin' }, img(card.img), h('b', {}, card.who), h('span', {}, said)),
            h('div', { class: 'twin q' }, img(twin.img), h('b', {}, twin.who), h('span', {}, '?'))),
          h('div', { class: 'row' }, go)));
      });
      return;
    }
  });
  // correct == null: any answer is fine. Otherwise: 1st miss = gentle nudge, 2nd miss = show the answer (SKAI retry rule).
  async function ask(card, q, opts, tip, correct = null, tries = []) {
    return new Promise(res => {
      G.onSkip = () => res(null);
      const msg = h('div', { class: 'hint', style: { minHeight: '30px' } }); let done = false;
      const ok = (b, o, text) => { done = true; b.classList.add('on'); if (text) msg.textContent = text; sfx.chime(); setTimeout(() => res(o), text ? 2600 : 700); };
      const chips = opts.map(o => { const b = h('button', { class: 'chip big' }, o); tap(b, () => { if (done || b.classList.contains('off')) return; sfx.select(); tries.push(o);
        if (correct == null) return res(o);
        if (o === correct) return ok(b, o, null);
        b.classList.add('off'); sfx.bump();
        if (tries.length === 1) msg.textContent = 'Almost! Look at the picture again. Who will use or enjoy it?';
        else ok(chips[opts.indexOf(correct)], correct, `It’s for ${correct}. Look at the picture: that’s who it is made for.`); }); return b; });
      const row = h('div', { class: 'opts', style: { flexDirection: 'column', alignItems: 'center' } }, chips);
      guide(() => ({ el: row, text: tip, id: 's10_' + q.slice(0, 8) }));
      screen(panel(head(null, q, null), img(card.img, '', { style: 'width:280px;margin:0 auto;border-radius:24px' }), row, msg));
      stagger([...row.children]);
    });
  }
}

/* ================= 11 · Midnight ================= */
export async function s11() {
  ensureDefaults(); if (!G.bar2) G.bar2 = { kind: 2, when: 'midnight', arrive: 'warm', custom2: 'we tell people the real time', links: {}, set: true };
  clearScreen(); hud(false); zones(false); dim(false); unguide(); K3.setCam('window', 2.4);
  await wait(1200);
  const n = h('div', { class: 'count' }, '10'); screen(h('div', { class: 'center' }, n));
  for (let i = 10; i >= 1; i--) { n.textContent = i; gsap.fromTo(n, { scale: 1.4, opacity: 0 }, { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2)' }); sfx.tock(); if (i <= 3) K3.burstFirework(undefined, undefined, i); await wait(850); }
  n.textContent = 'Happy New Year!'; n.style.fontSize = '150px'; sfx.fanfare(); log('midnight', {});
  const fw = setInterval(() => { K3.burstFirework(); }, 700);
  for (let i = 0; i < 6; i++) setTimeout(() => fx('fx_confetti', 200 + i * 300, 300, { size: 300, fps: 6, loops: 3 }), i * 150);
  await wait(3600);
  const s1 = G.stats.s1 || shiftStats(1), s2 = G.stats.s2 || shiftStats(2), b = G.bar2;
  K3.setCam('plan', 1.6);
  // judge the night by the team's own (new) bar
  const marks = await judgeScreen({ lines: barLines(b, s2, 2), eyebrow: 'Midnight', title: 'By your own bar, how did the night go?', side: null, logEv: 'bar2_judged', button: 'See our whole night', why: false });
  // the whole night on one screen
  await new Promise(res => {
    const go = btn('What we did tonight', 'teal pulse', res);
    const photos = h('div', { class: 'photos', style: { gridTemplateColumns: '200px' } }, PHOTOS.slice(0, 2).map(p => img(p, '', { style: 'width:200px' })));
    const card = h('div', { class: 'glass nightcard' },
      h('div', { class: 'eyebrow' }, 'Our bar'), h('div', { class: 'oldbar' }, (G.bar1 || {}).text || barText(G.bar)), h('div', { class: 'barnow' }, barText(b)),
      h('div', { class: 'eyebrow' }, 'Our box'), h('div', { class: 'row', style: { gap: '14px', justifyContent: 'flex-start' } }, boxIcons(G.box1 || G.box2 || { menu: G.menu, pack: G.pack }), h('span', { class: 'dot' }, '→'), boxIcons(G.box2 || G.box1 || { menu: G.menu, pack: G.pack })),
      h('div', { class: 'eyebrow' }, 'Our promise'), h('div', { class: 'lb' }, promiseLine(s2)));
    guide(() => ({ el: go, text: 'Tap when you’ve looked', id: 's11_night' }));
    screen(h('div', { class: 'center', style: { flexDirection: 'row', gap: '40px', alignItems: 'center', justifyContent: 'center' } }, photos, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' } }, card, go)));
    gsap.from(photos.children, { scale: .6, opacity: 0, rotate: () => (Math.random() - .5) * 20, duration: .6, stagger: .15, ease: 'back.out(1.6)' }); popIn(card, .4);
  });
  // recap: what you did → what you found → what you learned. Every "did" line is true for THIS team, every
  // "found" line is their own data, and the team says the takeaway out loud BEFORE Meher's words appear.
  const helpN = (s1.helps?.length || 0) + (s2.helps?.length || 0), sentDecoy = G.msgs?.customer === DECOY;
  await new Promise(res => {
    const go = btn('Next: what did we learn?', 'teal pulse', res);
    const did = [['clue_party', 'Set your own bar from customer clues'], ['emo_ok', 'Judged it and changed one thing'],
      helpN ? ['ico_highfive', `Jumped in to help ${helpN} time${helpN > 1 ? 's' : ''}`] : null,
      ['ico_rider', 'Changed the plan and the bar when riders went home'],
      sentDecoy ? ['anya_phone', 'Messaged families and riders, and read how each heard it'] : ['anya_phone', 'Told families and riders the same facts in different words']];
    const c1 = s1.counts || {}, c2 = s2.counts;
    const found = [c1.due ? `Shift 1: ${c1.dueOnTime} of ${c1.due} orders on time by your first bar.` : null, c2.due ? `Shift 2: ${c2.dueOnTime} of ${c2.due} orders on time by your new bar.` : null, (G.effect || [])[1] || null].filter(Boolean);
    if (!found.length) found.push('Your bar changed when the night changed.');
    const list = h('div', { class: 'didlist' }, h('div', { class: 'eyebrow' }, 'What you did'), ...did.filter(Boolean).map(([i, t]) => h('div', { class: 'rv' }, img(i), t)),
      h('div', { class: 'eyebrow', style: { marginTop: '8px' } }, 'What you found'), ...found.map(t => h('div', { class: 'rv' }, img('ico_template'), t)));
    guide(() => ({ el: go, text: 'Read it together, then tap here', id: 's11_did' }));
    screen(panel(head(null, 'What a night!', null), list, h('div', { class: 'row' }, go)));
    stagger([...list.children], .08);
  });
  await new Promise(res => {
    const said = btn('We said it out loud', 'teal pulse');
    const fin = btn('Happy New Year!', 'pulse', res); fin.style.display = 'none';
    const meher = h('div', { class: 'kidnote', style: { display: 'none' } }, h('span', { html: '<b>Meher Didi’s words:</b> Good enough isn’t perfect. It’s what the people you serve need, right now.' }));
    const life = h('div', { class: 'sub', style: { display: 'none', maxWidth: '1150px' } }, 'Next time you make something, like a project, a card or a meal, ask: who is it for, and what do they need?');
    tap(said, () => { sfx.chime(); log('takeaway_said', {}); said.style.display = 'none'; [meher, life].forEach(e => { e.style.display = ''; popIn(e); }); fin.style.display = ''; });
    guide(() => said.style.display !== 'none' ? { el: said, text: 'Say it together, then tap here', id: 's11_say' } : { el: fin, text: 'Tap to finish', id: 's11_end' });
    screen(panel(head(null, 'Finish this sentence together, out loud:', null), h('div', { class: 'sentence', style: { fontSize: '54px' } }, '“Good enough means …”'), meher, life, h('div', { class: 'row' }, said, fin)));
  });
  clearScreen();
  const note = img('ui_thanks', '', { style: 'position:absolute;left:50%;top:180px;width:300px;transform:translateX(-50%) rotate(-6deg)' }); $('#screen').append(note); popIn(note);
  K3.setCam('window', 1.6);
  await say('kabir', s2.counts.dueOnTime >= s2.counts.due * .8 ? 'Thanks, team. Safe, and before midnight.' : 'Thanks, team. Everyone got home safe. Some boxes were late, and you told people the truth.', { mode: 'react' });
  await say('meher', 'Our name was on every box tonight. You decided what that meant.', { mode: 'react', button: 'Happy New Year!' });
  log('mission_end', { deliveries: (s1.counts?.n || 0) + s2.counts.n, on_time_vs_bar2: `${s2.counts.dueOnTime} of ${s2.counts.due}`, bar2_marks: marks });
  setTimeout(() => clearInterval(fw), 8000);
}

export const STAGES = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];
export const STAGE_NAMES = ['Kitchen opens', 'Party box', 'Tonight’s bar', 'Shift 1', 'Check the bar', 'Rider crisis', 'Re-plan', 'Shift 2', 'Justify', 'Transfer', 'Midnight'];

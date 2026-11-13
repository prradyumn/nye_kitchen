// The live kitchen: order simulation + the four station zones (one-device mode: four touch zones).
import { G, log, fmtClock, toMidnight, barText, nameOf } from './state.js';
import { DISHES, PACKS, AREAS, STATIONS } from './data.js';
import { $, h, img, tap, fx, fxAt, flyImg, centerOf, A } from './ui.js';
import { sfx } from './sfx.js';
import * as K3 from './scene3d.js';

const AREA_P = [['near', .35], ['mid', .4], ['far', .25]];
let S = null; // current shift
// practice orders never reach the evidence log
const L = (ev, d) => (S && S.cfg.practice) ? null : log(ev, d);

export function shiftActive() { return !!S && S.running; }
export function currentShift() { return S; }

export function startShift(cfg) {
  // cfg: { n, startMin, minutes, msPerMin, riders, carry:[orders], extra, onEnd }
  const rnd = mulberry(cfg.seed || 7);
  const orders = [], spawn = [];
  const menu = G.menu.filter(d => !(cfg.dropDish && d === cfg.dropDish));
  let no = cfg.firstNo || 1;
  const pause = cfg.pauseUntil || 0;
  for (let i = 0; i < cfg.n; i++) {
    let t = i < 2 ? .4 + i * 1.2 : (i / cfg.n) * cfg.minutes * .92 + rnd() * 1.6;
    if (t < pause) continue;
    let r = rnd(), area = 'near'; for (const [a, p] of AREA_P) { if (r < p) { area = a; break; } r -= p; }
    spawn.push({ t, area });
  }
  if (cfg.desaiAt != null) spawn.push({ t: cfg.desaiAt, area: 'far', desai: true });
  spawn.sort((a, b) => a.t - b.t);
  S = { cfg, t: 0, running: true, orders, spawn, menu, nextNo: () => no++, rnd,
    riders: { total: cfg.riders, free: cfg.riders, out: [] }, burners: [], burnerN: 3,
    zonesDirty: { prep: 1, cook: 1, pack: 1, disp: 1 }, redSince: {}, help: {}, helpIdle: {}, packWork: null, sel: new Set(), delivered: [],
    lastAct: {}, acts: {}, avail: {}, nudged: {}, nudgeN: { prep: 0, cook: 0, pack: 0, disp: 0 } };
  for (let i = 0; i < 4; i++) S.burners.push({ order: null, state: 'off', start: 0, burnAt: 0 });
  // carried orders (e.g., the pile at the door after the crisis)
  (cfg.carry || []).forEach(o => { o.stage = 'disp'; o.t.dispIn = 0; o.t.created = Math.min(o.t.created ?? 0, 0); S.orders.push(o); });
  buildZones();
  K3.setRiders(S.riders.free, S.riders.total);
  updateRidersHud();
  return S;
}
export function stopShift() { if (S) S.running = false; }

function newOrder(sp) {
  const o = { no: S.nextNo(), area: sp.area, desai: !!sp.desai, items: S.menu.slice(), stage: 'prep', chops: 0, t: { created: S.t }, packed: [], pickup: false };
  o.prepNeed = Math.max(1, o.items.reduce((s, d) => s + DISHES[d].prep, 0) - (S.cfg.simplify ? 1 : 0));
  o.cookMin = Math.max(1, Math.max(...o.items.map(d => DISHES[d].cook)) * (S.cfg.simplify ? .7 : 1));
  if (S.cfg.pickup && o.area === 'near' && S.rnd() < .5) o.pickup = true;
  S.orders.push(o); S.zonesDirty.prep = 1; sfx.tick();
  return o;
}
export function practiceOrder() { return newOrder({ area: 'near' }); }
function act(k) { S.lastAct[k] = performance.now(); S.acts[k] = (S.acts[k] || 0) + 1; }
function q(stage) { return S.orders.filter(o => o.stage === stage); }

/* ---------------- tick ---------------- */
export function tickShift(dtMs) {
  if (!S || !S.running || G.paused) return;
  const dMin = dtMs / S.cfg.msPerMin * (G.speed || 1);
  S.t += dMin;
  while (S.spawn.length && S.spawn[0].t <= S.t) newOrder(S.spawn.shift());
  // burners
  S.burners.forEach((b, i) => {
    if (!b.order) return;
    if (b.state === 'cook' && S.t >= b.start + b.order.cookMin) { b.state = 'done'; b.order.t.cookDone = S.t; b.burnAt = S.t + 3; S.zonesDirty.cook = 1; sfx.chime(); }
    else if (b.state === 'done' && S.t >= b.burnAt && !S.cfg.practice) { b.state = 'burnt'; S.zonesDirty.cook = 1; sfx.bump(); L('burnt_item', { order: b.order.no, shift: S.cfg.shift }); b.burntT = S.t; const el = document.querySelector(`#bn${i}`); if (el) fxAt('fx_smoke', el, { size: 140, fps: 6, loops: 3 }); }
    else if (b.state === 'burnt' && S.t >= b.burntT + 1600 / S.cfg.msPerMin) { const o = b.order; o.stage = 'prep'; o.chops = 0; o.remade = true; b.order = null; b.state = 'off'; S.zonesDirty.cook = S.zonesDirty.prep = 1; }
    K3.setBurner(i, b.state, 0);
  });
  // pickup orders collect themselves 10 min after packing
  q('pickup').forEach(o => { if (S.t >= o.t.packDone + 10) deliver(o, S.t, 0); });
  // riders return / deliveries arrive
  S.riders.out = S.riders.out.filter(r => {
    r.orders.forEach(o => { if (!o.arrived && S.t >= o.t.arrive) { o.arrived = true; deliver(o, o.t.arrive, r.travel); } });
    if (S.t >= r.back) { S.riders.free++; updateRidersHud(); K3.setRiders(S.riders.free, S.riders.total); S.zonesDirty.disp = 1; return false; }
    return true;
  });
  // backlog + red tracking, helper idle return
  for (const st of STATIONS) {
    const n = backlog(st.k), el = document.querySelector(`#z-${st.k}`);
    if (el) { const f = Math.min(1, n / 8), bar = el.querySelector('.backlog i'); bar.style.width = (f * 100) + '%'; bar.style.background = n >= 7 ? '#E8503A' : n >= 4 ? '#F4A51C' : '#8BC34A'; el.querySelector('.backlog .n').textContent = n ? `${n} waiting` : '';
      const red = n >= 7; if (red && !S.redSince[st.k]) S.redSince[st.k] = performance.now(); if (!red) S.redSince[st.k] = 0; el.classList.toggle('red', red && !S.help[st.k]); }
    if (S.help[st.k] && n === 0) { S.helpIdle[st.k] = (S.helpIdle[st.k] || 0) + dtMs; if (S.helpIdle[st.k] > 9000) toggleHelp(st.k, false); } else S.helpIdle[st.k] = 0;
  }
  if (S.burnerN === 4 && !S.help.cook && !G.permHelp.cook && !S.burners[3].order) { S.burnerN = 3; S.zonesDirty.cook = 1; }
  for (const k in S.zonesDirty) if (S.zonesDirty[k]) { renderZone(k); S.zonesDirty[k] = 0; }
  updateLive();
  K3.setStacks(q('pack').length, q('disp').length);
  // HUD
  const now = S.cfg.practice ? S.cfg.startMin : S.cfg.startMin + S.t; const [c, ap] = fmtClock(now);
  $('#clock .t').innerHTML = `${c}<small>${ap}</small>`; $('#clock .cd').textContent = `${toMidnight(now)} to midnight`;
  renderTickets();
  // end
  if (S.t >= S.cfg.minutes) { S.running = false; L('zone_nudges', { shift: S.cfg.shift, counts: { ...S.nudgeN } }); S.cfg.onEnd && S.cfg.onEnd(S); }
}
function backlog(k) {
  if (k === 'prep') return q('prep').length;
  if (k === 'cook') return q('cook').length + S.burners.filter(b => b.state === 'done' || b.state === 'burnt').length;
  if (k === 'pack') return q('pack').length;
  return q('disp').length;
}

/* ---------------- delivery + reviews ---------------- */
function deliver(o, at, travel) {
  o.stage = 'done'; o.t.arrive = at;
  const total = at - o.t.created; const kitchenWait = (o.t.depart ?? at) - (o.t.cookDone ?? o.t.created);
  const pk = PACKS[G.pack]; const hotDishes = o.items.filter(d => DISHES[d].hot);
  const factor = hotDishes.length ? Math.max(...hotDishes.map(d => DISHES[d].loss)) : 0;
  const heat = hotDishes.length ? 100 - kitchenWait * 1.2 * pk.loss - travel * 2 * factor * pk.loss : 100;
  const soggy = o.items.includes('fries') && (kitchenWait + travel) > (G.pack === 'insulated' ? 25 : 15);
  const squashed = o.items.includes('cake') && G.pack === 'carton';
  const raitaWarm = o.items.includes('raita') && (kitchenWait + travel) > 20 && G.pack !== 'insulated';
  const missing = o.missing || [];
  const clockAt = S.cfg.startMin + at;
  const b = S.cfg.shift === 2 && G.bar2 ? G.bar2 : G.bar;
  const limit = b.when === 'midnight' ? Infinity : b.min;
  const onTime = S.cfg.shift === 2 && b.when === 'midnight' ? clockAt <= 24 * 60 : total <= limit;
  const promiseKept = G.promise == null || S.cfg.shift !== 2 ? null : (G.promise.kind === 'mins' ? total <= G.promise.v : clockAt <= G.promise.v);
  const r = { no: o.no, shift: S.cfg.shift, area: o.area, desai: o.desai, total, heat, hot: heat >= 60, warm: heat >= 35, correct: !missing.length, soggy, squashed, raitaWarm, onTime, promiseKept, clockAt, pickup: o.pickup,
    dessertOk: o.items.some(d => DISHES[d].dessert) ? !squashed && !missing.some(d => DISHES[d].dessert) : null, waits: o.waits || {} };
  // pick a describing review (never a rating)
  let e = 'emo_hot', txt = 'lovely, thank you';
  if (missing.length) { e = 'emo_down'; txt = `missing ${DISHES[missing[0]].name.toLowerCase()}`; }
  else if (squashed) { e = 'emo_down'; txt = 'cake was squashed'; }
  else if (promiseKept === false) { e = 'emo_wait'; txt = 'later than you told us'; }
  else if (!onTime && limit !== Infinity) { e = 'emo_wait'; txt = `took ${Math.round(total)} minutes`; }
  else if (soggy) { e = 'emo_ok'; txt = 'fries were soggy'; }
  else if (hotDishes.length && heat < 35) { e = 'emo_ok'; txt = 'food was cold'; }
  else if (raitaWarm) { e = 'emo_ok'; txt = 'raita was warm'; }
  else if (o.desai && clockAt <= 22 * 60) { e = 'emo_party'; txt = 'just in time for the party!'; }
  else if (S.cfg.shift === 2 && clockAt > 23.5 * 60) { e = 'emo_party'; txt = 'just in time for the countdown'; }
  else if (promiseKept) { e = 'emo_hot'; txt = 'came when you said'; }
  else if (r.dessertOk) { e = 'emo_party'; txt = 'kids loved dessert'; }
  else if (heat >= 60 && hotDishes.length) { e = 'emo_hot'; txt = 'still hot!'; }
  if (o.pickup && e === 'emo_hot') txt = 'easy pickup, still warm';
  if (S.cfg.practice) { e = 'emo_hot'; txt = 'practice box arrived, thank you!'; }
  r.emoji = e; r.text = txt;
  S.delivered.push(r); if (!S.cfg.practice) G.reviews.push(r);
  postReview(r);
}
export function postReview(r) {
  const box = $('#reviews'); if (!box) return;
  const el = h('div', { class: 'rv' }, img(r.emoji), h('div', {}, r.text, h('small', {}, `#${r.no} · ${r.pickup ? 'pickup' : AREAS[r.area].name}${r.desai ? ' · Desai family' : ''}`)));
  box.prepend(el); while (box.children.length > 5) box.lastChild.remove();
  gsap.from(el, { x: 80, opacity: 0, duration: .45, ease: 'back.out(1.7)' });
  const [x, y] = centerOf(el); fx('fx_pop', x - 175, y, { size: 80, fps: 12 }); sfx.pop();
}

/* ---------------- rider dispatch ---------------- */
function send(orders) {
  if (!orders.length || S.riders.free <= 0) return;
  const area = orders[0].area, travel = AREAS[area].min + (orders.length - 1) * 3;
  S.riders.free--; orders.forEach((o, i) => { o.stage = 'out'; o.t.depart = S.t; o.t.arrive = S.t + AREAS[area].min + i * 3; });
  S.riders.out.push({ orders, travel, back: S.t + travel * 2 - (orders.length - 1) * 3 });
  L('dispatch', { shift: S.cfg.shift, orders: orders.map(o => o.no), area, batch: orders.length });
  sfx.whoosh(); updateRidersHud(); K3.setRiders(S.riders.free, S.riders.total);
  S.sel.clear(); S.zonesDirty.disp = 1;
}
export function updateRidersHud() {
  const el = $('#riders'); if (!el) return; el.innerHTML = '';
  const shown = G.sharedRiders || (S && S.cfg.shift === 1);
  el.append(img('ico_rider'), h('span', {}, !S ? (shown ? '6 riders on shift' : 'Riders: ask Dispatch') : shown ? `${S.riders.free} of ${S.riders.total} riders free` : 'Riders: ask Dispatch'));
}

/* ---------------- zones ---------------- */
function buildZones() {
  const z = $('#zones'); z.innerHTML = ''; z.classList.remove('hide');
  STATIONS.forEach(st => {
    const help = h('button', { class: 'help', id: `help-${st.k}` }, img('ico_help'), 'HELP');
    tap(help, () => toggleHelp(st.k));
    const el = h('div', { class: 'zone', id: `z-${st.k}`, style: { '--zc': st.col } },
      h('div', { class: 'zh' }, img(st.icon, 'ic'), h('div', { class: 'nm' }, h('b', {}, st.name), G.three && st.k === 'prep' ? h('span', {}, `run by ${nameOf('cook')}`) : null), help),
      h('div', { class: 'backlog' }, h('div', { class: 'b' }, h('i')), h('span', { class: 'n' }, '0 waiting')),
      h('div', { class: 'zb' }), h('div', { class: 'znudge' }, h('span')));
    z.append(el);
  });
  gsap.from('.zone', { y: 80, opacity: 0, duration: .55, stagger: .08, ease: 'back.out(1.4)' });
}
export function toggleHelp(k, force) {
  const on = force ?? !S.help[k]; S.help[k] = on;
  const b = document.querySelector(`#help-${k}`); if (b) b.classList.toggle('on', on);
  const zone = document.querySelector(`#z-${k}`);
  zone?.querySelector('.helper')?.remove(); zone?.querySelector('.whohelp')?.remove();
  if (on) {
    const n = backlog(k); const red = S.redSince[k] ? Math.round(performance.now() - S.redSince[k]) : null;
    const prompted = performance.now() - G.lastPrompt < 60000;
    const rec = { shift: S.cfg.shift, to: k, backlog_at_jump: n, ms_red_to_help: red, unprompted: !prompted, child: 'unknown' };
    const helper = h('div', { class: 'helper' }, img('ico_highfive'), 'helping');
    zone.append(helper);
    if (force === undefined && !S.cfg.practice) {
      // one-device play: anyone can tap anywhere, so ask who moved (auto-closes; never blocks the rush)
      let done = false; const fin = who => { if (done) return; done = true; rec.child = who; picker.remove(); if (who !== 'unknown') helper.lastChild.textContent = `${nameOf(who)} helping`; L('help_jump', rec); if (S.cfg.shift) G.helps.push(rec); };
      const picker = h('div', { class: 'whohelp' }, h('span', {}, 'Who is helping?'), STATIONS.filter(st => st.k !== k && !(G.three && st.k === 'prep')).map(st => { const b = h('button', {}, nameOf(st.k)); tap(b, () => fin(st.k)); return b; }));
      zone.append(picker); setTimeout(() => fin('unknown'), 5000);
    } else { L('help_jump', rec); if (S.cfg.shift && force === undefined) G.helps.push(rec); }
    fxAt('fx_ripple', zone, { size: 260, fps: 10 }); sfx.chime();
    if (k === 'cook') S.burnerN = 4;
  }
  S.zonesDirty[k] = 1;
}
const put = (el, ...k) => el.append(...k.filter(x => x != null && x !== false));
function renderZone(k) {
  const body = document.querySelector(`#z-${k} .zb`); if (!body) return; body.innerHTML = '';
  ({ prep: zPrep, cook: zCook, pack: zPack, disp: zDisp })[k](body);
}
const ths = o => h('div', { class: 'ths' }, o.items.map(d => img(DISHES[d].img)));
const areaTag = o => h('span', { class: `ar ${o.area}` }, o.pickup ? 'Pickup' : AREAS[o.area].name);
function oc(o, extra) { return h('div', { class: 'oc' }, h('b', {}, `#${o.no}`), ths(o), extra || areaTag(o)); }
function minis(list, onTap, selId) { return h('div', { class: 'queue' }, list.slice(0, 8).map(o => { const m = h('button', { class: 'mini' + (selId === o.no ? ' sel' : '') }, `#${o.no}`, h('i', { class: `ar ${o.area}` })); if (onTap) tap(m, () => onTap(o, m)); return m; }), list.length > 8 ? h('span', { class: 'mini' }, `+${list.length - 8}`) : null); }

function zPrep(body) {
  const list = q('prep');
  if (!list.length) { body.append(h('div', { class: 'empty' }, h('div', {}, img('ing_veg', 'wm')))); return; }
  const o = list[0]; const need = S.help.prep ? Math.ceil(o.prepNeed / 2) : o.prepNeed;
  const dots = h('div', { class: 'dots' }, Array.from({ length: need }, (_, i) => h('i', { class: i < o.chops ? 'on' : '' })));
  const veg = img('ing_veg', 'veg');
  const board = h('button', { class: 'board act' }, dots, veg, h('div', { class: 'tap' }, o.remade ? 'Remake! Tap to chop' : 'Tap to chop'));
  tap(board, () => {
    if (o.stage !== 'prep') return;
    o.chops++; act('prep'); sfx.clack(); K3.chop(); gsap.fromTo(veg, { scale: .82, rotate: -8 }, { scale: 1, rotate: 0, duration: .25, ease: 'back.out(3)' });
    const [x, y] = centerOf(board); fx('fx_sparkle', x + (Math.random() - .5) * 120, y - 40, { size: 90, fps: 14 });
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i < o.chops));
    if (o.chops >= need) { o.stage = 'cook'; o.t.cookIn = S.t; (o.waits ||= {}).prep = S.t - o.t.created; flyImg(DISHES[o.items[0]].img, board, '#z-cook', { size: 90 }); S.zonesDirty.prep = S.zonesDirty.cook = 1; }
  });
  put(body, oc(o), board, list.length > 1 ? minis(list.slice(1)) : null);
}
function zCook(body) {
  const N = S.burnerN; const grid = h('div', { class: 'burners' + (N === 4 ? ' four' : '') });
  for (let i = 0; i < N; i++) {
    const b = S.burners[i]; const el = h('button', { class: 'bn', id: `bn${i}` });
    const C = 2 * Math.PI * 46;
    el.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="7"/><circle class="pr" cx="50" cy="50" r="46" fill="none" stroke="#F4A51C" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 ${C}"/></svg>`;
    if (b.order) { el.append(img(b.state === 'burnt' ? 'dish_burnt' : DISHES[b.order.items[0]].img, 'di'), h('span', { class: 'no' }, `#${b.order.no}`)); el.classList.toggle('done', b.state === 'done'); el.classList.toggle('burnt', b.state === 'burnt');
      if (b.state === 'done') { el.classList.add('act'); el.append(h('span', { class: 'rdy' }, 'READY · tap')); } else if (b.state === 'burnt') el.append(h('span', { class: 'rdy' }, 'burnt · remake')); }
    else { el.append(h('div', { class: 'idle' }, q('cook').length ? 'tap' : '')); if (q('cook').length && !S.burners.some((x, j) => j < N && x.state === 'done')) el.classList.add('act'); }
    tap(el, () => tapBurner(i, el));
    grid.append(el);
  }
  const wait = q('cook');
  body.append(grid, h('div', { class: 'tray' }, wait.length ? h('div', { class: 't' }, 'READY TO COOK · tap a burner') : null, minis(wait)));
}
function tapBurner(i, el) {
  const b = S.burners[i];
  if (!b.order) { const o = q('cook')[0]; if (!o) return; act('cook'); o.stage = 'cooking'; b.order = o; b.state = 'cook'; b.start = S.t; o.t.cookStart = S.t; (o.waits ||= {}).cookQ = S.t - o.t.cookIn; sfx.select(); K3.rattleLid(); fxAt('fx_sizzle', el, { size: 120, fps: 10, loops: 2 }); S.zonesDirty.cook = 1; return; }
  if (b.state === 'done' && b.order) { act('cook'); const o = b.order; o.stage = 'pack'; o.t.packIn = S.t; (o.waits ||= {}).cook = S.t - (o.t.cookIn ?? S.t); b.order = null; b.state = 'off'; sfx.coin(); fxAt('fx_sparkle', el, { size: 160 }); flyImg(DISHES[o.items[0]].img, el, '#z-pack', { size: 90 }); K3.setBurner(i, 'off'); S.zonesDirty.cook = S.zonesDirty.pack = 1; }
}
function zPack(body) {
  const list = q('pack');
  if (!list.length) { body.append(h('div', { class: 'empty' }, h('div', {}, img('box_open', 'wm')))); return; }
  const o = list[0];
  if (S.help.pack && !o.packed.length) o.packed.push(o.items[0]);
  const slots = h('div', { class: 'slots' }, o.items.map((d, i) => o.packed[i] ? img(DISHES[o.packed[i]].img) : h('span')));
  const boxEl = h('div', { class: 'packbox' }, img('box_open', 'box'), slots);
  const items = h('div', { class: 'items' }, o.items.map(d => { const btn = h('button', { class: o.packed.includes(d) ? 'used' : 'act' }, img(DISHES[d].img)); tap(btn, () => { if (o.stage !== 'pack' || o.packed.includes(d)) return; o.packed.push(d); act('pack'); sfx.pop(); flyImg(DISHES[d].img, btn, boxEl, { size: 60, dur: .35 }); S.zonesDirty.pack = 1; }); return btn; }));
  const seal = h('button', { class: 'btn small teal' + (o.packed.length === o.items.length ? ' pulse act' : '') }, 'Seal + label');
  tap(seal, () => {
    if (o.stage !== 'pack') return; act('pack');
    o.missing = o.items.filter(d => !o.packed.includes(d)); o.stage = o.pickup ? 'pickup' : 'disp'; o.t.packDone = S.t; o.t.dispIn = S.t; (o.waits ||= {}).pack = S.t - (o.t.packIn ?? S.t);
    L('sealed', { shift: S.cfg.shift, order: o.no, missing: o.missing });
    sfx.shutter(); fxAt('fx_dust', boxEl, { size: 200, fps: 12 }); flyImg('box_closed', boxEl, '#z-disp', { size: 100 }); S.zonesDirty.pack = S.zonesDirty.disp = 1;
  });
  body.append(oc(o), h('div', { class: 'packrow' }, boxEl, h('div', {}, items)), h('div', { class: 'row', style: { justifyContent: 'space-between' } }, list.length > 1 ? minis(list.slice(1)) : h('span'), seal));
}
function zDisp(body) {
  const list = q('disp'); const R = S.riders; const batch = !!S.cfg.batch; const cap = PACKS[G.pack].cap;
  const showInfo = S.cfg.shift === 1 || true; // Dispatch always sees the rider picture
  body.append(h('div', { class: 'dinfo' }, h('span', {}, 'Near 8 min'), h('span', {}, 'Mid 15 min'), h('span', {}, 'Far 24 min')));
  if (!list.length) { body.append(h('div', { class: 'empty' }, h('div', {}, img('ico_rider', 'wm')))); return; }
  const dl = h('div', { class: 'dlist' });
  list.slice(0, 4).forEach(o => {
    const waited = Math.round(S.t - (o.t.dispIn ?? S.t));
    const go = h('button', { class: 'go' + (R.free > 0 && !dl.children.length ? ' act' : ''), disabled: R.free <= 0 ? 'true' : null }, img('ico_rider'), batch && S.sel.size && S.sel.has(o.no) ? `Send ${S.sel.size}` : 'Send');
    const row = h('div', { class: 'dl' + (S.sel.has(o.no) ? ' sel' : '') }, h('b', {}, `#${o.no}`), areaTag(o), waited ? h('span', { class: 'tm' }, `${waited} min at door`) : null, go);
    if (batch) tap(row, e => { if (e.target.closest('.go')) return; const first = [...S.sel].map(n => S.orders.find(x => x.no === n))[0];
      if (S.sel.has(o.no)) S.sel.delete(o.no); else if ((!first || first.area === o.area) && S.sel.size < cap) S.sel.add(o.no); else { S.sel.clear(); S.sel.add(o.no); } sfx.tick(); S.zonesDirty.disp = 1; });
    tap(go, () => { if (R.free <= 0 || o.stage !== 'disp') return; let group = [o]; if (batch && S.sel.has(o.no)) group = [...S.sel].map(n => S.orders.find(x => x.no === n)).filter(x => x && x.stage === 'disp');
      group.forEach(g => (g.waits ||= {}).disp = S.t - (g.t.dispIn ?? S.t)); act('disp'); fxAt('fx_puff', go, { size: 110 }); send(group); });
    dl.append(row);
  });
  body.append(dl);
  if (list.length > 4) body.append(h('div', { class: 'tm', style: { font: '800 18px Nunito', color: '#A9AED6' } }, `+${list.length - 4} more at the door`));
  if (batch) body.append(h('div', { class: 'bhint' }, `Batching: tap up to ${cap} boxes for the same area, then Send.`));
}
// live station nudges: how to work YOUR station, shown when it has work and nobody has tapped for a while.
// They never mention HELP (help jumps must stay unprompted).
const NUDGE = {
  prep: () => q('prep').length ? 'Tap the board to chop!' : null,
  cook: () => S.burners.some((b, i) => i < S.burnerN && b.state === 'done') ? 'Food is ready! Tap it before it burns.' : q('cook').length && S.burners.some((b, i) => i < S.burnerN && !b.order) ? 'Tap an empty burner to start cooking.' : null,
  pack: () => { const o = q('pack')[0]; if (!o) return null; return o.packed.length < o.items.length ? 'Tap each food to put it in the box.' : 'All in? Tap Seal + label.'; },
  disp: () => q('disp').length && S.riders.free > 0 ? (S.cfg.batch ? 'Tap boxes for one area, then Send.' : 'Tap Send to give a box to a rider.') : null,
};
function updateNudges() {
  const now = performance.now();
  for (const st of STATIONS) {
    const el = document.querySelector(`#z-${st.k}`); if (!el) continue;
    const txt = NUDGE[st.k]();
    if (!txt) { S.avail[st.k] = 0; el.classList.remove('nudge'); continue; }
    if (!S.avail[st.k]) S.avail[st.k] = now;
    const urgent = /burns/.test(txt);
    const wait = S.cfg.practice ? 0 : urgent ? 2500 : (S.acts[st.k] || 0) >= 4 ? 14000 : 5000;
    const on = now - Math.max(S.avail[st.k], S.lastAct[st.k] || 0) >= wait;
    const tagEl = el.querySelector('.znudge');
    if (on) {
      tagEl.firstChild.textContent = txt;
      const a = el.querySelector('.act'), zr = el.getBoundingClientRect(), sc = zr.width / el.offsetWidth;
      const top = a ? (a.getBoundingClientRect().top - zr.top) / sc - tagEl.offsetHeight - 8 : 90;
      tagEl.style.top = Math.max(84, top) + 'px';
      if (!el.classList.contains('nudge')) { el.classList.add('nudge'); S.nudgeN[st.k]++; }
    } else el.classList.remove('nudge');
  }
}
// per-frame bits that don't need a re-render
function updateLive() {
  updateNudges();
  S.burners.forEach((b, i) => { const el = document.querySelector(`#bn${i} .pr`); if (!el) return; const C = 2 * Math.PI * 46;
    let f = 0, col = '#F4A51C'; if (b.state === 'cook') { f = Math.min(1, (S.t - b.start) / b.order.cookMin); if (f > .8) col = '#FFD166'; } else if (b.state === 'done') { f = 1; col = '#FFD166'; } else if (b.state === 'burnt') { f = 1; col = '#4A3A3A'; }
    if (b.state === 'done') { const left = (b.burnAt - S.t) / 3; col = left < .35 ? '#E8503A' : '#FFD166'; }
    el.setAttribute('stroke-dasharray', `${f * C} ${C}`); el.setAttribute('stroke', col); });
}
function renderTickets() {
  const t = $('#tickets'); const live = S.orders.filter(o => o.stage !== 'done').slice(0, 11);
  const key = live.map(o => o.no + o.stage).join(',');
  if (t.dataset.k !== key) { t.dataset.k = key; t.innerHTML = '';
    live.forEach(o => t.append(h('div', { class: 'tk', 'data-no': o.no }, o.desai ? img('anya_phone', 'av') : null, h('b', {}, `#${o.no}`), areaTag(o), h('div', { class: 'w' }, h('i'))))); }
  const lim = (S.cfg.shift === 2 && G.bar2 && G.bar2.when !== 'midnight') ? G.bar2.min : G.bar.min;
  [...t.children].forEach(el => { const o = S.orders.find(x => x.no == el.dataset.no); if (!o) return; const age = S.t - o.t.created, f = Math.min(1, age / lim); el.querySelector('.w i').style.width = f * 100 + '%'; el.classList.toggle('late', f >= .75); });
}

/* ---------------- stats ---------------- */
export function shiftStats(shift) {
  const rs = G.reviews.filter(r => r.shift === shift); const n = rs.length || 1;
  const pct = f => Math.round(rs.filter(f).length / n * 100);
  const orders = S ? S.orders : [];
  const avg = k => { const v = orders.map(o => o.waits && o.waits[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const cnt = f => rs.filter(f).length;
  const hasDessert = rs.filter(r => r.dessertOk != null), hasPromise = rs.filter(r => r.promiseKept != null);
  const counts = { n: rs.length, onTime: cnt(r => r.onTime), hot: cnt(r => r.hot), warm: cnt(r => r.warm), correct: cnt(r => r.correct), dessert: cnt(r => r.dessertOk), dessertOf: hasDessert.length,
    fries: cnt(r => !r.soggy), beforeMid: cnt(r => r.clockAt <= 24 * 60), promise: cnt(r => r.promiseKept), promiseOf: hasPromise.length };
  // "on time" is judged over every order that was DUE before the shift ended, not only the ones delivered
  // (otherwise boxes stuck in the kitchen silently vanish from the numbers)
  if (S) { const b = shift === 2 && G.bar2 ? G.bar2 : G.bar; const lim = b.when === 'midnight' ? Infinity : (b.min || 35);
    const rmap = new Map(rs.map(r => [r.no, r])); const due = lim === Infinity ? orders : orders.filter(o => (o.t.created ?? 0) + lim <= S.cfg.minutes);
    Object.assign(counts, { placed: orders.length, due: due.length, dueOnTime: due.filter(o => rmap.get(o.no)?.onTime).length, waiting: orders.filter(o => o.stage !== 'done').length }); }
  const tally = { soggy: cnt(r => r.soggy), squashed: cnt(r => r.squashed), raitaWarm: cnt(r => r.raitaWarm), cold: cnt(r => !r.warm), late: cnt(r => !r.onTime), missing: cnt(r => !r.correct) };
  return { counts, tally, helps: G.helps.filter(x => x.shift === shift), n: rs.length, onTime: pct(r => r.onTime), hot: pct(r => r.hot), warm: pct(r => r.warm), correct: pct(r => r.correct), dessert: rs.some(r => r.dessertOk != null) ? pct(r => r.dessertOk) : null,
    desai: rs.find(r => r.desai) || null, fries: pct(r => !r.soggy), promise: rs.some(r => r.promiseKept != null) ? pct(r => r.promiseKept) : null,
    beforeMid: pct(r => r.clockAt <= 24 * 60),
    waits: { prep: avg('prep'), cook: avg('cook'), pack: avg('pack'), disp: avg('disp') },
    reviews: rs, undelivered: orders.filter(o => o.stage !== 'done').length };
}
export function leftovers() { return S ? S.orders.filter(o => o.stage !== 'done' && o.stage !== 'out') : []; }

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

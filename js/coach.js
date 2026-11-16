// Learning supports for young players: a step card at each stage, an on-demand "What do we do?" guide,
// and idle nudges. Nudges only ever show HOW to use the screen (where to tap), never WHICH choice to make,
// and they never point at HELP during a shift (unprompted help jumps are evidence).
import { $, h, img, tap, wait } from './ui.js';
import { G, log } from './state.js';
import { sfx } from './sfx.js';

export const STEPS = [
  { t: 'The kitchen opens', min: [0, 2], fac: { watch: 'Does every child claim a station?', say: '“Each of you runs one part. You will need each other.”', avoid: 'Don’t assign stations or roles.' }, goal: 'Pick who runs each station.', icon: 'st_prep',
    how: ['Each player taps one station card.', 'Remember your chef number.', 'When every station has a chef, tap Open the kitchen.'],
    idea: 'Food moves Prep → Cook → Pack → Dispatch. Each of you runs one part.' },
  { t: 'Design the party box', min: [2, 5], fac: { watch: 'Do they choose quickly? A rough first try is the point.', say: '“Pick what you think works. Tonight will tell you.”', avoid: 'Don’t hint which foods travel well.' }, goal: 'Choose 3 foods and a box. It’s a quick first try!', icon: 'box_open',
    how: ['Tap 3 foods to put them in the box.', 'Tap a food again to take it out.', 'Then pick how the food will travel.'],
    idea: 'Don’t worry about getting it right. Real orders will show you how each food travels.' },
  { t: 'Set tonight’s bar', min: [5, 7], fac: { watch: 'Do they link each part of the bar to a customer clue?', say: '“Which message tells you that?”', avoid: 'Never suggest a number or a temperature.' }, goal: 'Read the customers’ clues. Decide what “good enough” means.', icon: 'clue_party',
    how: ['Read the customers’ messages.', 'For each part, choose a setting.', 'Tap the message that helped you choose.'],
    idea: 'A bar is like a high-jump bar: the line you aim to get over. Your team decides where it goes.' },
  { t: 'Shift 1 · 9 to 10 pm', min: [7, 13], fac: { watch: 'Do they notice a gold station and jump in without being asked?', say: 'Stay quiet. If you do prompt them, tap ✋ first.', avoid: 'Don’t tell anyone to help. Every prompt changes the evidence.' }, goal: 'Cook and deliver the first orders together.', icon: 'st_cook',
    how: ['Prep: tap the board to chop.', 'Cook: tap a burner, then tap the food when it’s ready.', 'Pack: tap each food into the box, then Seal.', 'Dispatch: tap Send to give a box to a rider.'],
    idea: 'The bar under each station shows how many orders are waiting there.' },
  { t: 'Check the bar', min: [13, 15], fac: { watch: 'Do they blame a person? Point them to where orders waited.', say: '“Was it the bar, or the kitchen?”', avoid: 'Don’t say whether a Pass or Fail is right.' }, goal: 'Did tonight reach our bar? Then change one thing.', icon: 'emo_ok',
    how: ['Read each number. It shows what really happened.', 'Tap Pass or Fail for every line. You are the judge.', 'See what tonight taught you about each food.', 'Pick one thing to change and the clue behind it.'],
    idea: 'Look at where orders waited, not at who was slow.' },
  { t: 'The rider crisis', min: [15, 17], fac: { watch: 'Does Dispatch share? Do the others ask?', say: '“Who knows about the riders?”', avoid: 'Don’t read the rider card for them.' }, goal: 'Half the riders go home. What now?', icon: 'ico_rider',
    how: ['Dispatch chef: peek at the rider card.', 'Tell your team what you saw.', 'Answer the team check together.', 'Read the family’s new message.'],
    idea: 'Sometimes only one person knows something. The team needs to hear it.' },
  { t: 'Re-plan', min: [17, 22], fac: { watch: 'Are the two messages different? Do they rewrite after the replies?', say: '“Who is reading this one? What do they need?”', avoid: 'Don’t rewrite their message for them.' }, goal: 'Make a new plan and tell people about it.', icon: 'opt_batch',
    how: ['Pick 1 or 2 changes for the kitchen.', 'Decide if your bar should change.', 'Agree the facts once.', 'Choose the words for families, then for riders. Read their replies and fix if you want.'],
    idea: 'Same facts, different people. Think about who is reading, and what they need to do next.' },
  { t: 'Shift 2 · to midnight', min: [22, 28], fac: { watch: 'Does the new bar fit the night? Are promises kept?', say: 'Stay quiet. Tap ✋ if you prompt.', avoid: 'Never push for speed. Riders are never rushed.' }, goal: 'Run your new plan until midnight.', icon: 'clue_midnight',
    how: ['Same jobs as Shift 1.', 'Use your new plan.', 'Keep an eye on the clock and the station bars.'],
    idea: 'Is your new bar working tonight?' },
  { t: 'Explain our changes', min: [28, 30], fac: { watch: 'Does the clue really support the change?', say: '“How do you know? Show me on the screen.”', avoid: 'Don’t supply the reason.' }, goal: 'Name one change and the clue that shows why.', icon: 'ico_template',
    how: ['Tap one change your team made.', 'Tap the clue that shows why.', 'Read your sentence out loud, then pass to the next chef.'],
    idea: 'A strong reason points to something that really happened tonight.' },
  { t: 'Beyond the kitchen', min: [30, 32], fac: { watch: 'Can they say who it is for and what they need?', say: '“Who is it for? What do they need?”', avoid: 'Don’t call the poster wrong. Ask about the sandcastle and the house.' }, goal: 'Where else does “good enough” change?', icon: 'x_sandcastle',
    how: ['Tap one picture.', 'Who is it for?', 'Choose what “good enough” means there.', 'Look at its twin picture and say it out loud.'],
    idea: 'Think about who it is for and what it needs.' },
  { t: 'Midnight', min: [32, 34], fac: { watch: 'Do they judge the night by their own bar?', say: '“By your bar, how did the night go?”', avoid: 'Don’t add your own verdict.' }, goal: 'Happy New Year! Look back at your night.', icon: 'emo_party',
    how: ['Count down together!', 'Judge your night: Pass or Fail by your own bar.', 'Look back at everything you changed.'],
    idea: 'You set the bar. You decide what your night meant.' },
];

let stageI = 0, rule = null, idle = 8000, last = performance.now(), shown = '', seen = new Set(), idleOnce = false;
const ring = h('div', { class: 'cring hide' }), tag = h('div', { class: 'ctag hide' });

export function initCoach() {
  $('#app').append(ring, tag);
  document.addEventListener('pointerdown', e => { if (e.target.closest?.('#hintBtn')) return; last = performance.now(); idleOnce = false; hide(); }, true);
  setInterval(update, 150);
  const b = $('#howBtn'); if (b) tap(b, openHow);
  rail(stageI);
  tap($('#howShade'), closeHow);
}

/* ---------- idle nudges ---------- */
// fn() → { el, text, id? } | null. Shown after `idle` ms with no taps; any tap hides it again.
export function guide(fn, o = {}) { rule = fn; idle = o.idle ?? 8000; last = performance.now(); hide(); }
export function unguide() { rule = null; hide(); }
function hide() { ring.classList.add('hide'); tag.classList.add('hide'); shown = ''; }
function stageRect(el) { const a = $('#app').getBoundingClientRect(), s = a.width / 1920, r = el.getBoundingClientRect(); return { x: (r.left - a.left) / s, y: (r.top - a.top) / s, w: r.width / s, h: r.height / s }; }
function current() {
  if (!$('#howCard').classList.contains('hide')) return null;
  // a voice note waiting for Next always comes first
  const nx = document.querySelector('#talk:not(.hide) .nx:not(.hide)');
  if (nx) return { el: nx, text: 'Tap here to keep going', id: 'talk_next' };
  if (!rule) return null;
  try { return rule(); } catch (e) { return null; }
}
// SKAI hint rule: the bulb is not always on screen. It appears after ~12 s with no taps, and only when there is
// something to help with (not during the step card, the cinematic, or a How-to card that is already open).
const BULB_IDLE = 12000;
function bulb() {
  const b = $('#hintBtn'); if (!b) return;
  if (document.querySelector('#intro, #cine')) last = performance.now();   // idle time starts after the cinematic / step card
  const want = (performance.now() - last >= BULB_IDLE || idleOnce) && !document.querySelector('#intro, #cine') && $('#howCard').classList.contains('hide') && !!(rule || document.querySelector('#talk:not(.hide) .nx:not(.hide)'));
  if (want === b.classList.contains('away')) b.classList.toggle('away', !want);
}
function update() {
  bulb();
  if (performance.now() - last < idle && !idleOnce) return;
  const r = current(); const el = r && (typeof r.el === 'string' ? document.querySelector(r.el) : r.el);
  if (!el || !el.isConnected || !el.getClientRects().length) { if (shown) hide(); return; }
  const b = stageRect(el), pad = 12;
  Object.assign(ring.style, { left: b.x - pad + 'px', top: b.y - pad + 'px', width: b.w + pad * 2 + 'px', height: b.h + pad * 2 + 'px' });
  if (shown !== r.text) { tag.textContent = r.text; shown = r.text; sfx.tick();
    const key = stageI + ':' + (r.id || r.text); if (!seen.has(key)) { seen.add(key); log('hint_shown', { stage: stageI + 1, hint: r.id || r.text }); } }
  ring.classList.remove('hide'); tag.classList.remove('hide');
  // place the label BESIDE the target when there is room, so it never sits on top of the text it points at
  const tw = tag.offsetWidth, th = tag.offsetHeight, gap = pad + 26, midY = Math.max(20, Math.min(1180 - th, b.y + b.h / 2 - th / 2));
  const right = b.x + b.w + gap + tw <= 1900 && b.h < 260, left = !right && b.x - gap - tw >= 20 && b.h < 260;
  const above = !right && !left && !r.below && b.y - pad - th - 18 > 20;
  tag.classList.toggle('side-r', right); tag.classList.toggle('side-l', left); tag.classList.toggle('below', !right && !left && !above);
  tag.style.left = (right ? b.x + b.w + gap : left ? b.x - gap - tw : Math.max(20, Math.min(1900 - tw, b.x + b.w / 2 - tw / 2))) + 'px';
  tag.style.top = (right || left ? midY : above ? b.y - pad - th - 18 : b.y + b.h + pad + 18) + 'px';
}

/* ---------- step card at the start of every stage ---------- */
export async function stageIntro(i) {
  stageI = i; rail(i); unguide();
  const s = STEPS[i];
  const el = h('div', { id: 'intro' }, h('div', { class: 'icard glass' },
    img(s.icon, 'ic'), h('div', { class: 'eyebrow' }, `Step ${i + 1} of ${STEPS.length}`), h('div', { class: 'h2' }, s.t), h('div', { class: 'sub' }, s.goal)));
  $('#app').append(el); sfx.chime();
  gsap.from(el.firstChild, { y: 40, scale: .9, opacity: 0, duration: .45, ease: 'back.out(1.7)' });
  await new Promise(res => { const t = setTimeout(res, 3800); tap(el, () => { clearTimeout(t); res(); }); });
  await new Promise(r => gsap.to(el, { opacity: 0, duration: .3, onComplete: r })); el.remove();
}
export function setStage(i) { stageI = i; rail(i); }
// SKAI progress rail: one segment per step, filled from the bottom
function rail(i) { const r = $('#progress'); if (!r) return; r.querySelector('.n').textContent = `${i + 1}/${STEPS.length}`;
  const segs = r.querySelector('.segs'); if (segs.children.length !== STEPS.length) { segs.innerHTML = ''; STEPS.forEach(() => segs.append(h('i'))); }
  [...segs.children].forEach((s, k) => s.className = k < i ? 'on' : k === i ? 'cur' : ''); }
// the bulb sticky: show the nudge for this screen now (or the step guide if there is nothing to point at)
export function hintNow() { log('hint_requested', { stage: stageI + 1 }); const r = current(); if (r) { last = 0; idleOnce = true; update(); } else openHow(); }
export function getStage() { return stageI; }

/* ---------- "What do we do?" guide ---------- */
function openHow() {
  const c = $('#howCard'); if (!c.classList.contains('hide')) { closeHow(); return; }
  const s = STEPS[stageI]; const wasPaused = G.paused; G.paused = true; c.dataset.wp = wasPaused ? '1' : '';
  c.innerHTML = '';
  const ok = h('button', { class: 'btn teal small' }, 'Got it');
  c.append(h('div', { class: 'eyebrow' }, `Step ${stageI + 1} of ${STEPS.length} · ${s.t}`), h('div', { class: 'h2', style: { fontSize: '44px' } }, s.goal),
    h('ol', { class: 'howlist' }, s.how.map(x => h('li', {}, x))),
    h('div', { class: 'idea' }, img('meher_warm'), h('div', {}, h('b', {}, 'Meher Didi says'), s.idea)),
    h('div', { class: 'row' }, ok));
  tap(ok, closeHow);
  c.classList.remove('hide'); $('#howShade').classList.remove('hide');
  gsap.fromTo(c, { xPercent: -50, yPercent: -50, y: 30, opacity: 0 }, { xPercent: -50, yPercent: -50, y: 0, opacity: 1, duration: .35, ease: 'back.out(1.6)' });
  sfx.select(); log('hint_opened', { stage: stageI + 1 });
}
function closeHow() { const c = $('#howCard'); c.classList.add('hide'); $('#howShade').classList.add('hide'); G.paused = !!c.dataset.wp; sfx.select(); }

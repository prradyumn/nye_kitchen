// Opening cinematic: "tap to start" over the night sky (that tap also unlocks sound and voice),
// then a letterboxed fly-in from the stars, over the city, through the kitchen window.
import { $, h, img, tap, wait, animText } from './ui.js';
import { G, log } from './state.js';
import { sfx, unlock } from './sfx.js';
import * as K3 from './scene3d.js';

export async function playIntro() {
  K3.introBegin();
  document.body.classList.add('cine');
  const top = h('div', { class: 'lb top' }), bot = h('div', { class: 'lb bot' });
  const cap = h('div', { class: 'cap' }), skip = h('button', { class: 'skip' }, 'Skip ›');
  // SKAI title screen: the mission name and one Start button, nothing else
  const gate = h('button', { class: 'gate', 'aria-label': 'Let’s investigate' }, img('title', 'gt'), h('b', { class: 'btn start pulse' }, 'Let’s investigate'));
  const el = h('div', { id: 'cine' }, top, bot, cap, skip, gate);
  $('#app').append(el);
  gsap.from(gate, { opacity: 0, y: 30, duration: .8, delay: .3 });
  await new Promise(r => tap(gate, r));
  unlock(); gsap.to(gate, { opacity: 0, duration: .4, onComplete: () => gate.remove() });
  gsap.to([top, bot], { height: 120, duration: 1.2, ease: 'power2.inOut' });
  sfx.pad(15);
  const say = (text, sub) => { cap.innerHTML = ''; const t = h('div', { class: 'ct' }); cap.append(t); if (sub) cap.append(h('div', { class: 'cs' }, sub)); gsap.fromTo(cap, { opacity: 0 }, { opacity: 1, duration: .5 }); animText(t, text, { stagger: .06 }); };
  const clear = () => gsap.to(cap, { opacity: 0, duration: .5 });
  const run = K3.introRun({
    boom: () => sfx.boom(), neon: () => sfx.buzz(), lights: () => sfx.clack(), whoosh: () => sfx.whoosh(),
    captions: {
      0.8: () => say('31 December', '9:00 pm'), 3.8: clear,
      4.9: () => say('Three hours to midnight.'), 7.9: clear,
      9.0: () => say('One kitchen. Four chefs.'), 10.9: () => say('Every box has our name on it.'), 13.4: clear,
    },
  });
  let skipped = false;
  tap(skip, () => { skipped = true; run.skip(); });
  await run.done;
  log('intro_played', { skipped });
  gsap.to([top, bot], { height: 0, duration: .8, ease: 'power2.inOut' });
  gsap.to([cap, skip], { opacity: 0, duration: .4 });
  await wait(850);
  el.remove(); document.body.classList.remove('cine');
  G.introPlayed = true;
}

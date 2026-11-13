// Boot: load assets, build the 3D kitchen, run the 11 stages.
import { MANIFEST } from './manifest.js';
import { $, h, fit, tickSprites, setVoice, tap, initSkin, replayNarration } from './ui.js';
import { sfx, unlock, setMuted, isMuted } from './sfx.js';
import { initScene, frame, resize, loadProps, lightsOn, setOpen } from './scene3d.js';
import { tickShift } from './kitchen.js';
import { STAGES, STAGE_NAMES, ensureDefaults } from './stages.js';
import { G, LOG, log } from './state.js';
import { initCoach, stageIntro, setStage, getStage, STEPS, hintNow } from './coach.js';
import { showReport } from './report.js';
import { playIntro } from './intro.js';

const params = new URLSearchParams(location.search);
G.speed = Math.max(.25, Math.min(20, +params.get('speed') || 1));

function preload() {
  const srcs = Object.values(MANIFEST).map(m => m.src);
  return Promise.all(srcs.map(s => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = s; })))
    .then(() => document.fonts ? Promise.all(['800 40px "Baloo 2"', '800 20px Nunito', '40px "Fredoka One"', '700 30px Fredoka', '600 20px Poppins', '700 20px Poppins', '700 20px "Chakra Petch"'].map(f => document.fonts.load(f))).catch(() => { }) : null);
}
function onResize() { const s = fit(); resize(s); }

async function boot() {
  initSkin();
  initScene($('#gl')); onResize(); addEventListener('resize', onResize);
  let last = performance.now();
  const CAP = params.get('test') ? 1500 : 100;
  if (params.get('test')) gsap.ticker.lagSmoothing(0);
  const loop = () => { const now = performance.now(), dt = Math.min(CAP, now - last); last = now; frame(); tickSprites(dt); tickShift(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  if (params.get('test')) window.__tick = (ms, n = 1) => { for (let i = 0; i < n; i++) tickShift(ms); };
  await Promise.all([preload(), loadProps()]);
  gsap.to('#loader', { opacity: 0, duration: .6, onComplete: () => $('#loader').remove() });
  document.addEventListener('pointerdown', unlock, { once: false });
  buildMenu(); initCoach();
  const start = Math.max(0, Math.min(10, (+params.get('stage') || 1) - 1));
  if (start > 0) { ensureDefaults(); lightsOn(true, 0); setOpen(true); }
  else if (!params.get('nointro')) await playIntro();
  G.t0 = performance.now();
  log('session_start', { start_stage: start + 1, speed: G.speed });
  for (let i = start; i < STAGES.length; i++) { log('stage_enter', { stage: i + 1, name: STAGE_NAMES[i] }); setStage(i); if (i > 0) await stageIntro(i); await STAGES[i](); }
}

function buildMenu() {
  const m = $('#menu'); m.classList.add('glass');
  const jump = n => { const p = new URLSearchParams(location.search); p.set('stage', n); location.search = p.toString(); };
  const speed = v => { const p = new URLSearchParams(location.search); p.set('speed', v); location.search = p.toString(); };
  const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // rebuilt every time it opens, so the timer and the step notes are current
  function render() {
    m.innerHTML = '';
    const i = getStage(), st = STEPS[i], el = performance.now() - G.t0, [a, b] = st.min || [0, 34];
    const late = el / 60000 > b;
    m.append(h('div', { class: 't' }, 'FACILITATOR'),
      h('div', { class: 'ftime' + (late ? ' late' : '') }, `⏱ ${fmt(el)} of 34:00 · Step ${i + 1} target ${a}–${b} min${late ? ' · running long' : ''}`),
      h('div', { class: 'fnotes' }, h('b', {}, `Step ${i + 1} · ${st.t}`), h('div', {}, h('em', {}, 'Watch: '), st.fac.watch), h('div', {}, h('em', {}, 'Say: '), st.fac.say), h('div', {}, h('em', {}, 'Avoid: '), st.fac.avoid)),
      h('button', { onclick: () => { G.lastPrompt = performance.now(); log('facilitator_prompt', { stage: i + 1 }); m.classList.add('hide'); } }, '✋ I just prompted the team (log it)'),
      (i === 8 || i === 9) ? h('button', { onclick: () => { G.skipTurns = true; log('facilitator_skip_turns', { stage: i + 1 }); G.onSkip && G.onSkip(); m.classList.add('hide'); } }, '⏭ Skip the remaining turns') : null,
      h('div', { class: 'g' },
        h('button', { onclick: () => { m.classList.add('hide'); showReport(); } }, '📋 Evidence report'),
        h('button', { onclick: () => { const bl = new Blob([JSON.stringify(LOG, null, 1)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(bl), download: 'nye-kitchen-evidence.json' }); document.body.append(a); a.click(); a.remove(); } }, '⬇ Raw log (JSON)')),
      h('div', { class: 't' }, 'JUMP TO STEP'), h('div', { class: 'g' }, STAGE_NAMES.map((n, k) => h('button', { onclick: () => jump(k + 1) }, `${k + 1} · ${n}`))),
      h('div', { class: 't' }, `CLOCK SPEED (now ×${G.speed})`), h('div', { class: 'g' }, [1, 2, 4].map(v => h('button', { onclick: () => speed(v) }, `×${v}`))));
  }
  tap($('#menuBtn'), () => { if (m.classList.contains('hide')) render(); m.classList.toggle('hide'); });
  // SKAI sound sticky → Replay Narration / Mute All Sounds
  const sm = $('#soundMenu');
  tap($('#soundBtn'), () => sm.classList.toggle('hide'));
  tap($('#replayBtn'), () => { replayNarration(); log('narration_replay', {}); sm.classList.add('hide'); });
  tap($('#muteBtn'), () => { const mu = !isMuted(); setMuted(mu); setVoice(!mu); $('#muteBtn').classList.toggle('muted', mu); $('#muteBtn .lbl').innerHTML = mu ? 'Unmute All<br>Sounds' : 'Mute All<br>Sounds'; sm.classList.add('hide'); });
  document.addEventListener('pointerdown', e => { if (!sm.classList.contains('hide') && !e.target.closest('#soundMenu,#soundBtn')) sm.classList.add('hide'); }, true);
  // SKAI hint bulb → show the hint for this screen now
  tap($('#hintBtn'), () => hintNow());
  // SKAI exit tab → ask first (there is no hub to return to; leaving restarts the mission)
  tap($('#exitTab'), () => {
    const box = $('#exitAsk'); box.innerHTML = '';
    const stay = h('button', { class: 'btn small' }, 'Keep playing'), leave = h('button', { class: 'btn small ghost' }, 'Leave');
    box.append(h('div', { class: 'ask' }, h('b', {}, 'Leave the mission?'), h('p', {}, 'Your teacher can still see what you did tonight.'), h('div', { class: 'row' }, leave, stay)));
    tap(stay, () => box.classList.add('hide')); tap(leave, () => { log('exit_mission', { stage: getStage() + 1 }); location.search = ''; });
    box.classList.remove('hide');
  });
}
boot();

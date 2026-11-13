// Shared mission state + evidence log.
export const G = {
  names: { prep: '', cook: '', pack: '', disp: '' }, three: false,
  menu: [], pack: 'foil', boxVersion: 1,
  bar: { min: null, arrive: null, custom: null, links: {} },
  box1: null, box2: null, bar1: null, failReason: null, helps: [], transferWho: {}, skipTurns: false, onSkip: null, t0: performance.now(),
  bar2: null, promise: null, replan: [], msgs: null,
  change1: null, stats: {}, reviews: [], helpers: {}, permHelp: {}, sharedRiders: false,
  speed: 1, lastPrompt: -1e9,
};
export const LOG = [];
const t0 = performance.now();
export function log(ev, data = {}) { const e = { ev, t_ms: Math.round(performance.now() - t0), ...data }; LOG.push(e); try { localStorage.setItem('nye-log', JSON.stringify(LOG)); } catch (_) { } return e; }
export function fmtClock(min) { let h = Math.floor(min / 60) % 24, m = Math.floor(min % 60); const ap = h >= 12 && h < 24 ? 'PM' : 'AM'; let hh = h % 12; if (hh === 0) hh = 12; return [`${hh}:${String(m).padStart(2, '0')}`, ap]; }
export function toMidnight(min) { const left = Math.max(0, 24 * 60 - min); const h = Math.floor(left / 60), m = Math.floor(left % 60), s = Math.floor((left * 60) % 60); return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
export function barText(b = G.bar) {
  if (b.kind === 2) return [b.when === 'midnight' ? 'Before midnight' : `Within ${b.min} min`, b.arrive === 'any' ? 'arrives any temperature' : `arrives ${b.arrive}`, 'all items correct', b.custom2 || 'we tell people the real time'].join(' · ');
  const cust = { dessert: 'dessert intact', party: 'Anya’s box before 10 pm', fries: 'fries still crisp', none: '' }[b.custom];
  return [`On time within ${b.min} min`, b.arrive === 'any' ? 'any temperature' : `arrives ${b.arrive}`, 'all items correct', cust].filter(Boolean).join(' · ');
}
export function nameOf(k) { if (G.three && k === 'prep') return G.names.cook || 'Cook'; return G.names[k] || ({ prep: 'Prep', cook: 'Cook', pack: 'Pack', disp: 'Dispatch' })[k]; }

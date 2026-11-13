// Facilitator evidence report: the raw log turned into plain sentences, grouped by the brief's
// five learning objectives and three skills. It describes what happened; it never scores the team.
import { h } from './ui.js';
import { G, LOG, nameOf } from './state.js';

const ev = name => LOG.filter(e => e.ev === name);
const last = name => ev(name).slice(-1)[0];
const kidName = k => k && k !== 'unknown' ? nameOf(k) : 'someone (not picked)';
const mins = ms => ms == null ? '—' : `${Math.round(ms / 1000)} s`;

export function buildReport() {
  const S = [];
  const sec = (title, objective, lines) => S.push({ title, objective, lines: lines.filter(Boolean) });

  const bar = last('bar_set'), judged = ev('bar_judged'), why = last('fail_reason'), bar2 = last('bar_changed'), j2 = ev('bar2_judged');
  sec('1 · Set, judge and change the bar', 'Set a team standard from real conditions, judge each shift against it, and change it when conditions change.', [
    bar && `First bar: on time within ${bar.on_time_min} min, arrives ${bar.arrival}, custom “${bar.custom_slot}”. Clues linked to ${Object.keys(bar.clue_links || {}).length} of 3 parts. Asked the owner ${bar.ask_owner_count} time(s).`,
    judged.length && `Shift 1 judged line by line: ${dedupe(judged).map(e => `${e.line} ${e.team_mark.toUpperCase()} (${e.actual})`).join(' · ')}.`,
    why && `Their reason: “${{ bar: 'our bar was too hard', kitchen: 'the kitchen got stuck', travel: 'the food or box didn’t travel well', unsure: 'not sure yet', easy: 'the bar was too easy', right: 'the bar was just right' }[why.reason]}”.`,
    bar2 && `After the crisis the bar changed: “${bar2.from}” → “${bar2.to}”.`,
    j2.length && `Shift 2 judged by the new bar: ${dedupe(j2).map(e => `${e.line} ${e.team_mark.toUpperCase()} (${e.actual})`).join(' · ')}.`,
  ]);

  const helps = ev('help_jump').filter(e => e.shift);
  const prompts = ev('facilitator_prompt').length;
  const unp = helps.filter(e => e.unprompted);
  const byKid = {}; helps.forEach(e => { const k = kidName(e.child); byKid[k] = (byKid[k] || 0) + 1; });
  const reds = helps.map(e => e.ms_red_to_help).filter(x => x != null).sort((a, b) => a - b);
  const share = last('dispatch_share'), check = last('dispatch_check');
  sec('2 · Watch the deadline and step in', 'Watch progress against midnight and help a falling-behind station without being told.', [
    `Help jumps: ${helps.length} (${unp.length} with no facilitator prompt in the minute before). Facilitator prompts logged: ${prompts}.`,
    helps.length && `Who moved: ${Object.entries(byKid).map(([k, n]) => `${k} ×${n}`).join(', ')}.`,
    reds.length && `Typical time from a station turning gold to someone jumping in: ${mins(reds[Math.floor(reds.length / 2)])}.`,
    share && `Rider crisis: Dispatch peeked ${share.dispatch_peeks} time(s) and shared after ${mins(share.ms_after_crisis)}; others asked Dispatch ${share.ask_dispatch_pings} time(s).`,
    check && `Team check (riders now): ${check.correct_first ? 'answered correctly first time' : `first answer ${check.first_answer}, correct after ${check.tries} tries`}.`,
  ]);

  const msgs = ev('messages'), m = msgs.slice(-1)[0], facts = last('message_facts');
  sec('3 · Same facts, two audiences', 'Explain the same change for customers and for riders, changing words and detail.', [
    facts && `Facts agreed once: food ${({ '35': 'within 35 min', '60': 'within an hour', '1130': 'by 11:30 pm', mid: 'before midnight' })[facts.when]}, ${facts.route} side first, ${facts.boxes} box(es) per trip, pickups every ${facts.pickup} min.`,
    m && (m.decoy_used ? 'Final messages: used the one-size message for both audiences (not yet adjusting).' : `Final messages: families got ${m.jargon_to_families} job-talk line(s); riders got ${m.plain_to_riders} everyday line(s). Families’ needs met: ${m.customer_fit ? 'yes' : 'not yet'}. Riders’ needs met: ${m.rider_fit ? 'yes' : 'not yet'}. Word overlap between the two: ${Math.round(m.overlap_ratio * 100)}%.`),
    msgs.length > 1 && `They rewrote after reading the replies: ${msgs.length} attempt(s). First attempt fits: families ${msgs[0].customer_fit ? 'yes' : 'no'}, riders ${msgs[0].rider_fit ? 'yes' : 'no'}.`,
  ]);

  const v1 = last('party_box_v1'), c1 = last('change_one'), eff = last('change_effect');
  sec('4 · Rough first version, changed by the reviews', 'Test a rough first version on real orders and change it based on what the reviews show.', [
    v1 && `Party box v1: ${v1.dishes.join(', ')} in ${v1.packaging}, chosen in ${mins(v1.ms_to_commit)} (${v1.vote_changes} change(s) of mind).`,
    last('prototype_reveal') && 'They saw what each food taught them after Shift 1 (card backs revealed).',
    c1 && `One change: ${c1.type}. Evidence picked: ${c1.evidence_ref}. Evidence fits the change: ${c1.evidence_matches_change ? 'yes' : 'not clearly'}.`,
    eff && eff.lines?.length && `What happened next: ${eff.lines.join(' ')}`,
    ...ev('justify').map(e => `${kidName(e.child)} explained: “${e.sentence}” (clue fits change: ${e.evidence_matches_change ? 'yes' : 'not clearly'}).`),
  ]);

  const tr = ev('transfer');
  sec('5 · Good enough somewhere else', 'Name another situation where good enough depends on the situation, and say what it would be.', [
    ...tr.map(e => e.decoy_chosen ? `${kidName(e.child)} first picked “Always do your best on everything” (skill not yet transferred), then tried again.` : `${kidName(e.child)}: ${e.card} → who it’s for “${e.who}” (${e.who_matches ? 'matches' : 'differs'}), good enough = “${e.said_good_enough}”.`),
  ]);

  const hints = ev('hint_shown').length, opened = ev('hint_opened').length, reads = ev('read_aloud').length;
  sec('Supports used', 'How much scaffolding the group needed (useful for adjusting next time).', [
    `Idle nudges shown: ${hints}. “What do we do?” opened: ${opened} time(s). Read-aloud used: ${reads} time(s).`,
    ...ev('zone_nudges').map(e => `Shift ${e.shift} station nudges: ${Object.entries(e.counts).map(([k, n]) => `${k} ${n}`).join(', ')}.`),
  ]);
  return S;
}
function dedupe(list) { const m = {}; list.forEach(e => m[e.line] = e); return Object.values(m); }

export function showReport() {
  const S = buildReport();
  const close = h('button', { class: 'btn small teal' }, 'Close');
  const print = h('button', { class: 'btn small ghost' }, 'Print');
  const el = h('div', { id: 'report' }, h('div', { class: 'rbox glass' },
    h('div', { class: 'eyebrow' }, 'Facilitator · evidence report'), h('div', { class: 'h2', style: { fontSize: '44px' } }, `What the team did · ${new Date().toLocaleDateString()}`),
    h('div', { class: 'rnote' }, 'Plain descriptions from the session log, grouped by the mission’s learning objectives. Nothing here is a score.'),
    h('div', { class: 'rsecs' }, S.map(s => h('section', {}, h('h3', {}, s.title), h('p', { class: 'obj' }, s.objective), s.lines.length ? h('ul', {}, s.lines.map(l => h('li', {}, l))) : h('p', { class: 'none' }, 'Not reached yet in this session.')))),
    h('div', { class: 'row' }, print, close)));
  close.onclick = () => el.remove(); print.onclick = () => window.print();
  document.querySelector('#app').append(el);
}

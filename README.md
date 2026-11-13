# New Year's Eve Kitchen

Grade 6 · Entrepreneurship · 34-minute group mission (SKAI Space). Built for the Lenovo K11 (1920×1200, 16:10).

## Run it
Any static server from this folder, then open `index.html` in Chrome:

```
python3 -m http.server 8080      # then http://localhost:8080
```
(Opening the file directly with file:// won't load the ES modules.)

## Folder
```
index.html            stage shell + HUD containers
css/style.css         all UI styling (1920×1200 design canvas, scaled to fit)
js/main.js            boot, preload, render loop, facilitator menu
js/stages.js          the 11 stages from the storyboard (learning flow)
js/kitchen.js         live kitchen: order sim, 4 station zones, riders, reviews, stats
js/scene3d.js         three.js kitchen, Blender props, lights, fireworks, camera presets
js/ui.js              DOM helpers, sprite strips, GSAP text/chat, voice notes
js/coach.js           learning supports: step cards, "What do we do?" guide, idle nudges, facilitator notes
js/intro.js           opening cinematic (tap-to-start gate, letterbox, captions, skip)
js/report.js          facilitator evidence report, grouped by the five learning objectives
css/skai.css          SKAI Entrepreneur skin (visual only, loaded after style.css)
assets/skai/          SKAI design assets exported from Figma (chrome, paper cards, clip, rivets)
js/data.js            dishes, packaging, areas, clues, re-plan options, transfer cards
js/state.js           shared state + evidence log
js/sfx.js             tiny synthesized sound kit
js/manifest.js        every sliced 2D asset (path + size / frame data)
js/vendor/            three r165, GSAP 3.12, GLTFLoader, RoomEnvironment, RoundedBox
assets/img|char|fx    sliced WebP art from your sheets (fx/char = 4-frame strips)
assets/models/props.glb  Blender-made props (pot, karahi, stove, board, rails, shelves, scooter, lamp)
assets/fonts          Baloo 2 + Nunito (offline)
tools/blender_props.py   regenerate props.glb:  python blender_props.py  (bpy 4.2)
```

## URL switches
- `?stage=5` jump to a stage (1–11) with sensible defaults
- `?speed=2` speed up the in-game clock
- `?q=low` force low render quality (adaptive quality also kicks in automatically under ~38 fps)

## Facilitator menu (☰)
Log "I just prompted the team" (so the next HELP jumps count as prompted), download the evidence log JSON, jump to a stage, change clock speed.

## Play mode
This build runs the brief's **one-device mode**: the four stations are four touch zones on one K11 and children crowd round it. The shared-screen + one-tablet-per-child version needs a small realtime server; state is already kept in `G` and `kitchen.js` so it can be split later.

## Learning supports (coach.js)
Built so younger players (Grade 5–6) can follow every step without an adult explaining the screen.
- **Step card** at the start of stages 2–11: "Step N of 11", the goal in one sentence, a progress track. Auto-closes in ~4 s or on tap.
- **"What do we do?"** button: numbered how-to for the current step plus one line from Meher. Pauses a running shift while open.
- **Idle nudges**: after ~8 s with no tap, a gold ring and tag point at *where* to tap. They point at whole groups of options, never at one option, so they never suggest *which* choice to make.
- **Practice order** before Shift 1: one ticket walks Prep → Cook → Pack → Dispatch with Meher talking each chef through it. Nothing is logged and nothing burns.
- **Station nudges** in the shifts: when a station has work and nobody has tapped it for 5 s (14 s once they've done it a few times; 2.5 s when food is about to burn). They never mention HELP, so help jumps stay unprompted.
- **Dispatch-only card** (Stage 6): covered until the Dispatch chef taps to peek, so the team has to ask them.

New evidence events: `hint_shown {stage, hint}` (once per hint per stage), `hint_opened {stage}`, `zone_nudges {shift, counts}` at the end of each shift. `dispatch_share` gains `dispatch_peeks`.

## Opening cinematic
Tap to start (this also turns on sound and voice), then a ~15 s letterboxed fly-in: night sky and moon → the city → the shop front ("MEHER'S KITCHEN" neon, awning, string lights) → through the window into the kitchen as the lamps come on. It is built entirely in three.js code (no new assets, about 20 KB), played once, then disposed. Skip button bottom-right; `?nointro=1` skips it; `?stage=N` never plays it.

## Learning design (round 3)
- **Mission card** after stations: the problem statement in kid words and the three things the team will do.
- **Blank bar**: every part of the bar starts empty, so nothing is pre-filled to copy (Steps 3 and 7).
- **Counts, not percentages**: "5 of 7" with box icons. "On time" counts every order that was *due* by the end of the shift, and orders still in the kitchen are shown.
- **Why?** after Pass/Fail (was it the bar, or the kitchen?), then **What tonight taught us**: the hidden dish facts are revealed with the review counts.
- **Who is helping?** picker on HELP (one shared screen), plus a neutral teamwork line in Steps 5 and 11.
- **Team check** after the rider crisis: did the Dispatch information reach everyone?
- **Messages**: agree the facts once, then pick everyday or job-talk wording per audience (unlabelled, random order). Replies react to what was sent, and teams can rewrite.
- **Look back** (Step 9): box v1 → v2, what happened to the change (with an honest "other things changed too"), and the promise kept.
- **Transfer**: who is it for → what good enough means (options shuffled) → the twin picture, said out loud. The decoy poster gets a question from Meher, not a verdict.
- **Midnight**: Pass/Fail against the team's own new bar, a whole-night summary, and a "what you did tonight" recap.
- 🔊 read-aloud on every heading. Meher says "First tries are for learning" after Shift 1.

## Facilitator (☰)
Session timer against 34 min with the current step's target window, notes for this step (watch / say / avoid), ✋ log a prompt, ⏭ skip remaining turns (Steps 9–10), 📋 evidence report (printable), raw JSON log.

New evidence events: `intro_played`, `mission_brief`, `fail_reason`, `prototype_reveal`, `dispatch_check`, `message_facts`, `change_effect`, `bar2_judged`, `read_aloud`, `facilitator_skip_turns`. Changed fields: `help_jump.child`; `messages` now carries `attempt`, `customer_fit`, `rider_fit`, `jargon_to_families`, `plain_to_riders`; `transfer` carries `who`, `who_matches`, `attempt`.

SKAI template + SME checklist pass: no typed names (stations are "Chef N"; free text on a shared screen is a safety risk); the cinematic gate is the title screen (name + Start mission only) and Meher introduces herself and the stakes next; retries are bounded (1st miss nudge, 2nd clue, then the answer is shown) in the team check (`dispatch_check.revealed`) and in Step 10 "Who is it for?" (`transfer.who_tries`); the hint bulb only appears after ~12 s idle; no framework words (Justify/Transfer) on screen; the ending runs did → found (team's own data) → learned, and the team says the takeaway before Meher's words (`takeaway_said`).

## SKAI Entrepreneur skin
Visual layer from Figma *SKAI-final › Entrepreneur* (chrome 618:12456, Cards 631:14845, Panal 631:15141, palette 638:4, Fredoka One × Poppins 30:4). Game logic is untouched. The skin lives in `css/skai.css`, the chrome markup in `index.html`, and its assets in `assets/skai/` (22 SVGs, about 45 KB). Fonts are local in `assets/fonts/`.
- **Chrome:** exit & brand tab (asks before leaving), sound sticky → Replay Narration / Mute All Sounds, **i** sticky → the "What do we do?" guide, timer frame (the story clock), progress rail (step N/11), hint bulb (shows this screen's nudge now), small ☰ for the facilitator.
- **Panels** are clipboards: Pale Yellow sheet, Cyan frame, navy clip. Tall panels scale down to fit under the clip without changing their layout.
- **Cards** are pinned paper on Blue / Yellow / Pink / Green backings. `ui.js decorate()` adds the backing, paper and pin to every `.card` automatically.
- **Buttons** are the riveted Terracotta "Investigate" style; secondary buttons use Royal Blue.
- New events: `hint_requested`, `narration_replay`, `exit_mission`.

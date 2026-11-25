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

## Live 3D action during shifts
- **Riders leave on scooters.** Each Send puts a helmeted rider on the Blender scooter in the street outside the back window. They pull out from the kerb by the door, lean into the lane and ride off left, with headlight beam, light on the road, tail-light and exhaust puffs. The crate carries one box per order in the batch (up to 3). Up to 3 rides can be on screen at once.
- **Close-ups.** Chopping or starting or finishing a dish pops a small framed close-up above that station, drawn by a second camera on the same renderer. It closes about 1.5 s after the last action. Chopping: the knife stands on its edge and rocks down, and each stroke drops a Blender cucumber slice and a few bits. Cooking: blue gas flames with warm tips, oil sizzle, the karahi tosses its paneer, and the pot lid rattles.
- **Shift view.** During the shifts the camera looks down on the counter from a tabletop angle, with each station right above its panel. A plain navy backdrop replaces the room behind the counter (wall, window, shelves, hanging rail, door, sign), so the screen shows only the counter and the panels. The room is switched off underneath, which also means less to draw. Riders leaving appear in a close-up above Dispatch that rides along with the scooter. The room comes back for every other step.
- All of it is procedural code on the existing props (about 18 KB of code, no new files). Close-ups are skipped when the adaptive quality drops (`?q=low`). Burnt food still shows smoke only.

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


## Decluttered UI

Every screen shows only what the child needs for the current decision: one read-aloud button per heading, no "Step N" eyebrows (the progress rail already shows it), no empty-state placeholder text, evidence shown on the screen where it is used (Step 5 evidence sits beside "why did it fail?" instead of beside Pass/Fail), grouped duplicate reviews ("took over 30 minutes ×5"), one fill bar per Pass/Fail line, tickets show number + area only (every order has the same menu), and idle-nudge labels placed beside their target. Game logic, evidence events and the learning flow are unchanged.

**Facilitator menu:** the ☰ button is invisible to children. Tap the spot just below the clock (top-right) to open it.

## Recorded voices (ElevenLabs)
- Meher Didi and every 🔊 read-aloud use **Anamika**; Kabir uses **Vishal**. Both come from the SKAI voice library, Grade 3 to 5 set (the players are in Grade 5), recorded with Multilingual v2.
- 119 clips in `assets/voice/` (Ogg Opus, mono, 24 kbps, about 1.4 MB in total; browsers that cannot play Ogg use the browser voice), listed in `assets/voice/index.json`. The game finds a clip by its text (`vkey()` in js/ui.js).
- Headings that change with play are recorded in pieces ("10 boxes delivered.", each bar line, each "On time within N min") and played in order, so the voice never switches mid-line. Any line without a clip falls back to the browser's speech. Next, Mute and Replay narration work as before.
- After changing any spoken text, add it to `tools/voice_lines.json` and run `XI_API_KEY=… python3 tools/voice_gen.py`. It records only the missing clips and removes unused ones. The API key is never stored in the project.

## Download size (optimised)
- `assets/models/props.glb` is meshopt-compressed (866 → 343 KB) and decoded by `js/vendor/meshopt_decoder.module.js`. After regenerating it with `tools/blender_props.py`, compress it again: `npx @gltf-transform/cli dedup props.glb a.glb && npx @gltf-transform/cli meshopt a.glb props.glb`. Node names stay the same, which the code relies on.
- `js/vendor/three.module.min.js` is three.js r165 trimmed to the 90 classes the game uses (678 → 520 KB). If you start using a new `THREE.X`, rebuild it: `cd /tmp && npm i three@0.165.0 esbuild && node <project>/tools/build_three.mjs <project>`.
- Voice clips are Ogg Opus. Every picture is WebP; the SKAI frame pieces stay SVG because they are vector drawings, which are smaller and stay sharp at any scale.

## Short screens for young readers
Feedback from teachers: Grade 4–6 children can't read big blocks of text. So every screen now asks for one thing, with a short heading and at most one short line under it, and Meher's longer speeches are split into several short bubbles.
- **Step 7 messages:** the facts are agreed one question per screen (4 screens). Each message is then built one line at a time: for each fact the team picks the families' wording, the riders' wording, or "Leave it out", then a friendly line, then reads the whole message out loud before sending.
- **Step 9:** "What did our change do?" and "Did we keep our promise?" are two screens; each chef's turn is pick a change → pick the clue → say the sentence out loud.
- **Step 11:** "What you did tonight" and "What you found" are two screens; the ending is the sentence to finish → Meher's words → the question to keep.
- Plainer words throughout ("Group by area", "Move a chef to Dispatch", "How did they hear you?").
- Logged events and their fields are unchanged. New spoken lines are listed in `tools/voice_lines.json`; until they are recorded with `tools/voice_gen.py` they use the browser's voice.


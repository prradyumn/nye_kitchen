# Working notes for this project

- Design canvas is fixed 1920×1200; `#app` is scaled by `fit()` in ui.js. Use stage pixels in CSS, never vw/vh.
- Learning rules from the brief are non-negotiable: no stars, scores or "good" labels; reviews describe, never rate; Meher never gives a number; riders never asked to go faster; vegetarian food, no alcohol; nobody gets hurt (burnt food = smoke only).
- Every stage in `stages.js` logs evidence with `log(ev, data)`; keep event names stable (they feed the facilitator dashboard).
- Station zones re-render only when `S.zonesDirty[k]` is set; per-frame updates go in `updateLive()`.
- 3D: props come from `assets/models/props.glb` (regenerate with tools/blender_props.py). Glows are additive sprites (cheap bloom); no post-processing passes, to stay fast on the K11. Live action (scene3d.js "live action"): gas flames, oil sizzle, knife strokes that drop Blender cucumber slices, riders leaving along the street outside the window (`rideOut`), and short close-ups (`closeUp(key)`): a second small camera drawn into a scissored viewport over the working station, only while it is open, skipped on low quality. Keep all of it procedural (no new files).
- Test hooks: `?test=1` exposes `window.__tick(ms, n)` to fast-forward a shift and disables GSAP lag smoothing.
- Nudges (coach.js `guide()`) point at a whole group of options, never at one option, and never at HELP during a shift. Bar parts start blank. No pre-filled answers anywhere.
- The intro scene (scene3d.js `intro*`) is procedural and disposed after playing; keep it asset-free.
- UI follows the SKAI Entrepreneur skin (css/skai.css, Figma SKAI-final › Entrepreneur). Use the `--sk-*` tokens, Fredoka One / Poppins, clipboard panels, pinned-paper cards and riveted terracotta buttons; don't hard-code the old dark-glass colours.
- SKAI template / SME rules: no free-text inputs shown on screen (chefs are "Chef N"); any right/wrong check uses the 3-step retry (nudge → clue → show the answer and continue); never show framework words (Justify, Transfer, Iterate…) to children; the hint bulb stays hidden until ~12 s idle.
- Declutter rules: one read-aloud button per screen (on the heading); eyebrows only when they add info (time, whose turn, message N of 2), never "Step N"; no placeholder/empty-state sentences (empty orders strip, review wall and "0 waiting" stay hidden until they have content); nudge labels sit beside their target, never on top of text; one fill bar instead of rows of squares.

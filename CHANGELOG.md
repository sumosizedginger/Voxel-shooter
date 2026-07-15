# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — GUMOI: The Lattice Break

The kit becomes a game: a horizontal R-Type III–style shmup built entirely under
`src/shmup/` + `game.html`, with the engine layer untouched. Story canon from
`docs/story-bible.html` via `NARRATIVE_PLAN.md`.

### Added
- **Phase 0–1** — game shell (title/pause/gameover state machine, main loop),
  keyboard + gamepad input with same-frame tap buffering, an auto-scroll
  side-view camera with `playerBounds()`, shake, and parallax; a side-view
  light rig on top of the kit's lights.
- **Phase 2** — the vertical slice: the Vessel (voxel ship with separate
  emissive glow meshes; kintsugi scars as the hull-integrity display),
  import-clean bullet pools (pierce, bounded homing), instanced bullet
  rendering, the seven-archetype enemy roster as data + pattern/fire functions,
  side-view explosion FX (XY shards, camera-facing shockwave rings), and an SFX
  kit. Hull integrity: chip damage from fire, lethal collisions.
- **Phase 3** — terrain collision via a Y→Z relabel of the engine's
  `CollisionWorld`; chunk builders that author art and collision together
  (collision always inset inside the art); checkpoint rewind.
- **Phase 4** — the arsenal: three-tier Siren Pulse (Witness-gated tier 3),
  Hammer Round (range-decided spread/slug, 3-slug boss stagger), the Witness
  force unit (four docks + orbit, absorb/reflect, shard levels 1–3, Mirror
  Counter, never dies), all six Council drones with a two-slot loadout, and
  Whisper Bits. Speed-ups and missiles cut per the bible.
- **Phase 5** — the level director (full trigger vocabulary, `reset(toX)`
  rewind), a formation grammar, Level 01 (The Beige Slope) authored as data,
  a stage-lint test, and `?x=`/`?god=1` authoring tools.
- **Phase 6** — Boss 01: an advancing wall of announcing mouths across three
  phases (advance → pulse → three-way split); interrupt an announcement to open
  its violet weakpoint; the slow-stack pin as the failure state.
- **Phase 7** — full HUD (score, hi-score, lives, hull bar, Siren gauge,
  Witness level, drones, boss bar), title + difficulty select, continue/quit,
  stage-clear tally, `addScore`, and the S1 cockpit comms line pool (verbatim
  bible lines).
- **Phase 8** — a data-driven music sequencer (`music.js`), quality-tier keys
  (1/2/3), volume-channel sync to settings, and `tests/shmup-smoke.spec.mjs`.
- **Phase 9** — ten-level campaign, codex, BETWEEN ending, generic bosses 02–10.
- **Completion pass** — full NARRATIVE S2–S10 systems under `src/shmup/systems/`
  (cast/interrupt, cine cutscenes, mimic, arena modifiers, profanity key, input
  recorder + shadow ghost, heat meter, movement predictor, temporal loop);
  per-level wave scripts + `systems` bags; boss hard-fail/timeout/temporal
  hooks; ten music tracks; cast tags + system meter HUD; `tests/systems.spec.mjs`;
  [COMPLETION.md](COMPLETION.md).
- New pure-node specs: `ship`, `assets`, `bullets`, `terrain`, `arsenal`,
  `director`, `stagelint`, `comms`, `campaign`, `systems` (all import-clean,
  browser-free).

## [0.2.0] — 2026-07-13

Professionalization pass: the kit went from "code that works" to a real
public project — tests, CI, examples, docs, and a standalone identity.

### Added
- Full test suite: pure-node unit specs for `collision.js`, `hitbox.js` +
  `facing.js` (including the equivalence proof that a vectorized facing
  matches the classic X-signed cone bit-for-bit), and `settings.js`
  (storage-absent/throwing degradation, persistence, reset semantics), plus
  a browser smoke spec covering `index.html` and both examples.
- GitHub Actions CI running the unit suite on every push/PR to `main`.
- Two genre-neutral examples: `examples/topdown-8way.html` (top-down camera,
  8-way movement, melee arc, wall collision) and `examples/voxel-showcase.html`
  (six bespoke voxel builds, live quality-tier switching).
- `docs/API.md` — a hand-curated reference for every export in `src/`,
  including the implicit `world` contract.
- README screenshots ("See it" section) for the smoke test and both examples.
- `package.json` identity fields (`repository`, `author`, `license`) and a
  standalone description no longer framed as an extraction of a specific game.
- `.editorconfig`, `.gitattributes`, `CONTRIBUTING.md`.

### Changed
- README rewritten to stand on its own: leads with what the kit *is*, closes
  with a "Built with this kit" section linking an example project instead of
  a "lifted out of" provenance framing.

### Known limitations
- CI runs the pure-node unit suite only (44 assertions, <1s). The browser
  smoke test (`npm test`, full suite) needs a real GPU — GitHub's hosted
  runners don't have one, and headless Chrome + SwiftShader software
  rendering proved unreliable there across several attempts. Run `npm test`
  locally before tagging a release; see CONTRIBUTING.md.

## [0.1.0] — Initial extraction

The kit as pulled out of its origin game: renderer + HDR bloom/vignette/film
composer, voxel meshing with baked ambient occlusion, character-part
builders, particle and motion-smear FX, a WebAudio synth, localStorage-backed
settings, quality tiers, skybox/environment, and the two combat primitives
that motivated the extraction — swept AABB collision and a vectorized
(8-way) hitbox, first proven in real belt-scroller combat with `facingVec`
pinned to `±X`. No tests, no CI, no examples yet.

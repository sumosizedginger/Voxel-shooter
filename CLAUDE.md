# Rtype3 — GUMOI: The Lattice Break (R-Type III–style shmup)

**Public repo:** https://github.com/sumosizedginger/Voxel-shooter

**Start here: read [PLAN.md](PLAN.md) before writing any code.** It is the
authoritative, phase-ordered build plan (with locked architecture decisions,
real API references, and a gotcha list) written after a full source read.
Work the phases in order, check off items in PLAN.md as you finish them, and
record any deviations in its Deviation log — a follow-up session will review
the work against that document.

**The story is canon:** [docs/story-bible.html](docs/story-bible.html)
(GUMOI: The Lattice Break) integrated via
[NARRATIVE_PLAN.md](NARRATIVE_PLAN.md), which reconciles the bible with the
engineering plans and **overrides them where they conflict** (damage model,
Siren Pulse tiers, the Witness, Council drones, ten-level campaign — see its
§2). All in-game story text comes verbatim from the bible — never paraphrase
or soften it (NARRATIVE_PLAN §7).

Companion specs, each referenced from the relevant PLAN.md phases:
[SHIP_PLAN.md](SHIP_PLAN.md) (the Vessel),
[ASSETS_PLAN.md](ASSETS_PLAN.md) (enemy archetypes, bosses, Witness/pickups,
bullets, terrain, parallax), and [LEVELS_PLAN.md](LEVELS_PLAN.md) (level data
schema, formations, pacing/fairness, stage-lint; its five-stage table is
superseded by the bible's ten levels).

## Quick facts

- Zero-build, offline-first three.js (r185, vendored in `lib/three/`). No
  bundler, no runtime npm deps. New HTML pages need the import map from
  `index.html`.
- Serve: `npm run serve` → http://localhost:8799 (game is `index.html`;
  `game.html` is the same entry; engine kit smoke is `kit.html`)
- Tests: `npm test` (needs Chrome/Edge; `CHROME_PATH` env var works).
  Unit-only: `npm run test:unit`. New specs go in `tests/*.spec.mjs`,
  registered in `tests/run-all.mjs`, using `createSink` from `tests/harness.mjs`.
- All new game code goes in `src/shmup/` + `index.html`/`game.html`. Do not
  modify `src/engine/`, `src/voxel/`, `src/combat/`, `src/audio/` unless PLAN.md
  explicitly says so. `kit.html` (engine smoke), both `examples/`, and all
  existing tests must keep passing.
- Gameplay coordinate convention: XY plane at Z=0, X = scroll direction,
  Y = up, playfield y ∈ [0, 16]. See PLAN.md §2 before touching anything.

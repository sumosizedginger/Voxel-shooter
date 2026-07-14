# Rtype3 — Voxel Engine Kit → R-Type III shmup conversion

**Public repo:** https://github.com/sumosizedginger/Voxel-shooter

**Start here: read [PLAN.md](PLAN.md) before writing any code.** It is the
authoritative, phase-ordered build plan (with locked architecture decisions,
real API references, and a gotcha list) written after a full source read.
Work the phases in order, check off items in PLAN.md as you finish them, and
record any deviations in its Deviation log — a follow-up session will review
the work against that document. Three companion specs carry equal authority,
each referenced from the relevant PLAN.md phases:
[SHIP_PLAN.md](SHIP_PLAN.md) (player ship asset),
[ASSETS_PLAN.md](ASSETS_PLAN.md) (enemies, boss, Force/pickups, bullets,
terrain, parallax), and [LEVELS_PLAN.md](LEVELS_PLAN.md) (campaign, level
data schema, formations, pacing/fairness, stages 1–5).

## Quick facts

- Zero-build, offline-first three.js (r185, vendored in `lib/three/`). No
  bundler, no runtime npm deps. New HTML pages need the import map from
  `index.html`.
- Serve: `npm run serve` → http://localhost:8799
- Tests: `npm test` (needs Chrome/Edge; `CHROME_PATH` env var works).
  Unit-only: `npm run test:unit`. New specs go in `tests/*.spec.mjs`,
  registered in `tests/run-all.mjs`, using `createSink` from `tests/harness.mjs`.
- All new game code goes in `src/shmup/` + `game.html`. Do not modify
  `src/engine/`, `src/voxel/`, `src/combat/`, `src/audio/` unless PLAN.md
  explicitly says so. `index.html` (smoke test), both `examples/`, and all
  existing tests must keep passing.
- Gameplay coordinate convention: XY plane at Z=0, X = scroll direction,
  Y = up, playfield y ∈ [0, 16]. See PLAN.md §2 before touching anything.

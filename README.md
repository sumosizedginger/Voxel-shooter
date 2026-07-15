# GUMOI: The Lattice Break

[![tests](https://github.com/sumosizedginger/Voxel-shooter/actions/workflows/test.yml/badge.svg)](https://github.com/sumosizedginger/Voxel-shooter/actions/workflows/test.yml)

A horizontal-scrolling **R-Type III–style shmup** built on a zero-build, offline
three.js voxel engine kit. The witness goes to war; the Council is the arsenal;
the seal is the target.

**Play:** `npm run serve` → open [http://localhost:8799/](http://localhost:8799/)
(`index.html`). `game.html` is the same entry for bookmarks.

Story canon: [docs/story-bible.html](docs/story-bible.html). Build authority:
[PLAN.md](PLAN.md), [NARRATIVE_PLAN.md](NARRATIVE_PLAN.md), [COMPLETION.md](COMPLETION.md).

## The game

- **The Vessel** — a tiny hit circle in a big ship; kintsugi scars brighten as
  hull integrity falls (that *is* the damage bar). Collisions are lethal; enemy
  fire chips.
- **The arsenal is the Council** — three-tier **Siren Pulse**, **Hammer Round**,
  the **Witness** force unit, six **Council drones** chosen on a **pre-mission
  2-slot loadout** screen, and **Whisper Bits**.
- **Ten-level campaign** — Beige Slope → Corrupted Seal → the BETWEEN ending.
  Per-level systems: mimic copy, arena modifiers, Profanity Key (**F**), delayed
  shadow, heat meter, asymmetry scorer, temporal fold.
- **Presentation** — theme parallax + terrain dressing on every stage, **bible-
  accurate boss silhouettes** (02–10), cinematic cutscenes on every **level open
  and boss entry** (voxel dioramas; `reduceMotion` skips them), readable word-
  bullet sprites, chunkier bolt art, 48-step ABC music phrases, and a full
  options/a11y/rebind UI. Gameplay HUD only appears mid-run (not on title/
  loadout/options).

### Controls

| Action | Default keys |
|--------|----------------|
| Move | WASD / arrows |
| Fire | Z / J / Space |
| Witness dock | X / K (double-tap = Mirror Counter) |
| Weapon swap | C / L |
| Council drone | V / H |
| Profanity Key | **F** (L4 word-bullets) |
| God mode | **G** — full **immunity** (no damage/death); score not recorded |
| Pause | Esc / P |
| Title | fire → **LAUNCH** (loadout) / **OPTIONS** / codex |
| Options | volumes, quality, a11y (motion/flash/HUD/shake/hold-fire), rebind, reset |

Authoring:

| Key / URL | Effect |
|-----------|--------|
| `` ` `` | Debug overlay |
| **1 / 2 / 3** | Quality low / high / ultra |
| `?god=1` | Start with god mode (immunity) |
| `?skipcs=1` | Skip opening cutscenes |
| `?skiptips=1` | Skip first-run tips |
| `?x=<scrollX>` | Start scrolled in |
| `?dev=1` | Full dev mode |
| Ctrl ×10 | Toggle dev mode (god + debug + skipcs) |
| **`[` / `]`** | Dev: previous / next level (score carries) |
| Shift+1…0 | Dev: jump to level 1…10 |

All game code lives under `src/shmup/` + `index.html` / `game.html`. The kit's
`src/engine/`, `src/voxel/`, `src/combat/`, and `src/audio/` stay frozen unless
PLAN.md says otherwise.

## Boot it

```
npm run serve      # node scripts/serve.mjs 8799
# open http://localhost:8799
```

`three` r185 is vendored under `lib/three/` (ES modules). No bundler, no
runtime npm deps for play.

## Engine kit (still here)

The underlying voxel engine kit remains available:

| Kit smoke | Top-down example | Voxel showcase |
|---|---|---|
| [`kit.html`](kit.html) | [`examples/topdown-8way.html`](examples/topdown-8way.html) | [`examples/voxel-showcase.html`](examples/voxel-showcase.html) |

`kit.html` boots the renderer, builds a voxel figure, and proves hitbox +
collision in an on-screen panel. If that page renders, the kit is healthy.

## Tests

```
npm test           # unit + browser smokes (needs Chrome/Edge; CHROME_PATH ok)
npm run test:unit  # pure-node only
```

New specs: `tests/*.spec.mjs`, registered in `tests/run-all.mjs`, using
`createSink` from `tests/harness.mjs`.

## Docs

- [PLAN.md](PLAN.md) — phase-ordered build plan
- [COMPLETION.md](COMPLETION.md) — systems + presentation pass notes
- [docs/API.md](docs/API.md) — module surface
- [SHIP_PLAN.md](SHIP_PLAN.md) / [ASSETS_PLAN.md](ASSETS_PLAN.md) / [LEVELS_PLAN.md](LEVELS_PLAN.md)

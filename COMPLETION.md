# GUMOI: The Lattice Break — Completion Document

This records what was built to close remaining gaps after the Phase 9
campaign-complete MVP and the later **presentation pass**. Authority order:
[docs/story-bible.html](docs/story-bible.html) →
[NARRATIVE_PLAN.md](NARRATIVE_PLAN.md) → [PLAN.md](PLAN.md) + companions.

## Status summary

| Area | After systems pass | After presentation pass |
|------|--------------------|-------------------------|
| Pre-mission loadout | Default Prophet+Needle only | **2-slot Council UI** + persist |
| L02–L10 feel | Wave scripts + shared tunnel | Terrain decor + **parallax** + sky |
| Boss spectacle | One generic body + phases | **Bespoke shapes** per boss 02–10 |
| Cutscenes | Cine camera + lines | **GUMOI bust + stage diorama** |
| Word bullets | Effect table + plain boxes | **CanvasTexture sprites** |
| Music | 16-step theme loops | **48-step A/B/C phrases** + chime |
| SFX | Core kit | Event bank (kill/telegraph/volley/words/…) |
| Options / a11y | Settings API only | **OPTIONS v2** reset/rebind/quality/a11y; tips |
| Boss set-pieces | Shapes only | **Motion + telegraphs** per boss 02–10 |
| Stage rooms | Tunnel + decor | **Hand rooms** geometry/rest/twist |
| Storage | `vsbeu.*` only | **dual-read** + write `rtype.*` |
| Entry page | `game.html` | **`index.html` = game**; kit at `kit.html` |

## Module map (presentation)

| File | Role |
|------|------|
| `src/shmup/loadout.js` | Normalize / persist / cycle 2-slot loadout |
| `src/shmup/council.js` | Import-clean Council seat table |
| `src/shmup/level/stagecraft.js` | Terrain dressing, sky, parallax hooks |
| `src/shmup/assets/parallax.js` | Per-theme silhouette builders |
| `src/shmup/assets/bossBodies.js` | Boss 02–10 voxel shapes |
| `src/shmup/assets/props.js` | GUMOI bust map (THREE-free) |
| `src/shmup/assets/diorama.js` | Cutscene prop spawn/dispose |
| `src/shmup/bulletmesh.js` | Word sprite pool via `makeWordTexture` |
| `tests/presentation.spec.mjs` | Loadout / parallax / shapes / music / diorama |

## UI flow

1. **TITLE** — difficulty ←→; ↑↓ LAUNCH / OPTIONS / CODEX; fire confirms.
2. **LOADOUT** — two Council seats; ↑↓ seat, ←→ cycle type; fire launches; Esc back.
3. **OPTIONS** — volumes, reduce motion/flash/horror audio, sequential rebind, back.
4. **PAUSED** — Esc resume; drone key opens OPTIONS.

Loadout persists under `progress.rtype.loadout` (and `progress.loadout`).

## Systems module map (prior pass)

| File | System | Levels |
|------|--------|--------|
| `cast.js` | S2 cast/interrupt | All |
| `copybuffer.js` | S5 mimic | L2 |
| `modifiers.js` | S6 arena mods | L3, L10 |
| `profanity.js` | S7 Profanity Key | L4 |
| `inputrec.js` | S8 recorder | L5, L9 |
| `heat.js` | heat-death | L7 |
| `predictor.js` | S9 intercept | L7 |
| `asymmetry.js` | asymmetric scorer | L8 |
| `temporal.js` | S10 loop | L10 τ² |
| `cutscene.js` | S3 cine + diorama hooks | All opens |

## Definition of done

1. Full 10-level credit path clearable (campaign + BETWEEN).
2. Stage-lint green; campaign + presentation + systems suites green.
3. Shmup smoke boots **index.html**, TITLE → LOADOUT → PLAYING.
4. Kit smoke still green on **kit.html**.
5. Dual strict verifiers PASS on current code.

## Ship-quality pass (Phase A–D)

- Balance table + heat/enemy/boss data (`src/shmup/balance.js`)
- Boss motion + telegraph ring (`bosses/generic.js` + configs)
- Room packing (`level/stagecraft.js` roomsFor)
- Cutscene open/boss diorama kits; weighted holds L1/L6/L10
- Onboarding tips (`systems/onboarding.js`); `?skiptips=1` / skipcs skips for smoke
- Tests: `tests/shipquality.spec.mjs`

## Optional still deferred

- Full professional soundtrack / recorded SFX banks (synth kit remains).
- External leaderboards / mobile / marketing site.

## How to play-test

```
npm run serve
# http://localhost:8799/          (game)
# http://localhost:8799/kit.html  (engine smoke)
# http://localhost:8799/?god=1&skipcs=1&x=300
# Title → LAUNCH → pick Scribe+Cloak → fire
# Options: volumes, reduce motion, rebind
# Level 4: F cancels word sprites
# G: god mode · Ctrl×10: dev mode
```

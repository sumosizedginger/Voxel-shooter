# GUMOI: The Lattice Break — Completion Document

This records what was built to close the remaining gaps after the Phase 9
“campaign-complete MVP” (see PLAN.md §6 deviation log). Authority order is
unchanged: [docs/story-bible.html](docs/story-bible.html) →
[NARRATIVE_PLAN.md](NARRATIVE_PLAN.md) → [PLAN.md](PLAN.md) + companions.

## Status summary

| Area | Before completion pass | After |
|------|------------------------|-------|
| S2 cast/interrupt on trash | Boss mouths only | Live on elites/waves + cast tags |
| S3 cutscenes | Text-only comms | Cine camera shots + lines, skippable |
| S5 copy/mimic | `lastShot` only | Mimic waves + Parrot `mirror` fire |
| S6 arena modifiers | Absent | Full stack on Jester / Seal phases |
| S7 word-bullets + profanity | Spawn tags only | Profanity Key (F/G) cancels words |
| S8 input recorder / shadow | Absent | Recorder + delayed ghost (L5/L9) |
| S9 heat + predictor | Absent | Heat meter + intercept forge (L7) |
| S10 temporal loop | Absent | 12 s fold + weakpoint (L10 τ²) |
| L02–L10 content | Shared factory | Per-level wave scripts + `systems` |
| Boss signatures | Pattern-only | Clocks, mods, predict, temporal, etc. |
| Music | Single `beige` track | 10 theme tracks |
| Tests | No systems suite | `tests/systems.spec.mjs` + campaign/lint |

## Module map (`src/shmup/systems/`)

| File | System | Levels |
|------|--------|--------|
| `cast.js` | S2 cast/interrupt | All (teach L1) |
| `copybuffer.js` | S5 mimic fire | L2 + Parrot |
| `modifiers.js` | S6 arena mods | L3, L10 |
| `profanity.js` | S7 Profanity Key | L4 |
| `inputrec.js` | S8 recorder | L5, L9 |
| `heat.js` | heat-death meter | L7 |
| `predictor.js` | S9 movement class | L7 |
| `asymmetry.js` | asymmetric scorer | L8 |
| `temporal.js` | S10 loop | L10 phase τ² |
| `cutscene.js` | S3 cine player | All opens |

## Level `systems` bags

Each level in `level/campaign.js` exports a `systems` object. `game.js`
`armLevelSystems()` wires meters, damage mult, temporal recording, and shadow
delay from that bag.

## Controls added

| Action | Keys | Notes |
|--------|------|-------|
| Profanity | `F` / `G` | Cancels nearest word-bullet (1.2 s CD) |
| Skip cutscene | Fire / Enter / Space | After 0.35 s grace |
| Author skip cutscene | `?skipcs=1` or `?x=` | Authoring tools |

## Boss signature facts

- **Boss 03** — `hardFailAt: 90` (integrate; cores close; still fires). Mods per phase.
- **Boss 06** — `timeoutAt: 180`; cast-gated violet scar.
- **Boss 07** — `predict` fire via S9 intercept.
- **Boss 08** — `asymmetryRegen` while player plays symmetrically.
- **Boss 10** — phases √π (spiral), ∞ (recurse), τ² (`temporal: true`).

## Definition of done (re-verified)

1. Full 10-level credit path still clearable (campaign flow + BETWEEN).
2. Every level stage-lint green (`tests/stagelint.spec.mjs`).
3. Codex entries reachable (`tests/campaign.spec.mjs`).
4. Systems unit suite green (`tests/systems.spec.mjs`).
5. Shmup smoke still boots (`tests/shmup-smoke.spec.mjs`).

## Verifier fix-ups (post review)

- Witness no longer absorbs `onlyProfanity` / `KIND.WORD` bullets.
- S7 `words.js` effect table (DELVE slow, TAPESTRY grid, REALM homing, ROBUST
  heal boss, LEVERAGE wall, SEAMLESS weapon lock).
- Boss 06: no hostile fire, heal-on-closed-scar, no contact kill, 180 s timeout.
- S6: `hudLie`, `weaponShuffle`, `slowStack` applied before movement; Jester
  turn 3 layers all three via `onEnter`.
- L9: `shadowRamp` 0.5→0.1, contradiction weakpoint window, replay shots @ 5 s.
- `docs/API.md` documents the systems module table.

## Remaining polish (non-blocking)

- Staged voxel dioramas / GUMOI bust for cutscenes (cine camera + lines live).
- CanvasTexture word sprites optional (effect table is load-bearing; mesh is
  still a distinct WORD box family).
- Per-level parallax art still empty on L02–10 (palette/terrain differ).
- Optional storage-key rename (`vsbeu.*` → `rtype.*`) still deferred (engine).

## How to play-test systems

```
npm run serve
# http://localhost:8799/game.html
# http://localhost:8799/game.html?god=1&skipcs=1&x=300   # near boss
# Level 4: F cancels DELVE/TAPESTRY/… word bullets
# Level 7: thrash stick → HEAT OFFLINE
# Level 8: fly asymmetrically → higher damage (ASYM meter)
```

**Secret dev mode:** tap **Ctrl** ten times (2.5 s max between taps). Enables
god + debug + skip cutscenes; **Shift+1…0** warps levels. Ctrl×10 again to
exit. Or load with `?dev=1`.

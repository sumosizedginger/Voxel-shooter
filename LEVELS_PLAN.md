# Level & Campaign Design Plan (companion to PLAN.md Phases 5, 6, and 9)

> **Superseded in part (2026-07-14):** the story landed —
> [docs/story-bible.html](docs/story-bible.html) via
> [NARRATIVE_PLAN.md](NARRATIVE_PLAN.md). **§1's five-stage campaign shape and
> §6's stage table are replaced by the bible's ten levels (NARRATIVE_PLAN §5).**
> Everything else in this document remains law: the data schema (§2, plus the
> C8 lint flags), formation grammar (§3), pacing rules (§4), fairness rules
> F1–F4 (§5 — recovery crystals are now Witness shards), stage-lint (§7), and
> authoring tools (§8).

How levels are structured, how waves are composed, and how difficulty ramps.
PLAN.md Phase 5 builds the director + Level 01 from this document's systems;
Phase 9 builds the rest of the campaign per NARRATIVE_PLAN.

---

## 1. Campaign shape

**5 stages** (R-Type III shipped 6; five is the honest scope), each 4–6
minutes, each with: 2 checkpoints, one new terrain gimmick, ~2 new enemy
types, a POW/pickup cadence, and a multi-phase boss. A second loop at higher
difficulty is a stretch goal — leave `loops` in progress data (already in the
memory of settings), don't build it.

Build order = stage order. **Stage 1 must be fully polished before Stage 2
starts** — it's the template that proves the data format.

## 2. Level data format (locks the director's schema, PLAN.md Phase 5)

A stage is one exported object in `src/shmup/level/stage<N>.js`:

```js
export const STAGE1 = {
    id: 1, name: 'approach',            // placeholder names, story TBD
    scrollSpeed: 2.5, length: 800,      // world units
    music: 'stage1',                     // key into music.js patterns
    palette: { sky: 0x0a0514, fogDensity: 0.0035 },
    parallax: [ /* {buildFn, z, scrollRate} per ASSETS_PLAN §7 */ ],
    terrain:  [ /* {chunk: 'floorSlab', atX, y, args} — resolved at load */ ],
    triggers: [ /* sorted by atX, see below */ ]
};
```

Trigger types (the director's full vocabulary — implement all of these in
Phase 5 even if Stage 1 doesn't use every one, so later stages are pure data):

| type | fields | semantics |
|---|---|---|
| `wave` | `formation, enemy, count, y, spacing, params` | spawn a formation (§3) |
| `pickup` | `kind, y` | free-floating pickup (checkpoint recovery, §5) |
| `checkpoint` | — | death after this rewinds here |
| `speed` | `scrollSpeed, ease?` | change scroll rate (0 = hold, negative = reverse — camera and player clamp must tolerate both) |
| `lock` | `until: 'cleared'` | scroll-lock until live enemies from prior waves are dead (mini-gauntlet), then resume |
| `dialogue` | `id` | no-op hook for future story (logs in debug overlay) |
| `boss` | `id` | scroll-lock + hand control to the boss module |
| `end` | — | stage clear sequence |

Director contract (restates PLAN.md Phase 5 with this schema): fire every
trigger whose `atX <= scrollX` exactly once, in order; `reset(toX)` re-arms
all triggers with `atX > toX` and despawns live enemies/bullets/pickups.

## 3. Formation grammar (implemented once, in `src/shmup/level/formations.js`)

Formations are spawn-shape functions — they place N enemies with staggered
entry, then individual `pattern`s take over. The library, roughly in teaching
order:

- `chain` — N enemies follow the leader's path with a time offset (the
  classic R-Type popcorn snake; pairs with `sineDrift`).
- `column` — vertical line entering together (tests vertical dodge).
- `pincer` — half spawn top-right, half bottom-right, converging (tests
  middle-lane discipline).
- `ambushRear` — spawns off-screen LEFT, flying right (the R-Type "behind
  you" moment; always telegraph with a 0.5 s edge flash on the left, and
  never during a terrain squeeze — fairness rule F3, §5).
- `wallMount` — crawlers/gunpods attached to terrain surfaces at given x
  positions (needs the terrain entry to exist; the stage-lint test §7
  verifies each mount x overlaps a terrain chunk).
- `escort` — one `powCarrier` + orbiting drones (risk/reward: kill the
  escort first or lose the drop in the crossfire).
- `turretNest` — 2–4 gunpods in a terrain pocket (a set-piece, not a wave).

Each formation takes `{enemy, count, y, spacing, params}` — enemy types come
from the ASSETS_PLAN §2 registry, so formations × enemies × params is the
content space. **Waves are data, never code**: if a stage needs a new
behavior, add a pattern or formation to the library, then use it as data.

## 4. Pacing rules (how triggers get authored)

- **Teach → test → twist.** Every new element appears once in a safe context
  (one drone chain, no terrain), then in a real fight, then combined with a
  known element. No new element AND new terrain gimmick simultaneously.
- **Intensity curve per stage:** calm intro (10 s) → 3–4 rising combat beats
  separated by 3–5 s rests → checkpoint → gimmick showcase → heaviest
  gauntlet (`lock` trigger) → checkpoint → pre-boss breather (pickup top-up)
  → boss. Rests are where players re-dock the Force and breathe — don't fill
  them.
- **Pickup cadence:** the player should hold a level-1 Force within ~45 s of
  Stage 1's start (first `escort` wave guarantees it). Speed-up early in
  every stage (they reset on death). One missile and one bit somewhere in
  every stage. Crystals: enough that a no-death run reaches Force level 3 by
  mid-Stage 2 and stays there.
- **Boss entry:** `speed 0` → 2 s of empty scroll (dread beat, future
  dialogue hook slot) → `boss` trigger.

## 5. Death, checkpoints, and fairness (the R-Type problem, solved on purpose)

Classic R-Type is infamous for unwinnable checkpoint respawns (bare ship, no
Force, mid-gauntlet). We keep rewind-on-death but design it fair:

- **F1 — Recovery guarantee.** Within 15 world units after every checkpoint
  there is a `pickup` trigger with a crystal. It only spawns on a post-death
  run through (director flag: `recoveryOnly: true` — suppressed when the
  player passes with a Force already held), so it never inflates a good run.
- **F2 — Checkpoints sit at rests**, never inside a gauntlet or squeeze
  (stage-lint §7 asserts no checkpoint within 10 units of a `lock` trigger
  or terrain pinch narrower than 6 units).
- **F3 — No unreactable deaths:** `ambushRear` is telegraphed (§3); no enemy
  bullet is ever faster than 14 u/s (player base speed 9 + reaction margin);
  terrain squeezes narrower than 4 units never contain aimed-fire enemies.
- **F4 — Boss deaths respawn at the boss** (pre-boss breather checkpoint is
  mandatory and includes the F1 recovery), never rewind into the stage.

## 6. The five stages — SUPERSEDED

> **This section is superseded by NARRATIVE_PLAN.md §5 (the bible's ten
> levels).** It is kept for the reusable ideas embedded in it (the
> shieldDrone-as-Force-tutorial trick, destructible terrain via
> `removeSolid`, timed crusher solids, scroll reversal) — several of which
> the bible's levels will want. Do not author these stages.

| # | Theme (placeholder) | Mechanical identity | New enemies | Gimmick | Boss concept |
|---|---|---|---|---|---|
| 1 | **Approach** — open space, debris | Teach everything: movement, charge, Force, all 7 roster types, light terrain | (the ASSETS_PLAN §2 roster) | none — fundamentals | Gatekeeper (ASSETS_PLAN §3) |
| 2 | **Derelict fleet** — wreck interiors | Tight corridors; terrain IS the enemy; slow-scroll crawl sections then a fast escape burst | `shieldDrone` (front-armored — kill from behind with detached Force: the Force tutorial-by-design), `snake` (segmented chain, body invulnerable, tail weak point) | `speed` changes: 1.2 crawl / 5.0 escape run | Corridor-filling engine core; fought while scrolling (moving fight, no lock) |
| 3 | **Bio caverns** — organic tunnels | Destructible terrain: some chunks have hp and are registered/removed via `CollisionWorld.removeSolid` (already supported — this is why terrain chunk ids exist); carve your own safe lane with the Wave Cannon | `spore` (drifts from destroyed blocks), `burrower` (erupts from intact terrain — telegraphed rumble + particles 0.8 s before) | shootable walls | Regenerating mass blocking the tunnel; weak core exposed only after clearing growth (re-adds solids as it regrows) |
| 4 | **Foundry** — enemy production line | Timed hazards: crushers = terrain solids added/removed on a broadcast cycle (addSolid/removeSolid on a timer — the mechanism falls out of the existing API); assembly lines spawn enemies until their source is destroyed | `fabricator` (stationary spawner, high hp, priority target), `crusherPod` (rides the hazard cycle) | rhythm navigation | The factory heart: fight inside a crusher arena where the boss weaponizes the stage gimmick |
| 5 | **Core** — the source | Mastery exam: remixes every prior gimmick in escalating order; includes one `speed`-reversal segment (scroll briefly runs backward — R-Type III's own trick) | none new — density and mix carry it | all of the above, briefly | Two-phase finale: boss-rush callbacks (rebuilt small, 1 phase each) → final form with a shutter-core that quotes Stage 1's Gatekeeper |
| — | *(stretch)* loop 2 | same stages, `hard` multipliers forced + revenge bullets (enemies emit one aimed shot on death) | — | — | — |

Rule of thumb per stage: ~10–14 `wave` triggers, 2 `checkpoint`, 3–6
`speed`/`lock` beats, 4–6 `pickup`, 1 `boss`, 1 `end`.

## 7. Stage-lint test (the content safety net — build with the director)

`tests/stagelint.spec.mjs` (pure node): imports every stage file and asserts,
per stage:

- triggers sorted by `atX`, exactly one `boss` and one `end`, `end` last;
- every `wave.enemy` exists in the ASSETS_PLAN registry; every
  `terrain.chunk` exists in the terrain chunk set;
- every formation's y-positions inside the playfield band [0, 16];
- checkpoint placement rules F1/F2 hold (recovery pickup within 15 units
  after each checkpoint; no checkpoint near a lock/pinch);
- `wallMount` waves overlap a terrain chunk's x-range;
- stage `length` ≥ last trigger's `atX` + 20.

This spec is why the schema is plain data: the whole campaign stays
machine-checkable without a browser. Run it on every stage as it's authored.

## 8. Authoring workflow (build these WITH Stage 1, they pay for themselves)

- URL params on `game.html`: `?stage=2&x=340` → load that stage, start
  scrolled to x (skips title; dev only, no need to hide it).
- Debug overlay (the backquote toggle from PLAN.md Phase 1) additionally
  shows: a trigger timeline strip (upcoming triggers with their atX),
  live enemy/bullet counts, and collision wireframes.
- `?god=1` → **full immunity** for tuning runs (watermark **GOD · IMMUNE ·
  score off**; scores not recorded). Hull never drops; contact/terrain/boss
  wall cannot kill.
- **`G` key** toggles the same god mode at runtime.
- Full dev mode: **Ctrl ×10** or `?dev=1` (god + debug + skip cutscenes/tips;
  **`[` / `]`** previous/next level; **Shift+1…0** jump to L1–L10).
  Profanity Key remains **`F`** only.

## 9. PLAN.md phase mapping

- **Phase 5** builds: director with the FULL §2 trigger vocabulary,
  `formations.js` (§3), stage-lint spec (§7), authoring tools (§8), and
  Stage 1 authored to §4/§5/§6.
- **Phase 6**: Boss 1.
- **Phase 9 (content buildout, after Phase 8 polish):** stages 2–5 in order,
  each = new enemies (ASSETS_PLAN template) → terrain gimmick → triggers →
  boss → playtest pass against §4/§5. One stage at a time, playable at
  every step.

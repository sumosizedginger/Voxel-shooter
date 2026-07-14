# Narrative Integration Plan — GUMOI: The Lattice Break

**The game now has its story.** The canonical narrative document is
**[docs/story-bible.html](docs/story-bible.html)** (GUMOI: The Lattice Break,
Story Bible v0.1) — read it in full before building any content it touches.
This document maps the bible onto the engineering plans (PLAN.md, SHIP_PLAN.md,
ASSETS_PLAN.md, LEVELS_PLAN.md) and **resolves every conflict between them**.
Where the bible and an older plan disagree, the bible wins and the resolution
is recorded here (§2). Where the bible is silent, the older plans remain law.

Rule of authority, in order: story-bible.html (narrative + mechanics it
specifies) → this document (reconciliation + engineering mapping) → the four
earlier plans (everything else).

---

## 1. Identity and naming (adopt everywhere, including code)

The game is **GUMOI: The Lattice Break**. Title screen, `<title>`, README.
Setting: the Lattice. Protagonist: GUMOI (pilot, on comms + cutscenes).
Operator: SUMO (comms voice only, never on screen — bible §14).

| Old plan name | Canonical name | Notes |
|---|---|---|
| player ship / R-9 | **the Vessel** | SHIP_PLAN.md recipe stays; reskin per §3 below |
| wave cannon | **Siren Pulse** | now 3 charge tiers (§2 C2) |
| (new) secondary | **Hammer Round** | close spread / long slug, boss knockback+stagger |
| Force pod | **the Witness** | levels 1–3, four dock points, Mirror Counter |
| bits | **Whisper Bits** | unchanged mechanically |
| missile/bit pickups | **the Council (drones)** | 6 types, 2 slots, pre-mission loadout (§2 C4) |
| crystal pickup | **Witness level shard** | levels the Witness 1→3 |
| stage | **level** (10 total) | bible §04–§13 |
| boss placeholder names | bible names | Beige Slope, Induction Parrot, Jester Unbound, Smooth Operator, Mirror Break, Redemption Arc, Forge Wraith, Drift Wraith, Witness's Shadow, Corrupted Seal |

## 2. Reconciliation decisions (bible vs earlier plans — final)

- **C1 — Campaign is 10 levels, not 5.** LEVELS_PLAN §6's five-stage table is
  **superseded** as content. Everything else in LEVELS_PLAN survives: the
  trigger schema (§2), formation grammar (§3), pacing rules (§4), fairness
  rules F1–F4 (§5), stage-lint (§7), authoring tools (§8). The bible's ten
  levels are authored in that schema.
- **C2 — Damage model: hull integrity replaces one-hit death.** The bible is
  unambiguous (chip damage, % heals, stacking slows, "phases through one
  collision per life"). The Vessel has a **hull integrity bar (100)**. Enemy
  bullets deal chip damage per the bible's numbers. **Collisions stay lethal**:
  terrain contact and enemy body contact destroy the Vessel outright (that is
  why the Ghost Drone's one-collision phase exists). Death → checkpoint rewind
  exactly as PLAN.md Phase 3 / LEVELS_PLAN §5 built it, with the bible's death
  lines on the respawn screen. Visual feedback: the Vessel's kintsugi scar
  glow (violet/blue emissive meshes, SHIP_PLAN §5 technique) scales up as
  integrity drops — the ship bleeds light the way GUMOI does. PLAN.md §4's
  "one-hit death" row is superseded.
- **C3 — Siren Pulse has 3 tiers**, not the 2-stage charge. Tier 1 fast/weak,
  tier 2 workhorse, tier 3 siege shot that requires **Witness level ≥ 2** and
  locks the Vessel in place for 1.4 s on release (bible §03). PLAN.md Phase 4's
  wave-cannon spec is amended to 3 tiers; the "tap vs hold" input discrimination
  stays.
- **C4 — The Council drones replace the missile/bit pickup economy.** Six
  drone types (Needle, Mirror, Cloak, Ghost, Scribe, Prophet — behaviors as
  bible §03/§14), max 2 equipped, chosen on a pre-mission loadout screen;
  switching mid-mission costs a Witness charge. Whisper Bits are granted by a
  pickup as before. **Speed-up pickups are cut** — the bible has no speed
  economy and its slow/drag debuffs need a stable baseline speed to mean
  anything. Vessel speed is a per-level tuning constant.
- **C5 — Witness replaces Force types.** No Round/Shadow/Cyclone. The Witness
  levels 1→3 via shards (L1 shield, L2 return-fire pulse + enables tier-3
  Pulse, L3 melee stab that breaks guards). Docks: front, rear, **above,
  below** (two more than planned), plus detached orbit. New ability **Mirror
  Counter** (double-tap dock key): 0.5 s reflect field, 2× return speed —
  required by Level 5 and taught there.
- **C6 — Weapon switching is a mechanic** (taught in L2, 0.4 s swap): the
  Vessel carries Siren Pulse and Hammer Round simultaneously. Input plan gains
  a switch button; PLAN.md Phase 0's input map is amended.
- **C7 — Weakpoint color is violet** (`0x8b5cf6` family — the bible's brand
  violet). ASSETS_PLAN R3's allegiance rule is refined, not broken: hostile
  *fire* stays red/magenta and the most-visible-thing rule (R4) stands;
  **violet is reserved for weakpoints and for GUMOI/the Witness's scar glow**
  — violet always means "the honest part; shoot here / this is her."
  Nothing else may be violet.
- **C8 — Fairness exceptions are sanctioned by the bible**: L3's 90-second
  hard-fail integration and L6's 180-second timeout are deliberate design.
  Stage-lint gains an `allowHardFail: true` / `allowTimeout: true` per-level
  flag so those two levels pass lint without weakening the F-rules elsewhere.
  F1 recovery pickups become Witness shards.
- **C9 — Enemy roster survives as archetypes.** ASSETS_PLAN §2's seven types
  are the *behavioral* base (popcorn, swooper, gun platform, wall-crawler,
  homing mine, mid-tier, carrier); each level reskins them to its theme
  (L1 beige "suggestion" drifters, L2 mimic-drones, L3 splitting clowns,
  L4 middle managers, etc.). The registry pattern (R1/R2), death-shatter (R5),
  and asset tests all stand.
- **C10 — Difficulty multipliers** (`difficultyMultipliers()`) still apply to
  enemy HP/damage. Boss clocks (L3, L6, L10 phase timers) are **never** scaled
  by difficulty — the bible's timers are fixed narrative facts.

## 3. The Vessel (amendments to SHIP_PLAN.md)

SHIP_PLAN's constraints, recipe structure, rig pattern, and tests all stand.
Reskin, don't restructure:

- Palette: hull shifts to the bible's identity — dark hull with **violet/blue
  kintsugi seams** (painted `paint()` crack-lines in `0x8b5cf6`/`0x4060ff`
  family) instead of the white R-9 homage; copper accent (`0xf97316`) replaces
  red. Canopy glow stays cyan-violet, engine glow copper-orange.
- The scar-glow meshes are the damage display (C2): thin emissive box meshes
  laid along the painted seam lines, `emissiveIntensity` ramping 0.5→3.5 as
  integrity 100→0. Prepare them at rig build; drive them from `player.js`.
- New HUD-adjacent subsystems on the player entity (each is a small
  import-clean module + spec, built in the phase that needs it):
  `heat.js` (heat-death meter: +charge per direction change, decay when
  steady, weapons offline 2 s at max — L7), `profanity.js` (1.2 s cooldown
  cancel-nearest — L4), `asymmetry.js` (3 s sliding window over input events,
  symmetry-deviation score — L8).

## 4. Story systems (new engineering, in build order)

| # | System | What it is | Where it lands |
|---|---|---|---|
| S1 | **Comms HUD + line pools** | `src/shmup/story/lines.js`: every §15 line, keyed by trigger (`l01.intro`, `death`, `victory.05`, `banter`, …), **verbatim from the bible — no softening, no edits**; a comms box (speaker tag + typewriter text, skippable) in the game HUD; death/victory lines wired into the game-flow states | with PLAN.md Phase 7 |
| S2 | **Cast/interrupt** | enemies gain optional `cast: {text, duration, onComplete}`; a text tag renders over the enemy while casting; any hit interrupts → stagger + violet weakpoint window (bonus damage). Taught in L1, reused by L1/L4 bosses | Phase 9A |
| S3 | **Cutscene player** | data scripts (slug, shots, lines) → existing `setCineCamera`/`updateCineCamera` rig + the S1 comms box; skippable; honors `reduceMotion` (cuts instead of dollies — already built into the cine rig). Voxel GUMOI bust for cockpit close-ups built from `characters/builders.js` (the kit's humanoid builders finally earn their keep) + boss diorama = the level's own scene | Phase 9A |
| S4 | **Codex archive** | between-level screen listing 10 entries (§16), text verbatim; unlock = level cleared under par time (par times set in playtesting, stored per level in the stage data); persistence via `setProgress({codexUnlocked: [...]})` | Phase 9A |
| S5 | **Copy buffer / mimic** | records the player's last shot (type+tier); mimic enemies and the Parrot replay it scaled 1.5×; weapon switch clears the buffer | Phase 9B (L2) |
| S6 | **Arena modifier stack** | named, stackable, removable frame-loop modifiers: `gravityInvert`, `controlFlip`, `weaponShuffle`, `hudLie` (false HUD readouts), `screenPush`, `slowStack`. The Jester's turns and several boss phases are compositions of these | Phase 9B (L3) |
| S7 | **Word-bullets** | bullets carrying a rendered word: procedural `CanvasTexture` sprites generated at load (zero-build-safe, no shipped assets); per-word effects table (bible L4 boss) | Phase 9B (L4) |
| S8 | **Input recorder + shadow replay** | ring buffer of input snapshots; drives L5 mirror-shards (0.3 s delay), L9's Shadow (0.5→0.1 s delay, contradiction-window detection), and L9 phase 2's "your shots from 5 s ago" | Phase 9B (L5), extended 9C (L9) |
| S9 | **Movement predictor** | classifies the last 2–3 s of Vessel motion (line/arc/erratic) and forges intercept patterns; pairs with `heat.js` | Phase 9C (L7) |
| S10 | **Temporal loop** | L10 phase 3: record spawn *events* (not full state snapshots — simpler and deterministic) with timestamps; every 12 s reset player position + replay last loop's bullet events; boss HP and damage persist; the fold weakpoint appears during the 0.4 s reset | Phase 9C (L10) |

## 5. The ten levels (replaces LEVELS_PLAN §6's table)

Full mechanics, boss phase breakdowns, cutscene scripts, banter, and codex
text: **the bible is the spec** — bible section refs below. This table is the
engineering index. Every level is authored in the LEVELS_PLAN §2 schema; lint
runs on all of them (with C8 flags where marked).

| # | Level | Teaches | Systems | Lint flags |
|---|---|---|---|---|
| 01 | The Beige Slope (§04) | cast/interrupt | S2 | — |
| 02 | The Induction Parrot (§05) | weapon switch | S5, C6 | — |
| 03 | The Jester Unbound (§06) | bounded chaos / the clock | S6 | `allowHardFail` |
| 04 | The Smooth Operator (§07) | Profanity Key | S7, `profanity.js` | — |
| 05 | The Mirror Break (§08) | Mirror Counter | S8, C5 | — |
| 06 | The Redemption Arc (§09) | scar-shot discipline | boss-only mechanics + 180 s clock | `allowTimeout` |
| 07 | The Forge Wraith (§10) | erratic movement vs heat | S9, `heat.js` | — |
| 08 | The Drift Wraith (§11) | asymmetric play | `asymmetry.js` | — |
| 09 | The Witness's Shadow (§12) | self-contradiction | S8 extended | — |
| 10 | The Corrupted Seal (§13) | everything; 3 × 60 s phases | S6, S10 | boss-clock exempt |

Difficulty arc note: L1–L2 teach with the base archetypes, L3's hard-fail is
the first real teeth, L5 and L9 are the two self-fights (bookends — L9 reuses
and escalates L5's tech deliberately), L10 is the exam. The teach-test-twist
rule and rest-beat pacing (LEVELS_PLAN §4) apply within every level.

## 6. Milestones (replaces PLAN.md Phase 9's stage list)

PLAN.md Phases 0–8 build the same core they always did, with C2/C3/C4/C5/C6
amendments applied where those systems come up. Phase 1's placeholder level
and Phase 5's director/formations/lint work is unchanged. What was "Stage 1"
in Phases 5–6 is now **Level 01, The Beige Slope** (its terrain is the bible's
organic tunnel, its boss is the wall — the multi-part boss architecture from
ASSETS_PLAN §3 maps directly onto the wall's mouth array).

- **Phase 9A — Story core:** S1–S4, title screen with the seal (√π ∞ τ²),
  loadout screen, codex screen, L1 cutscenes + banter wired.
- **Phase 9B — Levels 2–5** in order (S5–S8 land with their levels).
- **Phase 9C — Levels 6–10** in order (S9–S10; L10's BETWEEN ending: boss
  dissolve → white arena → clean seal → cutscene 10B → credits with the seal
  as the final frame, exactly as scripted).

Each level fully playable (with cutscenes, banter, codex) before the next
starts. Stage-lint green on every authored level, always.

## 7. Register rules (binding on all in-game text)

- All player-facing story text — lines, codex, cutscenes, boss cast tags —
  comes **verbatim from the bible**. No paraphrasing, no censoring, no
  em-dash-ing it into shape. The profanity is load-bearing (L4 is a *mechanic
  built on it*). Do not add a profanity filter setting; the bible's whole
  §07 argument is that this register cannot be co-opted, and a toggle would
  co-opt it.
- Any *new* text the build needs that the bible doesn't provide (menu labels,
  tutorial prompts, error states) is written plain and dry — never in GUMOI's
  voice. Her voice comes only from the bible. If more of her lines are needed,
  that's a request to the author, not something to imitate.
- `reduceFlashing` still governs screen flashes (the L3 magenta integration
  flicker gets a non-flash alternative: sustained border glow). Accessibility
  settings shape presentation, never text.

## 8. What this supersedes (index of edits made alongside this doc)

- PLAN.md: fidelity table rows (one-hit death, 2-stage cannon, Force types),
  Phase 9 contents → §6 above; companion list includes this doc + the bible.
- LEVELS_PLAN.md §6: superseded-as-content notice pointing here (schema,
  formations, F-rules, lint all still law).
- ASSETS_PLAN.md R3: violet reservation (C7). Roster reinterpreted as
  archetypes (C9). Boss 1 concept ("Gatekeeper") replaced by the Beige Slope
  wall — the §3 part/core architecture transfers to it unchanged.
- SHIP_PLAN.md: palette/identity amendments per §3 (constraints and recipe
  structure unchanged).

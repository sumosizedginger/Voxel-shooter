# R-Type III Conversion Plan

**Mission:** Convert this repo (the Voxel Engine Kit) into a horizontal-scrolling
R-Type III–style shmup. This document is the authoritative build plan. It was
written after a full read of the engine source — file references and API
signatures below are real, not guessed. Follow the phases in order; each has a
definition of done.

**Companion documents** (same authority as this file):
[SHIP_PLAN.md](SHIP_PLAN.md) (player ship asset), [ASSETS_PLAN.md](ASSETS_PLAN.md)
(enemy roster, boss, Force/pickups, bullet visuals, terrain set, parallax),
and [LEVELS_PLAN.md](LEVELS_PLAN.md) (campaign structure, level data schema,
formation grammar, pacing/fairness rules, the five stages, stage-lint test).

**Status tracking:** As you complete each phase, check its boxes here and note
deviations in the "Deviation log" at the bottom. A follow-up review session will
verify the work against this document.

---

## 1. Ground rules

1. **Additive, not invasive.** All new game code lives under `src/shmup/`.
   Do not modify `src/engine/`, `src/voxel/`, `src/combat/`, or `src/audio/`
   except where this plan explicitly says so. The existing smoke test
   (`index.html`), both examples, and all specs in `tests/` must keep passing.
2. **Zero-build stays.** No bundler, no npm runtime deps. three r185 is vendored
   in `lib/three/`; every new HTML page needs the same import map `index.html`
   uses (`"three": "./lib/three/three.module.min.js"`, `"three/addons/": "./lib/three/addons/"`).
3. **Run tests with** `npm test` (`node tests/run-all.mjs`; needs Chrome/Edge —
   discovery + `CHROME_PATH` fallback is in `tests/harness.mjs`). Unit-only:
   `npm run test:unit`. Serve with `npm run serve` → http://localhost:8799.
4. **Add tests as you go**, in the existing style: a `*.spec.mjs` under `tests/`
   using `createSink` from `tests/harness.mjs`, registered in `tests/run-all.mjs`.
   Pure-logic modules (bullets, wave gauge, level director) should be written
   import-clean (no THREE, no window) exactly like `engine/collision.js` is, so
   they can be unit-tested headlessly.
5. **The game page is `game.html`** at repo root. `index.html` remains the
   engine smoke test. (We may promote game.html to index.html at the very end —
   not before.)
6. **Story is not designed yet.** Keep every content system data-driven
   (levels, waves, dialogue hooks) so narrative can be added later without
   refactoring. The cinematic camera rig in `renderer.js`
   (`setCineCamera`/`updateCineCamera`) is already built for cutscenes — leave
   hooks for it, don't build cutscenes yet.

---

## 2. Locked architecture decisions

Do not re-litigate these; downstream phases assume them.

### 2.1 Coordinate convention — gameplay is in the **XY plane at Z = 0**

- **X** = scroll direction. The level extends in +X. The ship faces +X.
- **Y** = vertical on screen (up is +Y).
- **Z = 0** for all gameplay entities (ship, bullets, enemies, terrain).
  Background parallax layers sit at negative Z (behind the play plane).
- Playfield vertical band: **y ∈ [0, 16]**, center **y = 8** (matches the
  engine camera's existing lookAt height).

### 2.2 Camera — auto-scroll, side-on, in a NEW module

`src/shmup/camera.js`. Do **not** edit `src/engine/renderer.js` — its exported
`camera` object is just repositioned every frame by our module (index.html does
the same thing; this is the intended pattern).

- Per frame: `camera.position.set(scrollX, 8, 22); camera.lookAt(scrollX, 8, 0);`
  where `scrollX` advances at the level's scroll speed. Starting values —
  tune by eye, don't bikeshed: camera z = 22, keep the engine's fov 65 initially;
  if perspective distortion at screen edges is objectionable, drop fov toward
  50 and pull z back to compensate.
- Reuse `visibleHalfWidthAt(z)` from `renderer.js` to compute the on-screen
  half-width at z=0; the vertical half-height visible at the play plane is
  `dist * tan(fov/2)` (dist = camera z). Export
  `playerBounds()` → `{minX, maxX, minY, maxY}` (with ~1 unit margin) so the
  ship clamp and the HUD agree on screen edges.
- Drive `level.backgroundLayers` parallax the same way `updateCamera` does:
  `layer.position.x = -camera.position.x * layer.userData.scrollRate`.
- Boss fights: scroll speed goes to 0 (scroll-lock); the camera holds position.
  Also support brief camera shake (offset, decay) for impacts — additive offset
  applied AFTER the base position, never accumulating.

### 2.3 Terrain collision — wrap `CollisionWorld` with a Y→Z remap

`engine/collision.js` is plain `{x, z}` math with zero three.js dependency, so
it works in any plane if you relabel an axis. Create `src/shmup/terrain.js`:

```js
import { CollisionWorld } from '../engine/collision.js';
// Internally stores boxes as {minX,maxX,minZ:minY,maxZ:maxY}.
export class Terrain {
    constructor() { this.cw = new CollisionWorld(); }
    addBox({minX, maxX, minY, maxY, id}) {
        return this.cw.addSolid({ minX, maxX, minZ: minY, maxZ: maxY, id });
    }
    removeBox(id) { this.cw.removeSolid(id); }
    blocked(x, y, half = 0.3) { return this.cw.blocked(x, y, half); }
    // For the Force pod grinding along walls:
    resolveMove(px, py, nx, ny, half = 0.3) {
        const r = this.cw.resolveMove(px, py, nx, ny, half);
        return { x: r.x, y: r.z };
    }
}
```

- **Player vs terrain = death** (R-Type rule): use `blocked()` overlap, not slide.
- **Force pod vs terrain = slide**: use `resolveMove()`.
- **Bullets vs terrain = despawn** (player bullets; most enemy bullets ignore terrain).
- Terrain boxes are registered by the level director alongside the visible
  voxel terrain meshes; keep box data and mesh data in the same level entry so
  they can't drift apart.

### 2.4 Entities and pools

- All moving gameplay objects live in flat arrays of plain JS objects with
  `{x, y, vx, vy, r (hit radius), hp, alive}` plus type-specific fields. No
  classes-per-enemy; behavior comes from pattern functions (§2.6).
- Hit tests are **circle overlaps**: `dx*dx + dy*dy < (r1+r2)^2`. At R-Type
  scale (≤ ~300 live bullets, ≤ ~40 enemies) brute-force N×M per frame is fine.
  Do NOT build spatial hashing unless profiling proves it needed.
- Rendering for bullets uses `THREE.InstancedMesh` (one mesh per bullet family),
  updated from the pool each frame — same technique as
  `engine/particles.js` (copy its `_dummy`/`setMatrixAt`/`needsUpdate` pattern,
  including parking dead instances at scale 0.001 far off-screen).
- The player's ship **hit radius is tiny relative to the model** — r ≈ 0.15
  when the visible ship is ~1.5 units. This is standard shmup design and
  non-negotiable for fairness.

### 2.5 Shared context

Populate `world` from `src/context.js` in `game.js`:
`world.terrain`, `world.bullets`, `world.enemyBullets`, `world.enemies`,
`world.player`, `world.particles`, `world.level`, `world.score`. Modules read
`world`, never `window`.

### 2.6 Enemy behavior = pattern functions

An enemy is data: `{ x, y, hp, r, score, pattern, patternState, mesh, fire, fireState }`.
`pattern(enemy, dt, world)` mutates position; `fire(enemy, dt, world)` emits
into `world.enemyBullets`. Ship a small library in `src/shmup/enemies/patterns.js`:
`straight`, `sineDrift`, `swoopIn`, `hoverAndAim` (turret aims at player),
`homingSlow`. Aimed shots compute `atan2(player.y - e.y, player.x - e.x)` at
fire time — no continuous homing for bullets except the dedicated homing type.

### 2.7 Persistence

Use `engine/settings.js` **as-is** (do not rename keys yet — `tests/settings.spec.mjs`
pins them; renaming is Phase 8 polish). The module preserves unknown progress
fields, so shmup progress goes through the existing API:
`setProgress({ rtype: { stageReached: 2, checkpoint: 3, loops: 0 } })`.
High scores already work via `addScore`. Difficulty multipliers
(`difficultyMultipliers()`) apply to enemy HP/damage at spawn time.

---

## 3. Phases

### Phase 0 — Scaffolding
- [ ] `game.html`: import map, fullscreen canvas comes from `renderer.js`
      (it appends its own canvas on import), minimal HUD `<div>` overlay,
      "click / press any key to start" gate (needed anyway: `initAudio()`
      requires a user gesture).
- [ ] `src/shmup/input.js`: keyboard (arrows + WASD move, Z/J fire & charge,
      X/K Force detach/recall, Esc/P pause) and Gamepad API (left stick/dpad,
      face buttons). Expose a polled snapshot: `input.axisX/axisY` (−1..1),
      `input.fire`, `input.firePressed`, `input.fireReleased`, `input.force`,
      `input.pause`. Edge-detection (`*Pressed/*Released`) computed once per
      frame in `input.update()`. Respect `getSetting('keybindings')` shape but
      defaults are fine for now.
- [ ] `src/shmup/game.js`: the state machine (`TITLE → PLAYING → DEATH →
      RESPAWN → GAMEOVER`, plus `PAUSED`) and the main loop:
      `dt = Math.min(0.05, clock.getDelta())` (engine convention),
      `renderer.info.reset()` once per frame (the engine sets
      `renderer.info.autoReset = false` — see renderer.js:37-43 — and the smoke
      spec pattern reads `renderer.info` to prove frames draw; keep the same
      test hook: `window.__engineKit = { renderer, composer, scene }`).
      Call `initLights()` once; `composer.render()` last.
- **Done when:** `game.html` shows a title screen over the skybox, transitions
  to an empty PLAYING state on input, pauses, and draws at 60fps with no
  console errors.

### Phase 1 — Camera + playfield
- [ ] `src/shmup/camera.js` per §2.2.
- [ ] A placeholder level object `{ scrollSpeed: 2.5, length: 300, backgroundLayers: [] }`.
- [ ] Debug overlay (toggle with backquote) showing scrollX, player bounds, fps.
- **Done when:** the camera glides right at constant speed over a ground of
  test voxel blocks, and the visible band matches `playerBounds()` (verify by
  placing marker meshes at the four corners).

### Phase 2 — Player ship + bullets + first blood (vertical slice)
- [ ] Ship asset: follow **[SHIP_PLAN.md](SHIP_PLAN.md)** (companion document —
      voxel recipe, palette, rig structure with separate emissive glow meshes,
      animation states, and its own spec + acceptance criteria). Key rule from
      it: baked voxel colors can't glow; bloom-lit parts (canopy, engine,
      muzzle) are separate emissive meshes, `buildGlowEyes`-style.
- [ ] `src/shmup/player.js`: movement — velocity from input axes ×
      speed (base 9 u/s), clamped to `playerBounds()`. Ship drifts forward
      automatically with the scroll (it must never be pushed off the left edge:
      min-x clamp does that inherently).
- [ ] `src/shmup/bullets.js` (import-clean, unit-testable): pool create/spawn/
      update/collide helpers operating on plain arrays. Separate pools for
      player shots and enemy shots. + `tests/bullets.spec.mjs`.
- [ ] `src/shmup/bulletmesh.js`: InstancedMesh renderer for the pools (THREE
      side, per §2.4).
- [ ] Basic shot: tap/hold fire → small bolts at 8/s, speed 24 u/s, despawn
      off-screen right (+2 units past bound).
- [ ] `src/shmup/enemies/` — pool + `patterns.js` (§2.6) + spawn function.
      Enemy models per **[ASSETS_PLAN.md](ASSETS_PLAN.md)** §2 (roster,
      registry pattern, shared-geometry rule). One test wave: five `sineDrift`
      drones entering from the right that die in one hit, explode (particles
      + sfx), and award score.
- [ ] Explosion FX: `world.particles.spawnDustBurst(x, y, 0, n)` works mid-air,
      but shards bounce on a y≈0 floor and the shockwave ring lies flat in XZ
      (`particles.js` assumes a ground plane). For Phase 2 use dust bursts
      only; Phase 8 adds a proper side-view explosion (see gotcha G4).
- [ ] SFX: extend the `sfx` object pattern — add `shoot`, `boom`, `hit` built
      from `playTone`/`playNoise` in a NEW `src/shmup/sfx.js` (don't edit
      `audio/synth.js`; import its primitives).
- [ ] Player death: any enemy, enemy bullet, or terrain overlap kills instantly
      → DEATH state (brief slow explosion) → respawn with 2s invulnerability
      (ship blinks) at the current scroll position. 3 lives → GAMEOVER.
- **Done when:** you can fly, shoot, kill the wave, die, respawn, and game
  over — the complete core loop, playable start to finish.

### Phase 3 — Terrain + checkpoints
- [ ] `src/shmup/terrain.js` per §2.3 + `tests/terrain.spec.mjs` (the remap:
      a box blocks at the right y; resolveMove slides in y).
- [ ] Level data gains terrain entries: modular chunks from ASSETS_PLAN.md §6
      (each chunk builder returns `{map, collisionBoxes}` together, and
      collision is always slightly smaller than the art).
- [ ] Checkpoints: an ordered list of scroll-x positions in level data. Death
      → respawn scrolls back to the last passed checkpoint and **respawns the
      wave state from that point** (classic R-Type: death rewinds; this
      requires the level director (Phase 5) to be restartable-from-x — design
      the director's API with `reset(toX)` from the start).
- **Done when:** flying into a floor/ceiling block kills; death rewinds to the
  checkpoint; terrain visuals and collision line up exactly (debug overlay
  draws collision boxes as wireframes).

### Phase 4 — Wave Cannon + Force pod + power-ups (the R-Type identity)

Visuals for everything in this phase: ASSETS_PLAN.md §4 (Force/bits/pickups)
and §5 (beam and bullet families).
- [ ] **Wave Cannon** (`src/shmup/wavecannon.js`, gauge logic import-clean +
      spec): hold fire to charge, 0→1 in 1.5s (stage 1), continue to 2 in
      another 1.5s (stage 2, R-Type III signature). Release fires a piercing
      beam: stage 1 = thick bolt (dmg 8, pierces 2 enemies), stage 2 =
      full-height-ish beam (dmg 20, pierces everything, brief screen shake).
      Charge gauge on HUD. Charging while moving is allowed; basic rapid fire
      is disabled while charging (hold = charge, tap = shot: distinguish by
      hold duration < 0.25s on release).
- [ ] **Force pod** (`src/shmup/force.js`): implement **Round Force** only
      (Shadow/Cyclone are Phase 9+ content, keep a `type` field). States:
      `DOCKED_FRONT`, `DOCKED_REAR`, `DETACHED`.
      - Docked: sits on the ship's nose (or tail), contact-damages enemies
        (continuous, ~10 dmg/s), blocks/absorbs enemy bullets that hit its
        radius (r ≈ 0.8), and changes the ship's shot per Force level.
      - Detach (button): launches forward ~12 u/s decaying to a hold position;
        detached Force keeps firing straight, still blocks bullets, still
        contact-damages, is affected by terrain via `resolveMove` (slides,
        never dies).
      - Recall (button again): eases back toward the ship, docks on contact —
        front or rear depending on which side it approaches from.
      - Force levels 1–3 (crystal pickups): level gates shot patterns
        (1: straight; 2: two-way diagonal; 3: wide three-way — exact patterns
        are tunable, structure isn't).
- [ ] **Power-ups** (`src/shmup/powerups.js`): POW-armor carrier enemy (slow,
      tanky, distinct look) drops a crystal on death; floating pickups drift
      left. Types: crystal (Force level up / spawns Force if absent), `M`
      missiles (adds a homing missile pair every 2s), `B` bit (small orbiting
      helper, max 2, absorbs bullets), `S` speed (+1.5 u/s, max 4 stacks).
- **Done when:** all four systems work together; losing a life keeps the Force
  (it detaches and drifts — it can be re-grabbed by the respawned ship, real
  R-Type behavior) but clears speed-ups to base.

### Phase 5 — Level director + Stage 1

This phase is specified in detail by **[LEVELS_PLAN.md](LEVELS_PLAN.md)** —
data schema (§2), formation grammar (§3), pacing (§4), fairness rules (§5),
Stage 1 brief (§6), stage-lint spec (§7), authoring tools (§8).
- [ ] `src/shmup/level/director.js` (import-clean core + spec): the FULL
      trigger vocabulary from LEVELS_PLAN §2 (wave, pickup, checkpoint,
      speed, lock, dialogue no-op, boss, end), fired once each when
      `atX <= scrollX`; `reset(toX)` for checkpoint rewind (§Phase 3),
      including the `recoveryOnly` pickup flag (LEVELS_PLAN §5 F1).
- [ ] `src/shmup/level/formations.js`: the formation library (LEVELS_PLAN §3).
- [ ] `src/shmup/level/stage1.js`: Stage 1 authored per LEVELS_PLAN §4–§6
      (~10–14 waves, 2 checkpoints with recovery pickups, escort/POW cadence,
      lock gauntlet, pre-boss breather). Parallax: 2–3 far layers at z ∈
      [−10, −30] with `userData.scrollRate` 0.2–0.6 (ASSETS_PLAN §7).
- [ ] `tests/stagelint.spec.mjs` (LEVELS_PLAN §7) + director spec.
- [ ] Authoring tools (LEVELS_PLAN §8): `?stage=&x=` URL params, `?god=1`,
      trigger timeline in the debug overlay.
- **Done when:** Stage 1 plays start → boss trigger with difficulty applied
  from `difficultyMultipliers()`, checkpoint rewind replays the right waves
  and spawns the recovery crystal only after a death, and stage-lint +
  director specs pass.

### Phase 6 — Boss
- [ ] `src/shmup/bosses/boss1.js`: one multi-phase boss. Structure (this is
      the part the old brawler's boss machine shape informs): a state machine
      of named phases with `{enter, update(dt), exit, hpGate}` transitioning
      at HP thresholds; **destructible parts** (each an entity with its own hp
      registered in `world.enemies`) whose destruction changes attacks; a weak
      core that's only vulnerable in some phases (classic R-Type: shoot the
      glowing core). Model, parts breakdown, and size (**16–20 world units
      long** — fills the locked screen, not multiple screens) per
      ASSETS_PLAN.md §3.
- [ ] Boss death: chained explosions over ~2.5s, big score, level end → stage
      clear tally (add `stageClearBonus` scoring) → back to TITLE (loop later).
- **Done when:** the full Stage-1 run is winnable and losable, and boss HP
  respects difficulty multipliers.

### Phase 7 — HUD + game flow + scoring
- [ ] HUD (DOM overlay in `game.html`, styled like the smoke test's `#hud`):
      score, hi-score (from `getScores()`), lives, wave-cannon gauge (two-stage
      color), Force level, speed pips. `reduceFlashing` setting: no full-screen
      flashes on death/beam when set.
- [ ] Title screen (start, difficulty select writing `setSetting('difficulty')`),
      pause overlay, game-over → continue (restart at checkpoint, score reset)
      or quit; stage-clear score tally; `addScore` on game over/clear.
- **Done when:** a stranger could sit down, understand, and play a full credit
  with only the HUD to guide them.

### Phase 8 — Polish + hardening
- [ ] Side-view explosion FX: add a new pooled burst to `src/shmup/fx.js`
      (radial shards in XY, no floor bounce, shockwave ring rotated to face
      camera — i.e. NO rotation.x, it already faces +Z when unrotated is
      wrong; set `rotation.x = 0` so the ring lies in XY). Muzzle flashes,
      beam charge glow (emissive sphere growing at the nose).
- [ ] Hide the kit's ambient petal rain in space levels
      (`particles.petalMesh.visible = false`) or recolor/repurpose as star
      specks.
- [ ] Quality tiers: verify `engine/quality.js` tiers still apply (showcase
      example binds them to keys 1/2/3 — do the same in a settings menu or
      keys).
- [ ] Music: a minimal looping sequencer on top of `playTone` (bass line +
      arp, `channel: 'music'`) in `src/shmup/music.js`. Data-driven note
      arrays so real compositions can replace placeholders later.
- [ ] Optional (only with all tests green and updated): rename storage keys in
      `settings.js` from `vsbeu.*` to `rtype.*` + update `tests/settings.spec.mjs`
      and the `window.vsbeuSettings` handle.
- [ ] `tests/shmup-smoke.spec.mjs`: puppeteer spec that loads `game.html`,
      starts a game via synthetic input, waits ~2s, asserts frames are drawing
      (`renderer.info` via `window.__engineKit`) and no page errors — mirror
      `tests/smoke.spec.mjs`.
- [ ] Update `README.md` (game section) and `CHANGELOG.md`.

### Phase 9 — Campaign buildout (Stages 2–5)

Governed entirely by **LEVELS_PLAN.md §6 + §9**: one stage at a time, in
order, each fully playable before the next starts. Per stage: new enemy
types (built to ASSETS_PLAN's template + registered so `assets.spec` covers
them) → terrain gimmick → triggers (stage-lint green) → boss → playtest pass
against LEVELS_PLAN §4 pacing and §5 fairness rules.
- [ ] Stage 2 — Derelict fleet (corridors, speed changes; shieldDrone, snake)
- [ ] Stage 3 — Bio caverns (destructible terrain; spore, burrower)
- [ ] Stage 4 — Foundry (timed crusher solids; fabricator, crusherPod)
- [ ] Stage 5 — Core (remix + scroll reversal; boss-rush finale)
- [ ] Campaign flow: stage clear → next stage; progress saved via
      `setProgress`; game clear → credits placeholder + `addScore` with
      clear bonus.
- **Done when:** a full 5-stage credit can be cleared and every stage passes
  stage-lint and the fairness rules.

---

## 4. R-Type III fidelity reference (design targets, tune freely)

| Mechanic | Target behavior |
|---|---|
| One-hit death | Always. No health bar for the ship. |
| Checkpoint rewind | Death rewinds the scroll; no mid-air respawn on bosses (respawn at boss start). |
| Wave Cannon | 2-stage charge (R-Type III's addition over R-Type II's single stage). Hyper Drive mode (gauge overheat mechanic) is a stretch goal — leave a TODO, don't build in v1. |
| Force pod | Invincible. Front/rear dock. Detach/recall. Blocks bullets. Contact damage. 3 levels via crystals. Round Force first; Shadow + Cyclone later. |
| Bits | Max 2, orbit above/below, absorb bullets, weak contact damage. |
| Missiles | Gentle homing, fire-and-forget pairs. |
| Speed-ups | Stacking, reset on death. |
| Scoring | Per-enemy values + stage-clear bonus; top-10 table already exists in `engine/settings.js`. |
| Difficulty | `easy/normal/hard` from settings → `difficultyMultipliers()` applied at spawn. |

## 5. Codebase gotchas (learned from reading the source — trust these)

- **G1** `renderer.info.autoReset` is `false` (renderer.js:43). The game loop
  MUST call `renderer.info.reset()` exactly once per frame or the smoke-test
  pattern (and any perf overlay) reads garbage.
- **G2** `initAudio()` no-ops silently until called from a user gesture; all
  synth calls before it are silent no-ops, not errors. Gate game start on input.
- **G3** Bloom threshold is 0.85 post-tonemap: things glow only via emissive
  materials (`emissiveIntensity` ≳ 1.5). Never lower the global threshold to
  make one thing glow (renderer.js:68-72 says the same).
- **G4** `ParticleSystem` assumes a ground plane: shards gravity-bounce at
  y≈0.04 and the shockwave ring is rotated flat into XZ. Mid-air dust bursts
  are fine; shard/shockwave calls will look wrong in a side-view space scene
  until Phase 8's fx module.
- **G5** `OutputPass` must remain the composer's final pass; insert any new
  pass before it (renderer.js:107-110).
- **G6** dt is clamped: `Math.min(0.05, clock.getDelta())` everywhere. Design
  movement in units/second and multiply by dt; never per-frame constants.
- **G7** The engine camera starts at the brawler position (0,14,22) on import.
  Our camera module overwrites it every frame — never rely on its initial pose.
- **G8** `combat/hitbox.js` + `combat/facing.js` are unused by the shmup.
  Leave them (tests pin them); do not delete.
- **G9** Tests launch real Chrome/Edge via puppeteer-core (`findChrome()` in
  harness.mjs). If none is found locally, browser specs are skipped/fail —
  `npm run test:unit` still validates the import-clean modules.
- **G10** Voxel maps are `Map` keyed by `"x,y,z"` built via `fillBox(map,
  x0,x1,y0,y1,z0,z1,color)` / `fillEllipsoid(...)` / `paint(...)`, then
  `buildVoxelGeo(map)` → one geometry with baked AO, `vertexColors: true`
  material, typically `mesh.scale.setScalar(0.12)` to bring voxel units to
  world units. Copy the recipe in `index.html:63-75` or the showcase.

## 6. Deviation log

(Record anything done differently than planned, with a one-line why.)

- _empty_

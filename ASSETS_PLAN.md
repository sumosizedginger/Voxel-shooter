# Enemy & World Asset Plan (companion to PLAN.md; sequel to SHIP_PLAN.md)

Everything that isn't the player ship: the Stage-1 enemy roster, the boss,
the Force pod / bits / pickups, bullet visuals, terrain set, and parallax
layers. SHIP_PLAN.md is the **template** — its constraints C1–C5 (baked vertex
colors can't glow → separate emissive meshes; `geo.center()`; +X facing;
per-asset voxel scale; `paint()` recolors only) apply to every asset here and
are not restated.

---

## 1. Shared rules for all assets

- **R1 — Registry pattern.** Every asset is a `build<Name>Map()` in
  `src/shmup/assets/` (import-clean, deterministic) plus rig assembly where
  needed. Export one registry from `src/shmup/assets/index.js`:
  `ASSETS = { drone: { buildMap, scale, dims, symmetricZ: true }, ... }` —
  the shared spec (§8) iterates it, so adding an asset automatically tests it.
- **R2 — Share geometry per type.** Build each enemy type's geometry ONCE at
  module init (`buildVoxelGeo` is not cheap); every spawned instance is a new
  `THREE.Mesh(sharedGeo, sharedMat)`. Never rebuild maps/geometry at spawn
  time. Boss parts are the exception (unique, built at boss load).
- **R3 — Glow codes allegiance.** Player + pickups glow **cool** (cyan/warm
  orange, established in SHIP_PLAN). Everything hostile glows **red/magenta**.
  No exceptions — this is the split-second readability contract.
- **R4 — Enemy bullets are the most visible thing on screen.** Unlit
  `MeshBasicMaterial`, saturated magenta, never occluded by FX. If a bullet is
  ever hard to see against a background, darken the background, not the bullet.
- **R5 — Death = shatter.** Enemies die like the ship: hide mesh, shard burst
  from their voxMap colors (`hash3` sampling, SHIP_PLAN §6). Small enemies
  ~8 shards, carriers ~20. Plus one dust burst + `sfx.boom`.
- **R6 — Palette lives in `src/shmup/palette.js`**, one file for the whole
  game (started in SHIP_PLAN §3). Enemy faction base colors:
  `foe: 0x4a3a56` (dusky violet hull), `foeDark: 0x2e2438`,
  `foeShell: 0x8a8494` (bone-gray armor), `foeGlow: 0xff2a5a` (hostile red),
  `foeBullet: 0xff40c0` (magenta), `crystal: 0x40a0ff`.
  Faction look: dark bio-mech — organic silhouettes, bone armor, red glow.
  Story-agnostic on purpose; it can become "the Bydo-alike" when the
  narrative lands.

## 2. Stage-1 enemy roster

Six types + the POW carrier. Sizes in world units (pick each asset's voxel
scale to hit them). Movement `pattern` / `fire` names refer to PLAN.md §2.6.
HP is base — `difficultyMultipliers()` applies at spawn.

| Type | Size | HP | Score | Pattern / fire | Look (silhouette beat) |
|---|---|---|---|---|---|
| `drone` | 0.8 | 1 | 100 | `sineDrift`, no fire | Round bug: `fillEllipsoid` body, two stub wings, single red glow-eye mesh. The popcorn enemy — dies to anything, spawned in chains of 5. |
| `darter` | 1.0 | 1 | 150 | `swoopIn`, 1 aimed shot at swoop apex | Slim arrowhead (a hostile echo of the player's silhouette), nose along **−X** (it flies left). Red engine glow at rear. |
| `gunpod` | 1.2 | 3 | 300 | `straight` (slow), fires 3-round aimed bursts | Boxy gun platform, visible barrel block that `hoverAndAim`-style tracks the player (rotate the barrel child mesh only, not the body). Adapt the showcase turret recipe (`examples/voxel-showcase.html:101`), muzzle painted, glow mesh at muzzle. |
| `crawler` | 1.0 | 2 | 200 | `straight` glued to floor/ceiling terrain (spawn flag `onCeiling` flips it), periodic straight-up/down shot | Dome + leg nubs, `fillEllipsoid` half sunk into the surface. Classic R-Type wall crawler. |
| `mine` | 0.6 | 1 | 50 | `homingSlow`, no fire, dies on contact (deals contact death) | Spiky ball: small ellipsoid + 6 single-voxel spikes, pulsing red glow shell (scale-pulse a transparent emissive sphere). |
| `lancer` | 1.6 | 4 | 400 | `sineDrift` (wide slow arc), fires a 2-way spread every 2.5 s | Segmented lance body — three ellipsoids in a row, tapering. Mid-tier threat for late stage. |
| `powCarrier` | 2.2 | 8 | 500 | `straight`, very slow, **no fire** | The POW armor: fat bone-gray shell, big friendly-obvious **blue crystal glow mesh** on top (the one hostile with cool glow — it signals the drop). Drops a pickup (§4) on death. Never lethal to touch? No — contact still kills (R-Type rules), but it never shoots. |

Recipe depth: give `drone`, `gunpod`, and `powCarrier` full coordinate
recipes in code comments (they're the archetypes — bug, platform, hauler);
the rest are variations Opus derives, keeping each type's silhouette beat
distinct **at 100% zoom against the dark background** — squint test: if two
types read the same at a glance, push shape before color.

## 3. Boss 1 — "the Gatekeeper" (placeholder name, story TBD)

Correction to PLAN.md Phase 6: a boss "40–60 units" would be several screens
wide — wrong. Target **16–20 world units long, 10–12 tall**: dominates the
scroll-locked screen with room for the player to maneuver in front.

- **Structure:** a `THREE.Group` of 4–6 **separately built parts**, each its
  own map/mesh/entity (so parts explode individually):
  - `hull` — the mass: layered ellipsoids, bone-shell over violet under-flesh
    (paint the crevices `foeDark`). Indestructible (hp ∞, blocks shots).
  - 2× `weaponPod` (top/bottom mounts) — destructible, hp ~30 each; firing
    origin for phase-1 spreads. Destroying both forces phase 2 early.
  - `core` — the weak point: a socket in the hull center holding a
    **large emissive sphere** (`foeGlow`, intensity 3+) behind two
    `shutter` voxel plates that open only when the boss attacks
    (phase-gated vulnerability, PLAN.md Phase 6). Core is the only part
    that takes damage in phases 2+.
  - `tail`/`jaw` cosmetic parts for silhouette (asymmetric is fine — flag
    `symmetricZ: false` in the registry).
- **Scale:** author chunky — voxel scale 0.2–0.25 so the whole boss stays
  ≤ ~8k voxels. Big voxels read as "armored monster", and `buildVoxelGeo`
  cost stays sane.
- **Phase presentation:** phase transitions get: shutter animation (slide the
  plate meshes, don't rebuild), hull flash (swap shared material's emissive
  briefly — clone the material for the boss, don't touch the registry one),
  camera shake, and a `sfx` sting. Death = staged shatter: parts explode in
  sequence over ~2.5 s (reuse R5 per part), core last with the big shockwave.
- Damage feedback on the core: brief `emissiveIntensity` spike per hit —
  never a full-screen flash (respect `reduceFlashing`).

## 4. Force pod, bits, pickups

- **Force pod** (`buildForceMap` + rig): sphere ~0.9 u — voxel ellipsoid core
  in `hull`/`panel` colors + **two glow meshes**: an equatorial ring
  (TorusGeometry, cyan, intensity 2) and a center orb. It reads as "yours"
  (cool glow, R3) and must be visually heavier than any bullet. Docked spin:
  slow roll about X; detached: faster spin + slight scale pulse. Force
  level 2/3 upgrades add small orbiting spark meshes (1 per level), not a
  rebuilt model.
- **Bits** (max 2): mini-Force, ~0.35 u — single glow orb + 3-voxel shell.
  No map needed if a plain emissive sphere + shell mesh reads fine — voxel
  purity is not a goal for sub-half-unit objects.
- **Pickups** (drift left at 1.5 u/s, gentle sine bob, despawn off-screen):
  shape+color coded, all with a soft glow shell so they pop:
  - `crystal` (Force level): blue octahedron gem (voxel diamond, 2 fills).
  - `missile` (M): red pickup — small missile silhouette.
  - `bit` (B): violet orb.
  - `speed` (S): green chevron (»).
  All four share one build helper parameterized by shape id. No letters on
  the voxel models (unreadable at 0.5 u) — readability comes from
  shape+color; the HUD names the pickup for 1.5 s on collect
  ("SPEED UP", R-Type's own convention).

## 5. Bullet & beam visuals (pairs with PLAN.md Phase 2/4 pools)

One `InstancedMesh` per family (PLAN.md §2.4), geometry trivial:

| Family | Geometry | Material | Size |
|---|---|---|---|
| Player bolt | thin box (0.5 × 0.08 × 0.08) | MeshBasicMaterial cyan `0x7fe0ff` | — |
| Player bolt lv2+ | same, scaled up per Force level | brighter cyan-white | — |
| Missile | tiny box + additive smoke: reuse dust burst per ~0.1 s | hull gray, orange glow tail | 0.3 |
| Enemy orb | sphere r 0.12 | MeshBasicMaterial `foeBullet` magenta (R4) | — |
| Enemy lance | stretched box | magenta→white gradient not possible per-instance — use white core box + magenta shell box, two instanced meshes moved together | 0.5 |
| Wave beam st.1 | single stretched capsule-ish box, 4 u long | emissive cyan, intensity 2.5 | grows from muzzle |
| Wave beam st.2 | full-width beam quad + edge boxes, ~2 u tall, screen-length | emissive white-cyan core, magenta-free | brief camera shake |

Beams are NOT pooled bullets: each is one mesh animated over ~0.4 s
(spawn → stretch → fade) with a swept damage region in the bullet system
(a moving segment test, not per-pixel).
Muzzle flashes and impact sparks: `spawnDustBurst` recolored — add a color
parameter via a tiny wrapper in `src/shmup/fx.js`, do not edit
`engine/particles.js` (its dust material is shared; clone a second
ParticleSystem-style pool in fx.js if a second color is needed — Phase 8
builds this out anyway, PLAN.md G4).

## 6. Terrain set (pairs with PLAN.md Phase 3/5)

Modular chunk builders in `src/shmup/assets/terrain.js`, each returning
`{ map, collisionBoxes }` — **the visual and its collision boxes are authored
together** (PLAN.md §2.3 "can't drift apart" rule, enforced at the asset level):

- `floorSlab(len)` / `ceilSlab(len)` — flat runs, top surface detailed with
  `paint` greebles (hash3 speckle, panel seams).
- `pillar(h)` — floor-to-ceiling obstacle.
- `ramp(len, rise)` — stepped diagonal (voxel staircase; collision = 2–3
  stacked boxes approximating the slope, kill-fair: boxes INSIDE the visual
  silhouette by ≥ 1 voxel so death never feels cheap — **rule: collision is
  always slightly smaller than the art**, everywhere, including enemies).
- `cavemouth()` — Stage-1 finale framing piece around the boss arena.
- Palette: industrial dark (`0x1c1830` base, `0x2e2848` face) with sparse
  `panel`-blue trim; NO glow meshes on terrain (bloom budget belongs to
  gameplay objects). Voxel scale 0.25 — chunky is right for walls, keeps
  vertex counts down on long slabs.

## 7. Parallax layers (Stage 1)

2–3 layers of big cheap silhouettes, z ∈ [−10, −30], hooked to
`level.backgroundLayers` (`userData.scrollRate` 0.2/0.4/0.6, PLAN.md §2.2):
distant derelict hulks / asteroid blobs — low-detail voxel builds at scale
0.5+, colors within 15% of the sky color (`0x0a0514`) so they read as depth,
not noise. The existing `engine/skybox.js` stays the far background. One
shared rule: nothing in a parallax layer may use `foeBullet` magenta or any
glow (R4 protection).

## 8. Tests & acceptance

- [ ] `tests/assets.spec.mjs` (pure node): iterates the §R1 registry —
      every entry: map non-empty, deterministic (two builds identical),
      fits declared `dims`, z-symmetric when `symmetricZ: true`.
      Terrain chunks additionally: every collision box lies strictly inside
      the map's voxel bounds (the "collision smaller than art" rule, §6).
- [ ] Squint test in `game.html`: all six enemy types on screen at once are
      distinguishable by silhouette alone; enemy bullets are the brightest
      objects; nothing hostile glows cool, nothing friendly glows red.
- [ ] Perf sanity: a heavy moment (30 enemies, 200 bullets, terrain, boss
      parts) holds 60 fps at quality 'high' on the dev machine — check
      `renderer.info.render.calls` stays < ~120 (shared geometry/material
      per R2 is what keeps draw calls flat).
- [ ] Boss part destruction visibly changes the boss (pod gone = socket
      stump painted `foeDark`, prepared as a swap mesh at build time).

## 9. Explicitly later

- Stage 2+ enemy types, Shadow/Cyclone Force models, alternate ship hulls.
- Any texture assets (the kit is untextured voxels + procedural — stay there).
- Narrative skins/naming for the faction — §1 R6's look is designed to
  accept a story without remodeling.

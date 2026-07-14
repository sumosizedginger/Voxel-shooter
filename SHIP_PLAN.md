# Player Ship Asset Plan (companion to PLAN.md Phase 2)

The plan for the player ship — an R-9 "Arrowhead"-inspired voxel fighter —
covering authoring, palette, rig structure, glow, animation states, and tests.
Written against the real kit APIs (`src/voxel/*`, `characters/builders.js`
glow technique, showcase ship recipe). PLAN.md's ground rules apply: new code
under `src/shmup/`, engine modules untouched.

**Design brief in one line:** a long, low, needle-nosed fighter that reads
instantly at ~120 px on screen, side-on, light hull against a dark space
background, with a visibly glowing engine and canopy.

---

## 1. Hard constraints (from the engine — don't fight these)

- **C1 — One material, baked colors.** `buildVoxelGeo(map)` bakes voxel colors
  + AO into vertex colors on a single geometry; the mesh uses one
  `MeshStandardMaterial({ vertexColors: true })`. There is **no per-voxel
  emissive**. Any part that must bloom is a **separate mesh** attached to the
  rig — this is the kit's own pattern (`buildGlowEyes` in
  `characters/builders.js:412`: `MeshStandardMaterial` with `emissive: color,
  emissiveIntensity: 2.8`). Painting a voxel a bright color (like the
  showcase ship's 0xffe27a tail) tints it but does NOT make it glow.
- **C2 — Geometry is emitted in raw voxel coordinates**, not centered. After
  building, call `geo.center()`, then treat the rig origin as the ship's
  center — which is also the gameplay hit center (r ≈ 0.15, PLAN.md §2.4).
- **C3 — Orientation.** Author the ship in voxel space with the **nose along
  +X, up along +Y, width along Z**, matching the gameplay convention (PLAN.md
  §2.1). No baked rotation on the mesh; the camera sees the XY side profile.
- **C4 — Scale.** Export `SHIP_VOXEL_SCALE = 0.1` (world units per voxel) from
  the ship module and use `mesh.scale.setScalar(SHIP_VOXEL_SCALE)`. (The kit's
  `palette.js` `S = 0.09` is the *character* invariant — don't reuse it; the
  ship defines its own.) Target visible size: **~1.9 × 0.6 world units**
  (length × height), i.e. ~19 × 6 voxels. Keep width ≤ 7 voxels so the thin
  profile doesn't smear under the perspective camera near screen top/bottom.
- **C5 — `paint()` only recolors existing voxels** — it can't add any. Fill
  shapes first, decorate after. `shadeHex(hex, f)` from `voxel/helpers.js` is
  the shading tool; `hash3` (voxel/core.js) for stable speckle, never
  `Math.random()` in the builder (the map must be deterministic — the death
  shatter and any test depend on that).

## 2. Files

| File | Contents | Import-clean? |
|---|---|---|
| `src/shmup/palette.js` | `SHIP_PALETTE` + shared shmup colors (enemy/bullet families live here too, one palette file for the whole game) | needs `three` only via helpers' `shadeHex` — fine in node |
| `src/shmup/assets/ship.js` | `buildShipMap()` → the voxel `Map`; `SHIP_VOXEL_SCALE`; `SHIP_DIMS` | yes — testable headlessly in node (three is a devDependency, already installed) |
| `src/shmup/assets/shipRig.js` | `buildShipRig()` → `{ rig, parts, voxMap }` — THREE.Group assembly: hull mesh + glow meshes | no (THREE mesh/scene side) |

The map/rig split mirrors PLAN.md's bullets/bulletmesh split: pure data
buildable in tests, THREE assembly separate.

## 3. Palette (starting values — tune by eye, keep the roles)

```js
export const SHIP_PALETTE = {
    hull:      0xcdd4e0,  // near-white gray-blue (R-9 homage), reads on dark bg
    hullDark:  0x8a94a8,  // belly / shaded panels (shadeHex(hull, ~0.68))
    panel:     0x3a4a6e,  // dark blue panel lines / intake trim
    accent:    0xd63b3b,  // red — wing edges, nose ring, fin tip
    canopy:    0x2a3050,  // dark voxels UNDER the canopy glow mesh
    engineTint:0xffb060,  // warm tint on tail voxels around the exhaust
    // Glow meshes (separate materials, not voxel colors):
    canopyGlow: 0x40c8ff, // cyan cockpit
    engineGlow: 0xff9a40, // warm orange exhaust
    muzzleGlow: 0x7fe0ff  // wave-cannon charge orb (PLAN.md Phase 4)
};
```

## 4. Voxel authoring recipe — `buildShipMap()`

Grid: x ∈ [−9, +9] (tail→nose), y ∈ [−2, +4], z ∈ [−3, +3], symmetric in z.
This is a concrete starting sketch — Opus should build it, look at it, and
iterate shapes/colors, keeping the silhouette beats (needle nose, canopy bump,
swept wings, tail fin, engine cavity):

```js
export function buildShipMap(P = SHIP_PALETTE) {
    const m = new Map();
    // 1. Wings FIRST (later fills overwrite): thin swept plates, one voxel thick
    fillBox(m, -6, -1, 0, 0, -5, 5, P.hullDark);      // main plane
    fillBox(m, -7, -4, 0, 0, -6, 6, P.hullDark);      // swept trailing edge
    paint(m, (x, y, z, c) => (Math.abs(z) >= 5 ? P.accent : null)); // red tips
    // 2. Fuselage: long low box + tapered nose
    fillBox(m, -8, 4, 0, 2, -2, 2, P.hull);           // main body
    fillBox(m, -8, 2, -1, -1, -1, 1, P.hullDark);     // belly keel
    fillBox(m, 5, 7, 0, 1, -1, 1, P.hull);            // taper
    fillBox(m, 8, 9, 0, 1, 0, 0, P.accent);           // needle / cannon barrel
    // 3. Canopy bump (dark voxels; the glow mesh sits on top of these)
    fillEllipsoid(m, 2, 3, 0, 2.4, 1.5, 1.3, P.canopy);
    // 4. Dorsal tail fin
    fillBox(m, -8, -5, 3, 4, 0, 0, P.hull);
    paint(m, (x, y, z, c) => (x === -5 && y >= 3 ? P.accent : null));
    // 5. Engine cavity tint at the tail
    paint(m, (x, y, z, c) => (x <= -8 ? P.engineTint : null));
    // 6. Panel lines: subtle vertical seams on the hull only
    paint(m, (x, y, z, c) =>
        (c === P.hull && ((x % 5) + 5) % 5 === 0 ? shadeHex(P.hull, 0.86) : null));
    return m;
}
```

Also export `SHIP_DIMS = { length: 19, height: 7, width: 13 }` (voxels,
including wings) — the spec asserts against these.

**Silhouette rules** (what makes it read as R-Type at small size):
- Nose is a thin **needle** — one voxel wide/tall at the tip. That's the
  wave-cannon mouth; the charge orb (Phase 4) grows exactly there.
- Long-low proportions: length ≥ 2.5× height ignoring the fin.
- Exactly one bump on top (canopy) — more bumps mud the profile.
- Wings read in the side view only as a thin dark line — that's correct;
  their swept shape shows during the banking roll (§6).

## 5. Rig assembly — `buildShipRig()`

```
rig (THREE.Group)                 ← rig.position = gameplay (x, y, 0); origin = hit center
├─ hull        Mesh(buildVoxelGeo(map) → geo.center(), MeshStandardMaterial
│              { vertexColors: true, roughness: 0.8 }), scale 0.1, castShadow = true
├─ canopyGlow  small box ~(0.45, 0.18, 0.28) world units, buildGlowEyes-style
│              material (emissive: canopyGlow, emissiveIntensity 2.0), sitting
│              flush on the canopy voxels
├─ engineGlow  box ~(0.12, 0.22, 0.3) at the tail (x ≈ −0.95), emissive
│              intensity animated (§6); plus a slightly larger transparent
│              MeshBasicMaterial shell (opacity ~0.35) for cheap halo
└─ muzzle      sphere r 0.1 at the nose tip (x ≈ +0.98), emissive
               muzzleGlow, scale 0.001 when idle — Phase 4's wave-cannon
               charge drives its scale (0 → 0.35 across the two charge stages)
```

Return `{ rig, parts: { engineMat, engineMesh, canopyMat, muzzle }, voxMap }`.
`voxMap` is exposed for the death shatter (§6). Keep all magic offsets as
named constants at the top of shipRig.js — they'll be tuned.

## 6. Presentation states (implemented in `player.js`, driven per frame)

- **Banking roll:** roll about the long axis with vertical input —
  `targetRoll = -input.axisY * 0.35` (radians), eased
  `rig.rotation.x += (targetRoll - rig.rotation.x) * (1 - Math.exp(-dt * 10))`
  (the engine's exponential-ease idiom, see renderer.js `updateCineCamera`).
  Plus a subtle pitch: `rig.rotation.z = input.axisY * 0.08`.
- **Thruster flicker:** `engineMat.emissiveIntensity = 2.2 + Math.sin(t * 37) * 0.5
  + speedStacks * 0.3`; stretch `engineMesh.scale.x = 1 + speedStacks * 0.25`.
  Use one shared time accumulator, not Date.now().
- **Respawn invulnerability:** blink by toggling `rig.visible` at 12 Hz for
  the 2 s window (PLAN.md Phase 2). If `getSetting('reduceFlashing')`, don't
  blink — render at fixed 50% opacity instead (swap to a cloned transparent
  hull material once, prepared at rig build time, not per frame).
- **Death shatter:** on death, hide the rig and iterate `voxMap`, calling
  `world.particles.spawnShard(worldPos, color, shipPos)` for every ~4th voxel
  (use `hash3(x,y,z) < 0.25` to pick — deterministic). Shard world position =
  rig position + (voxel − map center) × `SHIP_VOXEL_SCALE`. Kit shards
  gravity-bounce on a y≈0 floor (PLAN.md G4) — acceptable for v1, superseded
  by the Phase 8 fx module.
- **Idle:** no bobbing. The ship sits still when input is neutral; motion
  comes from the scrolling world (R-Type feel, and cheap).

## 7. Acceptance criteria

- [ ] Ship renders in `game.html` at ~1.9 world units long, correct
      orientation (nose +X), centered on its gameplay position.
- [ ] Debug overlay's hit-radius circle (r 0.15) falls entirely inside the
      fuselage core voxels — never inside wings/fin (those are cosmetic and
      must NOT kill the player).
- [ ] Canopy + engine visibly bloom at quality 'high'; ship still looks
      correct (just not glowing) at 'low'. Verify with keys 1/2/3 wired like
      the showcase.
- [ ] Banking roll shows wing sweep when moving vertically; returns to level
      within ~0.3 s of releasing input.
- [ ] Death shatter throws recognizably hull-and-accent-colored shards.
- [ ] `tests/ship.spec.mjs` (pure node, registered in `tests/run-all.mjs`):
      asserts `buildShipMap()` is non-empty, symmetric in z
      (every `(x,y,z)` has `(x,y,−z)`), fits inside `SHIP_DIMS` bounds,
      nose voxel exists at max-x with the accent color, and the map is
      deterministic (two calls produce identical maps).

## 8. Later / explicitly out of scope now

- Force pod, bits, and enemy ships get their own build functions in
  `src/shmup/assets/` following this same map/rig split — this document is
  the template, don't spec them here.
- Ship variants / selectable hulls: `buildShipMap(P)` already takes a palette;
  that's the only variant hook until the design calls for more.
- HUD lives icon: use text (`×3`) or a CSS triangle — do NOT render the voxel
  ship to a texture for the HUD.

# API Reference

Hand-curated, one section per module, in dependency order (renderer first, since
almost everything else assumes it's already running). Every export in `src/` is
listed. Units: world units unless noted; angles in radians; durations in seconds.

- [engine/renderer.js](#enginerendererjs)
- [engine/lights.js](#enginelightsjs)
- [engine/environment.js](#engineenvironmentjs)
- [engine/skybox.js](#engineskyboxjs)
- [engine/textures.js](#enginetexturesjs)
- [engine/quality.js](#enginequalityjs)
- [voxel/core.js](#voxelcorejs)
- [voxel/helpers.js](#voxelhelpersjs)
- [voxel/palette.js](#voxelpalettejs)
- [characters/builders.js](#charactersbuildersjs)
- [engine/particles.js](#engineparticlesjs)
- [engine/smear.js](#enginesmearjs)
- [audio/synth.js](#audiosynthjs)
- [engine/settings.js](#enginesettingsjs)
- [engine/collision.js](#enginecollisionjs)
- [combat/hitbox.js + combat/facing.js](#combathitboxjs--combatfacingjs)
- [context.js](#contextjs)
- [The `world` contract](#the-world-contract)
- [shmup/systems (GUMOI S2–S10)](#shmupsystems-gumoi-s2s10)

---

## `engine/renderer.js`

WebGL renderer, scene, camera, and the full postprocessing composer. Importing
this module has side effects: it creates the renderer, appends its `<canvas>`
to `document.body`, and wires a `window.resize` listener. Import it once,
early.

| Export | Signature | Notes |
|---|---|---|
| `scene` | `THREE.Scene` | Background `0x0a0514`, `FogExp2` density `0.0035`. |
| `camera` | `THREE.PerspectiveCamera` | FOV 65, near 0.4, far 400. Starts at a **locked 2.5D side view** (`position(0,14,22)`, `lookAt(0,8,0)`) — replace this block entirely for top-down/free-roam (see `examples/topdown-8way.html`). |
| `renderer` | `THREE.WebGLRenderer` | `antialias:true`, ACES tonemapping, sRGB output, PCF soft shadows. **Gotcha:** `renderer.info.autoReset = false` — the composer's internal passes each call `render()`, which would otherwise reset `info.render` every pass. Call `renderer.info.reset()` yourself once per frame if you read draw-call stats. |
| `composer` | `THREE.EffectComposer` | Pipeline: RenderPass → `bloomPass` → `vignettePass` → `rgbShiftPass` (disabled by default) → `filmPass` → `smaaPass` → `outputPass`. Call `composer.render()` instead of `renderer.render()`. |
| `bloomPass`, `vignettePass`, `rgbShiftPass`, `filmPass`, `smaaPass`, `outputPass` | `Pass` instances | Exposed so `quality.js` (or your own code) can toggle `.enabled` per tier. Any custom pass must be inserted **before** `outputPass` — nothing after it. |
| `onResize()` | `() => void` | Updates camera aspect, renderer size, composer size/pixel ratio. Call on `window.resize`. |
| `CAM_LOCK_AHEAD`, `CAM_LOCK_BEHIND` | `number` | How far the locked-side-view camera may lead/trail a scroll-lock trigger (8 / 2 units). Belt-scroller-specific — irrelevant if you replace the camera block. |
| `visibleHalfWidthAt(z)` | `(z: number) => number` | World-X half-width visible at depth `z`, from the *current* camera projection. Falls back to `24` before the first resize (aspect is `NaN`). Belt-scroller-specific. |
| `lockedTraverseBoundsX(scrollLockX, z, margin=2)` | `(...) => {min,max}` | X range a hero may walk during a scroll-lock. Belt-scroller-specific. |
| `updateCamera(target, level)` | `(target:{x,y,z}, level:object\|null) => void` | Follow-X-only rig for the locked side view, with optional scroll-lock clamping and parallax. Call once per frame if you keep the default camera. |
| `setCineCamera(shot)` | `(shot:{pos,look,duration?,roll?}) => void` | Hands camera ownership to a cinematic dolly rig (position + look-at + dutch-tilt easing). `duration` default `0.8`s. A cut (instant) happens when `duration<=0`, `reduceMotion` is on, or `window.__fastCutscenes` is set (test hook). |
| `clearCineCamera()` | `() => void` | Releases the camera back to `updateCamera`'s follow rig. |
| `cineCameraActive()` | `() => boolean` | True while the cine rig owns the camera. |
| `updateCineCamera(dt, level)` | `(dt:number, level:object\|null) => void` | Ticks the cine rig (eases toward the current shot, drives parallax). No-op if inactive. |

## `engine/lights.js`

| Export | Signature | Notes |
|---|---|---|
| `initLights()` | `() => {keySun, fillNeon, rimWarm}` | Adds one ambient + three directional lights to `scene`. Call once, after `renderer.js` is imported. `keySun` casts shadows (2048² map, `bias:-0.0005`). |
| `updateShadowFollow(cameraX)` | `(cameraX:number) => void` | Re-centers the key light's shadow frustum on the camera's X each frame — needed because the shadow camera's box is only ±30 units wide. Skip this if your game doesn't scroll on X. |
| `setShadowMapSize(size)` | `(size:number) => void` | Live-resizes the key light's shadow map (used by `quality.js`'s tiers); disposes the old map so it regenerates. |

## `engine/environment.js`

PMREM (image-based lighting) reflections, generated from whatever equirect
texture `skybox.js` has already loaded — no extra downloads. Tier-agnostic by
design (no import of `quality.js`, to avoid a cycle); callers decide when to
apply/clear based on the active tier.

| Export | Signature | Notes |
|---|---|---|
| `generateEnvironmentFromTexture(themeId, sourceTexture)` | `(string, THREE.Texture) => THREE.Texture\|null` | Generates (or returns the cached) PMREM env map for `themeId`. Returns `null` on failure (some headless/ANGLE GL contexts can't do PMREM) — callers must degrade gracefully, not crash. |
| `applyEnvironmentForTheme(themeId)` | `(string) => void` | Sets `scene.environment` from the cache (or `null` if that theme hasn't generated one yet). Also sets `scene.environmentIntensity = 0.6` where supported. |
| `clearEnvironment()` | `() => void` | Sets `scene.environment = null`. |

## `engine/skybox.js`

A shader sky dome with a hand-authored star field, optionally swapped for an
equirectangular texture per "theme". **Gotcha:** the four theme IDs
(`neon-city`/`tech-lab`/`alien-ship`/`mothership-core`) and their texture
paths (`src/assets/textures/skybox-*.png`) are inherited from the kit's
origin game and **no texture files ship with the kit** — `setSkyboxTheme()`
still works (the shader gradient is the fallback), but the texture path never
resolves. Either supply your own PNGs at those paths, or treat this module as
a worked example and swap in your own theme table.

| Export | Signature | Notes |
|---|---|---|
| `skyDome` | `THREE.Mesh` | Add to `scene` yourself: `scene.add(skyDome)`. `renderOrder = -1`, `side: BackSide`. |
| `setSkyboxTheme(themeId, tintHex=0xffffff)` | `(string, number) => void` | Sets the shader's top/mid/bottom gradient colors (tinted by `tintHex`), swaps in the theme's texture if it finished loading, and applies/clears the PMREM env map per the *current* quality tier. |
| `updateSkybox(time)` | `(time:number) => void` | Feeds the shader's star-twinkle `uTime` uniform. No-op while a texture is active. Call once per frame with a running clock. |

## `engine/textures.js`

Tileable ground/wall textures + HUD frame images, keyed by string. **Gotcha:**
same as `skybox.js` — the URLs under `TEXTURE_URLS` point at
`src/assets/textures/*.png`, which the kit doesn't ship. `loadTexture()` has
no error handler, so a missing file surfaces only as a console 404 and a
blank texture, not a thrown error. Supply your own assets at those paths or
rewrite `TEXTURE_URLS`.

| Export | Signature | Notes |
|---|---|---|
| `TEXTURE_URLS` | `Record<string,string>` | The path table described above. |
| `loadTexture(key, opts={})` | `(string, {repeat?:[number,number]}) => THREE.Texture\|null` | Cached by `key`. Sets `RepeatWrapping` on both axes. Returns `null` for an unknown key. |
| `groundTextureForTheme(theme)` / `wallTextureForTheme(theme)` | `(string) => THREE.Texture\|null` | Theme-name switches (`tech-lab`, `alien-ship`/`mothership-core`, else asphalt/concrete) with a hardcoded `repeat`. |
| `applyUIFrames()` | `() => void` | Sets CSS `background-image` on hardcoded DOM ids (`#combat-hud`, `#boss-bar`, `#star-meter-frame`, `#title-screen`). Only useful if your HTML uses those exact ids — otherwise a documented no-op. |

## `engine/quality.js`

Gates every optional-fidelity knob behind four named tiers so "max settings"
is opt-in.

| Export | Signature | Notes |
|---|---|---|
| `TIERS` | `{low,med,high,ultra}` | Each tier: `{pixelRatio, bloom, bloomStrength, shadowMap, env, postExtras, aberration, reflections}`. MSAA sample count is fixed at composer-construction time and is **not** re-tiered (recreating the render target at runtime isn't worth the risk). |
| `setQuality(name)` | `('low'\|'med'\|'high'\|'ultra') => void` | Applies pixel ratio, bloom on/off+strength, shadow map size, vignette/film/SMAA on/off, chromatic aberration on/off. Falls back to `'high'` for an unknown name. Reads/writes `world.level` (see [world contract](#the-world-contract)) and persists the choice to `localStorage['gfxQuality']` (best-effort — swallows storage errors). |
| `getQuality()` | `() => string` | Current tier name. |
| `cycleQuality()` | `() => string` | Advances low→med→high→ultra→low and applies it. Returns the new tier. |
| `initQuality()` | `() => void` | Call once at bootstrap, **after** renderer/composer/lights exist. Reads the initial tier from `?quality=` URL param, then `localStorage['gfxQuality']`, then defaults to `'med'` on coarse-pointer (touch) devices or `'high'` otherwise. |

## `voxel/core.js`

The meshing core: turns a sparse voxel map into one `BufferGeometry` with
baked ambient occlusion, in world units of `1` per voxel (character builders
then apply their own scale, see `voxel/palette.js`'s `S`).

| Export | Signature | Notes |
|---|---|---|
| `vkey(x, y, z)` | `(number,number,number) => string` | The map key format (`"x,y,z"`), integer coordinates. |
| `hash3(x, y, z)` | `(number,number,number) => number` | Deterministic pseudo-random `[0,1)` from a position — used for freckles/speckling/jitter, not `Math.random()`, so rebuilding the same map is stable. |
| `FACES` | `Array<{n,u,v}>` | The 6 face-normal/tangent tables `buildVoxelGeo` walks. Rarely needed directly. |
| `AO_LEVELS` | `[1.0, 0.82, 0.66, 0.5]` | Per-corner ambient-occlusion brightness multipliers, indexed 0 (no occluders) to 3 (fully enclosed corner). |
| `CORNER_SIGNS` | `[[-1,-1],[1,-1],[1,1],[-1,1]]` | Corner offset signs, CCW. |
| `buildVoxelGeo(map, jitterAmt=0.06)` | `(Map<string,number>, number?) => THREE.BufferGeometry` | Culls interior faces (only emits a face if the neighbor voxel is absent), bakes AO per-corner, and jitters each voxel's color by `hash3` so flat color fields don't look plastic. Attributes: `position`, `normal`, `color` (no `uv`). Pair with a `vertexColors:true` material. |

## `voxel/helpers.js`

Authoring helpers that write into a voxel `Map` (key = `vkey(x,y,z)`, value =
a color hex `number`).

| Export | Signature | Notes |
|---|---|---|
| `fillRow(m, cy, rx, rz, cx, cz, color)` | `(Map, number×5, number) => void` | Fills an elliptical disc of voxels at height `cy`, centered `(cx,cz)`, radii `(rx,rz)`. If either radius is `< 0.4` it degenerates to a single voxel at `(round(cx), cy, round(cz))` instead of a zero-area ellipse. |
| `fillEllipsoid(m, cx, cy, cz, rx, ry, rz, color)` | `(Map, number×6, number) => void` | Stacks `fillRow` calls from `cy-ry` to `cy+ry`, narrowing radii by the ellipsoid profile. Minimum row radius is clamped to `0.4` (never fully closes to a point). |
| `fillBox(m, x0, x1, y0, y1, z0, z1, color)` | `(Map, number×6, number) => void` | Inclusive-bounds axis-aligned box fill. |
| `paint(m, fn)` | `(Map, (x,y,z,color)=>number\|null\|undefined) => void` | Re-colors existing voxels in place: `fn` runs over every current entry and returning a new color hex overwrites it; returning `null`/`undefined`/the same color leaves it untouched. Does **not** add new voxels — it can't paint outside what's already filled. |
| `shadeHex(hex, f)` | `(number, number) => number` | Multiplies a hex color's RGB by `f` (clamped to `1.0` per channel) and returns a new hex. Shared scratch `THREE.Color` — not safe to call reentrantly mid-callback, but fine in normal sequential use. |

## `voxel/palette.js`

| Export | Signature | Notes |
|---|---|---|
| `S` | `number` (`0.09`) | World units per voxel — the scale factor every character mesh applies (`mesh.scale.setScalar(S * k)`). Treat as a locked constant if you mix kit-built and hand-authored geometry. |
| `SKIN`, `SKIN_D`, `SKIN_D2`, `HAIR`, `HAIR_D`, `HAIR_L`, `BEARD`, `BEARD_D`, `FRECK`, `BELT`, `BELT_D`, `MAW`, `MAW_D`, `GOLD`, `CREAM`, `EYE_W`, `PUPIL`, `BROW`, `MOUTH`, `TEETH` | `number` (hex) | The kit's demo palette constants (a warm-skinned, orange-haired figure). `MAW`/`MAW_D` are legacy aliases for `BELT`/`BELT_D`. |
| `SUMO_PALETTE` | `Record<string,number>` | The constants above assembled into the `palette` object shape `characters/builders.js` expects (`skin`, `skinDark`, `hair`, `belt`, `gold`, …, plus clothing aliases `shirt`/`jeans`/`pants`/`jacket`/`cap`/`overall`, all defaulted from `BELT`/`HAIR`). Pass your own palette object with the same keys to reskin. |

## `characters/builders.js`

Palette-parameterized humanoid part builders. Each returns a voxel `Map` —
run it through `buildVoxelGeo` to get a mesh.

| Export | Signature | Notes |
|---|---|---|
| `TORSO_PROFILE`, `HEAD_PROFILE` | `Array<[rx,rz,zOffset?]>` | Per-row radius profiles (torso rows 0–23 hips→neck; head rows 0–11). `DEFAULT_TORSO_PROFILE`/`DEFAULT_HEAD_PROFILE` are aliases of the same arrays. |
| `scaleProfile(profile, factor)` | `(Array, number) => Array` | Scales every row's radii by `factor` (z-offset untouched) — for slimmer/bulkier variants. |
| `buildTorso(palette=SUMO_PALETTE, profile=TORSO_PROFILE, options={})` | `(...) => Map` | `options.clothingMode`: `'belt'` (bare-chested, default) \| `'mawashi'` (alias of belt) \| `'casual'` (shirt+jeans, optional `palette.overall` for straps) \| `'punk'` (jacket+pants+boots+random spikes). **Gotcha:** bare-chest anatomy (pecs, navel) is authored at the un-scaled SUMO profile's coordinates — a heavily `scaleProfile`'d torso in `'belt'` mode can show floating detail; clothed modes hide it (`shadeClothedChest` fakes a seam instead). |
| `buildHead(palette=SUMO_PALETTE, profile=HEAD_PROFILE, options={})` | `(...) => Map` | `options`: `beard` (boolean), `cap` (boolean), `mohawk` (boolean), `topknot` (boolean, legacy alias `chonmage`), `style:'sumo'`. With no options at all it defaults to the full sumo look (beard + topknot). |
| `buildArm(palette=SUMO_PALETTE, sideSign=1)` | `(...) => Map` | `sideSign`: `1` = right arm, `-1` = left (mirrors the wrist/hand detail). |
| `buildLeg(palette=SUMO_PALETTE, sideSign=1, options={})` | `(...) => Map` | `options.clothingMode` as above; only `'belt'`/`'mawashi'` leave the leg bare, everything else trousers it. |
| `buildGlowEyes(palette)` | `(palette) => {left, right, mat, geo}` | Two emissive `BoxGeometry` meshes (not voxels) for enemy/NPC eyes — bloom picks them up. Position them yourself relative to a head (default offsets assume the stock `HEAD_PROFILE` scale). Caller owns `mat`/`geo` disposal. |

## `engine/particles.js`

| Export | Signature | Notes |
|---|---|---|
| `ParticleSystem` | `class` | `new ParticleSystem(scene)` immediately adds four `InstancedMesh` pools to `scene`: 220 falling petals (always animating), 80 dust puffs, 1 shockwave ring, 600 shatter shards. |
| `.spawnShard(worldPos, colorHex, originPos)` | `(THREE.Vector3, number, {x,z}?) => void` | Launches one shard from the pool outward from `originPos` (defaults to `worldPos` itself, i.e. no outward bias) with gravity + a ground bounce. Silently no-ops if the pool (600) is full. |
| `.spawnDustBurst(x, y, z, count)` | `(number×3, number) => void` | Activates up to `count` idle dust particles at that point (capped by the 80-particle pool). |
| `.impact(power, dustN, x, y, z)` | `(number, number, number×3) => void` | Convenience: dust burst + triggers the shockwave ring at that point. `power` is currently unused (kept for call-site symmetry with the origin game). |
| `.update(dt)` | `(number) => void` | Call once per frame. Advances all four pools and marks their `instanceMatrix`/`instanceColor` dirty. |

## `engine/smear.js`

Pooled attack-arc "swing trail" meshes.

| Export | Signature | Notes |
|---|---|---|
| `spawnSmear(opts)` | `({position, facing=1, plane='horizontal', radius=2, color=0xffffff, tilt=0.22, ring=false}) => void` | `plane`: `'horizontal'` (flat XZ arc, belt-scroller default) \| `'vertical'` (downward chop) \| `'forward'` (facing-relative diagonal) \| `'rising'` (uppercut). `ring:true` uses a full annulus instead of a fan — for genuinely omnidirectional attacks (pair with `hitboxCheck`'s `move.omni`). Reuses the oldest of a 4-slot pool once saturated — a spin attack into a crowd never grows geometry. Respects `getSetting('reduceMotion')` (shrinks radius 35%). |
| `updateSmears(dt)` | `(number) => void` | Call once per frame: fades and retires active smears (`LIFETIME = 0.12`s), expanding them slightly as they fade. |
| `activeSmearCount()` | `() => number` | Count of currently-live smears — mainly useful in tests asserting the pool doesn't grow unbounded. |
| `disposeSmears()` | `() => void` | Removes the pool from the scene and disposes its materials/geometry. Call on a full teardown (e.g. leaving a level in a multi-scene app); the pool lazily recreates on the next `spawnSmear`. |

## `audio/synth.js`

Dependency-free WebAudio synthesis. Nothing plays until `initAudio()` runs
(browsers require a user gesture first).

| Export | Signature | Notes |
|---|---|---|
| `initAudio()` | `() => void` | Creates the `AudioContext` + a 0.6s white-noise buffer. Idempotent (no-ops if already initialized). Call from a click/keydown handler. |
| `setVolumes(v)` | `({master?, sfx?, music?}) => void` | Merges into the internal volume state; `playTone`/`playNoise` multiply their `vol` argument by `master × channel`. |
| `playTone(type, f0, f1, dur, vol, lp?, channel='sfx')` | `(OscillatorType, number, number, number, number, number?, string?) => void` | An oscillator that exponentially glides `f0→f1` over `dur` seconds while its gain decays to ~0, optionally lowpass-filtered at `lp` Hz. No-ops before `initAudio()` or if the effective volume rounds to silence. |
| `playNoise(dur, vol, fType, f0, f1?, q?, channel='sfx')` | `(number, number, BiquadFilterType, number, number?, number?, string?) => void` | Plays the shared noise buffer through a biquad filter, optionally sweeping `f0→f1`, `Q` defaulting to `0.8`. |
| `sfx` | `{stomp, slap, kick, grab, heave, whoosh, step, land, block}` | Pre-tuned combinations of the two primitives above — a ready-made hit/footstep/guard palette. Call directly, e.g. `sfx.kick()`. |
| `audioCtx` | `AudioContext \| null` | The live context (or `null` before `initAudio()`), exported mainly for advanced/custom routing. |

## `engine/settings.js`

The single owner of all persisted state (settings, campaign-style progress,
high scores). Import-clean by design — no `three` dependency, safe to unit
test headlessly. Degrades to in-memory-only if `window.localStorage` is
absent or throws (private-browsing modes); never throws itself.

| Export | Signature | Notes |
|---|---|---|
| `SETTING_DEFAULTS` | `object` | `difficulty:'normal'`, `masterVolume`/`sfxVolume`/`musicVolume:1`, `reduceFlashing`/`reduceMotion`/`reduceHorrorAudio:false`, `alwaysShowDialogue:false`, `keybindings:null`, `lastHero:0`. Several fields (`reduceHorrorAudio`, `alwaysShowDialogue`) are named for the origin game's genre — harmless to ignore, or rename in your fork. |
| `getSetting(key)` / `setSetting(key, value)` | `(string) => any` / `(string, any) => void` | `setSetting` no-ops on an unchanged value (reference/`===` compare), otherwise persists and notifies listeners. |
| `onSettingChange(fn)` | `((key,value)=>void) => unsubscribeFn` | `fn` errors are caught per-listener so one bad subscriber can't break the others. |
| `getProgress()` / `setProgress(patch)` | `() => object` / `(Partial<object>) => void` | `setProgress` shallow-merges `patch` into the live progress object and persists. Progress shape: `highestLevel`, `heroCompletions:{}`, `introSeen`, `bossIntroSeen:[]`, `contentWarningAck`, `hintsSeen:[]`, `tutorialDone`, `unlockedEndings:[]` — again, several fields are origin-game flavored; keep or repurpose. |
| `markProgressFlag(arrayField, id)` | `(string, any) => void` | Appends `id` to `progress[arrayField]` if it's an array and doesn't already contain it (no-op on a non-array field). |
| `getScores()` / `addScore(entry)` | `() => Array` / `({score,hero?,ending?,date?}) => Array` | `getScores` returns a copy. `addScore` inserts, sorts descending by `score`, and truncates to the top 10. |
| `difficultyMultipliers()` | `() => {enemyHp, enemyDmg}` | `easy: {0.7, 0.7}`, `hard: {1.3, 1.25}`, else `{1, 1}`. |
| `resetAll()` | `() => void` | Restores every in-memory field to its default (fresh array/object instances — never aliases `SETTING_DEFAULTS`/`PROGRESS_DEFAULTS`) and clears all three `localStorage` keys. |

## `engine/collision.js`

Genre-neutral AABB collision on the XZ ground plane. No `three` dependency —
operates on plain `{x,z}` numbers, fully portable.

| Export | Signature | Notes |
|---|---|---|
| `CollisionWorld` | `class` | `new CollisionWorld()` starts empty — every `resolveMove` is a pass-through until you register solids. |
| `.addSolid(box)` | `({minX,maxX,minZ,maxZ,id?}) => id` | Registers a static box; returns its id (auto-incrementing if you don't supply one — supply your own, e.g. a destructible's id, so you can `removeSolid` it later). |
| `.removeSolid(id)` | `(id) => void` | No-op if the id isn't found. |
| `.clear()` | `() => void` | Drops every solid. |
| `.blocked(x, z, half=0.4)` | `(number, number, number) => boolean` | True if a `half`-extent square centered at `(x,z)` overlaps any solid. |
| `.resolveMove(px, pz, nx, nz, half=0.4)` | `(number×4, number) => {x,z}` | Slides a mover of half-extent `half` from `(px,pz)` toward `(nx,nz)`: resolves X first (holding the old Z), then Z with the corrected X — the standard axis-separated wall-slide. Swept per axis, so one large single-frame step can't tunnel through a thin wall. |

## `combat/hitbox.js` + `combat/facing.js`

The kit's headline claim: a melee reach test that's numerically identical to
a classic side-scroller's X-signed cone when facing is pinned to `±X`, but
turns freely when facing carries a real Z component. See
[tests/hitbox.spec.mjs](../tests/hitbox.spec.mjs) for the equivalence proof
this is checked against on every CI run.

| Export | Signature | Notes |
|---|---|---|
| `hitboxCheck(attacker, defender, move)` | `({root,state,hitRadius?}, {root,state?,hitRadius?}, {range,depthTolerance,vertical,omni?}) => boolean` | `attacker.root.position` / `defender.root.position` are `{x,y,z}`. Facing comes from `attacker.state.facingVec` (unit XZ vector), falling back to `{x: state.facing\|\|1, z:0}` for plain scalar-facing objects. Gates, in order: lateral (`\|lateral\| <= depthTolerance + r`), forward (`omni`: `\|forward\| <= range + r`; else `forward >= -min(r,0.6)` and `forward <= range + r`), vertical (`\|dy\| <= vertical + r`). `r = defender.hitRadius \|\| 0` (a **top-level** property, not on `.state`). Returns `false` immediately if `defender.state.current === 'DEAD'`. All tolerances are world units, not pixels. |
| `makeFacing(initialX=1)` | `(number) => state` | Returns `{facingVec:{x,z}, facing (getter/setter), setFacing(x,z=0), setFacing8(x,z)}`. `setFacing` normalizes and ignores near-zero input (keeps the last facing — a standing entity doesn't snap to origin). `setFacing8(x,z)` snaps each axis to its sign before normalizing (8-way/compass aim). Assigning `.facing = ±1` resets `facingVec` to pure X (the belt-scroller escape hatch: legacy code that only ever touches `.facing` keeps working exactly as before vectorization). |

## `context.js`

| Export | Signature | Notes |
|---|---|---|
| `world` | `object` (starts `{}`) | The one shared mutable handle every module that needs cross-cutting state reads through, instead of a `window` global. Deliberately has zero imports so any module can import it without creating a cycle. Empty by default — see the contract below. |

## The `world` contract

`context.js` exports an empty object; the kit's own modules only ever read
**one** key off it today:

| Key | Read by | Shape expected | If absent |
|---|---|---|---|
| `world.level` | `engine/quality.js` (`setQuality`) | `{ theme?: string, _reflector?: { visible: boolean } }` | Skipped entirely — `setQuality` just calls `clearEnvironment()` instead of applying an environment map, and never touches `_reflector`. Perfectly safe to never set `world.level` at all if your game has no concept of "levels". |

Everything else the README's "Wiring a new game" section suggests
(`world.collision`, `world.particles`, `world.characters`) is **your**
convention, not something any kit module reads — populate `world` with
whatever your own systems find convenient; the kit itself won't look for it.
This is the kit's one implicit-coupling trap: it's easy to assume more of the
kit is wired through `world` than actually is. If you're porting code out of
a game that used a richer `world` (levels, waves, narrative state), only
`world.level.theme`/`world.level._reflector` need to survive the port for
`quality.js` to keep working — everything else was that game's own
convention layered on top of the same empty object.

---

## `shmup/systems` (GUMOI S2–S10)

Story and signature systems for **GUMOI: The Lattice Break**. All under
`src/shmup/systems/`. Import from individual files or `systems/index.js`.
Most modules are import-clean (no THREE) except `cutscene` (host injects
cine helpers) and `words.makeWordTexture` (needs `document` + THREE).

See [COMPLETION.md](../COMPLETION.md) and [NARRATIVE_PLAN.md](../NARRATIVE_PLAN.md) §4.

| Module | Role | Key exports |
|---|---|---|
| `cast.js` | S2 cast/interrupt | `startCast`, `tickCast`, `interruptCast`, `maybeAssignCast` |
| `copybuffer.js` | S5 mimic fire | `fireMimic`, `recordShot`, `clearBuffer` |
| `modifiers.js` | S6 arena mods | `createModStack`, `pushMod`, `hasMod`, `transformInput`, `screenPushDelta` |
| `profanity.js` | S7 Profanity Key | `createProfanity`, `tryProfanity`, `updateProfanity` |
| `words.js` | S7 word effects | `WORD_EFFECTS`, `applyWordHit` (load-bearing); `makeWordTexture` used by `bulletmesh` word sprites |
| `loadout.js` | Pre-mission Council seats | `normalizeLoadout`, `saveLoadout`, `loadSavedLoadout`, `cycleSeat` |
| `council.js` | Seat table (import-clean) | `COUNCIL`, `DRONE_TYPES`, `MAX_DRONES` |
| `level/stagecraft.js` | L02–10 stage feel | `buildStageTerrain`, `parallaxLayers`, `skyForLevel` |
| `assets/parallax.js` | Theme silhouettes | `parallaxForLevel`, per-theme builders |
| `assets/bossBodies.js` | Boss 02–10 shapes | `buildBossBody`, `BOSS_BODY_BUILDERS` |
| `assets/diorama.js` | Cutscene props | `createCutsceneDiorama`, `disposeDiorama` |
| `inputrec.js` | S8 recorder | `createRecorder`, `recordFrame`, `sampleAt` |
| `heat.js` | L7 heat meter | `createHeat`, `updateHeat`, `heatWeaponsOffline` |
| `predictor.js` | S9 motion class | `createPredictor`, `recordMotion`, `interceptAngle` |
| `asymmetry.js` | L8 scorer | `createAsymmetry`, `updateAsymmetry`, `asymmetryDamageMult` |
| `temporal.js` | S10 τ² loop | `createTemporalLoop`, `startTemporal`, `updateTemporal` |
| `cutscene.js` | S3 cine player | `createCutscenePlayer`, `playCutscene`, `updateCutscene`, `levelOpenCutscene` |

### Level `systems` bag

Each campaign level may set:

```
systems: {
  cast, mimic, modifiers, profanity, shadow, shadowDelay, shadowRamp,
  contradiction, replayShots, heat, predictor, asymmetry, temporal
}
```

`game.js` `armLevelSystems()` wires these into `world.*` for the boss/player loop.

### Controls (shmup)

| Action | Default | Notes |
|---|---|---|
| God mode | `G` (`input.god` / `KeyG`) | **Full immunity** (`world.godMode`): no chip, contact, terrain, or boss-wall death; hull held full; score not recorded. `setGodMode` / `toggleGodMode` / `isGodMode` on `window.__gumoi`. Badge `#godBadge`. |
| Profanity Key | `F` | Cancels nearest `onlyProfanity` word-bullet (1.2 s CD). Witness will **not** absorb those. |
| Debug overlay | `` ` `` (Backquote) | Collision wires + timeline |
| Skip cutscene | Fire / Enter | After 0.35 s grace in `CUTSCENE` state |
| Dev mode | Ctrl ×10 or `?dev=1` | God (immune) + debug + skip cutscenes/tips. **`[` / `]`** previous/next level; **Shift+1…0** jump to L1–L10. `setDevMode` / `isDevMode` on `window.__gumoi`. Badge `#devBadge`. |
| Author URL | `?god=1`, `?dev=1`, `?skipcs=1`, `?skiptips=1`, `?x=` | See README |

`input.js` bindings include `god: ['KeyG']` and `profanity: ['KeyF']` (gamepad:
button 10 / 6 respectively). Level skip keys are hard-coded in `game.js` while
`devMode` is on (not rebindable).

Gameplay HUD (`#hud`) is visible only in PLAYING / PAUSED / DEATH / RESPAWN.
Boss bar and system meter use the same gate.


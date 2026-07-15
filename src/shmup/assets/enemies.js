// src/shmup/assets/enemies.js
// Purpose: the enemy archetype voxel maps — pure data, deterministic.
// Dependencies: voxel/helpers.js, ../palette.js
//
// ASSETS_PLAN §2, reinterpreted by NARRATIVE_PLAN C9: these seven are
// BEHAVIORAL archetypes. Each level reskins them to its theme (L1's beige
// "suggestion" drifters, L2's mimic-drones, L3's splitting clowns...) by
// passing a different palette — the silhouettes stay, the colors change.
// That's why every builder takes `P`.
//
// Squint rule (ASSETS_PLAN §8): if two types read the same at a glance, push
// SHAPE before color. Each one below has exactly one silhouette beat:
//   drone   round bug        darter  arrowhead (points LEFT — it flies at you)
//   gunpod  boxy + barrel    crawler flat dome (half-sunk in the wall)
//   mine    spiky ball       lancer  three-segment spine
//   carrier fat hauler with a crystal on its back

import { fillBox, fillEllipsoid, paint, shadeHex } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';
import { FOE_PALETTE, PICKUP_PALETTE } from '../palette.js';

// ── drone: the popcorn. Dies to anything. Spawned in chains of five.
export function buildDroneMap(P = FOE_PALETTE) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 3.2, 2.6, 2.6, P.foe);      // body
    fillBox(m, -1, 1, 2, 2, -5, 5, P.foeDark);            // stub wings
    fillEllipsoid(m, 2, 0, 0, 1.2, 1.6, 1.6, P.foeShell); // face plate
    paint(m, (x, y, z, c) => (c === P.foe && hash3(x, y, z) > 0.82
        ? shadeHex(P.foe, 1.2) : null));                  // speckle, not noise
    return m;
}

// ── darter: a hostile echo of the Vessel's own arrowhead. Nose along -X.
export function buildDarterMap(P = FOE_PALETTE) {
    const m = new Map();
    fillBox(m, -2, 5, 0, 1, -1, 1, P.foe);                // body
    fillBox(m, -6, -3, 0, 0, 0, 0, P.foeShell);           // the needle, pointing left
    fillBox(m, -1, 3, 0, 0, -4, 4, P.foeDark);            // swept wings
    fillBox(m, 4, 5, 2, 3, -1, 1, P.foeDark);             // tail fin
    paint(m, (x, y, z) => (Math.abs(z) >= 4 ? P.foeShell : null));
    return m;
}

// ── gunpod: a platform with a visible barrel. The barrel is a SEPARATE mesh
//    (it rotates to track the player); this map is the body only.
export function buildGunpodMap(P = FOE_PALETTE) {
    const m = new Map();
    fillBox(m, -4, 4, -3, 3, -3, 3, P.foe);               // chassis
    fillBox(m, -4, 4, 4, 4, -3, 3, P.foeShell);           // top armor
    fillBox(m, -4, 4, -4, -4, -3, 3, P.foeShell);         // bottom armor
    fillBox(m, -5, -5, -2, 2, -2, 2, P.foeDark);          // rear vent
    paint(m, (x, y, z, c) =>
        (c === P.foe && ((x % 3) + 3) % 3 === 0 ? shadeHex(P.foe, 0.8) : null));
    return m;
}

/** The gunpod's barrel — its own map so it can pivot independently. */
export function buildGunpodBarrelMap(P = FOE_PALETTE) {
    const m = new Map();
    fillBox(m, 0, 6, -1, 1, -1, 1, P.foeShell);
    fillBox(m, 6, 7, -1, 1, -1, 1, P.foeDark);            // muzzle (glow mesh here)
    return m;
}

// ── crawler: half a dome. It lives ON the wall, so it's flat on one side.
export function buildCrawlerMap(P = FOE_PALETTE) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 4, 3.4, 3.4, P.foeShell);
    // Slice off everything below y=0 — the flat face is what it stands on.
    for (const k of [...m.keys()]) {
        if (+k.split(',')[1] < 0) m.delete(k);
    }
    fillBox(m, -3, 3, 0, 0, -3, 3, P.foeDark);            // the sole
    fillBox(m, -4, -4, 0, 1, -1, 1, P.foe);               // leg nubs
    fillBox(m, 4, 4, 0, 1, -1, 1, P.foe);
    return m;
}

// ── mine: spiky ball. Kills on contact, and only on contact.
export function buildMineMap(P = FOE_PALETTE) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 2.4, 2.4, 2.4, P.foeDark);
    // Six single-voxel spikes on the axes.
    for (const [dx, dy, dz] of [[3, 0, 0], [-3, 0, 0], [0, 3, 0], [0, -3, 0], [0, 0, 3], [0, 0, -3]]) {
        fillBox(m, dx, dx, dy, dy, dz, dz, P.foeShell);
    }
    return m;
}

// ── lancer: a three-segment spine. Mid-tier — it should look like it means it.
export function buildLancerMap(P = FOE_PALETTE) {
    const m = new Map();
    fillEllipsoid(m, -5, 0, 0, 3.4, 3.0, 3.0, P.foe);     // tail segment
    fillEllipsoid(m, 0, 0, 0, 3.0, 2.6, 2.6, P.foe);      // mid
    fillEllipsoid(m, 5, 0, 0, 2.6, 2.2, 2.2, P.foeShell); // head
    fillBox(m, 7, 9, 0, 0, 0, 0, P.foeShell);             // the lance itself
    fillBox(m, -3, 3, 3, 3, 0, 0, P.foeDark);             // dorsal ridge
    paint(m, (x, y, z, c) => (c === P.foe && y <= -2 ? P.foeDark : null));
    return m;
}

// ── carrier: the hauler. Never fires. Drops a Witness shard when it dies.
//    The one hostile allowed a cool glow — the blue crystal announces the drop
//    (ASSETS_PLAN §2), and that promise must be legible from across the screen.
export function buildCarrierMap(P = FOE_PALETTE) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 8, 5, 5, P.foeShell);       // fat shell
    fillBox(m, -8, 6, -5, -3, -4, 4, P.foeDark);          // belly
    fillBox(m, -2, 2, 5, 6, -3, 3, P.foe);                // the crystal cradle
    fillBox(m, -9, -7, -2, 2, -2, 2, P.foe);              // engine block
    paint(m, (x, y, z, c) =>
        (c === P.foeShell && ((x % 4) + 4) % 4 === 0 ? shadeHex(P.foeShell, 0.82) : null));
    return m;
}

/**
 * The roster. `dims` is the voxel bounding box the spec asserts against;
 * `scale` brings each one to its target world size (ASSETS_PLAN §2).
 */
// Scales are chosen so `length * scale` lands on each type's target world size
// from ASSETS_PLAN §2 (drone 0.8, darter 1.0, gunpod 1.2, crawler 1.0, mine 0.6,
// lancer 1.6, carrier 2.2). `dims` are the MEASURED voxel bounds — the spec
// pins them, so a builder that quietly grows is a test failure, not a surprise.
//
// `glow`: the emissive meshes, in WORLD units relative to the centered model.
// Baked voxel colors cannot bloom (SHIP_PLAN C1), so this is the only way an
// enemy reads as "lit". ASSETS_PLAN R3 — everything hostile glows red — with
// exactly one deliberate exception: the carrier's blue crystal, whose whole job
// is to promise a drop from across the screen.
export const ENEMY_ASSETS = {
    drone: {
        buildMap: buildDroneMap, scale: 0.114, dims: { length: 7, height: 7, width: 11 }, symmetricZ: true,
        glow: [{ pos: [0.30, 0, 0.24], r: 0.075, color: FOE_PALETTE.foeGlow, intensity: 2.6 }]
    },
    darter: {
        buildMap: buildDarterMap, scale: 0.083, dims: { length: 12, height: 4, width: 9 }, symmetricZ: true,
        glow: [{ pos: [0.42, 0.04, 0], r: 0.07, color: FOE_PALETTE.foeGlow, intensity: 2.8 }]
    },
    gunpod: {
        buildMap: buildGunpodMap, scale: 0.120, dims: { length: 10, height: 9, width: 7 }, symmetricZ: true,
        glow: [{ pos: [-0.3, 0.2, 0.26], r: 0.06, color: FOE_PALETTE.foeGlow, intensity: 2.4 }]
    },
    gunpodBarrel: {
        buildMap: buildGunpodBarrelMap, scale: 0.120, dims: { length: 8, height: 3, width: 3 }, symmetricZ: true,
        glow: [{ pos: [0.44, 0, 0], r: 0.06, color: FOE_PALETTE.foeGlow, intensity: 3.0 }]
    },
    crawler: {
        buildMap: buildCrawlerMap, scale: 0.111, dims: { length: 9, height: 4, width: 7 }, symmetricZ: true,
        glow: [{ pos: [0, 0.16, 0.3], r: 0.07, color: FOE_PALETTE.foeGlow, intensity: 2.6 }]
    },
    mine: {
        buildMap: buildMineMap, scale: 0.086, dims: { length: 7, height: 7, width: 7 }, symmetricZ: true,
        glow: [{ pos: [0, 0, 0], r: 0.26, color: FOE_PALETTE.foeGlow, intensity: 2.2, pulse: true }]
    },
    lancer: {
        buildMap: buildLancerMap, scale: 0.089, dims: { length: 18, height: 7, width: 7 }, symmetricZ: true,
        glow: [
            { pos: [0.46, 0, 0.18], r: 0.075, color: FOE_PALETTE.foeGlow, intensity: 2.8 },
            { pos: [-0.1, 0.28, 0], r: 0.05, color: FOE_PALETTE.foeGlow, intensity: 2.0 }
        ]
    },
    carrier: {
        buildMap: buildCarrierMap, scale: 0.122, dims: { length: 18, height: 12, width: 11 }, symmetricZ: true,
        glow: [{ pos: [0, 0.68, 0], r: 0.17, color: PICKUP_PALETTE.carrierCrystal, intensity: 3.2, pulse: true }]
    }
};

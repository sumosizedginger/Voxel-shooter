// src/shmup/assets/ship.js
// Purpose: the Vessel's voxel map — pure data, no THREE meshes.
// Dependencies: voxel/helpers.js, voxel/palette-free (colors come from ../palette.js)
//
// SHIP_PLAN.md §4, with the NARRATIVE_PLAN §3 identity: not the white R-9
// homage but GUMOI's ship — a dark hull carrying violet kintsugi seams, copper
// where the R-9 had red. The seams are painted voxels; the *glow* along them is
// a separate emissive mesh (SHIP_PLAN C1: baked vertex colors cannot bloom),
// and that glow is the damage display (C2).
//
// Authoring frame (SHIP_PLAN C3): nose along +X, up +Y, width along Z.
// Deterministic: no Math.random() anywhere — the death shatter and the spec
// both depend on two calls producing byte-identical maps.

import { fillBox, fillEllipsoid, paint, shadeHex } from '../../voxel/helpers.js';
import { SHIP_PALETTE } from '../palette.js';

/** World units per voxel (SHIP_PLAN C4 — the ship owns its own scale). */
export const SHIP_VOXEL_SCALE = 0.1;

/** Voxel extents, inclusive. The spec asserts the map fits exactly in these. */
export const SHIP_DIMS = { length: 19, height: 7, width: 13 };
export const SHIP_BOUNDS = {
    minX: -9, maxX: 9,
    minY: -1, maxY: 5,
    minZ: -6, maxZ: 6
};

/**
 * The gameplay origin, in voxel coords — the center of the r=0.15 hit circle.
 *
 * DEVIATION from SHIP_PLAN C2 ("call geo.center(), the rig origin is the hit
 * center"): the bounding-box center lands at y=2, which is the canopy line, so
 * a 1.5-voxel hit circle there pokes out of the hull into empty air above the
 * body — the player would die to shots that visibly missed. The hit center
 * belongs in the fuselage core instead, so shipRig translates the geometry by
 * -SHIP_HIT_CENTER rather than calling geo.center(). Same one-line rig step,
 * strictly fairer result. (Logged in PLAN.md's deviation log.)
 */
export const SHIP_HIT_CENTER = { x: 0, y: 1, z: 0 };

/** Where the seam-glow meshes go (voxel coords) — shipRig places emissive
 *  slivers here. Kept next to the paint rule so art and glow can't drift. */
// One crack per side, and that's all. The first pass ran seams down 40% of the
// hull and she came out a violet ship with a grey outline — exactly backwards.
// Violet is reserved (C7): it means "the honest part". A little of it is a scar.
// A lot of it is a paint job, and it stops meaning anything.
export const SEAM_LINES = [
    // { from: [x,y,z], to: [x,y,z] } in voxel space, along the painted cracks.
    { from: [-3, 2, 2], to: [2, 2, 2] },     // the long dorsal-side crack
    { from: [-3, 2, -2], to: [2, 2, -2] }
];

/** True where the kintsugi cracks run. Deterministic, z-independent (so the
 *  map stays symmetric in z), and shaped like a break, not a grid. */
function isSeam(x, y) {
    // The crack wanders with x rather than repeating on a period, so it reads
    // as damage rather than as panel trim.
    const wander = ((x * 7) % 5 + 5) % 5;      // 0..4, deterministic
    return (y === 2 && wander === 0) || (y === 0 && wander === 3);
}

/**
 * Build the Vessel's voxel map.
 * @param {object} [P] palette override (the only variant hook, SHIP_PLAN §8)
 * @returns {Map<string, number>} voxel key -> color hex
 */
export function buildShipMap(P = SHIP_PALETTE) {
    const m = new Map();

    // 1. Wings FIRST — later fills overwrite them where the fuselage sits.
    //    One voxel thick: in the side view they're a dark line, and that's
    //    correct; their sweep only shows during the banking roll.
    fillBox(m, -6, -1, 0, 0, -5, 5, P.hullDark);      // main plane
    fillBox(m, -7, -4, 0, 0, -6, 6, P.hullDark);      // swept trailing edge
    paint(m, (x, y, z) => (Math.abs(z) >= 5 ? P.accent : null));   // copper tips

    // 2. Fuselage: long low box, tapering to a needle.
    fillBox(m, -8, 4, 0, 2, -2, 2, P.hull);           // main body
    fillBox(m, -8, 2, -1, -1, -1, 1, P.hullDark);     // belly keel
    fillBox(m, 5, 7, 0, 1, -1, 1, P.hull);            // taper
    fillBox(m, 8, 9, 0, 1, 0, 0, P.accent);           // the needle — and the
    //                                                   Siren Pulse's mouth

    // 3. Canopy bump — dark voxels; the cyan glow mesh sits on top of these.
    fillEllipsoid(m, 2, 3, 0, 2.4, 1.5, 1.3, P.canopy);

    // 4. Dorsal tail fin.
    fillBox(m, -8, -5, 3, 4, 0, 0, P.hull);
    paint(m, (x, y) => (x === -5 && y >= 3 ? P.accent : null));

    // 5. Engine cavity at the tail.
    fillBox(m, -9, -9, 0, 1, -1, 1, P.engineTint);
    paint(m, (x) => (x <= -8 ? P.engineTint : null));

    // 6. Panel seams on the hull only — subtle, they must not compete with (7).
    paint(m, (x, y, z, c) =>
        (c === P.hull && ((x % 5) + 5) % 5 === 0 ? shadeHex(P.hull, 0.86) : null));

    // 7. The kintsugi. Painted last so nothing overwrites her.
    paint(m, (x, y, z, c) => {
        if (c === P.canopy || c === P.accent || c === P.engineTint) return null;
        if (!isSeam(x, y)) return null;
        // Alternate the seam family along the hull: violet, then the blue.
        return (((x % 3) + 3) % 3 === 0) ? P.seamDeep : P.seam;
    });

    return m;
}

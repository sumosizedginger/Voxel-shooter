// src/shmup/assets/boss01.js
// Purpose: the Beige Slope wall's voxel art — the mass and one mouth.
// Dependencies: voxel/*, ../palette.js
//
// ASSETS_PLAN §3 (part/core architecture) + bible §04. The wall is built from a
// body slab (indestructible mass, blocks and kills on contact) and a set of
// mouth parts laid on its face. A mouth is its own small mesh so it can light up
// violet when it becomes a weakpoint (C7: the mouth that just lied is the honest
// place to shoot).

import { fillBox, fillEllipsoid, paint, shadeHex } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';
import { BEIGE_PALETTE } from '../palette.js';

export const WALL_SCALE = 0.25;

/**
 * The wall body: a tall slab of soft cream, `hVox` voxels tall, `dVox` deep.
 * Its front face (max x) is pocked and wet-looking. Mouths sit in front of it.
 */
export function buildWallBodyMap(hVox = 60, dVox = 10, P = BEIGE_PALETTE) {
    const m = new Map();
    fillBox(m, 0, dVox - 1, 0, hVox - 1, -3, 3, P.mid);
    // Front face detailing: darker pores, paler ridges — it "pulses like a slow
    // lung" (bible), which the boss module animates; the art gives it texture.
    paint(m, (x, y, z, c) => {
        if (x < dVox - 2) return null;               // only the front couple layers
        const h = hash3(x, y, z);
        if (h > 0.9) return P.dark;
        if (h > 0.78) return P.pale;
        if (h < 0.12) return P.flesh;
        return null;
    });
    return m;
}

/**
 * One mouth: a shallow ellipsoid socket with a lip. The socket floor is where
 * the violet weakpoint glow mesh sits (built by the rig, not here).
 */
export function buildMouthMap(P = BEIGE_PALETTE) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 4, 5, 3, P.dark);       // the maw
    fillEllipsoid(m, 1, 0, 0, 3, 4, 2, P.flesh);      // the throat
    // The lip: a paler ring around the opening.
    paint(m, (x, y, z, c) => {
        const r = Math.sqrt(y * y + z * z * 1.4);
        return (r > 3.4 && x >= 0) ? P.pale : null;
    });
    return m;
}

export const BOSS01_ASSETS = {
    wallBody: { buildMap: buildWallBodyMap, scale: WALL_SCALE, dims: null, symmetricZ: true },
    mouth: { buildMap: buildMouthMap, scale: WALL_SCALE, dims: null, symmetricZ: true }
};

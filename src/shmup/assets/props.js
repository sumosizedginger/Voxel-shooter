// src/shmup/assets/props.js
// Purpose: THREE-free voxel prop maps (cutscene bust, etc.).
// Dependencies: voxel/helpers, voxel/core, palette

import { fillEllipsoid, fillBox, paint } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';
import { VIOLET } from '../palette.js';

const HULL = 0x3a4558;
const HULL_LT = 0x6a7a90;
const SCAR = VIOLET;

/** Tiny GUMOI / Vessel bust for open cutscenes (side profile suggestion). */
export function buildGumoiBustMap() {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 5, 2, 2, HULL);
    fillBox(m, 3, 7, -1, 1, -1, 1, HULL_LT);
    fillBox(m, -6, -3, -1, 1, -1, 1, HULL);
    fillEllipsoid(m, 1, 1, 0, 1, 1, 1, 0x1a2030);
    paint(m, (x, y, z) => {
        if (y === 0 && Math.abs(z) <= 1 && x > -4 && x < 4 && hash3(x, y, z) > 0.55) return SCAR;
        return null;
    });
    return m;
}

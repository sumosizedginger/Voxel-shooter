// src/shmup/assets/index.js
// Purpose: the one asset registry. ASSETS_PLAN R1.
// Dependencies: ./ship, ./enemies (both import-clean data modules)
//
// tests/assets.spec.mjs iterates THIS — so adding an asset here automatically
// gets it tested (non-empty, deterministic, fits its declared dims, symmetric
// in z when it claims to be). Registering is not paperwork; it's the test.

import { buildShipMap, SHIP_VOXEL_SCALE, SHIP_DIMS } from './ship.js';
import { ENEMY_ASSETS } from './enemies.js';

export const ASSETS = {
    ship: {
        buildMap: buildShipMap,
        scale: SHIP_VOXEL_SCALE,
        dims: SHIP_DIMS,
        symmetricZ: true
    },
    ...ENEMY_ASSETS
};

export const ASSET_NAMES = Object.keys(ASSETS);

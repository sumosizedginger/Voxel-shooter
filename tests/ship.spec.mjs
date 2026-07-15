// tests/ship.spec.mjs
// Pure-node spec for the Vessel's voxel map (SHIP_PLAN.md §7).
// No browser, no renderer — buildShipMap() is deliberately import-clean data.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import {
    buildShipMap, SHIP_DIMS, SHIP_BOUNDS, SHIP_VOXEL_SCALE, SHIP_HIT_CENTER
} from '../src/shmup/assets/ship.js';
import { SHIP_PALETTE, VIOLET } from '../src/shmup/palette.js';

function keyParts(k) {
    const p = k.split(',');
    return { x: +p[0], y: +p[1], z: +p[2] };
}

export function run(t) {
    const map = buildShipMap();

    t.ok('ship map is non-empty', map.size > 0, 'voxels=' + map.size);

    // ── bounds: the map must fit exactly inside its declared dims
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity,
        minZ = Infinity, maxZ = -Infinity;
    for (const k of map.keys()) {
        const { x, y, z } = keyParts(k);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const got = { minX, maxX, minY, maxY, minZ, maxZ };
    t.ok('ship fits inside SHIP_BOUNDS',
        minX >= SHIP_BOUNDS.minX && maxX <= SHIP_BOUNDS.maxX
        && minY >= SHIP_BOUNDS.minY && maxY <= SHIP_BOUNDS.maxY
        && minZ >= SHIP_BOUNDS.minZ && maxZ <= SHIP_BOUNDS.maxZ,
        JSON.stringify(got));
    t.ok('ship spans exactly SHIP_DIMS',
        (maxX - minX + 1) === SHIP_DIMS.length
        && (maxY - minY + 1) === SHIP_DIMS.height
        && (maxZ - minZ + 1) === SHIP_DIMS.width,
        'got ' + (maxX - minX + 1) + 'x' + (maxY - minY + 1) + 'x' + (maxZ - minZ + 1)
        + ' want ' + SHIP_DIMS.length + 'x' + SHIP_DIMS.height + 'x' + SHIP_DIMS.width);

    // ── z-symmetry: the ship must not be lopsided (and the death shatter and
    //    the banking roll both assume it).
    let asym = null;
    for (const k of map.keys()) {
        const { x, y, z } = keyParts(k);
        const mirror = x + ',' + y + ',' + (-z);
        if (!map.has(mirror)) { asym = k; break; }
    }
    t.ok('ship map is symmetric in z', asym === null, asym ? 'no mirror for ' + asym : '');

    // ── the needle: the nose voxel is the Siren Pulse's mouth, and it's copper.
    const noseKey = maxX + ',0,0';
    t.ok('nose voxel exists at max-x', map.has(noseKey), 'looked for ' + noseKey);
    t.ok('nose voxel is the accent color', map.get(noseKey) === SHIP_PALETTE.accent,
        'got 0x' + (map.get(noseKey) || 0).toString(16));

    // ── determinism: two builds must be byte-identical (no Math.random()).
    const map2 = buildShipMap();
    let identical = map.size === map2.size;
    if (identical) {
        for (const [k, v] of map) {
            if (map2.get(k) !== v) { identical = false; break; }
        }
    }
    t.ok('buildShipMap() is deterministic', identical);

    // ── the kintsugi actually made it onto the hull (NARRATIVE_PLAN §3): if the
    //    seam paint silently no-ops, the damage display has nothing to sit on.
    let seams = 0;
    for (const v of map.values()) {
        if (v === SHIP_PALETTE.seam || v === SHIP_PALETTE.seamDeep) seams++;
    }
    t.ok('hull carries kintsugi seam voxels', seams > 12, 'seam voxels=' + seams);
    t.ok('the seam color IS the reserved violet (C7)', SHIP_PALETTE.seam === VIOLET);

    // ── the hit radius (0.15) must live inside the fuselage, never the wings:
    //    the visible ship is ~1.9u long but only its core kills you.
    const halfLen = ((maxX - minX + 1) / 2) * SHIP_VOXEL_SCALE;
    t.ok('ship is ~1.9 world units long', Math.abs(halfLen * 2 - 1.9) < 0.05,
        'length=' + (halfLen * 2).toFixed(2) + 'u');
    // The hit circle (r = 0.15u = 1.5 voxels) is centered on SHIP_HIT_CENTER.
    // Every voxel it touches must be solid hull — if any is empty, the player
    // dies to shots that visibly missed, which is the one unforgivable bug in
    // this genre. Wings and fin are cosmetic and must be OUTSIDE the circle.
    const R = 0.15 / SHIP_VOXEL_SCALE;             // hit radius in voxels
    const { x: hx, y: hy } = SHIP_HIT_CENTER;
    let hole = null;
    const ri = Math.ceil(R);
    for (let dx = -ri; dx <= ri && !hole; dx++) {
        for (let dy = -ri; dy <= ri && !hole; dy++) {
            if (dx * dx + dy * dy > R * R) continue;     // outside the circle
            if (!map.has((hx + dx) + ',' + (hy + dy) + ',0')) {
                hole = (hx + dx) + ',' + (hy + dy) + ',0';
            }
        }
    }
    t.ok('hit circle lies entirely inside solid fuselage voxels', hole === null,
        hole ? 'empty voxel inside the hit circle: ' + hole : 'center=' + hx + ',' + hy);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('ship');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

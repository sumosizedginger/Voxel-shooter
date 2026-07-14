// tests/assets.spec.mjs
// Pure-node spec over the whole asset registry (ASSETS_PLAN §8).
// Every asset gets these checks for free just by being registered.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import { ASSETS, ASSET_NAMES } from '../src/shmup/assets/index.js';
import { ROSTER, ENEMY_TYPES } from '../src/shmup/enemies/roster.js';
import { VIOLET, FOE_PALETTE, PICKUP_PALETTE } from '../src/shmup/palette.js';

function bounds(map) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity,
        minZ = Infinity, maxZ = -Infinity;
    for (const k of map.keys()) {
        const p = k.split(',');
        const x = +p[0], y = +p[1], z = +p[2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    return {
        length: maxX - minX + 1, height: maxY - minY + 1, width: maxZ - minZ + 1,
        minX, maxX, minY, maxY, minZ, maxZ
    };
}

export function run(t) {
    t.ok('the registry is not empty', ASSET_NAMES.length > 0,
        ASSET_NAMES.length + ' assets');

    for (const name of ASSET_NAMES) {
        const a = ASSETS[name];
        const map = a.buildMap();

        t.ok(name + ': map is non-empty', map.size > 0, 'voxels=' + map.size);

        // Deterministic: hash3, never Math.random. The death shatter depends
        // on this, and so does every one of these assertions.
        const map2 = a.buildMap();
        let same = map.size === map2.size;
        if (same) for (const [k, v] of map) if (map2.get(k) !== v) { same = false; break; }
        t.ok(name + ': map is deterministic', same);

        const b = bounds(map);
        t.ok(name + ': fits its declared dims',
            b.length === a.dims.length && b.height === a.dims.height && b.width === a.dims.width,
            'got ' + b.length + 'x' + b.height + 'x' + b.width
            + ' declared ' + a.dims.length + 'x' + a.dims.height + 'x' + a.dims.width);

        if (a.symmetricZ) {
            let bad = null;
            for (const k of map.keys()) {
                const p = k.split(',');
                if (!map.has(p[0] + ',' + p[1] + ',' + (-(+p[2])))) { bad = k; break; }
            }
            t.ok(name + ': symmetric in z', bad === null, bad ? 'no mirror for ' + bad : '');
        }

        // C7: violet is RESERVED for weakpoints and for GUMOI / the Witness.
        // No enemy hull may be violet — if one is, "shoot here" stops meaning
        // anything, and that is the whole readability contract.
        if (name !== 'ship') {
            let violet = null;
            for (const [k, v] of map) if (v === VIOLET) { violet = k; break; }
            t.ok(name + ': no reserved violet on a hostile hull (C7)', violet === null,
                violet ? 'violet voxel at ' + violet : '');
        }

        // R3: allegiance is coded by glow. Everything hostile glows red —
        // with exactly one sanctioned exception, the carrier's drop-crystal.
        if (a.glow) {
            for (const g of a.glow) {
                const hostileRed = g.color === FOE_PALETTE.foeGlow;
                const isCarrierCrystal = name === 'carrier'
                    && g.color === PICKUP_PALETTE.carrierCrystal;
                t.ok(name + ': glow codes allegiance (R3)', hostileRed || isCarrierCrystal,
                    'glow color 0x' + g.color.toString(16));
            }
        }
    }

    // The roster and the asset registry must not drift apart: every enemy the
    // level director can spawn needs a model to spawn.
    for (const type of ENEMY_TYPES) {
        t.ok('roster "' + type + '" points at a registered asset',
            !!ASSETS[ROSTER[type].asset], 'asset=' + ROSTER[type].asset);
    }

    // Fairness (ASSETS_PLAN §6): the hit circle must be SMALLER than the art.
    // A shot that visibly grazed must miss, and a body that visibly missed must
    // not kill — this is the rule the whole genre's fairness rests on.
    for (const type of ENEMY_TYPES) {
        const def = ROSTER[type];
        const a = ASSETS[def.asset];
        const artHalf = (a.dims.length * a.scale) / 2;
        t.ok('"' + type + '" hit radius is inside its art', def.r < artHalf,
            'r=' + def.r + ' art half-length=' + artHalf.toFixed(2));
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('assets');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

// tests/terrain.spec.mjs
// Pure-node spec: the Y->Z collision remap, and the chunk set's
// collision-smaller-than-the-art rule. PLAN.md Phase 3.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import { Terrain } from '../src/shmup/terrain.js';
import { TERRAIN_CHUNKS, CHUNK_NAMES, COLLISION_INSET } from '../src/shmup/assets/terrain.js';

function mapBounds(map) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const k of map.keys()) {
        const p = k.split(',');
        const x = +p[0], y = +p[1];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY };
}

export function run(t) {
    // ── the remap: a box added at a given Y must block at that Y, not that Z.
    const terr = new Terrain();
    terr.addBox({ minX: 4, maxX: 6, minY: 0, maxY: 3, id: 'floor' });

    t.ok('a box blocks inside its y range', terr.blocked(5, 2, 0.2));
    t.ok('a box does not block above its y range', !terr.blocked(5, 6, 0.2));
    t.ok('a box does not block outside its x range', !terr.blocked(9, 2, 0.2));
    t.ok('the half-extent widens the test', terr.blocked(3.85, 2, 0.3));

    // If the remap were wrong (y passed through as a real z), this next test is
    // the one that would catch it: a point at the same x but a different y would
    // still report blocked, because the collision world would be testing z=0.
    t.ok('y is really the collision axis (not silently ignored)',
        !terr.blocked(5, 12, 0.2), 'a point 12 units above the floor must be clear');

    // ── resolveMove slides in Y (this is what lets the Witness grind a wall)
    const slid = terr.resolveMove(5, 8, 5, 1, 0.3);
    t.ok('resolveMove pushes back out of a solid in y', slid.y > 3,
        'y=' + slid.y.toFixed(2) + ' (must sit on top of a box whose maxY is 3)');
    t.ok('resolveMove returns {x, y}, not {x, z}',
        slid.z === undefined && typeof slid.y === 'number');

    const free = terr.resolveMove(0, 8, 2, 8, 0.3);
    t.ok('resolveMove is a pass-through in open space',
        Math.abs(free.x - 2) < 1e-9 && Math.abs(free.y - 8) < 1e-9);

    // ── removal + cull
    terr.removeBox('floor');
    t.ok('removeBox clears the solid', !terr.blocked(5, 2, 0.2));
    t.ok('removeBox clears the debug box list', terr.boxes.length === 0);

    const t2 = new Terrain();
    t2.addBox({ minX: 0, maxX: 5, minY: 0, maxY: 2 });
    t2.addBox({ minX: 100, maxX: 105, minY: 0, maxY: 2 });
    t2.cullBehind(50);
    t.ok('cullBehind drops boxes the scroll has left behind', t2.boxes.length === 1);
    t.ok('cullBehind keeps boxes still ahead', t2.blocked(102, 1, 0.2));

    // ── THE RULE: every chunk's collision must lie strictly inside its art.
    //    A box poking one voxel outside the silhouette is a death the player
    //    watched themselves not deserve.
    for (const name of CHUNK_NAMES) {
        const chunk = TERRAIN_CHUNKS[name]();
        t.ok(name + ': builds a non-empty map', chunk.map.size > 0);
        t.ok(name + ': ships collision boxes with its art',
            Array.isArray(chunk.collisionBoxes) && chunk.collisionBoxes.length > 0,
            'boxes=' + (chunk.collisionBoxes || []).length);

        const b = mapBounds(chunk.map);
        let outside = null;
        let unsupported = null;
        for (const box of chunk.collisionBoxes) {
            if (box.minX < b.minX || box.maxX > b.maxX
                || box.minY < b.minY || box.maxY > b.maxY) {
                outside = JSON.stringify(box);
                break;
            }
            // Stronger than a bounding-box check: every voxel the box claims
            // must actually BE art. A box spanning a gap between two towers
            // would pass a bounds check and still kill you in mid-air.
            for (let x = Math.ceil(box.minX); x <= Math.floor(box.maxX) && !unsupported; x++) {
                for (let y = Math.ceil(box.minY); y <= Math.floor(box.maxY); y++) {
                    if (!chunk.map.has(x + ',' + y + ',0')) {
                        unsupported = 'box ' + JSON.stringify(box)
                            + ' claims empty voxel ' + x + ',' + y;
                        break;
                    }
                }
            }
        }
        t.ok(name + ': collision stays inside the art bounds', outside === null,
            outside ? 'box escapes the map: ' + outside : '');
        t.ok(name + ': every collision voxel is backed by real art', unsupported === null,
            unsupported || '');

        // Deterministic — the level must be the same level every run.
        const again = TERRAIN_CHUNKS[name]();
        let same = again.map.size === chunk.map.size;
        if (same) for (const [k, v] of chunk.map) if (again.map.get(k) !== v) { same = false; break; }
        t.ok(name + ': is deterministic', same);
    }

    t.ok('COLLISION_INSET is at least one voxel', COLLISION_INSET >= 1,
        'inset=' + COLLISION_INSET);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('terrain');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

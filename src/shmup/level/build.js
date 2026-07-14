// src/shmup/level/build.js
// Purpose: turn a level's declarative `terrain` and `parallax` arrays into
// meshes + collision boxes.
// Dependencies: three, voxel/core, ../assets/terrain, ../terrain
//
// LEVELS_PLAN §2. This is the ONLY place a terrain chunk becomes both a mesh
// and a solid, which is what makes "the art and the collision can't drift
// apart" true at runtime rather than just at authoring time: they're built from
// the same chunk object, in the same loop, or not at all.

import * as THREE from 'three';
import { buildVoxelGeo } from '../../voxel/core.js';
import { TERRAIN_CHUNKS, TERRAIN_SCALE } from '../assets/terrain.js';

const S = TERRAIN_SCALE;

/**
 * Voxel box (inclusive integer coords) -> world box.
 * A voxel at integer x occupies world [x-0.5, x+0.5] * S, so the far faces get
 * the +0.5 — off-by-a-half here would be a half-voxel of invisible death.
 */
function boxToWorld(box, originX, originY) {
    return {
        minX: originX + (box.minX - 0.5) * S,
        maxX: originX + (box.maxX + 0.5) * S,
        minY: originY + (box.minY - 0.5) * S,
        maxY: originY + (box.maxY + 0.5) * S
    };
}

/**
 * Build every terrain entry into `level.group` and register its solids.
 * @param {object} level  needs `terrain: [{chunk, atX, y, args?, palette?}]`
 * @param {THREE.Group} group
 * @param {import('../terrain.js').Terrain} terrain
 * @returns {Array} the built entries (mesh + box ids, for later removal)
 */
export function buildTerrain(level, group, terrain) {
    const built = [];
    if (!level.terrain) return built;

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });

    for (const entry of level.terrain) {
        const fn = TERRAIN_CHUNKS[entry.chunk];
        if (!fn) {
            // A typo in level data must be loud. The stage-lint spec catches it
            // before it ships; this catches it during authoring.
            console.error('unknown terrain chunk: ' + entry.chunk);
            continue;
        }
        const args = entry.args || [];
        const chunk = entry.palette ? fn(...args, entry.palette) : fn(...args);

        const geo = buildVoxelGeo(chunk.map);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(S);
        mesh.position.set(entry.atX, entry.y || 0, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        const ids = [];
        for (const box of chunk.collisionBoxes) {
            ids.push(terrain.addBox(boxToWorld(box, entry.atX, entry.y || 0)));
        }
        built.push({ entry, mesh, geo, ids, chunk });
    }
    return built;
}

/**
 * Parallax layers (ASSETS_PLAN §7). Big cheap silhouettes at negative z; the
 * camera module drives their x from `userData.scrollRate` each frame.
 * Nothing in a parallax layer may glow or use bullet magenta (R4 protection) —
 * the background must never compete with a bullet for the player's eye.
 */
export function buildParallax(level, scene) {
    const layers = [];
    if (!level.parallax) return layers;

    for (const def of level.parallax) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 1, fog: true
        });
        const chunk = def.build();
        const geo = buildVoxelGeo(chunk.map || chunk);
        const scale = def.scale || 0.5;

        // Repeat the silhouette along x so the layer never runs out under a
        // long level. Spacing is in world units.
        const span = def.spacing || 40;
        const count = Math.ceil((level.length + 120) / span) + 1;
        for (let i = 0; i < count; i++) {
            const m = new THREE.Mesh(geo, mat);
            m.scale.setScalar(scale);
            // Deterministic jitter — a perfectly regular skyline reads as tiling.
            const j = Math.sin(i * 12.9898) * 43758.5453;
            const jitter = (j - Math.floor(j)) - 0.5;
            m.position.set(i * span + jitter * span * 0.4, (def.y || 4) + jitter * 2, def.z);
            group.add(m);
        }
        group.position.z = def.z;
        group.userData.scrollRate = def.scrollRate;
        scene.add(group);
        layers.push(group);
    }
    return layers;
}

/** Tear a built level back down. Geometry here is per-chunk, so it IS ours. */
export function disposeBuilt(built, group) {
    for (const b of built) {
        group.remove(b.mesh);
        b.geo.dispose();
    }
    built.length = 0;
}

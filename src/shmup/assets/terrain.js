// src/shmup/assets/terrain.js
// Purpose: modular terrain chunks — the voxel art AND its collision boxes,
// authored together in one function so they can't drift apart.
// Dependencies: voxel/helpers.js, voxel/core.js, ../palette.js
//
// ASSETS_PLAN §6 + PLAN.md §2.3. Every builder returns
// `{ map, collisionBoxes, dims }`, with boxes in VOXEL coordinates (the level
// loader multiplies by the chunk scale and offsets to world space). Keeping
// them in the same return value is the enforcement mechanism for the rule that
// matters most here:
//
//   *** COLLISION IS ALWAYS SLIGHTLY SMALLER THAN THE ART. ***
//
// Every box is inset by COLLISION_INSET voxels from the visible silhouette. In
// a game where touching a wall is instant death, a hitbox that pokes even one
// voxel outside the art is a death the player watched themselves not deserve.
// tests/terrain.spec.mjs asserts this on every chunk in the set.

import { fillBox, paint, shadeHex } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';
import { TERRAIN_PALETTE, BEIGE_PALETTE } from '../palette.js';

/** World units per terrain voxel. Chunky is right for walls (ASSETS_PLAN §6). */
export const TERRAIN_SCALE = 0.25;

/** How far every collision box is inset from the art, in voxels. */
export const COLLISION_INSET = 1;

/** Greeble pass: deterministic speckle + panel seams. Never Math.random(). */
function greeble(m, P) {
    paint(m, (x, y, z, c) => {
        if (hash3(x, y, z) > 0.88) return shadeHex(c, 1.18);
        if (hash3(z, x, y) > 0.93) return shadeHex(c, 0.78);
        return null;
    });
}

/**
 * A floor slab: `len` voxels long, `h` tall, sitting on the playfield floor.
 * The chunk's local origin is its bottom-left-front corner (voxel 0,0,0).
 */
export function floorSlab(len = 16, h = 4, P = TERRAIN_PALETTE) {
    const m = new Map();
    fillBox(m, 0, len - 1, 0, h - 1, -2, 2, P.mid || P.base);
    paint(m, (x, y) => (y === h - 1 ? (P.base || P.face) : null));   // lit top face
    greeble(m, P);
    return {
        map: m,
        dims: { length: len, height: h, width: 5 },
        collisionBoxes: [{
            minX: COLLISION_INSET, maxX: len - 1 - COLLISION_INSET,
            minY: 0, maxY: h - 1 - COLLISION_INSET
        }]
    };
}

/** A ceiling slab: same, but the detailed face points DOWN. */
export function ceilSlab(len = 16, h = 4, P = TERRAIN_PALETTE) {
    const m = new Map();
    fillBox(m, 0, len - 1, 0, h - 1, -2, 2, P.mid || P.base);
    paint(m, (x, y) => (y === 0 ? (P.base || P.face) : null));       // lit underside
    greeble(m, P);
    return {
        map: m,
        dims: { length: len, height: h, width: 5 },
        collisionBoxes: [{
            minX: COLLISION_INSET, maxX: len - 1 - COLLISION_INSET,
            minY: COLLISION_INSET, maxY: h - 1
        }]
    };
}

/** A floor-to-ceiling column. `h` voxels tall, `w` wide. */
export function pillar(h = 24, w = 5, P = TERRAIN_PALETTE) {
    const m = new Map();
    fillBox(m, 0, w - 1, 0, h - 1, -2, 2, P.mid || P.base);
    // Flare the ends so it reads as grown/bolted rather than floating.
    fillBox(m, -1, w, 0, 1, -2, 2, P.dark || P.face);
    fillBox(m, -1, w, h - 2, h - 1, -2, 2, P.dark || P.face);
    greeble(m, P);
    return {
        map: m,
        dims: { length: w + 2, height: h, width: 5 },
        collisionBoxes: [{
            minX: COLLISION_INSET, maxX: w - 1 - COLLISION_INSET,
            minY: 0, maxY: h - 1
        }]
    };
}

/**
 * A stepped diagonal. Rises `rise` voxels over `len`.
 * Collision is 3 stacked boxes approximating the slope, each inset INSIDE the
 * visible steps — you can clip the corner of a step and live.
 */
export function ramp(len = 16, rise = 8, P = TERRAIN_PALETTE) {
    const m = new Map();
    const steps = 4;
    const stepLen = Math.floor(len / steps);
    const stepRise = Math.floor(rise / steps);
    const boxes = [];
    for (let s = 0; s < steps; s++) {
        const x0 = s * stepLen;
        const x1 = (s === steps - 1) ? len - 1 : (s + 1) * stepLen - 1;
        const top = (s + 1) * stepRise;
        fillBox(m, x0, x1, 0, top, -2, 2, P.mid || P.base);
        boxes.push({
            minX: x0 + COLLISION_INSET, maxX: x1 - COLLISION_INSET,
            minY: 0, maxY: top - COLLISION_INSET
        });
    }
    paint(m, (x, y, z, c) => (hash3(x, y, z) > 0.9 ? shadeHex(c, 1.15) : null));
    return {
        map: m,
        dims: { length: len, height: rise + 1, width: 5 },
        collisionBoxes: boxes.filter((b) => b.maxX >= b.minX && b.maxY >= b.minY)
    };
}

/**
 * The Slope's organic tunnel wall (bible §04): a soft, wavering beige mass.
 * `sign` = +1 for a floor growth, -1 for a ceiling growth.
 * It is the color of a thing that will not say no.
 */
export function fleshWall(len = 20, depth = 6, sign = 1, P = BEIGE_PALETTE) {
    const m = new Map();
    const boxes = [];
    // A slow wave along x — deterministic, so the collision below matches it.
    const heightAt = (x) => {
        const w = Math.sin(x * 0.35) * 1.6 + Math.sin(x * 0.11 + 1.3) * 1.2;
        return Math.max(2, Math.round(depth + w));
    };
    for (let x = 0; x < len; x++) {
        const h = heightAt(x);
        if (sign > 0) fillBox(m, x, x, 0, h - 1, -2, 2, P.mid);
        else fillBox(m, x, x, -(h - 1), 0, -2, 2, P.mid);
    }
    // Skin: the exposed face is paler, the depths are darker flesh.
    paint(m, (x, y, z, c) => {
        const h = heightAt(x);
        const surface = sign > 0 ? (y === h - 1) : (y === -(h - 1));
        if (surface) return P.pale;
        if (Math.abs(y) < 2) return P.dark;
        return hash3(x, y, z) > 0.86 ? P.flesh : null;
    });

    // Collision: one box per run of equal height, inset a voxel under the skin.
    let runStart = 0;
    for (let x = 1; x <= len; x++) {
        const prev = heightAt(x - 1);
        if (x === len || heightAt(x) !== prev) {
            const inner = prev - 1 - COLLISION_INSET;
            if (inner >= 0 && (x - 1) - runStart >= 0) {
                boxes.push(sign > 0
                    ? { minX: runStart, maxX: x - 1, minY: 0, maxY: inner }
                    : { minX: runStart, maxX: x - 1, minY: -inner, maxY: 0 });
            }
            runStart = x;
        }
    }
    let maxH = 0;
    for (let x = 0; x < len; x++) maxH = Math.max(maxH, heightAt(x));
    return {
        map: m,
        dims: { length: len, height: maxH, width: 5 },
        collisionBoxes: boxes
    };
}

/** The framing piece around a boss arena. Cosmetic overhangs, one thin box. */
export function caveMouth(h = 26, P = BEIGE_PALETTE) {
    const m = new Map();
    fillBox(m, 0, 3, 0, 5, -2, 2, P.dark);              // lower jaw
    fillBox(m, 0, 3, h - 6, h - 1, -2, 2, P.dark);      // upper jaw
    fillBox(m, 1, 2, 6, 8, -2, 2, P.mid);               // teeth
    fillBox(m, 1, 2, h - 9, h - 7, -2, 2, P.mid);
    greeble(m, P);
    return {
        map: m,
        dims: { length: 4, height: h, width: 5 },
        collisionBoxes: [
            { minX: COLLISION_INSET, maxX: 3 - COLLISION_INSET, minY: 0, maxY: 5 - COLLISION_INSET },
            { minX: COLLISION_INSET, maxX: 3 - COLLISION_INSET, minY: h - 6 + COLLISION_INSET, maxY: h - 1 }
        ]
    };
}

export const TERRAIN_CHUNKS = {
    floorSlab, ceilSlab, pillar, ramp, fleshWall, caveMouth
};

export const CHUNK_NAMES = Object.keys(TERRAIN_CHUNKS);

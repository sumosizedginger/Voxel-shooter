// src/shmup/assets/parallax.js
// Purpose: per-theme parallax silhouettes for L01–L10 (ASSETS_PLAN §7).
// Dependencies: voxel/helpers, voxel/core — THREE-free (plain Maps).
//
// Colors stay within ~15% of the dark sky so layers read as depth, not clutter.
// Nothing here uses bullet magenta or emissive materials (build.js enforces unlit fog mats).

import { fillEllipsoid, fillBox, paint } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';

const SKY = {
    dark: 0x1a1424,
    mid: 0x2a2034,
    pale: 0x3a3048
};

function paintNoise(m, mid = SKY.mid) {
    paint(m, (x, y, z, c) => (hash3(x, y, z) > 0.82 ? mid : c));
    return m;
}

/** L1 — soft beige hulks (kept for shared reuse / tests). */
export function beigeHulk(bias = 0.6) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 10, 4, 3, 0x241d2a);
    fillBox(m, -8, 8, -1, 1, -3, 3, 0x342838);
    fillEllipsoid(m, 6, 2, 0, 3, 3, 2, 0x241d2a);
    paintNoise(m, 0x342838);
    return { map: m, bias };
}

/** L2 Induction Parrot — stacked mirror plates. */
export function parrotSilhouette() {
    const m = new Map();
    fillBox(m, -6, 6, -3, 3, -2, 2, SKY.dark);
    fillBox(m, -4, 4, -5, 5, -1, 1, SKY.mid);
    fillEllipsoid(m, 5, 0, 0, 3, 4, 2, SKY.pale);
    fillBox(m, -8, -5, -1, 1, -1, 1, SKY.mid);
    paintNoise(m);
    return { map: m };
}

/** L3 Jester — spiky chaotic crown. */
export function jesterSilhouette() {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 7, 5, 3, SKY.dark);
    for (let i = -3; i <= 3; i++) {
        fillBox(m, i * 2, i * 2, 4, 4 + Math.abs(i), -1, 1, SKY.mid);
    }
    fillBox(m, -2, 2, -6, -3, -1, 1, SKY.pale);
    paintNoise(m);
    return { map: m };
}

/** L4 Smooth Operator — corporate slab tower. */
export function suitSilhouette() {
    const m = new Map();
    fillBox(m, -5, 5, -8, 8, -2, 2, SKY.dark);
    fillBox(m, -4, 4, -7, 7, -1, 1, SKY.mid);
    fillBox(m, -2, 2, 6, 10, -1, 1, SKY.pale);
    for (let y = -6; y <= 6; y += 3) fillBox(m, -3, 3, y, y, -2, 2, SKY.pale);
    paintNoise(m);
    return { map: m };
}

/** L5 Mirror Break — glass shard cluster. */
export function mirrorSilhouette() {
    const m = new Map();
    fillBox(m, -1, 1, -8, 8, -1, 1, SKY.pale);
    fillBox(m, -6, 0, -4, 4, -2, 0, SKY.mid);
    fillBox(m, 0, 7, -3, 5, 0, 2, SKY.dark);
    fillEllipsoid(m, -3, 2, 0, 2, 3, 1, SKY.pale);
    paintNoise(m, SKY.pale);
    return { map: m };
}

/** L6 Redemption Arc — soft sun disc. */
export function sunSilhouette() {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 8, 8, 3, SKY.mid);
    fillEllipsoid(m, 0, 0, 0, 5, 5, 2, SKY.pale);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * 10);
        const y = Math.round(Math.sin(a) * 10);
        fillBox(m, x - 1, x + 1, y - 1, y + 1, -1, 1, SKY.dark);
    }
    paintNoise(m, SKY.pale);
    return { map: m };
}

/** L7 Forge Wraith — industrial stacks. */
export function forgeSilhouette() {
    const m = new Map();
    fillBox(m, -8, 8, -2, 2, -2, 2, SKY.dark);
    fillBox(m, -7, -4, 0, 10, -2, 2, SKY.mid);
    fillBox(m, -1, 2, 0, 12, -2, 2, SKY.mid);
    fillBox(m, 4, 7, 0, 8, -2, 2, SKY.pale);
    fillBox(m, -6, 6, -4, -2, -1, 1, SKY.dark);
    paintNoise(m);
    return { map: m };
}

/** L8 Drift Wraith — sparse cold wrecks. */
export function driftSilhouette() {
    const m = new Map();
    fillEllipsoid(m, -3, 0, 0, 5, 2, 2, SKY.dark);
    fillBox(m, 2, 8, -1, 1, -1, 1, SKY.mid);
    fillBox(m, 5, 6, 1, 4, -1, 1, SKY.pale);
    fillEllipsoid(m, 0, -3, 0, 3, 1, 1, SKY.mid);
    paintNoise(m);
    return { map: m };
}

/** L9 Witness Shadow — twin violet ghosts (desaturated). */
export function shadowSilhouette() {
    const m = new Map();
    fillEllipsoid(m, -4, 0, 0, 4, 6, 2, SKY.dark);
    fillEllipsoid(m, 4, 1, 0, 4, 5, 2, SKY.mid);
    fillBox(m, -1, 1, -2, 2, -1, 1, SKY.pale);
    paintNoise(m);
    return { map: m };
}

/** L10 Corrupted Seal — seal glyph silhouette. */
export function sealSilhouette() {
    const m = new Map();
    // Ring
    for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * 8);
        const y = Math.round(Math.sin(ang) * 8);
        fillBox(m, x - 1, x + 1, y - 1, y + 1, -1, 1, SKY.mid);
    }
    // Inner marks: rough √π ∞ τ² suggestion
    fillBox(m, -3, 3, -1, 1, -1, 1, SKY.pale);
    fillEllipsoid(m, -2, 3, 0, 2, 2, 1, SKY.dark);
    fillEllipsoid(m, 2, 3, 0, 2, 2, 1, SKY.dark);
    fillBox(m, -1, 1, -5, -2, -1, 1, SKY.pale);
    paintNoise(m);
    return { map: m };
}

const BY_ID = {
    1: [beigeHulk, beigeHulk],
    2: [parrotSilhouette, parrotSilhouette],
    3: [jesterSilhouette, jesterSilhouette],
    4: [suitSilhouette, suitSilhouette],
    5: [mirrorSilhouette, mirrorSilhouette],
    6: [sunSilhouette, sunSilhouette],
    7: [forgeSilhouette, forgeSilhouette],
    8: [driftSilhouette, driftSilhouette],
    9: [shadowSilhouette, shadowSilhouette],
    10: [sealSilhouette, sealSilhouette]
};

/**
 * Two parallax layer defs for a campaign level id (matches level01 shape).
 * @returns {{build:Function,z:number,scrollRate:number,scale:number,spacing:number,y:number}[]}
 */
export function parallaxForLevel(id) {
    const pair = BY_ID[id] || [beigeHulk, beigeHulk];
    const near = pair[0];
    const far = pair[1] || pair[0];
    return [
        { build: () => near(), z: -14, scrollRate: 0.35, scale: 0.55 + (id % 3) * 0.05, spacing: 32 + id, y: 8 },
        { build: () => far(), z: -26, scrollRate: 0.16, scale: 0.85 + (id % 2) * 0.08, spacing: 48 + id * 2, y: 9 }
    ];
}

export const PARALLAX_BUILDERS = {
    beigeHulk, parrotSilhouette, jesterSilhouette, suitSilhouette,
    mirrorSilhouette, sunSilhouette, forgeSilhouette, driftSilhouette,
    shadowSilhouette, sealSilhouette
};

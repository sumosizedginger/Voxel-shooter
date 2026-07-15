// src/shmup/assets/bossBodies.js
// Purpose: bespoke voxel body maps for bosses 02–10 (spectacle beyond one blob).
// Dependencies: voxel/helpers, voxel/core — THREE-free.

import { fillEllipsoid, fillBox, paint } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';

function noise(m, pal) {
    paint(m, (x, y, z, c) => {
        if (hash3(x, y, z) > 0.86) return pal.shell;
        if (hash3(z, x, y) < 0.08) return pal.bodyDark;
        return null;
    });
    return m;
}

/** Default organic mass (fallback). */
export function bodyDefault(pal) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 9, 11, 5, pal.body);
    fillEllipsoid(m, 2, 0, 0, 6, 8, 4, pal.bodyDark);
    fillBox(m, -9, 2, -2, 2, -4, 4, pal.shell);
    return noise(m, pal);
}

/** L2 Induction Parrot — beak + wing plates that "copy". */
export function bodyParrot(pal) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 8, 7, 5, pal.body);
    // Beak
    fillBox(m, -12, -6, -2, 2, -2, 2, pal.shell);
    fillBox(m, -14, -11, -1, 1, -1, 1, pal.bodyDark);
    // Wings
    fillBox(m, -2, 6, 5, 9, -3, 3, pal.body);
    fillBox(m, -2, 6, -9, -5, -3, 3, pal.body);
    // Mirror plate faces
    fillBox(m, 4, 8, -4, 4, -1, 1, pal.shell);
    return noise(m, pal);
}

/** L3 Jester — elongated harlequin with crown spikes. */
export function bodyJester(pal) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 7, 10, 4, pal.body);
    fillEllipsoid(m, 0, 6, 0, 5, 4, 3, pal.bodyDark);
    for (let i = -3; i <= 3; i++) {
        fillBox(m, i * 2, i * 2 + 1, 9, 12 + Math.abs(i), -1, 1, pal.shell);
    }
    fillBox(m, -3, 3, -12, -8, -2, 2, pal.bodyDark);
    // Bells
    fillEllipsoid(m, -6, -4, 0, 2, 2, 2, pal.shell);
    fillEllipsoid(m, 6, -4, 0, 2, 2, 2, pal.shell);
    return noise(m, pal);
}

/** L4 Smooth Operator — suit block with collar. */
export function bodySuit(pal) {
    const m = new Map();
    fillBox(m, -7, 7, -10, 8, -3, 3, pal.body);
    fillBox(m, -5, 5, -8, 6, -2, 2, pal.bodyDark);
    // Collar / head
    fillBox(m, -3, 3, 6, 11, -2, 2, pal.shell);
    fillBox(m, -2, 2, 9, 12, -1, 1, pal.body);
    // Tie slash
    fillBox(m, -1, 1, -2, 5, 2, 3, pal.shell);
    // Shoulders
    fillBox(m, -10, -6, 2, 6, -2, 2, pal.body);
    fillBox(m, 6, 10, 2, 6, -2, 2, pal.body);
    return noise(m, pal);
}

/** L5 Mirror Break — flat reflective slab with fracture. */
export function bodyMirror(pal) {
    const m = new Map();
    fillBox(m, -2, 2, -11, 11, -6, 6, pal.shell);
    fillBox(m, -1, 1, -10, 10, -5, 5, pal.body);
    // Crack
    for (let y = -8; y <= 8; y++) {
        const x = Math.round(Math.sin(y * 0.4) * 2);
        fillBox(m, x - 1, x, y, y, -6, 6, pal.bodyDark);
    }
    fillEllipsoid(m, 0, 0, 0, 3, 3, 2, pal.shell);
    return noise(m, pal);
}

/** L6 Redemption Arc — radiant sun disc. */
export function bodySun(pal) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 10, 10, 4, pal.body);
    fillEllipsoid(m, 0, 0, 0, 6, 6, 3, pal.shell);
    fillEllipsoid(m, 0, 0, 0, 3, 3, 2, pal.bodyDark);
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x0 = Math.round(Math.cos(a) * 9);
        const y0 = Math.round(Math.sin(a) * 9);
        const x1 = Math.round(Math.cos(a) * 13);
        const y1 = Math.round(Math.sin(a) * 13);
        fillBox(m, Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1), -1, 1, pal.shell);
    }
    return noise(m, pal);
}

/** L7 Forge Wraith — furnace block + stacks. */
export function bodyForge(pal) {
    const m = new Map();
    fillBox(m, -9, 9, -6, 6, -4, 4, pal.body);
    fillBox(m, -7, 7, -4, 4, -3, 3, pal.bodyDark);
    // Stacks
    fillBox(m, -6, -3, 4, 12, -2, 2, pal.shell);
    fillBox(m, 3, 6, 4, 11, -2, 2, pal.shell);
    // Muzzle / mouth
    fillBox(m, -12, -8, -2, 2, -2, 2, pal.bodyDark);
    fillBox(m, -14, -11, -1, 1, -1, 1, pal.shell);
    // Grates
    for (let y = -4; y <= 4; y += 2) fillBox(m, -5, 5, y, y, 3, 4, pal.shell);
    return noise(m, pal);
}

/** L8 Drift Wraith — sparse bone wreck. */
export function bodyDrift(pal) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 8, 4, 3, pal.body);
    fillBox(m, -10, 10, -1, 1, -1, 1, pal.shell);
    fillBox(m, -1, 1, -8, 8, -1, 1, pal.shell);
    fillEllipsoid(m, -6, 3, 0, 3, 3, 2, pal.bodyDark);
    fillEllipsoid(m, 6, -3, 0, 3, 2, 2, pal.bodyDark);
    fillBox(m, 4, 12, 2, 3, -1, 1, pal.shell);
    return noise(m, pal);
}

/** L9 Witness Shadow — twin silhouette of the force unit. */
export function bodyShadow(pal) {
    const m = new Map();
    // Primary mass
    fillEllipsoid(m, -2, 0, 0, 6, 8, 4, pal.body);
    fillEllipsoid(m, -2, 0, 0, 3, 4, 2, pal.shell);
    // Ghost twin offset
    fillEllipsoid(m, 5, 2, 1, 5, 7, 3, pal.bodyDark);
    fillEllipsoid(m, 5, 2, 1, 2, 3, 1, pal.shell);
    // Linking tendril
    fillBox(m, -1, 4, -1, 1, -1, 1, pal.shell);
    return noise(m, pal);
}

/** L10 Corrupted Seal — ring seal with glyph core. */
export function bodySeal(pal) {
    const m = new Map();
    for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * 10);
        const y = Math.round(Math.sin(ang) * 10);
        fillBox(m, x - 1, x + 1, y - 1, y + 1, -2, 2, pal.body);
    }
    fillEllipsoid(m, 0, 0, 0, 5, 5, 3, pal.bodyDark);
    // Glyph strokes
    fillBox(m, -4, 4, -1, 1, -1, 1, pal.shell);
    fillBox(m, -1, 1, -4, 4, -1, 1, pal.shell);
    fillEllipsoid(m, -3, 3, 0, 2, 2, 1, pal.shell);
    fillEllipsoid(m, 3, 3, 0, 2, 2, 1, pal.shell);
    fillBox(m, -2, 2, -6, -4, -1, 1, pal.shell);
    return noise(m, pal);
}

export const BOSS_BODY_BUILDERS = {
    default: bodyDefault,
    parrot: bodyParrot,
    jester: bodyJester,
    suit: bodySuit,
    mirror: bodyMirror,
    sun: bodySun,
    forge: bodyForge,
    drift: bodyDrift,
    shadow: bodyShadow,
    seal: bodySeal
};

export function buildBossBody(shape, pal) {
    const fn = BOSS_BODY_BUILDERS[shape] || BOSS_BODY_BUILDERS.default;
    return fn(pal);
}

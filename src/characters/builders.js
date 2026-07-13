// src/characters/builders.js
// Purpose: Procedural voxel body-part builders (palette-parameterized).
// Dependencies: ../voxel/core.js, ../voxel/helpers.js, ../voxel/palette.js

import * as THREE from 'three';
import { vkey, hash3 } from '../voxel/core.js';
import { fillRow, fillEllipsoid, fillBox, paint, shadeHex } from '../voxel/helpers.js';
import { SUMO_PALETTE } from '../voxel/palette.js';

// ── TORSO: per-row profile [rx, rz, z-offset] — hips y0, neck y23 ──
export const TORSO_PROFILE = [
    [9.5, 8.0, 0],   [10.0, 8.5, 0],  [10.5, 9.0, 0.3],
    [11.0, 9.6, 0.5],[11.4,10.0, 0.7],[11.8,10.4, 1.0], [12.4,11.0, 1.5],
    [12.8,11.4, 1.9],[12.9,11.5, 2.0],[12.7,11.2, 1.8],
    [12.2,10.6, 1.4],[11.6, 9.9, 1.0],[11.1, 9.2, 0.6],
    [10.8, 8.7, 0.35],[10.7, 8.5, 0.3],
    [10.9, 8.6, 0.35],[11.1, 8.7, 0.4],[11.3, 8.6, 0.3],
    [11.7, 8.3, 0.1],[12.0, 7.9, 0],
    [10.6, 7.0,-0.1],[8.0, 5.8,-0.2],
    [4.8, 4.6, 0],  [4.5, 4.3, 0.1]
];

export const HEAD_PROFILE = [
    [5.2, 5.0],[5.8, 5.4],[6.2, 5.6],[6.2, 5.6],[6.0, 5.5],[6.0, 5.5],
    [5.9, 5.4],[5.7, 5.3],[5.5, 5.1],[5.2, 4.8],[4.6, 4.3],[3.6, 3.4]
];

export const DEFAULT_TORSO_PROFILE = TORSO_PROFILE;
export const DEFAULT_HEAD_PROFILE = HEAD_PROFILE;

/** Scale a profile's radii by a factor (for slimmer/bulkier heroes). */
export function scaleProfile(profile, factor) {
    return profile.map((row) => {
        if (row.length === 3) return [row[0] * factor, row[1] * factor, row[2]];
        return [row[0] * factor, row[1] * factor];
    });
}

/**
 * @param {object} palette
 * @param {Array} profile
 * @param {object} options  clothingMode: 'belt' | 'casual' | 'punk'
 */
export function buildTorso(palette = SUMO_PALETTE, profile = TORSO_PROFILE, options = {}) {
    const m = new Map();
    const mode = options.clothingMode || 'belt';
    const skin = palette.skin;
    const skinDark = palette.skinDark || palette.skin;
    const skinD2 = palette.skinD2 || skinDark;
    const freck = palette.freck || skinDark;
    const beardDark = palette.beardDark || palette.hairDark || skinDark;

    for (let y = 0; y < profile.length; y++) {
        const pr = profile[y];
        const shade = Math.min(1.05, 0.9 + y * 0.006);
        fillRow(m, y, pr[0], pr[1], 0, pr[2] || 0, shadeHex(skin, shade));
    }

    // Bare-chest anatomy is authored at the SUMO's coordinates: the pec
    // ellipsoids reach z 9.2+1.7 and the nipple/navel voxels sit at z 11/13.
    // Every clothed build uses a slimmed profile (Joe 0.72, punks 0.78) whose
    // chest surface is only ~6.2 deep, so these details used to hang 3-7
    // voxels out in front of the shirt as bulges and floating specks. They
    // belong to the mode that actually shows skin.
    const bareChest = mode === 'belt' || mode === 'mawashi';

    if (bareChest) {
        // Pecs
        for (const sx of [-1, 1]) {
            fillEllipsoid(m, sx * 5, 15.5, 9.2, 3.4, 2.2, 1.7, skin);
        }
        paint(m, (x, y, z) => {
            if (y === 13 && z >= 6 && Math.abs(x) >= 2 && Math.abs(x) <= 8) return skinDark;
            return null;
        });
        // Chest hair
        paint(m, (x, y, z) => {
            if (y >= 13 && y <= 18 && Math.abs(x) <= 3 && z >= 6 && hash3(x, y, z) < 0.5) return beardDark;
            return null;
        });
    }

    // Spine shading is a CONDITION on existing voxels, not added geometry —
    // safe at any profile scale.
    paint(m, (x, y, z) => {
        if (x === 0 && z <= -7 && y >= 4 && y <= 19) return skinDark;
        return null;
    });
    paint(m, (x, y, z) => {
        if (y >= 17 && hash3(x + 31, y, z) < 0.08) return freck;
        return null;
    });

    if (bareChest) {
        m.set(vkey(-5, 15, 11), skinD2);
        m.set(vkey(5, 15, 11), skinD2);
        m.set(vkey(0, 7, 13), skinD2);
    }

    if (mode === 'belt' || mode === 'mawashi') {
        // 'mawashi' accepted as legacy alias for 'belt'
        const belt = palette.belt || palette.maw || palette.shirt || 0x24406e;
        const beltDark = palette.beltDark || palette.mawDark || palette.shirtDark || 0x172c4e;
        const gold = palette.gold || 0xf2c14e;
        paint(m, (x, y, z) => {
            if (y >= 3 && y <= 6) return (y === 3 || y === 6) ? gold : belt;
            return null;
        });
        fillBox(m, -3, 3, 3, 6, -13, -10, beltDark);
        fillBox(m, -1, 1, 4, 5, -14, -13, gold);
        for (const sx of [-6, -4, -2, 0, 2, 4, 6]) {
            m.set(vkey(sx, 3, 11), belt);
            m.set(vkey(sx, 2, 11), belt);
            m.set(vkey(sx, 1, 10), belt);
            m.set(vkey(sx, 0, 9), belt);
            m.set(vkey(sx, -1, 8), belt);
            m.set(vkey(sx, -2, 8), belt);
            m.set(vkey(sx, -3, 8), gold);
        }
    } else if (mode === 'casual') {
        const shirt = palette.shirt || 0xb03030;
        const shirtDark = palette.shirtDark || 0x802020;
        const jeans = palette.jeans || palette.pants || 0x2a3a60;
        const jeansDark = palette.jeansDark || palette.pantsDark || 0x1a2a40;
        const overall = palette.overall;
        const overallDark = palette.overallDark;
        paint(m, (x, y, z) => {
            if (y >= 0 && y <= 6) return (y <= 1) ? jeansDark : jeans;
            if (y >= 7 && y <= 20) return shirt;
            return null;
        });
        if (overall) {
            // Overall straps
            paint(m, (x, y, z) => {
                if (y >= 8 && y <= 20 && (Math.abs(x) === 4 || Math.abs(x) === 5) && z >= 6) {
                    return overall;
                }
                if (y >= 3 && y <= 7 && Math.abs(x) <= 8) return overall;
                return null;
            });
            paint(m, (x, y, z, c) => {
                if (c === overall && y === 7) return overallDark || overall;
                return null;
            });
        } else {
            paint(m, (x, y, z, c) => {
                if (c === shirt && y === 7) return shirtDark;
                return null;
            });
        }
        shadeClothedChest(m, profile, shirt, shirtDark);
    } else if (mode === 'punk') {
        const jacket = palette.jacket || 0x1a1a20;
        const pants = palette.pants || 0x202030;
        const boots = palette.boots || 0x3a2010;
        const spikes = palette.spikes || 0xc0c0c0;
        paint(m, (x, y, z) => {
            if (y >= 0 && y <= 2) return boots;
            if (y >= 3 && y <= 7) return pants;
            if (y >= 8 && y <= 20) return jacket;
            return null;
        });
        paint(m, (x, y, z, c) => {
            if (c === jacket && hash3(x, y, z) < 0.1 && Math.abs(x) > 8) return spikes;
            return null;
        });
        shadeClothedChest(m, profile, jacket, palette.jacketDark || shadeHex(jacket, 0.6));
    }
    return m;
}

/**
 * Fake a chest/sternum on a clothed torso without adding geometry: darken the
 * garment one voxel deep along a centre seam and under the pec line. Depths
 * come from the profile row, never a constant — that assumption is exactly
 * what made the sumo pecs bulge out of every slimmer hero.
 */
function shadeClothedChest(m, profile, garment, garmentDark) {
    const frontAt = (y) => {
        const pr = profile[y];
        if (!pr) return Infinity;
        return pr[1] + (pr[2] || 0);
    };
    paint(m, (x, y, z, c) => {
        if (c !== garment) return null;
        const front = frontAt(y);
        if (!isFinite(front)) return null;
        const onSurface = z >= front - 1.5;
        // Centre seam down the chest.
        if (onSurface && x === 0 && y >= 10 && y <= 18) return garmentDark;
        // Pec underline: a soft arc a couple of voxels wide.
        if (onSurface && y === 13 && Math.abs(x) >= 2 && Math.abs(x) <= 7) return garmentDark;
        return null;
    });
}

/**
 * @param {object} palette
 * @param {Array} profile
 * @param {object} options  beard, cap, mohawk, topknot (legacy alias: chonmage)
 */
export function buildHead(palette = SUMO_PALETTE, profile = HEAD_PROFILE, options = {}) {
    const m = new Map();
    const skin = palette.skin;
    const skinDark = palette.skinDark || skin;
    const freck = palette.freck || skinDark;
    const hair = palette.hair;
    const hairDark = palette.hairDark || hair;
    const hairLight = palette.hairLight || hair;
    const beard = palette.beard || hair;
    const beardDark = palette.beardDark || hairDark;
    const gold = palette.gold || 0xf2c14e;
    const cream = palette.cream || 0xefe6d0;
    const eyeW = palette.eyeWhite || 0xf5f0e8;
    const pupil = palette.pupil || palette.eye || 0x201409;
    const brow = palette.brow || hairDark;
    const mouth = palette.mouth || 0x7c2018;
    const teeth = palette.teeth || 0xe8e0d0;
    const topknot = options.topknot != null ? options.topknot : options.chonmage;
    const wantBeard = options.beard !== false && (options.beard === true || topknot);
    const wantTopknot = topknot === true || (
        topknot !== false && !options.cap && !options.mohawk &&
        options.beard !== false && options.style === 'sumo'
    );
    // Default sumo look when no style options given
    const isSumoDefault = options.style === 'sumo' || (
        options.beard === undefined && options.cap === undefined &&
        options.mohawk === undefined && topknot === undefined
    );

    for (let y = 0; y < profile.length; y++) {
        fillRow(m, y, profile[y][0], profile[y][1], 0, 0, skin);
    }
    paint(m, (x, y, z) => {
        if (y >= 4 && y <= 6 && Math.abs(x) >= 3 && z >= 4 && hash3(x, y + 7, z) < 0.22) return freck;
        return null;
    });

    if (isSumoDefault || wantBeard) {
        paint(m, (x, y, z) => {
            if (y <= 1 && z >= -3) return beard;
            if (y === 2 && Math.abs(x) >= 3 && z >= -2) return beard;
            if (y >= 3 && y <= 7 && Math.abs(x) >= 5 && z >= -1) return beard;
            return null;
        });
        if (isSumoDefault || wantTopknot) {
            fillBox(m, -2, 2, -1, -1, 3, 5, beard);
            fillBox(m, -1, 1, -2, -2, 3, 4, beardDark);
            m.set(vkey(0, -3, 4), gold);
        }
    } else if (options.beard) {
        paint(m, (x, y, z) => {
            if (y <= 1 && z >= -3) return beard;
            return null;
        });
    }

    // Hair base
    paint(m, (x, y, z) => {
        if (y >= 10) return hair;
        if (y === 9 && z <= 2) return hair;
        if (y === 8 && (z <= 0 || Math.abs(x) >= 5)) return hair;
        if (y >= 4 && y <= 7 && z <= -3) return hair;
        return null;
    });
    paint(m, (x, y, z, cv) => {
        if (cv === hair && hash3(x + 13, y, z + 5) < 0.28) return hairDark;
        return null;
    });

    if (isSumoDefault || wantTopknot) {
        fillBox(m, -1, 1, 12, 12, -2, 0, hairDark);
        m.set(vkey(-1, 12, 1), cream);
        m.set(vkey(0, 12, 1), cream);
        m.set(vkey(1, 12, 1), cream);
        fillBox(m, -2, 2, 13, 13, -2, 2, hair);
        fillBox(m, -3, 3, 13, 13, 3, 4, hair);
        fillBox(m, -1, 1, 14, 14, 0, 3, hairLight);
    }

    if (options.cap) {
        const cap = palette.cap || hair;
        const capDark = palette.capDark || hairDark;
        fillBox(m, -5, 5, 11, 12, -3, 3, cap);
        fillBox(m, -5, 5, 12, 12, 0, 5, cap);
        fillBox(m, -4, 4, 10, 10, -2, 2, capDark);
    }

    if (options.mohawk) {
        fillBox(m, -1, 1, 10, 14, 0, 0, hair);
        fillBox(m, -1, 1, 11, 13, -1, 1, hairDark);
    }

    // Ears
    m.set(vkey(7, 5, 0), skinDark);
    m.set(vkey(7, 6, 0), skinDark);
    m.set(vkey(-7, 5, 0), skinDark);
    m.set(vkey(-7, 6, 0), skinDark);
    // Face
    for (const s of [-1, 1]) {
        m.set(vkey(s * 1, 7, 5), brow);
        m.set(vkey(s * 2, 7, 5), brow);
        m.set(vkey(s * 3, 8, 5), brow);
        m.set(vkey(s * 4, 8, 5), brow);
    }
    m.set(vkey(-3, 6, 5), eyeW);
    m.set(vkey(-2, 6, 5), pupil);
    m.set(vkey(3, 6, 5), eyeW);
    m.set(vkey(2, 6, 5), pupil);
    m.set(vkey(0, 4, 6), skin);
    m.set(vkey(0, 5, 6), skin);
    m.set(vkey(-1, 4, 5), skinDark);
    m.set(vkey(1, 4, 5), skinDark);
    m.set(vkey(-2, 2, 5), mouth);
    m.set(vkey(2, 2, 5), mouth);
    m.set(vkey(-1, 2, 5), teeth);
    m.set(vkey(0, 2, 5), teeth);
    m.set(vkey(1, 2, 5), teeth);
    m.set(vkey(-3, 3, 5), mouth);
    m.set(vkey(3, 3, 5), mouth);
    return m;
}

export function buildArm(palette = SUMO_PALETTE, sideSign = 1) {
    const m = new Map();
    const skin = palette.skin;
    const skinDark = palette.skinDark || skin;
    const freck = palette.freck || skinDark;
    const gold = palette.gold || 0xf2c14e;
    fillEllipsoid(m, 0, -1, 0, 4.6, 4.0, 4.2, shadeHex(skin, 1.02));
    for (let y = -3; y >= -8; y--) fillRow(m, y, 3.7, 3.7, 0, 0, skin);
    fillEllipsoid(m, 0, -5.5, 1.6, 2.8, 2.4, 2.4, skin);
    for (let y = -9; y >= -13; y--) {
        const r = 3.4 - (-9 - y) * 0.16;
        fillRow(m, y, r, r, 0, 0, skin);
    }
    fillRow(m, -14, 2.7, 2.7, 0, 0, skin);
    fillBox(m, -2, 2, -18, -15, -2, 2, skin);
    m.set(vkey(-2, -15, 3), skin);
    m.set(vkey(0, -15, 3), skin);
    m.set(vkey(2, -15, 3), skin);
    if (sideSign > 0) fillBox(m, -4, -3, -16, -15, 0, 2, skin);
    else fillBox(m, 3, 4, -16, -15, 0, 2, skin);
    paint(m, (x, y, z) => {
        if (hash3(x + 17 * sideSign, y, z) < 0.07) return freck;
        return null;
    });
    paint(m, (x, y, z) => {
        if (y === -8) return gold;
        if (z === 2 && y <= -16 && y >= -18 && (x === -1 || x === 1)) return skinDark;
        return null;
    });
    return m;
}

export function buildLeg(palette = SUMO_PALETTE, sideSign = 1, options = {}) {
    const m = new Map();
    const skin = palette.skin;
    const skinDark = palette.skinDark || skin;
    const freck = palette.freck || skinDark;
    const strap = palette.belt || palette.maw || palette.jeans || palette.pants || 0x24406e;
    const shoes = palette.shoes || palette.boots || skinDark;
    for (let y = 0; y >= -7; y--) {
        const r = 5.6 - (0 - y) * 0.09;
        fillRow(m, y, r, r, 0, 0, skin);
    }
    fillRow(m, -8, 4.5, 4.5, 0, 0, skin);
    m.set(vkey(0, -8, 5), skin);
    for (let y = -9; y >= -13; y--) {
        const r = 4.2 - (-9 - y) * 0.18;
        fillRow(m, y, r, r, 0, 0, skin);
    }
    fillEllipsoid(m, 0, -10.5, -1.8, 3.2, 2.4, 2.4, skin);
    fillRow(m, -14, 3.0, 3.0, 0, 0, skin);
    fillBox(m, -3, 3, -16, -15, -4, 7, skin);
    paint(m, (x, y, z) => {
        if (hash3(x + 5 * sideSign, y - 9, z) < 0.05) return freck;
        return null;
    });
    // Trouser the leg for clothed builds. Only the sumo's belt mode goes
    // bare-legged; everyone else wore skin from hip to ankle, which nobody ever
    // noticed because the legs were authored below the floor plane.
    const mode = options.clothingMode || 'belt';
    const clothed = mode !== 'belt' && mode !== 'mawashi';
    const pants = palette.jeans || palette.pants || palette.overall || strap;
    const pantsDark = palette.jeansDark || palette.pantsDark || palette.overallDark
        || shadeHex(pants, 0.7);

    paint(m, (x, y, z) => {
        if (y === 0) return strap;
        if (y <= -15) return shoes;
        if (clothed) {
            if (y === -14) return pantsDark; // cuff above the shoe
            if (y > -14) return z > 4 ? shadeHex(pants, 1.05) : pants;
        }
        if (z === 7 && (x === -2 || x === 0 || x === 2)) return skinDark;
        return null;
    });
    return m;
}

/** Build glowing eye meshes parented later to headPivot (enemies). */
export function buildGlowEyes(palette) {
    const color = palette.eyeGlow || 0xff4040;
    const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        // Raised for the bloom pass (Graphics.md Phase B) — eyes should read
        // as a clear neon glow, not a flat bright color.
        emissiveIntensity: 2.8,
        roughness: 0.4,
        metalness: 0.1
    });
    const geo = new THREE.BoxGeometry(1.2, 1.0, 0.6);
    const left = new THREE.Mesh(geo, mat);
    const right = new THREE.Mesh(geo, mat);
    left.position.set(-2.5, 6, 5.5);
    right.position.set(2.5, 6, 5.5);
    return { left, right, mat, geo };
}

// src/voxel/helpers.js
// Purpose: Voxel map fill helpers.
// Dependencies: ./core.js, three

import * as THREE from 'three';
import { vkey } from './core.js';

/**
 * Fill an elliptical disc of voxels at height `cy`, centered `(cx,cz)` with
 * radii `(rx,rz)`. Either radius below 0.4 degenerates to a single voxel at
 * `(round(cx), cy, round(cz))` rather than a zero-area ellipse.
 */
export function fillRow(m, cy, rx, rz, cx, cz, color) {
    if (rx < 0.4 || rz < 0.4) {
        m.set(vkey(Math.round(cx), cy, Math.round(cz)), color);
        return;
    }
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const z0 = Math.floor(cz - rz), z1 = Math.ceil(cz + rz);
    for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
            const dx = (x - cx) / rx, dz = (z - cz) / rz;
            if (dx * dx + dz * dz <= 1.02) m.set(vkey(x, cy, z), color);
        }
    }
}

/** Stack of fillRow() calls from cy-ry to cy+ry, narrowing radii by the ellipsoid profile. */
export function fillEllipsoid(m, cx, cy, cz, rx, ry, rz, color) {
    const y0 = Math.round(cy - ry), y1 = Math.round(cy + ry);
    for (let y = y0; y <= y1; y++) {
        const t = (y - cy) / ry;
        const s = Math.sqrt(Math.max(0, 1 - t * t));
        fillRow(m, y, Math.max(0.4, rx * s), Math.max(0.4, rz * s), cx, cz, color);
    }
}

/** Inclusive-bounds axis-aligned box fill. */
export function fillBox(m, x0, x1, y0, y1, z0, z1, color) {
    for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
            for (let z = z0; z <= z1; z++) {
                m.set(vkey(x, y, z), color);
            }
        }
    }
}

/**
 * Re-color existing voxels in place: `fn(x,y,z,color)` runs over every entry
 * and a returned color hex overwrites it (null/undefined/same color leaves it
 * untouched). Never adds new voxels — it can't paint outside what's filled.
 */
export function paint(m, fn) {
    for (const [k, cv] of m) {
        const p = k.split(',');
        const nc = fn(+p[0], +p[1], +p[2], cv);
        if (nc !== undefined && nc !== null && nc !== cv) m.set(k, nc);
    }
}

let _sc = null;
/** Multiply a hex color's RGB by `f` (clamped to 1.0/channel); returns a new hex. */
export function shadeHex(hex, f) {
    if (!_sc) _sc = new THREE.Color();
    _sc.setHex(hex);
    _sc.r = Math.min(1, _sc.r * f);
    _sc.g = Math.min(1, _sc.g * f);
    _sc.b = Math.min(1, _sc.b * f);
    return _sc.getHex();
}

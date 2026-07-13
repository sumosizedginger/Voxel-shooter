// src/voxel/helpers.js
// Purpose: Voxel map fill helpers.
// Dependencies: ./core.js, three

import * as THREE from 'three';
import { vkey } from './core.js';

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

export function fillEllipsoid(m, cx, cy, cz, rx, ry, rz, color) {
    const y0 = Math.round(cy - ry), y1 = Math.round(cy + ry);
    for (let y = y0; y <= y1; y++) {
        const t = (y - cy) / ry;
        const s = Math.sqrt(Math.max(0, 1 - t * t));
        fillRow(m, y, Math.max(0.4, rx * s), Math.max(0.4, rz * s), cx, cz, color);
    }
}

export function fillBox(m, x0, x1, y0, y1, z0, z1, color) {
    for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
            for (let z = z0; z <= z1; z++) {
                m.set(vkey(x, y, z), color);
            }
        }
    }
}

export function paint(m, fn) {
    for (const [k, cv] of m) {
        const p = k.split(',');
        const nc = fn(+p[0], +p[1], +p[2], cv);
        if (nc !== undefined && nc !== null && nc !== cv) m.set(k, nc);
    }
}

let _sc = null;
export function shadeHex(hex, f) {
    if (!_sc) _sc = new THREE.Color();
    _sc.setHex(hex);
    _sc.r = Math.min(1, _sc.r * f);
    _sc.g = Math.min(1, _sc.g * f);
    _sc.b = Math.min(1, _sc.b * f);
    return _sc.getHex();
}

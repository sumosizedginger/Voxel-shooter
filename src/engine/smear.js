// src/engine/smear.js
// Purpose: Pooled attack-arc "smear" meshes — the motion trail a swing leaves.
// Dependencies: three, ./renderer.js

import * as THREE from 'three';
import { scene } from './renderer.js';
import { getSetting } from './settings.js';

// Fighting games draw the path of a strike, not just the limb. Without it an
// attack reads as "the arm moved"; with it, "the arm STRUCK". Pool-capped:
// a spin-kick into a crowd must not spawn geometry per victim.
const POOL_SIZE = 4;
const LIFETIME = 0.12;

// A 110-degree sector fan, flat in XY, sweeping counter-clockwise from +X.
const ARC_ANGLE = Math.PI * 0.61;

let pool = null;

function makeArcGeometry() {
    const segments = 12;
    const inner = 0.35;
    const outer = 1.0;
    const positions = [];
    const uvs = [];
    for (let i = 0; i < segments; i++) {
        const a0 = -ARC_ANGLE / 2 + (i / segments) * ARC_ANGLE;
        const a1 = -ARC_ANGLE / 2 + ((i + 1) / segments) * ARC_ANGLE;
        const p = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r, 0];
        positions.push(...p(a0, inner), ...p(a1, inner), ...p(a1, outer));
        positions.push(...p(a0, inner), ...p(a1, outer), ...p(a0, outer));
        // v runs 0 at the inner edge → 1 at the outer, for the fade.
        uvs.push(0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
}

/** A full annulus for attacks whose hitbox is genuinely omnidirectional. */
function makeRingGeometry() {
    const segments = 28;
    const inner = 0.35;
    const outer = 1.0;
    const positions = [];
    const uvs = [];
    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const p = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r, 0];
        positions.push(...p(a0, inner), ...p(a1, inner), ...p(a1, outer));
        positions.push(...p(a0, inner), ...p(a1, outer), ...p(a0, outer));
        uvs.push(0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
}

function ensurePool() {
    if (pool) return pool;
    const arcGeo = makeArcGeometry();
    const ringGeo = makeRingGeometry();
    pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
        // Each smear owns its material: the tint is per-character (palette.gold)
        // and the opacity animates. charMat is shared scene-wide and must never
        // be touched for per-entity effects.
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(arcGeo, mat);
        mesh.visible = false;
        mesh.renderOrder = 5;
        scene.add(mesh);
        pool.push({ mesh, mat, life: 0, arcGeo, ringGeo });
    }
    return pool;
}

/**
 * Spawn a smear arc for one swing.
 * @param {object} opts
 *   position {x,y,z} world centre of the arc (the attacker's chest/hip)
 *   facing   ±1 along X
 *   plane    'horizontal' | 'vertical' | 'rising' | 'forward'
 *   radius   world units (usually the move's range)
 *   color    hex tint
 */
export function spawnSmear({
    position,
    facing = 1,
    plane = 'horizontal',
    radius = 2,
    color = 0xffffff,
    tilt = 0.22,
    ring = false
}) {
    // Accessibility (Phase 3): reduceMotion shrinks the sweep arcs.
    if (getSetting('reduceMotion')) radius *= 0.65;
    const p = ensurePool();
    // Reuse the oldest slot when saturated rather than growing the pool.
    let slot = p.find((s) => s.life <= 0);
    if (!slot) slot = p.reduce((a, b) => (a.life < b.life ? a : b));

    const { mesh, mat } = slot;
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.setScalar(radius);
    mesh.geometry = ring ? slot.ringGeo : slot.arcGeo;
    mat.color.setHex(color);

    if (plane === 'vertical') {
        // A vertical smear is a true downward chop, regardless of which way
        // the attacker faces. Mirroring the old rotation made left-facing
        // overhands climb into the air instead of falling toward the target.
        mesh.rotation.set(0, facing < 0 ? Math.PI : 0, -Math.PI / 2);
    } else if (plane === 'forward') {
        // The fan is authored around +X in XY. Rotate it only enough to give
        // a downward strike read: +X remains the facing direction, instead of
        // being mapped to vertical as the old kick plane did.
        mesh.rotation.set(0, 0, facing > 0 ? -tilt : Math.PI + tilt);
    } else if (plane === 'rising') {
        // Up-and-forward arc for launchers (the uppercut): the fan is centred on
        // +X, so tilting it +45° sweeps from low-front to high-front — it stays
        // IN FRONT of the fighter and rises with the punch instead of raking the
        // ground across the legs.
        mesh.rotation.set(0, 0, facing > 0 ? Math.PI / 4 : Math.PI - Math.PI / 4);
    } else {
        // Flat in the XZ plane, arc opening toward the swing direction.
        mesh.rotation.set(-Math.PI / 2, 0, facing > 0 ? 0 : Math.PI);
    }

    slot.life = LIFETIME;
    mesh.visible = true;
    mat.opacity = 0.85;
}

/** Fade and retire live smears. Call once per frame. */
export function updateSmears(dt) {
    if (!pool) return;
    for (const slot of pool) {
        if (slot.life <= 0) continue;
        slot.life -= dt;
        if (slot.life <= 0) {
            slot.life = 0;
            slot.mesh.visible = false;
            slot.mat.opacity = 0;
            continue;
        }
        const k = slot.life / LIFETIME;
        slot.mat.opacity = 0.85 * k;
        // Expand slightly as it fades — reads as dissipating energy.
        slot.mesh.scale.multiplyScalar(1 + 0.6 * dt);
    }
}

/** Live smear count — used by tests to assert the pool never grows. */
export function activeSmearCount() {
    if (!pool) return 0;
    return pool.filter((s) => s.life > 0).length;
}

export function disposeSmears() {
    if (!pool) return;
    for (const slot of pool) {
        scene.remove(slot.mesh);
        slot.mat.dispose();
    }
    if (pool[0]) {
        pool[0].arcGeo.dispose();
        pool[0].ringGeo.dispose();
    }
    pool = null;
}

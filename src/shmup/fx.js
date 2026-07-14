// src/shmup/fx.js
// Purpose: side-view explosions, shards, sparks, muzzle flashes.
// Dependencies: three, ./camera (shake), voxel/core (hash3)
//
// DEVIATION from PLAN.md (Phase 2 said "dust bursts only, Phase 8 adds the real
// side-view FX"): this module lands in Phase 2 instead. The reason is gotcha G4
// itself — engine/particles.js assumes a ground plane (shards gravity-bounce at
// y≈0.04, the shockwave ring is rotated flat into XZ), so in a side view its
// shards would pile up on the floor of the level and its rings would be edge-on
// and invisible. Using it as a stopgap wouldn't be a cheap approximation, it
// would be visibly wrong, and every explosion in the game would have to be
// rewritten later anyway. Building it once, correctly, is cheaper.
//
// Everything here is XY, at z=0, with no floor. Rings are NOT rotated: three's
// RingGeometry already lies in the XY plane, which is exactly the plane we play
// in — the kit rotates it to XZ for its brawler, and that's the bug we're
// avoiding.

import * as THREE from 'three';
import { hash3 } from '../voxel/core.js';
import { shakeCamera } from './camera.js';
import { getSetting } from '../engine/settings.js';

const SHARD_CAP = 320;
const SPARK_CAP = 256;
const RING_CAP = 12;
const GRAVITY = -3.2;         // gentle: this is space, but debris should still arc

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();
const PARKED = new THREE.Vector3(0, -9999, 0);

let scene = null;
let shardMesh = null, sparkMesh = null;
let rings = [];
const shards = [];
const sparks = [];

function park(mesh, i) {
    _dummy.position.copy(PARKED);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.setScalar(0.001);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
}

export function initFx(sceneRef) {
    if (scene) return;
    scene = sceneRef;

    // Shards carry the dead thing's own colors, so a kill reads as "that
    // specific enemy came apart" — vertexColors would need per-instance color,
    // so use instanceColor instead (one attribute, still one draw call).
    shardMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.09, 0.09, 0.09),
        new THREE.MeshStandardMaterial({ roughness: 0.7 }),
        SHARD_CAP
    );
    shardMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(SHARD_CAP * 3), 3
    );
    shardMesh.frustumCulled = false;
    shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(shardMesh);

    sparkMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.07, 0.07, 0.07),
        new THREE.MeshBasicMaterial({ toneMapped: false }),
        SPARK_CAP
    );
    sparkMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(SPARK_CAP * 3), 3
    );
    sparkMesh.frustumCulled = false;
    sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(sparkMesh);

    for (let i = 0; i < SHARD_CAP; i++) {
        shards.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0, life: 0, maxLife: 1, color: 0xffffff });
        park(shardMesh, i);
    }
    for (let i = 0; i < SPARK_CAP; i++) {
        sparks.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: 0xffffff, size: 1 });
        park(sparkMesh, i);
    }
    shardMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < RING_CAP; i++) {
        const m = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.34, 28),        // XY plane already — do NOT rotate
            new THREE.MeshBasicMaterial({
                color: 0xffd9a0, transparent: true, opacity: 0, side: THREE.DoubleSide,
                depthWrite: false, toneMapped: false
            })
        );
        m.visible = false;
        scene.add(m);
        rings.push({ mesh: m, t: 0, dur: 0.4, size: 1 });
    }
}

function freeShard() {
    for (const s of shards) if (!s.alive) return s;
    return null;
}
function freeSpark() {
    for (const s of sparks) if (!s.alive) return s;
    return null;
}

/**
 * Blow a voxel model apart into its own colors.
 * Deterministic sampling via hash3 (never Math.random) so the same model always
 * breaks the same way — the SHIP_PLAN §6 rule, and it makes deaths reproducible.
 */
export function shatter(x, y, voxMap, scale, count = 8) {
    if (!scene || !voxMap) return;
    let picked = 0;
    for (const [k, color] of voxMap) {
        if (picked >= count) break;
        const p = k.split(',');
        const vx = +p[0], vy = +p[1], vz = +p[2];
        // Sample ~evenly across the model rather than taking the first N keys
        // (which would all come from one corner of the map).
        if (hash3(vx, vy, vz) > count / Math.max(1, voxMap.size) * 3) continue;

        const s = freeShard();
        if (!s) return;
        const ox = vx * scale, oy = vy * scale;
        const spd = 2.5 + hash3(vy, vz, vx) * 4.5;
        const ang = Math.atan2(oy, ox) + (hash3(vz, vx, vy) - 0.5) * 1.2;
        s.alive = true;
        s.x = x + ox;
        s.y = y + oy;
        s.vx = Math.cos(ang) * spd;
        s.vy = Math.sin(ang) * spd + 1.5;
        s.rot = 0;
        s.spin = (hash3(vx, vz, vy) - 0.5) * 14;
        s.maxLife = s.life = 0.7 + hash3(vz, vy, vx) * 0.5;
        s.color = color;
        picked++;
    }
}

/** A burst of sparks + an expanding ring + a camera kick. */
export function explode(x, y, size = 1, color = 0xffb060) {
    if (!scene) return;
    const n = Math.round(10 + size * 12);
    for (let i = 0; i < n; i++) {
        const s = freeSpark();
        if (!s) break;
        const ang = (i / n) * Math.PI * 2 + hash3(i, x | 0, y | 0) * 0.6;
        const spd = (3 + hash3(x | 0, i, y | 0) * 7) * size;
        s.alive = true;
        s.x = x; s.y = y;
        s.vx = Math.cos(ang) * spd;
        s.vy = Math.sin(ang) * spd;
        s.maxLife = s.life = 0.25 + hash3(i, i, i) * 0.3;
        s.color = color;
        s.size = size;
    }
    ring(x, y, size, color);
    shakeCamera(Math.min(0.5, 0.06 * size), 3.0);
}

/** The expanding shockwave. Flat in XY — it faces the camera by construction. */
export function ring(x, y, size = 1, color = 0xffd9a0) {
    for (const r of rings) {
        if (r.mesh.visible) continue;
        r.mesh.position.set(x, y, 0.1);
        r.mesh.rotation.set(0, 0, 0);     // G4: the kit rotates this into XZ. Don't.
        r.mesh.material.color.setHex(color);
        r.mesh.visible = true;
        r.t = 0;
        r.dur = 0.34 + size * 0.16;
        r.size = size;
        return;
    }
}

/** A short cone of sparks at the muzzle, pointing along the shot. */
export function muzzleFlash(x, y, angle = 0, color = 0x9fe8ff) {
    for (let i = 0; i < 4; i++) {
        const s = freeSpark();
        if (!s) return;
        const a = angle + (hash3(i, x | 0, y | 0) - 0.5) * 0.8;
        const spd = 5 + hash3(i, i, x | 0) * 5;
        s.alive = true;
        s.x = x; s.y = y;
        s.vx = Math.cos(a) * spd;
        s.vy = Math.sin(a) * spd;
        s.maxLife = s.life = 0.07 + hash3(i, 2, 3) * 0.05;
        s.color = color;
        s.size = 0.6;
    }
}

/** Sparks where a shot met armor and did nothing. */
export function sparkHit(x, y, color = 0xffe0a0) {
    for (let i = 0; i < 5; i++) {
        const s = freeSpark();
        if (!s) return;
        const a = hash3(i, x | 0, y | 0) * Math.PI * 2;
        const spd = 2 + hash3(x | 0, y | 0, i) * 4;
        s.alive = true;
        s.x = x; s.y = y;
        s.vx = Math.cos(a) * spd;
        s.vy = Math.sin(a) * spd;
        s.maxLife = s.life = 0.12 + hash3(i, 5, 7) * 0.1;
        s.color = color;
        s.size = 0.7;
    }
}

export function clearFx() {
    for (const s of shards) s.alive = false;
    for (const s of sparks) s.alive = false;
    for (const r of rings) r.mesh.visible = false;
}

export function updateFx(dt) {
    if (!scene) return;

    // Live shards are packed into instance slots [0, i); the rest get parked.
    // The instance slot is NOT the pool slot — nothing outside this loop cares
    // which instance drew which shard, so packing keeps the parked tail small.
    let i = 0;
    for (const s of shards) {
        if (!s.alive) continue;
        s.life -= dt;
        if (s.life <= 0) { s.alive = false; continue; }
        s.vy += GRAVITY * dt;                 // arcs, but never lands: no floor here
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.spin * dt;
        const f = Math.min(1, s.life / s.maxLife);
        _dummy.position.set(s.x, s.y, 0);
        _dummy.rotation.set(s.rot * 0.7, s.rot, s.rot * 0.4);
        _dummy.scale.setScalar(0.6 + f * 0.6);
        _dummy.updateMatrix();
        shardMesh.setMatrixAt(i, _dummy.matrix);
        _col.setHex(s.color);
        shardMesh.setColorAt(i, _col);
        i++;
    }
    for (let j = i; j < SHARD_CAP; j++) park(shardMesh, j);
    shardMesh.instanceMatrix.needsUpdate = true;
    if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;

    let k = 0;
    for (const s of sparks) {
        if (!s.alive) continue;
        s.life -= dt;
        if (s.life <= 0) { s.alive = false; continue; }
        s.vx *= (1 - 2.5 * dt);               // sparks brake hard, then wink out
        s.vy *= (1 - 2.5 * dt);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const f = Math.min(1, s.life / s.maxLife);
        _dummy.position.set(s.x, s.y, 0.05);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(Math.max(0.05, f * s.size * 1.4));
        _dummy.updateMatrix();
        sparkMesh.setMatrixAt(k, _dummy.matrix);
        _col.setHex(s.color);
        sparkMesh.setColorAt(k, _col);
        k++;
    }
    for (let j = k; j < SPARK_CAP; j++) park(sparkMesh, j);
    sparkMesh.instanceMatrix.needsUpdate = true;
    if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;

    const flashOk = !getSetting('reduceFlashing');
    for (const r of rings) {
        if (!r.mesh.visible) continue;
        r.t += dt;
        const f = r.t / r.dur;
        if (f >= 1) { r.mesh.visible = false; continue; }
        r.mesh.scale.setScalar((0.4 + f * 3.2) * r.size);
        r.mesh.material.opacity = (flashOk ? 0.75 : 0.35) * (1 - f);
    }
}

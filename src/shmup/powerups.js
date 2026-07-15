// src/shmup/powerups.js
// Purpose: pickups (the Witness shard, Whisper Bits) and the Bits themselves.
// Dependencies: three, ./bullets, ./force, ./fx, ./sfx, ./palette
//
// NARRATIVE_PLAN C4: the Council drones replace the missile/bit pickup economy,
// and SPEED-UPS ARE CUT — the bible has no speed economy, and its slow/drag
// debuffs (the Beige Slope's 15%-per-stack slow) need a stable baseline speed to
// mean anything. A speed-up would quietly break the boss.
//
// So there are exactly two pickups:
//   shard — levels the Witness 1 -> 3
//   bit   — grants a Whisper Bit (max 2)
//
// Bible §03 on the Bits: "Two orbiting satellites that fire weak homing shots.
// Cannot absorb damage. Pure DPS supplement. Whisper Bits are the only arsenal
// system that does not correspond to a Council seat. They are ambient Lattice
// noise that the Vessel has learned to amplify. They are the parts of the
// architecture that were never named."

import * as THREE from 'three';
import { KIND, spawn, circleHit } from './bullets.js';
import { levelUpWitness } from './force.js';
import { sfx } from './sfx.js';
import { ring } from './fx.js';
import { VIOLET, PICKUP_PALETTE, SHIP_PALETTE } from './palette.js';
import { despawnX } from './camera.js';

export const PICKUP_R = 0.5;
const DRIFT_VX = -1.5;          // they drift left, and you have to go get them
const BOB_AMP = 0.35;
const BOB_HZ = 1.2;

export const MAX_BITS = 2;
const BIT_FIRE_EVERY = 0.55;
const BIT_DMG = 1;
const BIT_ORBIT_R = 0.85;

let _shardGeo = null;
let _shardMat = null;
let _bitGeo = null;
let _bitMat = null;

function ensureGeo() {
    if (_shardGeo) return;
    // The shard IS a piece of the Witness, so it wears the Witness's violet.
    _shardGeo = new THREE.OctahedronGeometry(0.3, 0);
    _shardMat = new THREE.MeshStandardMaterial({
        color: 0x1a1030, emissive: VIOLET, emissiveIntensity: 2.6
    });
    _bitGeo = new THREE.SphereGeometry(0.18, 10, 8);
    _bitMat = new THREE.MeshStandardMaterial({
        color: 0x08161c, emissive: PICKUP_PALETTE.bit, emissiveIntensity: 2.4
    });
}

export function createPickups(scene, world) {
    ensureGeo();
    const p = {
        scene,
        items: [],
        bits: [],           // the orbiting Whisper Bits
        _t: 0
    };
    world.pickups = p;
    world.spawnPickup = (kind, x, y) => spawnPickup(p, kind, x, y);
    return p;
}

/**
 * @param {string} kind 'shard' | 'bit'
 * @param {object} [opts] { recoveryOnly } — LEVELS_PLAN F1: a recovery pickup
 *        only exists on a post-death run, so it never inflates a clean one.
 */
export function spawnPickup(p, kind, x, y, opts = {}) {
    ensureGeo();
    const isShard = kind === 'shard';
    const mesh = new THREE.Mesh(
        isShard ? _shardGeo : _bitGeo,
        isShard ? _shardMat : _bitMat
    );
    mesh.position.set(x, y, 0);
    p.scene.add(mesh);

    const item = {
        alive: true,
        kind,
        x, y,
        baseY: y,
        r: PICKUP_R,
        t: 0,
        mesh,
        recoveryOnly: !!opts.recoveryOnly
    };
    p.items.push(item);
    return item;
}

function despawn(p, item) {
    item.alive = false;
    p.scene.remove(item.mesh);
}

export function clearPickups(p) {
    for (const item of p.items) if (item.alive) p.scene.remove(item.mesh);
    p.items.length = 0;
}

/** Collect one. Returns the HUD label to flash (R-Type's own convention). */
function collect(p, item, world) {
    const w = world.witness;
    if (item.kind === 'shard') {
        if (w && levelUpWitness(w)) {
            return 'WITNESS ' + w.level;
        }
        // Already at level 3 — she gets score instead of nothing.
        world.score += 1000;
        sfx.pickup();
        return 'WITNESS MAX';
    }
    if (item.kind === 'bit') {
        if (p.bits.length < MAX_BITS) {
            addBit(p);
            sfx.pickup();
            return 'WHISPER BIT';
        }
        world.score += 500;
        sfx.pickup();
        return 'BITS FULL';
    }
    return '';
}

function addBit(p) {
    ensureGeo();
    const mesh = new THREE.Mesh(_bitGeo, _bitMat);
    p.scene.add(mesh);
    p.bits.push({ mesh, fireT: Math.random() * BIT_FIRE_EVERY, phase: p.bits.length * Math.PI });
}

/** Bits are lost with a life — they were never really hers. */
export function clearBits(p) {
    for (const b of p.bits) p.scene.remove(b.mesh);
    p.bits.length = 0;
}

export function updatePickups(p, dt, player, world) {
    p._t += dt;
    const cull = despawnX(3);

    for (const item of p.items) {
        if (!item.alive) continue;
        item.t += dt;
        item.x += DRIFT_VX * dt;
        item.y = item.baseY + Math.sin(item.t * BOB_HZ * Math.PI * 2) * BOB_AMP;
        item.mesh.position.set(item.x, item.y, 0);
        item.mesh.rotation.y += dt * 2.4;
        item.mesh.rotation.z += dt * 1.1;

        if (item.x < cull) { despawn(p, item); continue; }

        if (player.alive && circleHit(player.x, player.y, player.r + 0.35, item.x, item.y, item.r)) {
            const label = collect(p, item, world);
            ring(item.x, item.y, 1.1, item.kind === 'shard' ? VIOLET : PICKUP_PALETTE.bit);
            if (world.flashPickup) world.flashPickup(label);
            despawn(p, item);
        }
    }
    // Compact the list so it can't grow forever over a long level.
    if (p.items.length > 32) p.items = p.items.filter((i) => i.alive);

    updateBits(p, dt, player, world);
}

function updateBits(p, dt, player, world) {
    for (let i = 0; i < p.bits.length; i++) {
        const b = p.bits[i];
        const a = p._t * 2.2 + b.phase;
        b.mesh.position.set(
            player.x + Math.cos(a) * BIT_ORBIT_R,
            player.y + Math.sin(a) * BIT_ORBIT_R * 0.7,
            0
        );
        b.mesh.visible = player.alive;
        if (!player.alive) continue;

        b.fireT -= dt;
        if (b.fireT <= 0) {
            b.fireT = BIT_FIRE_EVERY;
            const target = nearest(b.mesh.position.x, b.mesh.position.y, world.enemies.items);
            spawn(world.bullets, {
                x: b.mesh.position.x, y: b.mesh.position.y,
                vx: 16, vy: 0,
                r: 0.1, dmg: BIT_DMG, kind: KIND.BIT,
                homing: target ? 2.6 : 0,
                target,
                life: 2.0
            });
        }
    }
}

function nearest(x, y, enemies) {
    let best = null;
    let bd = Infinity;
    for (const e of enemies) {
        if (!e.alive) continue;
        const d = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d < bd) { bd = d; best = e; }
    }
    return best;
}

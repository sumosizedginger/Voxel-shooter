// src/shmup/enemies/index.js
// Purpose: the enemy pool — spawn, update, draw, die.
// Dependencies: three, ./roster, ./patterns, ../assets/enemies, ../fx, ../sfx
//
// PLAN.md §2.4/§2.6. Enemies are plain objects in a flat array; behavior comes
// from named pattern/fire functions. Geometry and materials are built ONCE per
// type at init (ASSETS_PLAN R2) and shared by every instance — that's what
// keeps draw calls flat when 30 of them are on screen.

import * as THREE from 'three';
import { buildVoxelGeo } from '../../voxel/core.js';
import { difficultyMultipliers } from '../../engine/settings.js';
import { ROSTER } from './roster.js';
import { PATTERNS, FIRES } from './patterns.js';
import { ENEMY_ASSETS } from '../assets/enemies.js';
import { FOE_PALETTE } from '../palette.js';
import { shatter, explode } from '../fx.js';
import { sfx } from '../sfx.js';
import { despawnX } from '../camera.js';
import { decayStacks } from '../hammer.js';
import { tickCast, interruptCast } from '../systems/cast.js';
import { fireMimic } from '../systems/copybuffer.js';

const MAX_ENEMIES = 64;
const MIMIC_EVERY = 1.6;

let _scene = null;
const _types = {};        // type -> { geo, mat, voxMap, scale, barrel? }

/** Build every type's geometry + material once. Idempotent. */
export function initEnemies(scene) {
    if (_scene) return;
    _scene = scene;

    for (const [name, def] of Object.entries(ENEMY_ASSETS)) {
        const voxMap = def.buildMap(FOE_PALETTE);
        const geo = buildVoxelGeo(voxMap);
        geo.center();
        // Shared per type (R2): every instance is a new Mesh over THESE.
        // Glow geometry/materials are shared the same way — a per-instance
        // material would multiply draw calls by the enemy count.
        const glow = (def.glow || []).map((g) => ({
            geo: new THREE.SphereGeometry(g.r, 10, 8),
            mat: new THREE.MeshStandardMaterial({
                color: 0x000000, emissive: g.color, emissiveIntensity: g.intensity
            }),
            pos: g.pos,
            pulse: !!g.pulse
        }));
        _types[name] = {
            geo,
            mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
            voxMap,
            scale: def.scale,
            glow
        };
    }
}

/**
 * Assemble one instance of a type: a Group holding the scaled hull mesh plus
 * its glow meshes at world-unit offsets. The group is unscaled, so glow
 * positions read in world units and don't have to be divided by the voxel scale.
 */
function buildInstance(t) {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(t.geo, t.mat);
    hull.scale.setScalar(t.scale);
    hull.castShadow = true;
    group.add(hull);
    const pulses = [];
    for (const g of t.glow) {
        const m = new THREE.Mesh(g.geo, g.mat);
        m.position.set(g.pos[0], g.pos[1], g.pos[2]);
        group.add(m);
        if (g.pulse) pulses.push(m);
    }
    return { group, pulses };
}

function blankEnemy() {
    return {
        alive: false,
        type: null,
        x: 0, y: 0, vx: 0, vy: 0,
        r: 0.3, hp: 1, maxHp: 1, score: 0,
        aim: 0,
        contactKills: true,
        onCeiling: false,
        drops: null,
        pattern: null, patternState: null,
        fire: null, fireState: null,
        mesh: null, barrel: null, pulses: null,
        hitFlash: 0,
        // S2 (Phase 9A) hangs its cast state here; nothing reads it yet.
        cast: null, castT: 0,
        staggered: 0,
        /** The violet window: interrupted casts and Scribe marks open it. 3x damage. */
        weakpointT: 0,
        marked: 0,
        guardBroken: false,
        slugStacks: 0, slugStackT: 0
    };
}

export function createEnemyPool(capacity = MAX_ENEMIES) {
    const items = new Array(capacity);
    for (let i = 0; i < capacity; i++) items[i] = blankEnemy();
    return { items, capacity, live: 0 };
}

/**
 * Spawn one enemy.
 * @param {object} pool
 * @param {string} type a ROSTER key
 * @param {object} opts { x, y, vx?, vy?, onCeiling?, patternState?, fireState?, hp? }
 * @returns {object|null} the enemy, or null if the pool is full
 */
export function spawnEnemy(pool, type, opts = {}) {
    const def = ROSTER[type];
    if (!def) return null;

    let e = null;
    for (const item of pool.items) {
        if (!item.alive) { e = item; break; }
    }
    if (!e) return null;

    const diff = difficultyMultipliers();
    Object.assign(e, blankEnemy(), {
        alive: true,
        type,
        x: opts.x != null ? opts.x : 0,
        y: opts.y != null ? opts.y : 8,
        vx: opts.vx != null ? opts.vx : (def.vx || 0),
        vy: opts.vy != null ? opts.vy : 0,
        r: def.r,
        // Difficulty scales HP and damage at spawn (C10) — and never a clock.
        hp: Math.max(1, Math.round((opts.hp != null ? opts.hp : def.hp) * diff.enemyHp)),
        score: def.score,
        contactKills: def.contactKills !== false,
        onCeiling: !!opts.onCeiling,
        drops: opts.drops !== undefined ? opts.drops : (def.drops || null),
        pattern: PATTERNS[def.pattern] || null,
        patternState: { ...(def.patternState || {}), ...(opts.patternState || {}) },
        fire: def.fire ? FIRES[def.fire] : null,
        fireState: { ...(def.fireState || {}), ...(opts.fireState || {}) },
        cast: opts.cast || null,
        castT: opts.cast ? (opts.cast.duration || 1.4) : 0,
        mimic: !!opts.mimic
    });
    e.maxHp = e.hp;

    // Enemy bullet damage also scales with difficulty.
    if (e.fireState.dmg) e.fireState.dmg = Math.round(e.fireState.dmg * diff.enemyDmg);

    const t = _types[def.asset];
    if (t) {
        const { group, pulses } = buildInstance(t);
        if (e.onCeiling) group.rotation.z = Math.PI;    // crawlers hang upside down
        group.position.set(e.x, e.y, 0);
        _scene.add(group);
        e.mesh = group;
        e.pulses = pulses;

        if (def.hasBarrel && _types.gunpodBarrel) {
            const b = buildInstance(_types.gunpodBarrel);
            group.add(b.group);                          // child: it pivots alone
            e.barrel = b.group;
        }
    }

    pool.live++;
    return e;
}

/** Remove an enemy without a death (off-screen cull, checkpoint rewind). */
export function despawnEnemy(pool, e) {
    if (!e.alive) return;
    e.alive = false;
    if (e.mesh) {
        _scene.remove(e.mesh);
        // geo/mat are SHARED per type (R2) — disposing them here would blank
        // out every other enemy of the same type. Only the Mesh is per-instance.
        e.mesh = null;
        e.barrel = null;
        e.pulses = null;
    }
    pool.live--;
}

/** Kill an enemy properly: shatter, boom, score, drop. */
export function killEnemy(pool, e, world) {
    if (!e.alive) return;
    const t = _types[ROSTER[e.type].asset];
    if (t) {
        const n = e.type === 'carrier' ? 20 : 8;         // R5
        shatter(e.x, e.y, t.voxMap, t.scale, n);
    }
    explode(e.x, e.y, e.type === 'carrier' ? 1.6 : 0.9);
    sfx.boom();

    world.score += e.score;
    if (e.drops && world.spawnPickup) world.spawnPickup(e.drops, e.x, e.y);
    if (world.onEnemyKilled) world.onEnemyKilled(e);

    despawnEnemy(pool, e);
}

/** Damage an enemy. Returns true if it died. */
export function damageEnemy(pool, e, dmg, world) {
    // S2 interrupt: any hit mid-cast opens the violet weakpoint (3× already
    // applied by the caller when weakpointT was open; the interrupt sets it).
    if (interruptCast(e)) {
        sfx.interrupt();
        if (world && world.onCastInterrupted) world.onCastInterrupted(e);
    }
    // Asymmetry (L8) and other host multipliers land via world.damageMult.
    const mult = (world && world.damageMult) ? world.damageMult() : 1;
    e.hp -= dmg * mult;
    e.hitFlash = 0.08;
    if (e.hp <= 0) {
        killEnemy(pool, e, world);
        return true;
    }
    sfx.hit();
    return false;
}

/** Tick every live enemy: behave, shoot, follow through to the mesh, cull. */
export function updateEnemies(pool, dt, world) {
    const cull = despawnX(6);
    for (const e of pool.items) {
        if (!e.alive) continue;

        if (e.staggered > 0) {
            // Staggered (3 Hammer slugs, or an interrupted cast): it does not
            // move and it does not shoot. That window IS the reward.
            e.staggered -= dt;
        } else {
            if (e.pattern) e.pattern(e, dt, world);
            if (e.mimic) mimicFire(e, dt, world);
            else if (e.fire) e.fire(e, dt, world);
        }

        tickCast(e, dt);

        if (e.hitFlash > 0) e.hitFlash -= dt;
        if (e.weakpointT > 0) e.weakpointT -= dt;
        if (e.marked > 0) e.marked -= dt;
        decayStacks(e, dt);

        if (e.mesh) {
            e.mesh.position.set(e.x, e.y, 0);
            if (e.barrel) e.barrel.rotation.z = e.aim;   // body still, barrel tracks
            // Weakpoint / cast tell: pulse violet intensity on the hull scale.
            if (e.weakpointT > 0) {
                const pulse = 1 + Math.sin((world.elapsedT || 0) * 14) * 0.08;
                e.mesh.scale.setScalar(pulse);
            } else if (e.mesh.scale.x !== 1) {
                e.mesh.scale.setScalar(1);
            }
            if (e.pulses && e.pulses.length) {
                // The mine's shell and the carrier's crystal breathe. It reads
                // as "armed" and "carrying" respectively, with no HUD help.
                const s = 1 + Math.sin((world.elapsedT || 0) * 5 + e.x) * 0.18;
                for (const m of e.pulses) m.scale.setScalar(s);
            }
        }

        // Left of the screen is gone forever — the scroll never comes back.
        if (e.x < cull) despawnEnemy(pool, e);
    }
}

export function clearEnemies(pool) {
    for (const e of pool.items) if (e.alive) despawnEnemy(pool, e);
    pool.live = 0;
}

/** The voxel map + scale for a type — the ship's shatter needs the same data. */
export function enemyAsset(type) {
    const def = ROSTER[type];
    return def ? _types[def.asset] : null;
}

/** S5: mimic enemies fire the player's lastShot buffer scaled 1.5×. */
function mimicFire(e, dt, world) {
    if (!e.fireState) e.fireState = {};
    e.fireState._cd = (e.fireState._cd || 0) - dt;
    if (e.fireState._cd > 0) return;
    if (!world.bounds || e.x > world.bounds.maxX + 0.5) return;
    if (world.player && world.player.cloaked > 0) return;
    e.fireState._cd = MIMIC_EVERY;
    const shot = world.player && world.player.lastShot;
    fireMimic(world, e.x, e.y, shot, { scale: 1.5, dmg: 6 });
    if (world.onEnemyShot) world.onEnemyShot(e);
}

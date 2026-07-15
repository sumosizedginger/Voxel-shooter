// src/shmup/force.js
// Purpose: the Witness — the force unit. Docks, orbit, absorb/reflect, levels,
// the boss-projectile intercept, and the Mirror Counter.
// Dependencies: three, ./assets/witness, ./bullets, ./fx, ./sfx, ./camera
//
// Bible §03: "Detachable orb that orbits the Vessel or locks to front, rear,
// above, or below. Absorbs small enemy fire. Reflects medium enemy fire. Cannot
// absorb boss damage but will intercept one boss projectile per cooldown cycle,
// costing 3 seconds of unavailable force. The Witness has three levels. Level
// one is a passive shield. Level two gains a return-fire pulse on absorption.
// Level three gains a short-range melee stab that breaks enemy guards on
// contact."
// Bible §14: "New ability: Mirror Counter, activated on double-tap of force
// direction key. Emits a 0.5-second reflect field at 2x return speed."
//
// The Witness NEVER dies. Not to bullets, not to terrain, not when GUMOI does.
// That is not a balance decision — if the witness dies, the seal goes with it
// (§00). On death it detaches and drifts, and she picks it back up. Always.

import * as THREE from 'three';
import { buildWitnessRig } from './assets/witness.js';
import { KIND, spawn, kill, allHits, circleHit } from './bullets.js';
import { sparkHit, ring, explode } from './fx.js';
import { sfx } from './sfx.js';
import { despawnX } from './camera.js';

export const DOCK = {
    FRONT: 'front',
    REAR: 'rear',
    ABOVE: 'above',
    BELOW: 'below'
};

export const STATE = {
    DOCKED: 'docked',
    LAUNCHING: 'launching',   // flying forward, just detached
    FREE: 'free',             // holding station in screen space
    RETURNING: 'returning'    // flying back to the Vessel
};

/** Dock offsets in world units, relative to the Vessel's hit center.
 *  Tuned for SHIP_VOXEL_SCALE 0.125 (~2.4u long) so the pod sits clear of the
 *  hull silhouette instead of merging into one blob. */
const DOCK_OFFSET = {
    [DOCK.FRONT]: [1.55, 0],
    [DOCK.REAR]: [-1.55, 0],
    [DOCK.ABOVE]: [0, 1.05],
    [DOCK.BELOW]: [0, -1.05]
};

export const WITNESS_R = 0.38;         // hit radius — generous: it's a shield
const LAUNCH_SPEED = 20;
const LAUNCH_TIME = 0.45;
const RETURN_SPEED = 26;
const GRAB_DIST = 0.7;

/** Bible §03: one boss projectile per cooldown, 3 s unavailable after. */
export const INTERCEPT_COOLDOWN = 3.0;

/** Mirror Counter (bible §14). */
export const COUNTER_S = 0.5;
export const COUNTER_R = 2.6;
export const COUNTER_SPEED_MULT = 2;
const COUNTER_COOLDOWN = 4.0;

/** Contact damage per second while an enemy is inside the Witness. */
const CONTACT_DPS = 14;
/** Level 3's melee stab: a burst on contact, and it breaks guards. */
const STAB_DMG = 26;
const STAB_CD = 0.5;

export function createWitness(scene, world) {
    const { rig, parts, voxMap } = buildWitnessRig();
    scene.add(rig);

    const w = {
        x: 0, y: 8,
        vx: 0, vy: 0,
        r: WITNESS_R,
        level: 1,                       // 1..3, raised by Witness shards
        state: STATE.DOCKED,
        dock: DOCK.FRONT,
        alive: true,                    // it is ALWAYS true. See the header.
        launchT: 0,
        interceptCd: 0,
        counterT: 0,                    // >0 while the Mirror Counter field is up
        counterCd: 0,
        stabCd: 0,
        _t: 0,
        rig, parts, voxMap
    };
    world.witness = w;
    return w;
}

/** Raise the Witness a level (a shard was collected). Caps at 3. */
export function levelUpWitness(w) {
    if (w.level >= 3) return false;
    w.level++;
    sfx.shard();
    ring(w.x, w.y, 1.4, 0x8b5cf6);
    // Each level lights one more orbiting spark.
    for (let i = 0; i < w.parts.sparks.length; i++) {
        w.parts.sparks[i].visible = (i < w.level - 1);
    }
    return true;
}

/** Where the Witness sits when docked. */
function dockPos(w, player) {
    const o = DOCK_OFFSET[w.dock] || DOCK_OFFSET[DOCK.FRONT];
    return { x: player.x + o[0], y: player.y + o[1] };
}

/**
 * Pick the dock the Witness has actually come back to. Approaching from above
 * docks it above — the player aims the dock by where they stand, which is one
 * fewer button and reads instantly.
 */
function dockFromApproach(w, player) {
    const dx = w.x - player.x;
    const dy = w.y - player.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? DOCK.FRONT : DOCK.REAR;
    return dy >= 0 ? DOCK.ABOVE : DOCK.BELOW;
}

/** The dock key: detach if docked, recall if not. */
export function toggleWitness(w, player) {
    if (w.state === STATE.DOCKED) {
        w.state = STATE.LAUNCHING;
        w.launchT = LAUNCH_TIME;
        w.vx = LAUNCH_SPEED;
        w.vy = 0;
        sfx.detach();
    } else {
        w.state = STATE.RETURNING;
        sfx.dock();
    }
}

/**
 * The Mirror Counter (double-tap dock). A 0.5 s reflect field: every enemy
 * bullet caught in it is turned around and sent back at 2x speed as HERS.
 * The field is centered on the Witness — which, when docked, means it is
 * centered on the Vessel. That is the point: it is a panic button with a tell.
 */
export function mirrorCounter(w, world) {
    if (w.counterCd > 0) return false;
    w.counterT = COUNTER_S;
    w.counterCd = COUNTER_COOLDOWN;
    sfx.reflect();
    ring(w.x, w.y, 1.8, 0xd8ccff);
    return true;
}

/** Turn an enemy bullet into one of hers. Used by the counter and by reflection. */
function reflectBullet(world, b, speedMult = 1) {
    const sp = Math.hypot(b.vx, b.vy) * speedMult;
    // Send it back where it came from. If it was aimed at her, it goes home.
    const a = Math.atan2(-b.vy, -b.vx);
    kill(world.enemyBullets, b);
    spawn(world.bullets, {
        x: b.x, y: b.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: b.r, dmg: (b.dmg || 6) * 1.5,
        kind: KIND.PULSE_1,
        hitsTerrain: true
    });
}

/**
 * Tick the Witness.
 * Order matters: move, then absorb, then touch. A bullet that would have hit the
 * Vessel this frame must be eaten BEFORE game.js runs its player collision.
 */
export function updateWitness(w, dt, player, world, input) {
    w._t += dt;
    if (w.interceptCd > 0) w.interceptCd -= dt;
    if (w.counterCd > 0) w.counterCd -= dt;
    if (w.counterT > 0) w.counterT -= dt;
    if (w.stabCd > 0) w.stabCd -= dt;

    // ── input
    if (input) {
        if (input.dockDoubleTap) mirrorCounter(w, world);
        else if (input.dockPressed) toggleWitness(w, player);
    }

    // ── movement
    const scrollDrift = (world.level && !world.level.scrollLocked)
        ? (world.level.scrollSpeed || 0) : 0;

    if (w.state === STATE.DOCKED) {
        const d = dockPos(w, player);
        w.x = d.x;
        w.y = d.y;
    } else if (w.state === STATE.LAUNCHING) {
        w.launchT -= dt;
        moveWithTerrain(w, dt, world);
        if (w.launchT <= 0) {
            w.state = STATE.FREE;
            w.vx = 0;
            w.vy = 0;
        }
    } else if (w.state === STATE.FREE) {
        // Holds its screen position: it rides the scroll like the Vessel does.
        w.vx = scrollDrift;
        w.vy = 0;
        moveWithTerrain(w, dt, world);
        // If the level ever outruns it, it comes home rather than being lost.
        if (w.x < despawnX(1)) w.state = STATE.RETURNING;
    } else if (w.state === STATE.RETURNING) {
        const tx = player.x;
        const ty = player.y;
        const a = Math.atan2(ty - w.y, tx - w.x);
        w.vx = Math.cos(a) * RETURN_SPEED;
        w.vy = Math.sin(a) * RETURN_SPEED;
        // It comes home THROUGH walls: a Witness stuck behind terrain while the
        // player dies to a bullet it should have eaten is a broken promise.
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        if (Math.hypot(tx - w.x, ty - w.y) < GRAB_DIST) {
            w.dock = dockFromApproach(w, player);
            w.state = STATE.DOCKED;
            sfx.dock();
        }
    }

    // ── absorb / reflect
    absorb(w, world);

    // ── contact: the Witness is a solid, moving, invincible thing.
    contact(w, dt, world);

    // ── the Mirror Counter field
    if (w.counterT > 0) {
        const caught = allHits(world.enemyBullets, w.x, w.y, COUNTER_R);
        for (const b of caught) {
            // S7: word-bullets pass through every force ability.
            if (b.onlyProfanity || b.kind === KIND.WORD) continue;
            reflectBullet(world, b, COUNTER_SPEED_MULT);
        }
    }

    updateWitnessRig(w, dt, player);
}

/** Slide along terrain (PLAN.md §2.3: the Witness grinds walls, it doesn't die). */
function moveWithTerrain(w, dt, world) {
    const nx = w.x + w.vx * dt;
    const ny = w.y + w.vy * dt;
    if (world.terrain) {
        const r = world.terrain.resolveMove(w.x, w.y, nx, ny, w.r * 0.6);
        w.x = r.x;
        w.y = r.y;
    } else {
        w.x = nx;
        w.y = ny;
    }
}

/**
 * Eat what it can. Bible §03: absorbs small fire, reflects medium fire, and
 * intercepts exactly one boss projectile per cooldown.
 */
function absorb(w, world) {
    const caught = allHits(world.enemyBullets, w.x, w.y, w.r);
    for (const b of caught) {
        // S7 / L4: word-bullets are only cancelled by the Profanity Key — the
        // Witness must let them through (bible §07).
        if (b.onlyProfanity || b.kind === KIND.WORD) continue;

        if (b.bossShot) {
            // "Cannot absorb boss damage but will intercept one boss projectile
            // per cooldown cycle, costing 3 seconds of unavailable force."
            if (w.interceptCd > 0) continue;      // it passes THROUGH. That's the rule.
            w.interceptCd = INTERCEPT_COOLDOWN;
            kill(world.enemyBullets, b);
            explode(b.x, b.y, 0.7, 0xd8ccff);
            sfx.absorb();
            continue;
        }

        if (b.medium && w.level >= 1) {
            reflectBullet(world, b);              // medium fire comes back
            sfx.reflect();
            continue;
        }

        kill(world.enemyBullets, b);
        sparkHit(b.x, b.y, 0xd8ccff);
        sfx.absorb();

        // Level 2: a return-fire pulse on absorption (bible §03).
        if (w.level >= 2) {
            spawn(world.bullets, {
                x: w.x + 0.3, y: w.y, vx: 26, vy: 0,
                r: 0.16, dmg: 5, kind: KIND.PULSE_1
            });
        }
    }
}

/** Contact damage, and level 3's guard-breaking stab. */
function contact(w, dt, world) {
    for (const e of world.enemies.items) {
        if (!e.alive) continue;
        if (!circleHit(w.x, w.y, w.r, e.x, e.y, e.r)) continue;

        if (w.level >= 3 && w.stabCd <= 0) {
            w.stabCd = STAB_CD;
            e.guardBroken = true;                 // "breaks enemy guards on contact"
            if (world.damageEnemy) world.damageEnemy(e, STAB_DMG);
            sparkHit(e.x, e.y, 0x8b5cf6);
            sfx.interrupt();
        } else if (world.damageEnemy) {
            world.damageEnemy(e, CONTACT_DPS * dt);
        }
    }
}

/** She died. The Witness does not. It detaches and waits to be picked back up. */
export function orphanWitness(w) {
    if (w.state === STATE.DOCKED) {
        w.state = STATE.FREE;
        w.vx = 0;
        w.vy = 0;
    }
}

/** A new life: the Witness comes home. It keeps its level. */
export function recallWitness(w, player) {
    w.state = STATE.RETURNING;
}

function updateWitnessRig(w, dt, player) {
    const { rig, parts } = w;
    rig.position.set(w.x, w.y, 0);

    // Docked: a slow roll. Detached: a fast spin and a breath. It should be
    // obvious at a glance whether it's under your arm or out on its own.
    const spin = (w.state === STATE.DOCKED) ? 1.4 : 5.0;
    parts.shell.rotation.x += spin * dt;
    parts.ring.rotation.y += spin * 1.6 * dt;
    parts.ring.rotation.z = Math.PI / 2;

    const breathe = (w.state === STATE.DOCKED) ? 1 : 1 + Math.sin(w._t * 8) * 0.08;
    rig.scale.setScalar(breathe);

    // The core dims while the intercept is spent — the cooldown is READABLE on
    // the object itself, so the player never has to check a HUD to know whether
    // the Witness can still save them.
    parts.coreMat.emissiveIntensity = w.interceptCd > 0
        ? 0.6
        : 2.4 + Math.sin(w._t * 3) * 0.3;

    // The Mirror Counter field is a visible bubble, briefly.
    parts.ringMat.opacity = w.counterT > 0 ? 1 : 0.75;
    const counterScale = w.counterT > 0 ? (COUNTER_R / 0.34) * (w.counterT / COUNTER_S) : 1;
    parts.ring.scale.setScalar(Math.max(1, counterScale));

    for (let i = 0; i < parts.sparks.length; i++) {
        const s = parts.sparks[i];
        if (!s.visible) continue;
        const a = w._t * 3 + i * Math.PI;
        s.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, Math.sin(a * 1.3) * 0.2);
    }
}

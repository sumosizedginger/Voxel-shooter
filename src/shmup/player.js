// src/shmup/player.js
// Purpose: the Vessel — movement, hull integrity, presentation, death.
// Dependencies: three, ./assets/shipRig, ./camera, ./bullets, ./fx, ./sfx, settings
//
// PLAN.md Phase 2 + NARRATIVE_PLAN C2. The damage model is the bible's, not
// R-Type's:
//   - enemy BULLETS do chip damage to a 100-point hull integrity bar
//   - COLLISIONS (terrain, enemy bodies) are lethal outright, always
// That split is load-bearing: it's exactly why the Ghost Drone's "phase through
// one collision per life" is worth a Council seat.
//
// The damage display is not a number. It's her: the kintsugi scars brighten as
// integrity falls, so the ship bleeds light the way GUMOI does (NARRATIVE §3).

import * as THREE from 'three';
import { buildShipRig, SCAR_MIN, SCAR_MAX } from './assets/shipRig.js';
import { playerBounds } from './camera.js';
import { KIND, spawn } from './bullets.js';
import { shatter, explode, muzzleFlash } from './fx.js';
import { sfx } from './sfx.js';
import { getSetting } from '../engine/settings.js';
import {
    createCharge, updateCharge, releaseCharge, tierProgress, firePulse, PULSE_TIERS
} from './wavecannon.js';
import { createHammer, fireHammer, FIRE_RATE as HAMMER_RATE, SWAP_S } from './hammer.js';

/** Base speed, world units/second. A per-level tuning constant (C4). */
export const BASE_SPEED = 9;
/** The hit circle. Tiny relative to the model, and non-negotiable (§2.4). */
export const HIT_R = 0.15;
export const MAX_HULL = 100;
const INVULN_S = 2.0;
const BLINK_HZ = 12;

const SHOT_RATE = 8;           // shots/second, held fire
const SHOT_SPEED = 24;
const SHOT_DMG = 1;

export function createPlayer(scene, world) {
    const { rig, parts, voxMap } = buildShipRig();
    scene.add(rig);

    const p = {
        x: 0, y: 8, vx: 0, vy: 0,
        r: HIT_R,
        alive: true,
        hull: MAX_HULL,
        maxHull: MAX_HULL,
        lives: 3,
        invuln: 0,
        /** Set true by the Ghost Drone: eats exactly one lethal collision. */
        phaseCharges: 0,
        /** Movement multiplier — slow-stacks (bible §04) push this down. */
        speedScale: 1,
        /** Beige Slope slow: each stack is -15% for 2s; 4 stacks = pinned. */
        slowStacks: [],
        /** Set by weapons that lock the Vessel (tier-3 Siren Pulse, 1.4 s). */
        locked: 0,
        /** Cloak Drone: enemies stop aiming at her while this is up. */
        cloaked: 0,

        // ── the arsenal (C6: she carries both, and the switch costs 0.4 s)
        weapon: 'pulse',            // 'pulse' | 'hammer'
        swapT: 0,
        charge: createCharge(),
        hammer: createHammer(),
        /** S5 (Level 02): the mimic-drones copy this. A weapon switch clears it. */
        lastShot: null,

        rig, parts, voxMap,
        _t: 0,
        _shotCd: 0,
        _dead: false
    };

    world.player = p;
    return p;
}

/** Put the Vessel back at a spawn point with invulnerability. */
export function respawnPlayer(p, x, y = 8) {
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.alive = true;
    p._dead = false;
    p.hull = MAX_HULL;
    p.invuln = INVULN_S;
    p.speedScale = 1;
    p.slowStacks = [];
    p.locked = 0;
    p.cloaked = 0;
    p.swapT = 0;
    p.weapon = 'pulse';
    p.charge = createCharge();
    p.lastShot = null;
    p._wordLockT = 0;           // S7 SEAMLESS must not leak across lives
    p.weaponsOffline = false;
    p.rig.visible = true;
    p.rig.rotation.set(0, 0, 0);
    p.parts.muzzle.scale.setScalar(0.001);
    sfx.respawn();
}

/**
 * Chip damage from enemy fire. Returns true if this killed her.
 * Collisions do NOT come through here — see killPlayer().
 */
export function damagePlayer(p, dmg, world) {
    // God mode = full immunity (chip included). Flag lives on world so every
    // call site is covered without threading a boolean through the arsenal.
    if (!p.alive || p.invuln > 0 || (world && world.godMode)) return false;
    p.hull -= dmg;
    sfx.hurt();
    if (world && world.onPlayerHurt) world.onPlayerHurt(dmg);
    if (p.hull <= 0) {
        p.hull = 0;
        killPlayer(p, world);
        return true;
    }
    // A short mercy window so a bullet stream can't delete a full bar in
    // three frames — chip damage must stay chip damage.
    p.invuln = 0.35;
    return false;
}

/**
 * Lethal: terrain contact, enemy body contact, or hull hitting zero.
 * The Ghost Drone's phase charge is spent here, and nowhere else.
 */
export function killPlayer(p, world, fromCollision = false) {
    if (!p.alive || p._dead) return false;
    // God mode = immunity: terrain, bodies, boss wall, timeout, hull-zero — none of it.
    if (world && world.godMode) return false;

    if (fromCollision && p.phaseCharges > 0) {
        p.phaseCharges--;
        p.invuln = 0.8;                        // pass through, and be seen doing it
        sfx.absorb();
        if (world && world.onPhased) world.onPhased();
        return false;
    }

    p.alive = false;
    p._dead = true;
    p.rig.visible = false;
    shatter(p.x, p.y, p.voxMap, 0.1, 26);
    explode(p.x, p.y, 1.8, 0x9fb0ff);
    sfx.die();
    if (world && world.onPlayerDied) world.onPlayerDied();
    return true;
}

/** A slow-bullet landed: add one 2-second stack (bible §04). */
export function addSlowStack(p, seconds = 2.0) {
    p.slowStacks.push(seconds);
}

/** Tick the Vessel: move, shoot, and dress the rig. */
export function updatePlayer(p, dt, input, world) {
    p._t += dt;

    if (!p.alive) return;

    if (p.invuln > 0) p.invuln -= dt;
    if (p.locked > 0) p.locked -= dt;
    if (p.cloaked > 0) p.cloaked -= dt;

    // ── the Beige Slope slow (bible §04): each completed announcement that hits
    //    stacks a 15% slow for 2s. Four stacks and she cannot move — the wall
    //    catches up, and that is the failure state the boss is built around.
    if (p.slowStacks.length) {
        for (let i = p.slowStacks.length - 1; i >= 0; i--) {
            p.slowStacks[i] -= dt;
            if (p.slowStacks[i] <= 0) p.slowStacks.splice(i, 1);
        }
    }
    const stacks = Math.min(4, p.slowStacks.length);
    p.speedScale = Math.max(0, 1 - stacks * 0.15 - (stacks >= 4 ? 0.4 : 0));
    // S6 arena slowStack (and any other host multiplier) applied after stacks.
    if (world && world.modSpeedScale != null && world.modSpeedScale < 1) {
        p.speedScale = Math.min(p.speedScale, world.modSpeedScale);
    }

    // ── movement
    const b = playerBounds();
    if (p.locked > 0) {
        // Tier-3 Siren Pulse roots her. She chose to plant her feet; the cost
        // is that for 1.4 s she cannot dodge.
        p.vx = 0;
        p.vy = 0;
    } else {
        const speed = BASE_SPEED * p.speedScale;
        p.vx = input.axisX * speed;
        p.vy = input.axisY * speed;
    }

    // The Vessel rides the scroll: with no input she holds her SCREEN position
    // while the level goes past. Letting the min-x clamp carry her instead
    // (which PLAN.md Phase 2 allows) pins her against the left edge with
    // nowhere to retreat to — the clamp is a safety net, not a conveyor belt.
    const drift = (world.level && !world.level.scrollLocked)
        ? (world.level.scrollSpeed || 0) : 0;
    p.x += (p.vx + drift) * dt;
    p.y += p.vy * dt;

    p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
    p.y = Math.max(b.minY, Math.min(b.maxY, p.y));

    updateWeapons(p, dt, input, world);
    updateShipRig(p, dt, input);
}

/**
 * The arsenal. Two weapons, one fire button, and a hold/tap discrimination on
 * the Pulse — so "how long you press" and "which seat you're invoking" are the
 * whole weapon interface. No weapon wheel, nothing to read.
 */
function updateWeapons(p, dt, input, world) {
    // L7 heat-death: weapons offline for 2 s at max heat.
    if (p.weaponsOffline) {
        p.parts.muzzle.scale.setScalar(0.001);
        return;
    }
    if (p.swapT > 0) {
        p.swapT -= dt;
        return;                       // 0.4 s of nothing. The switch has a price.
    }

    // ── weapon switch (C6, bible §05: "Switching takes 0.4 seconds")
    if (input.swapPressed) {
        p.weapon = p.weapon === 'pulse' ? 'hammer' : 'pulse';
        p.swapT = SWAP_S;
        // Bible §05: "Switching weapons resets the copy buffer." The mimics in
        // Level 02 read lastShot; clearing it here is what makes weapon-juggling
        // the actual answer to the Parrot.
        p.lastShot = null;
        p.charge.held = 0;
        p.charge.tier = 0;
        p.charge.lastTier = 0;
        p.charge.charging = false;
        sfx.uiMove();
        return;
    }

    const witnessLevel = world.witness ? world.witness.level : 0;
    p._shotCd -= dt;

    // holdToFire (default true): stream while held. When false, bolts only on
    // firePressed (tap), not also on release — avoids double-fire on one tap.
    let holdFire = true;
    try { holdFire = getSetting('holdToFire') !== false; } catch (e) { holdFire = true; }

    if (p.weapon === 'hammer') {
        // The Hammer does not charge. It is a hammer.
        const hammerWant = holdFire ? input.fire : input.firePressed;
        if (hammerWant && p._shotCd <= 0) {
            const { mode } = fireHammer(world, p.x + 0.9, p.y);
            muzzleFlash(p.x + 0.95, p.y, 0, 0xffc46b);
            sfx.hammer();
            p._shotCd = 1 / HAMMER_RATE;
            p.lastShot = { weapon: 'hammer', mode };
        }
        p.parts.muzzle.scale.setScalar(0.001);
        return;
    }

    // ── Siren Pulse: hold to charge, release to fire.
    const { tierUp } = updateCharge(p.charge, dt, input.fire, witnessLevel);
    if (tierUp) sfx.chargeTier(tierUp);

    if (input.fireReleased) {
        const shot = releaseCharge(p.charge, witnessLevel);
        if (shot.type === 'tap') {
            // When holdToFire is on, the stream already fired on hold; release
            // may still emit a final bolt if cooldown allows. When off, tap
            // already fired on press — skip release bolt to avoid double shot.
            if (holdFire && p._shotCd <= 0) {
                firePlayerBolt(p, world);
                p._shotCd = 1 / SHOT_RATE;
                p.lastShot = { weapon: 'pulse', tier: 0 };
            }
        } else {
            const b = firePulse(world, p.x + 0.95, p.y, shot.tier);
            muzzleFlash(p.x + 1.0, p.y, 0, 0xdffaff);
            sfx.pulse(shot.tier);
            // Tier 3 roots her for 1.4 s (bible §03). She chose to plant her feet.
            if (shot.lock) p.locked = shot.lock;
            p.lastShot = { weapon: 'pulse', tier: shot.tier };
            if (b && shot.tier >= 2) shakeOnPulse(shot.tier);
        }
    }

    // Rapid fire while merely holding (or on press if holdToFire is off).
    const streamWant = holdFire ? input.fire : input.firePressed;
    if (streamWant && p.charge.tier < 1 && p._shotCd <= 0) {
        firePlayerBolt(p, world);
        p._shotCd = 1 / SHOT_RATE;
        p.lastShot = { weapon: 'pulse', tier: 0 };
    }

    // The charge orb at the nose: it grows with the charge. This is the tell,
    // and it is on the ship rather than the HUD so the player never looks away.
    // Kept small — UnrealBloom multiplies its apparent size, so a 0.1-unit
    // sphere at tier 3 already reads as a fist of light. Bigger just erased the
    // ship (and the docked Witness sitting right behind it).
    const t = p.charge.tier + tierProgress(p.charge, witnessLevel);
    p.parts.muzzle.scale.setScalar(p.charge.charging ? Math.max(0.001, 0.4 + t * 0.22) : 0.001);
    p.parts.muzzleMat.emissiveIntensity = 1.6 + p.charge.tier * 0.5;
}

let _shakeFn = null;
/** Injected by game.js to avoid a camera import cycle through player.js. */
export function setPulseShake(fn) { _shakeFn = fn; }
function shakeOnPulse(tier) {
    if (_shakeFn) _shakeFn(tier >= 3 ? 0.4 : 0.14, 3.0);
}

export function firePlayerBolt(p, world) {
    const nose = p.x + 0.95;
    spawn(world.bullets, {
        x: nose, y: p.y - 0.05, vx: SHOT_SPEED, vy: 0,
        r: 0.12, dmg: SHOT_DMG, kind: KIND.PLAYER_BOLT
    });
    muzzleFlash(nose, p.y - 0.05, 0);
    sfx.shoot();
}

/** Presentation only (SHIP_PLAN §6). Nothing here may affect gameplay. */
function updateShipRig(p, dt, input) {
    const { rig, parts } = p;

    // Banking roll — the wings' sweep only reads when she banks, so this is
    // what makes the model look like a plane instead of a brick.
    const targetRoll = -input.axisY * 0.35;
    const k = 1 - Math.exp(-dt * 10);          // the engine's exponential-ease idiom
    rig.rotation.x += (targetRoll - rig.rotation.x) * k;
    rig.rotation.z += (input.axisY * 0.08 - rig.rotation.z) * k;

    // Thruster flicker.
    const thrust = 1.6 + Math.sin(p._t * 37) * 0.35 + (input.axisX > 0 ? 0.5 : 0);
    parts.engineMat.emissiveIntensity = thrust;
    parts.engineMesh.scale.x = 1 + (input.axisX > 0 ? 0.35 : 0);
    parts.engineHalo.material.opacity = 0.28 + Math.sin(p._t * 29) * 0.06;

    // ── the damage display (C2): the scars brighten as she loses hull.
    const wounded = 1 - Math.max(0, Math.min(1, p.hull / p.maxHull));
    const scar = SCAR_MIN + (SCAR_MAX - SCAR_MIN) * wounded;
    // A slow pulse at low hull — a heartbeat, so "nearly dead" is felt, not read.
    const beat = wounded > 0.6 ? 1 + Math.sin(p._t * 6) * 0.25 * wounded : 1;
    for (const m of parts.scarMats) m.emissiveIntensity = scar * beat;

    // ── invulnerability
    if (p.invuln > 0) {
        if (getSetting('reduceFlashing')) {
            // No strobe. A steady half-ghost says the same thing.
            if (parts.hull.material !== parts.ghostMat) parts.hull.material = parts.ghostMat;
            rig.visible = true;
        } else {
            rig.visible = Math.floor(p._t * BLINK_HZ) % 2 === 0;
        }
    } else {
        if (parts.hull.material !== parts.hullMat) parts.hull.material = parts.hullMat;
        rig.visible = true;
    }

    rig.position.set(p.x, p.y, 0);
}

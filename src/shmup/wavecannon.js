// src/shmup/wavecannon.js
// Purpose: the Siren Pulse — charge gauge + shot table. Pure logic, no THREE.
// Dependencies: ./bullets.js (KIND, spawn — itself import-clean)
//
// Bible §03 (verbatim spec): "Three charge tiers. Tier one is fast and weak.
// Tier two is the workhorse. Tier three is the siege shot that breaks boss
// guards but locks the Vessel in place for 1.4 seconds during charge release."
// And §03 again, on the Witness: "Without the Witness at level two or higher,
// tier three cannot fire."
//
// So tier 3 is gated on a system the player has to have gone and EARNED. That
// gate is the reason this module takes witnessLevel as an argument everywhere
// instead of reading it from the world: the rule is the signature.

import { KIND, spawn } from './bullets.js';

/** Seconds of hold per tier. Three tiers => a full charge is ~3.6 s. */
export const TIER_TIME = 1.2;
export const MAX_TIER = 3;

/** A release under this is a TAP: the basic shot, not a charge. */
export const TAP_MAX = 0.25;

/** Tier 3 roots the Vessel for this long on release (bible §03). */
export const TIER3_LOCK_S = 1.4;

/** The Witness level tier 3 requires (bible §03). */
export const TIER3_REQUIRES_WITNESS = 2;

/**
 * The shot table. `pierce` is how many extra bodies a bolt passes through;
 * `breaksGuard` is what lets tier 3 open a boss's guard (bible §03).
 */
export const PULSE_TIERS = {
    1: { kind: KIND.PULSE_1, dmg: 4, speed: 30, r: 0.2, pierce: 0, breaksGuard: false, scale: 1 },
    2: { kind: KIND.PULSE_2, dmg: 12, speed: 26, r: 0.4, pierce: 4, breaksGuard: false, scale: 1 },
    3: { kind: KIND.PULSE_3, dmg: 34, speed: 22, r: 0.75, pierce: 99, breaksGuard: true, scale: 1 }
};

export function createCharge() {
    return {
        held: 0,          // seconds the fire button has been down
        tier: 0,          // the tier currently reached (0 = not yet a charge)
        charging: false,
        lastTier: 0       // for the "a tier just clicked over" sfx/HUD cue
    };
}

/**
 * The highest tier `held` seconds of charge has earned, given the Witness.
 * Tier 3 is CAPPED, not blocked: holding forever with a level-1 Witness leaves
 * you at a fully-charged tier 2 rather than at nothing. Punishing the hold with
 * a dud would teach players not to hold, which is the opposite of the lesson.
 */
export function chargeTier(held, witnessLevel = 0) {
    let tier = Math.min(MAX_TIER, Math.floor(held / TIER_TIME));
    if (tier >= 3 && witnessLevel < TIER3_REQUIRES_WITNESS) tier = 2;
    return tier;
}

/** True if a tier-3 shot is actually available right now. */
export function canFireTier3(witnessLevel) {
    return witnessLevel >= TIER3_REQUIRES_WITNESS;
}

/**
 * Advance the gauge one frame.
 * @returns {{tierUp:number|0}} the tier just crossed this frame (for sfx/HUD), else 0
 */
export function updateCharge(state, dt, firing, witnessLevel = 0) {
    if (firing) {
        state.charging = true;
        state.held += dt;
        state.tier = chargeTier(state.held, witnessLevel);
        if (state.tier > state.lastTier) {
            const up = state.tier;
            state.lastTier = state.tier;
            return { tierUp: up };
        }
    }
    return { tierUp: 0 };
}

/**
 * Resolve a release.
 * @returns {{type:'tap'|'pulse'|'none', tier:number, lock:number}}
 *   'tap'  — a quick press: the basic rapid-fire bolt (player.js fires it)
 *   'pulse'— a charged Siren Pulse of `tier`
 */
export function releaseCharge(state, witnessLevel = 0) {
    const held = state.held;
    const tier = chargeTier(held, witnessLevel);
    state.held = 0;
    state.tier = 0;
    state.lastTier = 0;
    state.charging = false;

    if (held < TAP_MAX) return { type: 'tap', tier: 0, lock: 0 };
    if (tier < 1) {
        // Held past a tap but not long enough to reach tier 1 — she committed to
        // a charge and got nothing. Give her the bolt; don't eat the input.
        return { type: 'tap', tier: 0, lock: 0 };
    }
    return {
        type: 'pulse',
        tier,
        lock: tier >= 3 ? TIER3_LOCK_S : 0
    };
}

/** Charge progress within the CURRENT tier, 0..1 — for the HUD's three segments. */
export function tierProgress(state, witnessLevel = 0) {
    const maxTier = canFireTier3(witnessLevel) ? MAX_TIER : 2;
    if (state.tier >= maxTier) return 1;
    const into = state.held - state.tier * TIER_TIME;
    return Math.max(0, Math.min(1, into / TIER_TIME));
}

/**
 * Fire a charged pulse into the player bullet pool.
 * @returns {object|null} the spawned bullet
 */
export function firePulse(world, x, y, tier) {
    const def = PULSE_TIERS[tier];
    if (!def) return null;
    return spawn(world.bullets, {
        x, y,
        vx: def.speed, vy: 0,
        r: def.r,
        dmg: def.dmg,
        kind: def.kind,
        pierce: def.pierce,
        // A tier-3 siege shot does not stop for scenery. Tiers 1-2 do.
        hitsTerrain: tier < 3,
        breaksGuard: def.breaksGuard
    });
}

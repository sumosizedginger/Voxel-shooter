// src/shmup/systems/cast.js
// Purpose: S2 cast/interrupt — announced emotion over an enemy; any hit cuts it
// off and opens a violet weakpoint window (3× damage). Taught in L1, reused.
// Dependencies: none (import-clean)
//
// NARRATIVE_PLAN §4 S2. Enemies carry optional `cast: {text, duration}` at spawn
// (or gain one via startCast). While casting they keep moving/firing; the cast
// tag is presentation. On hit during cast → interrupt. On timer complete →
// onComplete (optional) and no weakpoint reward.

/** Beige Slope announced-emotion pool (bible §04 / §15 register). */
export const BEIGE_CASTS = [
    'I feel VALIDATED',
    'I feel SEEN',
    'I feel TRANSFORMED',
    'I feel SAFE',
    'I feel GRATEFUL',
    'I feel ALIGNED',
    'I feel ENOUGH',
    'I feel HELD'
];

/** Jester / later-level cast taunts (short, dry — not GUMOI's voice). */
export const TAUNT_CASTS = [
    'INTEGRATING',
    'PLEASE HOLD',
    'SYMMETRY LOCK',
    'COPYING',
    'FORGING',
    'DENYING',
    'FOLDING'
];

/**
 * Begin a cast on an enemy. Idempotent if already casting.
 * @param {object} e enemy
 * @param {string} text
 * @param {number} [duration=1.4]
 * @param {()=>void} [onComplete]
 */
export function startCast(e, text, duration = 1.4, onComplete = null) {
    if (!e || e.castT > 0) return;
    e.cast = { text: text || '…', duration, onComplete };
    e.castT = duration;
}

/**
 * Tick cast timers. Call once per frame from updateEnemies.
 * @returns {boolean} true if a cast just completed un-interrupted
 */
export function tickCast(e, dt) {
    if (!e || e.castT <= 0) return false;
    e.castT -= dt;
    if (e.castT > 0) return false;
    e.castT = 0;
    const done = e.cast && e.cast.onComplete;
    const cast = e.cast;
    e.cast = null;
    if (done) done(e, cast);
    return true;
}

/**
 * Interrupt an active cast: stagger + violet weakpoint window.
 * @param {object} e
 * @param {number} [weakpointS=1.6]
 * @param {number} [staggerS=0.55]
 * @returns {boolean} true if a cast was interrupted
 */
export function interruptCast(e, weakpointS = 1.6, staggerS = 0.55) {
    if (!e || e.castT <= 0) return false;
    e.castT = 0;
    e.cast = null;
    e.staggered = Math.max(e.staggered || 0, staggerS);
    e.weakpointT = Math.max(e.weakpointT || 0, weakpointS);
    return true;
}

/** Pick a cast line from a pool. */
export function pickCast(pool = BEIGE_CASTS) {
    return pool[(Math.random() * pool.length) | 0];
}

/**
 * Decide whether a newly spawned enemy should cast (level teach + elites).
 * Wave triggers may set `elite: true` or `castChance: 0..1`.
 */
export function maybeAssignCast(e, trigger, levelId) {
    if (!e || e.cast) return;
    const force = trigger && trigger.elite;
    const chance = (trigger && trigger.castChance != null)
        ? trigger.castChance
        : (levelId === 1 ? 0.35 : (force ? 1 : 0.12));
    if (!force && Math.random() > chance) return;
    // Bigger / mid-tier types always cast when selected; popcorn rarely.
    const heavy = e.type === 'lancer' || e.type === 'carrier' || e.type === 'gunpod'
        || e.type === 'crawler' || force;
    if (!heavy && Math.random() > 0.45) return;
    const pool = levelId === 1 ? BEIGE_CASTS : TAUNT_CASTS;
    startCast(e, pickCast(pool), force ? 1.8 : 1.35);
}

// src/shmup/systems/heat.js
// Purpose: L7 heat-death meter — charge on direction changes, decay when steady;
// weapons offline 2 s at max. Pairs with S9 movement predictor.
// Dependencies: none (import-clean)
//
// NARRATIVE_PLAN §3 + §4 S9. The Forge Wraith punishes twitchy play.

export const HEAT_MAX = 100;
export const HEAT_OFFLINE_S = 2.0;
/** Heat gained per direction-change event. */
export const HEAT_PER_TURN = 9;
/** Heat decay per second while holding a steady vector. */
export const HEAT_DECAY = 18;
/** Axis change threshold to count as a turn. */
const TURN_EPS = 0.55;

export function createHeat() {
    return {
        value: 0,
        offline: 0,
        prevAx: 0,
        prevAy: 0,
        steadyT: 0
    };
}

/**
 * @param {object} h createHeat()
 * @param {number} dt
 * @param {{axisX:number,axisY:number}} input
 * @param {boolean} [active] only accumulate when the level system is on
 */
export function updateHeat(h, dt, input, active = true) {
    if (!h) return;
    if (h.offline > 0) {
        h.offline -= dt;
        if (h.offline < 0) h.offline = 0;
        // While offline, heat bleeds so she recovers.
        h.value = Math.max(0, h.value - HEAT_DECAY * 1.4 * dt);
        return;
    }
    if (!active) {
        h.value = Math.max(0, h.value - HEAT_DECAY * dt);
        return;
    }

    const ax = input.axisX || 0;
    const ay = input.axisY || 0;
    const dax = Math.abs(ax - h.prevAx);
    const day = Math.abs(ay - h.prevAy);
    const turning = dax > TURN_EPS || day > TURN_EPS
        || (Math.sign(ax) !== Math.sign(h.prevAx) && Math.abs(ax) > 0.2)
        || (Math.sign(ay) !== Math.sign(h.prevAy) && Math.abs(ay) > 0.2);

    if (turning && (Math.abs(ax) + Math.abs(ay) > 0.15)) {
        h.value = Math.min(HEAT_MAX, h.value + HEAT_PER_TURN);
        h.steadyT = 0;
        if (h.value >= HEAT_MAX) {
            h.offline = HEAT_OFFLINE_S;
            h.value = HEAT_MAX;
        }
    } else {
        h.steadyT += dt;
        // Decay only after a brief hold so micro-adjustments don't thrash.
        if (h.steadyT > 0.12) {
            h.value = Math.max(0, h.value - HEAT_DECAY * dt);
        }
    }
    h.prevAx = ax;
    h.prevAy = ay;
}

export function heatWeaponsOffline(h) {
    return !!(h && h.offline > 0);
}

export function heatFraction(h) {
    return h ? h.value / HEAT_MAX : 0;
}

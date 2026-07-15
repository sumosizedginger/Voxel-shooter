// src/shmup/systems/asymmetry.js
// Purpose: L8 asymmetric play scorer — 3 s sliding window over input events;
// symmetric play is punished (lower damage / boss regenerates slightly).
// Dependencies: none (import-clean)
//
// NARRATIVE_PLAN §3. The Drift Wraith fires perfect symmetry; the answer is
// to refuse the mirror.

const WINDOW_S = 3.0;

export function createAsymmetry() {
    return {
        events: [],     // {t, ax, ay, fire}
        t: 0,
        score: 0.5      // 0 = perfectly symmetric, 1 = maximally asymmetric
    };
}

/**
 * Record a frame of input.
 * @param {object} a createAsymmetry()
 * @param {number} dt
 * @param {{axisX:number,axisY:number,fire?:boolean}} input
 */
export function updateAsymmetry(a, dt, input) {
    if (!a) return;
    a.t += dt;
    a.events.push({
        t: a.t,
        ax: input.axisX || 0,
        ay: input.axisY || 0,
        fire: !!(input.fire)
    });
    const cut = a.t - WINDOW_S;
    while (a.events.length && a.events[0].t < cut) a.events.shift();
    a.score = computeScore(a.events);
}

/**
 * Deviation from symmetry: compare first half of the window to a
 * time-reversed/mirrored second half. High score = asymmetric (good for L8).
 */
function computeScore(events) {
    if (events.length < 8) return 0.5;
    const n = events.length;
    const mid = n >> 1;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < mid; i++) {
        const a = events[i];
        const b = events[n - 1 - i];
        // Perfect symmetry would mirror vertical: ay ≈ -ay_mirror, ax ≈ ax.
        // We measure how much the later half FAILS to mirror the earlier.
        const dAx = Math.abs(a.ax - b.ax);
        const dAy = Math.abs(a.ay + b.ay);   // mirror about X axis of play
        sum += Math.min(1, (dAx + dAy) * 0.5);
        count++;
    }
    return count ? Math.min(1, sum / count) : 0.5;
}

/** Damage multiplier for L8: asymmetric play hits harder (0.55× .. 1.55×). */
export function asymmetryDamageMult(a) {
    if (!a) return 1;
    return 0.55 + a.score * 1.0;
}

/** Boss regen rate (hp/s) when the player plays too symmetrically. */
export function symmetryRegen(a) {
    if (!a) return 0;
    if (a.score > 0.35) return 0;
    return (0.35 - a.score) * 12;   // up to ~4.2 hp/s
}

export function asymmetryScore(a) {
    return a ? a.score : 0.5;
}

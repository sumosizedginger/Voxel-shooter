// src/shmup\systems\predictor.js
// Purpose: S9 movement predictor — classifies last 2–3 s of Vessel motion
// (line / arc / erratic) and forges intercept patterns for the Forge Wraith.
// Dependencies: none (import-clean)
//
// NARRATIVE_PLAN §4 S9.

const WINDOW_S = 2.5;

export function createPredictor() {
    return { samples: [], t: 0, mode: 'line' };
}

export function recordMotion(pred, dt, x, y) {
    if (!pred) return;
    pred.t += dt;
    pred.samples.push({ t: pred.t, x, y });
    const cut = pred.t - WINDOW_S;
    while (pred.samples.length && pred.samples[0].t < cut) pred.samples.shift();
    pred.mode = classify(pred.samples);
}

/**
 * @returns {'line'|'arc'|'erratic'}
 */
export function classify(samples) {
    if (!samples || samples.length < 6) return 'line';
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const span = Math.hypot(dx, dy) || 1;

    // Deviation from the straight line first→last.
    let dev = 0;
    let turns = 0;
    let prevAng = null;
    for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1];
        const b = samples[i];
        const t = (b.t - first.t) / Math.max(0.001, last.t - first.t);
        const lx = first.x + dx * t;
        const ly = first.y + dy * t;
        dev += Math.hypot(b.x - lx, b.y - ly);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (prevAng != null) {
            let d = ang - prevAng;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) > 0.45) turns++;
        }
        prevAng = ang;
    }
    const avgDev = dev / samples.length;
    if (turns >= 5 || avgDev > 1.8) return 'erratic';
    if (avgDev > 0.55) return 'arc';
    return 'line';
}

/**
 * Aim angle (rad) from (fromX,fromY) toward a predicted intercept of the player.
 * @param {object} pred
 * @param {number} fromX
 * @param {number} fromY
 * @param {{x:number,y:number,vx?:number,vy?:number}} player
 * @param {number} [bulletSpeed=10]
 */
export function interceptAngle(pred, fromX, fromY, player, bulletSpeed = 10) {
    if (!player) return Math.PI;
    let tx = player.x;
    let ty = player.y;
    const mode = pred ? pred.mode : 'line';
    const vx = player.vx || 0;
    const vy = player.vy || 0;

    // Lead time rough: distance / speed.
    const dist = Math.hypot(player.x - fromX, player.y - fromY);
    const eta = dist / Math.max(1, bulletSpeed);

    if (mode === 'line') {
        tx = player.x + vx * eta;
        ty = player.y + vy * eta;
    } else if (mode === 'arc') {
        // Overshoot the lead slightly on arcs.
        tx = player.x + vx * eta * 1.25;
        ty = player.y + vy * eta * 1.25;
    } else {
        // Erratic: aim at current position + small random bias (deterministic-ish).
        const bias = ((pred.t * 7.1) % 1) - 0.5;
        tx = player.x + bias * 2;
        ty = player.y - bias * 1.5;
    }
    return Math.atan2(ty - fromY, tx - fromX);
}

export function predictorMode(pred) {
    return pred ? pred.mode : 'line';
}

// src/shmup\systems\inputrec.js
// Purpose: S8 input recorder + shadow replay — ring buffer of input/pose
// snapshots. Drives L5 mirror-shards, L9 Shadow delay, and "your shots from
// 5 s ago" phases.
// Dependencies: none (import-clean)
//
// NARRATIVE_PLAN §4 S8.

/**
 * @param {number} [capacitySeconds=8]
 * @param {number} [hz=30]
 */
export function createRecorder(capacitySeconds = 8, hz = 30) {
    const capacity = Math.max(16, Math.ceil(capacitySeconds * hz));
    return {
        items: new Array(capacity),
        capacity,
        head: 0,
        count: 0,
        t: 0,
        hz,
        step: 1 / hz,
        acc: 0
    };
}

/**
 * Push a snapshot if the sample clock says so.
 * snap: { x, y, ax, ay, fire, weapon, vx, vy }
 */
export function recordFrame(rec, dt, snap) {
    if (!rec) return;
    rec.t += dt;
    rec.acc += dt;
    while (rec.acc >= rec.step) {
        rec.acc -= rec.step;
        rec.items[rec.head] = {
            t: rec.t,
            x: snap.x, y: snap.y,
            ax: snap.ax || 0, ay: snap.ay || 0,
            fire: !!snap.fire,
            weapon: snap.weapon || 'pulse',
            vx: snap.vx || 0, vy: snap.vy || 0
        };
        rec.head = (rec.head + 1) % rec.capacity;
        if (rec.count < rec.capacity) rec.count++;
    }
}

/** Snapshot from `delayS` seconds ago, or null if buffer is too short. */
export function sampleAt(rec, delayS) {
    if (!rec || rec.count < 2) return null;
    const targetT = rec.t - delayS;
    // Walk newest → oldest.
    for (let i = 0; i < rec.count; i++) {
        const idx = (rec.head - 1 - i + rec.capacity * 4) % rec.capacity;
        const s = rec.items[idx];
        if (!s) continue;
        if (s.t <= targetT) return s;
    }
    // Oldest available.
    const oldest = (rec.head - rec.count + rec.capacity) % rec.capacity;
    return rec.items[oldest] || null;
}

export function clearRecorder(rec) {
    if (!rec) return;
    rec.count = 0;
    rec.head = 0;
    rec.acc = 0;
    rec.t = 0;
}

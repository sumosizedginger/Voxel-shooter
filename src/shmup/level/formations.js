// src/shmup/level/formations.js
// Purpose: formation spawn-shapes. A formation places N enemies with a staggered
// entry; each enemy's own `pattern` then takes over. Import-clean — it calls a
// host-provided `spawn(type, opts)` rather than reaching into the pool, so it's
// unit-testable and can't depend on THREE.
// Dependencies: none (host injects spawn + geometry facts)
//
// LEVELS_PLAN §3. Formations × enemy types × params is the whole content space:
// waves are DATA, never code. If a level needs a new shape, it goes here once
// and then everything uses it as data.

/**
 * Each formation is `(spawn, opts, ctx) => spawnedEnemies[]`.
 *   spawn(type, {x, y, vx?, vy?, patternState?, fireState?, onCeiling?, ...})
 *   opts:  { enemy, count, y, spacing, params }  (from the level's wave trigger)
 *   ctx:   { spawnX, bounds }  (where the right edge is, so entries come from off-screen)
 */

const EDGE_PAD = 2;      // how far past the right edge enemies spawn

/** N enemies snake in on the leader's path, each offset behind the last. */
export function chain(spawn, opts, ctx) {
    const n = opts.count || 5;
    const y = opts.y != null ? opts.y : 8;
    const spacing = opts.spacing || 1.6;
    const p = opts.params || {};
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(spawn(opts.enemy, {
            x: ctx.spawnX + EDGE_PAD + i * spacing,
            y,
            patternState: { ...p, baseY: y }
        }));
    }
    return out;
}

/** A vertical line entering together — tests vertical dodging. */
export function column(spawn, opts, ctx) {
    const n = opts.count || 4;
    const cy = opts.y != null ? opts.y : 8;
    const spacing = opts.spacing || 2.2;
    const p = opts.params || {};
    const out = [];
    const top = cy + ((n - 1) / 2) * spacing;
    for (let i = 0; i < n; i++) {
        const y = top - i * spacing;
        out.push(spawn(opts.enemy, {
            x: ctx.spawnX + EDGE_PAD,
            y,
            patternState: { ...p, baseY: y }
        }));
    }
    return out;
}

/** Half enter top-right, half bottom-right, converging on the middle lane. */
export function pincer(spawn, opts, ctx) {
    const n = opts.count || 6;
    const p = opts.params || {};
    const hi = ctx.bounds ? ctx.bounds.maxY - 1 : 14;
    const lo = ctx.bounds ? ctx.bounds.minY + 1 : 2;
    const out = [];
    for (let i = 0; i < n; i++) {
        const top = i % 2 === 0;
        const y = top ? hi : lo;
        out.push(spawn(opts.enemy, {
            x: ctx.spawnX + EDGE_PAD + Math.floor(i / 2) * (opts.spacing || 1.6),
            y,
            vy: top ? -0.8 : 0.8,
            patternState: { ...p, baseY: y }
        }));
    }
    return out;
}

/**
 * Spawn off-screen LEFT, flying right — the R-Type "behind you" moment.
 * ALWAYS telegraphed (F3): the host flashes the left edge before this fires;
 * this function just marks the wave `telegraphed` so the level lint can verify
 * a flash exists and so the host knows to play it.
 */
export function ambushRear(spawn, opts, ctx) {
    const n = opts.count || 3;
    const y = opts.y != null ? opts.y : 8;
    const p = opts.params || {};
    const left = ctx.bounds ? ctx.bounds.minX - EDGE_PAD : -10;
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(spawn(opts.enemy, {
            x: left - i * (opts.spacing || 1.6),
            y,
            vx: Math.abs(p.speed || 5),        // flying RIGHT, into the screen
            patternState: { ...p, baseY: y },
            telegraphed: true
        }));
    }
    return out;
}

/**
 * Crawlers/gunpods mounted on terrain surfaces at given x offsets. The x
 * positions come as `params.mounts: [{dx, onCeiling}]`; the stage-lint test
 * verifies each lands on a terrain chunk.
 */
export function wallMount(spawn, opts, ctx) {
    const mounts = (opts.params && opts.params.mounts) || [{ dx: 0, onCeiling: false }];
    const out = [];
    for (const mnt of mounts) {
        const onCeiling = !!mnt.onCeiling;
        out.push(spawn(opts.enemy, {
            x: ctx.spawnX + EDGE_PAD + (mnt.dx || 0),
            y: onCeiling ? (ctx.ceilY != null ? ctx.ceilY : 15) : (ctx.floorY != null ? ctx.floorY : 1),
            onCeiling,
            patternState: { ...(opts.params || {}) }
        }));
    }
    return out;
}

/**
 * One carrier + orbiting drones. Kill the escort first or lose the drop in the
 * crossfire (LEVELS_PLAN §3 — the risk/reward wave).
 */
export function escort(spawn, opts, ctx) {
    const y = opts.y != null ? opts.y : 8;
    const out = [];
    out.push(spawn('carrier', { x: ctx.spawnX + EDGE_PAD, y }));
    const guards = opts.count || 2;
    for (let i = 0; i < guards; i++) {
        const a = (i / guards) * Math.PI * 2;
        out.push(spawn(opts.enemy || 'drone', {
            x: ctx.spawnX + EDGE_PAD + Math.cos(a) * 1.5,
            y: y + Math.sin(a) * 1.5,
            patternState: { amp: 1.2, freq: 0.6, baseY: y }
        }));
    }
    return out;
}

/** 2-4 gunpods in a terrain pocket — a set-piece, not a trickle. */
export function turretNest(spawn, opts, ctx) {
    const n = opts.count || 3;
    const p = opts.params || {};
    const out = [];
    for (let i = 0; i < n; i++) {
        const y = (opts.y != null ? opts.y : 8) + (i - (n - 1) / 2) * (opts.spacing || 3);
        out.push(spawn(opts.enemy || 'gunpod', {
            x: ctx.spawnX + EDGE_PAD + (i % 2) * 1.5,
            y,
            patternState: { ...p }
        }));
    }
    return out;
}

export const FORMATIONS = {
    chain, column, pincer, ambushRear, wallMount, escort, turretNest
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

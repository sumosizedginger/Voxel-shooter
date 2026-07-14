// src/shmup/bullets.js
// Purpose: bullet pools and hit tests. Pure logic — no THREE, no window.
// Dependencies: none (import-clean by design, like engine/collision.js —
// tests/bullets.spec.mjs runs it headlessly).
//
// PLAN.md §2.4: flat arrays of plain objects, circle-overlap hit tests, brute
// force N×M. At R-Type scale (<= ~300 bullets, ~40 enemies) that's ~12k cheap
// float compares per frame — nothing. Do NOT add spatial hashing here without
// a profile that says to.

/** Bullet kinds — the renderer maps these to instanced meshes 1:1. */
export const KIND = {
    PLAYER_BOLT: 'playerBolt',
    PULSE_1: 'pulse1',          // Siren Pulse tier 1
    PULSE_2: 'pulse2',          // tier 2 — pierces
    PULSE_3: 'pulse3',          // tier 3 — the siege beam's damage segment
    HAMMER: 'hammer',           // Hammer Round slug / spread pellet
    BIT: 'bit',                 // Whisper Bit shot
    ENEMY_ORB: 'enemyOrb',
    ENEMY_HEAVY: 'enemyHeavy',
    WORD: 'word'                // S7, Level 04
};

function blank() {
    return {
        alive: false,
        x: 0, y: 0, vx: 0, vy: 0,
        r: 0.1,
        dmg: 1,
        kind: KIND.PLAYER_BOLT,
        life: 0,          // seconds remaining; <= 0 means "no timeout"
        pierce: 0,        // extra enemies it may pass through (0 = dies on first)
        hitsTerrain: true,
        homing: 0,        // turn rate (rad/s) toward `target`; 0 = dumb bullet
        target: null,
        spin: 0,          // visual only
        data: null        // per-kind payload (S7 word text, reflect owner, ...)
    };
}

/**
 * A fixed-capacity pool. Never grows: if it's full, spawn() returns null and
 * the shot is simply dropped — a dropped bullet at cap is invisible to the
 * player, whereas a GC pause is not.
 */
export function createPool(capacity = 256) {
    const items = new Array(capacity);
    for (let i = 0; i < capacity; i++) items[i] = blank();
    return { items, capacity, live: 0, _cursor: 0 };
}

/** Grab a dead slot and initialize it. Returns the bullet, or null if full. */
export function spawn(pool, init) {
    const { items, capacity } = pool;
    for (let n = 0; n < capacity; n++) {
        const i = (pool._cursor + n) % capacity;
        const b = items[i];
        if (b.alive) continue;
        // Reset every field: a recycled slot must not inherit the last bullet's
        // pierce count or homing target.
        const fresh = blank();
        Object.assign(b, fresh, init, { alive: true });
        pool._cursor = (i + 1) % capacity;
        pool.live++;
        return b;
    }
    return null;
}

export function kill(pool, b) {
    if (!b.alive) return;
    b.alive = false;
    b.target = null;
    b.data = null;
    pool.live--;
}

export function clearPool(pool) {
    for (const b of pool.items) b.alive = false;
    pool.live = 0;
}

/** Circle-vs-circle overlap. The only hit test in the game. */
export function circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const rr = ar + br;
    return dx * dx + dy * dy < rr * rr;
}

/**
 * Integrate every live bullet, then cull.
 * @param {object} pool
 * @param {number} dt seconds
 * @param {{minX,maxX,minY,maxY}} bounds cull rectangle (world units)
 * @param {{blocked(x,y,half):boolean}} [terrain] optional; bullets with
 *        hitsTerrain despawn inside solid terrain (PLAN.md §2.3)
 * @param {(b:object)=>void} [onCull] called for each bullet as it dies
 */
export function updateBullets(pool, dt, bounds, terrain, onCull) {
    for (const b of pool.items) {
        if (!b.alive) continue;

        if (b.homing && b.target && b.target.alive) {
            // Turn toward the target at a bounded rate — this is the ONLY
            // continuous homing in the game (PLAN.md §2.6); aimed shots pick
            // their angle once, at fire time, and then commit to it.
            const speed = Math.hypot(b.vx, b.vy) || 1;
            const want = Math.atan2(b.target.y - b.y, b.target.x - b.x);
            let cur = Math.atan2(b.vy, b.vx);
            let d = want - cur;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const max = b.homing * dt;
            cur += Math.max(-max, Math.min(max, d));
            b.vx = Math.cos(cur) * speed;
            b.vy = Math.sin(cur) * speed;
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.life > 0) {
            b.life -= dt;
            if (b.life <= 0) { if (onCull) onCull(b); kill(pool, b); continue; }
        }

        if (b.x < bounds.minX || b.x > bounds.maxX
            || b.y < bounds.minY || b.y > bounds.maxY) {
            kill(pool, b);              // off-screen is not an impact: no onCull
            continue;
        }

        if (terrain && b.hitsTerrain && terrain.blocked(b.x, b.y, b.r)) {
            if (onCull) onCull(b);      // sparks belong here
            kill(pool, b);
        }
    }
}

/**
 * Test every live bullet against every target with `alive`, `x`, `y`, `r`.
 * `onHit(bullet, target)` applies damage and returns nothing; the bullet dies
 * unless it has pierce left.
 * @returns {number} number of hits applied
 */
export function collideBullets(pool, targets, onHit) {
    let hits = 0;
    for (const b of pool.items) {
        if (!b.alive) continue;
        for (const t of targets) {
            if (!t.alive) continue;
            if (t.invulnerable) continue;
            if (!circleHit(b.x, b.y, b.r, t.x, t.y, t.r)) continue;
            onHit(b, t);
            hits++;
            if (b.pierce > 0) {
                b.pierce--;
                continue;               // keep flying, but not through this one twice
            }
            kill(pool, b);
            break;
        }
    }
    return hits;
}

/**
 * The first live bullet overlapping a single circle (the player, the Witness).
 * Separate from collideBullets because the player is one target, not a list,
 * and because absorbing/reflecting needs the bullet back, not a count.
 */
export function firstHit(pool, x, y, r) {
    for (const b of pool.items) {
        if (!b.alive) continue;
        if (circleHit(b.x, b.y, b.r, x, y, r)) return b;
    }
    return null;
}

/** All live bullets overlapping a circle (Mirror Counter reflects a volley). */
export function allHits(pool, x, y, r, out = []) {
    out.length = 0;
    for (const b of pool.items) {
        if (!b.alive) continue;
        if (circleHit(b.x, b.y, b.r, x, y, r)) out.push(b);
    }
    return out;
}

/** Aim helper: the velocity that sends a shot from (x,y) at `target`. */
export function aimAt(x, y, target, speed) {
    const a = Math.atan2(target.y - y, target.x - x);
    return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

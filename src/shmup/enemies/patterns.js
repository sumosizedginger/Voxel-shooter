// src/shmup/enemies/patterns.js
// Purpose: enemy movement + fire behaviors. Pure logic — no THREE, no window.
// Dependencies: ../bullets.js (spawn/KIND/aimAt only — itself import-clean)
//
// PLAN.md §2.6: an enemy is DATA. Behavior is a named function that mutates it.
// There is no class per enemy type and there never will be — a new enemy is a
// row in the roster (assets/enemies.js) plus, at most, a new function here.
//
// Every function is `fn(e, dt, world)` and every constant is per-SECOND (G6).
// Aimed shots resolve their angle ONCE, at fire time (that's what makes them
// dodgeable); the only continuous homing in the game is bullets.js's `homing`.

import { KIND, spawn, aimAt } from '../bullets.js';

// ── movement ────────────────────────────────────────────────────────────────

/** Straight line at (vx, vy). The default. */
export function straight(e, dt) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

/**
 * Drift left while weaving. `amp` world units, `freq` Hz.
 * The popcorn pattern — a chain of these is R-Type's opening sentence.
 */
export function sineDrift(e, dt) {
    const s = e.patternState;
    s.t = (s.t || 0) + dt;
    if (s.baseY === undefined) s.baseY = e.y;
    e.x += e.vx * dt;
    e.y = s.baseY + Math.sin(s.t * (s.freq || 2) * Math.PI * 2) * (s.amp || 1.5);
}

/**
 * Enter fast, brake to a hover at `holdX`, hang for `hold` seconds, then dive
 * away along the entry vector. The swooper: it commits, and you can read it.
 */
export function swoopIn(e, dt, world) {
    const s = e.patternState;
    s.t = (s.t || 0) + dt;
    s.phase = s.phase || 'enter';

    if (s.phase === 'enter') {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const target = (s.holdX != null) ? s.holdX : (world.player ? world.player.x + 6 : 0);
        if (e.x <= target) {
            s.phase = 'hold';
            s.holdT = 0;
            s.apex = true;                 // the fire hook watches for this
        }
    } else if (s.phase === 'hold') {
        s.holdT += dt;
        // Ease to a stop rather than snapping — a snap reads as a hitch.
        e.x += e.vx * dt * Math.max(0, 1 - s.holdT / (s.hold || 0.6));
        if (s.holdT >= (s.hold || 0.6)) {
            s.phase = 'dive';
            const a = Math.atan2(
                (world.player ? world.player.y : e.y) - e.y,
                (world.player ? world.player.x : e.x - 1) - e.x
            );
            const sp = s.diveSpeed || 11;
            e.vx = Math.cos(a) * sp;
            e.vy = Math.sin(a) * sp;
        }
    } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
    }
}

/**
 * Hold station (drifting left slowly) and track the player with a barrel.
 * Only `e.aim` changes — the body does not rotate (ASSETS_PLAN §2: rotate the
 * barrel child mesh, never the body, or the silhouette stops reading).
 */
export function hoverAndAim(e, dt, world) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (world.player && world.player.alive) {
        e.aim = Math.atan2(world.player.y - e.y, world.player.x - e.x);
    }
}

/** Creep toward the player. Slow enough to outrun, fast enough to matter. */
export function homingSlow(e, dt, world) {
    const p = world.player;
    if (!p || !p.alive) { straight(e, dt); return; }
    const s = e.patternState;
    const speed = s.speed || 3.2;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    // Turn the velocity, don't teleport it: a mine that snaps is unfair.
    const cur = Math.atan2(e.vy, e.vx);
    let d = a - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const max = (s.turn || 2.4) * dt;
    const na = cur + Math.max(-max, Math.min(max, d));
    e.vx = Math.cos(na) * speed;
    e.vy = Math.sin(na) * speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

/** Glued to a surface: crawl along x at a fixed y (spawn flag `onCeiling`). */
export function crawl(e, dt) {
    e.x += e.vx * dt;
}

/** Hold a fixed screen offset — bosses and set-piece parts drive their own x. */
export function anchored(e, dt, world) {
    const s = e.patternState;
    if (s.anchorX === undefined) return;
    e.x = (world.scrollX || 0) + s.anchorX;
}

export const PATTERNS = {
    straight, sineDrift, swoopIn, hoverAndAim, homingSlow, crawl, anchored
};

// ── fire ────────────────────────────────────────────────────────────────────

/**
 * The shared cadence gate. Returns true when it's time to shoot.
 * `every` seconds; `warmup` delays the first shot so an enemy never fires on
 * the frame it spawns (LEVELS_PLAN fairness: nothing shoots from off-screen).
 */
function ready(e, dt, every, warmup = 0.4) {
    const s = e.fireState;
    if (s.t === undefined) s.t = -warmup;
    s.t += dt;
    if (s.t >= every) { s.t = 0; return true; }
    return false;
}

/** One aimed orb. `speed`, `every` from fireState. */
export function aimedShot(e, dt, world) {
    if (!world.player || !world.player.alive) return;
    if (!onScreenEnough(e, world)) return;
    const s = e.fireState;
    if (!ready(e, dt, s.every || 1.8)) return;
    const v = aimAt(e.x, e.y, world.player, s.speed || 9);
    spawn(world.enemyBullets, {
        x: e.x, y: e.y, vx: v.vx, vy: v.vy,
        r: 0.16, dmg: s.dmg || 6, kind: KIND.ENEMY_ORB, hitsTerrain: false
    });
    if (world.onEnemyShot) world.onEnemyShot(e);
}

/** A 3-round aimed burst — the gunpod's signature. */
export function burstShot(e, dt, world) {
    const s = e.fireState;
    if (!world.player || !world.player.alive) return;
    if (!onScreenEnough(e, world)) return;

    if (s.burst > 0) {
        s.gap = (s.gap || 0) - dt;
        if (s.gap <= 0) {
            s.burst--;
            s.gap = s.burstGap || 0.12;
            const v = aimAt(e.x, e.y, world.player, s.speed || 10);
            spawn(world.enemyBullets, {
                x: e.x, y: e.y, vx: v.vx, vy: v.vy,
                r: 0.16, dmg: s.dmg || 6, kind: KIND.ENEMY_ORB, hitsTerrain: false
            });
            if (world.onEnemyShot) world.onEnemyShot(e);
        }
        return;
    }
    if (ready(e, dt, s.every || 2.6)) {
        s.burst = s.count || 3;
        s.gap = 0;
    }
}

/** A symmetric spread, aimed at the player and fanned around that angle. */
export function spreadShot(e, dt, world) {
    const s = e.fireState;
    if (!world.player || !world.player.alive) return;
    if (!onScreenEnough(e, world)) return;
    if (!ready(e, dt, s.every || 2.5)) return;

    const n = s.count || 2;
    const spread = s.spread || 0.35;
    const base = Math.atan2(world.player.y - e.y, world.player.x - e.x);
    const speed = s.speed || 8;
    for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread;
        spawn(world.enemyBullets, {
            x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
            r: 0.16, dmg: s.dmg || 6, kind: KIND.ENEMY_ORB, hitsTerrain: false
        });
    }
    if (world.onEnemyShot) world.onEnemyShot(e);
}

/** Straight along a fixed axis — the wall-crawler's blind spit. */
export function axisShot(e, dt, world) {
    const s = e.fireState;
    if (!onScreenEnough(e, world)) return;
    if (!ready(e, dt, s.every || 2.0)) return;
    const dir = s.dir || (e.onCeiling ? -1 : 1);     // away from its surface
    const speed = s.speed || 8;
    spawn(world.enemyBullets, {
        x: e.x, y: e.y, vx: 0, vy: dir * speed,
        r: 0.16, dmg: s.dmg || 6, kind: KIND.ENEMY_ORB, hitsTerrain: false
    });
    if (world.onEnemyShot) world.onEnemyShot(e);
}

/** Fires once, at the apex of a swoop (swoopIn sets patternState.apex). */
export function apexShot(e, dt, world) {
    const s = e.patternState;
    if (!s.apex) return;
    s.apex = false;
    if (!world.player || !world.player.alive) return;
    if (!onScreenEnough(e, world)) return;
    const v = aimAt(e.x, e.y, world.player, e.fireState.speed || 11);
    spawn(world.enemyBullets, {
        x: e.x, y: e.y, vx: v.vx, vy: v.vy,
        r: 0.16, dmg: e.fireState.dmg || 6, kind: KIND.ENEMY_ORB, hitsTerrain: false
    });
    if (world.onEnemyShot) world.onEnemyShot(e);
}

/**
 * Fairness gate (LEVELS_PLAN §5): nothing may shoot from off-screen right, and
 * nothing shoots once it's past the player's left edge — a bullet you cannot
 * see coming is not a difficulty, it's a lie.
 *
 * It also enforces the Cloak Drone's promise: while she's cloaked, nothing can
 * aim at her, because nothing can see her.
 */
function onScreenEnough(e, world) {
    if (world.player && world.player.cloaked > 0) return false;
    if (!world.bounds) return true;
    return e.x < world.bounds.maxX + 1 && e.x > world.bounds.minX - 1;
}

export const FIRES = {
    none: null,
    aimedShot, burstShot, spreadShot, axisShot, apexShot
};

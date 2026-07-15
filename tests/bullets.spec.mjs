// tests/bullets.spec.mjs
// Pure-node spec for the bullet pools (PLAN.md Phase 2). No THREE, no DOM —
// bullets.js is import-clean exactly so this can run headlessly.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import {
    KIND, createPool, spawn, kill, clearPool, circleHit,
    updateBullets, collideBullets, firstHit, allHits, aimAt
} from '../src/shmup/bullets.js';

const BOUNDS = { minX: -10, maxX: 10, minY: -10, maxY: 10 };

export function run(t) {
    // ── pool mechanics
    const p = createPool(3);
    t.ok('new pool has no live bullets', p.live === 0);

    const a = spawn(p, { x: 1, y: 2, vx: 5, vy: 0, kind: KIND.PLAYER_BOLT });
    const b = spawn(p, { x: 0, y: 0, vx: 0, vy: 0 });
    const c = spawn(p, { x: 0, y: 0, vx: 0, vy: 0 });
    t.ok('pool tracks live count', p.live === 3, 'live=' + p.live);
    t.ok('spawn() returns null when the pool is full', spawn(p, {}) === null);

    kill(p, b);
    t.ok('kill() frees a slot', p.live === 2, 'live=' + p.live);
    const d = spawn(p, { x: 9, y: 9 });
    t.ok('a freed slot is reused', d !== null && p.live === 3);

    // A recycled slot must not inherit the previous bullet's state — a stale
    // `pierce` would silently make one shot immortal.
    kill(p, d);
    const reused = spawn(p, { x: 0, y: 0 });
    t.ok('recycled slots are fully reset', reused.pierce === 0 && reused.target === null
        && reused.homing === 0 && reused.life === 0);

    // Ad-hoc keys (word bullets) must not pollute the next spawn in the slot.
    kill(p, reused);
    spawn(p, {
        x: 1, y: 1, kind: KIND.WORD, word: 'DELVE', onlyProfanity: true,
        heals: true, bossShot: true
    });
    for (const b of p.items) if (b.alive && b.kind === KIND.WORD) kill(p, b);
    const clean = spawn(p, { x: 2, y: 2, kind: KIND.ENEMY_ORB, vx: -1, vy: 0 });
    t.ok('recycled slot drops onlyProfanity/word flags',
        clean && clean.onlyProfanity === undefined && clean.word === undefined
        && clean.heals === undefined && clean.bossShot === undefined
        && clean.kind === KIND.ENEMY_ORB);

    clearPool(p);
    t.ok('clearPool() empties the pool', p.live === 0);

    // ── motion is per-second, not per-frame (G6)
    const m = createPool(4);
    const s = spawn(m, { x: 0, y: 0, vx: 10, vy: -4 });
    updateBullets(m, 0.5, BOUNDS);
    t.ok('bullets integrate velocity * dt',
        Math.abs(s.x - 5) < 1e-9 && Math.abs(s.y + 2) < 1e-9,
        'pos=' + s.x + ',' + s.y);

    // ── off-screen cull, and it is NOT an impact (no spark, no onCull)
    let culled = 0;
    const off = spawn(m, { x: 9.9, y: 0, vx: 10, vy: 0 });
    updateBullets(m, 0.5, BOUNDS, null, () => { culled++; });
    t.ok('bullets despawn past the bounds', !off.alive);
    t.ok('an off-screen despawn does not fire onCull', culled === 0, 'culled=' + culled);

    // ── lifetime expiry DOES fire onCull (that one is an impact/fizzle)
    let expired = 0;
    const timed = spawn(m, { x: 0, y: 0, vx: 0, vy: 0, life: 0.1 });
    updateBullets(m, 0.2, BOUNDS, null, () => { expired++; });
    t.ok('life <= 0 kills the bullet', !timed.alive);
    t.ok('lifetime expiry fires onCull', expired === 1, 'expired=' + expired);

    // ── terrain
    clearPool(m);
    const terrain = { blocked: (x, y) => x > 3 && x < 5 && y > -1 && y < 1 };
    const intoWall = spawn(m, { x: 0, y: 0, vx: 10, vy: 0, hitsTerrain: true });
    const ghost = spawn(m, { x: 0, y: 0, vx: 10, vy: 0, hitsTerrain: false });
    let sparks = 0;
    updateBullets(m, 0.4, BOUNDS, terrain, () => { sparks++; });
    t.ok('a bullet despawns inside terrain', !intoWall.alive);
    t.ok('hitsTerrain:false passes straight through', ghost.alive);
    t.ok('a terrain impact fires onCull (sparks)', sparks === 1, 'sparks=' + sparks);

    // ── circle hits
    t.ok('circleHit overlaps', circleHit(0, 0, 0.5, 0.8, 0, 0.5));
    t.ok('circleHit misses', !circleHit(0, 0, 0.5, 1.2, 0, 0.5));

    // ── collision + damage + pierce
    const q = createPool(8);
    const enemies = [
        { alive: true, x: 1, y: 0, r: 0.5, hp: 3 },
        { alive: true, x: 2, y: 0, r: 0.5, hp: 3 },
        { alive: true, x: 3, y: 0, r: 0.5, hp: 3 }
    ];
    const plain = spawn(q, { x: 1, y: 0, r: 0.1, dmg: 2, pierce: 0 });
    const hits1 = collideBullets(q, enemies, (bul, en) => { en.hp -= bul.dmg; });
    t.ok('a bullet hits exactly one enemy', hits1 === 1, 'hits=' + hits1);
    t.ok('damage is applied from bullet.dmg', enemies[0].hp === 1, 'hp=' + enemies[0].hp);
    t.ok('a non-piercing bullet dies on impact', !plain.alive);

    // A tier-2 Pulse pierces: one bullet, several enemies, in one pass.
    clearPool(q);
    for (const e of enemies) e.hp = 3;
    const piercer = spawn(q, { x: 2, y: 0, r: 1.6, dmg: 1, pierce: 1 });
    const hits2 = collideBullets(q, enemies, (bul, en) => { en.hp -= bul.dmg; });
    t.ok('a piercing bullet hits more than one enemy', hits2 === 2, 'hits=' + hits2);
    t.ok('pierce is consumed', piercer.pierce === 0 && !piercer.alive);

    // Dead / invulnerable targets are never hit.
    clearPool(q);
    const dead = [{ alive: false, x: 0, y: 0, r: 1, hp: 1 }];
    const inv = [{ alive: true, invulnerable: true, x: 0, y: 0, r: 1, hp: 1 }];
    spawn(q, { x: 0, y: 0, r: 0.1 });
    t.ok('dead targets are skipped', collideBullets(q, dead, () => {}) === 0);
    t.ok('invulnerable targets are skipped', collideBullets(q, inv, () => {}) === 0);

    // ── firstHit / allHits (the Witness absorbs; Mirror Counter reflects a volley)
    clearPool(q);
    spawn(q, { x: 0, y: 0, r: 0.1 });
    spawn(q, { x: 0.2, y: 0, r: 0.1 });
    spawn(q, { x: 9, y: 9, r: 0.1 });
    t.ok('firstHit finds an overlapping bullet', firstHit(q, 0, 0, 0.5) !== null);
    t.ok('firstHit returns null on a clean miss', firstHit(q, -5, -5, 0.5) === null);
    t.ok('allHits returns every overlapping bullet',
        allHits(q, 0, 0, 0.5).length === 2, 'n=' + allHits(q, 0, 0, 0.5).length);

    // ── aiming: the angle is chosen once, at fire time
    const v = aimAt(0, 0, { x: 3, y: 4 }, 10);
    t.ok('aimAt points at the target at the given speed',
        Math.abs(v.vx - 6) < 1e-9 && Math.abs(v.vy - 8) < 1e-9,
        'v=' + v.vx + ',' + v.vy);

    // ── homing turns at a bounded rate (it must not snap onto the target)
    const h = createPool(2);
    const seeker = spawn(h, {
        x: 0, y: 0, vx: 4, vy: 0, homing: 1.0,      // 1 rad/s
        target: { alive: true, x: 0, y: 5 }
    });
    updateBullets(h, 0.1, BOUNDS);                   // may turn at most 0.1 rad
    const ang = Math.atan2(seeker.vy, seeker.vx);
    t.ok('homing turns toward the target', ang > 0.0001, 'angle=' + ang.toFixed(4));
    t.ok('homing turn rate is bounded by dt', ang <= 0.1 + 1e-6, 'angle=' + ang.toFixed(4));
    t.ok('homing preserves speed',
        Math.abs(Math.hypot(seeker.vx, seeker.vy) - 4) < 1e-6,
        'speed=' + Math.hypot(seeker.vx, seeker.vy));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('bullets');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

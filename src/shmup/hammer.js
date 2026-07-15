// src/shmup/hammer.js
// Purpose: the Hammer Round — the secondary. Pure logic, no THREE.
// Dependencies: ./bullets.js
//
// Bible §03, verbatim: "The Hammer was the refinement seat. Her round does not
// negotiate with the fucking fat. It hacks the shit away until it hits the wet
// bone. Five-round burst at close range, single slug at long range. The slug has
// knockback on bosses. The knockback is small but consistent. Stack three slugs
// and the boss staggers. Stagger opens the weakpoint window."
//
// The range check is what makes it a decision instead of a button: the same
// press does two different things depending on where you're standing, so
// positioning IS the weapon selection. Get close and it's a shotgun. Stay back
// and it's a chisel. It refuses to be both at once, which is the seat's whole
// personality.

import { KIND, spawn } from './bullets.js';

/** Inside this distance to the nearest enemy, the Hammer throws a spread. */
export const CLOSE_RANGE = 7;

export const SPREAD_COUNT = 5;
export const SPREAD_ARC = 0.5;          // radians, total fan
export const SPREAD_DMG = 3;
export const SPREAD_SPEED = 22;
export const SPREAD_LIFE = 0.45;        // pellets die young — that's the range limit

export const SLUG_DMG = 9;
export const SLUG_SPEED = 30;
export const SLUG_KNOCKBACK = 0.35;     // world units, "small but consistent"

/** Three slugs stagger a boss. */
export const STAGGER_SLUGS = 3;
export const STAGGER_S = 2.0;           // the weakpoint window the stagger opens
/** Slug stacks decay — you must land three with intent, not over a whole fight. */
export const STACK_DECAY_S = 4.0;

export const FIRE_RATE = 2.6;           // shots/second
/** Weapon switch cost (C6, bible §05: "Switching takes 0.4 seconds"). */
export const SWAP_S = 0.4;

export function createHammer() {
    return { cd: 0 };
}

/** Distance from (x,y) to the nearest live enemy. Infinity if the field is clear. */
export function nearestEnemyDist(x, y, enemies) {
    let best = Infinity;
    for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < best) best = d;
    }
    return best;
}

/**
 * Which shape the Hammer takes right now. Resolved at FIRE time, from the
 * nearest enemy — so the player can feel it change as they close.
 */
export function hammerMode(x, y, enemies) {
    return nearestEnemyDist(x, y, enemies) <= CLOSE_RANGE ? 'spread' : 'slug';
}

/**
 * Fire the Hammer.
 * @returns {{mode:string, shots:object[]}}
 */
export function fireHammer(world, x, y) {
    const mode = hammerMode(x, y, world.enemies.items);
    const shots = [];

    if (mode === 'spread') {
        for (let i = 0; i < SPREAD_COUNT; i++) {
            const a = (i - (SPREAD_COUNT - 1) / 2) * (SPREAD_ARC / (SPREAD_COUNT - 1));
            const b = spawn(world.bullets, {
                x, y,
                vx: Math.cos(a) * SPREAD_SPEED,
                vy: Math.sin(a) * SPREAD_SPEED,
                r: 0.14, dmg: SPREAD_DMG, kind: KIND.HAMMER,
                life: SPREAD_LIFE
            });
            if (b) shots.push(b);
        }
    } else {
        const b = spawn(world.bullets, {
            x, y, vx: SLUG_SPEED, vy: 0,
            r: 0.2, dmg: SLUG_DMG, kind: KIND.HAMMER,
            scale: 1.6,
            isSlug: true,          // the boss reads this to count its stagger stack
            knockback: SLUG_KNOCKBACK
        });
        if (b) shots.push(b);
    }
    return { mode, shots };
}

/**
 * Land a slug on a staggerable target (a boss, or a boss part).
 * Call from the hit handler with the target's own stack state.
 * @returns {boolean} true if THIS slug staggered it
 */
export function applySlug(target, dt = 0) {
    target.slugStacks = (target.slugStacks || 0) + 1;
    target.slugStackT = STACK_DECAY_S;
    if (target.slugStacks >= STAGGER_SLUGS) {
        target.slugStacks = 0;
        target.staggered = STAGGER_S;
        return true;
    }
    return false;
}

/** Tick a target's slug-stack decay. */
export function decayStacks(target, dt) {
    if (!target.slugStacks) return;
    target.slugStackT -= dt;
    if (target.slugStackT <= 0) {
        target.slugStacks = 0;
        target.slugStackT = 0;
    }
}

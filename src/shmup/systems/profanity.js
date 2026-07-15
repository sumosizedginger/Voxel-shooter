// src/shmup/systems/profanity.js
// Purpose: L4 Profanity Key — cancels the nearest onlyProfanity word-bullet.
// Dependencies: none (import-clean)
//
// NARRATIVE_PLAN §3 + §4 S7. Physical weapons cannot stop word-bullets; only
// the Profanity Key can. 1.2 s cooldown. The register is load-bearing — no filter.

import { kill } from '../bullets.js';

export const PROFANITY_CD = 1.2;
export const PROFANITY_RANGE = 22;

export function createProfanity() {
    return { cd: 0, lastWord: null, cancels: 0 };
}

export function updateProfanity(p, dt) {
    if (p.cd > 0) p.cd -= dt;
}

/**
 * Attempt a profanity cancel. Returns the cancelled bullet or null.
 * @param {object} state createProfanity()
 * @param {object} world
 * @param {{x:number,y:number}} from player position
 */
export function tryProfanity(state, world, from) {
    if (!state || state.cd > 0) return null;
    const pool = world.enemyBullets;
    if (!pool) return null;

    let best = null;
    let bestD = PROFANITY_RANGE * PROFANITY_RANGE;
    for (const b of pool.items) {
        if (!b.alive) continue;
        if (!b.onlyProfanity && b.kind !== 'word') continue;
        const dx = b.x - from.x;
        const dy = b.y - from.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) return null;

    state.lastWord = best.word || best.data || '—';
    state.cancels++;
    state.cd = PROFANITY_CD;
    kill(pool, best);
    return best;
}

/** True while the key is cooling down. */
export function profanityReady(state) {
    return state && state.cd <= 0;
}

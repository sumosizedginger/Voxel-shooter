// src/shmup\systems\temporal.js
// Purpose: S10 temporal loop — L10 phase 3 (τ²). Record spawn *events* with
// timestamps; every 12 s reset player position and replay last loop's bullet
// events. Boss HP and damage persist. Fold weakpoint opens during the 0.4 s reset.
// Dependencies: bullets (spawn/KIND) — still import-clean enough for unit tests
// if spawn is injected; we import bullets for the live path.
//
// NARRATIVE_PLAN §4 S10.

import { KIND, spawn } from '../bullets.js';

export const LOOP_PERIOD = 12;
export const FOLD_WINDOW = 0.4;

export function createTemporalLoop(period = LOOP_PERIOD) {
    return {
        period,
        t: 0,
        loopIndex: 0,
        events: [],         // current loop recordings
        prevEvents: [],     // last completed loop, replayed
        folding: 0,         // >0 during reset fold (weakpoint open)
        active: false,
        origin: null        // {x,y} snapshot at loop start
    };
}

export function startTemporal(loop, player) {
    if (!loop) return;
    loop.active = true;
    loop.t = 0;
    loop.events = [];
    loop.prevEvents = [];
    loop.folding = 0;
    loop.loopIndex = 0;
    loop.origin = player ? { x: player.x, y: player.y } : { x: 0, y: 8 };
}

export function stopTemporal(loop) {
    if (!loop) return;
    loop.active = false;
    loop.folding = 0;
}

/** Record an enemy-bullet spawn event for later replay. */
export function recordBulletEvent(loop, b) {
    if (!loop || !loop.active || !b) return;
    loop.events.push({
        at: loop.t,
        x: b.x, y: b.y,
        vx: b.vx, vy: b.vy,
        r: b.r, dmg: b.dmg,
        kind: b.kind || KIND.ENEMY_ORB
    });
}

/**
 * Tick the loop. When period elapses: fold player to origin, open weakpoint
 * window on boss cores, swap event buffers, replay begins via replayCursor.
 * @returns {{ folded:boolean, foldT:number }}
 */
export function updateTemporal(loop, dt, world) {
    if (!loop || !loop.active) return { folded: false, foldT: 0 };
    loop.t += dt;
    if (loop.folding > 0) loop.folding -= dt;

    // Replay previous loop's events as they come due (relative to new loop t).
    if (loop.prevEvents.length) {
        const due = [];
        const remain = [];
        for (const ev of loop.prevEvents) {
            if (ev.at <= loop.t) due.push(ev);
            else remain.push(ev);
        }
        loop.prevEvents = remain;
        for (const ev of due) {
            spawn(world.enemyBullets, {
                x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy,
                r: ev.r, dmg: ev.dmg, kind: ev.kind, hitsTerrain: false,
                fromLoop: true
            });
        }
    }

    if (loop.t >= loop.period) {
        // Fold.
        loop.prevEvents = loop.events;
        loop.events = [];
        loop.t = 0;
        loop.loopIndex++;
        loop.folding = FOLD_WINDOW;
        const p = world.player;
        if (p && p.alive && loop.origin) {
            p.x = loop.origin.x;
            p.y = loop.origin.y;
        }
        // Open boss weakpoint during the fold.
        if (world.boss && world.boss.cores) {
            for (const c of world.boss.cores) {
                c.weakpointT = Math.max(c.weakpointT || 0, FOLD_WINDOW + 0.3);
                c.open = true;
            }
        }
        return { folded: true, foldT: FOLD_WINDOW };
    }
    return { folded: false, foldT: Math.max(0, loop.folding) };
}

export function isFolding(loop) {
    return !!(loop && loop.folding > 0);
}

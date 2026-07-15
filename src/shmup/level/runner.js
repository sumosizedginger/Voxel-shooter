// src/shmup/level/runner.js
// Purpose: run a data level — build its terrain/parallax, wire the director's
// trigger handlers to the live game systems, and tick it each frame.
// Dependencies: three (indirectly via build.js), the director/formations, world
//
// This is the seam between the import-clean director/formations/level-data and
// the THREE-side game. game.js owns the state machine; this owns "what a trigger
// DOES". Keeping it here means game.js doesn't grow a handler per trigger type.

import * as THREE from 'three';
import { createDirector, updateDirector, resetDirector, releaseLock, upcomingTriggers } from './director.js';
import { FORMATIONS } from './formations.js';
import { buildTerrain, buildParallax, disposeBuilt } from './build.js';
import { spawnEnemy, clearEnemies } from '../enemies/index.js';
import { PLAY_MIN_Y, PLAY_MAX_Y } from '../camera.js';
import { maybeAssignCast } from '../systems/cast.js';

/**
 * @param {object} level  a data level (level01.js shape)
 * @param {THREE.Scene} scene
 * @param {object} world
 * @returns {object} the runner (tick/reset/dispose + director)
 */
export function createLevelRunner(level, scene, world) {
    const group = new THREE.Group();
    scene.add(group);

    if (level._baseSpeed == null) level._baseSpeed = level.scrollSpeed;
    world.terrain.clear();
    const built = buildTerrain(level, group, world.terrain);
    level.backgroundLayers = buildParallax(level, scene);
    level.group = group;
    level.scrollLocked = false;

    const runner = {
        level, scene, world, group, built,
        director: null,
        activeWaveEnemies: [],       // enemies from waves since the last lock
        pendingLockClear: false,
        leftEdgeFlash: 0,            // ambushRear telegraph timer
        onBoss: null,                // host sets this: (id) => void
        onDialogue: null
    };

    const handlers = {
        wave: (t) => spawnFormation(runner, t),
        pickup: (t) => {
            // F1: a recoveryOnly pickup exists only on a post-death run.
            if (t.recoveryOnly && !world.diedSinceCheckpoint) return;
            if (world.spawnPickup) {
                const spawnAt = world.scrollX + 24;    // ahead, so it drifts into reach
                world.spawnPickup(t.kind, spawnAt, t.y != null ? t.y : 8);
            }
        },
        checkpoint: () => {
            // Passing a checkpoint clean clears the recovery flag — the shard
            // won't spawn again until she dies past here (F1).
            world.diedSinceCheckpoint = false;
        },
        speed: (t) => {
            level.scrollSpeed = t.scrollSpeed;
            level.scrollLocked = (t.scrollSpeed === 0);
        },
        lock: () => {
            level.scrollLocked = true;
            runner.pendingLockClear = true;
        },
        dialogue: (t) => {
            if (runner.onDialogue) runner.onDialogue(t.id);
        },
        boss: (t) => {
            level.scrollLocked = true;
            if (runner.onBoss) runner.onBoss(t.id);
        },
        end: () => {
            if (runner.onEnd) runner.onEnd();
        }
    };

    runner.director = createDirector(level, handlers);
    world.director = {
        reset: (toX) => resetLevel(runner, toX)
    };
    return runner;
}

function spawnFormation(runner, trigger) {
    const fn = FORMATIONS[trigger.formation];
    if (!fn) { console.error('unknown formation: ' + trigger.formation); return; }

    const { world } = runner;
    const ctx = {
        spawnX: world.scrollX + (world.bounds ? (world.bounds.maxX - world.scrollX) : 20),
        bounds: world.bounds,
        floorY: PLAY_MIN_Y + 1.2,
        ceilY: PLAY_MAX_Y - 1.2
    };

    const spawn = (type, opts) => {
        const o = Object.assign({}, opts, {
            levelId: runner.level.id,
            elite: !!(trigger.elite || (opts && opts.elite)),
            castChance: trigger.castChance != null ? trigger.castChance
                : (opts && opts.castChance)
        });
        // Propagate mimic flag for L2 (S5): enemy will fire the copy buffer.
        if (trigger.mimic || runner.level.systems && runner.level.systems.mimic) {
            o.mimic = true;
        }
        const e = spawnEnemy(world.enemies, type, o);
        if (e) {
            if (o.mimic) e.mimic = true;
            // S2 cast assignment when the wave asks for it (or L1 teach).
            if (!e.cast) maybeAssignCast(e, trigger, runner.level.id);
            runner.activeWaveEnemies.push(e);
            // ambushRear enemies come from behind — flash the left edge first (F3).
            if (opts && opts.telegraphed) runner.leftEdgeFlash = 0.5;
        }
        return e;
    };

    fn(spawn, trigger, ctx);
}

/** Tick the director + resolve a pending lock once its waves are cleared. */
export function tickLevelRunner(runner, dt, scrollX) {
    updateDirector(runner.director, scrollX, runner.world);

    if (runner.leftEdgeFlash > 0) runner.leftEdgeFlash -= dt;

    // A lock clears when every enemy spawned since it engaged is dead.
    if (runner.director.locked && runner.pendingLockClear) {
        runner.activeWaveEnemies = runner.activeWaveEnemies.filter((e) => e.alive);
        if (runner.activeWaveEnemies.length === 0) {
            releaseLock(runner.director);
            runner.pendingLockClear = false;
            runner.level.scrollLocked = false;
        }
    }
}

/** Checkpoint rewind: rebuild wave state from toX, despawn what's live. */
function resetLevel(runner, toX) {
    clearEnemies(runner.world.enemies);
    runner.activeWaveEnemies.length = 0;
    runner.pendingLockClear = false;
    runner.level.scrollLocked = false;
    // Restore the authored scroll speed (a `speed 0` before death must not stick).
    runner.level.scrollSpeed = runner.level._baseSpeed != null
        ? runner.level._baseSpeed : runner.level.scrollSpeed;
    resetDirector(runner.director, toX);
}

export function levelTimeline(runner, n = 6) {
    return upcomingTriggers(runner.director, n);
}

export function disposeLevelRunner(runner) {
    disposeBuilt(runner.built, runner.group);
    runner.scene.remove(runner.group);
    for (const layer of (runner.level.backgroundLayers || [])) runner.scene.remove(layer);
}

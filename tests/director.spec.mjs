// tests/director.spec.mjs
// Pure-node spec for the level director's fire-once + rewind contract.
// LEVELS_PLAN §2. director.js is import-clean, so this needs no browser.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import {
    createDirector, updateDirector, resetDirector, releaseLock,
    upcomingTriggers, levelProgress, TRIGGER_TYPES
} from '../src/shmup/level/director.js';

function recordingHandlers(log) {
    const h = {};
    for (const type of TRIGGER_TYPES) h[type] = (t) => log.push(type + '@' + t.atX);
    return h;
}

export function run(t) {
    // ── fire-once, in order, when the playhead reaches each trigger
    const log = [];
    const level = {
        length: 300,
        triggers: [
            { atX: 50, type: 'wave', formation: 'chain', enemy: 'drone' },
            { atX: 10, type: 'dialogue', id: 'a' },     // deliberately out of order
            { atX: 100, type: 'checkpoint' },
            { atX: 200, type: 'boss', id: 'b' },
            { atX: 250, type: 'end' }
        ]
    };
    const d = createDirector(level, recordingHandlers(log));

    t.ok('the director sorts triggers by atX', d.triggers[0].atX === 10);
    t.ok('the source level is not mutated', level.triggers[0].atX === 50);

    updateDirector(d, 5, {});
    t.ok('nothing fires before the first trigger', log.length === 0);

    updateDirector(d, 55, {});
    t.ok('all reached triggers fire, in order', log.join(',') === 'dialogue@10,wave@50',
        log.join(','));

    // Idempotent: the same scrollX must not refire.
    const n = updateDirector(d, 55, {});
    t.ok('a trigger fires exactly once', n === 0 && log.length === 2);

    updateDirector(d, 300, {});
    t.ok('the rest fire as the playhead passes them',
        log.join(',') === 'dialogue@10,wave@50,checkpoint@100,boss@200,end@250');
    t.ok('the end trigger marks the director finished', d.finished === true);

    // ── lock: recorded, held until released
    const log2 = [];
    const d2 = createDirector({
        length: 100,
        triggers: [
            { atX: 10, type: 'lock', until: 'cleared' },
            { atX: 90, type: 'end' }
        ]
    }, recordingHandlers(log2));
    updateDirector(d2, 15, {});
    t.ok('a lock trigger sets locked', d2.locked === true && d2.lockTrigger.atX === 10);
    releaseLock(d2);
    t.ok('releaseLock clears the lock', d2.locked === false && d2.lockTrigger === null);

    // ── reset(toX): re-arm everything after toX, keep everything at/before it
    const log3 = [];
    const d3 = createDirector({
        length: 300,
        triggers: [
            { atX: 20, type: 'wave', enemy: 'drone' },
            { atX: 60, type: 'checkpoint' },
            { atX: 80, type: 'wave', enemy: 'darter' },
            { atX: 120, type: 'wave', enemy: 'gunpod' },
            { atX: 200, type: 'end' }
        ]
    }, recordingHandlers(log3));

    updateDirector(d3, 130, {});    // fire through x=120
    const firedBefore = log3.length;
    t.ok('fired the first four triggers', firedBefore === 4, 'n=' + firedBefore);

    // Death at 130, rewind to the checkpoint at 60.
    let resetCalledWith = null;
    resetDirector(d3, 60, (x) => { resetCalledWith = x; });
    t.ok('reset invokes the despawn callback with toX', resetCalledWith === 60);

    // Triggers at 80 and 120 must fire AGAIN; 20 and 60 must not.
    log3.length = 0;
    updateDirector(d3, 130, {});
    t.ok('reset re-arms only triggers after toX',
        log3.join(',') === 'wave@80,wave@120', log3.join(','));

    // The checkpoint itself (at exactly toX) stays fired — you already passed it.
    log3.length = 0;
    resetDirector(d3, 60);
    updateDirector(d3, 65, {});
    t.ok('a trigger exactly at toX does not refire', log3.length === 0, log3.join(','));

    // ── upcoming + progress
    const up = upcomingTriggers(d3, 2);
    t.ok('upcomingTriggers returns the next unfired triggers',
        up.length === 2 && up[0].atX === 80);
    t.ok('levelProgress is scrollX/length clamped',
        Math.abs(levelProgress(d3, 150) - 0.5) < 1e-9);
    t.ok('levelProgress clamps past the end', levelProgress(d3, 999) === 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('director');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

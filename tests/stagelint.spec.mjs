// tests/stagelint.spec.mjs
// The content safety net (LEVELS_PLAN §7). Pure node: imports every level and
// asserts it's authored fairly and consistently, without a browser. Run on
// every level as it's authored — this is why the schema is plain data.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import { LEVELS as CAMPAIGN } from '../src/shmup/level/campaign.js';
import { TRIGGER_TYPES } from '../src/shmup/level/director.js';
import { FORMATION_NAMES } from '../src/shmup/level/formations.js';
import { CHUNK_NAMES } from '../src/shmup/assets/terrain.js';
import { ENEMY_TYPES } from '../src/shmup/enemies/roster.js';

// The whole campaign — Level 01 (bespoke) plus the nine generated levels.
const LEVELS = CAMPAIGN.filter(Boolean);

// Playfield band (PLAN.md §2.1), with a little slack for entry arcs.
const PLAY_MIN_Y = 0, PLAY_MAX_Y = 16;
// LEVELS_PLAN §5 F1: a recovery shard within this many units after a checkpoint.
const RECOVERY_WINDOW = 15;
// F3: no enemy bullet faster than this (player base speed 9 + reaction margin).
const MAX_BULLET_SPEED = 14;

function lintLevel(t, lvl) {
    const tag = 'L' + lvl.id;
    const triggers = lvl.triggers || [];

    // ── ordering + structural triggers
    let sorted = true;
    for (let i = 1; i < triggers.length; i++) {
        if (triggers[i].atX < triggers[i - 1].atX) { sorted = false; break; }
    }
    t.ok(tag + ': triggers sorted by atX', sorted);

    const bosses = triggers.filter((x) => x.type === 'boss');
    const ends = triggers.filter((x) => x.type === 'end');
    t.ok(tag + ': exactly one boss trigger', bosses.length === 1, 'n=' + bosses.length);
    t.ok(tag + ': exactly one end trigger', ends.length === 1, 'n=' + ends.length);
    t.ok(tag + ': end is the last trigger',
        triggers.length > 0 && triggers[triggers.length - 1].type === 'end');
    t.ok(tag + ': boss comes before end',
        bosses.length && ends.length && bosses[0].atX <= ends[0].atX);

    for (const tr of triggers) {
        t.ok(tag + ': trigger type "' + tr.type + '" is known',
            TRIGGER_TYPES.includes(tr.type), 'at x=' + tr.atX);
    }

    // ── waves reference real formations, enemies, and stay in the band
    for (const tr of triggers) {
        if (tr.type !== 'wave') continue;
        t.ok(tag + '@' + tr.atX + ': formation "' + tr.formation + '" exists',
            FORMATION_NAMES.includes(tr.formation));
        // escort spawns its own carrier; its `enemy` names the guards.
        t.ok(tag + '@' + tr.atX + ': enemy "' + tr.enemy + '" exists',
            ENEMY_TYPES.includes(tr.enemy), 'enemy=' + tr.enemy);
        if (tr.y != null) {
            t.ok(tag + '@' + tr.atX + ': wave y is inside the playfield band',
                tr.y >= PLAY_MIN_Y && tr.y <= PLAY_MAX_Y, 'y=' + tr.y);
        }
        // bullet-speed fairness (F3), where a wave overrides it
        const bs = tr.params && tr.params.speed;
        if (bs != null) {
            t.ok(tag + '@' + tr.atX + ': bullet speed within the reactable cap (F3)',
                Math.abs(bs) <= MAX_BULLET_SPEED, 'speed=' + bs);
        }
    }

    // ── terrain chunks exist
    for (const ter of (lvl.terrain || [])) {
        t.ok(tag + ': terrain chunk "' + ter.chunk + '" exists',
            CHUNK_NAMES.includes(ter.chunk));
    }

    // ── pickups name a real kind
    for (const tr of triggers) {
        if (tr.type !== 'pickup') continue;
        t.ok(tag + '@' + tr.atX + ': pickup kind is shard|bit',
            tr.kind === 'shard' || tr.kind === 'bit', 'kind=' + tr.kind);
        if (tr.y != null) {
            t.ok(tag + '@' + tr.atX + ': pickup y inside the band',
                tr.y >= PLAY_MIN_Y && tr.y <= PLAY_MAX_Y);
        }
    }

    // ── F1: a recovery pickup within RECOVERY_WINDOW after every checkpoint
    const checkpoints = triggers.filter((x) => x.type === 'checkpoint');
    t.ok(tag + ': has at least one checkpoint', checkpoints.length >= 1);
    for (const cp of checkpoints) {
        const recovery = triggers.find((x) =>
            x.type === 'pickup' && x.recoveryOnly &&
            x.atX >= cp.atX && x.atX <= cp.atX + RECOVERY_WINDOW);
        t.ok(tag + '@' + cp.atX + ': recovery shard within ' + RECOVERY_WINDOW + 'u (F1)',
            !!recovery, recovery ? 'at x=' + recovery.atX : 'none');
    }

    // ── F2: no checkpoint within 10u of a lock trigger
    const locks = triggers.filter((x) => x.type === 'lock');
    for (const cp of checkpoints) {
        const near = locks.find((l) => Math.abs(l.atX - cp.atX) < 10);
        t.ok(tag + '@' + cp.atX + ': checkpoint is not adjacent to a lock (F2)',
            !near, near ? 'lock at x=' + near.atX : '');
    }

    // ── a lock must have waves after it to clear (else it hangs forever)
    for (const l of locks) {
        const wavesAfter = triggers.some((x) =>
            x.type === 'wave' && x.atX >= l.atX && x.atX < l.atX + 20);
        t.ok(tag + '@' + l.atX + ': lock is followed by waves to clear', wavesAfter);
    }

    // ── length covers the last trigger with room (§7)
    const lastX = triggers.length ? triggers[triggers.length - 1].atX : 0;
    t.ok(tag + ': length >= last trigger + 20', lvl.length >= lastX + 20,
        'length=' + lvl.length + ' lastX=' + lastX);

    // ── checkpoints array agrees with the checkpoint triggers
    const cpXs = checkpoints.map((c) => c.atX).sort((a, b) => a - b);
    const declared = (lvl.checkpoints || []).slice().sort((a, b) => a - b);
    t.ok(tag + ': checkpoints[] matches checkpoint triggers',
        JSON.stringify(cpXs) === JSON.stringify(declared),
        'triggers=' + JSON.stringify(cpXs) + ' declared=' + JSON.stringify(declared));
}

export function run(t) {
    for (const lvl of LEVELS) lintLevel(t, lvl);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('stagelint');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

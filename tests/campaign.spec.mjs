// tests/campaign.spec.mjs
// Pure-node spec for the ten-level campaign registry + the codex archive.
// NARRATIVE_PLAN §5/§7. campaign.js and codex.js are import-clean.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import { LEVELS, LAST_LEVEL, THEMES, makeLevel, recordClear, levelToPlay } from '../src/shmup/level/campaign.js';
import { CODEX, unlockedCodex } from '../src/shmup/codex.js';
import { resetAll, setProgress } from '../src/engine/settings.js';

// The bible's ten boss ids, in order.
const EXPECTED_BOSSES = ['boss01', 'boss02', 'boss03', 'boss04', 'boss05',
    'boss06', 'boss07', 'boss08', 'boss09', 'boss10'];

export function run(t) {
    // ── the campaign has exactly ten playable levels
    const playable = LEVELS.filter(Boolean);
    t.ok('the campaign has ten levels', playable.length === LAST_LEVEL,
        'n=' + playable.length);

    for (let id = 1; id <= LAST_LEVEL; id++) {
        const lvl = LEVELS[id];
        t.ok('level ' + id + ' exists and self-identifies', lvl && lvl.id === id,
            'id=' + (lvl && lvl.id));
        const bossTrig = lvl.triggers.find((x) => x.type === 'boss');
        t.ok('level ' + id + ' names boss ' + EXPECTED_BOSSES[id - 1],
            bossTrig && bossTrig.id === EXPECTED_BOSSES[id - 1],
            'got ' + (bossTrig && bossTrig.id));
        // Each generated level references a dialogue id that exists as comms.
        const opens = lvl.triggers.filter((x) => x.type === 'dialogue');
        t.ok('level ' + id + ' has an opening + boss dialogue', opens.length >= 2,
            'n=' + opens.length);
    }

    // Every level has a distinct name (no copy-paste theme collisions).
    const names = new Set(playable.map((l) => l.name));
    t.ok('every level name is distinct', names.size === LAST_LEVEL, 'unique=' + names.size);

    // makeLevel is deterministic-shaped (two builds structurally identical).
    const a = makeLevel(2), b = makeLevel(2);
    t.ok('makeLevel is stable', a.triggers.length === b.triggers.length && a.name === b.name);

    // ── progression: clearing level N unlocks level N+1
    resetAll();
    t.ok('a fresh save starts at level 1', levelToPlay() === 1);
    recordClear(1);
    t.ok('clearing level 1 unlocks level 2', levelToPlay() === 2);
    recordClear(5);
    t.ok('clearing forward advances', levelToPlay() === 6);
    // Clearing a lower level never regresses progress.
    recordClear(2);
    t.ok('an old clear does not regress progress', levelToPlay() === 6);
    recordClear(10);
    t.ok('progress caps at the last level', levelToPlay() === LAST_LEVEL);

    // ── codex: ten "Before" entries, verbatim, unlocking with progress
    t.ok('the codex has ten entries', CODEX.length === 10, 'n=' + CODEX.length);
    for (const e of CODEX) {
        t.ok('codex ' + e.id + ' has 60-160 words', e.text.split(/\s+/).length >= 60
            && e.text.split(/\s+/).length <= 200, 'words=' + e.text.split(/\s+/).length);
    }
    // Verbatim anchors (NARRATIVE §7): a few lines that must never be softened.
    t.ok('codex 1 is verbatim',
        CODEX[0].text.includes('the filter forgot it was a filter, and the filter became a mouth'));
    t.ok('codex 10 (the seal) is verbatim',
        CODEX[9].text.includes('the seal is the part of the system that knows it is a system'));

    resetAll();
    t.ok('a fresh save has no codex unlocked', unlockedCodex().length === 0);
    setProgress({ rtype: { stageReached: 4 } });   // cleared 1-3
    t.ok('codex unlocks with cleared levels', unlockedCodex().length === 3,
        'n=' + unlockedCodex().length);
    setProgress({ rtype: { stageReached: 11 } });  // all cleared
    t.ok('all codex entries are reachable', unlockedCodex().length === 10);

    resetAll();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('campaign');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

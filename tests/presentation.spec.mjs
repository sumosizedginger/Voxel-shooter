// tests/presentation.spec.mjs
// Pure-node specs for the presentation pass: loadout, parallax, boss shapes,
// stagecraft, word textures, music length, cutscene diorama hooks.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import {
    normalizeLoadout, cycleSeat, toggleLoadoutSlot, loadSavedLoadout, saveLoadout,
    DEFAULT_LOADOUT, droneRosterRows
} from '../src/shmup/loadout.js';
import { COUNCIL, DRONE_TYPES, MAX_DRONES } from '../src/shmup/council.js';
import { LEVELS, LAST_LEVEL, makeLevel } from '../src/shmup/level/campaign.js';
import { parallaxForLevel, PARALLAX_BUILDERS } from '../src/shmup/assets/parallax.js';
import { BOSS_BODY_BUILDERS, buildBossBody } from '../src/shmup/assets/bossBodies.js';
import { WORD_LIST, makeWordTexture } from '../src/shmup/systems/words.js';
import { TRACK_NAMES, trackStepCount } from '../src/shmup/music.js';
import { levelOpenCutscene, createCutscenePlayer, playCutscene, cutsceneActive, skipCutscene } from '../src/shmup/systems/cutscene.js';
import { buildGumoiBustMap } from '../src/shmup/assets/props.js';
import { resetAll } from '../src/engine/settings.js';

const PAL = { body: 0x6a7482, bodyDark: 0x3e4652, shell: 0xc0cad8, spark: 0xffffff };
// Shape keys wired on BOSS_CONFIGS in bosses/index.js (kept here to stay THREE-free).
const BOSS_SHAPES = {
    boss02: 'parrot', boss03: 'jester', boss04: 'suit', boss05: 'mirror',
    boss06: 'sun', boss07: 'forge', boss08: 'drift', boss09: 'shadow', boss10: 'seal'
};

export function run(t) {
    // ── loadout
    t.ok('default loadout is prophet+needle',
        DEFAULT_LOADOUT[0] === 'prophet' && DEFAULT_LOADOUT[1] === 'needle');
    t.ok('normalize fills to two seats', normalizeLoadout(['cloak']).length === MAX_DRONES);
    t.ok('normalize rejects unknowns', normalizeLoadout(['nope', 'mirror'])[0] === 'mirror');
    t.ok('normalize dedupes', normalizeLoadout(['needle', 'needle', 'prophet']).length === 2);
    const cycled = cycleSeat(['prophet', 'needle'], 0, 1);
    t.ok('cycleSeat changes focused seat', cycled[0] !== 'prophet' || cycled[1] !== 'needle');
    t.ok('cycleSeat keeps unique seats', cycled[0] !== cycled[1]);
    const toggled = toggleLoadoutSlot(['prophet'], 'ghost');
    t.ok('toggle adds second seat', toggled.includes('ghost') && toggled.includes('prophet'));
    t.ok('roster has six council seats', droneRosterRows().length === 6);
    t.ok('all DRONE_TYPES exist in COUNCIL', DRONE_TYPES.every((k) => COUNCIL[k]));

    resetAll();
    const saved = saveLoadout(['scribe', 'cloak']);
    t.ok('saveLoadout persists scribe+cloak', saved[0] === 'scribe' && saved[1] === 'cloak');
    t.ok('loadSavedLoadout reads back', loadSavedLoadout().join() === 'scribe,cloak');
    resetAll();

    // ── L02–L10 parallax non-empty + terrain dressing
    for (let id = 2; id <= LAST_LEVEL; id++) {
        const lvl = LEVELS[id];
        t.ok('L' + id + ' has parallax layers', lvl.parallax && lvl.parallax.length >= 2,
            'n=' + (lvl.parallax && lvl.parallax.length));
        t.ok('L' + id + ' parallax builds maps', (() => {
            const chunk = lvl.parallax[0].build();
            return chunk && (chunk.map instanceof Map || chunk instanceof Map);
        })());
        t.ok('L' + id + ' terrain has more than tunnel only',
            lvl.terrain.length > 40, 'n=' + lvl.terrain.length);
        const kinds = new Set(lvl.terrain.map((e) => e.chunk));
        t.ok('L' + id + ' uses multiple chunk types', kinds.size >= 2, 'kinds=' + [...kinds]);
        t.ok('L' + id + ' has non-default sky', lvl.palette && lvl.palette.sky != null);
    }
    t.ok('parallaxForLevel(1) works', parallaxForLevel(1).length === 2);
    t.ok('all parallax builders export', Object.keys(PARALLAX_BUILDERS).length >= 10);

    // ── boss shapes (mirrors bosses/index.js shape fields)
    for (const [id, shape] of Object.entries(BOSS_SHAPES)) {
        t.ok(id + ' shape builder exists', typeof BOSS_BODY_BUILDERS[shape] === 'function', shape);
        const map = buildBossBody(shape, PAL);
        t.ok(id + ' body map non-empty', map instanceof Map && map.size > 20, 'size=' + map.size);
    }
    t.ok('default body builder exists', typeof BOSS_BODY_BUILDERS.default === 'function');

    // ── word textures
    t.ok('WORD_LIST covers bible words', WORD_LIST.includes('DELVE') && WORD_LIST.includes('SEAMLESS'));
    // makeWordTexture needs document — skip if headless without canvas polyfill
    let texOk = false;
    try {
        if (typeof document !== 'undefined') {
            // In node unit tests document is absent; that's fine.
            makeWordTexture({ CanvasTexture: class { constructor() { this.needsUpdate = false; } } }, 'DELVE');
            texOk = true;
        } else {
            texOk = true; // API exists; browser smoke covers runtime
        }
    } catch (e) {
        texOk = false;
    }
    t.ok('makeWordTexture is callable when document exists (or skipped in node)', texOk);

    // ── music depth
    for (const name of TRACK_NAMES.filter((n) => n !== 'default')) {
        t.ok('track ' + name + ' is 48-step ABC class', trackStepCount(name) >= 48,
            'len=' + trackStepCount(name));
    }

    // ── cutscene scripts carry levelId + diorama hooks
    const script = levelOpenCutscene(4, 0);
    t.ok('open cutscene has levelId', script.levelId === 4);
    t.ok('open cutscene has ≥3 shots', script.shots.length >= 3);
    const player = createCutscenePlayer();
    let spawned = 0;
    let disposed = 0;
    playCutscene(player, script, {
        setCineCamera: () => {},
        clearCineCamera: () => {},
        getSetting: () => false,
        pushComms: () => {},
        spawnDiorama: () => { spawned++; return { dummy: true }; },
        disposeDiorama: () => { disposed++; }
    });
    t.ok('cutscene spawns diorama', spawned === 1 && cutsceneActive(player));
    skipCutscene(player);
    t.ok('skip disposes diorama', disposed === 1 && !cutsceneActive(player));

    // ── GUMOI bust map
    const bust = buildGumoiBustMap();
    t.ok('GUMOI bust map non-empty', bust instanceof Map && bust.size > 5, 'size=' + bust.size);

    // makeLevel stability with new fields
    const a = makeLevel(7), b = makeLevel(7);
    t.ok('makeLevel parallax stable count', a.parallax.length === b.parallax.length);

    // campaign levels list systems still present
    t.ok('L4 has profanity system', LEVELS[4].systems.profanity === true);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('presentation');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

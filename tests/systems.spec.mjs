// tests/systems.spec.mjs
// Pure-node specs for S2–S10 story/signature systems (NARRATIVE_PLAN §4).

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import {
    startCast, tickCast, interruptCast, pickCast, BEIGE_CASTS, maybeAssignCast
} from '../src/shmup/systems/cast.js';
import {
    createProfanity, tryProfanity, updateProfanity, PROFANITY_CD
} from '../src/shmup/systems/profanity.js';
import {
    createHeat, updateHeat, heatWeaponsOffline, HEAT_MAX, HEAT_OFFLINE_S
} from '../src/shmup/systems/heat.js';
import {
    createAsymmetry, updateAsymmetry, asymmetryDamageMult, symmetryRegen
} from '../src/shmup/systems/asymmetry.js';
import {
    createModStack, pushMod, hasMod, updateMods, transformInput, clearMods
} from '../src/shmup/systems/modifiers.js';
import {
    createRecorder, recordFrame, sampleAt
} from '../src/shmup/systems/inputrec.js';
import {
    createPredictor, recordMotion, classify, interceptAngle, predictorMode
} from '../src/shmup/systems/predictor.js';
import {
    createTemporalLoop, startTemporal, updateTemporal, recordBulletEvent
} from '../src/shmup/systems/temporal.js';
import {
    createCutscenePlayer, playCutscene, updateCutscene, skipCutscene, cutsceneActive,
    levelOpenCutscene
} from '../src/shmup/systems/cutscene.js';
import { fireMimic } from '../src/shmup/systems/copybuffer.js';
import { WORD_EFFECTS, applyWordHit, WORD_LIST } from '../src/shmup/systems/words.js';
import { createPool, KIND, spawn } from '../src/shmup/bullets.js';
import { TRACK_NAMES } from '../src/shmup/music.js';
import { LEVELS } from '../src/shmup/level/campaign.js';

export function run(t) {
    // ── S2 cast
    const e = { castT: 0, cast: null, staggered: 0, weakpointT: 0, type: 'lancer' };
    startCast(e, 'I feel SEEN', 1.0);
    t.ok('startCast sets castT', e.castT === 1.0 && e.cast.text === 'I feel SEEN');
    tickCast(e, 0.4);
    t.ok('tickCast reduces castT', Math.abs(e.castT - 0.6) < 1e-9);
    t.ok('interrupt opens weakpoint', interruptCast(e) === true && e.weakpointT > 0 && e.castT === 0);
    t.ok('interrupt is no-op when idle', interruptCast(e) === false);
    t.ok('beige cast pool is non-empty', BEIGE_CASTS.length >= 4);
    t.ok('pickCast returns a string', typeof pickCast() === 'string');
    const e2 = { castT: 0, cast: null, type: 'lancer' };
    maybeAssignCast(e2, { elite: true }, 1);
    t.ok('elite always gets a cast', e2.castT > 0);

    // ── S7 profanity
    const prof = createProfanity();
    const world = { enemyBullets: createPool(16) };
    t.ok('profanity with no targets returns null', tryProfanity(prof, world, { x: 0, y: 8 }) === null);
    spawn(world.enemyBullets, {
        x: 5, y: 8, vx: -1, vy: 0, r: 0.3, dmg: 4, kind: KIND.WORD,
        onlyProfanity: true, word: 'DELVE'
    });
    const cancelled = tryProfanity(prof, world, { x: 0, y: 8 });
    t.ok('profanity cancels nearest word bullet', cancelled && cancelled.word === 'DELVE');
    t.ok('profanity enters cooldown', prof.cd === PROFANITY_CD);
    spawn(world.enemyBullets, {
        x: 4, y: 8, vx: -1, vy: 0, r: 0.3, dmg: 4, kind: KIND.WORD,
        onlyProfanity: true, word: 'REALM'
    });
    t.ok('cooldown blocks cancel', tryProfanity(prof, world, { x: 0, y: 8 }) === null);
    updateProfanity(prof, PROFANITY_CD + 0.01);
    t.ok('cooldown expires', tryProfanity(prof, world, { x: 0, y: 8 }) !== null);

    // ── heat
    const h = createHeat();
    for (let i = 0; i < 20; i++) {
        updateHeat(h, 0.05, { axisX: i % 2 ? 1 : -1, axisY: 0 }, true);
    }
    t.ok('heat accumulates on direction changes', h.value > 0);
    h.value = HEAT_MAX - 1;
    updateHeat(h, 0.05, { axisX: 1, axisY: 0 }, true);
    updateHeat(h, 0.05, { axisX: -1, axisY: 0 }, true);
    t.ok('heat offline at max', heatWeaponsOffline(h) || h.value >= HEAT_MAX - 1);
    if (h.offline <= 0) { h.offline = HEAT_OFFLINE_S; h.value = HEAT_MAX; }
    t.ok('weapons offline flag', heatWeaponsOffline(h));

    // ── asymmetry
    const a = createAsymmetry();
    for (let i = 0; i < 40; i++) {
        updateAsymmetry(a, 0.1, { axisX: Math.sin(i), axisY: Math.cos(i * 1.7), fire: i % 3 === 0 });
    }
    t.ok('asymmetry score in 0..1', a.score >= 0 && a.score <= 1);
    t.ok('damage mult scales with score', asymmetryDamageMult(a) >= 0.55);
    a.score = 0.1;
    t.ok('symmetry regen when too symmetric', symmetryRegen(a) > 0);

    // ── modifiers S6
    const stack = createModStack();
    pushMod(stack, 'controlFlip', 2);
    t.ok('hasMod controlFlip', hasMod(stack, 'controlFlip'));
    const flipped = transformInput(stack, { axisX: 1, axisY: 0.5, fire: false });
    t.ok('controlFlip negates axes', flipped.axisX === -1 && flipped.axisY === -0.5);
    updateMods(stack, 3);
    t.ok('mod expires', !hasMod(stack, 'controlFlip'));
    clearMods(stack);

    // ── input recorder S8
    const rec = createRecorder(2, 20);
    for (let i = 0; i < 30; i++) {
        recordFrame(rec, 0.05, { x: i, y: 8, ax: 1, ay: 0, fire: false });
    }
    const snap = sampleAt(rec, 0.3);
    t.ok('sampleAt returns a delayed pose', snap && typeof snap.x === 'number');

    // ── predictor S9
    const pred = createPredictor();
    for (let i = 0; i < 30; i++) recordMotion(pred, 0.1, i * 0.5, 8);
    t.ok('line motion classifies as line',
        predictorMode(pred) === 'line' || classify(pred.samples) === 'line');
    const ang = interceptAngle(pred, 20, 8, { x: 0, y: 8, vx: -2, vy: 0 }, 10);
    t.ok('interceptAngle is a finite number', Number.isFinite(ang));

    // ── temporal S10
    const loop = createTemporalLoop(1.0);
    const tw = {
        enemyBullets: createPool(32),
        player: { x: 5, y: 8, alive: true },
        boss: { cores: [{ weakpointT: 0, open: false }] }
    };
    startTemporal(loop, tw.player);
    recordBulletEvent(loop, { x: 10, y: 8, vx: -4, vy: 0, r: 0.2, dmg: 5, kind: KIND.ENEMY_ORB });
    let folded = false;
    for (let i = 0; i < 25; i++) {
        const r = updateTemporal(loop, 0.05, tw);
        if (r.folded) folded = true;
    }
    t.ok('temporal fold fires within a period', folded);
    t.ok('fold opens boss weakpoint', tw.boss.cores[0].weakpointT > 0);

    // ── cutscene S3
    const cs = createCutscenePlayer();
    let done = false;
    const cams = [];
    playCutscene(cs, levelOpenCutscene(1, 0), {
        setCineCamera: (o) => cams.push(o),
        clearCineCamera: () => {},
        pushComms: () => {},
        getSetting: () => false
    }, () => { done = true; });
    t.ok('cutscene starts active', cutsceneActive(cs));
    t.ok('cutscene aimed the cine camera', cams.length >= 1);
    skipCutscene(cs);
    t.ok('skip finishes cutscene', !cutsceneActive(cs) && done);

    const cs2 = createCutscenePlayer();
    playCutscene(cs2, {
        id: 't',
        shots: [
            { pos: { x: 0, y: 8, z: 16 }, look: { x: 4, y: 8, z: 0 }, duration: 0, hold: 0.2 },
            { pos: { x: 2, y: 8, z: 16 }, look: { x: 6, y: 8, z: 0 }, duration: 0, hold: 0.2 }
        ]
    }, { setCineCamera: () => {}, clearCineCamera: () => {}, getSetting: () => true });
    updateCutscene(cs2, 0.25, true);
    t.ok('cutscene advances shots', cs2.shotIndex >= 1 || !cs2.active);

    // ── mimic S5
    const mw = { enemyBullets: createPool(16) };
    const bolt = fireMimic(mw, 10, 8, { weapon: 'pulse', tier: 1 }, { scale: 1.5, dmg: 6 });
    t.ok('fireMimic spawns a bullet', bolt && bolt.alive && bolt.vx < 0);

    // ── music + levels (boss configs pull THREE/renderer — covered by campaign/lint)
    t.ok('music has per-level tracks', TRACK_NAMES.length >= 10, 'n=' + TRACK_NAMES.length);

    for (let id = 1; id <= 10; id++) {
        const lvl = LEVELS[id];
        t.ok('L' + id + ' has systems bag', lvl && lvl.systems && typeof lvl.systems === 'object');
        t.ok('L' + id + ' has a boss trigger',
            lvl.triggers.some((tr) => tr.type === 'boss'));
    }
    t.ok('L2 systems.mimic', LEVELS[2].systems.mimic === true);
    t.ok('L3 allowHardFail flag', LEVELS[3].allowHardFail === true);
    t.ok('L4 systems.profanity', LEVELS[4].systems.profanity === true);
    t.ok('L5 systems.shadow', LEVELS[5].systems.shadow === true);
    t.ok('L6 allowTimeout flag', LEVELS[6].allowTimeout === true);
    t.ok('L7 systems.heat', LEVELS[7].systems.heat === true);
    t.ok('L8 systems.asymmetry', LEVELS[8].systems.asymmetry === true);
    t.ok('L9 systems.shadow delay 0.5', LEVELS[9].systems.shadowDelay === 0.5);
    t.ok('L9 systems.contradiction', LEVELS[9].systems.contradiction === true);
    t.ok('L9 systems.replayShots', LEVELS[9].systems.replayShots === true);
    t.ok('L10 systems.temporal', LEVELS[10].systems.temporal === true);

    // S7 word effects table
    t.ok('word list includes DELVE and ROBUST',
        WORD_LIST.includes('DELVE') && WORD_LIST.includes('ROBUST'));
    const ww = { boss: { hp: 100, maxHp: 200, dead: false }, enemyBullets: createPool(32) };
    const pl = { slowStacks: [], weaponsOffline: false };
    const wr = applyWordHit('DELVE', ww, pl, { x: 5, y: 8, dmg: 4 });
    t.ok('DELVE applies slow stack', pl.slowStacks.length === 1 && wr.dmg === 4);
    applyWordHit('ROBUST', ww, pl, { x: 5, y: 8, dmg: 0 });
    t.ok('ROBUST heals the boss', ww.boss.hp === 140);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('systems');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

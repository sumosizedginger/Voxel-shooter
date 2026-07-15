// src/shmup\systems\cutscene.js
// Purpose: S3 cutscene player — data scripts (shots + line ids) drive the cine
// camera rig and the S1 comms box. Skippable; honors reduceMotion via duration 0.
// Dependencies: none for data; host injects setCineCamera / pushComms / settings
//
// NARRATIVE_PLAN §4 S3.

/**
 * @typedef {{ pos:{x,y,z}, look:{x,y,z}, duration?:number, roll?:number, hold?:number, lines?:string, lineId?:string }} Shot
 * @typedef {{ id:string, shots:Shot[] }} CutsceneScript
 */

export function createCutscenePlayer() {
    return {
        active: false,
        script: null,
        shotIndex: 0,
        holdT: 0,
        waitingLines: false,
        onDone: null,
        diorama: null,
        levelId: 0
    };
}

/**
 * @param {object} player createCutscenePlayer()
 * @param {CutsceneScript} script
 * @param {object} host { setCineCamera, clearCineCamera?, pushComms, getSetting, reduceMotion? }
 * @param {()=>void} [onDone]
 */
export function playCutscene(player, script, host, onDone = null) {
    if (!player || !script || !script.shots || !script.shots.length) {
        if (onDone) onDone();
        return;
    }
    player.active = true;
    player.script = script;
    player.shotIndex = 0;
    player.holdT = 0;
    player.waitingLines = false;
    player.onDone = onDone;
    player.host = host;
    player.levelId = (script && script.levelId) || 0;
    // Optional voxel diorama (GUMOI bust + stage prop). Host injects builders
    // so this module stays THREE-free and unit-testable.
    clearDiorama(player);
    if (host && host.spawnDiorama && !reduce(host)) {
        try {
            const mode = (script && script.dioramaMode) || 'open';
            player.diorama = host.spawnDiorama(player.levelId, script.scrollX || 0, { mode });
        } catch (e) {
            player.diorama = null;
        }
    }
    applyShot(player, script.shots[0]);
}

function clearDiorama(player) {
    if (!player) return;
    const host = player.host;
    if (player.diorama && host && host.disposeDiorama) {
        try { host.disposeDiorama(player.diorama); } catch (e) { /* ignore */ }
    }
    player.diorama = null;
}

function reduce(host) {
    if (host.reduceMotion != null) return !!host.reduceMotion;
    if (host.getSetting) return !!host.getSetting('reduceMotion');
    return false;
}

function applyShot(player, shot) {
    const host = player.host;
    const instant = reduce(host);
    const dur = instant ? 0 : (shot.duration != null ? shot.duration : 0.8);
    if (host.setCineCamera) {
        host.setCineCamera({
            pos: shot.pos,
            look: shot.look,
            duration: dur,
            roll: shot.roll || 0
        });
    }
    player.holdT = shot.hold != null ? shot.hold : 2.2;
    player.waitingLines = false;
    if (shot.lineId && host.pushComms) {
        host.pushComms(shot.lineId);
        player.waitingLines = true;
    } else if (shot.lines && host.pushComms) {
        host.pushComms(shot.lines);
        player.waitingLines = true;
    }
}

/**
 * @returns {boolean} true while still playing
 */
export function updateCutscene(player, dt, commsEmpty = true) {
    if (!player || !player.active) return false;
    // Wait for comms queue to drain if this shot pushed lines — but still
    // count hold so a stuck queue can't freeze forever.
    if (player.waitingLines && !commsEmpty) {
        player.holdT -= dt * 0.25;   // slow bleed while lines play
    } else {
        player.holdT -= dt;
    }
    if (player.holdT > 0) return true;

    player.shotIndex++;
    if (player.shotIndex >= player.script.shots.length) {
        finish(player);
        return false;
    }
    applyShot(player, player.script.shots[player.shotIndex]);
    return true;
}

export function skipCutscene(player) {
    if (!player || !player.active) return;
    finish(player);
}

function finish(player) {
    player.active = false;
    clearDiorama(player);
    if (player.host && player.host.clearCineCamera) player.host.clearCineCamera();
    const cb = player.onDone;
    player.onDone = null;
    player.script = null;
    if (cb) cb();
}

export function cutsceneActive(player) {
    return !!(player && player.active);
}

/** Longer holds where bible needs weight (L1 introduce, L6 sun, L10 seal). */
function weightHold(levelId, base) {
    if (levelId === 1 || levelId === 6 || levelId === 10) return base + 1.4;
    if (levelId === 9) return base + 0.6;
    return base;
}

/** Built-in scripts for each level open (cine + line id + diorama kit). */
export function levelOpenCutscene(levelId, scrollX = 0) {
    const x = scrollX;
    const id = levelId < 10 ? 'L0' + levelId + '_open' : 'L' + levelId + '_open';
    // Slight per-level framing so stages don't share one identical open.
    const zNear = 15 + (levelId % 3);
    const yHigh = 9 + (levelId % 2);
    return {
        id: 'open_' + levelId,
        levelId,
        scrollX: x,
        dioramaMode: 'open',
        shots: [
            {
                // Establish: GUMOI bust + stage silhouette + boss ghost.
                pos: { x: x - 3, y: yHigh + 1, z: zNear },
                look: { x: x + 4, y: 8, z: 0 },
                duration: 1.0,
                hold: weightHold(levelId, 0.7),
                roll: levelId === 3 ? 0.04 : 0
            },
            {
                // Push in on the tunnel mouth / boss stage suggestion.
                pos: { x: x + 2, y: 8, z: 13 },
                look: { x: x + 11, y: 8, z: -1 },
                duration: 1.15,
                hold: weightHold(levelId, 3.5),
                lineId: id
            },
            {
                // Settle into play camera.
                pos: { x: x, y: 8, z: 19.5 },
                look: { x: x, y: 8, z: 0 },
                duration: 0.9,
                hold: 0.4
            }
        ]
    };
}

/** Boss-entry cutscene kit (GUMOI + boss silhouette + prop). */
export function levelBossCutscene(levelId, scrollX = 0) {
    const x = scrollX;
    const id = levelId < 10 ? 'L0' + levelId + '_boss' : 'L' + levelId + '_boss';
    return {
        id: 'boss_' + levelId,
        levelId,
        scrollX: x,
        dioramaMode: 'boss',
        shots: [
            {
                pos: { x: x + 4, y: 9, z: 14 },
                look: { x: x + 10, y: 8, z: 0 },
                duration: 0.9,
                hold: weightHold(levelId, 0.6)
            },
            {
                pos: { x: x + 6, y: 8, z: 12 },
                look: { x: x + 12, y: 8, z: -1 },
                duration: 1.0,
                hold: weightHold(levelId, 3.2),
                lineId: id
            },
            {
                pos: { x: x, y: 8, z: 19.5 },
                look: { x: x, y: 8, z: 0 },
                duration: 0.7,
                hold: 0.3
            }
        ]
    };
}

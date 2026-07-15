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
        onDone: null
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
    applyShot(player, script.shots[0]);
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
    if (player.host && player.host.clearCineCamera) player.host.clearCineCamera();
    const cb = player.onDone;
    player.onDone = null;
    player.script = null;
    if (cb) cb();
}

export function cutsceneActive(player) {
    return !!(player && player.active);
}

/** Built-in scripts for each level open (cine + line id). */
export function levelOpenCutscene(levelId, scrollX = 0) {
    const x = scrollX;
    const id = levelId < 10 ? 'L0' + levelId + '_open' : 'L' + levelId + '_open';
    return {
        id: 'open_' + levelId,
        shots: [
            {
                pos: { x: x - 4, y: 10, z: 16 },
                look: { x: x + 6, y: 8, z: 0 },
                duration: 1.0,
                hold: 0.6,
                roll: 0
            },
            {
                pos: { x: x + 2, y: 8, z: 14 },
                look: { x: x + 10, y: 8, z: 0 },
                duration: 1.2,
                hold: 3.5,
                lineId: id
            },
            {
                pos: { x: x, y: 8, z: 19.5 },
                look: { x: x, y: 8, z: 0 },
                duration: 0.9,
                hold: 0.4
            }
        ]
    };
}

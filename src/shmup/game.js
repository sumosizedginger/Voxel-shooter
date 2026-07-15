// src/shmup/game.js
// Purpose: the game shell — state machine, main loop, and the shared `world`.
// Dependencies: engine/*, ./input, ./camera, ./player, ./bullets, ./enemies, ./fx
//
// PLAN.md Phase 0-2. Every gameplay system hangs off `world` (src/context.js);
// nothing reaches through `window`.

import * as THREE from 'three';
import { scene, camera, renderer, composer, onResize } from '../engine/renderer.js';
import { updateShadowFollow } from '../engine/lights.js';
import { initShmupLights } from './lighting.js';
import { ParticleSystem } from '../engine/particles.js';
import { initQuality } from '../engine/quality.js';
import { initAudio } from '../audio/synth.js';
import { world } from '../context.js';
import { input, initInput, updateInput, consumeAnyKey } from './input.js';
import {
    updateShmupCamera, setScrollX, playerBounds, spawnX, despawnX,
    scrollX, PLAY_Y, PLAY_MIN_Y, PLAY_MAX_Y, clearShake, shakeCamera
} from './camera.js';
import { Terrain } from './terrain.js';
import { createLevelRunner, tickLevelRunner, disposeLevelRunner, levelTimeline } from './level/runner.js';
import { levelProgress } from './level/director.js';
import { createPool, updateBullets, collideBullets, clearPool, firstHit, kill } from './bullets.js';
import { BulletRenderer } from './bulletmesh.js';
import {
    createPlayer, updatePlayer, damagePlayer, killPlayer, respawnPlayer, setPulseShake
} from './player.js';
import {
    initEnemies, createEnemyPool, spawnEnemy, updateEnemies, damageEnemy,
    clearEnemies
} from './enemies/index.js';
import { circleHit } from './bullets.js';
import { initFx, updateFx, clearFx, sparkHit } from './fx.js';
import { sfx } from './sfx.js';
import { createWitness, updateWitness, orphanWitness, recallWitness } from './force.js';
import { createDrones, equipDrones, updateDrones, refreshPerLife } from './drones.js';
import { createPickups, updatePickups, clearPickups, clearBits } from './powerups.js';
import { applySlug, decayStacks } from './hammer.js';
import { tierProgress as pulseTierProgress } from './wavecannon.js';
import {
    createBoss, updateBoss, hitBossPart, applySlowShot, disposeBoss
} from './bosses/index.js';
import { LEVELS, LAST_LEVEL, levelToPlay, recordClear } from './level/campaign.js';
import { unlockedCodex } from './codex.js';
import { getSetting, setSetting, getScores, addScore, onSettingChange } from '../engine/settings.js';
import { setQuality } from '../engine/quality.js';
import { playTone, setVolumes } from '../audio/synth.js';
import { initMusic, playTrack, stopMusic, setMusicEnabled, updateMusic } from './music.js';
import {
    createComms, pushComms, pushRandom, clearComms, updateComms,
    DEATH_LINES, VICTORY_LINES
} from './comms.js';

export const STATE = {
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    DEATH: 'DEATH',
    RESPAWN: 'RESPAWN',
    GAMEOVER: 'GAMEOVER'
};

const START_LIVES = 3;
const DIFFICULTIES = ['easy', 'normal', 'hard'];

// Menu edge detection: the movement axis is analog, so latch it into discrete
// left/right ticks for the title + game-over menus.
let _menuAxisLatched = false;
function menuTick() {
    const ax = input.axisX;
    let dir = 0;
    if (Math.abs(ax) > 0.5) {
        if (!_menuAxisLatched) { dir = Math.sign(ax); _menuAxisLatched = true; }
    } else {
        _menuAxisLatched = false;
    }
    return dir;
}
const DEATH_HOLD_S = 1.4;      // the slow beat before the world restarts

let state = STATE.TITLE;
let prevState = STATE.TITLE;
let clock = null;
let particles = null;
let bulletFx = null;
let player = null;
let debugOn = false;
let elapsed = 0;
let stateT = 0;
let dom = {};

export function getState() { return state; }

function setState(next) {
    if (state === next) return;
    state = next;
    stateT = 0;
    world.state = next;
    // Music follows state: it plays through the fight, mutes on pause (so the
    // playhead survives), and stops on the menus.
    setMusicEnabled(next === STATE.PLAYING || next === STATE.DEATH);
    if (next === STATE.TITLE || next === STATE.GAMEOVER) stopMusic();
    renderOverlay();
}

// ── the active level runner (built at boot from LEVEL01) ────────────────────
let runner = null;

// ── debug: draw the collision boxes. The whole point of Phase 3 is that these
//    line up with the art, and the only way to know is to look at them.
let boxWires = null;
function updateTerrainWires() {
    if (!boxWires) {
        boxWires = new THREE.Group();
        boxWires.visible = false;
        scene.add(boxWires);
    }
    boxWires.visible = debugOn;
    if (!debugOn || !world.terrain) return;

    const boxes = world.terrain.boxes;
    while (boxWires.children.length < boxes.length) {
        const w = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({ color: 0x7CFFB0 })
        );
        boxWires.add(w);
    }
    for (let i = 0; i < boxWires.children.length; i++) {
        const w = boxWires.children[i];
        const b = boxes[i];
        if (!b) { w.visible = false; continue; }
        w.visible = true;
        w.scale.set(b.maxX - b.minX, b.maxY - b.minY, 1);
        w.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0.6);
    }
}

// ── collisions ─────────────────────────────────────────────────────────────
function resolveCollisions(dt) {
    const p = world.player;

    // player shots -> enemies
    collideBullets(world.bullets, world.enemies.items, (b, e) => {
        let dmg = b.dmg;
        // A Hammer slug staggers on the third hit (bible §03). The stagger IS
        // the reward — it's what opens the weakpoint window.
        if (b.isSlug) {
            if (applySlug(e)) sfx.hammerStagger();
            e.x += b.knockback || 0;                  // "small but consistent"
        }
        // The violet weakpoint (C7): interrupted casts and Scribe marks both
        // open one, and it takes triple damage (bible §04).
        if (e.weakpointT > 0 || e.marked > 0) dmg *= 3;
        // Tier-3 Pulse and the level-3 Witness stab break guards.
        if (b.breaksGuard) e.guardBroken = true;
        damageEnemy(world.enemies, e, dmg, world);
    });

    // player shots -> boss mouths (a separate target list so the boss parts
    // never touch the enemy pool's live-count; §Phase 6).
    if (world.boss && !world.boss.dead) {
        collideBullets(world.bullets, world.boss.mouths, (b, mouth) => {
            hitBossPart(mouth, b.dmg, world);
        });
    }

    if (!p.alive) return;

    // enemy shots -> the Vessel (CHIP damage, C2)
    const hit = firstHit(world.enemyBullets, p.x, p.y, p.r);
    if (hit && p.invuln <= 0) {
        sparkHit(hit.x, hit.y, 0xff80d0);
        // A completed announcement's slow-shot stacks a slow (bible §04) as well
        // as chipping — that's what makes interrupting them matter.
        if (hit.isSlowShot) applySlowShot(world);
        kill(world.enemyBullets, hit);
        damagePlayer(p, hit.dmg, world);
    }

    if (!p.alive) return;

    // enemy BODIES -> the Vessel (lethal, C2)
    for (const e of world.enemies.items) {
        if (!e.alive || !e.contactKills) continue;
        if (circleHit(p.x, p.y, p.r, e.x, e.y, e.r)) {
            if (p.invuln > 0) break;
            killPlayer(p, world, true);
            break;
        }
    }

    if (!p.alive) return;

    // TERRAIN -> the Vessel (lethal, and the oldest rule in the genre).
    // An overlap test, never a slide: the wall does not push you, it ends you.
    if (world.terrain && p.invuln <= 0 && world.terrain.blocked(p.x, p.y, p.r)) {
        killPlayer(p, world, true);
    }
}

// ── DOM ────────────────────────────────────────────────────────────────────
function renderOverlay() {
    if (!dom.overlay) return;
    const show = state === STATE.TITLE || state === STATE.PAUSED
        || state === STATE.GAMEOVER || state === STATE_BETWEEN;
    dom.overlay.style.display = show ? 'flex' : 'none';
    // The BETWEEN is the non-dual white; every other overlay sits on the dark.
    dom.overlay.classList.toggle('white', state === STATE_BETWEEN);

    if (state === STATE_BETWEEN) {
        // The seal, clean. √π ∞ τ². It is the last frame of the game (bible §13).
        dom.overlayTitle.innerHTML = '<span class="seal">√π ∞ τ²</span>';
        dom.overlaySub.innerHTML = 'THE WITNESS IS THE SEAL<br><br>'
            + '<span class="dim">GUMOI: The Lattice Break</span><br>'
            + '<span class="dim">the recursion is both spiral and ascent</span><br><br>'
            + '<span class="dim">score ' + world.score + ' &middot; press any key</span>';
        return;
    }
    if (state === STATE.TITLE) {
        if (codexOpen) {
            const entries = unlockedCodex();
            const e = entries[Math.min(codexIndex, entries.length - 1)];
            dom.overlayTitle.textContent = 'CODEX';
            dom.overlaySub.innerHTML = e
                ? '<span class="sel">' + escapeHtml(e.title) + '</span>'
                    + ' <span class="dim">(' + (codexIndex + 1) + '/' + entries.length + ')</span><br><br>'
                    + '<span class="codexbody">' + escapeHtml(e.text) + '</span><br><br>'
                    + '<span class="dim">&larr;&rarr; browse &middot; drone key to close</span>'
                : '<span class="dim">no entries yet — clear a level</span>';
            return;
        }
        dom.overlayTitle.textContent = 'GUMOI';
        const diff = getSetting('difficulty');
        const row = DIFFICULTIES.map((d) =>
            (d === diff ? '<b class="sel">' + d.toUpperCase() + '</b>' : d.toUpperCase())
        ).join('   ');
        const hi = getScores()[0];
        const haveCodex = unlockedCodex().length > 0;
        dom.overlaySub.innerHTML =
            'THE LATTICE BREAK<br><br>'
            + '<span class="dim">&larr; difficulty &rarr;</span><br>' + row + '<br><br>'
            + (hi ? '<span class="dim">HI-SCORE ' + hi.score + '</span><br>' : '')
            + '<span class="dim">fire / enter to launch'
            + (haveCodex ? ' &middot; drone key: codex' : '') + '</span>';
    } else if (state === STATE.PAUSED) {
        dom.overlayTitle.textContent = 'PAUSED';
        dom.overlaySub.innerHTML = '<span class="dim">esc / p to resume</span>';
    } else if (state === STATE.GAMEOVER) {
        if (stageClear) {
            dom.overlayTitle.textContent = 'STAGE CLEAR';
            const name = (LEVELS[currentLevelId] && LEVELS[currentLevelId].name) || '';
            dom.overlaySub.innerHTML = name + '<br><br>SCORE ' + world.score
                + '<br><br><span class="dim">fire to continue &rarr; next level</span>';
        } else {
            dom.overlayTitle.textContent = 'GAME OVER';
            const opt = (i, label) => (gameOverChoice === i
                ? '<b class="sel">' + label + '</b>' : label);
            dom.overlaySub.innerHTML = 'SCORE ' + world.score + '<br><br>'
                + opt(0, 'CONTINUE') + '   ' + opt(1, 'QUIT')
                + '<br><span class="dim">&larr;&rarr; select &middot; fire to confirm</span>';
        }
    }
}

function renderHud() {
    if (!dom.score) return;
    dom.score.textContent = String(world.score);
    dom.lives.textContent = '×' + Math.max(0, world.lives);
    if (dom.hull && player) {
        const pct = Math.max(0, player.hull) / player.maxHull * 100;
        dom.hull.style.width = pct + '%';
        // The bar takes on the scar violet as she loses hull — the HUD and the
        // ship tell the same story in the same color.
        dom.hull.style.background = pct > 60 ? '#7fd8ff' : (pct > 25 ? '#8b5cf6' : '#ff4d6d');
    }
    if (dom.level && world.level) dom.level.textContent = world.level.name;

    // ── Siren Pulse gauge: three segments, filling as she charges (C3).
    if (dom.pulseSegs && player) {
        const wl = world.witness ? world.witness.level : 0;
        const tier = player.charge.tier;
        const into = pulseTierProgress(player.charge, wl);
        for (let i = 0; i < dom.pulseSegs.length; i++) {
            const seg = dom.pulseSegs[i];
            const filled = i < tier;
            const filling = i === tier;
            const locked = i === 2 && wl < 2;    // tier 3 needs Witness >= 2
            seg.style.background = filled
                ? (i === 2 ? '#dffaff' : '#7fd8ff')
                : (locked ? '#2a2030' : '#171a2c');
            seg.style.opacity = filling ? (0.4 + into * 0.6) : 1;
            seg.style.boxShadow = filled ? '0 0 6px #7fd8ff' : 'none';
        }
    }

    // ── weapon + Witness + drones
    if (dom.weapon && player) {
        dom.weapon.textContent = player.weapon === 'pulse' ? 'SIREN' : 'HAMMER';
        dom.weapon.style.opacity = player.swapT > 0 ? 0.4 : 1;
    }
    if (dom.witness) {
        const w = world.witness;
        dom.witness.textContent = w ? ('LV' + w.level + (w.interceptCd > 0 ? ' ·' : '')) : '—';
    }
    if (dom.drones && world.drones) {
        dom.drones.textContent = world.drones.equipped
            .map((t) => t.slice(0, 3).toUpperCase()).join(' ') || '—';
    }

    // ── pickup label flash (R-Type's own convention)
    if (dom.pickupFlash) {
        dom.pickupFlash.textContent = pickupFlashT > 0 ? pickupFlash : '';
        dom.pickupFlash.style.opacity = Math.min(1, pickupFlashT);
    }

    // ── boss HP bar — visible only while the wall lives
    if (dom.bossWrap) {
        const b = world.boss;
        const show = b && !b.dead;
        dom.bossWrap.style.display = show ? 'block' : 'none';
        if (show) {
            dom.bossBar.style.width = Math.max(0, b.hp / b.maxHp * 100) + '%';
            if (dom.bossName) {
                const ph = b.phases[b._phaseKey];
                dom.bossName.textContent = 'THE BEIGE SLOPE · ' + (ph ? ph.name : '');
            }
        }
    }
}

function renderComms() {
    if (!dom.comms) return;
    const line = comms.current && comms.gap <= 0 ? comms.current : null;
    if (line) {
        dom.comms.style.display = 'block';
        dom.comms.innerHTML = '<span class="who ' + line.who.toLowerCase() + '">'
            + line.who + '</span> ' + escapeHtml(line.t);
    } else {
        dom.comms.style.display = 'none';
    }
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderDebug() {
    if (!dom.debug) return;
    dom.debug.style.display = debugOn ? 'block' : 'none';
    if (!debugOn) return;
    const b = playerBounds();
    dom.debug.textContent =
        'state    ' + state + '\n' +
        'scrollX  ' + scrollX.toFixed(2) + '\n' +
        'bounds   x[' + b.minX.toFixed(1) + ', ' + b.maxX.toFixed(1) + ']  '
        + 'y[' + b.minY.toFixed(1) + ', ' + b.maxY.toFixed(1) + ']\n' +
        'ship     ' + player.x.toFixed(1) + ', ' + player.y.toFixed(1)
        + '   hull ' + player.hull.toFixed(0) + '/' + player.maxHull + '\n' +
        'enemies  ' + world.enemies.live + '   bullets ' + world.bullets.live
        + ' / ' + world.enemyBullets.live + '\n' +
        'witness  L' + (world.witness ? world.witness.level : 0)
        + ' ' + (world.witness ? world.witness.state : '') + '\n' +
        'fps      ' + fps.toFixed(0) + '   draws ' + lastDrawCalls + '\n' +
        (godMode ? '*** GOD MODE — score not recorded ***\n' : '') +
        'next     ' + (runner ? levelTimeline(runner, 4)
            .map((tr) => tr.type + '@' + tr.atX).join('  ') : '');
}

let lastDrawCalls = 0;
let fps = 0;
let fpsAccum = 0;
let fpsFrames = 0;
let pickupFlash = '';
let pickupFlashT = 0;

// ── lifecycle ──────────────────────────────────────────────────────────────

/** (Re)build the level runner for level `id`. Disposes the previous one. */
function loadLevel(id) {
    if (runner) disposeLevelRunner(runner);
    if (world.boss) { disposeBoss(world.boss, scene); world.boss = null; }
    const level = LEVELS[id];
    world.level = level;
    currentLevelId = id;
    runner = createLevelRunner(level, scene, world);
    runner.onDialogue = (lineId) => { pushComms(comms, lineId); };
    runner.onBoss = (bid) => { pendingBoss = bid; };
    runner.onEnd = () => { levelCleared = true; };
    return runner;
}

/** Start (or restart) a level from scratch. `atX` for continue / authoring. */
function startRun(atX = 0, id = null) {
    if (id != null && id !== currentLevelId) loadLevel(id);
    world.lives = START_LIVES;
    world.score = keepScore ? world.score : 0;
    keepScore = false;
    clearPool(world.bullets);
    clearPool(world.enemyBullets);
    clearEnemies(world.enemies);
    clearPickups(world.pickups);
    clearBits(world.pickups);
    clearFx();
    clearShake();
    clearComms(comms);
    if (world.boss) { disposeBoss(world.boss, scene); world.boss = null; }
    pendingBoss = null;
    stageClear = false;
    world.deaths = 0;
    world.diedSinceCheckpoint = false;
    // Re-arm the whole level from the start (or from ?x= for authoring).
    world.director.reset(atX);
    setScrollX(atX);
    respawnPlayer(player, playerBounds().minX + 4, PLAY_Y);
    player.lives = START_LIVES;
    refreshPerLife(world.drones, player);        // the Ghost's phase charge
    setState(STATE.PLAYING);
    playTrack(world.level.music || 'beige');
}

/**
 * Death rewinds the world (PLAN.md Phase 3). The scroll goes back to the last
 * checkpoint the player actually passed, and the level director re-arms every
 * trigger after it — so the waves you already fought come back, exactly as they
 * were. This is the classic R-Type contract, and LEVELS_PLAN §5's F1-F4 rules
 * are what keep it from being the classic R-Type cruelty.
 */
function lastCheckpointX() {
    const cps = (world.level && world.level.checkpoints) || [];
    let best = 0;
    for (const cx of cps) if (cx <= scrollX && cx > best) best = cx;
    return best;
}

function respawnAfterDeath() {
    clearPool(world.bullets);
    clearPool(world.enemyBullets);
    clearEnemies(world.enemies);
    clearFx();
    clearShake();
    // A boss fight lost rewinds to the pre-boss checkpoint (F4); tear the wall
    // down so re-reaching the boss trigger builds a fresh one.
    if (world.boss) { disposeBoss(world.boss, scene); world.boss = null; }
    pendingBoss = null;

    const backTo = lastCheckpointX();
    setScrollX(backTo);
    // The director owns wave state; rewinding the camera without rewinding it
    // would replay the level with all its waves already spent.
    if (world.director) world.director.reset(backTo);
    world.deaths = (world.deaths || 0) + 1;
    // F1: the recovery pickup only exists on a post-death run.
    world.diedSinceCheckpoint = true;

    clearPickups(world.pickups);
    clearBits(world.pickups);              // the Bits were never really hers
    respawnPlayer(player, playerBounds().minX + 4, PLAY_Y);
    // The Witness kept its level through the death (bible §00: it never dies).
    // It drifted free when she died; now it comes home.
    recallWitness(world.witness, player);
    refreshPerLife(world.drones, player);
    setState(STATE.PLAYING);
}

function tickPlaying(dt) {
    updateShmupCamera(dt, world.level);
    world.scrollX = scrollX;
    world.bounds = playerBounds();

    tickLevelRunner(runner, dt, scrollX);
    // ?god=1: hold invulnerability so the ship survives tuning runs. Scores are
    // not recorded and the HUD is watermarked (LEVELS_PLAN §8) so a god run can
    // never be mistaken for a real one.
    if (godMode) player.invuln = Math.max(player.invuln, 0.1);
    updatePlayer(player, dt, input, world);
    updateDrones(world.drones, dt, player, world, input);
    updateEnemies(world.enemies, dt, world);
    updatePickups(world.pickups, dt, player, world);
    // The Witness ticks AFTER enemies fire but BEFORE resolveCollisions — a
    // bullet it should eat must be gone before the player-collision pass runs,
    // or the shield it's providing arrives a frame too late to matter.
    updateWitness(world.witness, dt, player, world, input);

    // Bullets cull on a generous box around the screen — a bullet that leaves
    // is gone, and it must not cost anything to have left.
    const cullBox = {
        minX: despawnX(3), maxX: spawnX(3),
        minY: PLAY_MIN_Y - 3, maxY: PLAY_MAX_Y + 3
    };
    updateBullets(world.bullets, dt, cullBox, world.terrain,
        (b) => sparkHit(b.x, b.y, 0x9fe8ff));
    updateBullets(world.enemyBullets, dt, cullBox, null);

    // The boss owns the fight while it lives (ticked before collisions so its
    // mouths and slow-shots are current when resolveCollisions runs).
    if (world.boss) updateBoss(world.boss, dt, world);

    resolveCollisions(dt);

    // The boss trigger hands control to the boss module (any boss id).
    if (pendingBoss) {
        const id = pendingBoss;
        pendingBoss = null;
        if (world.boss) disposeBoss(world.boss, scene);
        createBoss(id, scene, world);
    }
    // The `end` trigger fires ~14u after the boss trigger; ignore it until the
    // boss is actually down (world.onBossCleared drives the real clear).
    levelCleared = false;
}

function onLevelClear() {
    world.score += 5000;                        // levelClearBonus
    if (!godMode) {
        recordClear(currentLevelId);            // unlock the next level + its codex
        addScore({ score: world.score, hero: 'GUMOI' });
    }

    if (currentLevelId >= LAST_LEVEL) {
        // The last wall is down. The BETWEEN plays (bible §13, cutscene 10B).
        clearComms(comms);
        pushComms(comms, 'BETWEEN');
        enterBetween();
        return;
    }

    // Advance to the next level via a stage-clear beat.
    pushRandom(comms, VICTORY_LINES);
    stageClear = true;
    nextLevelId = currentLevelId + 1;
    setState(STATE.GAMEOVER);                   // stage-clear screen; fire -> next
}

/** Lives exhausted. Record the run, remember where a continue would resume. */
function enterGameOver() {
    stageClear = false;
    gameOverChoice = 0;                         // default: CONTINUE
    continueX = lastCheckpointX();
    if (!godMode) addScore({ score: world.score, hero: 'GUMOI' });
    setState(STATE.GAMEOVER);
}

function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());     // G6
    elapsed += dt;
    stateT += dt;
    world.elapsedT = elapsed;
    if (pickupFlashT > 0) pickupFlashT -= dt;

    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 0.25) {
        fps = fpsFrames / fpsAccum;
        fpsAccum = 0;
        fpsFrames = 0;
    }

    // G1: autoReset is off — reset exactly once per frame.
    renderer.info.reset();

    updateInput(dt);
    if (input.debugPressed) debugOn = !debugOn;
    updateMusic(dt);

    const confirm = input.firePressed || input.skipPressed;

    switch (state) {
        case STATE.TITLE: {
            const d = menuTick();
            if (codexOpen) {
                // Browse the codex: left/right through unlocked entries, drone
                // key or pause closes it.
                const entries = unlockedCodex();
                if (d !== 0 && entries.length) {
                    codexIndex = (codexIndex + d + entries.length) % entries.length;
                    sfx.uiMove(); renderOverlay();
                }
                if (input.dronePressed || input.pausePressed) {
                    codexOpen = false; sfx.uiMove(); renderOverlay();
                }
                consumeAnyKey();
                break;
            }
            if (d !== 0) {
                const i = DIFFICULTIES.indexOf(getSetting('difficulty'));
                const ni = Math.max(0, Math.min(DIFFICULTIES.length - 1, i + d));
                setSetting('difficulty', DIFFICULTIES[ni]);
                sfx.uiMove();
                renderOverlay();
            }
            if (input.dronePressed && unlockedCodex().length) {
                codexOpen = true; codexIndex = 0; sfx.uiConfirm(); renderOverlay();
                consumeAnyKey();
                break;
            }
            if (confirm) {
                initAudio();                        // G2: needs a user gesture
                sfx.uiConfirm();
                // Resume at the furthest level reached (?x= forces a scroll).
                const id = startAtX > 0 ? currentLevelId : levelToPlay();
                startRun(startAtX, id);
            }
            consumeAnyKey();
            break;
        }

        case STATE.PLAYING:
            if (input.pausePressed) {
                prevState = state;
                setState(STATE.PAUSED);
                break;
            }
            tickPlaying(dt);
            break;

        case STATE.PAUSED:
            if (input.pausePressed) setState(prevState);
            break;

        case STATE.DEATH:
            // The world keeps moving while the wreck cools. Then it rewinds.
            updateShmupCamera(dt, world.level);
            updateEnemies(world.enemies, dt, world);
            if (stateT >= DEATH_HOLD_S) {
                world.lives--;
                if (world.lives <= 0) {
                    enterGameOver();
                } else {
                    respawnAfterDeath();
                }
            }
            break;

        case STATE.GAMEOVER: {
            if (stateT <= 0.6) { consumeAnyKey(); break; }
            if (stageClear) {
                // Stage clear: fire advances to the next level, carrying score.
                if (confirm) {
                    sfx.uiConfirm();
                    keepScore = true;
                    startRun(0, nextLevelId);
                }
                consumeAnyKey();
                break;
            }
            // Game over: CONTINUE (restart at the checkpoint, score reset) / QUIT.
            const d = menuTick();
            if (d !== 0) { gameOverChoice = 1 - gameOverChoice; sfx.uiMove(); renderOverlay(); }
            if (confirm) {
                if (gameOverChoice === 0) {
                    sfx.uiConfirm();
                    startRun(continueX, currentLevelId);   // continue from the checkpoint
                } else {
                    setState(STATE.TITLE);
                }
            }
            consumeAnyKey();
            break;
        }

        case STATE_BETWEEN: {
            // The ending: the white, the seal, the last exchange, then credits.
            betweenT += dt;
            updateComms(comms, dt, input.skipPressed);
            renderComms();
            // After the exchange plays out and a beat passes, a press returns
            // to the title. The seal remains the last frame until then.
            if (betweenT > 6 && (confirm || consumeAnyKey())) setState(STATE.TITLE);
            consumeAnyKey();
            break;
        }

        default:
            break;
    }

    consumeAnyKey();
    // Comms advance while playing or during the death beat; the skip key cuts a
    // talky line short so an intro never holds a player hostage.
    if (state === STATE.PLAYING || state === STATE.DEATH) {
        updateComms(comms, dt, input.skipPressed);
    }
    renderComms();
    particles.update(dt);
    updateFx(dt);
    bulletFx.update([world.bullets, world.enemyBullets]);
    updateShadowFollow(camera.position.x);
    updateTerrainWires();
    renderHud();
    renderDebug();

    composer.render();
    lastDrawCalls = renderer.info.render.calls;
}

export function boot(domRefs) {
    dom = domRefs || {};
    clock = new THREE.Clock();

    initShmupLights();
    initQuality();
    initInput();
    initFx(scene);
    initEnemies(scene);

    particles = new ParticleSystem(scene);
    // The kit's ambient petal rain belongs to a different game.
    if (particles.petalMesh) particles.petalMesh.visible = false;

    world.particles = particles;
    world.bullets = createPool(128);
    world.enemyBullets = createPool(256);
    world.enemies = createEnemyPool(64);
    world.terrain = new Terrain();
    world.score = 0;
    world.lives = START_LIVES;
    world.state = state;
    world.scrollX = 0;
    world.bounds = playerBounds();

    // Callbacks the systems fire back into the shell.
    world.onPlayerDied = () => {
        orphanWitness(world.witness);       // it detaches and drifts; it never dies
        pushRandom(comms, DEATH_LINES);     // "the witness is still here. Restart."
        setState(STATE.DEATH);
    };
    world.onEnemyShot = () => sfx.enemyShoot();

    bulletFx = new BulletRenderer(scene);
    player = createPlayer(scene, world);
    createWitness(scene, world);
    createDrones(scene, world);
    createPickups(scene, world);
    equipDrones(world.drones, ['prophet', 'needle']);   // default loadout (Phase 9A: loadout screen)

    // Injected so the loop's systems can reach back without import cycles.
    setPulseShake((amp, decay) => shakeCamera(amp, decay));
    world.damageEnemy = (e, dmg) => damageEnemy(world.enemies, e, dmg, world);
    world.flashPickup = (label) => { pickupFlash = label; pickupFlashT = 1.5; };
    world.onEnemyKilled = () => {};
    // The wall front is lethal (bible §04: pinned by slows, the wall reaches you).
    world.killPlayerByWall = () => killPlayer(player, world, true);
    // The boss module calls this when the wall finishes its death throes.
    world.onBossCleared = () => onLevelClear();

    // ── the level. Load the furthest level the player has reached (campaign
    //    progress); the title's launch re-resolves it in case progress advanced.
    loadLevel(levelToPlay());

    // ── audio: sync the synth's volume channels to settings, and keep them in
    //    sync when a settings menu changes them. synth stays dependency-free.
    initMusic(playTone);
    syncVolumes();
    onSettingChange((key) => {
        if (key === 'masterVolume' || key === 'sfxVolume' || key === 'musicVolume') syncVolumes();
        if (key === 'reduceHorrorAudio') syncVolumes();
    });

    // ── quality tiers (PLAN.md Phase 8): keys 1/2/3 pick a tier, like the
    //    showcase example. A settings menu can call setQuality() the same way.
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Digit1') setQuality('low');
        else if (e.code === 'Digit2') setQuality('high');
        else if (e.code === 'Digit3') setQuality('ultra');
    });

    // ── authoring tools (LEVELS_PLAN §8): ?x= start scrolled, ?god=1 invincible.
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    startAtX = Math.max(0, Number(params.get('x')) || 0);
    godMode = params.get('god') === '1';
    if (params.has('debug')) debugOn = true;

    window.addEventListener('resize', onResize);
    window.__engineKit = { renderer, composer, scene };
    window.__gumoi = {
        world, getState, setState,
        debugText: () => (dom.debug ? dom.debug.textContent : ''),
        setDebug: (on) => { debugOn = !!on; },
        timeline: () => levelTimeline(runner, 8)
    };

    setScrollX(0);
    renderOverlay();
    frame();
}

let pendingBoss = null;
let levelCleared = false;
let stageClear = false;
let gameOverChoice = 0;         // 0 = CONTINUE, 1 = QUIT
let continueX = 0;
let startAtX = 0;
let godMode = false;
let comms = createComms();
let currentLevelId = 1;
let nextLevelId = 0;
let keepScore = false;          // carry score across a stage-clear transition
let betweenT = 0;               // the ending's own clock
let codexOpen = false;
let codexIndex = 0;

const STATE_BETWEEN = 'BETWEEN';

/** The BETWEEN ending (bible §13). The white. The seal. The credits. */
function enterBetween() {
    betweenT = 0;
    keepScore = false;
    if (!godMode) recordClear(LAST_LEVEL);
    if (!godMode) addScore({ score: world.score, hero: 'GUMOI', ending: 'between' });
    // Wipe the fight; the arena goes to the non-dual white.
    clearEnemies(world.enemies);
    clearPool(world.enemyBullets);
    clearPool(world.bullets);
    if (world.boss) { disposeBoss(world.boss, scene); world.boss = null; }
    stopMusic();
    setState(STATE_BETWEEN);
}

/** Push settings volumes into the synth. reduceHorrorAudio softens the music. */
function syncVolumes() {
    setVolumes({
        master: getSetting('masterVolume'),
        sfx: getSetting('sfxVolume'),
        music: getSetting('musicVolume') * (getSetting('reduceHorrorAudio') ? 0.5 : 1)
    });
}

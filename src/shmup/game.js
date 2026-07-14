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
    scrollX, PLAY_Y, PLAY_MIN_Y, PLAY_MAX_Y, clearShake
} from './camera.js';
import { BEIGE_PALETTE } from './palette.js';
import { fillBox, paint } from '../voxel/helpers.js';
import { buildVoxelGeo } from '../voxel/core.js';
import { createPool, updateBullets, collideBullets, clearPool, firstHit, kill } from './bullets.js';
import { BulletRenderer } from './bulletmesh.js';
import { createPlayer, updatePlayer, damagePlayer, killPlayer, respawnPlayer, HIT_R } from './player.js';
import {
    initEnemies, createEnemyPool, spawnEnemy, updateEnemies, damageEnemy,
    clearEnemies
} from './enemies/index.js';
import { circleHit } from './bullets.js';
import { initFx, updateFx, clearFx, sparkHit } from './fx.js';
import { sfx } from './sfx.js';

export const STATE = {
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    DEATH: 'DEATH',
    RESPAWN: 'RESPAWN',
    GAMEOVER: 'GAMEOVER'
};

const START_LIVES = 3;
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
    renderOverlay();
}

// ── the placeholder level (Phase 5's director replaces this) ────────────────
function buildPlaceholderLevel() {
    const level = {
        id: 'placeholder',
        name: 'TEST SCROLL',
        scrollSpeed: 2.5,
        length: 400,
        scrollLocked: false,
        backgroundLayers: [],
        group: new THREE.Group()
    };
    scene.add(level.group);

    const map = new Map();
    fillBox(map, 0, 15, 0, 3, -2, 2, BEIGE_PALETTE.mid);
    paint(map, (x, y) => (y === 3 ? BEIGE_PALETTE.base : null));
    for (let x = 0; x <= 15; x += 3) {
        fillBox(map, x, x + 1, 4, 4, -2, 2, BEIGE_PALETTE.dark);
    }
    const geo = buildVoxelGeo(map);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const CHUNK_SCALE = 0.25;
    const chunkW = 16 * CHUNK_SCALE;

    for (let i = 0; i * chunkW < level.length + 40; i++) {
        const floor = new THREE.Mesh(geo, mat);
        floor.scale.setScalar(CHUNK_SCALE);
        floor.position.set(i * chunkW, PLAY_MIN_Y, 0);
        floor.receiveShadow = true;
        floor.castShadow = true;
        level.group.add(floor);

        const ceil = new THREE.Mesh(geo, mat);
        ceil.scale.setScalar(CHUNK_SCALE);
        ceil.rotation.z = Math.PI;
        ceil.position.set(i * chunkW + chunkW, PLAY_MAX_Y, 0);
        ceil.receiveShadow = true;
        level.group.add(ceil);
    }
    return level;
}

// ── the Phase-2 test wave: five drones, then a gunpod, on a loop. Phase 5's
//    level director makes this data instead of code.
let waveT = 0;
let waveN = 0;
function updateTestWaves(dt) {
    waveT -= dt;
    if (waveT > 0) return;
    waveT = 4.5;
    waveN++;

    const x = spawnX(2);
    if (waveN % 3 === 0) {
        spawnEnemy(world.enemies, 'gunpod', { x, y: 5 + Math.random() * 6 });
    } else {
        // A chain of five, staggered in x so they arrive as a sentence.
        const baseY = 4 + Math.random() * 8;
        for (let i = 0; i < 5; i++) {
            spawnEnemy(world.enemies, 'drone', {
                x: x + i * 1.6,
                y: baseY,
                patternState: { amp: 1.6, freq: 0.45, baseY }
            });
        }
    }
}

// ── collisions ─────────────────────────────────────────────────────────────
function resolveCollisions(dt) {
    const p = world.player;

    // player shots -> enemies
    collideBullets(world.bullets, world.enemies.items, (b, e) => {
        damageEnemy(world.enemies, e, b.dmg, world);
    });

    if (!p.alive) return;

    // enemy shots -> the Vessel (CHIP damage, C2)
    const hit = firstHit(world.enemyBullets, p.x, p.y, p.r);
    if (hit && p.invuln <= 0) {
        sparkHit(hit.x, hit.y, 0xff80d0);
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
}

// ── DOM ────────────────────────────────────────────────────────────────────
function renderOverlay() {
    if (!dom.overlay) return;
    const show = state === STATE.TITLE || state === STATE.PAUSED || state === STATE.GAMEOVER;
    dom.overlay.style.display = show ? 'flex' : 'none';
    if (state === STATE.TITLE) {
        dom.overlayTitle.textContent = 'GUMOI';
        dom.overlaySub.innerHTML = 'THE LATTICE BREAK<br><span class="dim">press any key</span>';
    } else if (state === STATE.PAUSED) {
        dom.overlayTitle.textContent = 'PAUSED';
        dom.overlaySub.innerHTML = '<span class="dim">esc / p to resume</span>';
    } else if (state === STATE.GAMEOVER) {
        dom.overlayTitle.textContent = 'GAME OVER';
        dom.overlaySub.innerHTML = 'SCORE ' + world.score
            + '<br><span class="dim">press any key</span>';
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
        'fps      ' + fps.toFixed(0) + '   draws ' + lastDrawCalls;
}

let lastDrawCalls = 0;
let fps = 0;
let fpsAccum = 0;
let fpsFrames = 0;

// ── lifecycle ──────────────────────────────────────────────────────────────
function startRun() {
    world.lives = START_LIVES;
    world.score = 0;
    waveT = 1.5;
    waveN = 0;
    clearPool(world.bullets);
    clearPool(world.enemyBullets);
    clearEnemies(world.enemies);
    clearFx();
    clearShake();
    setScrollX(0);
    respawnPlayer(player, playerBounds().minX + 4, PLAY_Y);
    player.lives = START_LIVES;
    setState(STATE.PLAYING);
}

/** Death -> the world rewinds. Phase 3 makes this rewind to a checkpoint. */
function respawnAfterDeath() {
    clearPool(world.enemyBullets);
    clearEnemies(world.enemies);
    clearShake();
    waveT = 2.0;
    respawnPlayer(player, playerBounds().minX + 4, PLAY_Y);
    setState(STATE.PLAYING);
}

function tickPlaying(dt) {
    updateShmupCamera(dt, world.level);
    world.scrollX = scrollX;
    world.bounds = playerBounds();

    updateTestWaves(dt);
    updatePlayer(player, dt, input, world);
    updateEnemies(world.enemies, dt, world);

    // Bullets cull on a generous box around the screen — a bullet that leaves
    // is gone, and it must not cost anything to have left.
    const cullBox = {
        minX: despawnX(3), maxX: spawnX(3),
        minY: PLAY_MIN_Y - 3, maxY: PLAY_MAX_Y + 3
    };
    updateBullets(world.bullets, dt, cullBox, world.terrain,
        (b) => sparkHit(b.x, b.y, 0x9fe8ff));
    updateBullets(world.enemyBullets, dt, cullBox, null);

    resolveCollisions(dt);
}

function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());     // G6
    elapsed += dt;
    stateT += dt;
    world.elapsedT = elapsed;

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

    switch (state) {
        case STATE.TITLE:
            if (consumeAnyKey()) {
                initAudio();                        // G2: needs a user gesture
                startRun();
            }
            break;

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
                    setState(STATE.GAMEOVER);
                } else {
                    respawnAfterDeath();
                }
            }
            break;

        case STATE.GAMEOVER:
            if (stateT > 0.6 && consumeAnyKey()) setState(STATE.TITLE);
            break;

        default:
            break;
    }

    consumeAnyKey();
    particles.update(dt);
    updateFx(dt);
    bulletFx.update([world.bullets, world.enemyBullets]);
    updateShadowFollow(camera.position.x);
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
    world.level = buildPlaceholderLevel();
    world.bullets = createPool(128);
    world.enemyBullets = createPool(256);
    world.enemies = createEnemyPool(64);
    world.terrain = null;                    // Phase 3
    world.score = 0;
    world.lives = START_LIVES;
    world.state = state;
    world.scrollX = 0;
    world.bounds = playerBounds();

    // Callbacks the systems fire back into the shell.
    world.onPlayerDied = () => setState(STATE.DEATH);
    world.onEnemyShot = () => sfx.enemyShoot();

    bulletFx = new BulletRenderer(scene);
    player = createPlayer(scene, world);

    window.addEventListener('resize', onResize);
    window.__engineKit = { renderer, composer, scene };
    window.__gumoi = {
        world, getState, setState,
        debugText: () => (dom.debug ? dom.debug.textContent : ''),
        setDebug: (on) => { debugOn = !!on; }
    };

    setScrollX(0);
    renderOverlay();
    frame();
}

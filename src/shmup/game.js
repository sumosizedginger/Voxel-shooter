// src/shmup/game.js
// Purpose: the game shell — state machine, main loop, and the shared `world`.
// Dependencies: engine/{renderer,lights,particles,settings}, ./input, ./camera
//
// PLAN.md Phase 0/1. Every gameplay system hangs off `world` (src/context.js);
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
    updateShmupCamera, setScrollX, playerBounds, scrollX, PLAY_Y, PLAY_MIN_Y, PLAY_MAX_Y
} from './camera.js';
import { BEIGE_PALETTE } from './palette.js';
import { fillBox, paint } from '../voxel/helpers.js';
import { buildVoxelGeo } from '../voxel/core.js';

export const STATE = {
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    DEATH: 'DEATH',
    RESPAWN: 'RESPAWN',
    GAMEOVER: 'GAMEOVER'
};

const START_LIVES = 3;

let state = STATE.TITLE;
let prevState = STATE.TITLE;      // where PAUSED came from
let clock = null;
let particles = null;
let debugOn = false;
let elapsed = 0;
let dom = {};

export function getState() { return state; }

function setState(next) {
    if (state === next) return;
    state = next;
    world.state = next;
    render_ui();
}

// ── the placeholder level (Phase 1). Phase 5 replaces this with the director.
function buildPlaceholderLevel() {
    const layers = [];
    const level = {
        id: 'placeholder',
        name: 'TEST SCROLL',
        scrollSpeed: 2.5,
        length: 300,
        scrollLocked: false,
        backgroundLayers: layers,
        group: new THREE.Group()
    };
    scene.add(level.group);

    // A ground + ceiling run of chunky test blocks so the scroll is legible.
    // Beige on purpose — this is the Slope's palette, and a placeholder that
    // matches the real level's value range tells you the truth about lighting.
    const map = new Map();
    fillBox(map, 0, 15, 0, 3, -2, 2, BEIGE_PALETTE.mid);
    paint(map, (x, y) => (y === 3 ? BEIGE_PALETTE.base : null));
    for (let x = 0; x <= 15; x += 3) {
        fillBox(map, x, x + 1, 4, 4, -2, 2, BEIGE_PALETTE.dark);
    }
    const geo = buildVoxelGeo(map);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const CHUNK_SCALE = 0.25;          // ASSETS_PLAN §6: chunky is right for walls
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
        ceil.rotation.z = Math.PI;                 // flip it to hang from the top
        ceil.position.set(i * chunkW + chunkW, PLAY_MAX_Y, 0);
        ceil.receiveShadow = true;
        level.group.add(ceil);
    }
    return level;
}

// ── corner markers: the Phase-1 "done when" check — these sit exactly on
//    playerBounds()'s four corners, so a wrong bound is visible, not argued.
let boundsMarkers = null;
function buildBoundsMarkers() {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const mat = new THREE.MeshBasicMaterial({ color: 0x7fe0ff });
    for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(geo, mat));
    g.visible = false;
    scene.add(g);
    return g;
}

function updateBoundsMarkers() {
    if (!boundsMarkers) return;
    boundsMarkers.visible = debugOn;
    if (!debugOn) return;
    const b = playerBounds();
    const c = boundsMarkers.children;
    c[0].position.set(b.minX, b.minY, 0);
    c[1].position.set(b.maxX, b.minY, 0);
    c[2].position.set(b.maxX, b.maxY, 0);
    c[3].position.set(b.minX, b.maxY, 0);
}

// ── DOM ────────────────────────────────────────────────────────────────────
function render_ui() {
    if (!dom.overlay) return;
    const showTitle = state === STATE.TITLE;
    const showPause = state === STATE.PAUSED;
    const showOver = state === STATE.GAMEOVER;
    dom.overlay.style.display = (showTitle || showPause || showOver) ? 'flex' : 'none';
    if (showTitle) {
        dom.overlayTitle.textContent = 'GUMOI';
        dom.overlaySub.innerHTML = 'THE LATTICE BREAK<br><span class="dim">press any key</span>';
    } else if (showPause) {
        dom.overlayTitle.textContent = 'PAUSED';
        dom.overlaySub.innerHTML = '<span class="dim">esc / p to resume</span>';
    } else if (showOver) {
        dom.overlayTitle.textContent = 'GAME OVER';
        dom.overlaySub.innerHTML = '<span class="dim">press any key</span>';
    }
}

function renderDebug() {
    if (!dom.debug) return;
    dom.debug.style.display = debugOn ? 'block' : 'none';
    if (!debugOn) return;
    const b = playerBounds();
    dom.debug.textContent =
        'state    ' + state + '\n' +
        'scrollX  ' + scrollX.toFixed(2) + '\n' +
        'bounds   x[' + b.minX.toFixed(1) + ', ' + b.maxX.toFixed(1) + ']  ' +
        'y[' + b.minY.toFixed(1) + ', ' + b.maxY.toFixed(1) + ']\n' +
        'axis     ' + input.axisX.toFixed(2) + ', ' + input.axisY.toFixed(2) + '\n' +
        'fps      ' + fps.toFixed(0) + '\n' +
        'draws    ' + lastDrawCalls;
}

// Read AFTER composer.render(), because renderer.info was reset at the top of
// this frame — reading it before the render would always report 0.
let lastDrawCalls = 0;
let fps = 0;
let fpsAccum = 0;
let fpsFrames = 0;

// ── lifecycle ──────────────────────────────────────────────────────────────
function startRun() {
    world.lives = START_LIVES;
    world.score = 0;
    setScrollX(0);
    setState(STATE.PLAYING);
}

function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());   // G6: everything is per-second
    elapsed += dt;

    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 0.25) {
        fps = fpsFrames / fpsAccum;
        fpsAccum = 0;
        fpsFrames = 0;
    }

    // G1: renderer.info.autoReset is false — reset exactly once per frame or
    // every draw-call reading (and the smoke spec) sees garbage.
    renderer.info.reset();

    updateInput(dt);
    if (input.debugPressed) { debugOn = !debugOn; }

    switch (state) {
        case STATE.TITLE:
            if (consumeAnyKey()) {
                initAudio();               // G2: must come from a user gesture
                startRun();
            }
            break;

        case STATE.PLAYING:
            if (input.pausePressed) {
                prevState = state;
                setState(STATE.PAUSED);
                break;
            }
            updateShmupCamera(dt, world.level);
            break;

        case STATE.PAUSED:
            if (input.pausePressed) setState(prevState);
            break;

        case STATE.GAMEOVER:
            if (consumeAnyKey()) setState(STATE.TITLE);
            break;

        default:
            break;
    }

    consumeAnyKey();                        // don't let a stale press leak states
    particles.update(dt);
    updateShadowFollow(camera.position.x);
    updateBoundsMarkers();
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

    particles = new ParticleSystem(scene);
    // The kit's ambient petal rain belongs to a different game (PLAN.md Phase 8).
    if (particles.petalMesh) particles.petalMesh.visible = false;

    world.particles = particles;
    world.level = buildPlaceholderLevel();
    world.score = 0;
    world.lives = START_LIVES;
    world.state = state;
    world.elapsed = () => elapsed;

    boundsMarkers = buildBoundsMarkers();

    window.addEventListener('resize', onResize);
    // Test hook, same shape the smoke spec reads on index.html.
    window.__engineKit = { renderer, composer, scene };
    window.__gumoi = {
        world, getState, setState,
        debugText: () => (dom.debug ? dom.debug.textContent : ''),
        setDebug: (on) => { debugOn = !!on; }
    };

    setScrollX(0);
    render_ui();
    frame();
}

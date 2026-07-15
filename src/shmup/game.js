// src/shmup/game.js
// Purpose: the game shell — state machine, main loop, and the shared `world`.
// Dependencies: engine/*, ./input, ./camera, ./player, ./bullets, ./enemies, ./fx
//
// PLAN.md Phase 0-2. Every gameplay system hangs off `world` (src/context.js);
// nothing reaches through `window`.

import * as THREE from 'three';
import {
    scene, camera, renderer, composer, onResize,
    setCineCamera, clearCineCamera, updateCineCamera
} from '../engine/renderer.js';
import { updateShadowFollow } from '../engine/lights.js';
import { initShmupLights } from './lighting.js';
import { ParticleSystem } from '../engine/particles.js';
import { initQuality } from '../engine/quality.js';
import { initAudio } from '../audio/synth.js';
import { world } from '../context.js';
import {
    input, initInput, updateInput, consumeAnyKey, refreshBindings, DEFAULT_BINDINGS,
    getBindings, proposeRebind
} from './input.js';
import {
    updateShmupCamera, setScrollX, playerBounds, spawnX, despawnX,
    scrollX, PLAY_Y, PLAY_MIN_Y, PLAY_MAX_Y, clearShake, shakeCamera
} from './camera.js';
import { Terrain } from './terrain.js';
import { createLevelRunner, tickLevelRunner, disposeLevelRunner, levelTimeline } from './level/runner.js';
import { levelProgress } from './level/director.js';
import { createPool, updateBullets, collideBullets, clearPool, firstHit, kill, spawn, KIND } from './bullets.js';
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
import { COUNCIL, DRONE_TYPES, MAX_DRONES } from './council.js';
import {
    loadSavedLoadout, saveLoadout, normalizeLoadout, cycleSeat, loadoutLabel, DEFAULT_LOADOUT
} from './loadout.js';
import { createCutsceneDiorama, disposeDiorama } from './assets/diorama.js';
import { createPickups, updatePickups, clearPickups, clearBits } from './powerups.js';
import { applySlug, decayStacks } from './hammer.js';
import { tierProgress as pulseTierProgress } from './wavecannon.js';
import {
    createBoss, updateBoss, hitBossPart, applySlowShot, disposeBoss
} from './bosses/index.js';
import { LEVELS, LAST_LEVEL, levelToPlay, recordClear } from './level/campaign.js';
import { unlockedCodex } from './codex.js';
import {
    getSetting, setSetting, getScores, addScore, onSettingChange, resetSettingsDefaults
} from '../engine/settings.js';
import { setQuality } from '../engine/quality.js';
import { playTone, setVolumes } from '../audio/synth.js';
import { initMusic, playTrack, stopMusic, setMusicEnabled, updateMusic } from './music.js';
import {
    createComms, pushComms, pushRandom, clearComms, updateComms,
    DEATH_LINES, VICTORY_LINES
} from './comms.js';
import {
    createProfanity, updateProfanity, tryProfanity
} from './systems/profanity.js';
import {
    createHeat, updateHeat, heatWeaponsOffline, heatFraction
} from './systems/heat.js';
import {
    createAsymmetry, updateAsymmetry, asymmetryDamageMult
} from './systems/asymmetry.js';
import {
    createModStack, updateMods, transformInput, screenPushDelta, clearMods, hasMod, pushMod
} from './systems/modifiers.js';
import {
    createRecorder, recordFrame, sampleAt, clearRecorder
} from './systems/inputrec.js';
import {
    createPredictor, recordMotion
} from './systems/predictor.js';
import {
    createTemporalLoop, updateTemporal, recordBulletEvent, stopTemporal
} from './systems/temporal.js';
import {
    createCutscenePlayer, playCutscene, updateCutscene, skipCutscene,
    cutsceneActive, levelOpenCutscene, levelBossCutscene
} from './systems/cutscene.js';
import { applyWordHit } from './systems/words.js';
import {
    nextTip, markTipSeen, skipAllTips, tipsDone, tipsForWhere, shouldShowTip
} from './systems/onboarding.js';

export const STATE = {
    TITLE: 'TITLE',
    LOADOUT: 'LOADOUT',
    OPTIONS: 'OPTIONS',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    DEATH: 'DEATH',
    RESPAWN: 'RESPAWN',
    GAMEOVER: 'GAMEOVER',
    CUTSCENE: 'CUTSCENE',
    TIP: 'TIP'
};

// Title submenu: 0 launch → loadout, 1 options, 2 codex (if any)
let titleChoice = 0;
// Working Council loadout (two seats)
let loadoutSeats = DEFAULT_LOADOUT.slice();
let loadoutFocus = 0;           // which seat is being cycled
// Options menu
let optionsFrom = STATE.TITLE;
let optionsCursor = 0;
let rebindWaiting = null;       // action name while listening for a key
let rebindConflict = null;      // last conflict warning action name
const OPTIONS_ROWS = [
    { key: 'masterVolume', label: 'MASTER', type: 'vol' },
    { key: 'sfxVolume', label: 'SFX', type: 'vol' },
    { key: 'musicVolume', label: 'MUSIC', type: 'vol' },
    { key: 'quality', label: 'QUALITY', type: 'enum', values: ['low', 'high', 'ultra'] },
    { key: 'reduceMotion', label: 'REDUCE MOTION', type: 'bool' },
    { key: 'reduceFlashing', label: 'REDUCE FLASH', type: 'bool' },
    { key: 'reduceHorrorAudio', label: 'SOFTEN HORROR AUDIO', type: 'bool' },
    { key: 'largerHud', label: 'LARGER HUD', type: 'bool' },
    { key: 'lowerShake', label: 'LOWER SHAKE', type: 'bool' },
    { key: 'holdToFire', label: 'HOLD TO FIRE', type: 'bool' },
    { key: 'rebind', label: 'REBIND CONTROLS', type: 'rebind' },
    { key: 'reset', label: 'RESET DEFAULTS', type: 'reset' },
    { key: 'back', label: 'BACK', type: 'back' }
];
const REBIND_ACTIONS = ['up', 'down', 'left', 'right', 'fire', 'dock', 'swap', 'drone', 'profanity', 'pause'];
let rebindCursor = 0;
// First-run tips
let activeTip = null;
let tipReturnState = STATE.TITLE;
let tipQueue = [];

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
    setMusicEnabled(next === STATE.PLAYING || next === STATE.DEATH || next === STATE.CUTSCENE);
    if (next === STATE.TITLE || next === STATE.GAMEOVER || next === STATE.LOADOUT
        || next === STATE.OPTIONS || next === STATE.TIP) stopMusic();
    applyHudA11y();
    renderOverlay();
}

function applyHudA11y() {
    try {
        const root = document.getElementById('hud') || (dom && dom.hud);
        if (!root) return;
        if (getSetting('largerHud')) root.classList.add('large');
        else root.classList.remove('large');
    } catch (e) { /* headless */ }
}

function openTip(tip, ret) {
    activeTip = tip;
    tipReturnState = ret || STATE.TITLE;
    setState(STATE.TIP);
    if (sfx.tip) sfx.tip();
}

/** Queue L1 play tips if unseen; call after cutscene→play. */
function maybeQueuePlayTips() {
    if (skipTips || tipsDone() || currentLevelId !== 1) return;
    tipQueue = tipsForWhere('play_L1').filter((t) => shouldShowTip(t.id));
    drainTipQueue(STATE.PLAYING);
}

function drainTipQueue(ret) {
    if (activeTip || state === STATE.TIP) return;
    const t = tipQueue.shift();
    if (t) openTip(t, ret);
}

function dismissTip(skipAll) {
    if (activeTip) markTipSeen(activeTip.id);
    if (skipAll) skipAllTips();
    activeTip = null;
    const ret = tipReturnState;
    if (tipQueue.length) {
        setState(ret);
        drainTipQueue(ret);
        return;
    }
    setState(ret);
}

/** Vertical menu tick (up/down) for loadout/options. */
let _menuYLatched = false;
function menuTickY() {
    const ay = input.axisY;
    let dir = 0;
    if (Math.abs(ay) > 0.5) {
        if (!_menuYLatched) { dir = Math.sign(ay); _menuYLatched = true; }
    } else {
        _menuYLatched = false;
    }
    return dir;
}

function openLoadout() {
    loadoutSeats = loadSavedLoadout();
    loadoutFocus = 0;
    setState(STATE.LOADOUT);
    // First-run loadout tip (skippable; never softens bible text)
    if (!skipTips && !tipsDone()) {
        const t = nextTip('loadout');
        if (t) {
            tipQueue = [];
            openTip(t, STATE.LOADOUT);
        }
    }
}

function openOptions(from) {
    optionsFrom = from || STATE.TITLE;
    optionsCursor = 0;
    rebindWaiting = null;
    setState(STATE.OPTIONS);
}

function applyLoadoutAndLaunch() {
    const seats = saveLoadout(loadoutSeats);
    equipDrones(world.drones, seats);
    initAudio();
    sfx.uiConfirm();
    const id = startAtX > 0 ? currentLevelId : levelToPlay();
    startRun(startAtX, id);
}

function formatVol(v) {
    return Math.round((Number(v) || 0) * 100) + '%';
}

function codeLabel(code) {
    if (!code) return '—';
    return String(code).replace(/^Key/, '').replace(/^Arrow/, '↑↓←→'.includes(code) ? code : code.replace('Arrow', ''));
}

function bindingLabel(action) {
    const custom = getSetting('keybindings');
    const list = (custom && custom[action]) || DEFAULT_BINDINGS[action] || [];
    return list.map(codeLabel).join('/');
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
        let dmg = hit.dmg;
        // S7 word-bullet effects (DELVE slow, ROBUST heal boss, TAPESTRY grid…)
        if (hit.onlyProfanity || hit.kind === 'word') {
            const r = applyWordHit(hit.word || '', world, p, hit);
            dmg = r.dmg;
        }
        kill(world.enemyBullets, hit);
        if (dmg > 0) damagePlayer(p, dmg, world);
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
        || state === STATE.GAMEOVER || state === STATE_BETWEEN
        || state === STATE.LOADOUT || state === STATE.OPTIONS;
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
    if (state === STATE.LOADOUT) {
        dom.overlayTitle.textContent = 'COUNCIL';
        const seats = normalizeLoadout(loadoutSeats);
        const seatHtml = [0, 1].map((i) => {
            const t = seats[i];
            const def = COUNCIL[t];
            const sel = loadoutFocus === i ? 'sel' : 'dim';
            return '<span class="' + sel + '">[' + (i + 1) + '] '
                + (def ? def.name : '—') + '</span>';
        }).join('   ');
        const focusType = seats[loadoutFocus];
        const focusDef = COUNCIL[focusType];
        const roster = DRONE_TYPES.map((id) => {
            const on = seats.includes(id);
            const cls = on ? 'sel' : 'dim';
            return '<span class="' + cls + '">' + COUNCIL[id].name + '</span>';
        }).join('  ');
        dom.overlaySub.innerHTML =
            'TWO SEATS. THE REST STAYED.<br><br>'
            + seatHtml + '<br><br>'
            + (focusDef
                ? '<span class="codexbody">' + escapeHtml(focusDef.desc) + '<br>'
                    + '<span class="dim">' + escapeHtml(focusDef.seat) + '</span></span><br><br>'
                : '')
            + roster + '<br><br>'
            + '<span class="dim">&uarr;&darr; seat &middot; &larr;&rarr; cycle &middot; fire launch &middot; esc back</span>';
        return;
    }
    if (state === STATE.TIP && activeTip) {
        dom.overlayTitle.textContent = activeTip.title;
        dom.overlaySub.innerHTML =
            '<span class="codexbody">' + escapeHtml(activeTip.body) + '</span><br><br>'
            + '<span class="dim">fire continue &middot; esc skip all tips</span>';
        return;
    }
    if (state === STATE.OPTIONS) {
        if (rebindWaiting) {
            const binds = getBindings();
            const cur = (binds[rebindWaiting] || []).join(', ');
            dom.overlayTitle.textContent = 'REBIND';
            dom.overlaySub.innerHTML =
                'Press a key for <span class="sel">' + rebindWaiting.toUpperCase() + '</span><br>'
                + '<span class="dim">now: ' + escapeHtml(cur) + '</span><br>'
                + (rebindConflict
                    ? '<br><span class="sel">conflict with ' + rebindConflict.toUpperCase()
                        + ' — reassigned</span><br>'
                    : '')
                + '<br><span class="dim">esc cancel · chain ' + (rebindCursor + 1)
                + '/' + REBIND_ACTIONS.length + '</span>';
            return;
        }
        dom.overlayTitle.textContent = optionsFrom === STATE.PAUSED ? 'OPTIONS (PAUSED)' : 'OPTIONS';
        const rows = OPTIONS_ROWS.map((row, i) => {
            const mark = optionsCursor === i ? '<b class="sel">&gt; ' : '<span class="dim">  ';
            const end = optionsCursor === i ? '</b>' : '</span>';
            let val = '';
            if (row.type === 'vol') val = formatVol(getSetting(row.key));
            else if (row.type === 'bool') val = getSetting(row.key) ? 'ON' : 'OFF';
            else if (row.type === 'enum') val = String(getSetting(row.key) || row.values[0]).toUpperCase();
            else if (row.type === 'rebind') val = '';
            return mark + row.label + (val ? '  ' + val : '') + end;
        }).join('<br>');
        dom.overlaySub.innerHTML = rows + '<br><br>'
            + '<span class="dim">&uarr;&darr; move &middot; &larr;&rarr; adjust &middot; fire select</span>';
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
        const items = ['LAUNCH', 'OPTIONS'].concat(haveCodex ? ['CODEX'] : []);
        const menu = items.map((label, i) =>
            (titleChoice === i ? '<b class="sel">' + label + '</b>' : '<span class="dim">' + label + '</span>')
        ).join('   ');
        dom.overlaySub.innerHTML =
            'THE LATTICE BREAK<br><br>'
            + '<span class="dim">&larr; difficulty &rarr;</span><br>' + row + '<br><br>'
            + menu + '<br><br>'
            + '<span class="dim">council ' + escapeHtml(loadoutLabel(loadSavedLoadout())) + '</span><br>'
            + (hi ? '<span class="dim">HI-SCORE ' + hi.score + '</span><br>' : '')
            + '<span class="dim">&uarr;&darr; menu &middot; fire confirm</span>';
    } else if (state === STATE.PAUSED) {
        dom.overlayTitle.textContent = 'PAUSED';
        dom.overlaySub.innerHTML =
            '<span class="dim">esc / p resume &middot; drone key options</span><br>'
            + '<span class="dim">options mirror title (vol / a11y / rebind / reset)</span>';
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
        let pct = Math.max(0, player.hull) / player.maxHull * 100;
        // S6 hudLie: invert the bar reading so she cannot trust the meter.
        if (world.hudLie) pct = 100 - pct;
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
        let label = player.weapon === 'pulse' ? 'SIREN' : 'HAMMER';
        if (world.hudLie) label = player.weapon === 'pulse' ? 'HAMMER' : 'SIREN';
        dom.weapon.textContent = label;
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
                const ph = b.phases
                    ? (b.phases[b._phaseKey] || b.phases[b._phaseIndex])
                    : null;
                const nm = b.name || (b.cfg && b.cfg.name) || 'BOSS';
                dom.bossName.textContent = ph && ph.name ? (nm + ' · ' + ph.name) : nm;
            }
        }
    }

    // System meters (heat / asymmetry / profanity CD)
    if (dom.sysMeter) {
        const sys = world.level && world.level.systems;
        let text = '';
        if (sys && sys.heat && heat) {
            text = heatWeaponsOffline(heat) ? 'HEAT OFFLINE' : ('HEAT ' + Math.round(heatFraction(heat) * 100));
        } else if (sys && sys.asymmetry && asymmetry) {
            text = 'ASYM ' + Math.round(asymmetry.score * 100);
        } else if (sys && sys.profanity && profanity) {
            text = profanity.cd > 0 ? ('PROF ' + profanity.cd.toFixed(1) + 's') : 'PROF READY (F)';
        }
        dom.sysMeter.textContent = text;
        dom.sysMeter.style.display = text ? 'block' : 'none';
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
        (devMode ? '*** DEV MODE (Ctrl×10 toggles) · Shift+1..0 = level jump ***\n' : '') +
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
    runner.onDialogue = (lineId) => {
        // Boss entries play a short cinematic (GUMOI + boss silhouette) unless
        // cutscenes are suppressed (authoring ?x= / ?skipcs=1). The verbatim
        // boss line still shows inside the cutscene, or as a plain comms line
        // when skipped — so the story text is never lost either way.
        if (/_boss$/.test(lineId) && !skipCutscenes) playBossCutscene(lineId);
        else pushComms(comms, lineId);
    };
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
    clearMods(mods);
    clearRecorder(recorder);
    stopTemporal(temporal);
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
    equipDrones(world.drones, loadSavedLoadout());
    refreshPerLife(world.drones, player);        // the Ghost's phase charge
    armLevelSystems(world.level);
    playTrack(world.level.music || 'beige');

    // S3: opening cutscene (skipped when authoring with ?x= or ?skipcs=1).
    if (atX <= 0 && !skipCutscenes) {
        const script = levelOpenCutscene(currentLevelId, atX);
        setState(STATE.CUTSCENE);
        playCutscene(cutscene, script, {
            setCineCamera, clearCineCamera, getSetting,
            pushComms: (id) => pushComms(comms, id),
            spawnDiorama: (levelId, sx, opts) => createCutsceneDiorama(scene, levelId, sx, opts),
            disposeDiorama: (d) => disposeDiorama(d, scene)
        }, () => {
            clearCineCamera();
            setState(STATE.PLAYING);
            maybeQueuePlayTips();
        });
    } else {
        setState(STATE.PLAYING);
        maybeQueuePlayTips();
    }
}

/**
 * S3: boss-entry cutscene. Fired mid-run by the `_boss` dialogue trigger
 * (~x=300). Entering CUTSCENE pauses the scroll and the director, so the boss
 * (x=306) can't spawn until we resume PLAYING — the cinematic reads first, then
 * the natural scroll carries the Vessel into the fight.
 */
function playBossCutscene(lineId) {
    const script = levelBossCutscene(currentLevelId, scrollX);
    // Honor the exact trigger id (robust if a level ever overrides its line).
    for (const s of script.shots) if (s.lineId) s.lineId = lineId;
    setState(STATE.CUTSCENE);
    playCutscene(cutscene, script, {
        setCineCamera, clearCineCamera, getSetting,
        pushComms: (id) => pushComms(comms, id),
        spawnDiorama: (levelId, sx, opts) => createCutsceneDiorama(scene, levelId, sx, opts),
        disposeDiorama: (d) => disposeDiorama(d, scene)
    }, () => {
        clearCineCamera();
        setState(STATE.PLAYING);
    });
}

function armLevelSystems(level) {
    const sys = (level && level.systems) || {};
    world.levelSystems = sys;
    world.mods = mods;
    world.pushMod = (name, dur, data) => pushMod(mods, name, dur, data);
    world.predictor = sys.predictor || sys.heat ? predictor : null;
    world.asymmetry = sys.asymmetry ? asymmetry : null;
    world.temporal = temporal;
    world.damageMult = () => (sys.asymmetry ? asymmetryDamageMult(asymmetry) : 1);
    world.recordTemporalBullet = (b) => {
        if (sys.temporal || (temporal && temporal.active)) recordBulletEvent(temporal, b);
    };
    heat.value = 0; heat.offline = 0;
    profanity.cd = 0;
    shadowT = 0;
    world.hudLie = false;
    if (shadowMesh) shadowMesh.visible = false;
}

/** Build a translucent shadow ghost for L5/L9 (S8). */
function ensureShadowGhost() {
    if (shadowMesh) return;
    shadowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.5, 0.4),
        new THREE.MeshStandardMaterial({
            color: 0x8b5cf6, emissive: 0x4c1d95, emissiveIntensity: 1.2,
            transparent: true, opacity: 0.45, depthWrite: false
        })
    );
    shadowMesh.visible = false;
    scene.add(shadowMesh);
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

    const sys = world.levelSystems || {};

    // S6 arena modifiers: transform input BEFORE movement so slow/flip apply.
    updateMods(mods, dt);
    let playInput = input;
    if (sys.modifiers || hasMod(mods, 'controlFlip') || hasMod(mods, 'gravityInvert')
        || hasMod(mods, 'screenPush') || hasMod(mods, 'weaponShuffle') || hasMod(mods, 'hudLie')
        || hasMod(mods, 'slowStack')) {
        playInput = transformInput(mods, input);
    }
    // weaponShuffle: randomly invert fire/swap meaning for the duration.
    if (hasMod(mods, 'weaponShuffle') && playInput.swapPressed) {
        // swallow swap; fire still works — shuffle is a lie, not a hard lock.
        playInput = Object.assign({}, playInput, { swapPressed: false, swap: false });
        if (Math.random() < 0.5) player.weapon = player.weapon === 'pulse' ? 'hammer' : 'pulse';
    }
    // hudLie: flip displayed hull / weapon labels (presentation only).
    world.hudLie = hasMod(mods, 'hudLie');
    // S6 slowStack: flag for updatePlayer (which recomputes speedScale).
    world.modSpeedScale = hasMod(mods, 'slowStack') ? 0.55 : 1;

    // Signature meters
    if (sys.heat) updateHeat(heat, dt, playInput, true);
    else updateHeat(heat, dt, playInput, false);
    if (sys.asymmetry) updateAsymmetry(asymmetry, dt, playInput);
    updateProfanity(profanity, dt);
    // SEAMLESS word-lock decay
    if (player._wordLockT > 0) player._wordLockT -= dt;

    // S7 Profanity Key
    if ((sys.profanity || (world.boss && world.boss.cfg && world.boss.kind === 'boss04'))
        && input.profanityPressed) {
        const cancelled = tryProfanity(profanity, world, player);
        if (cancelled && sfx.profanity) sfx.profanity();
        if (cancelled) {
            sfx.interrupt();
            sparkHit(cancelled.x, cancelled.y, 0xffe08a);
            world.flashPickup && world.flashPickup('—' + (cancelled.word || 'WORD') + '—');
        } else {
            sfx.uiMove();
        }
    }

    // S9 motion record
    if (sys.predictor || sys.heat) recordMotion(predictor, dt, player.x, player.y);

    // S8 input recorder + shadow ghost (L5 delay fixed; L9 ramps 0.5→0.1)
    recordFrame(recorder, dt, {
        x: player.x, y: player.y,
        ax: playInput.axisX, ay: playInput.axisY,
        fire: playInput.fire, weapon: player.weapon,
        vx: player.vx, vy: player.vy
    });
    if (sys.shadow) {
        ensureShadowGhost();
        shadowT += dt;
        let delay = sys.shadowDelay || 0.3;
        if (sys.shadowRamp) {
            // L9: 0.5 s → 0.1 s over ~90 s of fight pressure.
            const t = Math.min(1, shadowT / 90);
            delay = 0.5 - t * 0.4;
        }
        const snap = sampleAt(recorder, delay);
        // Contradiction window: current fire while delayed snap was also firing
        // in the opposite vertical half — opens a brief weakpoint on the boss.
        if (sys.contradiction && snap && playInput.fire && snap.fire
            && Math.sign(playInput.axisY || 0.01) !== Math.sign(snap.ay || 0.01)
            && world.boss && world.boss.cores) {
            for (const c of world.boss.cores) {
                c.weakpointT = Math.max(c.weakpointT || 0, 0.6);
                c.open = true;
            }
        }
        // L9 phase 2: replay shots from 5 s ago as enemy bullets.
        if (sys.replayShots) {
            const old = sampleAt(recorder, 5.0);
            if (old && old.fire && Math.random() < dt * 4) {
                spawnEnemyShotFromShadow(old);
            }
        }
        if (snap && shadowMesh) {
            shadowMesh.visible = true;
            shadowMesh.position.set(snap.x, snap.y, 0.1);
            if (player.alive && player.invuln <= 0
                && circleHit(player.x, player.y, player.r, snap.x, snap.y, 0.45)) {
                damagePlayer(player, 3, world);
            }
        }
    } else if (shadowMesh) {
        shadowMesh.visible = false;
        shadowT = 0;
    }

    // Heat offline OR SEAMLESS word-lock → weapons offline (must OR, not overwrite)
    player.weaponsOffline = heatWeaponsOffline(heat) || (player._wordLockT > 0);

    tickLevelRunner(runner, dt, scrollX);
    if (godMode) player.invuln = Math.max(player.invuln, 0.1);
    updatePlayer(player, dt, playInput, world);

    // S6 screenPush
    if (hasMod(mods, 'screenPush') && player.alive) {
        const push = screenPushDelta(mods, dt);
        player.x += push.dx;
        player.y += push.dy;
        const b = playerBounds();
        player.x = Math.max(b.minX, Math.min(b.maxX, player.x));
        player.y = Math.max(b.minY, Math.min(b.maxY, player.y));
    }

    updateDrones(world.drones, dt, player, world, input);
    updateEnemies(world.enemies, dt, world);
    updatePickups(world.pickups, dt, player, world);
    updateWitness(world.witness, dt, player, world, input);

    const cullBox = {
        minX: despawnX(3), maxX: spawnX(3),
        minY: PLAY_MIN_Y - 3, maxY: PLAY_MAX_Y + 3
    };
    updateBullets(world.bullets, dt, cullBox, world.terrain,
        (b) => sparkHit(b.x, b.y, 0x9fe8ff));
    updateBullets(world.enemyBullets, dt, cullBox, null);

    // S10 temporal loop (boss phase may have armed it)
    if (temporal.active) updateTemporal(temporal, dt, world);

    if (world.boss) updateBoss(world.boss, dt, world);

    resolveCollisions(dt);

    if (pendingBoss) {
        const id = pendingBoss;
        pendingBoss = null;
        if (world.boss) disposeBoss(world.boss, scene);
        createBoss(id, scene, world);
    }
    levelCleared = false;

    renderCastTags();
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
    // G toggles god mode anytime (dev convenience; also works outside full DEV).
    if (input.godPressed) toggleGodMode();
    updateMusic(dt);

    const confirm = input.firePressed || input.skipPressed;

    switch (state) {
        case STATE.TITLE: {
            const d = menuTick();
            const dy = menuTickY();
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
            // Left/right: difficulty. Up/down: title menu (launch / options / codex).
            if (d !== 0) {
                const i = DIFFICULTIES.indexOf(getSetting('difficulty'));
                const ni = Math.max(0, Math.min(DIFFICULTIES.length - 1, i + d));
                setSetting('difficulty', DIFFICULTIES[ni]);
                sfx.uiMove();
                renderOverlay();
            }
            const haveCodex = unlockedCodex().length > 0;
            const titleItems = 2 + (haveCodex ? 1 : 0);
            if (dy !== 0) {
                // axisY: +1 is up in stick space for ship; menus treat + as up visually
                // so invert so "up" moves selection up the list.
                titleChoice = (titleChoice - dy + titleItems) % titleItems;
                sfx.uiMove();
                renderOverlay();
            }
            if (input.dronePressed && haveCodex) {
                codexOpen = true; codexIndex = 0; sfx.uiConfirm(); renderOverlay();
                consumeAnyKey();
                break;
            }
            if (confirm) {
                initAudio();
                if (titleChoice === 0) {
                    openLoadout();
                } else if (titleChoice === 1) {
                    openOptions(STATE.TITLE);
                } else {
                    codexOpen = true; codexIndex = 0; sfx.uiConfirm(); renderOverlay();
                }
            }
            consumeAnyKey();
            break;
        }

        case STATE.LOADOUT: {
            const d = menuTick();
            const dy = menuTickY();
            if (input.pausePressed) {
                sfx.uiBack();
                setState(STATE.TITLE);
                break;
            }
            if (dy !== 0) {
                loadoutFocus = (loadoutFocus - dy + MAX_DRONES) % MAX_DRONES;
                sfx.loadoutTick();
                renderOverlay();
            }
            if (d !== 0) {
                loadoutSeats = cycleSeat(loadoutSeats, loadoutFocus, d);
                sfx.loadoutTick();
                renderOverlay();
            }
            if (confirm) applyLoadoutAndLaunch();
            consumeAnyKey();
            break;
        }

        case STATE.TIP: {
            if (input.pausePressed) {
                dismissTip(true);
                sfx.uiBack();
            } else if (confirm || input.skipPressed) {
                dismissTip(false);
                sfx.uiConfirm();
            }
            consumeAnyKey();
            break;
        }

        case STATE.OPTIONS: {
            if (rebindWaiting) {
                if (input.pausePressed) {
                    rebindWaiting = null;
                    rebindConflict = null;
                    sfx.uiBack();
                    renderOverlay();
                    consumeAnyKey();
                    break;
                }
                // Capture next physical key via boot's rebind listener.
                consumeAnyKey();
                break;
            }
            const d = menuTick();
            const dy = menuTickY();
            if (input.pausePressed) {
                sfx.uiBack();
                setState(optionsFrom === STATE.PAUSED ? STATE.PAUSED : STATE.TITLE);
                break;
            }
            if (dy !== 0) {
                optionsCursor = (optionsCursor - dy + OPTIONS_ROWS.length) % OPTIONS_ROWS.length;
                sfx.uiMove();
                renderOverlay();
            }
            const row = OPTIONS_ROWS[optionsCursor];
            if (row.type === 'vol' && d !== 0) {
                const cur = Number(getSetting(row.key)) || 0;
                const next = Math.max(0, Math.min(1, Math.round((cur + d * 0.1) * 10) / 10));
                setSetting(row.key, next);
                sfx.uiMove();
                renderOverlay();
            }
            if (row.type === 'enum' && d !== 0) {
                const vals = row.values;
                let i = vals.indexOf(getSetting(row.key));
                if (i < 0) i = 0;
                i = (i + d + vals.length) % vals.length;
                setSetting(row.key, vals[i]);
                if (row.key === 'quality') setQuality(vals[i]);
                sfx.uiMove();
                renderOverlay();
            }
            if (confirm || (row.type === 'bool' && d !== 0)) {
                if (row.type === 'bool') {
                    setSetting(row.key, !getSetting(row.key));
                    if (row.key === 'largerHud') applyHudA11y();
                    sfx.uiConfirm();
                    renderOverlay();
                } else if (row.type === 'rebind') {
                    rebindCursor = 0;
                    rebindConflict = null;
                    rebindWaiting = REBIND_ACTIONS[0];
                    sfx.uiConfirm();
                    renderOverlay();
                } else if (row.type === 'reset') {
                    resetSettingsDefaults();
                    refreshBindings();
                    applyHudA11y();
                    try {
                        const q = getSetting('quality') || 'high';
                        setQuality(q);
                    } catch (e) { /* ignore */ }
                    sfx.uiConfirm();
                    renderOverlay();
                } else if (row.type === 'back') {
                    sfx.uiBack();
                    setState(optionsFrom === STATE.PAUSED ? STATE.PAUSED : STATE.TITLE);
                } else if (row.type === 'vol' && confirm) {
                    // no-op; volumes use left/right
                } else if (row.type === 'enum' && confirm) {
                    // left/right cycles
                }
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

        case STATE.CUTSCENE: {
            updateCineCamera(dt, world.level);
            const empty = !comms.current && (!comms.queue || !comms.queue.length);
            updateComms(comms, dt, input.skipPressed);
            if (input.skipPressed || input.firePressed) {
                // Skip only after a short grace so a leftover confirm doesn't eat it.
                if (stateT > 0.35) skipCutscene(cutscene);
            }
            if (!updateCutscene(cutscene, dt, empty && !comms.current)) {
                // finished via update or skip
            }
            break;
        }

        case STATE.PAUSED:
            if (input.pausePressed) setState(prevState);
            else if (input.dronePressed) openOptions(STATE.PAUSED);
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
    if (state === STATE.PLAYING || state === STATE.DEATH || state === STATE.CUTSCENE) {
        if (state !== STATE.CUTSCENE) updateComms(comms, dt, input.skipPressed);
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

/** S2 cast tags — DOM labels over casting enemies / weakpoints. */
function renderCastTags() {
    if (!dom.castLayer) return;
    const layer = dom.castLayer;
    const need = [];
    for (const e of world.enemies.items) {
        if (!e.alive) continue;
        if (e.castT > 0 && e.cast && e.cast.text) {
            need.push({ x: e.x, y: e.y + 0.9, text: e.cast.text, kind: 'cast' });
        } else if (e.weakpointT > 0) {
            need.push({ x: e.x, y: e.y + 0.9, text: '!!', kind: 'wp' });
        }
    }
    while (layer.children.length < need.length) {
        const el = document.createElement('div');
        el.className = 'castTag';
        layer.appendChild(el);
    }
    for (let i = 0; i < layer.children.length; i++) {
        const el = layer.children[i];
        const n = need[i];
        if (!n) { el.style.display = 'none'; continue; }
        el.style.display = 'block';
        el.textContent = n.text;
        el.className = 'castTag' + (n.kind === 'wp' ? ' wp' : '');
        // Project world XY (z=0) to screen.
        const v = new THREE.Vector3(n.x, n.y, 0);
        v.project(camera);
        const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
        el.style.left = sx + 'px';
        el.style.top = sy + 'px';
    }
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
    world.onWordBullet = () => { if (sfx.wordFire) sfx.wordFire(); };
    world.onBossPhase = () => { if (sfx.phaseShift) sfx.phaseShift(); };

    bulletFx = new BulletRenderer(scene);
    player = createPlayer(scene, world);
    createWitness(scene, world);
    createDrones(scene, world);
    createPickups(scene, world);
    loadoutSeats = loadSavedLoadout();
    equipDrones(world.drones, loadoutSeats);

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
    applyHudA11y();
    try {
        const q = getSetting('quality');
        if (q) setQuality(q);
    } catch (e) { /* ignore */ }
    onSettingChange((key) => {
        if (key === 'masterVolume' || key === 'sfxVolume' || key === 'musicVolume') syncVolumes();
        if (key === 'reduceHorrorAudio') syncVolumes();
        if (key === 'largerHud' || key === '*') applyHudA11y();
        if (key === 'quality') {
            try { setQuality(getSetting('quality') || 'high'); } catch (e) { /* ignore */ }
        }
    });

    // ── quality tiers (PLAN.md Phase 8): keys 1/2/3 pick a tier, like the
    //    showcase example. A settings menu can call setQuality() the same way.
    // ── secret dev mode: press Ctrl (either side) ten times. Toggles god +
    //    debug overlay + cutscene skip. Scores suppressed while active.
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Digit1' && !e.ctrlKey) setQuality('low');
        else if (e.code === 'Digit2' && !e.ctrlKey) setQuality('high');
        else if (e.code === 'Digit3' && !e.ctrlKey) setQuality('ultra');

        if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
            if (e.repeat) return;
            noteCtrlTap();
        }

        // Options rebind capture (full map + conflict warn)
        if (state === STATE.OPTIONS && rebindWaiting && !e.repeat) {
            if (e.code === 'Escape') {
                rebindWaiting = null;
                rebindConflict = null;
                sfx.uiBack();
                renderOverlay();
                return;
            }
            e.preventDefault();
            const action = rebindWaiting;
            const custom = Object.assign({}, getSetting('keybindings') || {});
            const { next, conflict } = proposeRebind(action, e.code, custom);
            rebindConflict = conflict;
            setSetting('keybindings', next);
            refreshBindings();
            sfx.uiConfirm();
            rebindCursor = (rebindCursor + 1) % REBIND_ACTIONS.length;
            if (rebindCursor === 0) {
                rebindWaiting = null;
                rebindConflict = null;
            } else {
                rebindWaiting = REBIND_ACTIONS[rebindCursor];
            }
            renderOverlay();
            return;
        }

        // Dev-only cheats (only while the badge is on)
        if (devMode) {
            // Shift+1..0 → jump to level 1..10 and restart the run
            if (e.shiftKey && e.code.startsWith('Digit')) {
                const n = e.code === 'Digit0' ? 10 : Number(e.code.slice(5));
                if (n >= 1 && n <= LAST_LEVEL) {
                    e.preventDefault();
                    keepScore = true;
                    startRun(0, n);
                    world.flashPickup && world.flashPickup('L' + (n < 10 ? '0' : '') + n);
                }
            }
        }
    });

    // ── authoring tools (LEVELS_PLAN §8): ?x= start scrolled, ?god=1 invincible.
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    startAtX = Math.max(0, Number(params.get('x')) || 0);
    godMode = params.get('god') === '1';
    skipCutscenes = params.get('skipcs') === '1' || params.has('x');
    // Smoke + authoring: skipcs also skips tips so TITLE→LOADOUT→PLAYING stays one path.
    skipTips = params.get('skiptips') === '1' || skipCutscenes || params.get('dev') === '1';
    if (params.has('debug')) debugOn = true;
    if (params.get('dev') === '1') setDevMode(true);
    if (godMode && dom.godBadge) dom.godBadge.classList.add('on');

    // Boss signature callbacks
    world.onBossIntegrated = () => {
        world.flashPickup && world.flashPickup('INTEGRATED');
        sfx.bigBoom();
    };
    world.onBossTimeout = () => {
        if (player && player.alive) killPlayer(player, world, true);
    };

    window.addEventListener('resize', onResize);
    window.__engineKit = { renderer, composer, scene };
    window.__gumoi = {
        world, getState, setState,
        debugText: () => (dom.debug ? dom.debug.textContent : ''),
        setDebug: (on) => { debugOn = !!on; },
        timeline: () => levelTimeline(runner, 8),
        isDevMode: () => devMode,
        setDevMode,
        isGodMode: () => godMode,
        setGodMode,
        toggleGodMode,
        getRunner: () => runner
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
let skipCutscenes = false;
/** Skip first-run tips (smoke / authoring). Set by ?skiptips=1 or with skipcs. */
let skipTips = false;
/** Secret authoring mode: Ctrl × 10 (Windows). God + debug + skip cutscenes. */
let devMode = false;
let _ctrlTaps = 0;
let _ctrlTapAt = 0;
const CTRL_TAP_NEED = 10;
const CTRL_TAP_WINDOW_MS = 2500;   // gap longer than this resets the count

function noteCtrlTap() {
    const now = performance.now();
    if (now - _ctrlTapAt > CTRL_TAP_WINDOW_MS) _ctrlTaps = 0;
    _ctrlTapAt = now;
    _ctrlTaps++;
    if (_ctrlTaps >= CTRL_TAP_NEED) {
        _ctrlTaps = 0;
        setDevMode(!devMode);
    }
}

/** Toggle invincibility (KeyG). Scores are not recorded while god is on. */
export function toggleGodMode() {
    setGodMode(!godMode);
}

export function setGodMode(on) {
    godMode = !!on;
    if (dom.godBadge) dom.godBadge.classList.toggle('on', godMode);
    if (world.flashPickup) world.flashPickup(godMode ? 'GOD ON' : 'GOD OFF');
    if (godMode) sfx.uiConfirm(); else sfx.uiMove();
}

/**
 * Toggle the secret dev/authoring mode.
 * On: god mode, debug overlay, skip cutscenes, score suppressed, level warp.
 * Off: restore non-URL authoring defaults (URL ?god=1 still wins until reload).
 */
export function setDevMode(on) {
    devMode = !!on;
    if (devMode) {
        godMode = true;
        debugOn = true;
        skipCutscenes = true;
        skipTips = true;
        if (dom.devBadge) dom.devBadge.classList.add('on');
        if (dom.godBadge) dom.godBadge.classList.add('on');
        if (world.flashPickup) world.flashPickup('DEV MODE');
        sfx.uiConfirm();
    } else {
        // Leave URL-forced flags alone if the page was loaded with ?god= / ?debug
        const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
        godMode = params.get('god') === '1';
        debugOn = params.has('debug');
        skipCutscenes = params.get('skipcs') === '1' || params.has('x');
        skipTips = params.get('skiptips') === '1' || skipCutscenes;
        if (dom.devBadge) dom.devBadge.classList.remove('on');
        if (dom.godBadge) dom.godBadge.classList.toggle('on', godMode);
        if (world.flashPickup) world.flashPickup('DEV OFF');
        sfx.uiMove();
    }
}

let comms = createComms();
let currentLevelId = 1;
let nextLevelId = 0;
let keepScore = false;          // carry score across a stage-clear transition
let betweenT = 0;               // the ending's own clock
let codexOpen = false;
let codexIndex = 0;

// Phase-9 story / signature systems (NARRATIVE §4 S2–S10)
let profanity = createProfanity();
let heat = createHeat();
let asymmetry = createAsymmetry();
let mods = createModStack();
let recorder = createRecorder(8, 30);
let predictor = createPredictor();
let temporal = createTemporalLoop(12);
let cutscene = createCutscenePlayer();
let shadowMesh = null;
let shadowT = 0;

function spawnEnemyShotFromShadow(snap) {
    spawn(world.enemyBullets, {
        x: snap.x, y: snap.y, vx: -12, vy: 0,
        r: 0.14, dmg: 5, kind: KIND.ENEMY_ORB, hitsTerrain: false
    });
}

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

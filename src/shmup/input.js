// src/shmup/input.js
// Purpose: one polled input snapshot for the whole game — keyboard + gamepad.
// Dependencies: engine/settings.js (keybindings shape only)
//
// PLAN.md Phase 0, amended by NARRATIVE_PLAN C6 (weapon switch is a mechanic)
// and C5 (double-tap the dock key = Mirror Counter). Edge detection
// (*Pressed / *Released) is computed exactly once per frame in update(), so
// every consumer in a frame sees the same edges no matter when it polls.

import { getSetting } from '../engine/settings.js';

// action -> KeyboardEvent.code list. getSetting('keybindings') may override
// any entry with the same shape ({action: [codes]}); unknown actions ignored.
export const DEFAULT_BINDINGS = {
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    fire: ['KeyZ', 'KeyJ', 'Space'],
    dock: ['KeyX', 'KeyK'],          // Witness detach / recall (double-tap = Mirror Counter)
    swap: ['KeyC', 'KeyL'],          // Siren Pulse <-> Hammer Round (C6)
    drone: ['KeyV', 'KeyH'],         // Council drone trigger
    profanity: ['KeyF'],             // L4 Profanity Key (S7) — cancels word-bullets
    god: ['KeyG'],                   // toggle god mode (invincible; score not recorded)
    pause: ['Escape', 'KeyP'],
    debug: ['Backquote'],
    skip: ['Enter', 'Space']         // cutscene / comms advance
};

// Gamepad (standard mapping): 0=A/cross 1=B/circle 2=X/square 3=Y/triangle,
// 9=start, 12-15 = dpad up/down/left/right.
const PAD = { fire: [0, 7], dock: [1, 5], swap: [2, 4], drone: [3], profanity: [6], god: [10], pause: [9], skip: [0, 9] };
const PAD_DPAD = { up: 12, down: 13, left: 14, right: 15 };
const STICK_DEADZONE = 0.22;

// Double-tap window for the Mirror Counter (C5). Generous enough to be
// reachable under pressure, tight enough that a panic double-recall is rare.
const DOUBLE_TAP_S = 0.28;

const ACTIONS = Object.keys(DEFAULT_BINDINGS);

function resolveBindings() {
    const custom = getSetting('keybindings');
    const map = {};
    for (const a of ACTIONS) map[a] = DEFAULT_BINDINGS[a].slice();
    if (custom && typeof custom === 'object') {
        for (const a of ACTIONS) {
            if (Array.isArray(custom[a]) && custom[a].length) map[a] = custom[a].slice();
        }
    }
    // code -> action reverse index (a code may drive only one action; last wins)
    const byCode = {};
    for (const a of ACTIONS) for (const code of map[a]) byCode[code] = a;
    return { map, byCode };
}

export const input = {
    axisX: 0,
    axisY: 0,
    // held / edges, one field per action (fire, firePressed, fireReleased, ...)
    fire: false, firePressed: false, fireReleased: false, fireHeldFor: 0,
    dock: false, dockPressed: false, dockReleased: false,
    swap: false, swapPressed: false, swapReleased: false,
    drone: false, dronePressed: false, droneReleased: false,
    profanity: false, profanityPressed: false, profanityReleased: false,
    god: false, godPressed: false, godReleased: false,
    pause: false, pausePressed: false,
    debug: false, debugPressed: false,
    skip: false, skipPressed: false,
    /** True on the frame a second dock press lands inside DOUBLE_TAP_S. */
    dockDoubleTap: false,
    /** True on any key/button/click since the last consumeAnyKey(). */
    anyKey: false,
    gamepadIndex: -1
};

const _down = new Set();          // raw held state, written by DOM events
// Keys pressed since the last updateInput(). A fast tap can go down AND up
// inside a single frame — without this, actionHeld() would never see it and
// the press edge would silently vanish. Anything in here counts as held for
// exactly one update, guaranteeing every tap produces a *Pressed edge.
const _tapped = new Set();
const _prev = {};                 // last frame's held state per action
let _bindings = resolveBindings();
let _lastDockTapAt = -99;
let _now = 0;
let _attached = false;

function actionHeld(action) {
    for (const code of _bindings.map[action]) {
        if (_down.has(code) || _tapped.has(code)) return true;
    }
    return false;
}

function onKeyDown(e) {
    // Don't swallow devtools/refresh; do swallow arrows+space so the page
    // never scrolls under the canvas.
    const action = _bindings.byCode[e.code];
    if (action) e.preventDefault();
    if (e.repeat) return;
    _down.add(e.code);
    _tapped.add(e.code);
    input.anyKey = true;
}

function onKeyUp(e) {
    _down.delete(e.code);
}

function onBlur() {
    // A lost window must not leave the ship flying into a wall forever.
    _down.clear();
    _tapped.clear();
}

/** Attach DOM listeners. Idempotent; safe to call before the game starts. */
export function initInput(target = window) {
    if (_attached) return;
    _attached = true;
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);
    target.addEventListener('pointerdown', () => { input.anyKey = true; });
    target.addEventListener('gamepadconnected', (e) => { input.gamepadIndex = e.gamepad.index; });
    target.addEventListener('gamepaddisconnected', () => { input.gamepadIndex = -1; });
}

/** Re-read keybindings from settings (call after a rebind). */
export function refreshBindings() {
    _bindings = resolveBindings();
}

function readGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;
    if (input.gamepadIndex >= 0 && pads[input.gamepadIndex]) return pads[input.gamepadIndex];
    for (const p of pads) if (p && p.connected) { input.gamepadIndex = p.index; return p; }
    return null;
}

function dz(v) {
    return Math.abs(v) < STICK_DEADZONE ? 0 : v;
}

/**
 * Poll everything once per frame, BEFORE any consumer reads `input`.
 * @param {number} dt seconds (clamped by the caller)
 */
export function updateInput(dt = 0) {
    _now += dt;
    const pad = readGamepad();

    // ── axes: keyboard is digital, stick is analog; the larger magnitude wins
    let ax = (actionHeld('right') ? 1 : 0) - (actionHeld('left') ? 1 : 0);
    let ay = (actionHeld('up') ? 1 : 0) - (actionHeld('down') ? 1 : 0);
    if (pad) {
        const px = dz(pad.axes[0] || 0);
        const py = -dz(pad.axes[1] || 0);   // pad Y is inverted vs our +Y = up
        if (pad.buttons[PAD_DPAD.right] && pad.buttons[PAD_DPAD.right].pressed) ax = 1;
        if (pad.buttons[PAD_DPAD.left] && pad.buttons[PAD_DPAD.left].pressed) ax = -1;
        if (pad.buttons[PAD_DPAD.up] && pad.buttons[PAD_DPAD.up].pressed) ay = 1;
        if (pad.buttons[PAD_DPAD.down] && pad.buttons[PAD_DPAD.down].pressed) ay = -1;
        if (Math.abs(px) > Math.abs(ax)) ax = px;
        if (Math.abs(py) > Math.abs(ay)) ay = py;
        if (pad.buttons.some((b) => b && b.pressed)) input.anyKey = true;
    }
    // Clamp the diagonal so stick + keyboard agree on top speed.
    const mag = Math.hypot(ax, ay);
    if (mag > 1) { ax /= mag; ay /= mag; }
    input.axisX = ax;
    input.axisY = ay;

    // ── buttons + edges
    for (const a of ACTIONS) {
        if (a === 'up' || a === 'down' || a === 'left' || a === 'right') continue;
        let held = actionHeld(a);
        const padBtns = PAD[a];
        if (pad && padBtns) {
            for (const i of padBtns) {
                if (pad.buttons[i] && pad.buttons[i].pressed) { held = true; break; }
            }
        }
        const was = !!_prev[a];
        input[a] = held;
        input[a + 'Pressed'] = held && !was;
        input[a + 'Released'] = !held && was;
        _prev[a] = held;
    }

    // Charge timer for the Siren Pulse's tap-vs-hold discrimination.
    input.fireHeldFor = input.fire ? input.fireHeldFor + dt : 0;

    // Mirror Counter: a dock press within DOUBLE_TAP_S of the previous one.
    input.dockDoubleTap = false;
    if (input.dockPressed) {
        if (_now - _lastDockTapAt <= DOUBLE_TAP_S) {
            input.dockDoubleTap = true;
            _lastDockTapAt = -99;          // consume, so a triple-tap isn't two counters
        } else {
            _lastDockTapAt = _now;
        }
    }

    _tapped.clear();
}

/** Read-and-clear the "player touched something" flag (start gate, skips). */
export function consumeAnyKey() {
    const v = input.anyKey;
    input.anyKey = false;
    return v;
}

/** Test hook: force a key down/up without a real DOM event. */
export function setKeyForTest(code, down) {
    if (down) _down.add(code); else _down.delete(code);
}

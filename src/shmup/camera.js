// src/shmup/camera.js
// Purpose: the auto-scrolling side-on shmup camera + the screen bounds every
// other system agrees on. PLAN.md §2.2.
// Dependencies: engine/renderer.js (repositions its exported camera; never edits it)
//
// The engine's camera object is a plain THREE.PerspectiveCamera that index.html
// already repositions per frame — doing the same from here is the intended
// pattern, not a hack. We own position + lookAt every frame; nothing else does.

import { camera, visibleHalfWidthAt } from '../engine/renderer.js';

// Framing, tuned by eye (PLAN.md §2.2 explicitly invites this): we want the
// 16-unit playfield band to just fill the screen height, so the Vessel reads at
// a useful size. The engine's fov 65 needed z ≈ 14 for that, which bent the
// screen edges badly under perspective — so take the escape hatch the plan
// offers: narrow the fov and pull back to keep the same framing.
//   halfHeight = CAM_Z * tan(fov/2) = 19.5 * tan(25°) ≈ 9.1  → band [0,16] fits.
export const CAM_FOV = 50;
/** Camera distance from the play plane (z = 0). */
export const CAM_Z = 19.5;
/** The playfield's vertical center — matches the engine camera's lookAt height. */
export const PLAY_Y = 8;
/** Playfield vertical band (PLAN.md §2.1). Terrain lives at the edges of it. */
export const PLAY_MIN_Y = 0;
export const PLAY_MAX_Y = 16;
/** Keep the ship a hair off the true screen edge. */
export const EDGE_MARGIN = 1;

/** Where the level has scrolled to. The level's "playhead". */
export let scrollX = 0;

camera.fov = CAM_FOV;
camera.updateProjectionMatrix();

let _shakeAmp = 0;
let _shakeDecay = 1;
let _shakeT = 0;
const _bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

/** Put the playhead at an absolute x (level start, checkpoint rewind). */
export function setScrollX(x) {
    scrollX = x;
    applyCamera();
}

/**
 * Advance the playhead and reposition the camera.
 * @param {number} dt seconds
 * @param {{scrollSpeed:number, scrollLocked?:boolean, backgroundLayers?:Array}} level
 */
export function updateShmupCamera(dt, level) {
    const speed = (level && !level.scrollLocked) ? (level.scrollSpeed || 0) : 0;
    scrollX += speed * dt;

    if (_shakeAmp > 0) {
        _shakeT += dt;
        _shakeAmp = Math.max(0, _shakeAmp - _shakeDecay * dt);
    } else {
        _shakeT = 0;
    }

    applyCamera();

    if (level && level.backgroundLayers) {
        for (const layer of level.backgroundLayers) {
            const rate = (layer.userData && layer.userData.scrollRate) || 0;
            layer.position.x = -camera.position.x * rate;
        }
    }
}

function applyCamera() {
    // Base pose first, then the shake as a pure additive offset — it must never
    // accumulate into scrollX, or a few explosions would drift the whole level.
    camera.position.set(scrollX, PLAY_Y, CAM_Z);
    camera.lookAt(scrollX, PLAY_Y, 0);
    if (_shakeAmp > 0) {
        camera.position.x += Math.sin(_shakeT * 61) * _shakeAmp;
        camera.position.y += Math.sin(_shakeT * 47 + 1.7) * _shakeAmp;
    }
    // visibleHalfWidthAt() unprojects through camera.matrixWorld, and
    // playerBounds() is read before the renderer would refresh it — so refresh
    // it here, or every bound is one frame stale during a shake.
    camera.updateMatrixWorld();
}

/**
 * Kick the camera. `amp` in world units (0.15 = a hit, 0.6 = a boss dying).
 * A bigger shake always wins over a smaller one still decaying.
 */
export function shakeCamera(amp, decay = 2.2) {
    if (amp > _shakeAmp) {
        _shakeAmp = amp;
        _shakeDecay = decay;
    }
}

export function clearShake() {
    _shakeAmp = 0;
    _shakeT = 0;
}

/** Half-height of the view at the play plane: dist * tan(fov/2). */
export function visibleHalfHeight() {
    return CAM_Z * Math.tan((camera.fov * Math.PI / 180) / 2);
}

/**
 * The rectangle the Vessel may occupy, in world units. The HUD, the ship
 * clamp, and the bullet despawn all read THIS — they can't disagree.
 * Returns a shared object; copy it if you need to keep it.
 */
export function playerBounds() {
    const hw = visibleHalfWidthAt(0);
    const hh = visibleHalfHeight();
    _bounds.minX = scrollX - hw + EDGE_MARGIN;
    _bounds.maxX = scrollX + hw - EDGE_MARGIN;
    // The playfield band wins over the view when the view is taller than it.
    _bounds.minY = Math.max(PLAY_MIN_Y + EDGE_MARGIN, PLAY_Y - hh + EDGE_MARGIN);
    _bounds.maxY = Math.min(PLAY_MAX_Y - EDGE_MARGIN, PLAY_Y + hh - EDGE_MARGIN);
    return _bounds;
}

/** X past the right screen edge where spawns appear / bullets despawn. */
export function spawnX(pad = 3) {
    return scrollX + visibleHalfWidthAt(0) + pad;
}

/** X behind the left screen edge where anything off-screen is culled. */
export function despawnX(pad = 4) {
    return scrollX - visibleHalfWidthAt(0) - pad;
}

/** True if (x,y) is on screen (with a pad in world units). */
export function onScreen(x, y, pad = 2) {
    const hw = visibleHalfWidthAt(0);
    const hh = visibleHalfHeight();
    return x > scrollX - hw - pad && x < scrollX + hw + pad
        && y > PLAY_Y - hh - pad && y < PLAY_Y + hh + pad;
}

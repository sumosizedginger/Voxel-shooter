// src/engine/lights.js
// Purpose: Ambient + key/fill/rim directional lights.
// Dependencies: ./renderer.js, global THREE

import { scene } from './renderer.js';

import * as THREE from 'three';

// Offset of the key light from its target (the point it's aimed at). Kept
// fixed so the sun angle never changes as the frustum follows the camera.
const KEY_OFFSET = new THREE.Vector3(45, 60, 25);

let keySunRef = null;

export function initLights() {
    scene.add(new THREE.AmbientLight(0x241a3a, 0.5));

    const keySun = new THREE.DirectionalLight(0xffedd0, 1.35);
    keySun.position.copy(KEY_OFFSET);
    keySun.castShadow = true;
    keySun.shadow.mapSize.set(2048, 2048);
    keySun.shadow.camera.near = 10;
    keySun.shadow.camera.far = 180;
    // Tightened from +/-40 to +/-30 (Graphics.md Phase D) — combined with
    // updateShadowFollow() tracking the camera, this raises effective shadow
    // texel density without losing coverage of the visible play area.
    keySun.shadow.camera.left = -30;
    keySun.shadow.camera.right = 30;
    keySun.shadow.camera.top = 30;
    keySun.shadow.camera.bottom = -30;
    keySun.shadow.bias = -0.0005;
    keySun.shadow.normalBias = 0.02;
    keySun.shadow.camera.updateProjectionMatrix();
    scene.add(keySun);
    // The light's target must be in the scene graph for its matrixWorld to
    // update — otherwise it silently stays at the identity transform (0,0,0)
    // and updateShadowFollow()'s target repositioning below has no effect.
    scene.add(keySun.target);
    keySunRef = keySun;

    const fillNeon = new THREE.DirectionalLight(0x7050aa, 0.7);
    fillNeon.position.set(-35, 15, -25);
    scene.add(fillNeon);

    const rimWarm = new THREE.DirectionalLight(0xff7733, 0.65);
    rimWarm.position.set(10, -5, -40);
    scene.add(rimWarm);

    return { keySun, fillNeon, rimWarm };
}

/**
 * Re-center the key light's shadow frustum on the camera's X position each
 * frame. The level scrolls on X only (2.5D side-scroller); without this the
 * shadow frustum stays fixed at world origin and characters lose their
 * shadow once they scroll outside the original +/-30 unit box.
 * @param {number} cameraX
 */
export function updateShadowFollow(cameraX) {
    if (!keySunRef) return;
    keySunRef.position.set(cameraX + KEY_OFFSET.x, KEY_OFFSET.y, KEY_OFFSET.z);
    keySunRef.target.position.set(cameraX, 0, 0);
}

/**
 * Change the key light's shadow map resolution (used by the quality-tier
 * system). Disposing the existing shadow map forces WebGLRenderer to
 * regenerate it at the new size on the next frame.
 * @param {number} size square shadow map resolution, e.g. 1024/2048/4096
 */
export function setShadowMapSize(size) {
    if (!keySunRef) return;
    if (keySunRef.shadow.mapSize.width === size) return;
    keySunRef.shadow.mapSize.set(size, size);
    if (keySunRef.shadow.map) {
        keySunRef.shadow.map.dispose();
        keySunRef.shadow.map = null;
    }
}

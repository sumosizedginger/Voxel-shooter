// src/shmup/lighting.js
// Purpose: the side-view light rig. Additive on top of engine/lights.js —
// that module is untouched (PLAN.md §1).
// Dependencies: engine/{renderer,lights}
//
// engine/lights.js is aimed at a brawler: its key sun sits high at (45,60,25)
// and rakes a ground plane. In a side-on shmup the interesting surfaces face
// +Z (at the camera) and the ground plane is a wall, so that rig lights the
// tops of things and leaves the faces we actually look at in shadow. Rather
// than fight it, we keep it (it still gives shape and shadows) and add a
// camera-side key that makes the play plane legible.

import * as THREE from 'three';
import { scene, vignettePass } from '../engine/renderer.js';
import { initLights } from '../engine/lights.js';

let rig = null;

/** Call once at boot, instead of initLights(). Returns the added lights. */
export function initShmupLights() {
    if (rig) return rig;
    const base = initLights();

    // Key: from the camera's shoulder, so voxel faces pointing at us are lit.
    const face = new THREE.DirectionalLight(0xfff0dd, 1.5);
    face.position.set(6, 10, 30);
    face.target.position.set(0, 8, 0);
    scene.add(face);
    scene.add(face.target);

    // Cool bounce from below-behind — separates silhouettes from the backdrop
    // without washing out the dark hull the Vessel needs to stay dark.
    const bounce = new THREE.DirectionalLight(0x6a7cff, 0.45);
    bounce.position.set(-14, -6, 12);
    scene.add(bounce);

    // Lift the floor of the image so nothing reads as pure black.
    const amb = new THREE.AmbientLight(0x5a5470, 0.55);
    scene.add(amb);

    // The kit's vignette is tuned for a brawler that keeps the action centered.
    // A shmup does the opposite: enemies enter at the right edge and the player
    // lives near the left one, so a strong vignette hides exactly the pixels the
    // game is played on. Soften it to a mood cue rather than a mask.
    // The shader is `mix(texel, vec3(1.0 - darkness), dot(uv, uv))` with
    // uv = (vUv - 0.5) * offset — so `offset` is the STRENGTH knob (it scales
    // the mix amount), and `darkness` must stay >= 1.0 or the corners mix
    // toward gray instead of black. Lower the strength; leave darkness alone.
    // (Uniform tweak on the exported pass; renderer.js itself is untouched.)
    vignettePass.uniforms.offset.value = 0.62;
    vignettePass.uniforms.darkness.value = 1.15;

    rig = { ...base, face, bounce, amb };
    return rig;
}

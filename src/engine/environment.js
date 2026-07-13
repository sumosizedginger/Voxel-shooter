// src/engine/environment.js
// Purpose: PMREM image-based lighting environment map, swapped per level theme.
// Dependencies: three, ./renderer.js
//
// Reuses the equirectangular skybox textures already loaded by skybox.js —
// no extra downloads. Applies scene.environment globally so every
// MeshStandardMaterial (weapons, props, characters) picks up reflections
// without cloning materials (AGENTS.md invariant: one material per character).

import * as THREE from 'three';
import { scene, renderer } from './renderer.js';

let pmrem = null;
// themeId -> { texture: THREE.Texture, sourceUuid: string }
const envCache = {};

function getGenerator() {
    if (!pmrem) {
        pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
    }
    return pmrem;
}

/**
 * Generate (or reuse) a PMREM env map from an already-loaded equirectangular
 * texture and cache it under `themeId`. Safe to call repeatedly — only
 * regenerates if the source texture instance changed.
 * @returns {THREE.Texture|null} the env map, or null if generation failed
 *   (e.g. unsupported headless GL context — callers should degrade gracefully).
 */
export function generateEnvironmentFromTexture(themeId, sourceTexture) {
    if (!sourceTexture) return null;
    const cached = envCache[themeId];
    if (cached && cached.sourceUuid === sourceTexture.uuid) return cached.texture;
    try {
        const rt = getGenerator().fromEquirectangular(sourceTexture);
        if (cached && cached.texture) cached.texture.dispose();
        envCache[themeId] = { texture: rt.texture, sourceUuid: sourceTexture.uuid };
        return rt.texture;
    } catch (e) {
        // PMREM can fail under some headless/ANGLE configs — the game must
        // still render (flat lighting, no reflections) rather than crash.
        return null;
    }
}

/**
 * Apply the cached environment map for `themeId` to the scene, if ready.
 * This module is intentionally tier-agnostic (no dependency on quality.js,
 * to keep the import graph acyclic) — callers (skybox.js, quality.js) are
 * responsible for checking TIERS[getQuality()].env before calling this, and
 * for calling clearEnvironment() instead when the tier disables env maps.
 */
export function applyEnvironmentForTheme(themeId) {
    const cached = envCache[themeId];
    scene.environment = cached ? cached.texture : null;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.6;
}

/** Explicitly clear the scene environment map (quality tier disabled it). */
export function clearEnvironment() {
    scene.environment = null;
}

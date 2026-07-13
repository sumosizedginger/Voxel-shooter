// src/engine/textures.js
// Purpose: Load tileable ground/wall textures + UI frame art (Phase 03).
// Dependencies: global THREE

import * as THREE from 'three';
const loader = new THREE.TextureLoader();

const cache = {};

export const TEXTURE_URLS = {
    groundAsphalt: 'src/assets/textures/ground-asphalt-wet.png',
    groundLab: 'src/assets/textures/ground-lab-tile.png',
    groundAlien: 'src/assets/textures/ground-alen-flesh.png',
    wallConcrete: 'src/assets/textures/wall-concrete-neon.png',
    wallLab: 'src/assets/textures/wall-lab-panel.png',
    wallAlien: 'src/assets/textures/wall-alien-bio.png',
    uiHealth: 'src/assets/textures/ui-health-frame.png',
    uiStar: 'src/assets/textures/ui-star-meter-frame.png',
    uiBoss: 'src/assets/textures/ui-boss-bar-frame.png',
    titleScreen: 'src/assets/textures/title-screen.png'
};

export function loadTexture(key, opts = {}) {
    if (cache[key]) return cache[key];
    const url = TEXTURE_URLS[key];
    if (!url) return null;
    const tex = loader.load(url);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
    cache[key] = tex;
    return tex;
}

export function groundTextureForTheme(theme) {
    if (theme === 'tech-lab') return loadTexture('groundLab', { repeat: [20, 4] });
    if (theme === 'alien-ship' || theme === 'mothership-core') {
        return loadTexture('groundAlien', { repeat: [16, 4] });
    }
    return loadTexture('groundAsphalt', { repeat: [30, 4] });
}

export function wallTextureForTheme(theme) {
    if (theme === 'tech-lab') return loadTexture('wallLab', { repeat: [2, 4] });
    if (theme === 'alien-ship' || theme === 'mothership-core') {
        return loadTexture('wallAlien', { repeat: [2, 4] });
    }
    return loadTexture('wallConcrete', { repeat: [2, 4] });
}

/** Apply UI frame images to HUD chrome (CSS). */
export function applyUIFrames() {
    const map = {
        'combat-hud': TEXTURE_URLS.uiHealth,
        'boss-bar': TEXTURE_URLS.uiBoss,
        'star-meter-frame': TEXTURE_URLS.uiStar
    };
    for (const [id, url] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.style.backgroundImage = `url('${url}')`;
        el.style.backgroundSize = '100% 100%';
        el.style.backgroundRepeat = 'no-repeat';
    }
    // Star bar track chrome
    const starBar = document.querySelector('#combat-hud .bar:nth-of-type(2)');
    if (starBar) {
        starBar.style.backgroundImage = `url('${TEXTURE_URLS.uiStar}')`;
        starBar.style.backgroundSize = '100% 100%';
    }
    const title = document.getElementById('title-screen');
    if (title) {
        title.style.backgroundImage =
            `linear-gradient(rgba(5,2,15,0.72), rgba(5,2,15,0.88)), url('${TEXTURE_URLS.titleScreen}')`;
        title.style.backgroundSize = 'cover';
        title.style.backgroundPosition = 'center';
    }
}

// src/engine/skybox.js
// Purpose: skyDome sphere + shader OR equirectangular texture swap.
// Dependencies: global THREE

import * as THREE from 'three';
import { generateEnvironmentFromTexture, applyEnvironmentForTheme, clearEnvironment } from './environment.js';
import { getQuality, TIERS } from './quality.js';

const skyMatShader = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uColorTop: { value: new THREE.Color(0x0d0518) },
        uColorMid: { value: new THREE.Color(0x2c153b) },
        uColorBot: { value: new THREE.Color(0x6b2d4c) }
    },
    vertexShader: `
        varying vec3 vWorldPos;
        void main() {
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        varying vec3 vWorldPos;
        uniform float uTime; uniform vec3 uColorTop, uColorMid, uColorBot;
        void main() {
            vec3 nPos = normalize(vWorldPos);
            float h = nPos.y;
            vec3 color = mix(uColorBot, uColorMid, smoothstep(-0.2, 0.3, h));
            color = mix(color, uColorTop, smoothstep(0.2, 0.8, h));
            float n = sin(nPos.x * 120.0) * cos(nPos.z * 120.0) * sin(nPos.y * 120.0);
            if (n > 0.985 && h > 0.1) {
                // Raised for the bloom pass (Graphics.md Phase B) so the
                // brightest star twinkles clear the bloom luminance threshold.
                color += vec3(0.35 * (0.5 + 0.5 * sin(uTime * 3.0 + n * 10.0)));
            }
            gl_FragColor = vec4(color, 1.0);
        }`,
    side: THREE.BackSide,
    depthWrite: false
});

const skyGeo = new THREE.SphereGeometry(180, 24, 24);
export const skyDome = new THREE.Mesh(skyGeo, skyMatShader);
skyDome.renderOrder = -1;

const loader = new THREE.TextureLoader();
const skyTextures = {};
let textureMat = null;
let usingTexture = false;
let texturesLoadStarted = false;
let currentTheme = null;
let currentTint = 0xffffff;

const THEME_COLORS = {
    'neon-city': { top: 0x0d0518, mid: 0x2c153b, bot: 0x6b2d4c },
    'tech-lab': { top: 0x0a1020, mid: 0x203040, bot: 0x405060 },
    'alien-ship': { top: 0x0a0510, mid: 0x201030, bot: 0x302050 },
    'mothership-core': { top: 0x100510, mid: 0x301040, bot: 0x502060 }
};

const TEXTURE_PATHS = {
    'neon-city': 'src/assets/textures/skybox-neon-city.png',
    'tech-lab': 'src/assets/textures/skybox-tech-lab.png',
    'alien-ship': 'src/assets/textures/skybox-alien-ship.png',
    'mothership-core': 'src/assets/textures/skybox-mothership-core.png'
};

function tryLoadTextures() {
    if (texturesLoadStarted) return;
    texturesLoadStarted = true;
    for (const [id, path] of Object.entries(TEXTURE_PATHS)) {
        loader.load(
            path,
            (tex) => {
                tex.mapping = THREE.EquirectangularReflectionMapping;
                tex.colorSpace = THREE.SRGBColorSpace;
                skyTextures[id] = tex;
                if (!textureMat) {
                    textureMat = new THREE.MeshBasicMaterial({
                        map: tex,
                        color: currentTint, // per-level sky tint (level variants)
                        side: THREE.BackSide,
                        fog: false,
                        depthWrite: false
                    });
                }
                // PMREM env map (Phase C): reuses this same equirect texture,
                // no extra download. Loads async, so re-apply immediately if
                // this theme is the one currently active AND the active
                // quality tier wants env maps (Phase G) — otherwise a texture
                // that finishes loading after the user dropped to a
                // low/med tier would silently re-enable reflections.
                generateEnvironmentFromTexture(id, tex);
                if (currentTheme === id && TIERS[getQuality()].env) applyEnvironmentForTheme(id);
            },
            undefined,
            () => {
                // Texture missing — keep shader fallback
            }
        );
    }
}

tryLoadTextures();

/**
 * @param {string} themeId
 * @param {number} [tintHex] per-level sky tint (level variants) — multiplies
 *   the sky texture / shader gradient; 0xffffff leaves it untouched.
 */
export function setSkyboxTheme(themeId, tintHex = 0xffffff) {
    currentTheme = themeId;
    currentTint = tintHex;
    const colors = THEME_COLORS[themeId] || THEME_COLORS['neon-city'];
    const tint = new THREE.Color(tintHex);
    skyMatShader.uniforms.uColorTop.value.setHex(colors.top).multiply(tint);
    skyMatShader.uniforms.uColorMid.value.setHex(colors.mid).multiply(tint);
    skyMatShader.uniforms.uColorBot.value.setHex(colors.bot).multiply(tint);

    // Env map may already be cached (PMREM generated on an earlier visit to
    // this theme); if not ready yet the texture-load callback above will
    // apply it once it arrives. Respect the active quality tier either way.
    if (TIERS[getQuality()].env) {
        applyEnvironmentForTheme(themeId);
    } else {
        clearEnvironment();
    }

    if (skyTextures[themeId] && textureMat) {
        textureMat.map = skyTextures[themeId];
        textureMat.color.setHex(tintHex);
        textureMat.needsUpdate = true;
        if (!usingTexture) {
            skyDome.material = textureMat;
            usingTexture = true;
        }
    } else {
        if (usingTexture) {
            skyDome.material = skyMatShader;
            usingTexture = false;
        }
    }
}

export function updateSkybox(time) {
    if (!usingTexture) {
        skyMatShader.uniforms.uTime.value = time;
    }
    // Slow hue drift for mothership handled in Level.update
}

// src/shmup/bulletmesh.js
// Purpose: draw the bullet pools. One InstancedMesh per bullet family + word sprites.
// Dependencies: three, ./bullets.js (KIND only), ./palette.js, systems/words
//
// PLAN.md §2.4 / ASSETS_PLAN §5. Same technique as engine/particles.js: one
// shared _dummy Object3D, setMatrixAt per live bullet, park the dead ones at
// scale 0.001 far off-screen (cheaper and simpler than resizing the mesh).
//
// ASSETS_PLAN R4 is a hard rule and it lives here: enemy bullets are unlit
// MeshBasicMaterial magenta — the brightest, least-occludable thing on screen.
// If a bullet is ever hard to see, darken the background, not the bullet.
//
// Word bullets (KIND.WORD) use CanvasTexture sprites via makeWordTexture so
// DELVE / TAPESTRY / … are readable; the box family remains as a faint underglow.

import * as THREE from 'three';
import { KIND } from './bullets.js';
import { BULLET_PALETTE } from './palette.js';
import { makeWordTexture } from './systems/words.js';

const PARKED = new THREE.Vector3(0, -9999, 0);

// geometry + material per family. `emissive` families bloom (G3: only emissive
// materials above the 0.85 threshold glow — never lower the threshold).
function families() {
    // Chunkier than "1px against the void" — still smaller than the ship core
    // hitbox, but readable at gameplay zoom (ASSETS_PLAN R4 lives here).
    const boltGeo = new THREE.BoxGeometry(0.62, 0.14, 0.14);
    const orbGeo = new THREE.SphereGeometry(0.18, 10, 8);

    const basic = (color, opts = {}) =>
        new THREE.MeshBasicMaterial({ color, toneMapped: false, ...opts });
    const glow = (color, intensity) => new THREE.MeshStandardMaterial({
        color: 0x000000, emissive: color, emissiveIntensity: intensity, toneMapped: false
    });

    return {
        [KIND.PLAYER_BOLT]: { geo: boltGeo, mat: basic(BULLET_PALETTE.player), cap: 96 },
        [KIND.BIT]: { geo: new THREE.BoxGeometry(0.4, 0.1, 0.1), mat: basic(BULLET_PALETTE.player), cap: 48 },
        [KIND.PULSE_1]: { geo: new THREE.BoxGeometry(0.85, 0.18, 0.18), mat: glow(BULLET_PALETTE.player, 1.9), cap: 32 },
        [KIND.PULSE_2]: { geo: new THREE.BoxGeometry(1.7, 0.36, 0.36), mat: glow(BULLET_PALETTE.playerHot, 2.3), cap: 16 },
        [KIND.PULSE_3]: { geo: new THREE.BoxGeometry(2.6, 0.9, 0.9), mat: glow(BULLET_PALETTE.playerHot, 2.8), cap: 16 },
        [KIND.HAMMER]: { geo: new THREE.BoxGeometry(0.42, 0.2, 0.2), mat: glow(BULLET_PALETTE.hammer, 1.6), cap: 48 },
        [KIND.ENEMY_ORB]: { geo: orbGeo, mat: basic(BULLET_PALETTE.enemy), cap: 256 },
        [KIND.ENEMY_HEAVY]: { geo: new THREE.BoxGeometry(0.72, 0.28, 0.28), mat: basic(BULLET_PALETTE.enemyHeavy), cap: 96 },
        // Under-glow for words; the readable label is a separate Sprite (below).
        [KIND.WORD]: { geo: new THREE.BoxGeometry(0.65, 0.28, 0.12), mat: basic(BULLET_PALETTE.word, { transparent: true, opacity: 0.4 }), cap: 48 }
    };
}

export class BulletRenderer {
    constructor(scene) {
        this.scene = scene;
        this.meshes = {};
        this._dummy = new THREE.Object3D();
        this._wordTexCache = new Map();
        this._wordSprites = [];   // { sprite, mat, texKey }
        this._wordCap = 48;

        const defs = families();
        for (const kind of Object.keys(defs)) {
            const d = defs[kind];
            const m = new THREE.InstancedMesh(d.geo, d.mat, d.cap);
            m.frustumCulled = false;
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            m.count = d.cap;
            scene.add(m);
            this.meshes[kind] = { mesh: m, cap: d.cap };
            for (let i = 0; i < d.cap; i++) this._park(m, i);
            m.instanceMatrix.needsUpdate = true;
        }

        // Prebuild a sprite pool for word labels.
        for (let i = 0; i < this._wordCap; i++) {
            const mat = new THREE.SpriteMaterial({
                color: 0xffffff,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                toneMapped: false
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(2.0, 0.48, 1);
            sprite.visible = false;
            scene.add(sprite);
            this._wordSprites.push({ sprite, mat, texKey: null });
        }
    }

    _park(mesh, i) {
        this._dummy.position.copy(PARKED);
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.setScalar(0.001);
        this._dummy.updateMatrix();
        mesh.setMatrixAt(i, this._dummy.matrix);
    }

    _textureFor(word) {
        const key = String(word || '?').toUpperCase();
        if (this._wordTexCache.has(key)) return this._wordTexCache.get(key);
        let tex = null;
        try {
            tex = makeWordTexture(THREE, key);
        } catch (e) {
            // Headless / no document — leave null; under-glow box still draws.
            tex = null;
        }
        this._wordTexCache.set(key, tex);
        return tex;
    }

    /**
     * Push one or more pools to the GPU. Call once per frame with every pool;
     * bullets are bucketed by `kind`, so a single pool may feed several meshes.
     * @param {object[]} pools
     */
    update(pools) {
        const counts = {};
        for (const kind of Object.keys(this.meshes)) counts[kind] = 0;
        let wordI = 0;

        for (const pool of pools) {
            if (!pool) continue;
            for (const b of pool.items) {
                if (!b.alive) continue;
                const entry = this.meshes[b.kind];
                if (!entry) continue;
                const i = counts[b.kind];
                if (i >= entry.cap) continue;
                const d = this._dummy;
                d.position.set(b.x, b.y, 0);
                d.rotation.set(0, 0, (b.vx || b.vy) ? Math.atan2(b.vy, b.vx) : 0);
                if (b.spin) d.rotation.z += b.spin;
                d.scale.setScalar(b.scale || 1);
                d.updateMatrix();
                entry.mesh.setMatrixAt(i, d.matrix);
                counts[b.kind] = i + 1;

                if (b.kind === KIND.WORD && wordI < this._wordCap) {
                    const slot = this._wordSprites[wordI++];
                    const key = String(b.word || 'WORD').toUpperCase();
                    if (slot.texKey !== key) {
                        const tex = this._textureFor(key);
                        slot.mat.map = tex;
                        slot.mat.needsUpdate = true;
                        slot.texKey = key;
                    }
                    slot.sprite.position.set(b.x, b.y, 0.05);
                    // Face the travel direction slightly for readability.
                    const len = Math.max(0.9, Math.min(2.4, key.length * 0.22));
                    slot.sprite.scale.set(len, 0.42, 1);
                    slot.sprite.visible = true;
                }
            }
        }

        for (; wordI < this._wordCap; wordI++) {
            this._wordSprites[wordI].sprite.visible = false;
        }

        for (const kind of Object.keys(this.meshes)) {
            const entry = this.meshes[kind];
            for (let i = counts[kind]; i < entry.cap; i++) this._park(entry.mesh, i);
            entry.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

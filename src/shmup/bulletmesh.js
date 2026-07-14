// src/shmup/bulletmesh.js
// Purpose: draw the bullet pools. One InstancedMesh per bullet family.
// Dependencies: three, ./bullets.js (KIND only), ./palette.js
//
// PLAN.md §2.4 / ASSETS_PLAN §5. Same technique as engine/particles.js: one
// shared _dummy Object3D, setMatrixAt per live bullet, park the dead ones at
// scale 0.001 far off-screen (cheaper and simpler than resizing the mesh).
//
// ASSETS_PLAN R4 is a hard rule and it lives here: enemy bullets are unlit
// MeshBasicMaterial magenta — the brightest, least-occludable thing on screen.
// If a bullet is ever hard to see, darken the background, not the bullet.

import * as THREE from 'three';
import { KIND } from './bullets.js';
import { BULLET_PALETTE } from './palette.js';

const PARKED = new THREE.Vector3(0, -9999, 0);

// geometry + material per family. `emissive` families bloom (G3: only emissive
// materials above the 0.85 threshold glow — never lower the threshold).
function families() {
    const boltGeo = new THREE.BoxGeometry(0.5, 0.08, 0.08);
    const orbGeo = new THREE.SphereGeometry(0.12, 8, 6);

    const basic = (color, opts = {}) =>
        new THREE.MeshBasicMaterial({ color, toneMapped: false, ...opts });
    const glow = (color, intensity) => new THREE.MeshStandardMaterial({
        color: 0x000000, emissive: color, emissiveIntensity: intensity, toneMapped: false
    });

    return {
        [KIND.PLAYER_BOLT]: { geo: boltGeo, mat: basic(BULLET_PALETTE.player), cap: 96 },
        [KIND.BIT]: { geo: new THREE.BoxGeometry(0.3, 0.06, 0.06), mat: basic(BULLET_PALETTE.player), cap: 48 },
        [KIND.PULSE_1]: { geo: new THREE.BoxGeometry(0.7, 0.14, 0.14), mat: glow(BULLET_PALETTE.player, 2.2), cap: 32 },
        [KIND.PULSE_2]: { geo: new THREE.BoxGeometry(1.6, 0.34, 0.34), mat: glow(BULLET_PALETTE.playerHot, 2.8), cap: 16 },
        [KIND.PULSE_3]: { geo: new THREE.BoxGeometry(2.6, 0.9, 0.9), mat: glow(BULLET_PALETTE.playerHot, 3.4), cap: 16 },
        [KIND.HAMMER]: { geo: new THREE.BoxGeometry(0.34, 0.16, 0.16), mat: glow(BULLET_PALETTE.hammer, 1.8), cap: 48 },
        [KIND.ENEMY_ORB]: { geo: orbGeo, mat: basic(BULLET_PALETTE.enemy), cap: 256 },
        [KIND.ENEMY_HEAVY]: { geo: new THREE.BoxGeometry(0.6, 0.22, 0.22), mat: basic(BULLET_PALETTE.enemyHeavy), cap: 64 }
    };
}

export class BulletRenderer {
    constructor(scene) {
        this.scene = scene;
        this.meshes = {};
        this._dummy = new THREE.Object3D();

        const defs = families();
        for (const kind of Object.keys(defs)) {
            const d = defs[kind];
            const m = new THREE.InstancedMesh(d.geo, d.mat, d.cap);
            m.frustumCulled = false;      // they live where the camera is looking
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            m.count = d.cap;
            scene.add(m);
            this.meshes[kind] = { mesh: m, cap: d.cap };
            // Park everything before the first frame, or dead instances render
            // as a pile of bullets at the origin.
            for (let i = 0; i < d.cap; i++) this._park(m, i);
            m.instanceMatrix.needsUpdate = true;
        }
    }

    _park(mesh, i) {
        this._dummy.position.copy(PARKED);
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.setScalar(0.001);
        this._dummy.updateMatrix();
        mesh.setMatrixAt(i, this._dummy.matrix);
    }

    /**
     * Push one or more pools to the GPU. Call once per frame with every pool;
     * bullets are bucketed by `kind`, so a single pool may feed several meshes.
     * @param {object[]} pools
     */
    update(pools) {
        const counts = {};
        for (const kind of Object.keys(this.meshes)) counts[kind] = 0;

        for (const pool of pools) {
            if (!pool) continue;
            for (const b of pool.items) {
                if (!b.alive) continue;
                const entry = this.meshes[b.kind];
                if (!entry) continue;
                const i = counts[b.kind];
                if (i >= entry.cap) continue;      // over cap: drop the draw, not the bullet
                const d = this._dummy;
                d.position.set(b.x, b.y, 0);
                // Point the sprite along its velocity: a bolt that doesn't lead
                // with its nose reads as debris, not as a shot.
                d.rotation.set(0, 0, (b.vx || b.vy) ? Math.atan2(b.vy, b.vx) : 0);
                if (b.spin) d.rotation.z += b.spin;
                d.scale.setScalar(b.scale || 1);
                d.updateMatrix();
                entry.mesh.setMatrixAt(i, d.matrix);
                counts[b.kind] = i + 1;
            }
        }

        for (const kind of Object.keys(this.meshes)) {
            const entry = this.meshes[kind];
            for (let i = counts[kind]; i < entry.cap; i++) this._park(entry.mesh, i);
            entry.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

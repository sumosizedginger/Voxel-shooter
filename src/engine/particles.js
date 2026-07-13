// src/engine/particles.js
// Purpose: Pooled petal + dust InstancedMesh + shockwave ring.
// Dependencies: global THREE

import * as THREE from 'three';
const _dummy = new THREE.Object3D();

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.shockTime = 0;

        // Petals
        this.petalGeo = new THREE.BoxGeometry(0.2, 0.04, 0.15);
        this.petalMat = new THREE.MeshBasicMaterial({
            color: 0xffa0b0, transparent: true, opacity: 0.7, depthWrite: false
        });
        this.petalMesh = new THREE.InstancedMesh(this.petalGeo, this.petalMat, 220);
        this.petalData = [];
        for (let i = 0; i < 220; i++) {
            this.petalData.push({
                x: (Math.random() - 0.5) * 60,
                y: Math.random() * 25,
                z: (Math.random() - 0.5) * 60,
                vx: (Math.random() - 0.5) * 0.05,
                vy: -0.04 - Math.random() * 0.06,
                vz: (Math.random() - 0.5) * 0.05,
                rotX: Math.random() * Math.PI,
                rotY: Math.random() * Math.PI
            });
        }
        scene.add(this.petalMesh);

        // Dust pool
        this.DUST_COUNT = 80;
        this.dustGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        this.dustMat = new THREE.MeshBasicMaterial({
            color: 0x8a7050, transparent: true, opacity: 0.6, depthWrite: false
        });
        this.dustMesh = new THREE.InstancedMesh(this.dustGeo, this.dustMat, this.DUST_COUNT);
        this.dustData = [];
        for (let i = 0; i < this.DUST_COUNT; i++) {
            this.dustData.push({
                active: false,
                life: 0,
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3()
            });
        }
        scene.add(this.dustMesh);

        // Shockwave ring
        this.shockGeo = new THREE.RingGeometry(0.2, 1.2, 32);
        this.shockMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.shockMesh = new THREE.Mesh(this.shockGeo, this.shockMat);
        this.shockMesh.rotation.x = -Math.PI / 2;
        scene.add(this.shockMesh);

        // Shard pool (destructible shatter)
        this.SHARD_COUNT = 600;
        this.shardGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        this.shardMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });
        this.shardMesh = new THREE.InstancedMesh(this.shardGeo, this.shardMat, this.SHARD_COUNT);
        this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shardData = [];
        for (let i = 0; i < this.SHARD_COUNT; i++) {
            this.shardData.push({
                active: false,
                life: 0,
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3(),
                color: new THREE.Color()
            });
        }
        // init colors
        const c0 = new THREE.Color(0xffffff);
        for (let i = 0; i < this.SHARD_COUNT; i++) {
            this.shardMesh.setColorAt(i, c0);
        }
        this.shardMesh.instanceColor.needsUpdate = true;
        scene.add(this.shardMesh);
    }

    spawnShard(worldPos, colorHex, originPos) {
        let idx = -1;
        for (let i = 0; i < this.SHARD_COUNT; i++) {
            if (!this.shardData[i].active) { idx = i; break; }
        }
        if (idx === -1) return;
        const s = this.shardData[idx];
        s.active = true;
        s.life = 1.5 + Math.random() * 0.5;
        s.pos.copy(worldPos);
        const ox = originPos && originPos.x != null ? originPos.x : worldPos.x;
        const oz = originPos && originPos.z != null ? originPos.z : worldPos.z;
        s.vel.set(
            (worldPos.x - ox) * 2 + (Math.random() - 0.5) * 2,
            3 + Math.random() * 2,
            (worldPos.z - oz) * 2 + (Math.random() - 0.5) * 2
        );
        s.color.setHex(typeof colorHex === 'number' ? colorHex : 0x888888);
        this.shardMesh.setColorAt(idx, s.color);
        this.shardMesh.instanceColor.needsUpdate = true;
    }

    spawnDustBurst(x, y, z, count) {
        let s = 0;
        for (let i = 0; i < this.DUST_COUNT && s < count; i++) {
            const d = this.dustData[i];
            if (!d.active) {
                d.active = true;
                d.life = 0.4 + Math.random() * 0.5;
                d.pos.set(
                    x + (Math.random() - 0.5) * 1.6,
                    y + 0.1,
                    z + (Math.random() - 0.5) * 1.6
                );
                d.vel.set(
                    (Math.random() - 0.5) * 0.2,
                    0.05 + Math.random() * 0.15,
                    (Math.random() - 0.5) * 0.2
                );
                s++;
            }
        }
    }

    impact(power, dustN, x, y, z) {
        this.spawnDustBurst(x, y, z, dustN);
        this.shockTime = 0.5;
        this.shockMesh.position.set(x, y + 0.02, z);
        this.shockMesh.scale.set(1, 1, 1);
    }

    update(dt) {
        // Petals
        for (let i = 0; i < 220; i++) {
            const p = this.petalData[i];
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            p.rotX += 0.02;
            p.rotY += 0.03;
            if (p.y < -2) {
                p.y = 20 + Math.random() * 10;
                p.x = (Math.random() - 0.5) * 80;
                p.z = (Math.random() - 0.5) * 40;
            }
            _dummy.position.set(p.x, p.y, p.z);
            _dummy.rotation.set(p.rotX, p.rotY, 0);
            _dummy.scale.set(1, 1, 1);
            _dummy.updateMatrix();
            this.petalMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.petalMesh.instanceMatrix.needsUpdate = true;

        // Dust
        for (let i = 0; i < this.DUST_COUNT; i++) {
            const d = this.dustData[i];
            if (!d.active) {
                _dummy.position.set(0, -100, 0);
                _dummy.scale.set(0.001, 0.001, 0.001);
                _dummy.updateMatrix();
                this.dustMesh.setMatrixAt(i, _dummy.matrix);
                continue;
            }
            d.life -= dt;
            d.pos.addScaledVector(d.vel, dt * 60 * 0.016);
            d.vel.y -= 0.008;
            if (d.life <= 0) {
                d.active = false;
                _dummy.position.set(0, -100, 0);
                _dummy.scale.set(0.001, 0.001, 0.001);
            } else {
                const sc = Math.max(0.1, d.life);
                _dummy.position.copy(d.pos);
                _dummy.scale.set(sc, sc, sc);
            }
            _dummy.rotation.set(0, 0, 0);
            _dummy.updateMatrix();
            this.dustMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.dustMesh.instanceMatrix.needsUpdate = true;

        // Shockwave
        if (this.shockTime > 0) {
            this.shockTime -= dt;
            const progress = 1.0 - (this.shockTime / 0.5);
            this.shockMesh.scale.setScalar(1.0 + progress * 24.0);
            this.shockMat.opacity = 0.9 * (1.0 - progress);
        } else {
            this.shockMat.opacity = 0.0;
        }

        // Shards
        for (let i = 0; i < this.SHARD_COUNT; i++) {
            const s = this.shardData[i];
            if (!s.active) {
                _dummy.position.set(0, -200, 0);
                _dummy.scale.setScalar(0.001);
                _dummy.updateMatrix();
                this.shardMesh.setMatrixAt(i, _dummy.matrix);
                continue;
            }
            s.life -= dt;
            if (s.life <= 0) {
                s.active = false;
                _dummy.position.set(0, -200, 0);
                _dummy.scale.setScalar(0.001);
                _dummy.updateMatrix();
                this.shardMesh.setMatrixAt(i, _dummy.matrix);
                continue;
            }
            s.vel.y -= 9.8 * dt;
            s.pos.addScaledVector(s.vel, dt);
            if (s.pos.y < 0.04) {
                s.pos.y = 0.04;
                s.vel.y *= -0.3;
                s.vel.x *= 0.7;
                s.vel.z *= 0.7;
            }
            _dummy.position.copy(s.pos);
            _dummy.scale.setScalar(Math.min(1, s.life));
            _dummy.rotation.set(s.life * 5, s.life * 3, 0);
            _dummy.updateMatrix();
            this.shardMesh.setMatrixAt(i, _dummy.matrix);
        }
        this.shardMesh.instanceMatrix.needsUpdate = true;
    }
}

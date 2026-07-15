// src/shmup/assets/witness.js
// Purpose: the Witness's voxel map + rig.
// Dependencies: three, voxel/*, ../palette.js
//
// ASSETS_PLAN §4, renamed by NARRATIVE_PLAN C5. It reads as YOURS (cool glow,
// R3) and it must be visually heavier than any bullet — the player has to be
// able to find it instantly in a crowded screen, because it's the thing keeping
// them alive.
//
// It glows VIOLET, and that is not a violation of C7 — it is C7. Violet means
// "the honest part; this is her." The Witness is the part of GUMOI that watches
// without flinching. It is exactly the thing violet is reserved for.

import * as THREE from 'three';
import { fillEllipsoid, fillBox, paint } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';
import { buildVoxelGeo } from '../../voxel/core.js';
import { SHIP_PALETTE, VIOLET, PICKUP_PALETTE } from '../palette.js';

// Escort-sized: must read as the docked pod, not as a second ship competing
// with the Vessel. Shell ≈ 0.8u across; core glow stays below bloom blowout.
export const WITNESS_SCALE = 0.072;
export const WITNESS_DIMS = { length: 11, height: 11, width: 11 };

export function buildWitnessMap(P = SHIP_PALETTE) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 5, 5, 5, P.hullDark);       // the shell
    fillEllipsoid(m, 0, 0, 0, 3, 3, 3, P.panel);          // the socket
    // An equatorial band of plating — it gives the orb an axis, so its spin reads.
    fillBox(m, -5, 5, -1, 1, -5, 5, P.hull);
    paint(m, (x, y, z, c) => {
        if (Math.abs(x) > 5 || Math.abs(z) > 5) return null;
        return hash3(x, y, z) > 0.85 ? P.hullLight : null;
    });
    return m;
}

/**
 * @returns {{rig, parts:{core, coreMat, ring, ringMat, sparks:THREE.Mesh[]}, voxMap}}
 */
export function buildWitnessRig() {
    const voxMap = buildWitnessMap();
    const geo = buildVoxelGeo(voxMap);
    geo.center();

    const rig = new THREE.Group();

    const shell = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 })
    );
    shell.scale.setScalar(WITNESS_SCALE);
    shell.castShadow = true;
    rig.add(shell);

    // The core: it is looking at you. Intensity stays in the canopy band so
    // the orb doesn't bloom bigger than the Vessel next to it.
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x140a24, emissive: VIOLET, emissiveIntensity: 1.15
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), coreMat);
    rig.add(core);

    // The equatorial ring — the thing that makes it heavier than a bullet.
    const ringMat = new THREE.MeshBasicMaterial({
        color: PICKUP_PALETTE.shardShell, transparent: true, opacity: 0.75,
        toneMapped: false, side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 28), ringMat);
    rig.add(ring);

    // Level 2 and 3 each add ONE orbiting spark (ASSETS_PLAN §4: upgrades add
    // sparks, they do not rebuild the model). Hidden until earned.
    const sparks = [];
    for (let i = 0; i < 2; i++) {
        const s = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 8, 6),
            new THREE.MeshStandardMaterial({
                color: 0x0a1420, emissive: SHIP_PALETTE.canopyGlow, emissiveIntensity: 1.4
            })
        );
        s.visible = false;
        rig.add(s);
        sparks.push(s);
    }

    return { rig, parts: { shell, core, coreMat, ring, ringMat, sparks }, voxMap };
}

// src/shmup/assets/shipRig.js
// Purpose: assemble the Vessel — hull mesh + the emissive meshes that bloom.
// Dependencies: three, voxel/core.js, ./ship.js, ../palette.js
//
// SHIP_PLAN.md §5. The split is the point: buildShipMap() is pure data (node-
// testable), this file is the only part that touches THREE. Baked vertex colors
// cannot glow (C1/G3), so everything that blooms — canopy, engine, muzzle, and
// the kintsugi scars — is its own mesh with an emissive material.

import * as THREE from 'three';
import { buildVoxelGeo } from '../../voxel/core.js';
import { buildShipMap, SHIP_VOXEL_SCALE, SHIP_HIT_CENTER, SEAM_LINES } from './ship.js';
import { SHIP_PALETTE } from '../palette.js';

const S = SHIP_VOXEL_SCALE;

// Named offsets — every one of these is a "tune by eye" number, so they live
// here together rather than scattered through the assembly below.
// The canopy is a cockpit, not a searchlight. At emissiveIntensity 2.0 over a
// 0.45-unit box, UnrealBloom smeared a cyan blob across the entire ship and the
// silhouette vanished. Small and modest reads as "she's awake in there"; big and
// bright reads as "the art is broken".
const CANOPY_POS = [0.24, 0.30, 0];
const CANOPY_SIZE = [0.30, 0.10, 0.20];
const ENGINE_POS = [-0.92, 0.0, 0];
const ENGINE_SIZE = [0.12, 0.22, 0.30];
const ENGINE_HALO_SCALE = 1.5;
const MUZZLE_POS = [0.96, -0.05, 0];
const MUZZLE_R = 0.1;

/** Scar glow: barely lit at full hull, blazing at death's door (C2). */
export const SCAR_MIN = 0.35;
export const SCAR_MAX = 3.5;

/** Voxel coords -> rig-local world coords (origin = the gameplay hit center). */
function voxToLocal(vx, vy, vz) {
    return [
        (vx - SHIP_HIT_CENTER.x) * S,
        (vy - SHIP_HIT_CENTER.y) * S,
        (vz - SHIP_HIT_CENTER.z) * S
    ];
}

/**
 * Build the Vessel.
 * @returns {{rig: THREE.Group, parts: object, voxMap: Map}}
 *   parts: { hull, hullMat, canopyMat, engineMesh, engineMat, engineHalo,
 *            muzzle, muzzleMat, scarMats[], ghostMat }
 */
export function buildShipRig() {
    const voxMap = buildShipMap();
    const geo = buildVoxelGeo(voxMap);
    // NOT geo.center(): the bbox center sits at the canopy line, so the hit
    // circle would hang out of the hull. Anchor on the fuselage core instead
    // (see SHIP_HIT_CENTER's note in ship.js).
    geo.translate(-SHIP_HIT_CENTER.x, -SHIP_HIT_CENTER.y, -SHIP_HIT_CENTER.z);

    const rig = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.78, metalness: 0.15
    });
    const hull = new THREE.Mesh(geo, hullMat);
    hull.scale.setScalar(S);
    hull.castShadow = true;
    rig.add(hull);

    // ── canopy: cyan-violet, she is awake in there
    const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x0a0f1c, emissive: SHIP_PALETTE.canopyGlow, emissiveIntensity: 1.1
    });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(...CANOPY_SIZE), canopyMat);
    canopy.position.set(...CANOPY_POS);
    rig.add(canopy);

    // ── engine: copper-orange, intensity animated in player.js
    const engineMat = new THREE.MeshStandardMaterial({
        color: 0x140a04, emissive: SHIP_PALETTE.engineGlow, emissiveIntensity: 1.6
    });
    const engineMesh = new THREE.Mesh(new THREE.BoxGeometry(...ENGINE_SIZE), engineMat);
    engineMesh.position.set(...ENGINE_POS);
    rig.add(engineMesh);

    // A cheap halo: a bigger transparent shell, no extra light, no extra pass.
    const engineHalo = new THREE.Mesh(
        new THREE.BoxGeometry(...ENGINE_SIZE),
        new THREE.MeshBasicMaterial({
            color: SHIP_PALETTE.engineGlow, transparent: true, opacity: 0.35, depthWrite: false
        })
    );
    engineHalo.position.set(...ENGINE_POS);
    engineHalo.scale.setScalar(ENGINE_HALO_SCALE);
    rig.add(engineHalo);

    // ── muzzle: the Siren Pulse charge orb. Idle = invisible (scale ~0).
    const muzzleMat = new THREE.MeshStandardMaterial({
        color: 0x0d1a20, emissive: SHIP_PALETTE.muzzleGlow, emissiveIntensity: 3.0
    });
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(MUZZLE_R, 12, 10), muzzleMat);
    muzzle.position.set(...MUZZLE_POS);
    muzzle.scale.setScalar(0.001);
    rig.add(muzzle);

    // ── the kintsugi scars: thin emissive slivers laid along the painted seams.
    //    These ARE the damage bar (C2) — player.js ramps their intensity as hull
    //    integrity falls, so the ship bleeds light the way GUMOI does.
    const scarMats = [];
    for (const line of SEAM_LINES) {
        const a = voxToLocal(...line.from);
        const b = voxToLocal(...line.to);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) + S;
        const mat = new THREE.MeshStandardMaterial({
            color: 0x120a20,
            emissive: SHIP_PALETTE.scarGlow,
            emissiveIntensity: SCAR_MIN
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, S * 0.9, S * 0.9), mat);
        mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        // Nudge the sliver just proud of the hull so z-fighting can't chew it.
        mesh.position.z += Math.sign(mesh.position.z || 1) * S * 0.55;
        rig.add(mesh);
        scarMats.push(mat);
    }

    // Prepared once, not per frame (SHIP_PLAN §6): the reduceFlashing
    // alternative to invuln blinking is a steady half-transparent hull.
    const ghostMat = hullMat.clone();
    ghostMat.transparent = true;
    ghostMat.opacity = 0.5;

    return {
        rig,
        parts: {
            hull, hullMat, ghostMat,
            canopy, canopyMat,
            engineMesh, engineMat, engineHalo,
            muzzle, muzzleMat,
            scarMats
        },
        voxMap
    };
}

// src/shmup/assets/diorama.js
// Purpose: cutscene voxel kits — GUMOI bust + boss silhouette + 1 prop per level.
// Dependencies: three, voxel/*, parallax silhouettes, bossBodies, props

import * as THREE from 'three';
import { buildVoxelGeo } from '../../voxel/core.js';
import { VIOLET } from '../palette.js';
import {
    beigeHulk, parrotSilhouette, jesterSilhouette, suitSilhouette,
    mirrorSilhouette, sunSilhouette, forgeSilhouette, driftSilhouette,
    shadowSilhouette, sealSilhouette
} from './parallax.js';
import { buildBossBody } from './bossBodies.js';
import { buildGumoiBustMap } from './props.js';

export { buildGumoiBustMap } from './props.js';

const STAGE_BUILDERS = {
    1: beigeHulk,
    2: parrotSilhouette,
    3: jesterSilhouette,
    4: suitSilhouette,
    5: mirrorSilhouette,
    6: sunSilhouette,
    7: forgeSilhouette,
    8: driftSilhouette,
    9: shadowSilhouette,
    10: sealSilhouette
};

const BOSS_SHAPE = {
    1: 'default',
    2: 'parrot', 3: 'jester', 4: 'suit', 5: 'mirror',
    6: 'sun', 7: 'forge', 8: 'drift', 9: 'shadow', 10: 'seal'
};

const BOSS_PAL = {
    1: { body: 0xa89880, bodyDark: 0x5f5546, shell: 0xc8bba4, spark: 0xffe0b0 },
    2: { body: 0x6a7482, bodyDark: 0x3e4652, shell: 0xc0cad8, spark: 0xd0e0f0 },
    3: { body: 0x6e3358, bodyDark: 0x3a1a30, shell: 0xe070c0, spark: 0xff80d0 },
    4: { body: 0x8a8478, bodyDark: 0x54504a, shell: 0xd8d0c0, spark: 0xfff0c0 },
    5: { body: 0x5a7088, bodyDark: 0x30404e, shell: 0xd0e4f4, spark: 0xd0f0ff },
    6: { body: 0xf0c0d8, bodyDark: 0xd89ab8, shell: 0xffe0f0, spark: 0xffffff },
    7: { body: 0x8a3e1e, bodyDark: 0x401810, shell: 0xffa860, spark: 0xffb060 },
    8: { body: 0x9a9aa0, bodyDark: 0x66666c, shell: 0xeeeef2, spark: 0xffffff },
    9: { body: 0x453a5e, bodyDark: 0x241d34, shell: 0x9a86c8, spark: 0xc0a0ff },
    10: { body: 0x5a4e8e, bodyDark: 0x2c2450, shell: 0xc0b0ff, spark: 0xd0c0ff }
};

/**
 * Spawn a temporary cutscene diorama group.
 * @param {THREE.Scene} scene
 * @param {number} levelId
 * @param {number} [scrollX]
 * @param {{mode?:'open'|'boss'}} [opts] open = GUMOI + stage prop; boss = + boss silhouette
 */
export function createCutsceneDiorama(scene, levelId, scrollX = 0, opts = {}) {
    const mode = opts.mode || 'open';
    const group = new THREE.Group();
    group.name = 'cutsceneDiorama';
    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.85, metalness: 0.2
    });
    const geos = [];
    const mats = [];

    // Vessel bust — left of frame
    const bustGeo = buildVoxelGeo(buildGumoiBustMap());
    bustGeo.center();
    geos.push(bustGeo);
    const bust = new THREE.Mesh(bustGeo, mat.clone());
    mats.push(bust.material);
    bust.scale.setScalar(0.18);
    bust.position.set(scrollX - 1.5, 7.2, 2);
    bust.rotation.y = -0.35;
    group.add(bust);

    // Stage prop — right / far (1 prop per level)
    const stageFn = STAGE_BUILDERS[levelId] || beigeHulk;
    const stageChunk = stageFn();
    const stageGeo = buildVoxelGeo(stageChunk.map || stageChunk);
    stageGeo.center();
    geos.push(stageGeo);
    const stage = new THREE.Mesh(stageGeo, mat.clone());
    mats.push(stage.material);
    stage.scale.setScalar(0.35);
    stage.position.set(scrollX + 10, 8.5, -4);
    stage.rotation.y = 0.4;
    group.add(stage);

    // Boss silhouette kit (open boss cutscenes + boss intros)
    if (mode === 'boss' || mode === 'open') {
        const shape = BOSS_SHAPE[levelId] || 'default';
        const pal = BOSS_PAL[levelId] || BOSS_PAL[1];
        try {
            const bossMap = buildBossBody(shape, pal);
            const bossGeo = buildVoxelGeo(bossMap);
            bossGeo.center();
            geos.push(bossGeo);
            const boss = new THREE.Mesh(bossGeo, mat.clone());
            mats.push(boss.material);
            boss.scale.setScalar(mode === 'boss' ? 0.28 : 0.16);
            boss.position.set(
                scrollX + (mode === 'boss' ? 8 : 12),
                mode === 'boss' ? 8 : 10,
                mode === 'boss' ? -1 : -6
            );
            boss.rotation.y = -0.55;
            boss.material.opacity = mode === 'open' ? 0.85 : 1;
            if (mode === 'open') {
                boss.material.transparent = true;
            }
            group.add(boss);
        } catch (e) {
            // shape missing — stage prop alone is fine
        }
    }

    // Soft violet accent orb (Witness presence)
    const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 10),
        new THREE.MeshStandardMaterial({
            color: 0x05060a, emissive: VIOLET, emissiveIntensity: 2.0
        })
    );
    mats.push(orb.material);
    orb.position.set(scrollX + 2.5, 9.2, 1);
    group.add(orb);

    scene.add(group);
    return { group, geos, mats, mode, levelId };
}

export function disposeDiorama(diorama, scene) {
    if (!diorama) return;
    if (scene && diorama.group) scene.remove(diorama.group);
    for (const g of diorama.geos || []) g.dispose();
    for (const m of diorama.mats || []) m.dispose();
}

// src/shmup/bosses/index.js
// Purpose: boss registry + dispatcher. Boss 01 is the bespoke wall; bosses
// 02-10 are configs over the generic engine with motion + signature telegraphs.
// Dependencies: ./boss01, ./generic, ../balance

import {
    createBoss01, updateBoss01, hitMouth as hitMouth01, applySlowShot, disposeBoss01
} from './boss01.js';
import {
    createGenericBoss, updateGenericBoss, hitCore, disposeGenericBoss
} from './generic.js';
import { BOSS_BALANCE } from '../balance.js';

const P = {
    parrot: { body: 0x6a7482, bodyDark: 0x3e4652, shell: 0xc0cad8, spark: 0xd0e0f0 },
    jester: { body: 0x6e3358, bodyDark: 0x3a1a30, shell: 0xe070c0, spark: 0xff80d0 },
    suit: { body: 0x8a8478, bodyDark: 0x54504a, shell: 0xd8d0c0, spark: 0xfff0c0 },
    mirror: { body: 0x5a7088, bodyDark: 0x30404e, shell: 0xd0e4f4, spark: 0xd0f0ff },
    sun: { body: 0xf0c0d8, bodyDark: 0xd89ab8, shell: 0xffe0f0, spark: 0xffffff },
    forge: { body: 0x8a3e1e, bodyDark: 0x401810, shell: 0xffa860, spark: 0xffb060 },
    drift: { body: 0x9a9aa0, bodyDark: 0x66666c, shell: 0xeeeef2, spark: 0xffffff },
    shadow: { body: 0x453a5e, bodyDark: 0x241d34, shell: 0x9a86c8, spark: 0xc0a0ff },
    seal: { body: 0x5a4e8e, bodyDark: 0x2c2450, shell: 0xc0b0ff, spark: 0xd0c0ff }
};

const threePhase = (fires, gates = [0.6, 0.25]) => [
    { name: 'ONE', gate: gates[0], ...fires[0] },
    { name: 'TWO', gate: gates[1], ...fires[1] },
    { name: 'THREE', ...fires[2] }
];

const B = BOSS_BALANCE;

export const BOSS_CONFIGS = {
    // L2 Induction Parrot — copies what you fire (S5). Motion: weave. Telegraph: shell flash.
    boss02: {
        id: 'boss02', name: 'THE INDUCTION PARROT', hp: B.boss02.hp, scale: 0.22, standoff: 13, score: 9000,
        shape: 'parrot',
        palette: P.parrot, remembersShots: true, cores: [{ dx: -1.4, dy: 0, r: 0.7 }],
        motion: 'weave', telegraph: 'shell',
        phases: threePhase([
            { fire: 'mirror', every: B.boss02.every[0], dmg: 6, scale: 1.5 },
            { fire: 'mirror', every: B.boss02.every[1], dmg: 7, scale: 1.6, dmgMult: 1.1 },
            { fire: 'mirror', every: B.boss02.every[2], dmg: 8, scale: 1.7, dmgMult: 1.2 }
        ])
    },
    // L3 Jester — S6 modifiers + 90s hard-fail integrate (C8/C10).
    boss03: {
        id: 'boss03', name: 'THE JESTER UNBOUND', hp: B.boss03.hp, scale: 0.22, standoff: 13, score: 9500,
        shape: 'jester',
        palette: P.jester, cores: [{ dx: -1.2, dy: 0, r: 0.8 }],
        hardFailAt: B.boss03.hardFailAt,
        motion: 'lunge', telegraph: 'spin',
        phases: [
            { name: 'TURN 1', gate: 0.66, fire: 'ring', every: 1.7, count: 9, speed: 6, dmg: 5,
                mod: 'controlFlip', modDuration: 6 },
            { name: 'TURN 2', gate: 0.33, fire: 'spread', every: 1.2, count: 7, spread: 0.3, speed: 8, dmg: 6,
                mod: 'gravityInvert', modDuration: 7 },
            { name: 'TURN 3', fire: 'ring', every: 0.9, count: 14, speed: 7, dmg: 6, dmgMult: 1.2,
                mod: 'screenPush', modDuration: 10, modData: { amp: 2.4 },
                onEnter: (boss, world) => {
                    if (world && world.pushMod) {
                        world.pushMod('hudLie', 8);
                        world.pushMod('weaponShuffle', 8);
                        world.pushMod('slowStack', 6);
                    }
                } }
        ]
    },
    // L4 Smooth Operator — word bullets + profanity (S7).
    boss04: {
        id: 'boss04', name: 'THE SMOOTH OPERATOR', hp: B.boss04.hp, scale: 0.24, standoff: 13, score: 9500,
        shape: 'suit',
        palette: P.suit, cores: [{ dx: -0.9, dy: -0.4, r: 0.6 }],
        motion: 'bob', telegraph: 'word',
        phases: threePhase([
            { fire: 'words', every: B.boss04.every[0], speed: 6, dmg: 4 },
            { fire: 'words', every: B.boss04.every[1], speed: 6, dmg: 4 },
            { fire: 'wall', every: B.boss04.every[2], rows: 6, speed: 4, dmg: 5, dmgMult: 1.2 }
        ])
    },
    // L5 Mirror Break — delayed mirror of your shots (S8).
    boss05: {
        id: 'boss05', name: 'THE MIRROR BREAK', hp: B.boss05.hp, scale: 0.22, standoff: 12, score: 10000,
        shape: 'mirror',
        palette: P.mirror, remembersShots: true, cores: [{ dx: -1.2, dy: 0, r: 0.7 }],
        shadowDelay: 0.3,
        motion: 'pulse', telegraph: 'mirror',
        phases: threePhase([
            { fire: 'mirror', every: B.boss05.every[0], dmg: 6, scale: 1.4 },
            { fire: 'mirror', every: B.boss05.every[1], dmg: 7, scale: 1.5 },
            { fire: 'mirror', every: B.boss05.every[2], dmg: 8, scale: 1.6, dmgMult: 1.2 }
        ])
    },
    // L6 Redemption Arc — sun does NOT attack; cast-gated scar.
    boss06: {
        id: 'boss06', name: 'THE REDEMPTION ARC', hp: B.boss06.hp, scale: 0.26, standoff: 13, score: 10000,
        shape: 'sun',
        palette: P.sun, coreAlwaysOpen: false, castCycle: 3.0, castOpen: B.boss06.castOpen,
        cores: [{ dx: -1.0, dy: 0, r: 0.55 }],
        timeoutAt: 180,
        healOnShot: B.boss06.healOnShot,
        noContactKill: true,
        motion: 'breathe', telegraph: 'scar',
        phases: [
            { name: 'ONE', duration: 60, fire: 'none', every: 99 },
            { name: 'TWO', duration: 60, fire: 'none', every: 99 },
            { name: 'THREE', fire: 'none', every: 99 }
        ]
    },
    // L7 Forge Wraith — S9 predict + heat.
    boss07: {
        id: 'boss07', name: 'THE FORGE WRAITH', hp: B.boss07.hp, scale: 0.24, standoff: 13, score: 10500,
        shape: 'forge',
        palette: P.forge, cores: [{ dx: -1.0, dy: -0.6, r: 0.7 }],
        motion: 'lunge', telegraph: 'aim',
        phases: threePhase([
            { fire: 'predict', every: B.boss07.every[0], count: 2, speed: 10, dmg: 6 },
            { fire: 'predict', every: B.boss07.every[1], count: 3, speed: 11, dmg: 6 },
            { fire: 'predict', every: B.boss07.every[2], count: 4, speed: 12, dmg: 7, dmgMult: 1.2 }
        ])
    },
    // L8 Drift Wraith — symmetric fire; asymmetry scorer.
    boss08: {
        id: 'boss08', name: 'THE DRIFT WRAITH', hp: B.boss08.hp, scale: 0.24, standoff: 13, score: 11000,
        shape: 'drift',
        palette: P.drift, cores: [{ dx: -1.0, dy: 0, r: 0.7 }],
        asymmetryRegen: true,
        motion: 'drift', telegraph: 'wall',
        phases: threePhase([
            { fire: 'symmetric', every: B.boss08.every[0], speed: 6, dmg: 4 },
            { fire: 'symmetric', every: B.boss08.every[1], speed: 7, dmg: 4 },
            { fire: 'symmetric', every: B.boss08.every[2], speed: 8, dmg: 5, dmgMult: 1.2 }
        ])
    },
    // L9 Witness's Shadow — S8 extended.
    boss09: {
        id: 'boss09', name: "THE WITNESS'S SHADOW", hp: B.boss09.hp, scale: 0.22, standoff: 12, score: 12000,
        shape: 'shadow',
        palette: P.shadow, remembersShots: true, cores: [{ dx: -1.2, dy: 0, r: 0.6 }],
        shadowDelay: 0.5,
        motion: 'orbit', telegraph: 'shadow',
        phases: threePhase([
            { fire: 'mirror', every: B.boss09.every[0], dmg: 7, scale: 1.5 },
            { fire: 'mirror', every: B.boss09.every[1], dmg: 8, scale: 1.6, dmgMult: 1.1 },
            { fire: 'mirror', every: B.boss09.every[2], dmg: 9, scale: 1.7, dmgMult: 1.3 }
        ], [0.65, 0.25])
    },
    // L10 Corrupted Seal — √π / ∞ / τ² with temporal loop in phase 3.
    boss10: {
        id: 'boss10', name: 'THE CORRUPTED SEAL', hp: B.boss10.hp, scale: 0.28, standoff: 14, score: 20000,
        shape: 'seal',
        palette: P.seal, cores: [{ dx: -1.0, dy: 0, r: 0.7 }],
        isFinale: true,
        motion: 'orbit', telegraph: 'seal',
        phases: [
            { name: '√π', duration: 60, fire: 'spiral', every: 1.4, count: 12, speed: 6, dmg: 5 },
            { name: '∞', duration: 60, fire: 'recurse', every: 1.1, dmg: 6 },
            { name: 'τ²', fire: 'ring', every: 0.8, count: 16, speed: 7, dmg: 6, dmgMult: 1.1, temporal: true }
        ]
    }
};

export function createBoss(id, scene, world) {
    if (id === 'boss01') return createBoss01(scene, world);
    const cfg = BOSS_CONFIGS[id];
    if (!cfg) { console.error('unknown boss: ' + id); return null; }
    return createGenericBoss(scene, world, cfg);
}

export function updateBoss(boss, dt, world) {
    if (!boss) return;
    if (boss.kind === 'boss01') updateBoss01(boss, dt, world);
    else updateGenericBoss(boss, dt, world);
}

export function hitBossPart(part, dmg, world) {
    if (part.boss && part.boss.kind === 'boss01') hitMouth01(part, dmg, world);
    else hitCore(part, dmg, world);
}

export function disposeBoss(boss, scene) {
    if (!boss) return;
    if (boss.kind === 'boss01') disposeBoss01(boss, scene);
    else disposeGenericBoss(boss, scene);
}

export { applySlowShot };
export const BOSS_IDS = ['boss01', ...Object.keys(BOSS_CONFIGS)];

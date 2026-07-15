// src/shmup/bosses/index.js
// Purpose: boss registry + dispatcher. Boss 01 is the bespoke wall; bosses
// 02-10 are configs over the generic engine. game.js talks only to this.
// Dependencies: ./boss01, ./generic
//
// NARRATIVE_PLAN §5. Each config names, in its phase text, the bible mechanic
// it realizes. Where a fully-bespoke system would be prohibitive (τ² state-
// snapshot loop, √π gravity inversion, the profanity-interrupt input, the
// symmetric-requires-asymmetric-fire scorer), the generic engine keeps the boss
// winnable via its violet cores and approximates the felt experience; those
// simplifications are logged in PLAN.md §6.

import {
    createBoss01, updateBoss01, hitMouth as hitMouth01, applySlowShot, disposeBoss01
} from './boss01.js';
import {
    createGenericBoss, updateGenericBoss, hitCore, disposeGenericBoss
} from './generic.js';

// Shared theme colors for the generic bodies (violet stays reserved for cores).
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

// A three-phase HP-gated shape most bosses share.
const threePhase = (fires, gates = [0.6, 0.25]) => [
    { name: 'ONE', gate: gates[0], ...fires[0] },
    { name: 'TWO', gate: gates[1], ...fires[1] },
    { name: 'THREE', ...fires[2] }
];

export const BOSS_CONFIGS = {
    // L2 Induction Parrot — "It only fires what was fired at it." (bible §05)
    boss02: {
        id: 'boss02', name: 'THE INDUCTION PARROT', hp: 1300, scale: 0.22, standoff: 13, score: 9000,
        palette: P.parrot, remembersShots: true, cores: [{ dx: -1.4, dy: 0, r: 0.7 }],
        phases: threePhase([
            { fire: 'mirror', every: 0.9, dmg: 6 },
            { fire: 'mirror', every: 0.6, dmg: 7, dmgMult: 1.1 },
            { fire: 'mirror', every: 0.4, dmg: 8, dmgMult: 1.2 }
        ])
    },
    // L3 Jester Unbound — bounded chaos gone unbound (bible §06).
    boss03: {
        id: 'boss03', name: 'THE JESTER UNBOUND', hp: 1250, scale: 0.22, standoff: 13, score: 9500,
        palette: P.jester, cores: [{ dx: -1.2, dy: 0, r: 0.8 }],
        phases: threePhase([
            { fire: 'ring', every: 1.6, count: 10, speed: 6, dmg: 5 },
            { fire: 'spread', every: 1.1, count: 7, spread: 0.3, speed: 8, dmg: 6 },
            { fire: 'ring', every: 0.8, count: 16, speed: 7, dmg: 6, dmgMult: 1.2 }
        ])
    },
    // L4 Smooth Operator — forbidden-word bullets (bible §07).
    boss04: {
        id: 'boss04', name: 'THE SMOOTH OPERATOR', hp: 1200, scale: 0.24, standoff: 13, score: 9500,
        palette: P.suit, cores: [{ dx: -0.9, dy: -0.4, r: 0.6 }],   // the tie
        phases: threePhase([
            { fire: 'words', every: 2.0, speed: 6, dmg: 4 },
            { fire: 'words', every: 1.2, speed: 6, dmg: 4 },
            { fire: 'wall', every: 2.2, rows: 6, speed: 4, dmg: 5, dmgMult: 1.2 }
        ])
    },
    // L5 Mirror Break — the denial (bible §08). Fires back, delayed.
    boss05: {
        id: 'boss05', name: 'THE MIRROR BREAK', hp: 1300, scale: 0.22, standoff: 12, score: 10000,
        palette: P.mirror, remembersShots: true, cores: [{ dx: -1.2, dy: 0, r: 0.7 }],
        phases: threePhase([
            { fire: 'mirror', every: 1.0, dmg: 6 },
            { fire: 'mirror', every: 0.7, dmg: 7 },
            { fire: 'mirror', every: 0.45, dmg: 8, dmgMult: 1.2 }
        ])
    },
    // L6 Redemption Arc — the sun that heals; hit the scar on the cast (bible §09).
    // TIMED phases (60s each) + cast-gated core, per the bible's 180s clock.
    boss06: {
        id: 'boss06', name: 'THE REDEMPTION ARC', hp: 1000, scale: 0.26, standoff: 13, score: 10000,
        palette: P.sun, coreAlwaysOpen: false, castCycle: 3.0, castOpen: 0.7,
        cores: [{ dx: -1.0, dy: 0, r: 0.55 }],
        phases: [
            { name: 'ONE', duration: 60, fire: 'none', every: 2 },
            { name: 'TWO', duration: 60, fire: 'aimed', every: 1.6, dmg: 5 },
            { name: 'THREE', fire: 'spread', every: 1.4, count: 5, spread: 0.3, speed: 7, dmg: 6 }
        ]
    },
    // L7 Forge Wraith — forges from your movement; hit the anvil (bible §10).
    boss07: {
        id: 'boss07', name: 'THE FORGE WRAITH', hp: 1350, scale: 0.24, standoff: 13, score: 10500,
        palette: P.forge, cores: [{ dx: -1.0, dy: -0.6, r: 0.7 }],   // the anvil
        phases: threePhase([
            { fire: 'aimed', every: 1.5, dmg: 6 },
            { fire: 'spread', every: 1.0, count: 5, spread: 0.25, speed: 9, dmg: 6 },
            { fire: 'spread', every: 0.8, count: 7, spread: 0.2, speed: 10, dmg: 7, dmgMult: 1.2 }
        ])
    },
    // L8 Drift Wraith — perfect symmetric fire; the missing seal is the weak
    // point (bible §11). Two cores flanking an empty center.
    boss08: {
        id: 'boss08', name: 'THE DRIFT WRAITH', hp: 1300, scale: 0.24, standoff: 13, score: 11000,
        palette: P.drift, cores: [{ dx: -1.0, dy: 0, r: 0.7 }],
        phases: threePhase([
            { fire: 'symmetric', every: 3.0, speed: 6, dmg: 4 },
            { fire: 'symmetric', every: 2.0, speed: 7, dmg: 4 },
            { fire: 'symmetric', every: 1.4, speed: 8, dmg: 5, dmgMult: 1.2 }
        ])
    },
    // L9 Witness's Shadow — GUMOI's own witness, delayed mirror (bible §12).
    // The hardest fight: fastest fire, fires your own shots back.
    boss09: {
        id: 'boss09', name: "THE WITNESS'S SHADOW", hp: 1500, scale: 0.22, standoff: 12, score: 12000,
        palette: P.shadow, remembersShots: true, cores: [{ dx: -1.2, dy: 0, r: 0.6 }],
        phases: threePhase([
            { fire: 'mirror', every: 0.8, dmg: 7 },
            { fire: 'mirror', every: 0.55, dmg: 8, dmgMult: 1.1 },
            { fire: 'mirror', every: 0.35, dmg: 9, dmgMult: 1.3 }
        ], [0.65, 0.25])
    },
    // L10 Corrupted Seal — the Trinity finale, three TIMED phases (bible §13).
    // √π (irrational curves), ∞ (recursion), τ² (the fold). Approximated as
    // three escalating timed phases; the BETWEEN ending is driven by game.js on
    // clear. Weakpoint is the violet core throughout.
    boss10: {
        id: 'boss10', name: 'THE CORRUPTED SEAL', hp: 1600, scale: 0.28, standoff: 14, score: 20000,
        palette: P.seal, cores: [{ dx: -1.0, dy: 0, r: 0.7 }],
        isFinale: true,
        phases: [
            { name: '√π', duration: 60, fire: 'ring', every: 1.4, count: 12, speed: 6, dmg: 5 },
            { name: '∞', duration: 60, fire: 'spread', every: 1.0, count: 7, spread: 0.3, speed: 8, dmg: 6 },
            { name: 'τ²', fire: 'ring', every: 0.7, count: 18, speed: 7, dmg: 6, dmgMult: 1.1 }
        ]
    }
};

// ── the dispatcher: a uniform interface over both boss implementations. ──

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

/** Route a player-bullet hit on a boss part (mouth or core). */
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

// src/shmup/level/campaign.js
// Purpose: the ten-level campaign — Level 01 hand-authored; 02–10 hand-authored
// per-theme scripts (unique waves, systems flags, lint C8 flags). Import-clean.
// Dependencies: level01, engine/settings
//
// NARRATIVE_PLAN §5. Each level carries a `systems` bag so game.js can arm S5–S10.

import { LEVEL01 } from './level01.js';
import { setProgress, getProgress } from '../../engine/settings.js';

export const THEMES = [
    null, null,
    { name: 'THE INDUCTION PARROT', pal: { base: 0x8892a0, mid: 0x6a7482, dark: 0x3e4652, pale: 0xc0cad8, flesh: 0x545e6c }, enemies: ['darter', 'drone', 'gunpod'], boss: 'boss02', music: 'parrot' },
    { name: 'THE JESTER UNBOUND', pal: { base: 0x9a4a7a, mid: 0x6e3358, dark: 0x3a1a30, pale: 0xe070c0, flesh: 0x7a2a5a }, enemies: ['drone', 'mine', 'darter'], boss: 'boss03', music: 'jester' },
    { name: 'THE SMOOTH OPERATOR', pal: { base: 0xb8b0a0, mid: 0x8a8478, dark: 0x54504a, pale: 0xd8d0c0, flesh: 0x6a665e }, enemies: ['gunpod', 'lancer', 'drone'], boss: 'boss04', music: 'suit' },
    { name: 'THE MIRROR BREAK', pal: { base: 0x88a0b8, mid: 0x5a7088, dark: 0x30404e, pale: 0xd0e4f4, flesh: 0x486074 }, enemies: ['darter', 'mine', 'lancer'], boss: 'boss05', music: 'mirror' },
    { name: 'THE REDEMPTION ARC', pal: { base: 0xf0c0d8, mid: 0xd89ab8, dark: 0x9a6a86, pale: 0xffe0f0, flesh: 0xc888a8 }, enemies: ['drone', 'mine'], boss: 'boss06', music: 'sun' },
    { name: 'THE FORGE WRAITH', pal: { base: 0xc06838, mid: 0x8a3e1e, dark: 0x401810, pale: 0xffa860, flesh: 0x6a2810 }, enemies: ['gunpod', 'lancer', 'crawler'], boss: 'boss07', music: 'forge' },
    { name: 'THE DRIFT WRAITH', pal: { base: 0xc8c8cc, mid: 0x9a9aa0, dark: 0x66666c, pale: 0xeeeef2, flesh: 0x80808a }, enemies: ['drone', 'darter', 'lancer'], boss: 'boss08', music: 'drift' },
    { name: "THE WITNESS'S SHADOW", pal: { base: 0x6a5a8a, mid: 0x453a5e, dark: 0x241d34, pale: 0x9a86c8, flesh: 0x352a4c }, enemies: ['darter', 'mine', 'gunpod'], boss: 'boss09', music: 'shadow' },
    { name: 'THE CORRUPTED SEAL', pal: { base: 0x8a7ac8, mid: 0x5a4e8e, dark: 0x2c2450, pale: 0xc0b0ff, flesh: 0x443a70 }, enemies: ['lancer', 'mine', 'darter', 'gunpod'], boss: 'boss10', music: 'seal' }
];

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function tunnel(pal, len, chunkW = 5) {
    const terrain = [];
    for (let x = 0; x * chunkW < len + chunkW; x++) {
        terrain.push({ chunk: 'fleshWall', atX: x * chunkW, y: 0, args: [20, 5, 1], palette: pal });
        terrain.push({ chunk: 'fleshWall', atX: x * chunkW, y: 16, args: [20, 5, -1], palette: pal });
    }
    return terrain;
}

/**
 * Hand-authored stage body per level id. Unique wave scripts, elite cast
 * teaching moments, and system flags — not a pure factory stamp.
 */
export function makeLevel(id) {
    const theme = THEMES[id];
    if (!theme) return null;
    const [e0, e1, e2] = [
        theme.enemies[0],
        theme.enemies[1] || theme.enemies[0],
        theme.enemies[2] || theme.enemies[0]
    ];
    const LENGTH = 340 + (id % 3) * 8;
    const openId = 'L' + pad(id) + '_open';
    const bossId = 'L' + pad(id) + '_boss';

    // Per-level signature wave scripts (teach → test → twist).
    const scripts = {
        2: () => [ // weapon switch / mimic
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 28, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 8, spacing: 1.6, castChance: 0.2 },
            { atX: 50, type: 'wave', formation: 'chain', enemy: e0, count: 4, y: 11, mimic: true, castChance: 0.1 },
            { atX: 72, type: 'wave', formation: 'turretNest', enemy: e2, count: 1, y: 8 },
            { atX: 92, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 7, mimic: true },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 130, type: 'wave', formation: 'column', enemy: e1, count: 4, y: 8, spacing: 2.2, mimic: true },
            { atX: 152, type: 'wave', formation: 'pincer', enemy: e0, count: 6, y: 8, spacing: 1.6 },
            { atX: 174, type: 'wave', formation: 'chain', enemy: e1, count: 3, y: 6, elite: true },
            { atX: 192, type: 'pickup', kind: 'bit', y: 7 },
            { atX: 200, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 9, mimic: true },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'chain', enemy: e0, count: 4, y: 6, mimic: true },
            { atX: 226, type: 'wave', formation: 'chain', enemy: e1, count: 4, y: 11, mimic: true },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 262, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 9 },
            { atX: 280, type: 'pickup', kind: 'shard', y: 5 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ],
        3: () => [ // jester chaos
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 26, type: 'wave', formation: 'pincer', enemy: e0, count: 6, y: 8, castChance: 0.25 },
            { atX: 48, type: 'wave', formation: 'chain', enemy: e1, count: 3, y: 10 },
            { atX: 70, type: 'wave', formation: 'column', enemy: e0, count: 5, y: 8, elite: true },
            { atX: 96, type: 'wave', formation: 'escort', enemy: e2, count: 2, y: 7 },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 128, type: 'wave', formation: 'chain', enemy: e0, count: 6, y: 5, spacing: 1.3 },
            { atX: 148, type: 'wave', formation: 'chain', enemy: e0, count: 6, y: 12, spacing: 1.3 },
            { atX: 170, type: 'wave', formation: 'turretNest', enemy: 'gunpod', count: 2, y: 8, spacing: 5 },
            { atX: 194, type: 'pickup', kind: 'bit', y: 6 },
            { atX: 204, type: 'wave', formation: 'pincer', enemy: e1, count: 6, y: 8 },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 7, elite: true },
            { atX: 226, type: 'wave', formation: 'chain', enemy: e2, count: 4, y: 10 },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 260, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 8 },
            { atX: 278, type: 'pickup', kind: 'shard', y: 6 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ],
        4: () => [ // profanity / words
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 28, type: 'wave', formation: 'turretNest', enemy: e0, count: 1, y: 8 },
            { atX: 50, type: 'wave', formation: 'chain', enemy: e2, count: 5, y: 9, castChance: 0.3 },
            { atX: 74, type: 'wave', formation: 'column', enemy: e1, count: 3, y: 8, elite: true },
            { atX: 96, type: 'wave', formation: 'escort', enemy: e2, count: 2, y: 7 },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 132, type: 'wave', formation: 'chain', enemy: e0, count: 2, y: 6 },
            { atX: 152, type: 'wave', formation: 'chain', enemy: e0, count: 2, y: 11 },
            { atX: 174, type: 'wave', formation: 'pincer', enemy: e2, count: 6, y: 8 },
            { atX: 196, type: 'pickup', kind: 'bit', y: 5 },
            { atX: 206, type: 'wave', formation: 'chain', enemy: e1, count: 2, y: 8, elite: true },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'turretNest', enemy: e0, count: 2, y: 8, spacing: 4 },
            { atX: 226, type: 'wave', formation: 'chain', enemy: e2, count: 4, y: 10 },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 262, type: 'wave', formation: 'escort', enemy: e2, count: 2, y: 9 },
            { atX: 280, type: 'pickup', kind: 'shard', y: 5 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ],
        5: () => [ // mirror
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 28, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 8, spacing: 1.5 },
            { atX: 52, type: 'wave', formation: 'column', enemy: e0, count: 4, y: 8 },
            { atX: 74, type: 'wave', formation: 'chain', enemy: e2, count: 2, y: 10, elite: true },
            { atX: 96, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 7 },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 134, type: 'wave', formation: 'pincer', enemy: e1, count: 6, y: 8 },
            { atX: 158, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 6, castChance: 0.4 },
            { atX: 180, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 11, castChance: 0.4 },
            { atX: 200, type: 'pickup', kind: 'bit', y: 8 },
            { atX: 210, type: 'wave', formation: 'column', enemy: e2, count: 3, y: 8, elite: true },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'pincer', enemy: e0, count: 6, y: 8 },
            { atX: 226, type: 'wave', formation: 'chain', enemy: e1, count: 3, y: 8 },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 262, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 9 },
            { atX: 280, type: 'pickup', kind: 'shard', y: 5 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ],
        6: () => [ // redemption / scar discipline
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 30, type: 'wave', formation: 'chain', enemy: e0, count: 4, y: 8 },
            { atX: 55, type: 'wave', formation: 'chain', enemy: e1, count: 3, y: 10 },
            { atX: 80, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 8 },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 136, type: 'wave', formation: 'column', enemy: e0, count: 4, y: 8, elite: true },
            { atX: 160, type: 'wave', formation: 'pincer', enemy: e1, count: 4, y: 8 },
            { atX: 188, type: 'pickup', kind: 'bit', y: 7 },
            { atX: 198, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 9, castChance: 0.5 },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'chain', enemy: e0, count: 4, y: 6 },
            { atX: 226, type: 'wave', formation: 'chain', enemy: e1, count: 4, y: 11 },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 268, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 8 },
            { atX: 286, type: 'pickup', kind: 'shard', y: 6 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ],
        7: () => [ // forge / heat
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 28, type: 'wave', formation: 'turretNest', enemy: e0, count: 2, y: 8, spacing: 5 },
            { atX: 54, type: 'wave', formation: 'wallMount', enemy: e2, count: 1, params: { mounts: [{ dx: 0, onCeiling: false }, { dx: 8, onCeiling: true }] } },
            { atX: 78, type: 'wave', formation: 'chain', enemy: e1, count: 3, y: 9, elite: true },
            { atX: 100, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 7 },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 132, type: 'wave', formation: 'column', enemy: e1, count: 4, y: 8 },
            { atX: 156, type: 'wave', formation: 'pincer', enemy: e0, count: 6, y: 8 },
            { atX: 180, type: 'wave', formation: 'chain', enemy: e1, count: 2, y: 8, elite: true },
            { atX: 200, type: 'pickup', kind: 'bit', y: 6 },
            { atX: 210, type: 'wave', formation: 'turretNest', enemy: e0, count: 2, y: 8, spacing: 4 },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'chain', enemy: e1, count: 4, y: 7 },
            { atX: 226, type: 'wave', formation: 'wallMount', enemy: e2, count: 1, params: { mounts: [{ dx: 0, onCeiling: true }, { dx: 5, onCeiling: false }] } },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 262, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 9 },
            { atX: 280, type: 'pickup', kind: 'shard', y: 5 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ],
        8: () => [ // drift / asymmetry
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 28, type: 'wave', formation: 'chain', enemy: e0, count: 6, y: 8, spacing: 1.4 },
            { atX: 52, type: 'wave', formation: 'chain', enemy: e0, count: 6, y: 8, spacing: 1.4 }, // mirror twin wave
            { atX: 76, type: 'wave', formation: 'column', enemy: e1, count: 5, y: 8 },
            { atX: 100, type: 'wave', formation: 'escort', enemy: e2, count: 2, y: 7 },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 134, type: 'wave', formation: 'pincer', enemy: e0, count: 6, y: 8 },
            { atX: 158, type: 'wave', formation: 'chain', enemy: e2, count: 2, y: 8, elite: true },
            { atX: 182, type: 'wave', formation: 'column', enemy: e1, count: 4, y: 8 },
            { atX: 204, type: 'pickup', kind: 'bit', y: 8 },
            { atX: 212, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 5 },
            { atX: 213, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 11 },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'pincer', enemy: e1, count: 6, y: 8 },
            { atX: 226, type: 'wave', formation: 'chain', enemy: e2, count: 2, y: 8, elite: true },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 262, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 9 },
            { atX: 280, type: 'pickup', kind: 'shard', y: 5 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ],
        9: () => [ // shadow
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 28, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 8, castChance: 0.35 },
            { atX: 52, type: 'wave', formation: 'pincer', enemy: e1, count: 6, y: 8 },
            { atX: 76, type: 'wave', formation: 'turretNest', enemy: e2, count: 2, y: 8, spacing: 4 },
            { atX: 100, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 7 },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 134, type: 'wave', formation: 'column', enemy: e0, count: 4, y: 8, elite: true },
            { atX: 158, type: 'wave', formation: 'chain', enemy: e1, count: 4, y: 6 },
            { atX: 180, type: 'wave', formation: 'chain', enemy: e1, count: 4, y: 11 },
            { atX: 202, type: 'pickup', kind: 'bit', y: 7 },
            { atX: 212, type: 'wave', formation: 'pincer', enemy: e0, count: 6, y: 8, castChance: 0.5 },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 8, elite: true },
            { atX: 226, type: 'wave', formation: 'turretNest', enemy: e2, count: 1, y: 8 },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 262, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 9 },
            { atX: 280, type: 'pickup', kind: 'shard', y: 5 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ],
        10: () => [ // seal exam
            { atX: 18, type: 'dialogue', id: openId },
            { atX: 26, type: 'wave', formation: 'chain', enemy: e0, count: 4, y: 8, elite: true },
            { atX: 48, type: 'wave', formation: 'pincer', enemy: e1, count: 6, y: 8 },
            { atX: 70, type: 'wave', formation: 'column', enemy: e2, count: 4, y: 8 },
            { atX: 92, type: 'wave', formation: 'escort', enemy: e3(theme), count: 2, y: 7 },
            { atX: 110, type: 'checkpoint' },
            { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 130, type: 'wave', formation: 'chain', enemy: e0, count: 5, y: 6, castChance: 0.4 },
            { atX: 150, type: 'wave', formation: 'chain', enemy: e1, count: 5, y: 11, castChance: 0.4 },
            { atX: 172, type: 'wave', formation: 'turretNest', enemy: e3(theme), count: 2, y: 8, spacing: 5 },
            { atX: 194, type: 'pickup', kind: 'bit', y: 6 },
            { atX: 204, type: 'wave', formation: 'pincer', enemy: e0, count: 6, y: 8, elite: true },
            { atX: 224, type: 'lock', until: 'cleared' },
            { atX: 225, type: 'wave', formation: 'chain', enemy: e0, count: 4, y: 7 },
            { atX: 226, type: 'wave', formation: 'chain', enemy: e1, count: 4, y: 10 },
            { atX: 227, type: 'wave', formation: 'chain', enemy: e2, count: 2, y: 8, elite: true },
            { atX: 240, type: 'checkpoint' },
            { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
            { atX: 262, type: 'wave', formation: 'escort', enemy: e0, count: 2, y: 9 },
            { atX: 280, type: 'pickup', kind: 'shard', y: 5 },
            { atX: 300, type: 'dialogue', id: bossId },
            { atX: 306, type: 'boss', id: theme.boss },
            { atX: 320, type: 'end' }
        ]
    };

    function e3(th) { return th.enemies[3] || th.enemies[0]; }

    const build = scripts[id] || scripts[2];
    const triggers = build();

    const systems = systemsFor(id);

    return {
        id,
        name: theme.name,
        scrollSpeed: 2.5 + (id % 3) * 0.08,
        length: LENGTH,
        music: theme.music || 'beige',
        palette: { sky: 0x0a0514, fogDensity: 0.004 },
        checkpoints: [110, 240],
        parallax: [],
        terrain: tunnel(theme.pal, LENGTH),
        triggers,
        systems,
        allowHardFail: id === 3,
        allowTimeout: id === 6,
        _theme: theme
    };
}

function systemsFor(id) {
    return {
        cast: true,                         // S2 all levels
        mimic: id === 2,                    // S5
        modifiers: id === 3 || id === 10,   // S6
        profanity: id === 4,                // S7
        shadow: id === 5 || id === 9,       // S8
        shadowDelay: id === 9 ? 0.5 : 0.3,
        shadowRamp: id === 9,
        contradiction: id === 9,
        replayShots: id === 9,
        heat: id === 7,                     // S9 + heat.js
        predictor: id === 7,
        asymmetry: id === 8,                // asymmetry.js
        temporal: id === 10                 // S10 (boss phase arms it)
    };
}

// Enrich L01 with systems bag.
const L01 = Object.assign({}, LEVEL01, {
    systems: { cast: true, castChance: 0.35 },
    music: LEVEL01.music || 'beige'
});

export const LEVELS = [null, L01,
    makeLevel(2), makeLevel(3), makeLevel(4), makeLevel(5),
    makeLevel(6), makeLevel(7), makeLevel(8), makeLevel(9), makeLevel(10)];

export const LAST_LEVEL = 10;

export function levelToPlay() {
    const p = getProgress();
    const reached = (p.rtype && p.rtype.stageReached) || 1;
    return Math.max(1, Math.min(LAST_LEVEL, reached));
}

export function recordClear(id) {
    const p = getProgress();
    const rtype = Object.assign({ stageReached: 1, checkpoint: 0, loops: 0 }, p.rtype);
    rtype.stageReached = Math.max(rtype.stageReached, Math.min(LAST_LEVEL + 1, id + 1));
    setProgress({ rtype });
}

export function getLevel(id) {
    return LEVELS[id] || null;
}

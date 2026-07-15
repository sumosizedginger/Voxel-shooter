// src/shmup/level/stagecraft.js
// Purpose: hand-authored terrain rooms + sky for L02–L10 (geometry beats, rest, twist).
// Dependencies: none (data only). campaign.js composes these into full levels.

import { parallaxForLevel } from '../assets/parallax.js';
import { BALANCE } from '../balance.js';

const CHUNK = 5; // world units per fleshWall(len=20) step used by campaign tunnel

/**
 * Continuous floor/ceiling tunnel with theme palette.
 * Inserts room-scale architecture so stages read like L01, not tunnel+stamp.
 */
export function buildStageTerrain(pal, length, levelId) {
    const terrain = [];
    for (let x = 0; x * CHUNK < length + CHUNK; x++) {
        const atX = x * CHUNK;
        terrain.push({ chunk: 'fleshWall', atX, y: 0, args: [20, 5 + (x % 3), 1], palette: pal });
        terrain.push({ chunk: 'fleshWall', atX, y: 16, args: [20, 5 + ((x + 1) % 3), -1], palette: pal });
    }

    const rooms = roomsFor(levelId, pal, length);
    for (const d of rooms) terrain.push(d);

    return terrain;
}

/**
 * Per-level hand rooms: geometry beat → rest corridor → twist choke.
 * Spots are designed against campaign checkpoints (110, 240) and lock (224).
 */
export function roomsFor(id, pal, length) {
    const out = [];
    const push = (chunk, atX, y, args) => {
        if (atX > length - 20) return;
        out.push({ chunk, atX, y, args, palette: pal });
    };

    // Shared skeleton rooms (all L02–10)
    // Room A — early geometry teach (~40–95)
    push('pillar', 38, 0, [9 + (id % 3), 3]);
    push('caveMouth', 72, 0, [26 + (id % 4)]);
    // Rest corridor (~110–125) — leave open near checkpoint 1
    // Room B — rising twist (~140–200)
    push('ramp', 138, 0, [12, 4 + (id % 3)]);
    push('pillar', 168, 0, [8, 3]);
    push('pillar', 168, 12, [6, 3]);
    // Pre-lock framing (~210–222)
    push('caveMouth', 208, 0, [28]);
    // Pre-boss approach (~255–290)
    push('ramp', 258, 0, [10, 3 + (id % 2)]);
    push('pillar', 275, 0, [7, 3]);

    // Signature rooms per level (2–3 unique reads)
    if (id === 2) {
        // Mirror galleries for mimic teach
        push('pillar', 52, 0, [11, 4]);
        push('pillar', 52, 11, [9, 4]);
        push('pillar', 148, 0, [10, 4]);
        push('pillar', 148, 11, [8, 4]);
        push('caveMouth', 190, 0, [24]);
    }
    if (id === 3) {
        // Jester chaos: slanted ramps + stacked pillars
        push('ramp', 55, 0, [16, 6]);
        push('ramp', 155, 0, [14, 5]);
        push('pillar', 100, 0, [12, 4]);
        push('pillar', 200, 0, [10, 5]);
    }
    if (id === 4) {
        // Corporate corridors
        push('caveMouth', 60, 0, [30]);
        push('caveMouth', 150, 0, [30]);
        push('caveMouth', 230, 0, [28]);
        push('pillar', 100, 0, [6, 4]);
        push('pillar', 180, 0, [6, 4]);
    }
    if (id === 5) {
        // Mirror break — twin frames
        push('pillar', 48, 0, [10, 3]);
        push('pillar', 48, 12, [8, 3]);
        push('pillar', 160, 0, [10, 3]);
        push('pillar', 160, 12, [8, 3]);
        push('caveMouth', 195, 0, [26]);
    }
    if (id === 6) {
        // Soft sun chambers — open ramps, less choke
        push('ramp', 50, 0, [18, 3]);
        push('ramp', 150, 0, [16, 3]);
        push('caveMouth', 220, 0, [32]);
    }
    if (id === 7) {
        // Forge stacks
        for (const x of [46, 90, 130, 170, 200]) {
            push('pillar', x, 0, [14, 5]);
        }
        push('ramp', 110, 0, [12, 5]);
    }
    if (id === 8) {
        // Drift — symmetric twin pillars
        for (const x of [50, 100, 150, 200]) {
            push('pillar', x, 0, [9, 3]);
            push('pillar', x + 2, 12, [7, 3]);
        }
    }
    if (id === 9) {
        // Shadow galleries
        push('caveMouth', 55, 0, [28]);
        push('pillar', 120, 0, [12, 4]);
        push('pillar', 120, 11, [10, 4]);
        push('caveMouth', 185, 0, [28]);
        push('ramp', 230, 0, [10, 4]);
    }
    if (id === 10) {
        // Seal approach density
        push('caveMouth', 50, 0, [30]);
        push('pillar', 100, 0, [11, 4]);
        push('caveMouth', 160, 0, [30]);
        push('caveMouth', 250, 0, [30]);
        push('caveMouth', 280, 0, [30]);
        push('pillar', 290, 0, [12, 4]);
    }

    return out;
}

/** @deprecated name kept for callers; roomsFor is the room API. */
export function decorFor(id, pal, length) {
    return roomsFor(id, pal, length);
}

/** Sky / fog tint per level for distinct stage color. */
export function skyForLevel(id) {
    const skies = {
        1: { sky: 0x0a0514, fogDensity: 0.004 },
        2: { sky: 0x0a0c14, fogDensity: 0.0045 },
        3: { sky: 0x120610, fogDensity: 0.005 },
        4: { sky: 0x0c0b10, fogDensity: 0.004 },
        5: { sky: 0x081018, fogDensity: 0.0042 },
        6: { sky: 0x140a12, fogDensity: 0.0035 },
        7: { sky: 0x120806, fogDensity: 0.0055 },
        8: { sky: 0x0c0c12, fogDensity: 0.003 },
        9: { sky: 0x0a0614, fogDensity: 0.005 },
        10: { sky: 0x0c0820, fogDensity: 0.006 }
    };
    return skies[id] || skies[1];
}

export function parallaxLayers(id) {
    return parallaxForLevel(id);
}

/** Mild difficulty / fairness — slightly slower late game with denser systems. */
export function scrollSpeedFor(id) {
    const base = BALANCE.scrollBase + (id % 3) * 0.06;
    if (id >= 9) return base - 0.14;
    if (id >= 7) return base - 0.08;
    if (id === 3) return base - 0.05; // jester chaos readability
    return base;
}

// src/shmup/level/level01.js
// Purpose: Level 01 — The Beige Slope. Authored entirely as data.
// Dependencies: none at module scope (the parallax `build` fns import THREE
//   lazily via the host; here they are plain builders passed to build.js)
//
// Bible §04 + NARRATIVE_PLAN §5/§6 + LEVELS_PLAN §4 (pacing) / §5 (fairness).
//
// "The Vessel drops out of fold into a tunnel made of soft cream-colored
// organic matter that pulses like a slow lung. The enemies here are flat. They
// do not threaten. They suggest." The level TEACHES the interrupt: every elite
// begins an announced emotion; interrupt it and a violet weakpoint opens.
//
// Pacing (LEVELS_PLAN §4): calm intro -> rising beats with rests -> checkpoint
// -> gimmick showcase -> lock gauntlet -> checkpoint -> pre-boss breather ->
// boss. Fairness (§5): a recovery shard within 15u after each checkpoint,
// checkpoints at rests, no unreactable spawns.

import { BEIGE_PALETTE } from '../palette.js';
import { TERRAIN_SCALE } from '../assets/terrain.js';

const CHUNK = 20 * TERRAIN_SCALE;      // fleshWall(len=20) world width

/** Lay a continuous beige tunnel from x=0 to `len`, floor and ceiling. */
function tunnel(len) {
    const out = [];
    for (let x = 0; x * CHUNK < len + CHUNK; x++) {
        out.push({ chunk: 'fleshWall', atX: x * CHUNK, y: 0, args: [20, 5, 1], palette: BEIGE_PALETTE });
        out.push({ chunk: 'fleshWall', atX: x * CHUNK, y: 16, args: [20, 5, -1], palette: BEIGE_PALETTE });
    }
    return out;
}

const LENGTH = 340;

export const LEVEL01 = {
    id: 1,
    name: 'THE BEIGE SLOPE',
    scrollSpeed: 2.6,
    length: LENGTH,
    music: 'beige',
    palette: { sky: 0x0a0514, fogDensity: 0.004 },

    // Death rewinds to the latest of these the player has passed.
    checkpoints: [110, 240],

    // ── parallax: two far layers of derelict beige hulks (ASSETS_PLAN §7).
    //    Builders are resolved by level/build.js; kept as functions so this
    //    file stays THREE-free and importable by the stage-lint test.
    parallax: [
        { build: () => beigeHulk(0.6), z: -14, scrollRate: 0.35, scale: 0.6, spacing: 34, y: 8 },
        { build: () => beigeHulk(0.9), z: -26, scrollRate: 0.18, scale: 0.9, spacing: 52, y: 9 }
    ],

    terrain: tunnel(LENGTH),

    // ── triggers, in scroll order. teach -> test -> twist (LEVELS_PLAN §4).
    triggers: [
        // calm intro: one drone chain, no terrain threat (bible: "they suggest")
        { atX: 18, type: 'dialogue', id: 'L01_open' },
        { atX: 26, type: 'wave', formation: 'chain', enemy: 'drone', count: 5, y: 8, spacing: 1.6, params: { amp: 1.6, freq: 0.45 } },

        // teach the enemies that shoot: one gunpod, alone, with room
        { atX: 52, type: 'wave', formation: 'chain', enemy: 'drone', count: 5, y: 11, spacing: 1.5, params: { amp: 1.4, freq: 0.5 } },
        { atX: 70, type: 'wave', formation: 'turretNest', enemy: 'gunpod', count: 1, y: 8 },

        // first carrier -> the first Witness shard (F1 pickup cadence, §4)
        { atX: 92, type: 'wave', formation: 'escort', enemy: 'drone', count: 2, y: 7 },

        // ── CHECKPOINT 1 (at a rest, F2)
        { atX: 110, type: 'checkpoint' },
        { atX: 116, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },   // F1 recovery

        // rising: darters swoop, a column tests vertical dodge
        { atX: 130, type: 'wave', formation: 'chain', enemy: 'darter', count: 3, y: 10, spacing: 2.0 },
        { atX: 150, type: 'wave', formation: 'column', enemy: 'drone', count: 4, y: 8, spacing: 2.4 },
        { atX: 168, type: 'wave', formation: 'wallMount', enemy: 'crawler', count: 1, params: { mounts: [{ dx: 0, onCeiling: false }, { dx: 6, onCeiling: true }] } },

        // twist: a bit pickup, then combined pressure
        { atX: 188, type: 'pickup', kind: 'bit', y: 6 },
        { atX: 196, type: 'wave', formation: 'pincer', enemy: 'drone', count: 6, y: 8, spacing: 1.6 },
        { atX: 210, type: 'wave', formation: 'turretNest', enemy: 'gunpod', count: 2, y: 8, spacing: 4 },

        // ── the lock gauntlet: scroll holds until it's cleared (LEVELS_PLAN §4)
        { atX: 224, type: 'lock', until: 'cleared' },
        { atX: 225, type: 'wave', formation: 'chain', enemy: 'drone', count: 5, y: 6, spacing: 1.4 },
        { atX: 226, type: 'wave', formation: 'chain', enemy: 'drone', count: 5, y: 10, spacing: 1.4 },
        { atX: 227, type: 'wave', formation: 'chain', enemy: 'lancer', count: 1, y: 8 },

        // ── CHECKPOINT 2 + pre-boss breather (F4: boss checkpoint includes F1)
        { atX: 240, type: 'checkpoint' },
        { atX: 246, type: 'pickup', kind: 'shard', y: 8, recoveryOnly: true },
        { atX: 258, type: 'wave', formation: 'escort', enemy: 'drone', count: 2, y: 9 },   // last shard chance
        { atX: 276, type: 'pickup', kind: 'shard', y: 5 },

        // ── boss entry (LEVELS_PLAN §4). The long empty scroll from the last
        //    wave (~276) to here IS the dread beat; the boss trigger locks the
        //    scroll itself, so a pre-boss `speed 0` must NOT come first — it
        //    would freeze the scroll before it ever reached the boss.
        { atX: 300, type: 'dialogue', id: 'L01_boss' },
        { atX: 306, type: 'boss', id: 'boss01' },
        { atX: 320, type: 'end' }
    ]
};

// ── a low-detail beige hulk silhouette for the parallax layers. Returns a
//    voxel map; build.js meshes it. Kept in this file so the level owns its
//    own backdrop. THREE-free (plain Map + the shared voxel helpers).
import { fillEllipsoid, fillBox, paint } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';

// Two deep, desaturated beiges near the sky value (0x0a0514). ASSETS_PLAN §7:
// parallax colors sit within ~15% of the sky so the layers read as DEPTH, not
// as foreground. Full-strength beige here made the hulks fight the tunnel for
// the eye — these are the tunnel's palette dragged most of the way to black.
const HULK_DARK = 0x241d2a;
const HULK_MID = 0x342838;

function beigeHulk(bias = 0.6) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 10, 4, 3, HULK_DARK);
    fillBox(m, -8, 8, -1, 1, -3, 3, HULK_MID);
    fillEllipsoid(m, 6, 2, 0, 3, 3, 2, HULK_DARK);
    paint(m, (x, y, z, c) => (hash3(x, y, z) > 0.8 ? HULK_MID : c));
    return { map: m };
}

export default LEVEL01;

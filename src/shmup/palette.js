// src/shmup/palette.js
// Purpose: the one palette file for GUMOI: The Lattice Break — the Vessel,
// the enemy faction, bullets, terrain, and the reserved colors.
// Dependencies: none (plain hex ints; import-clean, safe in node tests).
//
// NARRATIVE_PLAN §3 / C7 are law here:
//  - VIOLET (0x8b5cf6 family) is RESERVED. It means exactly two things:
//    "this is GUMOI / the Witness" (her kintsugi scar glow) and
//    "shoot here" (a weakpoint). Nothing else in the game may be violet.
//  - Hostile fire is red/magenta and is the most visible thing on screen
//    (ASSETS_PLAN R4).
//  - Player + pickups glow cool cyan / copper-orange (ASSETS_PLAN R3).

/** The reserved violet. Weakpoints and GUMOI's scar glow only. */
export const VIOLET = 0x8b5cf6;
export const VIOLET_DEEP = 0x6d3fd6;

/** The Vessel (SHIP_PLAN §3, palette amended by NARRATIVE_PLAN §3). */
// Value note: the bible wants a DARK hull, and SHIP_PLAN wants one that reads
// instantly at ~120px against a black background. Those pull opposite ways, and
// the first pass lost — a 0x2b3040 hull was a silhouette-shaped hole in the
// screen. These are the values that satisfy both: mid-dark, unmistakably a
// grey-blue machine rather than a white knight, but a clear step above the
// backdrop so the shape survives at gameplay size.
export const SHIP_PALETTE = {
    hull: 0x7d88a6,        // graphite-blue — dark in spirit, but it has to be SEEN
    hullDark: 0x4d5674,    // belly / shaded panels
    hullLight: 0xa3adc6,   // top-lit panels, canopy surround
    panel: 0x252b3c,       // panel lines / intake trim
    seam: VIOLET,          // painted kintsugi crack-lines (voxel color)
    seamDeep: 0x4060ff,    // the blue half of the seam family
    accent: 0xf97316,      // copper — wing edges, nose ring, fin tip
    canopy: 0x101526,      // dark voxels UNDER the canopy glow mesh
    engineTint: 0xf9a06a,  // warm tint on tail voxels around the exhaust
    // Glow meshes (separate emissive materials — voxel colors never bloom, C1):
    canopyGlow: 0x7fd8ff,  // cyan-violet cockpit
    engineGlow: 0xff9a40,  // copper-orange exhaust
    scarGlow: VIOLET,      // the damage display (C2): ramps 0.5 → 3.5
    muzzleGlow: 0x9fe8ff   // Siren Pulse charge orb
};

/** The Lattice's enforcers (ASSETS_PLAN R6, reinterpreted as archetypes, C9). */
export const FOE_PALETTE = {
    foe: 0x4a3a56,         // dusky violet-gray hull (NOT the reserved violet)
    foeDark: 0x2e2438,
    foeShell: 0x8a8494,    // bone-gray armor
    foeGlow: 0xff2a5a,     // hostile red — every hostile emissive is this family
    foeGlowDim: 0x8a1630,
    foeBullet: 0xff40c0,   // magenta (R4: brightest thing on screen)
    weakpoint: VIOLET      // C7: the honest part. Shoot here.
};

/** Level 01 — The Beige Slope. The color of a thing that will not say no. */
export const BEIGE_PALETTE = {
    base: 0xa89880,
    mid: 0x8c7d68,
    dark: 0x5f5546,
    pale: 0xc8bba4,
    flesh: 0x9a7f6e        // the tunnel is organic, and it is warm
};

/** Terrain (ASSETS_PLAN §6) — industrial dark, no glow meshes ever. */
export const TERRAIN_PALETTE = {
    base: 0x1c1830,
    face: 0x2e2848,
    trim: 0x3a4a6e,
    greeble: 0x151228
};

/** Pickups + the Witness (cool glow = friendly, R3). */
export const PICKUP_PALETTE = {
    shard: VIOLET,         // Witness shard — it IS her, so violet is correct
    shardShell: 0xd8ccff,
    bit: 0x7fe0ff,         // Whisper Bits glow cyan
    carrierCrystal: 0x40a0ff
};

/** Bullets (ASSETS_PLAN §5). R4: hostile fire always wins contrast audit. */
export const BULLET_PALETTE = {
    player: 0x8ef0ff,
    playerHot: 0xefffff,   // tier-2/3 Siren Pulse core
    hammer: 0xffc46b,      // Hammer Round slugs — copper, reads as "kinetic"
    enemy: 0xff48d0,       // hotter magenta — brightest thing on screen
    enemyHeavy: 0xff2458,
    word: 0xfff6ff         // S7 word-bullets — near-white so labels read on any sky
};

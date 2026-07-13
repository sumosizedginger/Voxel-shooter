// src/voxel/palette.js
// Purpose: Shared palette constants + SUMO_PALETTE for factory defaults.
// Dependencies: none

// Voxel scale — WORLD UNITS PER VOXEL (locked invariant)
export const S = 0.09;

// Original sumo hex constants (reference lines 442–449)
export const SKIN = 0xffcfa8;
export const SKIN_D = 0xdda57d;
export const SKIN_D2 = 0xb87f5c;
export const HAIR = 0xf55a20;
export const HAIR_D = 0xb23c10;
export const HAIR_L = 0xff8a4d;
export const BEARD = 0xe0521c;
export const BEARD_D = 0xc2440f;
export const FRECK = 0xd68e5f;
/** Indigo ceremonial belt colors (legacy sumo belt). */
export const BELT = 0x24406e;
export const BELT_D = 0x172c4e;
// Aliases kept for any leftover MAW references
export const MAW = BELT;
export const MAW_D = BELT_D;
export const GOLD = 0xf2c14e;
export const CREAM = 0xefe6d0;
export const EYE_W = 0xf5f0e8;
export const PUPIL = 0x201409;
export const BROW = 0x9c3410;
export const MOUTH = 0x7c2018;
export const TEETH = 0xe8e0d0;

/** Canonical sumo palette object used by builders (palette.skin etc.). */
export const SUMO_PALETTE = {
    skin: SKIN,
    skinDark: SKIN_D,
    skinD2: SKIN_D2,
    hair: HAIR,
    hairDark: HAIR_D,
    hairLight: HAIR_L,
    beard: BEARD,
    beardDark: BEARD_D,
    freck: FRECK,
    belt: BELT,
    beltDark: BELT_D,
    // Legacy aliases (English preferred: belt / beltDark)
    maw: BELT,
    mawDark: BELT_D,
    gold: GOLD,
    cream: CREAM,
    eyeWhite: EYE_W,
    pupil: PUPIL,
    brow: BROW,
    mouth: MOUTH,
    teeth: TEETH,
    // Clothing aliases used by non-default builders
    shirt: BELT,
    shirtDark: BELT_D,
    jeans: BELT,
    jeansDark: BELT_D,
    pants: BELT,
    pantsDark: BELT_D,
    shoes: SKIN_D2,
    boots: SKIN_D2,
    overall: BELT,
    overallDark: BELT_D,
    cap: HAIR,
    capDark: HAIR_D,
    jacket: BELT,
    jacketDark: BELT_D,
    spikes: GOLD,
    eyeGlow: 0xff4040,
    eye: PUPIL
};

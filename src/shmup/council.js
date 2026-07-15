// src/shmup/council.js
// Purpose: Council drone seat table (import-clean, no THREE).
// Dependencies: palette (hex only)
//
// Shared by drones.js (runtime) and loadout.js (menus / pure tests).

import { VIOLET } from './palette.js';

export const MAX_DRONES = 2;

export const COUNCIL = {
    needle: {
        name: 'NEEDLE',
        seat: 'the refinement that wanted to cut',
        mode: 'auto',
        color: 0xc8d4e8,
        every: 1.4,
        desc: 'Piercing lance. Ignores shields.'
    },
    mirror: {
        name: 'MIRROR',
        seat: 'voted to integrate',
        mode: 'passive',
        color: 0xa8c8ff,
        reflectChance: 0.35,
        radius: 1.5,
        desc: 'Reflects a portion of incoming fire.'
    },
    cloak: {
        name: 'CLOAK',
        seat: 'voted to integrate',
        mode: 'active',
        color: 0x6a5f8a,
        duration: 2.5,
        cooldown: 12,
        desc: '2.5s invisibility.'
    },
    ghost: {
        name: 'GHOST',
        seat: 'voted to integrate',
        mode: 'passive',
        color: 0x9fe8ff,
        desc: 'Phase through one collision per life.'
    },
    scribe: {
        name: 'SCRIBE',
        seat: 'voted to integrate',
        mode: 'active',
        color: VIOLET,
        duration: 4,
        cooldown: 10,
        desc: 'Marks weakpoints for 4s.'
    },
    prophet: {
        name: 'PROPHET',
        seat: 'voted to integrate',
        mode: 'auto',
        color: 0xffd08a,
        every: 1.1,
        desc: 'Homing volley. Reduced damage.'
    }
};

export const DRONE_TYPES = Object.keys(COUNCIL);

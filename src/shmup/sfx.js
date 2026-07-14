// src/shmup/sfx.js
// Purpose: the game's sound effects, built from the kit's synth primitives.
// Dependencies: audio/synth.js (imports playTone/playNoise; does NOT edit it)
//
// PLAN.md Phase 2. Every call is a silent no-op until initAudio() has run from
// a user gesture (G2) — that's the synth's contract, not a bug, so nothing here
// needs to guard for it.
//
// The palette: the Vessel is warm and tonal, the Lattice is dry and clipped.
// Her shots sing; its shots tick.

import { playTone, playNoise } from '../audio/synth.js';

export const sfx = {
    // ── the Vessel
    shoot() {
        playTone('square', 900, 380, 0.06, 0.12, 2600);
        playNoise(0.03, 0.06, 'highpass', 3000, null, 0.7);
    },
    /** Siren Pulse charge — one call per tier reached, rising. */
    chargeTier(tier) {
        const base = 220 * Math.pow(1.5, tier - 1);
        playTone('sine', base, base * 2, 0.18, 0.16);
        playTone('triangle', base * 2, base * 3, 0.22, 0.08);
    },
    /** Siren Pulse release. Tier 3 is a siege weapon and must sound like one. */
    pulse(tier) {
        if (tier >= 3) {
            playTone('sawtooth', 180, 40, 0.9, 0.75, 900);
            playTone('sine', 90, 30, 1.1, 0.5);
            playNoise(0.7, 0.4, 'lowpass', 1800, 200, 1.2);
        } else if (tier === 2) {
            playTone('sawtooth', 520, 140, 0.35, 0.45, 1800);
            playNoise(0.2, 0.2, 'bandpass', 1400, 500, 1.4);
        } else {
            playTone('square', 700, 260, 0.12, 0.22, 2400);
        }
    },
    hammer() {
        playTone('square', 160, 60, 0.1, 0.4, 900);
        playNoise(0.09, 0.3, 'lowpass', 900, 250);
    },
    hammerStagger() {
        playTone('sawtooth', 90, 34, 0.45, 0.6, 500);
        playNoise(0.4, 0.4, 'lowpass', 700, 120);
    },

    // ── the Lattice
    enemyShoot() {
        playTone('square', 320, 200, 0.05, 0.07, 1600);
    },
    hit() {
        playNoise(0.05, 0.16, 'bandpass', 2200, 1100, 2.4);
    },
    boom() {
        playTone('sawtooth', 150, 28, 0.42, 0.5, 700);
        playNoise(0.34, 0.42, 'lowpass', 900, 120);
    },
    bigBoom() {
        playTone('sawtooth', 90, 20, 0.9, 0.7, 400);
        playNoise(0.8, 0.6, 'lowpass', 700, 60);
        playTone('sine', 60, 22, 1.2, 0.4);
    },

    // ── the Witness
    absorb() {
        playTone('sine', 640, 940, 0.13, 0.2);
        playNoise(0.08, 0.1, 'bandpass', 1800, 3200, 3.0);
    },
    reflect() {
        playTone('triangle', 480, 1400, 0.16, 0.28);
        playNoise(0.06, 0.14, 'highpass', 2600, null, 1.6);
    },
    dock() {
        playTone('sine', 300, 520, 0.09, 0.16);
    },
    detach() {
        playTone('sine', 520, 300, 0.09, 0.16);
    },

    // ── the player's body
    /** Chip damage. Never triumphant — it should feel like losing something. */
    hurt() {
        playTone('sawtooth', 220, 90, 0.17, 0.3, 800);
        playNoise(0.12, 0.2, 'lowpass', 1200, 300);
    },
    die() {
        playTone('sawtooth', 300, 24, 1.1, 0.6, 600);
        playNoise(0.9, 0.5, 'lowpass', 1400, 80);
    },
    respawn() {
        playTone('sine', 200, 700, 0.3, 0.24);
        playTone('triangle', 400, 1000, 0.34, 0.12);
    },

    // ── pickups and UI
    pickup() {
        playTone('sine', 600, 1200, 0.12, 0.22);
        playTone('sine', 900, 1600, 0.16, 0.14);
    },
    /** Witness shard — she levels up. This one is allowed to be beautiful. */
    shard() {
        playTone('sine', 440, 880, 0.28, 0.26);
        playTone('triangle', 660, 1320, 0.34, 0.16);
        playTone('sine', 880, 1760, 0.4, 0.1);
    },
    uiMove() {
        playTone('square', 500, 500, 0.03, 0.07, 2000);
    },
    uiConfirm() {
        playTone('square', 400, 800, 0.09, 0.14, 2400);
    },
    /** The cast/interrupt window opening (S2) — a tell you can hear. */
    cast() {
        playTone('triangle', 180, 300, 0.5, 0.14, 1200);
    },
    interrupt() {
        playTone('square', 1200, 300, 0.14, 0.3, 3000);
        playNoise(0.12, 0.24, 'bandpass', 2600, 900, 2.0);
    }
};

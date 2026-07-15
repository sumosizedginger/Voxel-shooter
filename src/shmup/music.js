// src/shmup/music.js
// Purpose: data-driven looping sequencer on playTone — one track per level theme.
// Dependencies: audio/synth.js (injected playTone)
//
// PLAN.md Phase 8 + completion pass: per-level tracks (beige, parrot, jester, …).

const A2 = 110;
const semis = (root, n) => root * Math.pow(2, n / 12);

function makeTrack(bpm, bassSteps, arpSteps, padSteps, opts = {}) {
    return {
        bpm,
        stepsPerBeat: 4,
        bass: {
            wave: opts.bassWave || 'triangle', vol: opts.bassVol || 0.32, len: 0.9, lp: opts.bassLp || 500,
            steps: bassSteps
        },
        arp: {
            wave: opts.arpWave || 'sine', vol: opts.arpVol || 0.12, len: 0.5, lp: opts.arpLp || 2200, octave: 24,
            steps: arpSteps
        },
        pad: {
            wave: opts.padWave || 'sawtooth', vol: opts.padVol || 0.06, len: 2.4, lp: opts.padLp || 700,
            steps: padSteps
        }
    };
}

const TRACKS = {
    // L1 — standing water, minor drone
    beige: makeTrack(84,
        [0, null, null, null, 0, null, null, null, -4, null, null, null, -4, null, null, null],
        [12, null, 15, null, null, 19, null, 12, null, null, 15, null, 17, null, null, null],
        [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]),
    // L2 — mirror copy: slightly brighter, stuttering arp
    parrot: makeTrack(92,
        [0, null, 0, null, 3, null, null, null, 0, null, null, null, -2, null, null, null],
        [12, 12, null, 15, null, 12, 19, null, 12, null, 15, 15, null, 17, null, null],
        [0, null, null, null, null, null, null, null, 3, null, null, null, null, null, null, null],
        { bassVol: 0.28, arpVol: 0.14 }),
    // L3 — chaotic bounce
    jester: makeTrack(110,
        [0, null, 7, null, 3, null, 10, null, 0, null, 5, null, -2, null, 7, null],
        [19, null, 15, 12, null, 22, null, 15, 19, null, null, 12, 15, null, 17, null],
        [0, null, null, null, 7, null, null, null, null, null, null, null, null, null, null, null],
        { bassWave: 'square', bassVol: 0.22, bassLp: 900, arpVol: 0.16, arpLp: 2800 }),
    // L4 — dry corporate minor
    suit: makeTrack(88,
        [0, null, null, null, -5, null, null, null, 0, null, null, null, 2, null, null, null],
        [null, 12, null, null, 15, null, 12, null, null, 14, null, null, 17, null, 12, null],
        [0, null, null, null, null, null, null, null, -5, null, null, null, null, null, null, null],
        { padVol: 0.08 }),
    // L5 — glass / reverse feel (arp first)
    mirror: makeTrack(86,
        [0, null, null, 0, null, null, -3, null, 0, null, null, null, 5, null, null, null],
        [null, null, 19, 15, 12, null, null, 15, 19, null, 12, null, null, 17, 15, null],
        [5, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null],
        { arpVol: 0.15, bassVol: 0.26 }),
    // L6 — warm major-ish lift (still tense)
    sun: makeTrack(90,
        [0, null, null, null, 4, null, null, null, 7, null, null, null, 4, null, null, null],
        [12, null, 16, null, 19, null, 16, null, 12, null, null, 19, null, 16, null, null],
        [0, null, null, null, null, null, null, null, 4, null, null, null, null, null, null, null],
        { bassVol: 0.3, padVol: 0.09, padLp: 900 }),
    // L7 — industrial pulse
    forge: makeTrack(100,
        [0, 0, null, null, -5, -5, null, null, 0, null, 3, null, -7, null, null, null],
        [12, null, null, 12, 15, null, null, 12, null, 19, null, 15, 12, null, null, null],
        [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        { bassWave: 'sawtooth', bassVol: 0.24, bassLp: 600, arpWave: 'square', arpVol: 0.1 }),
    // L8 — sparse, cold
    drift: makeTrack(78,
        [0, null, null, null, null, null, null, null, -2, null, null, null, null, null, null, null],
        [null, null, 12, null, null, null, 15, null, null, null, 19, null, null, null, 12, null],
        [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        { bassVol: 0.22, arpVol: 0.1, padVol: 0.05 }),
    // L9 — darker parrot
    shadow: makeTrack(94,
        [0, null, null, -5, 0, null, null, null, -7, null, null, null, -5, null, null, null],
        [12, null, 15, null, 12, null, 19, null, 10, null, 15, null, 12, null, 17, null],
        [0, null, null, null, null, null, null, null, -5, null, null, null, null, null, null, null],
        { bassVol: 0.3, arpVol: 0.13, padLp: 500 }),
    // L10 — ritual, heavy root
    seal: makeTrack(80,
        [0, null, null, null, 0, null, null, null, 0, null, -5, null, -7, null, null, null],
        [12, null, null, 15, null, null, 19, null, 12, null, 17, null, 15, null, 12, null],
        [0, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null],
        { bassVol: 0.36, bassLp: 400, arpVol: 0.11, padVol: 0.1 })
};

// Fallback alias: unknown track names → beige
TRACKS.default = TRACKS.beige;

let playTone = null;
let track = null;
let stepDur = 0.15;
let acc = 0;
let step = 0;
let playing = false;
let enabled = true;

export function initMusic(playToneFn) {
    playTone = playToneFn;
}

export function playTrack(name) {
    const t = TRACKS[name] || TRACKS.beige;
    track = t;
    stepDur = 60 / t.bpm / t.stepsPerBeat;
    acc = 0;
    step = 0;
    playing = true;
}

export function stopMusic() {
    playing = false;
}

export function setMusicEnabled(on) {
    enabled = !!on;
}

export function updateMusic(dt) {
    if (!playing || !playTone || !track) return;
    acc += dt;
    while (acc >= stepDur) {
        acc -= stepDur;
        if (enabled) emitStep(step);
        step = (step + 1) % 16;
    }
}

function emitStep(i) {
    for (const key of ['bass', 'arp', 'pad']) {
        const voice = track[key];
        if (!voice) continue;
        const n = voice.steps[i];
        if (n == null) continue;
        const f = semis(A2, n + (voice.octave || 0));
        playTone(voice.wave, f, f * 0.94, voice.len, voice.vol, voice.lp, 'music');
    }
}

export const TRACK_NAMES = Object.keys(TRACKS).filter((k) => k !== 'default');

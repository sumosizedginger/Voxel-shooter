// src/shmup/music.js
// Purpose: data-driven looping sequencer on playTone — one track per level theme.
// Dependencies: audio/synth.js (injected playTone)
//
// PLAN.md Phase 8 + presentation pass: 32-step phrases (A/B feel), denser voices.

const A2 = 110;
const semis = (root, n) => root * Math.pow(2, n / 12);

function makeTrack(bpm, bassSteps, arpSteps, padSteps, opts = {}) {
    return {
        bpm,
        stepsPerBeat: 4,
        len: Math.max(bassSteps.length, arpSteps.length, padSteps.length, 16),
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
        },
        // Optional 4th voice: sparse high chime for phrase contrast.
        chime: opts.chime || null
    };
}

// Phrase builder: A (0-15) + B (16-31) + C (32-47) for ABC structure.
function padPhraseC(steps, c) {
    const base = steps.slice();
    while (base.length < 32) base.push(null);
    const cPhrase = c || steps.slice(0, 16).map((n, i) => (i % 4 === 0 ? n : null));
    return base.slice(0, 32).concat(cPhrase.slice(0, 16));
}

// 48-step patterns: phrase A, answer B, lift C.
const TRACKS = {
    beige: makeTrack(84,
        [0, null, null, null, 0, null, null, null, -4, null, null, null, -4, null, null, null,
            0, null, null, 3, null, null, null, null, -5, null, null, null, -4, null, 0, null],
        [12, null, 15, null, null, 19, null, 12, null, null, 15, null, 17, null, null, null,
            12, null, null, 19, null, 15, null, 12, 14, null, 17, null, null, 15, null, null],
        [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
            -4, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null],
        { chime: { wave: 'sine', vol: 0.05, len: 0.35, lp: 3000, octave: 36,
            steps: [null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, 5, null, null, null, null, null, null, null, 0, null] } }),
    parrot: makeTrack(92,
        [0, null, 0, null, 3, null, null, null, 0, null, null, null, -2, null, null, null,
            0, 0, null, 3, null, null, 5, null, 0, null, -2, null, 3, null, null, null],
        [12, 12, null, 15, null, 12, 19, null, 12, null, 15, 15, null, 17, null, null,
            19, 12, null, 15, 12, 12, null, 19, null, 15, null, 17, 12, null, 15, null],
        [0, null, null, null, null, null, null, null, 3, null, null, null, null, null, null, null,
            0, null, null, null, 5, null, null, null, 3, null, null, null, null, null, null, null],
        { bassVol: 0.28, arpVol: 0.14 }),
    jester: makeTrack(110,
        [0, null, 7, null, 3, null, 10, null, 0, null, 5, null, -2, null, 7, null,
            3, null, 10, null, 0, null, 7, null, 5, null, 12, null, 0, null, 7, null],
        [19, null, 15, 12, null, 22, null, 15, 19, null, null, 12, 15, null, 17, null,
            22, 15, null, 19, null, 12, 15, null, 17, null, 22, 12, null, 15, 19, null],
        [0, null, null, null, 7, null, null, null, null, null, null, null, null, null, null, null,
            3, null, null, null, 10, null, null, null, 0, null, null, null, 7, null, null, null],
        { bassWave: 'square', bassVol: 0.22, bassLp: 900, arpVol: 0.16, arpLp: 2800 }),
    suit: makeTrack(88,
        [0, null, null, null, -5, null, null, null, 0, null, null, null, 2, null, null, null,
            0, null, null, -5, null, null, null, 0, null, 2, null, null, -3, null, null, null],
        [null, 12, null, null, 15, null, 12, null, null, 14, null, null, 17, null, 12, null,
            null, 15, null, 12, null, 17, null, 14, null, 12, null, 15, null, 19, null, 12],
        [0, null, null, null, null, null, null, null, -5, null, null, null, null, null, null, null,
            0, null, null, null, null, null, null, null, 2, null, null, null, null, null, null, null],
        { padVol: 0.08 }),
    mirror: makeTrack(86,
        [0, null, null, 0, null, null, -3, null, 0, null, null, null, 5, null, null, null,
            -3, null, null, 0, null, 5, null, null, 0, null, null, -5, null, null, 0, null],
        [null, null, 19, 15, 12, null, null, 15, 19, null, 12, null, null, 17, 15, null,
            15, 19, null, 12, null, null, 17, 15, null, 12, 19, null, 15, null, 12, null],
        [5, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null,
            -3, null, null, null, null, null, null, null, 5, null, null, null, null, null, null, null],
        { arpVol: 0.15, bassVol: 0.26 }),
    sun: makeTrack(90,
        [0, null, null, null, 4, null, null, null, 7, null, null, null, 4, null, null, null,
            0, null, 4, null, 7, null, 9, null, 7, null, 4, null, 0, null, null, null],
        [12, null, 16, null, 19, null, 16, null, 12, null, null, 19, null, 16, null, null,
            12, 16, null, 19, 16, null, 21, null, 19, null, 16, 12, null, 16, null, 19],
        [0, null, null, null, null, null, null, null, 4, null, null, null, null, null, null, null,
            7, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null],
        { bassVol: 0.3, padVol: 0.09, padLp: 900 }),
    forge: makeTrack(100,
        [0, 0, null, null, -5, -5, null, null, 0, null, 3, null, -7, null, null, null,
            0, 0, null, -5, -5, null, 0, null, 3, 3, null, -7, null, 0, null, null],
        [12, null, null, 12, 15, null, null, 12, null, 19, null, 15, 12, null, null, null,
            12, 15, null, 12, null, 19, 15, null, 12, null, 17, null, 15, 12, null, 19],
        [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
            -5, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null],
        { bassWave: 'sawtooth', bassVol: 0.24, bassLp: 600, arpWave: 'square', arpVol: 0.1 }),
    drift: makeTrack(78,
        [0, null, null, null, null, null, null, null, -2, null, null, null, null, null, null, null,
            0, null, null, null, -5, null, null, null, -2, null, null, null, 0, null, null, null],
        [null, null, 12, null, null, null, 15, null, null, null, 19, null, null, null, 12, null,
            null, 15, null, null, 12, null, null, 19, null, null, 17, null, null, 12, null, null],
        [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
            -2, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null],
        { bassVol: 0.22, arpVol: 0.1, padVol: 0.05 }),
    shadow: makeTrack(94,
        [0, null, null, -5, 0, null, null, null, -7, null, null, null, -5, null, null, null,
            0, null, -5, null, 0, null, -7, null, -5, null, null, 0, null, -3, null, null],
        [12, null, 15, null, 12, null, 19, null, 10, null, 15, null, 12, null, 17, null,
            10, 12, null, 15, null, 19, null, 12, 15, null, 17, null, 12, 10, null, 15],
        [0, null, null, null, null, null, null, null, -5, null, null, null, null, null, null, null,
            -7, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null],
        { bassVol: 0.3, arpVol: 0.13, padLp: 500 }),
    seal: makeTrack(80,
        [0, null, null, null, 0, null, null, null, 0, null, -5, null, -7, null, null, null,
            0, null, null, -5, null, null, -7, null, 0, null, null, null, -5, null, 0, null],
        [12, null, null, 15, null, null, 19, null, 12, null, 17, null, 15, null, 12, null,
            15, null, 19, null, 12, null, 17, 15, null, 12, null, 19, null, 15, 12, null],
        [0, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null,
            -5, null, null, null, null, null, null, null, -7, null, null, null, 0, null, null, null],
        { bassVol: 0.36, bassLp: 400, arpVol: 0.11, padVol: 0.1,
            chime: { wave: 'sine', vol: 0.06, len: 0.5, lp: 2500, octave: 36,
                steps: [null, null, null, 0, null, null, null, null, null, null, null, 7, null, null, null, null,
                    null, null, 5, null, null, null, null, null, null, 0, null, null, null, null, 12, null] } })
};

// Expand every track to 48-step ABC (A+B already authored; C is a lift/variation).
function expandToABC(track) {
    const cBass = [0, null, null, 5, null, null, null, null, -4, null, 0, null, null, null, 3, null];
    const cArp = [12, null, null, 19, null, 15, null, 12, null, 17, null, null, 15, null, 12, null];
    const cPad = [0, null, null, null, null, null, null, null, 5, null, null, null, null, null, null, null];
    track.bass.steps = padPhraseC(track.bass.steps, cBass);
    track.arp.steps = padPhraseC(track.arp.steps, cArp);
    track.pad.steps = padPhraseC(track.pad.steps, cPad);
    if (track.chime && track.chime.steps) {
        track.chime.steps = padPhraseC(track.chime.steps,
            [null, null, 7, null, null, null, null, 0, null, null, 5, null, null, null, 12, null]);
    }
    track.len = 48;
    return track;
}
for (const k of Object.keys(TRACKS)) expandToABC(TRACKS[k]);

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
    const len = track.len || 16;
    while (acc >= stepDur) {
        acc -= stepDur;
        if (enabled) emitStep(step % len);
        step = (step + 1) % len;
    }
}

function emitStep(i) {
    for (const key of ['bass', 'arp', 'pad']) {
        const voice = track[key];
        if (!voice) continue;
        const n = voice.steps[i % voice.steps.length];
        if (n == null) continue;
        const f = semis(A2, n + (voice.octave || 0));
        playTone(voice.wave, f, f * 0.94, voice.len, voice.vol, voice.lp, 'music');
    }
    if (track.chime) {
        const voice = track.chime;
        const n = voice.steps[i % voice.steps.length];
        if (n != null) {
            const f = semis(A2, n + (voice.octave || 0));
            playTone(voice.wave, f, f * 0.97, voice.len, voice.vol, voice.lp, 'music');
        }
    }
}

export const TRACK_NAMES = Object.keys(TRACKS).filter((k) => k !== 'default');
export function trackStepCount(name) {
    const t = TRACKS[name] || TRACKS.beige;
    return t.len || 16;
}

// src/shmup/music.js
// Purpose: a minimal looping sequencer on top of the kit's playTone.
// Dependencies: audio/synth.js (playTone; channel 'music' so the music volume
//   slider works — synth stays untouched)
//
// PLAN.md Phase 8. Data-driven note arrays so a real composition can replace the
// placeholder later. The register is the bible's: "High-Voltage Melancholy" — a
// slow minor-key drone with a sparse arp, not a chiptune march. The Beige Slope
// is a tunnel of soft voices all saying the same safe thing; the music should
// feel like standing water.
//
// Notes are semitone offsets from a track root (A2 = 110 Hz). A step is a 16th.

const A2 = 110;
const semis = (root, n) => root * Math.pow(2, n / 12);

// Minor scale degrees used across the tracks (A natural minor around A2).
// step: semitone offset or null (rest). Each track advances one step per tick.
const TRACKS = {
    beige: {
        bpm: 84,
        stepsPerBeat: 4,
        // A slow tonic-drone bass, dwelling on the root and the minor sixth.
        bass: {
            wave: 'triangle', vol: 0.32, len: 0.9, lp: 500,
            steps: [0, null, null, null, 0, null, null, null,
                    -4, null, null, null, -4, null, null, null]  // A ... F
        },
        // A sparse, mournful arp two octaves up — the "voices", thinned out.
        arp: {
            wave: 'sine', vol: 0.12, len: 0.5, lp: 2200, octave: 24,
            steps: [12, null, 15, null, null, 19, null, 12,
                    null, null, 15, null, 17, null, null, null]
        },
        // A single soft pad hit on the downbeat of every other bar.
        pad: {
            wave: 'sawtooth', vol: 0.06, len: 2.4, lp: 700,
            steps: [0, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null]
        }
    }
};

let playTone = null;             // injected, so this module has no hard audio dep
let track = null;
let stepDur = 0.15;
let acc = 0;
let step = 0;
let playing = false;
let enabled = true;

/** Wire the synth in (game.js passes audio/synth's playTone). Idempotent. */
export function initMusic(playToneFn) {
    playTone = playToneFn;
}

/** Start a named track from the top. No-op if audio isn't wired yet. */
export function playTrack(name) {
    const t = TRACKS[name];
    if (!t) return;
    track = t;
    stepDur = 60 / t.bpm / t.stepsPerBeat;
    acc = 0;
    step = 0;
    playing = true;
}

export function stopMusic() {
    playing = false;
}

/** Mute/unmute without losing the playhead (pause, reduceHorrorAudio, etc.). */
export function setMusicEnabled(on) {
    enabled = !!on;
}

/** Advance the sequencer. Call every frame with dt (seconds). */
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
        // A gentle downward glide on each note — the melancholy, made audible.
        playTone(voice.wave, f, f * 0.94, voice.len, voice.vol, voice.lp, 'music');
    }
}

export const TRACK_NAMES = Object.keys(TRACKS);

// src/audio/synth.js
// Purpose: Web Audio synthesis primitives + sfx object (verbatim from original).
// Dependencies: none

let audioCtx = null;
let noiseBuf = null;

/** Creates the AudioContext + noise buffer. Idempotent. Call from a user gesture (browsers require one). */
export function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const len = (audioCtx.sampleRate * 0.6) | 0;
    noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

// ── Volume channels (Phase 3): master × (sfx | music). mapping.js keeps
//    these synced with the settings module; synth stays dependency-free. ──
const _vols = { master: 1, sfx: 1, music: 1 };

/** Merge {master?, sfx?, music?} into the volume state; playTone/playNoise multiply their vol by master*channel. */
export function setVolumes(v) {
    Object.assign(_vols, v);
}

function gainFor(channel) {
    return _vols.master * (_vols[channel] != null ? _vols[channel] : 1);
}

/** An oscillator gliding f0->f1 over dur seconds while gain decays to ~0; optional lowpass at lp Hz. No-ops before initAudio(). */
export function playTone(type, f0, f1, dur, vol, lp, channel = 'sfx') {
    if (!audioCtx) return;
    vol = vol * gainFor(channel);
    if (vol <= 0.0005) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = o;
    if (lp) {
        const fl = audioCtx.createBiquadFilter();
        fl.type = 'lowpass';
        fl.frequency.setValueAtTime(lp, t);
        o.connect(fl);
        node = fl;
    }
    node.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
}

/** Plays the shared noise buffer through a biquad filter, optionally sweeping f0->f1, Q defaulting to 0.8. */
export function playNoise(dur, vol, fType, f0, f1, q, channel = 'sfx') {
    if (!audioCtx) return;
    vol = vol * gainFor(channel);
    if (vol <= 0.0005) return;
    const t = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    const fl = audioCtx.createBiquadFilter();
    fl.type = fType;
    fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    fl.Q.value = q || 0.8;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(audioCtx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
}

export const sfx = {
    stomp() {
        playTone('sawtooth', 70, 14, 0.5, 0.85, 130);
        playNoise(0.35, 0.5, 'lowpass', 400, 80);
    },
    slap() {
        playNoise(0.07, 0.5, 'bandpass', 2400, null, 1.2);
        playTone('triangle', 300, 120, 0.12, 0.3);
    },
    kick() {
        playTone('sine', 150, 42, 0.22, 0.55);
        playNoise(0.12, 0.3, 'lowpass', 600, 200);
    },
    grab() {
        playNoise(0.12, 0.3, 'lowpass', 700, 250);
    },
    heave() {
        playTone('sawtooth', 120, 36, 0.32, 0.6, 200);
        playNoise(0.3, 0.45, 'lowpass', 500, 90);
    },
    whoosh() {
        playNoise(0.28, 0.28, 'bandpass', 350, 950, 1.5);
    },
    step() {
        playTone('sine', 95, 45, 0.09, 0.16);
    },
    land() {
        playTone('sine', 110, 40, 0.16, 0.4);
        playNoise(0.14, 0.25, 'lowpass', 450, 120);
    },
    block() {
        // Metallic guard clang so a blocked hit reads as a real mechanic.
        playNoise(0.09, 0.35, 'bandpass', 1800, 900, 3.0);
        playTone('square', 520, 300, 0.08, 0.18);
    }
};

export { audioCtx };

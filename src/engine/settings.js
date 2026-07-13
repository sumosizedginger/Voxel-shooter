// src/engine/settings.js
// Purpose: The one module that owns all persisted state — settings,
// campaign progress, and high scores. Every later feature (difficulty,
// accessibility toggles, volume, keybindings, "intro seen", endings,
// hint flags) reads and writes through this API so persistence lives in
// exactly one place.
// Dependencies: none (must stay import-clean — it loads before the engine
// and is used by headless tests without a renderer).

const KEYS = {
    settings: 'vsbeu.settings',
    progress: 'vsbeu.progress',
    scores: 'vsbeu.scores'
};

export const SETTING_DEFAULTS = {
    difficulty: 'normal',        // easy | normal | hard
    masterVolume: 1,
    sfxVolume: 1,
    musicVolume: 1,
    reduceFlashing: false,
    reduceMotion: false,
    reduceHorrorAudio: false,    // mutes whisper / softens sub-bass, never text
    alwaysShowDialogue: false,   // replay intro/boss intros even when seen
    keybindings: null,           // null = input.js defaults; else {action: code}
    lastHero: 0
};

const PROGRESS_DEFAULTS = {
    highestLevel: 1,
    heroCompletions: {},         // heroId -> true once the campaign is cleared
    introSeen: false,
    bossIntroSeen: [],           // bossIds whose intro dialogue has played
    contentWarningAck: false,
    hintsSeen: [],               // onboarding hint ids
    tutorialDone: false,
    unlockedEndings: []          // 'destroyer' | 'liberator' | 'merged'
};

const MAX_SCORES = 10;

// localStorage may be absent (file://, some headless contexts) or throw
// (privacy modes). Everything funnels through these two guards; when
// storage is unavailable the module still works, it just doesn't persist.
function readJSON(key) {
    try {
        if (!window.localStorage) return null;
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeJSON(key, value) {
    try {
        if (window.localStorage) {
            window.localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (e) {
        // persistence is a convenience, not a requirement
    }
}

// In-memory copies are the source of truth for the session; storage is a
// mirror. Unknown keys from older/newer saves are preserved on write but
// never returned past the defaults filter.
let settings = Object.assign({}, SETTING_DEFAULTS, readJSON(KEYS.settings) || {});
let progress = Object.assign({}, PROGRESS_DEFAULTS, readJSON(KEYS.progress) || {});
let scores = Array.isArray(readJSON(KEYS.scores)) ? readJSON(KEYS.scores) : [];

const listeners = new Set();

export function getSetting(key) {
    return settings[key];
}

/** Persist a setting and notify subscribers ({key, value} per change). */
export function setSetting(key, value) {
    if (settings[key] === value) return;
    settings[key] = value;
    writeJSON(KEYS.settings, settings);
    for (const fn of listeners) {
        try { fn(key, value); } catch (e) { /* listener errors stay local */ }
    }
}

/** Subscribe to setting changes; returns an unsubscribe function. */
export function onSettingChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function getProgress() {
    return progress;
}

/** Merge a partial progress update and persist. */
export function setProgress(patch) {
    Object.assign(progress, patch);
    writeJSON(KEYS.progress, progress);
}

/** Convenience: append to a progress array field without duplicates. */
export function markProgressFlag(arrayField, id) {
    const arr = progress[arrayField];
    if (!Array.isArray(arr)) return;
    if (!arr.includes(id)) {
        arr.push(id);
        writeJSON(KEYS.progress, progress);
    }
}

export function getScores() {
    return scores.slice();
}

/** Record a run; keeps the top MAX_SCORES sorted descending. */
export function addScore(entry) {
    scores.push({
        score: entry.score | 0,
        hero: entry.hero || '',
        ending: entry.ending || null,
        date: entry.date || new Date().toISOString().slice(0, 10)
    });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, MAX_SCORES);
    writeJSON(KEYS.scores, scores);
    return scores;
}

/**
 * Difficulty scalars (Phase 3). Applied where enemies/bosses are created —
 * never to story beats. The Phase-0A audit numbers are the 'normal' curve.
 */
export function difficultyMultipliers() {
    const d = settings.difficulty;
    if (d === 'easy') return { enemyHp: 0.7, enemyDmg: 0.7 };
    if (d === 'hard') return { enemyHp: 1.3, enemyDmg: 1.25 };
    return { enemyHp: 1, enemyDmg: 1 };
}

/** Test/debug helper: reset everything to defaults (and clear storage). */
export function resetAll() {
    settings = Object.assign({}, SETTING_DEFAULTS);
    progress = Object.assign({}, PROGRESS_DEFAULTS,
        // fresh arrays/objects — the defaults object must never be mutated
        { heroCompletions: {}, bossIntroSeen: [], hintsSeen: [], unlockedEndings: [] });
    scores = [];
    try {
        if (window.localStorage) {
            for (const k of Object.values(KEYS)) window.localStorage.removeItem(k);
        }
    } catch (e) { /* ignore */ }
}

// Reload guard: a stale save from before a field existed gets the default
// (Object.assign above), but arrays shared with PROGRESS_DEFAULTS would
// alias across resetAll — make sure the live copies are always our own.
if (progress.bossIntroSeen === PROGRESS_DEFAULTS.bossIntroSeen) progress.bossIntroSeen = [];
if (progress.hintsSeen === PROGRESS_DEFAULTS.hintsSeen) progress.hintsSeen = [];
if (progress.unlockedEndings === PROGRESS_DEFAULTS.unlockedEndings) progress.unlockedEndings = [];
if (progress.heroCompletions === PROGRESS_DEFAULTS.heroCompletions) progress.heroCompletions = {};

// Debug/test handle (matches gameWorld's convention in game.js).
if (typeof window !== 'undefined') {
    window.vsbeuSettings = { getSetting, setSetting, getProgress, setProgress, addScore, getScores, resetAll, markProgressFlag };
}

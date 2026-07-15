// src/engine/settings.js
// Purpose: The one module that owns all persisted state — settings,
// campaign progress, and high scores. Dual-read vsbeu.* legacy + write rtype.*.
// Dependencies: none (must stay import-clean).

const LEGACY_KEYS = {
    settings: 'vsbeu.settings',
    progress: 'vsbeu.progress',
    scores: 'vsbeu.scores'
};

const KEYS = {
    settings: 'rtype.settings',
    progress: 'rtype.progress',
    scores: 'rtype.scores'
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
    keybindings: null,           // null = input.js defaults; else {action: codes[]}
    lastHero: 0,
    // A11y / product (ship-quality)
    largerHud: false,
    lowerShake: false,
    holdToFire: true,            // false = tap-only bolts (no auto-hold stream)
    quality: 'high',             // low | high | ultra
    tipsDone: false
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

/** Prefer rtype.* ; fall back to vsbeu.* so old saves migrate on next write. */
function loadBag(primary, legacy) {
    const a = readJSON(primary);
    if (a != null) return a;
    return readJSON(legacy);
}

function writeBag(primary, legacy, value) {
    writeJSON(primary, value);
    // Keep legacy key in sync once so older tools still see data; primary is rtype.
    writeJSON(legacy, value);
}

// In-memory copies are the source of truth for the session; storage is a mirror.
let settings = Object.assign({}, SETTING_DEFAULTS, loadBag(KEYS.settings, LEGACY_KEYS.settings) || {});
let progress = Object.assign({}, PROGRESS_DEFAULTS, loadBag(KEYS.progress, LEGACY_KEYS.progress) || {});
const rawScores = loadBag(KEYS.scores, LEGACY_KEYS.scores);
let scores = Array.isArray(rawScores) ? rawScores : [];

const listeners = new Set();

export function getSetting(key) {
    return settings[key];
}

/** Persist a setting and notify subscribers ({key, value} per change). */
export function setSetting(key, value) {
    if (settings[key] === value) return;
    settings[key] = value;
    writeBag(KEYS.settings, LEGACY_KEYS.settings, settings);
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
    writeBag(KEYS.progress, LEGACY_KEYS.progress, progress);
}

/** Convenience: append to a progress array field without duplicates. */
export function markProgressFlag(arrayField, id) {
    const arr = progress[arrayField];
    if (!Array.isArray(arr)) return;
    if (!arr.includes(id)) {
        arr.push(id);
        writeBag(KEYS.progress, LEGACY_KEYS.progress, progress);
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
    writeBag(KEYS.scores, LEGACY_KEYS.scores, scores);
    return scores;
}

/**
 * Difficulty scalars (Phase 3). Applied where enemies/bosses are created —
 * never to story beats.
 */
export function difficultyMultipliers() {
    const d = settings.difficulty;
    if (d === 'easy') return { enemyHp: 0.7, enemyDmg: 0.7 };
    if (d === 'hard') return { enemyHp: 1.3, enemyDmg: 1.25 };
    return { enemyHp: 1, enemyDmg: 1 };
}

/** Reset settings only (keep progress/scores). Used by Options → Reset defaults. */
export function resetSettingsDefaults() {
    settings = Object.assign({}, SETTING_DEFAULTS);
    writeBag(KEYS.settings, LEGACY_KEYS.settings, settings);
    for (const fn of listeners) {
        try { fn('*', settings); } catch (e) { /* ignore */ }
    }
    return settings;
}

/** Test/debug helper: reset everything to defaults (and clear storage). */
export function resetAll() {
    settings = Object.assign({}, SETTING_DEFAULTS);
    progress = Object.assign({}, PROGRESS_DEFAULTS,
        { heroCompletions: {}, bossIntroSeen: [], hintsSeen: [], unlockedEndings: [] });
    scores = [];
    try {
        if (window.localStorage) {
            for (const k of Object.values(KEYS)) window.localStorage.removeItem(k);
            for (const k of Object.values(LEGACY_KEYS)) window.localStorage.removeItem(k);
        }
    } catch (e) { /* ignore */ }
}

// Reload guard: arrays must not alias defaults.
if (progress.bossIntroSeen === PROGRESS_DEFAULTS.bossIntroSeen) progress.bossIntroSeen = [];
if (progress.hintsSeen === PROGRESS_DEFAULTS.hintsSeen) progress.hintsSeen = [];
if (progress.unlockedEndings === PROGRESS_DEFAULTS.unlockedEndings) progress.unlockedEndings = [];
if (progress.heroCompletions === PROGRESS_DEFAULTS.heroCompletions) progress.heroCompletions = {};

// Migrate once: if we loaded from legacy only, write rtype.* immediately.
try {
    if (typeof window !== 'undefined' && window.localStorage) {
        if (!window.localStorage.getItem(KEYS.settings) && window.localStorage.getItem(LEGACY_KEYS.settings)) {
            writeJSON(KEYS.settings, settings);
        }
        if (!window.localStorage.getItem(KEYS.progress) && window.localStorage.getItem(LEGACY_KEYS.progress)) {
            writeJSON(KEYS.progress, progress);
        }
        if (!window.localStorage.getItem(KEYS.scores) && window.localStorage.getItem(LEGACY_KEYS.scores)) {
            writeJSON(KEYS.scores, scores);
        }
    }
} catch (e) { /* ignore */ }

if (typeof window !== 'undefined') {
    window.vsbeuSettings = {
        getSetting, setSetting, getProgress, setProgress, addScore, getScores,
        resetAll, resetSettingsDefaults, markProgressFlag
    };
    window.rtypeSettings = window.vsbeuSettings;
}

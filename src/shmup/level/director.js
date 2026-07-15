// src/shmup/level/director.js
// Purpose: the level director — fires triggers as the level scrolls past them,
// and rewinds on death. Import-clean core (no THREE); side effects go through
// injected callbacks so the whole thing is unit-testable.
// Dependencies: none (the host wires spawn/pickup/etc. via the callback object)
//
// LEVELS_PLAN §2. The contract: fire every trigger whose atX <= scrollX exactly
// once, in order. `reset(toX)` re-arms every trigger after toX and asks the host
// to despawn what's live — that's the checkpoint rewind (PLAN.md Phase 3).
//
// The director does not know what a "wave" or a "boss" IS. It knows an ordered
// list of {atX, type} and a table of handlers. That's why the trigger
// vocabulary can grow (LEVELS_PLAN wants all eight types available even though
// Level 01 uses a subset) without touching this file — a new type is a new
// handler key, nothing more.

export const TRIGGER_TYPES = [
    'wave', 'pickup', 'checkpoint', 'speed', 'lock', 'dialogue', 'boss', 'end'
];

/**
 * @param {object} level  { triggers: [{atX, type, ...}], checkpoints?: [] }
 * @param {object} handlers  type -> (trigger, ctx) => void. `ctx` is whatever
 *        the host passes to update(); the director just forwards it.
 */
export function createDirector(level, handlers = {}) {
    // Sort a COPY by atX so authoring order doesn't matter and the level object
    // isn't mutated (the stage-lint spec asserts on the original order too).
    const triggers = (level.triggers || [])
        .map((t, i) => ({ ...t, _i: i }))
        .sort((a, b) => (a.atX - b.atX) || (a._i - b._i));

    const d = {
        level,
        triggers,
        handlers,
        fired: new Array(triggers.length).fill(false),
        cursor: 0,              // next unfired trigger index (triggers are sorted)
        // Live "lock" state: while locked, the director waits for the lock's
        // release condition before advancing the scroll (the host reads this).
        locked: false,
        lockTrigger: null,
        finished: false
    };
    return d;
}

/**
 * Fire everything the playhead has reached. Call once per frame with scrollX
 * and a ctx object the handlers need (world, etc.).
 * @returns {number} how many triggers fired this call
 */
export function updateDirector(d, scrollX, ctx) {
    let n = 0;
    while (d.cursor < d.triggers.length) {
        const t = d.triggers[d.cursor];
        if (t.atX > scrollX) break;

        d.fired[d.cursor] = true;
        d.cursor++;
        n++;

        if (t.type === 'lock') {
            // A lock holds the scroll until its condition clears. The director
            // records it; the host enforces the scroll-hold and calls
            // releaseLock() when the condition (usually "waves cleared") is met.
            d.locked = true;
            d.lockTrigger = t;
        }
        if (t.type === 'end') d.finished = true;

        const h = d.handlers[t.type];
        if (h) h(t, ctx);
    }
    return n;
}

/** The host clears a lock once its condition is satisfied (e.g. screen empty). */
export function releaseLock(d) {
    d.locked = false;
    d.lockTrigger = null;
}

/**
 * Rewind to `toX`: re-arm every trigger strictly after toX so it fires again on
 * the way back through. Triggers AT or before toX stay fired (you already
 * passed them). This is the death rewind — the waves you fought come back.
 * @param {(from:number,to:number)=>void} [onReset] host despawns live entities
 */
export function resetDirector(d, toX, onReset) {
    for (let i = 0; i < d.triggers.length; i++) {
        d.fired[i] = d.triggers[i].atX <= toX;
    }
    // cursor = first still-unfired trigger.
    d.cursor = d.fired.findIndex((f) => !f);
    if (d.cursor < 0) d.cursor = d.triggers.length;
    d.locked = false;
    d.lockTrigger = null;
    d.finished = false;
    if (onReset) onReset(toX);
}

/** Upcoming triggers, for the debug timeline (LEVELS_PLAN §8). */
export function upcomingTriggers(d, count = 6) {
    return d.triggers.slice(d.cursor, d.cursor + count);
}

/** How far into the level the playhead is, 0..1 (HUD progress). */
export function levelProgress(d, scrollX) {
    if (!d.level.length) return 0;
    return Math.max(0, Math.min(1, scrollX / d.level.length));
}

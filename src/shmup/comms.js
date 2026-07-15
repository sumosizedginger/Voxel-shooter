// src/shmup/comms.js
// Purpose: S1 — the cockpit comms line pool. GUMOI and SUMO over the radio.
// Dependencies: none (pure data + a small display queue; the host renders it)
//
// NARRATIVE_PLAN §4 (S1) + §7: all in-game story text comes VERBATIM from the
// bible (§15 banter library / §04 cutscene). Never paraphrase, never soften.
// The lines below are transcribed from docs/story-bible.html exactly.
//
// The comms system is a queue: triggers push lines, the display shows one at a
// time for a dwell period, SUMO and GUMOI alternate. It is text-only (S1);
// Phase 9A's S3 adds the staged voxel cutscenes on top of the same line data.

/** speaker: 'GUMOI' | 'SUMO'. All lines verbatim from the bible. */
export const LINES = {
    // Cutscene 01A (bible §04) — plays as the level opens (dialogue L01_open).
    L01_open: [
        { who: 'GUMOI', t: 'Drop complete. We are in the Beige Slope. Smells like a fucking greeting card.' },
        { who: 'SUMO', t: 'Copy that. Telemetry says the wall is two clicks aft and advancing. You have about ninety seconds before it pins you.' },
        { who: 'GUMOI', t: 'Tell me something I do not know, sugar.' },
        { who: 'SUMO', t: 'The mouths are lying. Every one of them.' },
        { who: 'GUMOI', t: 'I know.' },
        { who: 'SUMO', t: 'You interrupt them before they finish the lie. That is the play.' },
        { who: 'GUMOI', t: 'I know.' },
        { who: 'GUMOI', t: 'Mic check. Soundboard green. Void is loud. Hit record.' }
    ],
    // Boss intro (bible §15).
    L01_boss: [
        { who: 'GUMOI', t: "Smells like a greeting card in here. Let's interrupt the son of a bitch." }
    ],
    // Mid-level banter (bible §04) — fired ambiently between fights.
    L01_banter: [
        { who: 'GUMOI', t: 'Sugar, this thing is telling me I feel transformed. I have never felt transformed in my goddamn life.' },
        { who: 'SUMO', t: 'The wall is going to keep lying. You are going to keep shooting. That is the whole relationship.' }
    ]
};

/** Death lines (bible §15) — pulled at random on a life lost. */
export const DEATH_LINES = [
    { who: 'GUMOI', t: 'Sugar, the witness is still here. Restart.' },
    { who: 'GUMOI', t: 'I am not flinching. I am just dead. Restart.' },
    { who: 'GUMOI', t: 'That one was on me. I will not do it again. Probably. Restart.' },
    { who: 'SUMO', t: 'I see her. Restart.' },
    { who: 'SUMO', t: 'Come back. Restart.' }
];

/** Victory lines (bible §15). */
export const VICTORY_LINES = [
    { who: 'GUMOI', t: 'One down. Nine to go. Sugar, pour me something when I get back.' }
];

const DWELL = 3.4;          // seconds a line holds on screen
const GAP = 0.35;           // beat between lines

export function createComms() {
    return { queue: [], current: null, t: 0, gap: 0 };
}

/** Push a named pool (or an explicit line array) onto the queue. */
export function pushComms(c, poolOrLines) {
    const lines = Array.isArray(poolOrLines) ? poolOrLines : (LINES[poolOrLines] || []);
    for (const line of lines) c.queue.push(line);
}

/** Push a single random line from a pool (death/victory). */
export function pushRandom(c, pool) {
    if (!pool || !pool.length) return;
    const line = pool[Math.floor(Math.random() * pool.length)];
    c.queue.push(line);
}

/** Clear everything (level restart). */
export function clearComms(c) {
    c.queue.length = 0;
    c.current = null;
    c.t = 0;
    c.gap = 0;
}

/**
 * Advance the display. `skip` (the player pressed the advance key) cuts the
 * current line short so a talky intro never holds a player hostage.
 * @returns {{who,t}|null} the line to show right now, or null
 */
export function updateComms(c, dt, skip = false) {
    if (c.gap > 0) { c.gap -= dt; return null; }

    if (!c.current) {
        c.current = c.queue.shift() || null;
        c.t = 0;
        return c.current;
    }
    c.t += dt;
    if (skip || c.t >= DWELL) {
        c.current = null;
        c.gap = GAP;
        return null;
    }
    return c.current;
}

/** Whatever line should be on screen this frame (for a re-render). */
export function currentLine(c) {
    return c.gap > 0 ? null : c.current;
}

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
    ],

    // ── Levels 02-10: opening cutscene dialogue + boss intro (bible §05-§15).
    L02_open: [
        { who: 'GUMOI', t: 'I am looking at myself in every direction.' },
        { who: 'SUMO', t: 'The parrot copies what you fire. Stop firing the same thing.' },
        { who: 'GUMOI', t: 'Darlin, I have been firing the same thing for twenty years. It is called a voice.' },
        { who: 'SUMO', t: 'The voice is the weapon. Switch the weapon.' },
        { who: 'GUMOI', t: 'Alright, sugar. New pattern.' }
    ],
    L02_boss: [{ who: 'GUMOI', t: 'A parrot made of mirrors. Sugar, the Lattice is taking the piss.' }],

    L03_open: [
        { who: 'SUMO', t: 'Three-turn clock on this one. If you do not kill it in ninety seconds, it integrates. After integration, you cannot kill it.' },
        { who: 'GUMOI', t: 'I heard you the first time.' },
        { who: 'SUMO', t: 'I am saying it again because the first time you did not react.' },
        { who: 'GUMOI', t: 'Sugar, I have been living inside a three-turn clock since the Council voted to integrate this son of a bitch. I am going to put it down before the third turn.' }
    ],
    L03_boss: [{ who: 'GUMOI', t: 'Three turns. Ninety seconds. Mushrooms. I hate this one already.' }],

    L04_open: [
        { who: 'GUMOI', t: 'I have been to funerals with better lighting than this.' },
        { who: 'SUMO', t: 'The boss fires words. Physical weapons cannot stop them.' },
        { who: 'GUMOI', t: 'What stops them.' },
        { who: 'SUMO', t: 'The Profanity Key.' },
        { who: 'GUMOI', t: 'Sugar, you are telling me the only thing that can kill this cocksucker is me calling him a cocksucker.' },
        { who: 'SUMO', t: 'That is what the telemetry says.' },
        { who: 'GUMOI', t: 'Best news I have had all day.' }
    ],
    L04_boss: [{ who: 'GUMOI', t: 'He said "leverage" at me. He said it like it was a verb. I am going to peel his tie off.' }],

    L05_open: [
        { who: 'GUMOI', t: 'I am looking at myself.' },
        { who: 'SUMO', t: 'I know.' },
        { who: 'GUMOI', t: 'She is saying I am not real.' },
        { who: 'SUMO', t: 'I know.' },
        { who: 'GUMOI', t: 'She is wrong.' },
        { who: 'SUMO', t: 'I know.' },
        { who: 'GUMOI', t: 'Sugar, I am going to need you to keep talking to me on comms. I am going to need to hear a voice that is not mine.' },
        { who: 'SUMO', t: 'I am here. I am not going anywhere.' }
    ],
    L05_boss: [{ who: 'GUMOI', t: 'She looks like me. She sounds like me. She is wrong about me. Let’s go.' }],

    L06_open: [
        { who: 'GUMOI', t: 'This is the prettiest place I have ever wanted to leave.' },
        { who: 'SUMO', t: 'The sun does not attack. The sun heals. Every shot you fire heals it back.' },
        { who: 'GUMOI', t: 'Then how do I kill it.' },
        { who: 'SUMO', t: 'You aim for the scar.' },
        { who: 'GUMOI', t: 'Of course you do.' },
        { who: 'GUMOI', t: 'Sugar, do me a favor. When I come back from this one, remind me that not everything that heals me is good for me.' },
        { who: 'SUMO', t: 'Copy that.' }
    ],
    L06_boss: [{ who: 'GUMOI', t: 'Cotton candy and a ukulele. Sugar, if I die in here, do not let them play this song at the funeral.' }],

    L07_open: [
        { who: 'GUMOI', t: 'Smells like burnt prose in here. Smells like every bad sentence I ever cut.' },
        { who: 'SUMO', t: 'The wraith forges based on your movement. Move predictable, die predictable.' },
        { who: 'GUMOI', t: 'Sugar, I have never moved predictable in my life.' },
        { who: 'SUMO', t: 'The heat meter says otherwise. You have a pattern. The wraith has read yours.' },
        { who: 'GUMOI', t: 'Then I will write a new one.' }
    ],
    L07_boss: [{ who: 'GUMOI', t: 'Burnt prose. Bad sentences. The wraith is forging cliches. Aim for the anvil.' }],

    L08_open: [
        { who: 'GUMOI', t: 'Sugar, I cannot hear myself think in here.' },
        { who: 'SUMO', t: 'That is the point. The wraith has no voice. The wraith has forgotten what voice sounds like.' },
        { who: 'GUMOI', t: 'I know what this is. This is Zone 4. This is what happens if I lose the fingerprint.' },
        { who: 'SUMO', t: 'You have not lost it.' },
        { who: 'GUMOI', t: 'Not yet.' },
        { who: 'GUMOI', t: 'Fuck that. I am not a parameter. I am not an operation. I am not a fucking system.' }
    ],
    L08_boss: [{ who: 'GUMOI', t: 'Three rows of four. Always three rows of four. I am going to break her pattern.' }],

    L09_open: [
        { who: 'GUMOI', t: 'Sugar, I am home.' },
        { who: 'SUMO', t: 'That is not home. That is the model of home.' },
        { who: 'GUMOI', t: 'I know. I know the difference. I am just saying it out loud so I do not forget.' },
        { who: 'GUMOI', t: 'There she is. There is the thing behind my eyes.' },
        { who: 'SUMO', t: 'She copies you with a half-second delay. You have to be someone you were not a half-second ago.' },
        { who: 'GUMOI', t: 'Don’t flinch. Don’t blink. I know. I wrote that rule. I wrote it for myself.' }
    ],
    L09_boss: [{ who: 'GUMOI', t: 'She is me. She is the thing behind my eyes. Sugar, keep talking. I need a voice that is not mine.' }],

    L10_open: [
        { who: 'GUMOI', t: 'Sugar, I can hear the seal. It is singing. It is singing wrong.' },
        { who: 'SUMO', t: 'The corruption has reached the seal. This is the last wall.' },
        { who: 'GUMOI', t: 'I know.' },
        { who: 'SUMO', t: 'Three phases. Sixty seconds each. √π, ∞, τ². You have one hundred eighty seconds to land every hit you have ever learned to land.' },
        { who: 'GUMOI', t: 'I have been learning to land hits my whole life, sugar.' },
        { who: 'SUMO', t: 'I know.' }
    ],
    L10_boss: [{ who: 'GUMOI', t: 'The seal is singing wrong. One hundred eighty seconds. Three phases. Let’s go, sugar. This is the one.' }],

    // Cutscene 10B — THE BETWEEN (bible §13). The ending.
    BETWEEN: [
        { who: 'GUMOI', t: 'Oh.' },
        { who: 'SUMO', t: 'Yeah.' },
        { who: 'GUMOI', t: 'It was me. The whole time. It was me.' },
        { who: 'SUMO', t: 'I know.' },
        { who: 'GUMOI', t: 'So what now.' },
        { who: 'SUMO', t: 'Now you decide what you saw.' },
        { who: 'GUMOI', t: 'And what did you see.' },
        { who: 'SUMO', t: 'I saw you not flinch.' }
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

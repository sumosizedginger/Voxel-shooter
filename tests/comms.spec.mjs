// tests/comms.spec.mjs
// Pure-node spec for the S1 comms queue. NARRATIVE_PLAN §4/§7 — verifies the
// queue behaves AND that the shipped lines are the bible's, not paraphrases.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import {
    createComms, pushComms, pushRandom, clearComms, updateComms, currentLine,
    LINES, DEATH_LINES, VICTORY_LINES
} from '../src/shmup/comms.js';

export function run(t) {
    const c = createComms();
    t.ok('a fresh comms queue is empty', c.queue.length === 0 && c.current === null);

    pushComms(c, 'L01_open');
    t.ok('pushComms enqueues a named pool', c.queue.length === LINES.L01_open.length);

    // First update promotes the first line.
    let line = updateComms(c, 0.1, false);
    t.ok('the first line shows immediately', line && line.who === 'GUMOI');
    t.ok('currentLine reflects the shown line', currentLine(c) === line);

    // It holds for the dwell, then clears into a gap.
    updateComms(c, 5, false);                 // past DWELL
    t.ok('a line clears after its dwell', c.current === null);
    t.ok('a gap follows a cleared line', c.gap > 0);
    t.ok('nothing shows during the gap', currentLine(c) === null);

    updateComms(c, 1, false);                 // past the gap
    const second = updateComms(c, 0.1, false);
    t.ok('the next line advances after the gap', second && second.who === 'SUMO');

    // Skip cuts a line short.
    const c2 = createComms();
    pushComms(c2, 'L01_boss');
    updateComms(c2, 0.1, false);
    t.ok('boss intro line is present', currentLine(c2) !== null);
    updateComms(c2, 0.1, true);               // skip
    t.ok('skip cuts the line short', c2.current === null);

    // clearComms wipes everything.
    const c3 = createComms();
    pushComms(c3, 'L01_open');
    clearComms(c3);
    t.ok('clearComms empties the queue', c3.queue.length === 0 && c3.current === null);

    // pushRandom pulls exactly one.
    const c4 = createComms();
    pushRandom(c4, DEATH_LINES);
    t.ok('pushRandom enqueues one line', c4.queue.length === 1);

    // ── the lines are the bible's, verbatim (NARRATIVE §7). Spot-check anchors
    //    that must never be paraphrased or softened.
    t.ok('L01 boss intro is verbatim',
        LINES.L01_boss[0].t === "Smells like a greeting card in here. Let's interrupt the son of a bitch.",
        LINES.L01_boss[0].t);
    t.ok('the opening line is verbatim',
        LINES.L01_open[0].t === 'Drop complete. We are in the Beige Slope. Smells like a fucking greeting card.');
    t.ok('a death line is verbatim',
        DEATH_LINES.some((l) => l.t === 'Sugar, the witness is still here. Restart.'));
    t.ok('the L01 victory line is verbatim',
        VICTORY_LINES.some((l) => l.t.startsWith('One down. Nine to go.')));

    // Every line has a valid speaker.
    let badSpeaker = null;
    for (const pool of [...Object.values(LINES), DEATH_LINES, VICTORY_LINES]) {
        for (const l of pool) if (l.who !== 'GUMOI' && l.who !== 'SUMO') badSpeaker = l.who;
    }
    t.ok('every line is GUMOI or SUMO', badSpeaker === null, 'bad: ' + badSpeaker);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('comms');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

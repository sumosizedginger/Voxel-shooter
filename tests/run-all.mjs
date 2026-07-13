// tests/run-all.mjs
// Runs every spec and prints one combined summary. This is `npm test`.
// Pass --unit-only (or `npm run test:unit`) to skip the browser smoke spec —
// the pure-node specs run in well under 5s with no Chrome dependency.

import { createSink, summarize } from './harness.mjs';
import { run as runCollision } from './collision.spec.mjs';
import { run as runHitbox } from './hitbox.spec.mjs';
import { run as runSettings } from './settings.spec.mjs';

const unitOnly = process.argv.includes('--unit-only');

async function main() {
    const sinks = [];

    const collision = createSink('collision');
    runCollision(collision);
    sinks.push(collision);

    const hitbox = createSink('hitbox');
    runHitbox(hitbox);
    sinks.push(hitbox);

    const settings = createSink('settings');
    await runSettings(settings);
    sinks.push(settings);

    if (!unitOnly) {
        const { run: runSmoke } = await import('./smoke.spec.mjs');
        const smoke = createSink('smoke');
        await runSmoke(smoke);
        sinks.push(smoke);
    }

    process.exit(summarize(sinks) ? 1 : 0);
}

main().catch((e) => {
    console.error('Test run crashed:', e);
    process.exit(2);
});

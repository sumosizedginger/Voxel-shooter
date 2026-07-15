// tests/arsenal.spec.mjs
// Pure-node spec for the Siren Pulse gauge and the Hammer's range logic.
// wavecannon.js and hammer.js are import-clean, so the gauge math and the
// close/long decision are testable without a browser. Phase 4.

import path from 'path';
import { fileURLToPath } from 'url';
import { createSink, summarize } from './harness.mjs';
import {
    createCharge, updateCharge, releaseCharge, chargeTier, canFireTier3,
    tierProgress, TIER_TIME, TAP_MAX, TIER3_LOCK_S, TIER3_REQUIRES_WITNESS, MAX_TIER
} from '../src/shmup/wavecannon.js';
import {
    createHammer, hammerMode, nearestEnemyDist, applySlug, decayStacks,
    CLOSE_RANGE, STAGGER_SLUGS
} from '../src/shmup/hammer.js';

export function run(t) {
    // ── Siren Pulse charge tiers
    t.ok('a fresh charge is at tier 0', chargeTier(0) === 0);
    t.ok('one tier-time of hold reaches tier 1', chargeTier(TIER_TIME) === 1);
    t.ok('two tier-times reach tier 2', chargeTier(TIER_TIME * 2, 3) === 2);
    t.ok('three tier-times reach tier 3 WITH a level-2 Witness',
        chargeTier(TIER_TIME * 3, 2) === 3);

    // The gate (bible §03): tier 3 needs the Witness at level >= 2.
    t.ok('tier 3 is capped to 2 below Witness level 2',
        chargeTier(TIER_TIME * 5, 1) === 2,
        'held forever with a lv1 Witness => ' + chargeTier(TIER_TIME * 5, 1));
    t.ok('tier 3 unlocks at Witness level 2',
        chargeTier(TIER_TIME * 3, TIER3_REQUIRES_WITNESS) === 3);
    t.ok('canFireTier3 tracks the Witness gate',
        !canFireTier3(1) && canFireTier3(2) && canFireTier3(3));
    t.ok('a charge never exceeds MAX_TIER', chargeTier(TIER_TIME * 99, 3) === MAX_TIER);

    // ── tap vs hold on release
    const c1 = createCharge();
    updateCharge(c1, 0.1, true, 0);
    let r = releaseCharge(c1, 0);
    t.ok('a quick press is a tap (the basic bolt)', r.type === 'tap' && r.tier === 0);

    const c2 = createCharge();
    updateCharge(c2, TIER_TIME + 0.05, true, 3);
    r = releaseCharge(c2, 3);
    t.ok('a full tier-1 hold is a pulse', r.type === 'pulse' && r.tier === 1);
    t.ok('releasing resets the gauge', c2.held === 0 && c2.tier === 0);

    // Held past a tap but short of tier 1 => still a bolt, input not eaten.
    const c3 = createCharge();
    updateCharge(c3, TAP_MAX + 0.05, true, 3);
    r = releaseCharge(c3, 3);
    t.ok('a partial charge below tier 1 falls back to a bolt', r.type === 'tap');

    // Tier 3 locks the Vessel for 1.4 s (bible §03).
    const c4 = createCharge();
    updateCharge(c4, TIER_TIME * 3 + 0.05, true, 2);
    r = releaseCharge(c4, 2);
    t.ok('a tier-3 release reports its lock', r.tier === 3 && r.lock === TIER3_LOCK_S);

    const c5 = createCharge();
    updateCharge(c5, TIER_TIME * 2 + 0.05, true, 3);
    r = releaseCharge(c5, 3);
    t.ok('tiers 1-2 do not lock the Vessel', r.lock === 0);

    // The "a tier just clicked over" cue fires exactly once per tier.
    const c6 = createCharge();
    let ups = 0;
    for (let i = 0; i < 40; i++) {
        const res = updateCharge(c6, 0.1, true, 3);
        if (res.tierUp) ups++;
    }
    t.ok('the tier-up cue fires once per tier reached', ups === MAX_TIER, 'ups=' + ups);

    // Segment progress is 0..1 within the current tier.
    const c7 = createCharge();
    updateCharge(c7, TIER_TIME * 0.5, true, 3);
    const prog = tierProgress(c7, 3);
    t.ok('tierProgress reports mid-tier fill', prog > 0.4 && prog < 0.6, 'prog=' + prog.toFixed(2));

    // ── Hammer range decision
    const enemies = [{ alive: true, x: 3, y: 0 }, { alive: false, x: 1, y: 0 }];
    t.ok('nearestEnemyDist ignores dead enemies',
        Math.abs(nearestEnemyDist(0, 0, enemies) - 3) < 1e-9);
    t.ok('nearestEnemyDist is Infinity on an empty field',
        nearestEnemyDist(0, 0, [{ alive: false }]) === Infinity);

    t.ok('close enemy => spread', hammerMode(0, 0, [{ alive: true, x: 2, y: 0 }]) === 'spread');
    t.ok('far enemy => slug',
        hammerMode(0, 0, [{ alive: true, x: CLOSE_RANGE + 3, y: 0 }]) === 'slug');
    t.ok('an empty field => slug (nothing is close)', hammerMode(0, 0, []) === 'slug');

    // ── slug stagger: three slugs stagger a boss
    const boss = {};
    t.ok('one slug does not stagger', applySlug(boss) === false && boss.slugStacks === 1);
    applySlug(boss);
    const staggered = applySlug(boss);
    t.ok('the third slug staggers', staggered === true && boss.staggered > 0);
    t.ok('staggering consumes the stack', boss.slugStacks === 0);

    // stacks decay, so you must land three with intent, not over a whole fight
    const boss2 = {};
    applySlug(boss2);
    boss2.slugStackT = 0.1;
    decayStacks(boss2, 0.2);
    t.ok('slug stacks decay to zero over time', boss2.slugStacks === 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('arsenal');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

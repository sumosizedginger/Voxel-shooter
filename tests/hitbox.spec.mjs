// tests/hitbox.spec.mjs
// Pure-node unit spec for src/combat/hitbox.js + src/combat/facing.js — no browser needed.

import path from 'path';
import { fileURLToPath } from 'url';
import { hitboxCheck } from '../src/combat/hitbox.js';
import { makeFacing } from '../src/combat/facing.js';
import { createSink, summarize } from './harness.mjs';

function actor(x, y, z, state) {
    return { root: { position: { x, y, z } }, state };
}

const MOVE = { range: 1.6, depthTolerance: 0.9, vertical: 1.2 };

/** The pre-vectorization X-signed cone, reimplemented for the equivalence check. */
function classicHit(ox, oz, dy, facing, move, r) {
    if (Math.abs(oz) > move.depthTolerance + r) return false;
    const forward = facing > 0 ? ox : -ox;
    if (move.omni) {
        if (Math.abs(forward) > move.range + r) return false;
    } else {
        if (forward < -Math.min(r, 0.6)) return false;
        if (forward > move.range + r) return false;
    }
    if (Math.abs(dy) > move.vertical + r) return false;
    return true;
}

export function run(t) {
    // In-range hit lands.
    {
        const a = actor(0, 0, 0, makeFacing(1));
        const d = actor(1, 0, 0, { current: 'IDLE' });
        t.ok('in-range hit lands', hitboxCheck(a, d, MOVE) === true);
    }

    // Out-of-range misses.
    {
        const a = actor(0, 0, 0, makeFacing(1));
        const d = actor(5, 0, 0, { current: 'IDLE' });
        t.ok('out-of-range misses', hitboxCheck(a, d, MOVE) === false);
    }

    // Behind-attacker misses.
    {
        const a = actor(0, 0, 0, makeFacing(1));
        const d = actor(-1, 0, 0, { current: 'IDLE' });
        t.ok('behind-attacker misses', hitboxCheck(a, d, MOVE) === false);
    }

    // depthTolerance lane rejection.
    {
        const a = actor(0, 0, 0, makeFacing(1));
        const d = actor(0.5, 0, 5, { current: 'IDLE' });
        t.ok('depthTolerance rejects wide lane', hitboxCheck(a, d, MOVE) === false);
    }

    // vertical rejection.
    {
        const a = actor(0, 0, 0, makeFacing(1));
        const d = actor(1, 5, 0, { current: 'IDLE' });
        t.ok('vertical tolerance rejects', hitboxCheck(a, d, MOVE) === false);
    }

    // omni: true hits behind.
    {
        const a = actor(0, 0, 0, makeFacing(1));
        const d = actor(-1, 0, 0, { current: 'IDLE' });
        t.ok('omni hits behind', hitboxCheck(a, d, { ...MOVE, omni: true }) === true);
    }

    // defender.hitRadius widens the window.
    {
        const a = actor(0, 0, 0, makeFacing(1));
        const near = actor(1.8, 0, 0, { current: 'IDLE' });
        t.ok('no hitRadius: just past range misses', hitboxCheck(a, near, MOVE) === false);
        const wide = actor(1.8, 0, 0, { current: 'IDLE', hitRadius: undefined });
        wide.hitRadius = 0.5;
        t.ok('hitRadius widens window to hit', hitboxCheck(a, wide, MOVE) === true);
    }

    // defender DEAD short-circuits.
    {
        const a = actor(0, 0, 0, makeFacing(1));
        const d = actor(1, 0, 0, { current: 'DEAD' });
        t.ok('dead defender never hits', hitboxCheck(a, d, MOVE) === false);
    }

    // Equivalence: facingVec = (±1, 0) must exactly match the classic X-signed cone
    // across a grid of positions and radii — this is the kit's core selling claim.
    {
        let mismatches = 0;
        const offsets = [-3, -2, -1.6, -1, -0.5, -0.1, 0, 0.1, 0.5, 0.9, 1, 1.6, 2, 3];
        const radii = [0, 0.4, 1.2];
        for (const facing of [1, -1]) {
            for (const ox of offsets) {
                for (const oz of offsets) {
                    for (const dy of [0, 0.5, 1.3]) {
                        for (const r of radii) {
                            const a = actor(0, 0, 0, makeFacing(facing));
                            const d = actor(ox, dy, oz, { current: 'IDLE' });
                            d.hitRadius = r;
                            const vectorized = hitboxCheck(a, d, MOVE);
                            const classic = classicHit(ox, oz, dy, facing, MOVE, r);
                            if (vectorized !== classic) {
                                mismatches++;
                                if (mismatches <= 3) {
                                    console.log('  mismatch facing=' + facing + ' ox=' + ox
                                        + ' oz=' + oz + ' dy=' + dy + ' r=' + r
                                        + ' vectorized=' + vectorized + ' classic=' + classic);
                                }
                            }
                        }
                    }
                }
            }
        }
        t.ok('vectorized hitbox === classic X-signed cone on axis-aligned facing',
            mismatches === 0, mismatches + ' mismatches out of grid sweep');
    }

    // setFacing8 snaps to the 8 compass directions and normalizes.
    {
        const s = makeFacing(1);
        s.setFacing8(3, 4);
        const len = Math.hypot(s.facingVec.x, s.facingVec.z);
        t.ok('setFacing8 normalizes to unit length', Math.abs(len - 1) < 1e-9, 'len=' + len);
        t.ok('setFacing8 snaps signs', s.facingVec.x > 0 && s.facingVec.z > 0,
            JSON.stringify(s.facingVec));

        s.setFacing8(0, 0);
        t.ok('setFacing8 ignores zero input (keeps last facing)',
            s.facingVec.x > 0 && s.facingVec.z > 0, JSON.stringify(s.facingVec));

        s.setFacing8(-5, 0.2);
        t.ok('setFacing8 snaps negative X / positive Z',
            s.facingVec.x < 0 && s.facingVec.z > 0, JSON.stringify(s.facingVec));
    }

    // Scalar .facing setter keeps facingVec in sync (legacy belt-scroller path).
    {
        const s = makeFacing(1);
        s.setFacing(0.3, 0.9); // aim off-axis first
        s.facing = -1;
        t.ok('.facing setter resets facingVec to pure X',
            s.facingVec.x === -1 && s.facingVec.z === 0, JSON.stringify(s.facingVec));
        t.ok('.facing getter reflects sign', s.facing === -1);
    }
}

// Directly runnable: `node tests/hitbox.spec.mjs`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('hitbox');
    run(t);
    process.exit(summarize([t]) ? 1 : 0);
}

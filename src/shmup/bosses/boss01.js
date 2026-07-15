// src/shmup/bosses/boss01.js
// Purpose: Boss 01 — the Beige Slope. An advancing wall of announcing mouths.
// Dependencies: three, ../assets/boss01, ../bullets, ../fx, ../sfx, ../player,
//               ../enemies (registers mouths as world.enemies parts)
//
// Bible §04 is the spec, verbatim in intent:
//   "The boss is a wall. It has a thousand mouths. Each mouth announces an
//    emotion. Each completed announcement spawns a slow-tracking bullet that
//    deals chip damage and slows the Vessel by 15% for 2 seconds. Stack four
//    slows and the Vessel cannot move."
//   Ph1: advances at 8 u/min-ish; interrupt announcements or get slow-stacked;
//        the wall takes damage anywhere, triple on the violet mouth that just
//        lied. Ph2 @60%: stops, pulses (pushes the Vessel back), announcements
//        faster, weakpoint windows longer. Ph3 @25%: splits into three walls;
//        three simultaneous completions heal it 5% unless one is interrupted.
//
// Structure (PLAN.md Phase 6 / ASSETS_PLAN §3): a phase state machine with
// {enter, update, hpGate}, and destructible/targetable PARTS — each mouth is an
// entity in world.enemies, so it reuses the existing player-bullet collision.
// A mouth never dies; it funnels damage to the shared boss HP (1x, or 3x while
// it's a lit weakpoint). game.js routes bullet hits on `isBossPart` here.
//
// Until the S2 cast/interrupt system lands (Phase 9A), the "announcement" is a
// plain timed telegraph with the same timings — the mechanic is real now; the
// verbatim emotion text gets wired in 9A.

import * as THREE from 'three';
import { buildVoxelGeo } from '../../voxel/core.js';
import { buildWallBodyMap, buildMouthMap, WALL_SCALE } from '../assets/boss01.js';
import { difficultyMultipliers } from '../../engine/settings.js';
import { KIND, spawn } from '../bullets.js';
import { explode, shatter, ring } from '../fx.js';
import { sfx } from '../sfx.js';
import { addSlowStack } from '../player.js';
import { VIOLET, BEIGE_PALETTE } from '../palette.js';
import { PLAY_MIN_Y, PLAY_MAX_Y, PLAY_Y } from '../camera.js';

const BASE_HP = 1400;
const MOUTH_ROWS = 5;
const ANNOUNCE_TIME = 2.4;         // ph1 telegraph length
const WEAKPOINT_TIME = 1.2;        // bible §04 (ph2 extends it)
const SLOW_BULLET_SPEED = 6;       // "slow-tracking" — well under the 14 cap
const WALL_ADVANCE = 0.5;          // world u/s in phase 1 (a slow, dreadful creep)
const PUSHBACK = 2.2;              // ph2 pulse pushes the Vessel back, u/s at peak

/** A phase = named handlers. hpGate is the fraction at which we leave it. */
function phases(boss) {
    return {
        one: {
            name: 'ADVANCE',
            enter() { boss.advance = WALL_ADVANCE; boss.announceEvery = 2.8; },
            update(dt, world) {
                boss.frontX += boss.advance * dt;      // the creep
                driveMouths(boss, dt, world, 1);
            },
            gate: 0.6
        },
        two: {
            name: 'PULSE',
            enter() {
                boss.advance = 0;
                boss.announceEvery = 1.9;              // faster
                boss.weakpointTime = WEAKPOINT_TIME * 1.6;   // longer window
                sfx.cast();
                ring(boss.frontX - 2, PLAY_Y, 3.5, VIOLET);
            },
            update(dt, world) {
                // Pulse: a breathing push that shoves the Vessel back (bible §04).
                boss.pulse += dt;
                const shove = Math.max(0, Math.sin(boss.pulse * 1.6)) * PUSHBACK;
                if (world.player && world.player.alive) world.player.x -= shove * dt;
                driveMouths(boss, dt, world, 1);
            },
            gate: 0.25
        },
        three: {
            name: 'SPLIT',
            enter() {
                boss.split = true;
                boss.announceEvery = 1.6;
                // Three walls from three sides: re-home the mouth columns to top,
                // middle, and bottom so completions can coordinate into triplets.
                assignTriplets(boss);
                sfx.cast();
                ring(boss.frontX - 2, PLAY_Y, 5, VIOLET);
            },
            update(dt, world) {
                driveMouths(boss, dt, world, 1);
                resolveTriplets(boss, world);          // 3 completions => heal, unless interrupted
            },
            gate: 0            // last phase — ends on death, not on a gate
        }
    };
}

export function createBoss01(scene, world) {
    const diff = difficultyMultipliers();
    const group = new THREE.Group();
    scene.add(group);

    // ── the wall body: a tall slab at the right edge of the locked arena.
    const bodyGeo = buildVoxelGeo(buildWallBodyMap(60, 10, BEIGE_PALETTE));
    bodyGeo.center();
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.setScalar(WALL_SCALE);
    group.add(body);

    // The wall fills the back third of the arena (bible §04): its front sits
    // ~12u ahead of the locked camera, near the right edge, and creeps left.
    const frontX = world.scrollX + 12;

    const boss = {
        kind: 'boss01',
        hp: Math.round(BASE_HP * diff.enemyHp),
        maxHp: Math.round(BASE_HP * diff.enemyHp),
        frontX,
        baseX: frontX,
        advance: 0,
        pulse: 0,
        split: false,
        announceEvery: 2.8,
        weakpointTime: WEAKPOINT_TIME,
        dead: false,
        dying: 0,
        group, body, bodyMat,
        mouths: [],
        _phaseKey: 'one',
        _t: 0,
        world
    };
    boss.phases = phases(boss);

    // ── the mouths: one column of parts on the wall face, registered as enemies
    //    so the ordinary player-bullet collision hits them. They never die; each
    //    funnels damage to boss.hp (game.js routes isBossPart hits to hitMouth).
    const mouthGeo = buildVoxelGeo(buildMouthMap(BEIGE_PALETTE));
    mouthGeo.center();
    const mouthMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    for (let i = 0; i < MOUTH_ROWS; i++) {
        const y = PLAY_MIN_Y + 2 + (i / (MOUTH_ROWS - 1)) * (PLAY_MAX_Y - PLAY_MIN_Y - 4);
        const mesh = new THREE.Mesh(mouthGeo, mouthMat);
        mesh.scale.setScalar(WALL_SCALE);
        group.add(mesh);

        // The violet weakpoint glow — the mouth that just lied. Dark until lit.
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0x0a0510, emissive: VIOLET, emissiveIntensity: 0 })
        );
        mesh.add(glow);

        const mouth = {
            // enemy-shaped (x,y,r,alive) so the collision pass treats it like any
            // other target — but kept in boss.mouths, NOT the enemy pool, so a
            // checkpoint rewind's clearEnemies() can't corrupt the pool live-count.
            alive: true, isBossPart: true, boss,
            x: 0, y, r: 0.7,
            state: 'idle',             // idle | announcing | lit
            timer: rand(i) * boss.announceEvery,
            row: i, side: 0,
            mesh, glow: glow.material,
            weakpointT: 0,
            _completedThisFrame: false
        };
        boss.mouths.push(mouth);
    }

    boss.phases.one.enter();
    world.boss = boss;
    return boss;
}

let _seed = 1;
function rand(i) {
    // Deterministic per-mouth phase offset so the fight is the same each attempt.
    const s = Math.sin((i + 1) * 12.9898 + _seed) * 43758.5453;
    return s - Math.floor(s);
}

/** Drive every mouth's announce -> complete/interrupt cycle. */
function driveMouths(boss, dt, world, rate) {
    const front = boss.frontX;
    for (const mouth of boss.mouths) {
        // Follow the wall front, sitting a little proud of it toward the player.
        mouth.x = front - 1.6 + mouth.side * 0.0;
        if (mouth.mesh) mouth.mesh.position.set(front - 1.6, mouth.y, 0);

        if (mouth.weakpointT > 0) {
            mouth.weakpointT -= dt;
            mouth.glow.emissiveIntensity = 2.6 + Math.sin(boss._t * 12) * 0.6;
            if (mouth.weakpointT <= 0) { mouth.state = 'idle'; mouth.timer = boss.announceEvery; }
            continue;
        }
        mouth.glow.emissiveIntensity = mouth.state === 'announcing'
            ? 0.4 + Math.sin(boss._t * 8) * 0.3          // a warning flicker
            : 0;

        mouth.timer -= dt * rate;
        if (mouth.state === 'idle' && mouth.timer <= 0) {
            mouth.state = 'announcing';
            mouth.timer = ANNOUNCE_TIME;
            mouth.announceGlow = 0;
            sfx.cast();
        } else if (mouth.state === 'announcing' && mouth.timer <= 0) {
            // The lie completed. Fire the slow-tracking bullet, reset the mouth.
            completeAnnouncement(mouth, world);
            mouth.state = 'idle';
            mouth.timer = boss.announceEvery + rand(mouth.row) * 0.8;
        }
    }
}

function completeAnnouncement(mouth, world) {
    mouth._completedThisFrame = true;
    const p = world.player;
    if (!p) return;
    const a = Math.atan2(p.y - mouth.y, (p.x) - mouth.x);
    spawn(world.enemyBullets, {
        x: mouth.x - 0.5, y: mouth.y,
        vx: Math.cos(a) * SLOW_BULLET_SPEED, vy: Math.sin(a) * SLOW_BULLET_SPEED,
        r: 0.24, dmg: 5, kind: KIND.ENEMY_HEAVY,
        homing: 0.8,                         // "slow-tracking"
        target: p,
        life: 5,
        isSlowShot: true,                    // game.js: a hit stacks a slow
        bossShot: true                       // the Witness can intercept one
    });
    sfx.enemyShoot();
}

/**
 * A player bullet hit a mouth. game.js routes here for isBossPart targets.
 * If the mouth was mid-announcement, the hit INTERRUPTS it — the mouth staggers
 * open as a violet weakpoint (3x) instead of firing. Otherwise it's plain damage
 * to the wall (bible: "takes damage anywhere").
 */
export function hitMouth(mouth, dmg, world) {
    const boss = mouth.boss;
    if (boss.dead) return;

    let applied = dmg;
    if (mouth.state === 'announcing') {
        // Interrupt: the lie is cut off. Open the weakpoint (bible §04 lesson —
        // "the interruption is the defense").
        mouth.state = 'lit';
        mouth.weakpointT = boss.weakpointTime;
        sfx.interrupt();
        ring(mouth.x, mouth.y, 0.9, VIOLET);
    }
    if (mouth.weakpointT > 0) applied = dmg * 3;   // the mouth that just lied: 3x

    boss.hp -= applied;
    sfx.hit();
    if (boss.hp <= 0) beginDeath(boss, world);
}

// ── phase 3: triplet coordination ───────────────────────────────────────────
function assignTriplets(boss) {
    // Group the five mouths into overlapping "triplets" whose simultaneous
    // completion heals the wall. With 5 mouths we use rows [0,1,2] and [2,3,4].
    boss.triplets = [[0, 1, 2], [2, 3, 4]];
}

function resolveTriplets(boss, world) {
    if (!boss.triplets) return;
    for (const tri of boss.triplets) {
        const all = tri.every((r) => boss.mouths[r]._completedThisFrame);
        if (all) {
            // Unless the player interrupted at least one, the wall heals 5%.
            boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.05);
            ring(boss.frontX - 2, PLAY_Y, 3, 0x40ff80);
            sfx.absorb();
        }
    }
    for (const mouth of boss.mouths) mouth._completedThisFrame = false;
}

// ── death ────────────────────────────────────────────────────────────────────
function beginDeath(boss, world) {
    if (boss.dead) return;
    boss.dead = true;
    boss.dying = 2.5;                    // chained explosions over ~2.5s
    boss.hp = 0;
    // Mouths stop being targets.
    for (const mouth of boss.mouths) mouth.alive = false;
    world.score += 8000;                 // big (Phase 7 tallies the level bonus too)
    if (world.onBossDown) world.onBossDown();
}

/** Tick the boss. Returns true while it still owns the scroll-lock. */
export function updateBoss01(boss, dt, world) {
    boss._t += dt;

    if (boss.dead) {
        boss.dying -= dt;
        // Walk explosions up the wall face.
        if (Math.random() < 0.5) {
            const y = PLAY_MIN_Y + Math.random() * (PLAY_MAX_Y - PLAY_MIN_Y);
            explode(boss.frontX - Math.random() * 3, y, 1.2, 0xffcaa0);
        }
        boss.group.position.x = (Math.random() - 0.5) * 0.15;   // shudder
        if (boss.dying <= 0) finishDeath(boss, world);
        return !boss.dead || boss.dying > 0;
    }

    // Phase gate: fall through to the next phase when HP crosses it.
    const ph = boss.phases[boss._phaseKey];
    ph.update(dt, world);
    const frac = boss.hp / boss.maxHp;
    if (ph.gate && frac <= ph.gate) {
        boss._phaseKey = boss._phaseKey === 'one' ? 'two' : 'three';
        boss.phases[boss._phaseKey].enter();
    }

    // The body pulses "like a slow lung" and rides its front position.
    boss.body.position.set(boss.frontX + 1.5, PLAY_Y, 0);
    const lung = 1 + Math.sin(boss._t * 1.4) * 0.03;
    boss.body.scale.set(WALL_SCALE, WALL_SCALE * lung, WALL_SCALE);

    // The wall front is a lethal contact plane: crossing it is death (and being
    // pinned by slow-stacks until it reaches you IS the failure state, bible §04).
    const p = world.player;
    if (p && p.alive && p.invuln <= 0 && p.x >= boss.frontX - 1.4) {
        if (world.killPlayerByWall) world.killPlayerByWall();
    }
    return true;
}

function finishDeath(boss, world) {
    explode(boss.frontX, PLAY_Y, 3.0, 0xffe0b0);
    ring(boss.frontX, PLAY_Y, 8, 0xffcaa0);
    sfx.bigBoom();
    boss.group.visible = false;
    if (world.onBossCleared) world.onBossCleared();
    world.boss = null;
}

/** A slow-shot hit the Vessel: stack a slow (game.js calls this). */
export function applySlowShot(world) {
    if (world.player) addSlowStack(world.player, 2.0);
}

/** Tear the boss down (checkpoint rewind into the boss, or level restart). */
export function disposeBoss01(boss, scene) {
    if (!boss) return;
    for (const mouth of boss.mouths) mouth.alive = false;
    scene.remove(boss.group);
}

// src/shmup/bosses/generic.js
// Purpose: a config-driven boss for levels 2-10. Boss 01 (the wall) stays its
// own bespoke module; this one captures the shared shape — a core with violet
// weakpoints, phases gated by HP or by time, a fire pattern per phase, and a
// staged death — so each remaining boss is authored as DATA plus, at most, its
// one signature mechanic.
// Dependencies: three, voxel/*, ../bullets, ../fx, ../sfx, ../palette, ../camera
//
// Bible §05-§13. Each boss's phase text below names the bible mechanic it
// realizes; where a fully-bespoke system (τ² state-snapshot time loop, √π
// gravity inversion) would be prohibitive, the engine approximates the felt
// experience and the deviation is logged in PLAN.md §6.

import * as THREE from 'three';
import { buildVoxelGeo } from '../../voxel/core.js';
import { fillEllipsoid, fillBox, paint } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';
import { difficultyMultipliers } from '../../engine/settings.js';
import { KIND, spawn } from '../bullets.js';
import { explode, ring, shatter } from '../fx.js';
import { sfx } from '../sfx.js';
import { VIOLET } from '../palette.js';
import { PLAY_MIN_Y, PLAY_MAX_Y, PLAY_Y } from '../camera.js';

// A generic boss body: layered ellipsoids in the boss's theme colors, with a
// violet core socket. Deterministic (hash3), so the same boss looks the same.
function buildBodyMap(pal) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 9, 11, 5, pal.body);
    fillEllipsoid(m, 2, 0, 0, 6, 8, 4, pal.bodyDark);
    fillBox(m, -9, 2, -2, 2, -4, 4, pal.shell);
    paint(m, (x, y, z, c) => (hash3(x, y, z) > 0.85 ? pal.shell : (hash3(z, x, y) < 0.1 ? pal.bodyDark : null)));
    return m;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} world
 * @param {object} cfg  the boss config (see campaign bossConfig entries)
 */
export function createGenericBoss(scene, world, cfg) {
    const diff = difficultyMultipliers();
    const group = new THREE.Group();
    scene.add(group);

    const pal = cfg.palette;
    const bodyGeo = buildVoxelGeo(buildBodyMap(pal));
    bodyGeo.center();
    const body = new THREE.Mesh(bodyGeo,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.15 }));
    body.scale.setScalar(cfg.scale || 0.22);
    group.add(body);

    const frontX = world.scrollX + (cfg.standoff || 14);

    const boss = {
        kind: cfg.id,
        cfg,
        hp: Math.round(cfg.hp * diff.enemyHp),
        maxHp: Math.round(cfg.hp * diff.enemyHp),
        frontX,
        dead: false, dying: 0,
        _t: 0,
        _phaseIndex: 0,
        _phaseT: 0,
        group, body,
        cores: [],           // the weakpoint targets (funnels to boss.hp)
        mouths: [],          // alias game.js collides against (same list as cores)
        fireT: 0,
        // signature-mechanic scratch space
        mem: [],             // recent player shots (mirror/forge/copy bosses)
        phases: cfg.phases,
        name: cfg.name,
        world
    };

    // Cores: one central violet weakpoint, plus optional satellites per cfg.
    const coreLayout = cfg.cores || [{ dx: -1.2, dy: 0, r: 0.8 }];
    const coreGeo = new THREE.SphereGeometry(0.36, 14, 12);
    for (const c of coreLayout) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x0a0510, emissive: VIOLET, emissiveIntensity: 2.4 });
        const mesh = new THREE.Mesh(coreGeo, mat);
        group.add(mesh);
        const core = {
            alive: true, isBossPart: true, boss,
            x: 0, y: PLAY_Y + (c.dy || 0), r: c.r || 0.8,
            dx: c.dx, dy: c.dy || 0,
            mesh, mat,
            open: cfg.coreAlwaysOpen !== false,   // some bosses hide the core except on cast
            _completedThisFrame: false, weakpointT: 0
        };
        boss.cores.push(core);
        boss.mouths.push(core);
    }

    enterPhase(boss, 0);
    world.boss = boss;
    return boss;
}

function currentPhase(boss) { return boss.phases[boss._phaseIndex]; }

function enterPhase(boss, i) {
    boss._phaseIndex = i;
    boss._phaseT = 0;
    boss.fireT = 0;
    const ph = boss.phases[i];
    if (ph && ph.onEnter) ph.onEnter(boss);
    if (i > 0) { sfx.cast(); ring(boss.frontX - 2, PLAY_Y, 4, VIOLET); }
}

// ── the fire library. Each returns nothing; spawns into world.enemyBullets. ──
const FIRE = {
    aimed(boss, world, p) {
        shootAimed(boss, world, p, 9, 6);
    },
    spread(boss, world, p, ph) {
        const n = ph.count || 5;
        const base = angleTo(boss, p);
        for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * (ph.spread || 0.28);
            emit(boss, world, a, ph.speed || 8, ph.dmg || 6);
        }
    },
    ring(boss, world, p, ph) {
        const n = ph.count || 12;
        for (let i = 0; i < n; i++) emit(boss, world, (i / n) * Math.PI * 2, ph.speed || 7, ph.dmg || 6);
    },
    // An advancing wall of bullets (L4 "leverage", L6 field). Slow, dense.
    wall(boss, world, p, ph) {
        const rows = ph.rows || 6;
        for (let i = 0; i < rows; i++) {
            const y = PLAY_MIN_Y + 1 + (i / (rows - 1)) * (PLAY_MAX_Y - PLAY_MIN_Y - 2);
            spawn(world.enemyBullets, {
                x: boss.frontX - 1, y, vx: -(ph.speed || 4), vy: 0,
                r: 0.22, dmg: ph.dmg || 5, kind: KIND.ENEMY_HEAVY, hitsTerrain: false
            });
        }
    },
    // L4 forbidden-word bullets: tagged with text; only profanity cancels them.
    words(boss, world, p, ph) {
        const word = (ph.words || ['DELVE', 'TAPESTRY', 'REALM', 'ROBUST'])[
            (Math.random() * (ph.words ? ph.words.length : 4)) | 0];
        const a = angleTo(boss, p);
        spawn(world.enemyBullets, {
            x: boss.frontX - 1, y: PLAY_Y + (Math.random() - 0.5) * 6,
            vx: Math.cos(a) * (ph.speed || 6), vy: Math.sin(a) * (ph.speed || 6),
            r: 0.3, dmg: ph.dmg || 4, kind: KIND.WORD, hitsTerrain: false,
            word, onlyProfanity: true, heals: word === 'ROBUST'
        });
    },
    // L8 symmetric paragraph: three rows of four, mirrored. Beautiful and dead.
    symmetric(boss, world, p, ph) {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                const y = PLAY_Y + (r - 1) * 3;
                const x = boss.frontX - 1;
                spawn(world.enemyBullets, {
                    x, y, vx: -(ph.speed || 6), vy: (c - 1.5) * 0.6,
                    r: 0.2, dmg: ph.dmg || 4, kind: KIND.ENEMY_HEAVY, hitsTerrain: false
                });
            }
        }
    },
    // L5/L9 mirror: fire back the player's shots from memory, scaled.
    mirror(boss, world, p, ph) {
        const shot = boss.mem.shift();
        if (!shot) return;
        emit(boss, world, Math.PI + Math.atan2(shot.vy, shot.vx), (ph.speed || 10), ph.dmg || 6, KIND.ENEMY_HEAVY);
    },
    none() {}
};

function angleTo(boss, p) {
    return p ? Math.atan2(p.y - PLAY_Y, p.x - boss.frontX) : Math.PI;
}
function emit(boss, world, a, speed, dmg, kind = KIND.ENEMY_ORB) {
    spawn(world.enemyBullets, {
        x: boss.frontX - 1, y: PLAY_Y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        r: 0.16, dmg, kind, hitsTerrain: false
    });
}
function shootAimed(boss, world, p, speed, dmg) {
    if (!p) return;
    emit(boss, world, angleTo(boss, p), speed, dmg);
}

/** A player bullet hit a boss core. game.js routes isBossPart hits here. */
export function hitCore(core, dmg, world) {
    const boss = core.boss;
    if (boss.dead) return;
    if (!core.open) { sfx.hit(); return; }        // closed core takes nothing
    let applied = dmg;
    if (core.weakpointT > 0) applied *= 3;
    boss.hp -= applied * (currentPhase(boss).dmgMult || 1);
    sfx.hit();
    if (boss.hp <= 0) beginDeath(boss, world);
}

function beginDeath(boss, world) {
    if (boss.dead) return;
    boss.dead = true;
    boss.dying = 2.5;
    boss.hp = 0;
    for (const c of boss.cores) c.alive = false;
    world.score += boss.cfg.score || 8000;
    if (world.onBossDown) world.onBossDown();
}

export function updateGenericBoss(boss, dt, world) {
    boss._t += dt;
    boss._phaseT += dt;

    if (boss.dead) {
        boss.dying -= dt;
        if (Math.random() < 0.5) {
            explode(boss.frontX - Math.random() * 3,
                PLAY_MIN_Y + Math.random() * (PLAY_MAX_Y - PLAY_MIN_Y), 1.2, boss.cfg.palette.spark || 0xffcaa0);
        }
        boss.group.position.x = (Math.random() - 0.5) * 0.15;
        if (boss.dying <= 0) finishDeath(boss, world);
        return;
    }

    // Remember the player's recent shots for mirror/forge bosses (cheap: sample).
    if (boss.cfg.remembersShots && world.player && world.player.alive) {
        for (const b of world.bullets.items) {
            if (b.alive && !b._seenByBoss && b.vx > 0) {
                b._seenByBoss = true;
                boss.mem.push({ vx: b.vx, vy: b.vy });
                if (boss.mem.length > 16) boss.mem.shift();
            }
        }
    }

    const ph = currentPhase(boss);

    // Phase transition: by HP fraction, or by time for the timed bosses (L6/L10).
    if (ph) {
        const frac = boss.hp / boss.maxHp;
        const nextByHp = ph.gate != null && frac <= ph.gate;
        const nextByTime = ph.duration != null && boss._phaseT >= ph.duration;
        if ((nextByHp || nextByTime) && boss._phaseIndex < boss.phases.length - 1) {
            enterPhase(boss, boss._phaseIndex + 1);
        }
    }

    // Fire on the phase cadence.
    boss.fireT -= dt;
    if (boss.fireT <= 0 && ph) {
        boss.fireT = ph.every || 1.6;
        const fn = FIRE[ph.fire || 'aimed'];
        if (fn) fn(boss, world, world.player, ph);
    }

    // Cores: hold station on the body, breathe, and (for cast-gated bosses)
    // open only during the cast window.
    for (const core of boss.cores) {
        core.x = boss.frontX + (core.dx || -1.2);
        core.y = PLAY_Y + (core.dy || 0);
        if (core.mesh) {
            core.mesh.position.set(core.x, core.y, 0);
            core.mesh.visible = core.open;
            core.mat.emissiveIntensity = core.open ? (2.2 + Math.sin(boss._t * 6) * 0.6) : 0.2;
        }
        if (core.weakpointT > 0) core.weakpointT -= dt;
    }

    // Cast-gated cores (L6 redemption scar): open briefly on a cycle.
    if (boss.cfg.coreAlwaysOpen === false) {
        const cyc = boss.cfg.castCycle || 3;
        const open = (boss._t % cyc) < (boss.cfg.castOpen || 0.6);
        for (const c of boss.cores) c.open = open;
    }

    // Body follows its front, breathing.
    boss.body.position.set(boss.frontX, PLAY_Y, 0);
    const breath = 1 + Math.sin(boss._t * 1.5) * 0.03;
    boss.body.scale.set((boss.cfg.scale || 0.22), (boss.cfg.scale || 0.22) * breath, (boss.cfg.scale || 0.22));

    // Contact with the boss body is lethal.
    const p = world.player;
    if (p && p.alive && p.invuln <= 0 && Math.abs(p.x - boss.frontX) < 1.6 && Math.abs(p.y - PLAY_Y) < 2.2) {
        if (world.killPlayerByWall) world.killPlayerByWall();
    }
}

function finishDeath(boss, world) {
    explode(boss.frontX, PLAY_Y, 3.0, boss.cfg.palette.spark || 0xffe0b0);
    ring(boss.frontX, PLAY_Y, 8, boss.cfg.palette.spark || 0xffcaa0);
    sfx.bigBoom();
    boss.group.visible = false;
    if (world.onBossCleared) world.onBossCleared();
    world.boss = null;
}

export function disposeGenericBoss(boss, scene) {
    if (!boss) return;
    for (const c of boss.cores) c.alive = false;
    scene.remove(boss.group);
}

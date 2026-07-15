// src/shmup/bosses/generic.js
// Purpose: config-driven boss for levels 2-10 with full signature hooks
// (mirror/copy, modifiers, word-bullets, predict intercept, temporal fold,
// asymmetry regen, cast-gated cores). Boss 01 stays bespoke in boss01.js.
// Dependencies: three, voxel/*, ../bullets, ../fx, ../sfx, systems/*

import * as THREE from 'three';
import { buildVoxelGeo } from '../../voxel/core.js';
import { fillEllipsoid, fillBox, paint } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';
import { difficultyMultipliers } from '../../engine/settings.js';
import { KIND, spawn } from '../bullets.js';
import { explode, ring } from '../fx.js';
import { sfx } from '../sfx.js';
import { VIOLET } from '../palette.js';
import { PLAY_MIN_Y, PLAY_MAX_Y, PLAY_Y } from '../camera.js';
import { fireMimic } from '../systems/copybuffer.js';
import { interceptAngle } from '../systems/predictor.js';
import { pushMod } from '../systems/modifiers.js';
import { startTemporal, stopTemporal } from '../systems/temporal.js';
import { symmetryRegen } from '../systems/asymmetry.js';

function buildBodyMap(pal) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 9, 11, 5, pal.body);
    fillEllipsoid(m, 2, 0, 0, 6, 8, 4, pal.bodyDark);
    fillBox(m, -9, 2, -2, 2, -4, 4, pal.shell);
    paint(m, (x, y, z, c) => (hash3(x, y, z) > 0.85 ? pal.shell : (hash3(z, x, y) < 0.1 ? pal.bodyDark : null)));
    return m;
}

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
        cores: [],
        mouths: [],
        fireT: 0,
        mem: [],
        phases: cfg.phases,
        name: cfg.name,
        world,
        hardFailAt: cfg.hardFailAt || 0,   // L3 90s integration
        timeoutAt: cfg.timeoutAt || 0,     // L6 180s
        integrated: false
    };

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
            open: cfg.coreAlwaysOpen !== false,
            _completedThisFrame: false, weakpointT: 0
        };
        boss.cores.push(core);
        boss.mouths.push(core);
    }

    enterPhase(boss, 0);
    // Signature: L10 starts the temporal loop in phase τ²; armed here if flagged.
    if (cfg.temporalFromStart && world.temporal) {
        startTemporal(world.temporal, world.player);
    }
    world.boss = boss;
    return boss;
}

function currentPhase(boss) { return boss.phases[boss._phaseIndex]; }

function enterPhase(boss, i) {
    boss._phaseIndex = i;
    boss._phaseT = 0;
    boss.fireT = 0;
    const ph = boss.phases[i];
    if (ph && ph.onEnter) ph.onEnter(boss, boss.world);
    if (i > 0) { sfx.cast(); ring(boss.frontX - 2, PLAY_Y, 4, VIOLET); }

    // S6: Jester phases push arena modifiers.
    if (ph && ph.mod && boss.world.mods) {
        pushMod(boss.world.mods, ph.mod, ph.modDuration || 8, ph.modData || null);
    }
    // S10: enter temporal on named phase.
    if (ph && ph.temporal && boss.world.temporal) {
        startTemporal(boss.world.temporal, boss.world.player);
    }
}

const FIRE = {
    aimed(boss, world, p, ph) {
        const a = (world.predictor && p)
            ? interceptAngle(world.predictor, boss.frontX - 1, PLAY_Y, p, ph.speed || 9)
            : angleTo(boss, p);
        emit(boss, world, a, ph.speed || 9, ph.dmg || 6);
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
        const spin = (boss._t || 0) * (ph.spin || 0.4);
        for (let i = 0; i < n; i++) {
            emit(boss, world, spin + (i / n) * Math.PI * 2, ph.speed || 7, ph.dmg || 6);
        }
    },
    // √π curves: spiral ring with growing radius impulse.
    spiral(boss, world, p, ph) {
        const n = ph.count || 14;
        const spin = boss._t * 1.7;
        for (let i = 0; i < n; i++) {
            const a = spin + (i / n) * Math.PI * 2;
            const spd = (ph.speed || 6) + Math.sin(i + boss._t) * 1.5;
            emit(boss, world, a, spd, ph.dmg || 5);
        }
    },
    wall(boss, world, p, ph) {
        const rows = ph.rows || 6;
        for (let i = 0; i < rows; i++) {
            const y = PLAY_MIN_Y + 1 + (i / Math.max(1, rows - 1)) * (PLAY_MAX_Y - PLAY_MIN_Y - 2);
            spawn(world.enemyBullets, {
                x: boss.frontX - 1, y, vx: -(ph.speed || 4), vy: 0,
                r: 0.22, dmg: ph.dmg || 5, kind: KIND.ENEMY_HEAVY, hitsTerrain: false
            });
        }
    },
    words(boss, world, p, ph) {
        const words = ph.words || ['DELVE', 'TAPESTRY', 'REALM', 'ROBUST', 'LEVERAGE', 'SYNERGY', 'SEAMLESS'];
        const word = words[(Math.random() * words.length) | 0];
        const a = angleTo(boss, p);
        const b = spawn(world.enemyBullets, {
            x: boss.frontX - 1, y: PLAY_Y + (Math.random() - 0.5) * 6,
            vx: Math.cos(a) * (ph.speed || 6), vy: Math.sin(a) * (ph.speed || 6),
            r: 0.35, dmg: ph.dmg || 4, kind: KIND.WORD, hitsTerrain: false,
            word, onlyProfanity: true, heals: word === 'ROBUST', bossShot: true
        });
        if (b && world.onWordBullet) world.onWordBullet(b);
    },
    symmetric(boss, world, p, ph) {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                const y = PLAY_Y + (r - 1) * 3;
                spawn(world.enemyBullets, {
                    x: boss.frontX - 1, y,
                    vx: -(ph.speed || 6), vy: (c - 1.5) * 0.6,
                    r: 0.2, dmg: ph.dmg || 4, kind: KIND.ENEMY_HEAVY, hitsTerrain: false
                });
            }
        }
    },
    // S5/S8/S9 mirror: fire back lastShot or remembered velocity.
    mirror(boss, world, p, ph) {
        const last = p && p.lastShot;
        if (last) {
            fireMimic(world, boss.frontX - 1, PLAY_Y, last, {
                scale: ph.scale || 1.5,
                dmg: ph.dmg || 6
            });
            return;
        }
        const shot = boss.mem.shift();
        if (!shot) {
            emit(boss, world, Math.PI, ph.speed || 10, ph.dmg || 6, KIND.ENEMY_HEAVY);
            return;
        }
        emit(boss, world, Math.PI + Math.atan2(shot.vy, shot.vx),
            (ph.speed || 10), ph.dmg || 6, KIND.ENEMY_HEAVY);
    },
    // Predict intercept volley (Forge).
    predict(boss, world, p, ph) {
        if (!p) return;
        const a = interceptAngle(world.predictor, boss.frontX - 1, PLAY_Y, p, ph.speed || 10);
        const n = ph.count || 3;
        for (let i = 0; i < n; i++) {
            emit(boss, world, a + (i - (n - 1) / 2) * 0.12, ph.speed || 10, ph.dmg || 6);
        }
    },
    // ∞ recursion: ring + aimed together.
    recurse(boss, world, p, ph) {
        FIRE.ring(boss, world, p, { count: 10, speed: 6, dmg: ph.dmg || 6 });
        FIRE.aimed(boss, world, p, { speed: 9, dmg: ph.dmg || 6 });
    },
    none() {}
};

function angleTo(boss, p) {
    return p ? Math.atan2(p.y - PLAY_Y, p.x - boss.frontX) : Math.PI;
}
function emit(boss, world, a, speed, dmg, kind = KIND.ENEMY_ORB) {
    const b = spawn(world.enemyBullets, {
        x: boss.frontX - 1, y: PLAY_Y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        r: 0.16, dmg, kind, hitsTerrain: false
    });
    if (b && world.temporal && world.temporal.active && world.recordTemporalBullet) {
        world.recordTemporalBullet(b);
    }
    return b;
}

export function hitCore(core, dmg, world) {
    const boss = core.boss;
    if (boss.dead || boss.integrated) return;
    // L6: closed scar — the shot heals the sun instead of hurting it.
    if (!core.open) {
        if (boss.cfg.healOnShot) {
            boss.hp = Math.min(boss.maxHp, boss.hp + boss.cfg.healOnShot);
        }
        sfx.hit();
        return;
    }
    let applied = dmg;
    if (core.weakpointT > 0) applied *= 3;
    // L8: asymmetry damage mult.
    if (world.damageMult) applied *= world.damageMult();
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
    if (world.temporal) stopTemporal(world.temporal);
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

    // L3 hard-fail integration clock (never scaled by difficulty — C10).
    if (boss.hardFailAt > 0 && boss._t >= boss.hardFailAt && !boss.integrated) {
        boss.integrated = true;
        boss.hp = boss.maxHp;
        for (const c of boss.cores) c.open = false;
        if (world.onBossIntegrated) world.onBossIntegrated(boss);
    }
    // L6 timeout: fails the fight (player death path via callback).
    if (boss.timeoutAt > 0 && boss._t >= boss.timeoutAt && !boss.dead) {
        if (world.onBossTimeout) world.onBossTimeout(boss);
    }

    if (boss.integrated) {
        // Integrated jester: still fires, invulnerable cores.
        boss.fireT -= dt;
        if (boss.fireT <= 0) {
            boss.fireT = 0.7;
            FIRE.ring(boss, world, world.player, { count: 20, speed: 7, dmg: 7 });
        }
        updateCoreMeshes(boss, dt);
        return;
    }

    if (boss.cfg.remembersShots && world.player && world.player.alive) {
        for (const b of world.bullets.items) {
            if (b.alive && !b._seenByBoss && b.vx > 0) {
                b._seenByBoss = true;
                boss.mem.push({ vx: b.vx, vy: b.vy });
                if (boss.mem.length > 16) boss.mem.shift();
            }
        }
    }

    // L8 symmetry regen.
    if (boss.cfg.asymmetryRegen && world.asymmetry) {
        const regen = symmetryRegen(world.asymmetry);
        if (regen > 0) boss.hp = Math.min(boss.maxHp, boss.hp + regen * dt);
    }

    const ph = currentPhase(boss);
    if (ph) {
        const frac = boss.hp / boss.maxHp;
        const nextByHp = ph.gate != null && frac <= ph.gate;
        const nextByTime = ph.duration != null && boss._phaseT >= ph.duration;
        if ((nextByHp || nextByTime) && boss._phaseIndex < boss.phases.length - 1) {
            enterPhase(boss, boss._phaseIndex + 1);
        }
    }

    boss.fireT -= dt;
    if (boss.fireT <= 0 && ph) {
        boss.fireT = ph.every || 1.6;
        const fn = FIRE[ph.fire || 'aimed'];
        if (fn) fn(boss, world, world.player, ph);
    }

    // Cast-gated cores (L6).
    if (boss.cfg.coreAlwaysOpen === false) {
        const cyc = boss.cfg.castCycle || 3;
        const open = (boss._t % cyc) < (boss.cfg.castOpen || 0.6);
        for (const c of boss.cores) c.open = open;
    }

    updateCoreMeshes(boss, dt);

    boss.body.position.set(boss.frontX, PLAY_Y, 0);
    const breath = 1 + Math.sin(boss._t * 1.5) * 0.03;
    const sc = boss.cfg.scale || 0.22;
    boss.body.scale.set(sc, sc * breath, sc);

    const p = world.player;
    if (p && p.alive && p.invuln <= 0 && Math.abs(p.x - boss.frontX) < 1.6 && Math.abs(p.y - PLAY_Y) < 2.2) {
        if (boss.cfg.noContactKill) {
            // L6: soft push, not death — the sun holds you, it does not kill you.
            p.x = Math.min(p.x, boss.frontX - 1.7);
        } else if (world.killPlayerByWall) {
            world.killPlayerByWall();
        }
    }
}

function updateCoreMeshes(boss, dt) {
    for (const core of boss.cores) {
        core.x = boss.frontX + (core.dx || -1.2);
        core.y = PLAY_Y + (core.dy || 0);
        if (core.mesh) {
            core.mesh.position.set(core.x, core.y, 0);
            core.mesh.visible = core.open;
            core.mat.emissiveIntensity = core.open ? (2.2 + Math.sin(boss._t * 6) * 0.6) : 0.2;
        }
        if (core.weakpointT > 0) core.weakpointT = Math.max(0, core.weakpointT - dt);
    }
}

function finishDeath(boss, world) {
    explode(boss.frontX, PLAY_Y, 3.0, boss.cfg.palette.spark || 0xffe0b0);
    ring(boss.frontX, PLAY_Y, 8, boss.cfg.palette.spark || 0xffcaa0);
    sfx.bigBoom();
    boss.group.visible = false;
    if (world.temporal) stopTemporal(world.temporal);
    if (world.onBossCleared) world.onBossCleared();
    world.boss = null;
}

export function disposeGenericBoss(boss, scene) {
    if (!boss) return;
    for (const c of boss.cores) c.alive = false;
    if (boss.world && boss.world.temporal) stopTemporal(boss.world.temporal);
    scene.remove(boss.group);
}

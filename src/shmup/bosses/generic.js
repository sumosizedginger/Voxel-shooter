// src/shmup/bosses/generic.js
// Purpose: config-driven boss for levels 2-10 with full signature hooks
// (mirror/copy, modifiers, word-bullets, predict intercept, temporal fold,
// asymmetry regen, cast-gated cores). Boss 01 stays bespoke in boss01.js.
// Dependencies: three, voxel/*, ../bullets, ../fx, ../sfx, systems/*

import * as THREE from 'three';
import { buildVoxelGeo } from '../../voxel/core.js';
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
import { buildBossBody } from '../assets/bossBodies.js';
import { BALANCE } from '../balance.js';

export function createGenericBoss(scene, world, cfg) {
    const diff = difficultyMultipliers();
    const group = new THREE.Group();
    scene.add(group);

    const pal = cfg.palette;
    const bodyGeo = buildVoxelGeo(buildBossBody(cfg.shape || 'default', pal));
    bodyGeo.center();
    const body = new THREE.Mesh(bodyGeo,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.15 }));
    body.scale.setScalar(cfg.scale || 0.22);
    group.add(body);

    // Telegraph ring (emissive disc) — hidden until pre-fire windup.
    const telGeo = new THREE.RingGeometry(0.55, 0.85, 24);
    const telMat = new THREE.MeshBasicMaterial({
        color: pal.spark || 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false
    });
    const telRing = new THREE.Mesh(telGeo, telMat);
    telRing.rotation.x = Math.PI / 2;
    telRing.visible = false;
    group.add(telRing);

    const frontX = world.scrollX + (cfg.standoff || 14);

    const boss = {
        kind: cfg.id,
        cfg,
        hp: Math.round(cfg.hp * diff.enemyHp),
        maxHp: Math.round(cfg.hp * diff.enemyHp),
        frontX,
        baseFrontX: frontX,
        bodyY: PLAY_Y,
        dead: false, dying: 0,
        _t: 0,
        _phaseIndex: 0,
        _phaseT: 0,
        group, body,
        telRing, telMat,
        cores: [],
        mouths: [],
        fireT: 0,
        teleT: 0,           // >0 while telegraphing before a volley
        mem: [],
        phases: cfg.phases,
        name: cfg.name,
        world,
        hardFailAt: cfg.hardFailAt || 0,   // L3 90s integration
        timeoutAt: cfg.timeoutAt || 0,     // L6 180s
        integrated: false,
        motion: cfg.motion || 'bob',
        telegraph: cfg.telegraph || 'shell'
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
    if (i > 0) {
        sfx.cast();
        if (sfx.phaseShift) sfx.phaseShift();
        ring(boss.frontX - 2, PLAY_Y, 4, VIOLET);
        if (boss.world && boss.world.onBossPhase) boss.world.onBossPhase(boss, i);
    }

    // S6: Jester phases push arena modifiers.
    if (ph && ph.mod && boss.world.mods) {
        pushMod(boss.world.mods, ph.mod, ph.modDuration || 8, ph.modData || null);
    }
    // S10: enter temporal on named phase.
    if (ph && ph.temporal && boss.world.temporal) {
        startTemporal(boss.world.temporal, boss.world.player);
    }
}

/** Phase dmgMult multiplies OUTGOING bullet damage only (never damage taken). */
function phaseDmg(boss, base) {
    const ph = currentPhase(boss);
    const mult = (ph && ph.dmgMult) || 1;
    return (base || 6) * mult;
}

const FIRE = {
    aimed(boss, world, p, ph) {
        const by = boss.bodyY || PLAY_Y;
        const a = (world.predictor && p)
            ? interceptAngle(world.predictor, boss.frontX - 1, by, p, ph.speed || 9)
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
        const dmg = phaseDmg(boss, ph.dmg || 5);
        for (let i = 0; i < rows; i++) {
            const y = PLAY_MIN_Y + 1 + (i / Math.max(1, rows - 1)) * (PLAY_MAX_Y - PLAY_MIN_Y - 2);
            spawn(world.enemyBullets, {
                x: boss.frontX - 1, y, vx: -(ph.speed || 4), vy: 0,
                r: 0.22, dmg, kind: KIND.ENEMY_HEAVY, hitsTerrain: false
            });
        }
    },
    words(boss, world, p, ph) {
        const words = ph.words || ['DELVE', 'TAPESTRY', 'REALM', 'ROBUST', 'LEVERAGE', 'SYNERGY', 'SEAMLESS'];
        const word = words[(Math.random() * words.length) | 0];
        const a = angleTo(boss, p);
        const by = boss.bodyY || PLAY_Y;
        const b = spawn(world.enemyBullets, {
            x: boss.frontX - 1, y: by + (Math.random() - 0.5) * 6,
            vx: Math.cos(a) * (ph.speed || 6), vy: Math.sin(a) * (ph.speed || 6),
            r: 0.35, dmg: phaseDmg(boss, ph.dmg || 4), kind: KIND.WORD, hitsTerrain: false,
            word, onlyProfanity: true, heals: word === 'ROBUST', bossShot: true
        });
        if (b && world.onWordBullet) world.onWordBullet(b);
    },
    symmetric(boss, world, p, ph) {
        const dmg = phaseDmg(boss, ph.dmg || 4);
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                const y = PLAY_Y + (r - 1) * 3;
                spawn(world.enemyBullets, {
                    x: boss.frontX - 1, y,
                    vx: -(ph.speed || 6), vy: (c - 1.5) * 0.6,
                    r: 0.2, dmg, kind: KIND.ENEMY_HEAVY, hitsTerrain: false
                });
            }
        }
    },
    // S5/S8/S9 mirror: fire back lastShot or remembered velocity.
    mirror(boss, world, p, ph) {
        const by = boss.bodyY || PLAY_Y;
        const dmg = phaseDmg(boss, ph.dmg || 6);
        const last = p && p.lastShot;
        if (last) {
            fireMimic(world, boss.frontX - 1, by, last, {
                scale: ph.scale || 1.5,
                dmg
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
        const by = boss.bodyY || PLAY_Y;
        const a = interceptAngle(world.predictor, boss.frontX - 1, by, p, ph.speed || 10);
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
    const by = boss.bodyY || PLAY_Y;
    return p ? Math.atan2(p.y - by, p.x - boss.frontX) : Math.PI;
}
function emit(boss, world, a, speed, dmg, kind = KIND.ENEMY_ORB) {
    const by = boss.bodyY || PLAY_Y;
    const b = spawn(world.enemyBullets, {
        x: boss.frontX - 1, y: by, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        r: 0.16, dmg: phaseDmg(boss, dmg), kind, hitsTerrain: false
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
    // L8: asymmetry damage mult (player → boss only).
    if (world.damageMult) applied *= world.damageMult();
    // dmgMult on a phase multiplies OUTGOING boss bullet damage (see emit/FIRE),
    // never damage taken — late phases must not die faster from a miswired mult.
    boss.hp -= applied;
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

    // Fire cadence with readable telegraph windup (skip for fire:'none').
    const fireKind = ph && (ph.fire || 'aimed');
    if (fireKind !== 'none') {
        if (boss.teleT > 0) {
            boss.teleT -= dt;
            updateTelegraphVisual(boss, 1 - Math.max(0, boss.teleT) / (BALANCE.bossTelegraphS || 0.42));
            if (boss.teleT <= 0) {
                hideTelegraph(boss);
                const fn = FIRE[fireKind];
                if (fn) fn(boss, world, world.player, ph);
                if (sfx.bossVolley) sfx.bossVolley();
                boss.fireT = (ph && ph.every) || 1.6;
            }
        } else {
            boss.fireT -= dt;
            if (boss.fireT <= 0 && ph) {
                // Start telegraph; volley fires when teleT hits 0.
                const tel = BALANCE.bossTelegraphS || 0.42;
                // Cap telegraph so very fast phases still have room to fire.
                const every = ph.every || 1.6;
                boss.teleT = Math.min(tel, Math.max(0.18, every * 0.35));
                beginTelegraph(boss);
            }
        }
    }

    // Cast-gated cores (L6) — scar open is its own "telegraph".
    if (boss.cfg.coreAlwaysOpen === false) {
        const cyc = boss.cfg.castCycle || 3;
        const open = (boss._t % cyc) < (boss.cfg.castOpen || 0.6);
        const wasOpen = boss.cores[0] && boss.cores[0].open;
        for (const c of boss.cores) c.open = open;
        if (open && !wasOpen) {
            ring(boss.frontX - 1, boss.bodyY || PLAY_Y, 2.2, VIOLET);
            if (sfx.scarOpen) sfx.scarOpen();
        }
    }

    applyBossMotion(boss, dt, world);
    updateCoreMeshes(boss, dt);

    const p = world.player;
    const by = boss.bodyY || PLAY_Y;
    if (p && p.alive && p.invuln <= 0 && Math.abs(p.x - boss.frontX) < 1.6 && Math.abs(p.y - by) < 2.2) {
        if (boss.cfg.noContactKill) {
            // L6: soft push, not death — the sun holds you, it does not kill you.
            p.x = Math.min(p.x, boss.frontX - 1.7);
        } else if (world.killPlayerByWall) {
            world.killPlayerByWall();
        }
    }
}

/** Signature body motion per boss — keeps Boss 01 as the quality bar for set-pieces. */
function applyBossMotion(boss, dt, world) {
    const t = boss._t;
    const mode = boss.motion || 'bob';
    let y = PLAY_Y;
    let xOff = 0;
    let rotZ = 0;
    let breath = 1 + Math.sin(t * 1.5) * 0.03;

    if (mode === 'weave') {
        y = PLAY_Y + Math.sin(t * 1.1) * 1.6;
        xOff = Math.sin(t * 0.7) * 0.35;
    } else if (mode === 'lunge') {
        // Periodic forward lunge then settle — telegraph of aggression.
        const cycle = (t % 3.2);
        const lunge = cycle < 0.55 ? Math.sin((cycle / 0.55) * Math.PI) * 1.4 : 0;
        xOff = -lunge;
        y = PLAY_Y + Math.sin(t * 0.9) * 0.9;
        rotZ = -lunge * 0.08;
    } else if (mode === 'pulse' || mode === 'breathe') {
        breath = 1 + Math.sin(t * 2.2) * 0.08;
        y = PLAY_Y + Math.sin(t * 0.6) * 0.4;
    } else if (mode === 'drift') {
        y = PLAY_Y + Math.sin(t * 0.55) * 2.2;
        xOff = Math.sin(t * 0.35) * 0.5;
    } else if (mode === 'orbit') {
        y = PLAY_Y + Math.sin(t * 1.4) * 1.8;
        xOff = Math.cos(t * 1.4) * 0.55;
        rotZ = Math.sin(t * 0.8) * 0.12;
    } else {
        // bob (default)
        y = PLAY_Y + Math.sin(t * 1.3) * 0.85;
    }

    // Keep standoff relative to scroll.
    boss.baseFrontX = world.scrollX + (boss.cfg.standoff || 14);
    boss.frontX = boss.baseFrontX + xOff;
    boss.bodyY = y;

    const sc = boss.cfg.scale || 0.22;
    boss.body.position.set(boss.frontX, y, 0);
    boss.body.rotation.z = rotZ;
    boss.body.scale.set(sc * breath, sc * breath, sc);
    if (boss.telRing) {
        boss.telRing.position.set(boss.frontX - 1.2, y, 0.4);
    }
}

function beginTelegraph(boss) {
    if (!boss.telRing) return;
    boss.telRing.visible = true;
    boss.telMat.opacity = 0.15;
    const kind = boss.telegraph || 'shell';
    // Distinct flash color per signature
    const colors = {
        shell: boss.cfg.palette.shell || 0xffffff,
        spin: 0xff80d0,
        word: 0xe8e0f0,
        mirror: 0xd0f0ff,
        scar: VIOLET,
        aim: 0xffb060,
        wall: 0xeeeef2,
        shadow: 0xc0a0ff,
        seal: 0xd0c0ff
    };
    boss.telMat.color.setHex(colors[kind] || 0xffffff);
    if (sfx.telegraph) sfx.telegraph();
    else sfx.cast();
    // Soft ring pulse in world FX
    ring(boss.frontX - 1, boss.bodyY || PLAY_Y, 1.6, colors[kind] || 0xffffff);
}

function updateTelegraphVisual(boss, u) {
    if (!boss.telRing) return;
    boss.telMat.opacity = 0.2 + u * 0.75;
    const s = 0.7 + u * 1.1;
    boss.telRing.scale.set(s, s, s);
}

function hideTelegraph(boss) {
    if (!boss.telRing) return;
    boss.telRing.visible = false;
    boss.telMat.opacity = 0;
}

function updateCoreMeshes(boss, dt) {
    const by = boss.bodyY || PLAY_Y;
    for (const core of boss.cores) {
        core.x = boss.frontX + (core.dx || -1.2);
        core.y = by + (core.dy || 0);
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

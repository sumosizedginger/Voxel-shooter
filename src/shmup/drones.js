// src/shmup/drones.js
// Purpose: the Council — six seat-drones, two slots, pre-mission loadout.
// Dependencies: three, ./bullets, ./fx, ./sfx, ./palette
//
// Bible §03: "The arsenal is the Council. Every weapon is a seat function
// repurposed for combat. This is not metaphor. This is diegetic."
//
// Behaviors, verbatim from §03/§14:
//   Needle  — "fires a piercing lance that ignores enemy shields but has slow
//             fire rate"
//   Mirror  — "reflects a portion of incoming fire back at the source"
//   Cloak   — "grants 2.5 seconds of invisibility on a 12-second cooldown"
//   Ghost   — "phases the Vessel through one collision per life"
//   Scribe  — "marks enemy weakpoints for 4 seconds on a 10-second cooldown"
//   Prophet — "fires a volley that homes but deals reduced damage"
//
// Five of the eight seats voted to integrate the corruption. She flies with two
// of them bolted to her hull. The Council did not authorize this.

import * as THREE from 'three';
import { KIND, spawn, kill, allHits } from './bullets.js';
import { sparkHit, ring } from './fx.js';
import { sfx } from './sfx.js';
import { SHIP_PALETTE, VIOLET } from './palette.js';
import { COUNCIL, DRONE_TYPES, MAX_DRONES } from './council.js';

export { COUNCIL, DRONE_TYPES, MAX_DRONES };

/** Orbit slots — one above, one below, so two drones never overlap. */
const SLOT_OFFSET = [[-0.5, 0.75], [-0.5, -0.75]];

export function createDrones(scene, world) {
    const d = {
        scene,
        equipped: [],       // up to MAX_DRONES type keys
        state: {},          // type -> { cd, active, mesh }
        _t: 0
    };
    world.drones = d;
    return d;
}

/** Pre-mission loadout. Replaces whatever was equipped. */
export function equipDrones(d, types) {
    for (const t of Object.keys(d.state)) {
        const s = d.state[t];
        if (s.mesh) d.scene.remove(s.mesh);
    }
    d.state = {};
    d.equipped = types.slice(0, MAX_DRONES).filter((t) => COUNCIL[t]);

    for (let i = 0; i < d.equipped.length; i++) {
        const type = d.equipped[i];
        const def = COUNCIL[type];
        const mesh = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.16, 0),
            new THREE.MeshStandardMaterial({
                color: SHIP_PALETTE.hullDark, roughness: 0.5, metalness: 0.4
            })
        );
        mesh.add(body);
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 8, 6),
            new THREE.MeshStandardMaterial({
                color: 0x05060a, emissive: def.color, emissiveIntensity: 2.4
            })
        );
        mesh.add(glow);
        d.scene.add(mesh);

        d.state[type] = { cd: 0, active: 0, fireT: 0, mesh, glow: glow.material, slot: i };
    }
}

/**
 * Mid-mission switch. Bible §03: "Switching drones mid-mission costs a force
 * unit charge." That charge is the Witness's intercept — so swapping a seat
 * means the Witness cannot save you for three seconds. Nothing is free.
 */
export function switchDrone(d, world, slot, type) {
    if (!COUNCIL[type]) return false;
    const w = world.witness;
    if (w) {
        if (w.interceptCd > 0) return false;       // the charge is already spent
        w.interceptCd = 3.0;
    }
    const next = d.equipped.slice();
    next[slot] = type;
    equipDrones(d, next);
    sfx.uiConfirm();
    return true;
}

export function hasDrone(d, type) {
    return d.equipped.includes(type);
}

/** Called once per life: the Ghost's phase charge is per-life, not per-level. */
export function refreshPerLife(d, player) {
    player.phaseCharges = hasDrone(d, 'ghost') ? 1 : 0;
}

export function updateDrones(d, dt, player, world, input) {
    d._t += dt;

    for (let i = 0; i < d.equipped.length; i++) {
        const type = d.equipped[i];
        const def = COUNCIL[type];
        const s = d.state[type];
        if (!s) continue;

        if (s.cd > 0) s.cd -= dt;
        if (s.active > 0) s.active -= dt;

        // Orbit the Vessel with a slow bob — they are hers, and they trail her.
        const off = SLOT_OFFSET[s.slot] || SLOT_OFFSET[0];
        const bob = Math.sin(d._t * 3 + s.slot * 2) * 0.09;
        s.mesh.position.set(player.x + off[0], player.y + off[1] + bob, 0);
        s.mesh.rotation.y += dt * 2.2;
        s.mesh.visible = player.alive;

        // Cooldown is legible on the drone itself, not just the HUD.
        s.glow.emissiveIntensity = s.cd > 0 ? 0.5 : (s.active > 0 ? 3.6 : 2.4);

        if (!player.alive) continue;

        if (def.mode === 'auto') {
            s.fireT -= dt;
            if (s.fireT <= 0) {
                s.fireT = def.every;
                fireAuto(type, s, player, world);
            }
        } else if (def.mode === 'active') {
            if (input && input.dronePressed && s.cd <= 0) {
                s.cd = def.cooldown;
                s.active = def.duration;
                activate(type, s, player, world);
            }
        } else if (def.mode === 'passive') {
            passive(type, s, dt, player, world);
        }
    }
}

function fireAuto(type, s, player, world) {
    const x = player.x + 0.6;
    const y = player.y;

    if (type === 'needle') {
        // "a piercing lance that ignores enemy shields"
        spawn(world.bullets, {
            x, y, vx: 34, vy: 0,
            r: 0.14, dmg: 8, kind: KIND.PULSE_1,
            pierce: 99,
            ignoresShields: true,
            scale: 1.3
        });
        sfx.shoot();
    } else if (type === 'prophet') {
        // "fires a volley that homes but deals reduced damage"
        const target = nearestEnemy(player.x, player.y, world.enemies.items);
        for (let i = 0; i < 3; i++) {
            const a = (i - 1) * 0.5;
            spawn(world.bullets, {
                x, y: y + (i - 1) * 0.2,
                vx: Math.cos(a) * 14, vy: Math.sin(a) * 14,
                r: 0.12, dmg: 2, kind: KIND.BIT,
                homing: 3.2,
                target,
                life: 2.5
            });
        }
        sfx.shoot();
    }
}

function activate(type, s, player, world) {
    if (type === 'cloak') {
        // Invisible: enemies stop aiming at her. She is still solid.
        player.cloaked = COUNCIL.cloak.duration;
        sfx.absorb();
        ring(player.x, player.y, 1.2, COUNCIL.cloak.color);
    } else if (type === 'scribe') {
        // "marks enemy weakpoints for 4 seconds"
        for (const e of world.enemies.items) {
            if (!e.alive) continue;
            e.marked = COUNCIL.scribe.duration;
        }
        world.markedT = COUNCIL.scribe.duration;
        sfx.cast();
        ring(player.x, player.y, 3.0, VIOLET);
    }
}

function passive(type, s, dt, player, world) {
    if (type === 'mirror') {
        // "reflects a portion of incoming fire back at the source"
        const near = allHits(world.enemyBullets, player.x, player.y, COUNCIL.mirror.radius);
        for (const b of near) {
            // S7: word-bullets are only cancelled by the Profanity Key.
            if (b.onlyProfanity || b.kind === KIND.WORD) continue;
            if (b.mirrorSeen) continue;
            b.mirrorSeen = true;                  // one roll per bullet, not per frame
            // Deterministic-ish roll: a real random here would make the same
            // situation resolve differently on a checkpoint retry.
            const roll = Math.abs(Math.sin(b.x * 12.9898 + b.y * 78.233)) % 1;
            if (roll > COUNCIL.mirror.reflectChance) continue;
            const sp = Math.hypot(b.vx, b.vy);
            const a = Math.atan2(-b.vy, -b.vx);
            kill(world.enemyBullets, b);
            spawn(world.bullets, {
                x: b.x, y: b.y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                r: b.r, dmg: b.dmg || 6, kind: KIND.PULSE_1
            });
            sparkHit(b.x, b.y, COUNCIL.mirror.color);
        }
    }
    // ghost: its whole effect is player.phaseCharges, set in refreshPerLife()
    // and spent in player.js killPlayer(). Nothing to tick.
}

function nearestEnemy(x, y, enemies) {
    let best = null;
    let bd = Infinity;
    for (const e of enemies) {
        if (!e.alive) continue;
        const d = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d < bd) { bd = d; best = e; }
    }
    return best;
}

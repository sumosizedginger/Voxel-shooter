// src/shmup/systems/copybuffer.js
// Purpose: S5 copy buffer / mimic — records the player's last shot; mimics and
// the Induction Parrot replay it scaled. Weapon switch clears the buffer
// (handled in player.js via lastShot = null).
// Dependencies: bullets (spawn/KIND)
//
// NARRATIVE_PLAN §4 S5. player.lastShot is the buffer; this module only fires it
// back as an enemy shot.

import { KIND, spawn } from '../bullets.js';

/**
 * @param {object} world
 * @param {number} x
 * @param {number} y
 * @param {object|null} lastShot player.lastShot
 * @param {object} [opts] { scale=1.5, dmg=6 }
 * @returns {object|null} spawned bullet
 */
export function fireMimic(world, x, y, lastShot, opts = {}) {
    const scale = opts.scale != null ? opts.scale : 1.5;
    const dmg = opts.dmg != null ? opts.dmg : 6;
    if (!world || !world.enemyBullets) return null;

    // Default: a basic reverse bolt if she hasn't fired yet.
    if (!lastShot) {
        return spawn(world.enemyBullets, {
            x, y, vx: -10 * scale, vy: 0,
            r: 0.16, dmg, kind: KIND.ENEMY_ORB, hitsTerrain: false
        });
    }

    if (lastShot.weapon === 'hammer') {
        // Spread-ish: three pellets back.
        const n = lastShot.mode === 'slug' ? 1 : 3;
        let last = null;
        for (let i = 0; i < n; i++) {
            const a = Math.PI + (i - (n - 1) / 2) * 0.18;
            last = spawn(world.enemyBullets, {
                x, y,
                vx: Math.cos(a) * 11 * scale,
                vy: Math.sin(a) * 11 * scale,
                r: 0.18, dmg, kind: KIND.ENEMY_HEAVY, hitsTerrain: false
            });
        }
        return last;
    }

    // Pulse: tier scales size/speed.
    const tier = lastShot.tier || 0;
    const speed = (10 + tier * 3) * scale;
    const r = 0.14 + tier * 0.1;
    return spawn(world.enemyBullets, {
        x, y, vx: -speed, vy: 0,
        r, dmg: dmg + tier * 2,
        kind: tier >= 2 ? KIND.ENEMY_HEAVY : KIND.ENEMY_ORB,
        hitsTerrain: false
    });
}

/** Record a shot into the buffer (also done inline on player). */
export function recordShot(player, shot) {
    if (!player) return;
    player.lastShot = shot;
}

export function clearBuffer(player) {
    if (player) player.lastShot = null;
}

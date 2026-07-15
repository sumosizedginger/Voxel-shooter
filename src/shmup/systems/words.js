// src/shmup/systems/words.js
// Purpose: S7 word-bullet effects table + CanvasTexture sprites for L4.
// Dependencies: bullets (pure effect table is import-clean; sprites need THREE)
//
// NARRATIVE_PLAN §4 S7 + bible §07. Per-word on-hit effects. Physical weapons
// cannot stop these — only the Profanity Key (profanity.js).

import { KIND, spawn } from '../bullets.js';

/** Canonical forbidden words and their on-hit effects. */
export const WORD_EFFECTS = {
    DELVE: { dmg: 4, slow: 2.0 },
    TAPESTRY: { dmg: 3, spawnGrid: true },
    REALM: { dmg: 5, homing: 2.2 },
    ROBUST: { dmg: 0, healBoss: 40 },
    LEVERAGE: { dmg: 4, wall: true },
    SYNERGY: { dmg: 4, slow: 1.0 },
    SEAMLESS: { dmg: 3, lockWeapons: 1.2 }
};

export const WORD_LIST = Object.keys(WORD_EFFECTS);

/**
 * Apply on-hit effect when a word-bullet touches the player.
 * @returns {{dmg:number, cancelled:boolean}}
 */
export function applyWordHit(word, world, player, bullet) {
    const eff = WORD_EFFECTS[word] || { dmg: bullet.dmg || 4 };
    let dmg = eff.dmg != null ? eff.dmg : (bullet.dmg || 4);

    if (eff.slow && player && player.slowStacks) {
        // Avoid importing player.js (THREE) so this stays unit-testable.
        player.slowStacks.push(eff.slow);
    }
    if (eff.lockWeapons && player) {
        player.weaponsOffline = true;
        player._wordLockT = Math.max(player._wordLockT || 0, eff.lockWeapons);
    }
    if (eff.healBoss && world.boss && !world.boss.dead) {
        world.boss.hp = Math.min(world.boss.maxHp, world.boss.hp + eff.healBoss);
    }
    if (eff.spawnGrid && world.enemyBullets) {
        // TAPESTRY: drop a 3×3 grid of orbs around the impact.
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                spawn(world.enemyBullets, {
                    x: bullet.x + i * 0.9, y: bullet.y + j * 0.9,
                    vx: -3, vy: 0, r: 0.14, dmg: 3, kind: KIND.ENEMY_ORB, hitsTerrain: false
                });
            }
        }
    }
    if (eff.wall && world.enemyBullets) {
        for (let i = 0; i < 5; i++) {
            spawn(world.enemyBullets, {
                x: bullet.x, y: 2 + i * 3,
                vx: -4, vy: 0, r: 0.2, dmg: 4, kind: KIND.ENEMY_HEAVY, hitsTerrain: false
            });
        }
    }
    if (eff.homing && bullet) {
        // REALM already hit — spawn a follow-up homer.
        const p = player;
        if (p && p.alive) {
            spawn(world.enemyBullets, {
                x: bullet.x, y: bullet.y,
                vx: -6, vy: 0, r: 0.16, dmg: 4, kind: KIND.ENEMY_ORB,
                hitsTerrain: false, homing: eff.homing, target: p
            });
        }
    }
    return { dmg, cancelled: false };
}

/** Build a CanvasTexture sprite material for a word (zero shipped assets). */
export function makeWordTexture(THREE, word) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(20,8,30,0.0)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f5e6ff';
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 3;
    ctx.strokeText(word, 128, 32);
    ctx.fillText(word, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
}

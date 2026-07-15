// src/shmup/enemies/roster.js
// Purpose: the enemy stat table — data only, no THREE, no imports of the pool.
// Dependencies: none (import-clean; the stage-lint spec reads this)
//
// ASSETS_PLAN §2. HP/damage here are BASE values; difficultyMultipliers() is
// applied at spawn time (PLAN.md §2.7, C10) — never bake difficulty in here.
//
// `r` is the HIT radius, and it is deliberately smaller than the art
// (ASSETS_PLAN §6: "collision is always slightly smaller than the art,
// everywhere, including enemies"). A shot that visibly grazed must miss.

export const ROSTER = {
    drone: {
        asset: 'drone', hp: 1, r: 0.3, score: 100, contactKills: true,
        pattern: 'sineDrift', fire: null,
        patternState: { amp: 1.5, freq: 0.5 },
        vx: -4.5
    },
    darter: {
        asset: 'darter', hp: 1, r: 0.34, score: 150, contactKills: true,
        pattern: 'swoopIn', fire: 'apexShot',
        patternState: { hold: 0.5, diveSpeed: 12 },
        fireState: { speed: 11, dmg: 7 },
        vx: -9
    },
    gunpod: {
        asset: 'gunpod', hp: 3, r: 0.5, score: 300, contactKills: true,
        pattern: 'hoverAndAim', fire: 'burstShot',
        fireState: { every: 2.85, count: 3, burstGap: 0.12, speed: 10, dmg: 6 },
        vx: -1.2, hasBarrel: true
    },
    crawler: {
        asset: 'crawler', hp: 2, r: 0.4, score: 200, contactKills: true,
        pattern: 'crawl', fire: 'axisShot',
        fireState: { every: 2.0, speed: 8, dmg: 6 },
        vx: -2.5
    },
    mine: {
        asset: 'mine', hp: 1, r: 0.26, score: 50, contactKills: true,
        pattern: 'homingSlow', fire: null,
        patternState: { speed: 3.2, turn: 2.0 },
        vx: -3.2
    },
    lancer: {
        asset: 'lancer', hp: 4, r: 0.55, score: 400, contactKills: true,
        pattern: 'sineDrift', fire: 'spreadShot',
        patternState: { amp: 3, freq: 0.22 },
        fireState: { every: 2.7, count: 2, spread: 0.4, speed: 8, dmg: 7 },
        vx: -2.8
    },
    carrier: {
        asset: 'carrier', hp: 8, r: 0.85, score: 500, contactKills: true,
        pattern: 'straight', fire: null,       // it never shoots. It just carries.
        drops: 'shard',                        // the Witness shard (C4/C5)
        vx: -1.6
    }
};

/** Every roster key — the spec and the level lint both iterate this. */
export const ENEMY_TYPES = Object.keys(ROSTER);

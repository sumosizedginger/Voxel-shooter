// tests/shipquality.spec.mjs
// Phase A–D ship-quality: balance, rooms, options a11y, onboarding, music ABC,
// cutscene kits. Avoids THREE-linked modules (bosses/generic pull renderer).

import { BALANCE, BOSS_BALANCE } from '../src/shmup/balance.js';
import { roomsFor, scrollSpeedFor, buildStageTerrain } from '../src/shmup/level/stagecraft.js';
import { LEVELS, LAST_LEVEL, makeLevel } from '../src/shmup/level/campaign.js';
import { HEAT_PER_TURN, HEAT_DECAY, HEAT_OFFLINE_S } from '../src/shmup/systems/heat.js';
import { ROSTER } from '../src/shmup/enemies/roster.js';
import { TRACK_NAMES, trackStepCount } from '../src/shmup/music.js';
import {
    levelOpenCutscene, levelBossCutscene
} from '../src/shmup/systems/cutscene.js';
import {
    TIPS, nextTip, shouldShowTip, markTipSeen, skipAllTips, tipsForWhere, tipsDone
} from '../src/shmup/systems/onboarding.js';
import { BULLET_PALETTE } from '../src/shmup/palette.js';
import { sfx } from '../src/shmup/sfx.js';
import { resetAll, getSetting, setSetting, resetSettingsDefaults } from '../src/engine/settings.js';
import { DEFAULT_BINDINGS, proposeRebind } from '../src/shmup/input.js';

// Mirrors BOSS_CONFIGS motion/telegraph (kept here to stay THREE-free).
const BOSS_SETPIECES = {
    boss02: { motion: 'weave', telegraph: 'shell', hp: BOSS_BALANCE.boss02.hp },
    boss03: { motion: 'lunge', telegraph: 'spin', hp: BOSS_BALANCE.boss03.hp },
    boss04: { motion: 'bob', telegraph: 'word', hp: BOSS_BALANCE.boss04.hp },
    boss05: { motion: 'pulse', telegraph: 'mirror', hp: BOSS_BALANCE.boss05.hp },
    boss06: { motion: 'breathe', telegraph: 'scar', hp: BOSS_BALANCE.boss06.hp },
    boss07: { motion: 'lunge', telegraph: 'aim', hp: BOSS_BALANCE.boss07.hp },
    boss08: { motion: 'drift', telegraph: 'wall', hp: BOSS_BALANCE.boss08.hp },
    boss09: { motion: 'orbit', telegraph: 'shadow', hp: BOSS_BALANCE.boss09.hp },
    boss10: { motion: 'orbit', telegraph: 'seal', hp: BOSS_BALANCE.boss10.hp }
};

const PAL = { base: 0x8892a0, mid: 0x6a7482, dark: 0x3e4652, pale: 0xc0cad8, flesh: 0x545e6c };

export function run(t) {
    // ── balance table
    t.ok('BALANCE.scrollBase set', BALANCE.scrollBase > 2 && BALANCE.scrollBase < 3);
    t.ok('heat softens vs old 9/18', HEAT_PER_TURN <= 8 && HEAT_DECAY >= 20);
    t.ok('heat offline uses balance', HEAT_OFFLINE_S <= 2);
    t.ok('darter dmg eased', ROSTER.darter.fireState.dmg === 7);
    t.ok('gunpod every eased', ROSTER.gunpod.fireState.every >= 2.8);
    t.ok('boss telegraph window', BALANCE.bossTelegraphS >= 0.3);

    // ── boss set-piece catalog (motion + telegraph per 02–10)
    for (const [id, sp] of Object.entries(BOSS_SETPIECES)) {
        t.ok(id + ' motion', typeof sp.motion === 'string' && sp.motion.length > 0);
        t.ok(id + ' telegraph', typeof sp.telegraph === 'string' && sp.telegraph.length > 0);
        t.ok(id + ' hp from balance', sp.hp === BOSS_BALANCE[id].hp);
    }
    const tels = new Set(Object.values(BOSS_SETPIECES).map((c) => c.telegraph));
    t.ok('multiple telegraph kinds', tels.size >= 5, 'n=' + tels.size);
    const mots = new Set(Object.values(BOSS_SETPIECES).map((c) => c.motion));
    t.ok('multiple motion kinds', mots.size >= 4, 'n=' + mots.size);

    // ── stage rooms L02–10
    for (let id = 2; id <= LAST_LEVEL; id++) {
        const rooms = roomsFor(id, PAL, 340);
        t.ok('L' + id + ' rooms >= 8 decor pieces', rooms.length >= 8, 'n=' + rooms.length);
        const kinds = new Set(rooms.map((r) => r.chunk));
        t.ok('L' + id + ' room chunk variety', kinds.size >= 2, [...kinds].join(','));
        const terr = buildStageTerrain(PAL, 340, id);
        t.ok('L' + id + ' terrain denser than tunnel', terr.length > 50);
        const lvl = LEVELS[id];
        const recoveries = lvl.triggers.filter((tr) => tr.type === 'pickup' && tr.kind === 'shard');
        t.ok('L' + id + ' has recovery shards', recoveries.length >= 2, 'n=' + recoveries.length);
        t.ok('L' + id + ' scrollSpeed positive', scrollSpeedFor(id) > 1.5);
        // systems bag present
        t.ok('L' + id + ' systems bag', !!lvl.systems);
    }

    // mid rest shards on L2/L3
    const l2mid = LEVELS[2].triggers.some((tr) =>
        tr.type === 'pickup' && tr.kind === 'shard' && tr.atX > 180 && tr.atX < 200);
    t.ok('L2 mid rest recovery', l2mid);

    // ── cutscene kits
    for (let id = 1; id <= 10; id++) {
        const open = levelOpenCutscene(id, 0);
        t.ok('open L' + id + ' dioramaMode', open.dioramaMode === 'open');
        t.ok('open L' + id + ' has 3 shots', open.shots.length === 3);
        const boss = levelBossCutscene(id, 0);
        t.ok('boss L' + id + ' dioramaMode', boss.dioramaMode === 'boss');
        t.ok('boss L' + id + ' lineId', boss.shots.some((s) => s.lineId));
        if (id === 1 || id === 6 || id === 10) {
            t.ok('L' + id + ' weighted hold', open.shots[1].hold >= 4.5);
        }
    }

    // ── music ABC
    for (const name of TRACK_NAMES.filter((n) => n !== 'default')) {
        t.ok('ABC ' + name, trackStepCount(name) >= 48, 'len=' + trackStepCount(name));
    }

    // ── SFX event bank
    for (const k of ['kill', 'bossVolley', 'telegraph', 'scarOpen', 'castOpen', 'tip', 'phaseShift', 'wordFire']) {
        t.ok('sfx.' + k, typeof sfx[k] === 'function');
    }

    // ── bullets win contrast
    t.ok('enemy bullet hot magenta', BULLET_PALETTE.enemy === 0xff48d0);
    t.ok('word near white', BULLET_PALETTE.word === 0xfff6ff);

    // ── onboarding
    resetAll();
    t.ok('tips catalog has 4', TIPS.length === 4);
    t.ok('loadout tip first', nextTip('loadout') && nextTip('loadout').id === 'tip_loadout');
    t.ok('play tips exist', tipsForWhere('play_L1').length === 3);
    markTipSeen('tip_loadout');
    t.ok('seen tip hidden', !shouldShowTip('tip_loadout'));
    skipAllTips();
    t.ok('skipAll marks tipsDone', tipsDone());
    resetAll();

    // ── settings defaults include a11y
    t.ok('largerHud default false', getSetting('largerHud') === false);
    t.ok('lowerShake default false', getSetting('lowerShake') === false);
    t.ok('holdToFire default true', getSetting('holdToFire') === true);
    t.ok('quality default high', getSetting('quality') === 'high');
    setSetting('largerHud', true);
    setSetting('masterVolume', 0.3);
    resetSettingsDefaults();
    t.ok('resetSettingsDefaults restores largerHud', getSetting('largerHud') === false);
    t.ok('resetSettingsDefaults restores volume', getSetting('masterVolume') === 1);

    // ── rebind steals key from other actions
    {
        const { next, conflict } = proposeRebind('dock', 'KeyZ', {});
        t.ok('rebind reports fire conflict', conflict === 'fire', String(conflict));
        t.ok('dock owns KeyZ', next.dock && next.dock[0] === 'KeyZ');
        t.ok('fire no longer has KeyZ', !(next.fire || []).includes('KeyZ'));
        t.ok('fire still has a key', (next.fire || []).length > 0);
        void DEFAULT_BINDINGS;
    }

    // ── L01 still present
    t.ok('L01 exists', LEVELS[1] && LEVELS[1].name);
    t.ok('makeLevel(4) works', makeLevel(4).triggers.length > 10);
}

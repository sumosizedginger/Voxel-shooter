// src/shmup/balance.js
// Purpose: ship-quality balance table + playtest notes for L01–L10.
// Data-first tuning: bosses/heat/scroll/enemies import numbers from here when
// shared; stage scripts keep recovery cadence in campaign.js.
// Dependencies: none (import-clean).
//
// PLAYTEST LOG (god off, normal) — synthetic clear pass + spike review:
//   L1 Beige: fair teach. Gunpod nest at ~210 can stack with pincer if slow —
//     recovery shards OK. Boss 01 set-piece is the quality bar.
//   L2 Parrot: mimic double-pressure at lock (224) is the hard spike; fire
//     cadence on boss was unreadable without telegraph — fixed via generic
//     telegraph. HP 1200 (was 1300).
//   L3 Jester: hardFailAt 90s punishes learning; keep C8 rule but ease phase
//     every slightly + telegraph mods. Ring count 10→9 early.
//   L4 Suit: word density fine; wall phase telegraph required. HP 1150.
//   L5 Mirror: delay 0.3 fair; lock gauntlet + castChance 0.4 is spike —
//     mid rest shard already present.
//   L6 Sun: healOnShot 8 + closed scar is intended; castOpen 0.9 for clarity.
//     timeout 180 stays.
//   L7 Forge: heat per turn 9 felt sticky with predict fire — heat softened.
//   L8 Drift: symmetric walls need telegraph; asymmetry regen mild.
//   L9 Shadow: delay 0.5 + mirror every 0.35 final is hard but telegraphed.
//   L10 Seal: spiral/recurse/ring phases need motion + telegraph; HP 1500.
// Unfair rooms flagged & fixed in stagecraft room packing + campaign rests.

/** Global player-facing fairness knobs. */
export const BALANCE = {
    playerHull: 100,
    playerLives: 3,
    shotRate: 8,
    scrollBase: 2.45,
    // Heat (L7) — less sticky so predict boss is the skill check, not the meter.
    heatPerTurn: 7,
    heatDecay: 22,
    heatOfflineS: 1.8,
    // Boss default standoff / telegraph window (seconds before volley).
    bossTelegraphS: 0.42,
    // Recovery: scripts place recoveryOnly shards within 15u after checkpoints.
    recoveryWindowU: 15
};

/** Per-boss balance overrides used by BOSS_CONFIGS (hp / cadence notes). */
export const BOSS_BALANCE = {
    boss02: { hp: 1200, every: [1.0, 0.7, 0.5] },
    boss03: { hp: 1180, hardFailAt: 90 },
    boss04: { hp: 1150, every: [1.9, 1.2, 2.3] },
    boss05: { hp: 1220, every: [1.05, 0.75, 0.5] },
    boss06: { hp: 1000, castOpen: 0.9, healOnShot: 7 },
    boss07: { hp: 1280, every: [1.5, 1.1, 0.85] },
    boss08: { hp: 1220, every: [2.9, 2.0, 1.4] },
    boss09: { hp: 1400, every: [0.9, 0.6, 0.4] },
    boss10: { hp: 1500 }
};

/** Enemy roster tweaks applied on top of roster.js bases where shared. */
export const ENEMY_BALANCE = {
    gunpodEvery: 2.85,
    darterDmg: 7,
    lancerEvery: 2.7
};

export default BALANCE;

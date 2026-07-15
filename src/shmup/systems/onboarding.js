// src/shmup/systems/onboarding.js
// Purpose: first-run tips (interrupt / Witness / Pulse 3 / loadout).
// Skippable; never softens bible text — tips are UI chrome only.
// Dependencies: engine/settings (progress.hintsSeen)

import { getProgress, markProgressFlag, getSetting, setSetting } from '../../engine/settings.js';

/** Tip catalog. `id` is persisted in progress.hintsSeen. */
export const TIPS = [
    {
        id: 'tip_loadout',
        where: 'loadout',
        title: 'COUNCIL LOADOUT',
        body: 'Two seats. Cycle with left/right. Fire launches. Ghost eats one lethal collision; Needle punches cores.'
    },
    {
        id: 'tip_interrupt',
        where: 'play_L1',
        title: 'INTERRUPT',
        body: 'Elites glow and announce. Hit them during the cast — violet weakpoint opens. That is the only honest violet.'
    },
    {
        id: 'tip_witness',
        where: 'play_L1',
        title: 'THE WITNESS',
        body: 'Dock (X/K) to recall her. Double-tap docks Mirror Counter. Collect shards to raise her level.'
    },
    {
        id: 'tip_pulse3',
        where: 'play_L1',
        title: 'SIREN PULSE III',
        body: 'Hold fire to charge. Tier 3 needs Witness ≥ 2 and roots you briefly — a siege weapon, not a panic button.'
    }
];

export function tipById(id) {
    return TIPS.find((t) => t.id === id) || null;
}

export function tipsForWhere(where) {
    return TIPS.filter((t) => t.where === where);
}

/** True if this tip has not been seen (or alwaysShowDialogue forces replay). */
export function shouldShowTip(id) {
    if (getSetting('alwaysShowDialogue')) return true;
    const p = getProgress();
    const seen = (p && p.hintsSeen) || [];
    return !seen.includes(id);
}

export function markTipSeen(id) {
    markProgressFlag('hintsSeen', id);
}

/**
 * Next unseen tip for a context, or null.
 * @param {'loadout'|'play_L1'} where
 */
export function nextTip(where) {
    for (const t of tipsForWhere(where)) {
        if (shouldShowTip(t.id)) return t;
    }
    return null;
}

/** Skip all onboarding permanently (options / tip dismiss all). */
export function skipAllTips() {
    for (const t of TIPS) markTipSeen(t.id);
    setSetting('tipsDone', true);
}

export function tipsDone() {
    return !!getSetting('tipsDone') || TIPS.every((t) => !shouldShowTip(t.id));
}

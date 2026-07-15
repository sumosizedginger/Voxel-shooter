// src/shmup/systems/modifiers.js
// Purpose: S6 arena modifier stack — named, stackable, removable frame-loop
// modifiers used by the Jester and several boss phases.
// Dependencies: none (import-clean)
//
// NARRATIVE_PLAN §4 S6. Known mods: gravityInvert, controlFlip, weaponShuffle,
// hudLie, screenPush, slowStack.

export const MOD_NAMES = [
    'gravityInvert', 'controlFlip', 'weaponShuffle', 'hudLie', 'screenPush', 'slowStack'
];

export function createModStack() {
    return { items: [], t: 0 };
}

/**
 * @param {object} stack
 * @param {string} name one of MOD_NAMES
 * @param {number} duration seconds
 * @param {object} [data] extra payload
 */
export function pushMod(stack, name, duration, data = null) {
    if (!stack || !MOD_NAMES.includes(name)) return;
    // Refresh duration if already present.
    const existing = stack.items.find((m) => m.name === name);
    if (existing) {
        existing.t = Math.max(existing.t, duration);
        existing.data = data || existing.data;
        return;
    }
    stack.items.push({ name, t: duration, data });
}

export function hasMod(stack, name) {
    return !!(stack && stack.items.some((m) => m.name === name));
}

export function clearMods(stack) {
    if (stack) stack.items.length = 0;
}

/**
 * Tick durations. Returns list of names that just expired.
 */
export function updateMods(stack, dt) {
    if (!stack) return [];
    stack.t += dt;
    const expired = [];
    for (let i = stack.items.length - 1; i >= 0; i--) {
        stack.items[i].t -= dt;
        if (stack.items[i].t <= 0) {
            expired.push(stack.items[i].name);
            stack.items.splice(i, 1);
        }
    }
    return expired;
}

/**
 * Apply control/gravity transforms to a raw input snapshot.
 * Returns { axisX, axisY } possibly flipped/inverted.
 */
export function transformInput(stack, input) {
    let ax = input.axisX || 0;
    let ay = input.axisY || 0;
    if (hasMod(stack, 'controlFlip')) { ax = -ax; ay = -ay; }
    if (hasMod(stack, 'gravityInvert')) { ay = -ay; }
    return { axisX: ax, axisY: ay, fire: input.fire, firePressed: input.firePressed,
        fireReleased: input.fireReleased, fireHeldFor: input.fireHeldFor,
        dock: input.dock, dockPressed: input.dockPressed, dockReleased: input.dockReleased,
        dockDoubleTap: input.dockDoubleTap,
        swap: input.swap, swapPressed: input.swapPressed,
        drone: input.drone, dronePressed: input.dronePressed,
        pause: input.pause, pausePressed: input.pausePressed,
        debug: input.debug, debugPressed: input.debugPressed,
        skip: input.skip, skipPressed: input.skipPressed,
        profanity: input.profanity, profanityPressed: input.profanityPressed };
}

/** screenPush: shove the vessel by a small vector each frame. */
export function screenPushDelta(stack, dt) {
    if (!hasMod(stack, 'screenPush')) return { dx: 0, dy: 0 };
    const m = stack.items.find((x) => x.name === 'screenPush');
    const amp = (m && m.data && m.data.amp) || 1.8;
    return { dx: Math.sin(stack.t * 3.1) * amp * dt, dy: Math.cos(stack.t * 2.4) * amp * 0.6 * dt };
}

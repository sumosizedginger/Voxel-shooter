// src/shmup/loadout.js
// Purpose: pre-mission 2-slot Council loadout — pure helpers + persistence.
// Dependencies: ./drones (COUNCIL, MAX_DRONES), engine/settings
//
// PLAN.md Phase 9A / NARRATIVE_PLAN C4: max 2 of 6 drones, chosen before launch.

import { COUNCIL, DRONE_TYPES, MAX_DRONES } from './council.js';
import { getProgress, setProgress } from '../engine/settings.js';

export const DEFAULT_LOADOUT = ['prophet', 'needle'];

/** Normalize and clamp a candidate loadout to valid unique drone keys. */
export function normalizeLoadout(types) {
    const out = [];
    const seen = new Set();
    const list = Array.isArray(types) ? types : DEFAULT_LOADOUT;
    for (const t of list) {
        const key = String(t || '').toLowerCase();
        if (!COUNCIL[key] || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
        if (out.length >= MAX_DRONES) break;
    }
    // Always fill to two seats with defaults if the player left a slot empty.
    for (const d of DEFAULT_LOADOUT) {
        if (out.length >= MAX_DRONES) break;
        if (!seen.has(d)) {
            seen.add(d);
            out.push(d);
        }
    }
    // Last resort: first two types in table order.
    for (const d of DRONE_TYPES) {
        if (out.length >= MAX_DRONES) break;
        if (!seen.has(d)) {
            seen.add(d);
            out.push(d);
        }
    }
    return out.slice(0, MAX_DRONES);
}

export function loadSavedLoadout() {
    const p = getProgress();
    const raw = (p.rtype && p.rtype.loadout) || p.loadout || null;
    return normalizeLoadout(raw || DEFAULT_LOADOUT);
}

export function saveLoadout(types) {
    const loadout = normalizeLoadout(types);
    const p = getProgress();
    const rtype = Object.assign({ stageReached: 1, checkpoint: 0, loops: 0 }, p.rtype);
    rtype.loadout = loadout;
    setProgress({ rtype, loadout });
    return loadout;
}

/** Toggle a drone into/out of the working selection (max 2). */
export function toggleLoadoutSlot(current, type) {
    const key = String(type || '').toLowerCase();
    if (!COUNCIL[key]) return current.slice();
    const next = current.slice();
    const i = next.indexOf(key);
    if (i >= 0) {
        next.splice(i, 1);
        return next;
    }
    if (next.length < MAX_DRONES) {
        next.push(key);
        return next;
    }
    // Replace the last seat when both are filled.
    next[MAX_DRONES - 1] = key;
    return next;
}

/** Cycle the focused seat through all drone types (menu left/right). */
export function cycleSeat(current, seatIndex, dir) {
    const seats = current.slice();
    while (seats.length < MAX_DRONES) seats.push(DEFAULT_LOADOUT[seats.length] || DRONE_TYPES[0]);
    const order = DRONE_TYPES;
    const cur = seats[seatIndex] || order[0];
    let idx = order.indexOf(cur);
    if (idx < 0) idx = 0;
    // Skip the other seat's type so both slots stay unique.
    for (let n = 0; n < order.length; n++) {
        idx = (idx + dir + order.length) % order.length;
        const candidate = order[idx];
        const other = seats[1 - seatIndex];
        if (candidate !== other) {
            seats[seatIndex] = candidate;
            break;
        }
    }
    return seats.slice(0, MAX_DRONES);
}

export function loadoutLabel(types) {
    return normalizeLoadout(types).map((t) => COUNCIL[t].name).join(' + ');
}

export function droneRosterRows() {
    return DRONE_TYPES.map((id) => {
        const d = COUNCIL[id];
        return { id, name: d.name, desc: d.desc, mode: d.mode, color: d.color, seat: d.seat };
    });
}

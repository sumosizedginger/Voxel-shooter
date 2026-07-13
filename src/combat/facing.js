// src/combat/facing.js
// Purpose: A tiny standalone facing model for the vectorized hitboxCheck.
// Dependencies: none
//
// hitboxCheck (hitbox.js) reads `attacker.state.facingVec` — a unit vector in
// the XZ plane — and falls back to the scalar `facing` (±1 on X) when the vector
// is absent. This helper produces exactly that shape without dragging in a full
// combat state machine, so a new game (belt-scroller, twin-stick, top-down
// adventure) can aim attacks in any direction with a few lines:
//
//   import { makeFacing } from './combat/facing.js';
//   entity.state = makeFacing(1);           // start facing +X
//   entity.state.setFacing(inputX, inputZ); // 8-way aim from a stick / WASD
//   if (hitboxCheck(entity, target, move)) { ... }
//
// For a pure belt-scroller, only ever call setFacing(+1) / setFacing(-1) (or
// assign `.facing`) and the hitbox behaves exactly like the classic X-signed
// cone. Feed a real Z component and the cone turns with it.

/**
 * Create a facing state. `facing` is the ±1 X-sign kept in sync for any legacy
 * code that still reads it (knockback pushes, sprite flips); `facingVec` is the
 * true unit direction the hitbox cone follows.
 */
export function makeFacing(initialX = 1) {
    const state = {
        _facingX: Math.sign(initialX) || 1,
        facingVec: { x: Math.sign(initialX) || 1, z: 0 },
        /**
         * Aim at an arbitrary XZ direction. Zero-length input is ignored so a
         * standing entity keeps its last facing. Unnormalized input is fine.
         */
        setFacing(x, z = 0) {
            const len = Math.hypot(x, z);
            if (len < 1e-6) return;
            this.facingVec.x = x / len;
            this.facingVec.z = z / len;
            this._facingX = Math.sign(x) || this._facingX;
        },
        /** Snap to 8 compass directions (handy for retro top-down feel). */
        setFacing8(x, z) {
            if (x === 0 && z === 0) return;
            this.setFacing(Math.sign(x), Math.sign(z));
        },
    };
    Object.defineProperty(state, 'facing', {
        get() { return this._facingX; },
        set(v) {
            const sx = Math.sign(v) || 1;
            this._facingX = sx;
            this.facingVec.x = sx;
            this.facingVec.z = 0;
        },
        enumerable: true,
        configurable: true,
    });
    return state;
}

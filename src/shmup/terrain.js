// src/shmup/terrain.js
// Purpose: terrain collision in the XY play plane.
// Dependencies: engine/collision.js (used as-is — NOT modified)
//
// PLAN.md §2.3. engine/collision.js is plain {x, z} math with zero three.js in
// it, written for a brawler's ground plane. A side-scroller's play plane is XY.
// Rather than fork it, relabel one axis: our Y is its Z. That's the whole trick,
// and it means the engine's collision spec keeps covering our collision math.
//
// The rules it enforces (PLAN.md §2.3):
//   player  vs terrain = DEATH   (blocked() — an overlap test, never a slide)
//   Witness vs terrain = SLIDE   (resolveMove() — it grinds along walls)
//   bullets vs terrain = DESPAWN (blocked())

import { CollisionWorld } from '../engine/collision.js';

export class Terrain {
    constructor() {
        this.cw = new CollisionWorld();
        this.boxes = [];          // kept for the debug wireframe overlay
    }

    /**
     * @param {{minX,maxX,minY,maxY,id?}} box world units
     * @returns {number|string} the id (generated if not supplied)
     */
    addBox({ minX, maxX, minY, maxY, id }) {
        const realId = this.cw.addSolid({ minX, maxX, minZ: minY, maxZ: maxY, id });
        this.boxes.push({ id: realId, minX, maxX, minY, maxY });
        return realId;
    }

    removeBox(id) {
        this.cw.removeSolid(id);
        const i = this.boxes.findIndex((b) => b.id === id);
        if (i >= 0) this.boxes.splice(i, 1);
    }

    clear() {
        this.cw.clear();
        this.boxes.length = 0;
    }

    /** True if a square of half-extent `half` centered at (x,y) is in solid rock. */
    blocked(x, y, half = 0.3) {
        return this.cw.blocked(x, y, half);
    }

    /** Slide from (px,py) toward (nx,ny), pushed out of anything solid. */
    resolveMove(px, py, nx, ny, half = 0.3) {
        const r = this.cw.resolveMove(px, py, nx, ny, half);
        return { x: r.x, y: r.z };
    }

    /** Drop boxes that have scrolled far behind — the level never comes back. */
    cullBehind(x) {
        for (let i = this.boxes.length - 1; i >= 0; i--) {
            if (this.boxes[i].maxX < x) this.removeBox(this.boxes[i].id);
        }
    }
}

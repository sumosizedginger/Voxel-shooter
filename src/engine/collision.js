// src/engine/collision.js
// Purpose: Genre-neutral AABB collision on the XZ ground plane.
// Dependencies: none (operates on plain {x,z} — no THREE, fully portable).
//
// Beat-em-ups, top-down adventures and twin-stick games all live on a flat
// ground plane, so solids are axis-aligned boxes in XZ and entities are treated
// as squares of half-extent `half`. Movement is resolved axis-separated (X then
// Z), the standard cheap sweep that avoids corner tunnelling for per-frame
// steps. The world starts empty: with no solids registered every resolveMove is
// a pass-through, so wiring it in changes nothing until a level adds geometry.

export class CollisionWorld {
    constructor() {
        this.solids = [];
        this._nextId = 1;
    }

    clear() {
        this.solids.length = 0;
    }

    /**
     * Register a static solid. Box is {minX,maxX,minZ,maxZ}, plus an optional
     * caller `id` (e.g. a destructible's id, so it can be removed when broken).
     * Returns the id.
     */
    addSolid(box) {
        const id = box.id != null ? box.id : this._nextId++;
        this.solids.push({
            id,
            minX: box.minX, maxX: box.maxX,
            minZ: box.minZ, maxZ: box.maxZ,
        });
        return id;
    }

    removeSolid(id) {
        const i = this.solids.findIndex((s) => s.id === id);
        if (i >= 0) this.solids.splice(i, 1);
    }

    _overlap(x, z, half, s) {
        return x + half > s.minX && x - half < s.maxX
            && z + half > s.minZ && z - half < s.maxZ;
    }

    /** True if a square of half-extent `half` centred at (x,z) hits any solid. */
    blocked(x, z, half = 0.4) {
        for (const s of this.solids) if (this._overlap(x, z, half, s)) return true;
        return false;
    }

    /**
     * Slide a mover of half-extent `half` from (px,pz) toward (nx,nz), pushing it
     * back out of any solid it would enter. Axis-separated so it slides along
     * walls instead of sticking, and swept on each axis so a single fast step
     * can't tunnel clean through a thin wall. Returns the corrected {x,z}.
     */
    resolveMove(px, pz, nx, nz, half = 0.4) {
        if (this.solids.length === 0) return { x: nx, z: nz };

        // Resolve X against the solids while holding the old Z lane.
        let x = nx;
        for (const s of this.solids) {
            const zOverlap = pz + half > s.minZ && pz - half < s.maxZ;
            if (!zOverlap) continue;
            if (nx > px && px + half <= s.minX && x + half > s.minX) {
                x = Math.min(x, s.minX - half);                // crossed the left face
            } else if (nx < px && px - half >= s.maxX && x - half < s.maxX) {
                x = Math.max(x, s.maxX + half);                // crossed the right face
            } else if (this._overlap(x, pz, half, s)) {
                // Started already touching on X; resolve to the nearer face.
                if (px + half <= s.minX) x = s.minX - half;
                else if (px - half >= s.maxX) x = s.maxX + half;
            }
        }

        // Resolve Z with the corrected X.
        let z = nz;
        for (const s of this.solids) {
            const xOverlap = x + half > s.minX && x - half < s.maxX;
            if (!xOverlap) continue;
            if (nz > pz && pz + half <= s.minZ && z + half > s.minZ) {
                z = Math.min(z, s.minZ - half);                // crossed the front face
            } else if (nz < pz && pz - half >= s.maxZ && z - half < s.maxZ) {
                z = Math.max(z, s.maxZ + half);                // crossed the back face
            } else if (this._overlap(x, z, half, s)) {
                if (pz + half <= s.minZ) z = s.minZ - half;
                else if (pz - half >= s.maxZ) z = s.maxZ + half;
            }
        }

        return { x, z };
    }
}

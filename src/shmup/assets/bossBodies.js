// src/shmup/assets/bossBodies.js
// Purpose: bespoke voxel body maps for bosses 02–10.
// Dependencies: voxel/helpers, voxel/core — THREE-free.
//
// Squint rule (ASSETS_PLAN): shape before color. Each boss must read as a
// different silhouette at gameplay zoom against a dark void. Camera is side-on
// (XY), bosses sit on the right facing the player (−X). Core weakpoint meshes
// are separate (generic.js); these maps are the mass the core sits on.
//
// Bible identity (story-bible.html):
//   02 parrot  — mirror bird; copies, does not invent
//   03 jester  — three faces / crown / entropy pump unbound
//   04 suit    — man at a desk; weakpoint is the tie
//   05 mirror  — broken-mirror Vessel / denial shard array
//   06 sun     — pastel redemption disc; scar at core
//   07 forge   — blacksmith + anvil + molten stacks
//   08 drift   — faceless symmetric wreck; empty seal hole
//   09 shadow  — twin Vessel silhouette (the witness that watches)
//   10 seal    — corrupted √π / ∞ / τ² ring

import { fillEllipsoid, fillBox, paint } from '../../voxel/helpers.js';
import { hash3 } from '../../voxel/core.js';

/** Surface noise — shell highlights + bodyDark pits. Never invents voxels. */
function noise(m, pal) {
    paint(m, (x, y, z, c) => {
        if (c === pal.shell) return null;
        const h = hash3(x, y, z);
        if (h > 0.9) return pal.shell;
        if (h < 0.07) return pal.bodyDark;
        return null;
    });
    return m;
}

/** Panel lines on boxy masses (suit / forge). */
function panelLines(m, pal, period = 3) {
    paint(m, (x, y, z, c) => {
        if (c !== pal.body) return null;
        if (((x % period) + period) % period === 0) return pal.bodyDark;
        if (((y % period) + period) % period === 0) return pal.bodyDark;
        return null;
    });
    return m;
}

// ── fallback ──────────────────────────────────────────────────────────────
export function bodyDefault(pal) {
    const m = new Map();
    fillEllipsoid(m, 0, 0, 0, 9, 11, 5, pal.body);
    fillEllipsoid(m, 2, 0, 0, 6, 8, 4, pal.bodyDark);
    fillBox(m, -9, 2, -2, 2, -4, 4, pal.shell);
    return noise(m, pal);
}

// ── L2 Induction Parrot — "a parrot made of mirrors" ─────────────────────
// Silhouette: long beak (−X toward player), round body, swept wings, crest.
// Eye socket on the face (where the open-eye core sits in play).
export function bodyParrot(pal) {
    const m = new Map();
    // Body mass
    fillEllipsoid(m, 2, 0, 0, 7, 6, 5, pal.body);
    fillEllipsoid(m, 3, 1, 0, 5, 4, 4, pal.bodyDark);
    // Head
    fillEllipsoid(m, -5, 2, 0, 4, 4, 3.5, pal.body);
    // Mirror-facet eye ring (reads as glass plates)
    fillEllipsoid(m, -7, 3, 0, 2, 2, 2, pal.shell);
    fillEllipsoid(m, -7, 3, 0, 1, 1, 1, pal.bodyDark);
    // Beak: stepped wedge pointing at the player
    fillBox(m, -14, -8, 0, 3, -2, 2, pal.shell);
    fillBox(m, -16, -13, 1, 2, -1, 1, pal.bodyDark);
    fillBox(m, -12, -9, -1, 0, -1, 1, pal.bodyDark); // lower mandible
    // Crest / comb
    for (let i = 0; i < 5; i++) {
        fillBox(m, -4 + i, -3 + i, 6 + i, 8 + i, -1, 1, pal.shell);
    }
    // Wings — upper and lower plates that "copy"
    fillBox(m, -1, 8, 5, 10, -4, 4, pal.body);
    fillBox(m, 0, 7, 6, 9, -3, 3, pal.shell);
    fillBox(m, -1, 8, -10, -5, -4, 4, pal.body);
    fillBox(m, 0, 7, -9, -6, -3, 3, pal.shell);
    // Tail fan
    fillBox(m, 8, 13, -2, 2, -1, 1, pal.bodyDark);
    fillBox(m, 10, 14, -4, -2, 0, 0, pal.shell);
    fillBox(m, 10, 14, 2, 4, 0, 0, pal.shell);
    // Mirror strip along the belly (copy accelerator identity)
    fillBox(m, -2, 6, -3, -2, -5, 5, pal.shell);
    return noise(m, pal);
}

// ── L3 Jester Unbound — three faces / crown / bells ───────────────────────
// Silhouette: tall vertical harlequin, pointed hat, wide collar, dual bells.
// Faces stacked on the torso (laugh / weep / whisper as layered masks).
export function bodyJester(pal) {
    const m = new Map();
    // Torso column
    fillEllipsoid(m, 1, 0, 0, 6, 9, 4, pal.body);
    fillBox(m, -3, 5, -6, 6, -3, 3, pal.body);
    // Diamond harlequin panels
    for (let y = -5; y <= 5; y += 3) {
        fillBox(m, -1, 3, y, y + 1, 3, 4, pal.shell);
        fillBox(m, -1, 3, y, y + 1, -4, -3, pal.bodyDark);
    }
    // Three stacked face masks facing the player (−X)
    // Laughing (top)
    fillEllipsoid(m, -5, 5, 0, 3, 2.5, 3, pal.shell);
    fillBox(m, -7, -5, 4, 5, -2, 2, pal.bodyDark); // grin gap
    // Weeping (mid)
    fillEllipsoid(m, -5, 0, 0, 3, 2.5, 3, pal.body);
    fillBox(m, -6, -4, -2, 1, -1, 1, pal.bodyDark); // tear track
    // Whispering (low)
    fillEllipsoid(m, -5, -5, 0, 3, 2.2, 2.5, pal.bodyDark);
    fillBox(m, -7, -5, -5, -4, 0, 0, pal.shell); // small mouth
    // Pointed crown / hat
    fillBox(m, -1, 3, 8, 14, -1, 1, pal.shell);
    fillBox(m, 0, 2, 14, 17, 0, 0, pal.shell);
    for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        fillBox(m, i * 2, i * 2 + 1, 10, 13 + Math.abs(i), -1, 1, pal.bodyDark);
    }
    // Ruff collar
    fillEllipsoid(m, 0, 7, 0, 7, 2, 5, pal.shell);
    // Arms with bells
    fillBox(m, -2, 4, 2, 4, 5, 8, pal.body);
    fillBox(m, -2, 4, 2, 4, -8, -5, pal.body);
    fillEllipsoid(m, 0, -2, 7, 2.5, 2.5, 2.5, pal.shell);
    fillEllipsoid(m, 0, -2, -7, 2.5, 2.5, 2.5, pal.shell);
    // Skirt / motley hem
    fillBox(m, -2, 6, -11, -7, -5, 5, pal.bodyDark);
    fillBox(m, 0, 5, -12, -10, -3, 3, pal.shell);
    return noise(m, pal);
}

// ── L4 Smooth Operator — "a man in a suit at a desk" ──────────────────────
// Silhouette: seated figure + desk slab. The TIE is a distinct shell slash
// (bible: weakpoint = the only non-beige thing he bought himself).
export function bodySuit(pal) {
    const m = new Map();
    // Desk (wide slab, front toward player)
    fillBox(m, -10, 4, -8, -4, -7, 7, pal.bodyDark);
    fillBox(m, -10, 3, -7, -5, -6, 6, pal.body);
    // Desk legs
    fillBox(m, -9, -7, -12, -8, -6, -4, pal.bodyDark);
    fillBox(m, -9, -7, -12, -8, 4, 6, pal.bodyDark);
    fillBox(m, 1, 3, -12, -8, -6, -4, pal.bodyDark);
    fillBox(m, 1, 3, -12, -8, 4, 6, pal.bodyDark);
    // Seated torso behind desk
    fillBox(m, -2, 6, -3, 7, -4, 4, pal.body);
    fillBox(m, -1, 5, -2, 6, -3, 3, pal.bodyDark);
    // Shoulders
    fillBox(m, -3, 3, 4, 7, -8, -4, pal.body);
    fillBox(m, -3, 3, 4, 7, 4, 8, pal.body);
    // Lapels
    fillBox(m, -3, 0, 0, 5, -4, -2, pal.shell);
    fillBox(m, -3, 0, 0, 5, 2, 4, pal.shell);
    // THE TIE — only non-beige / high-contrast slash (weakpoint marker)
    fillBox(m, -4, -1, -2, 5, -1, 1, pal.shell);
    fillBox(m, -3, 0, -1, 3, 0, 0, pal.bodyDark);
    // Collar + head
    fillBox(m, -2, 2, 6, 9, -3, 3, pal.shell);
    fillEllipsoid(m, 0, 11, 0, 3.5, 3.5, 3, pal.body);
    // Smile that has too many teeth
    fillBox(m, -3, -2, 10, 11, -2, 2, pal.shell);
    for (let z = -2; z <= 2; z++) {
        fillBox(m, -3, -2, 10, 10, z, z, pal.bodyDark);
    }
    // Arms on desk
    fillBox(m, -8, 0, -4, -2, -7, -4, pal.body);
    fillBox(m, -8, 0, -4, -2, 4, 7, pal.body);
    // Laptop / stack of slides on desk
    fillBox(m, -7, -3, -4, -2, -2, 2, pal.shell);
    fillBox(m, -6, -4, -2, 0, -1, 1, pal.bodyDark);
    return panelLines(noise(m, pal), pal, 4);
}

// ── L5 Mirror Break — broken-mirror Vessel / denial ───────────────────────
// Silhouette: Vessel-like fighter facing the player, cracked into shards with
// a vertical fracture plane. Same "long needle" language as the player ship
// but mirrored (nose −X) and shattered.
export function bodyMirror(pal) {
    const m = new Map();
    // Main hull (mirrors the Vessel: long low body, nose toward player)
    fillBox(m, -8, 6, -1, 2, -3, 3, pal.body);
    fillBox(m, -10, -6, 0, 1, -2, 2, pal.shell);       // needle nose (−X)
    fillBox(m, -4, 4, -2, -1, -2, 2, pal.bodyDark);    // belly
    // Canopy bump
    fillEllipsoid(m, -2, 3, 0, 3, 2, 2, pal.shell);
    // Wings (wider, shard-like)
    fillBox(m, -2, 5, 0, 0, -8, 8, pal.body);
    fillBox(m, 0, 4, 0, 0, -9, -7, pal.shell);
    fillBox(m, 0, 4, 0, 0, 7, 9, pal.shell);
    // Tail
    fillBox(m, 5, 9, 0, 3, -1, 1, pal.bodyDark);
    fillBox(m, 7, 10, 2, 4, 0, 0, pal.shell);
    // Engine "ghost" — cool, not copper (denial of warmth)
    fillBox(m, 8, 10, 0, 1, -2, 2, pal.shell);
    // Vertical fracture plane through the hull
    for (let y = -3; y <= 4; y++) {
        const ox = Math.round(Math.sin(y * 0.7) * 2);
        fillBox(m, ox - 1, ox, y, y, -4, 4, pal.bodyDark);
        // Pull some hull voxels into free-floating shards near the crack
        if ((y % 2) === 0) {
            fillBox(m, ox - 4, ox - 3, y + 1, y + 2, 4, 6, pal.shell);
            fillBox(m, ox + 2, ox + 3, y - 1, y, -6, -4, pal.shell);
        }
    }
    // Orbiting shard ring (broken glass field)
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * 11);
        const y = Math.round(Math.sin(a) * 8);
        fillBox(m, x, x + 1, y, y + 1, -1, 1, pal.shell);
    }
    // Denial face plate where the canopy would be honest
    fillBox(m, -5, -1, 2, 4, -2, 2, pal.bodyDark);
    return noise(m, pal);
}

// ── L6 Redemption Arc — "a sentient sun" ──────────────────────────────────
// Silhouette: large disc + long rays + darker scar core (the only honest part).
export function bodySun(pal) {
    const m = new Map();
    // Outer corona
    fillEllipsoid(m, 0, 0, 0, 12, 12, 5, pal.body);
    // Mid shell (brighter "pretty" band)
    fillEllipsoid(m, 0, 0, 0, 8, 8, 4, pal.shell);
    // Inner mass
    fillEllipsoid(m, 0, 0, 0, 5, 5, 3, pal.body);
    // THE SCAR — irregular dark cleft through the core (shoot here)
    fillBox(m, -2, 1, -4, 4, -1, 1, pal.bodyDark);
    fillBox(m, -1, 0, -5, 5, 0, 0, pal.bodyDark);
    fillEllipsoid(m, -1, 0, 0, 2, 2, 2, pal.bodyDark);
    // Rays — long spikes for an unmistakable sun silhouette
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const len = (i % 2 === 0) ? 16 : 13;
        const x0 = Math.round(Math.cos(a) * 10);
        const y0 = Math.round(Math.sin(a) * 10);
        const x1 = Math.round(Math.cos(a) * len);
        const y1 = Math.round(Math.sin(a) * len);
        // Thick ray stem
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x = Math.round(x0 + (x1 - x0) * t);
            const y = Math.round(y0 + (y1 - y0) * t);
            fillBox(m, x - 1, x + 1, y - 1, y + 1, -1, 1, (i % 3 === 0) ? pal.shell : pal.body);
        }
    }
    // Soft "heart" ornaments on four diagonals
    for (const [hx, hy] of [[8, 8], [8, -8], [-8, 8], [-8, -8]]) {
        fillEllipsoid(m, hx, hy, 0, 2, 2, 1, pal.shell);
    }
    return noise(m, pal);
}

// ── L7 Forge Wraith — blacksmith + anvil + furnace ────────────────────────
// Silhouette: wide forge base, dual chimneys, raised hammer arm, anvil nose (−X).
export function bodyForge(pal) {
    const m = new Map();
    // Forge block / furnace body
    fillBox(m, -4, 10, -6, 6, -5, 5, pal.body);
    fillBox(m, -2, 8, -4, 4, -4, 4, pal.bodyDark);
    // Ember mouth (front, toward player)
    fillBox(m, -6, -3, -2, 2, -3, 3, pal.bodyDark);
    fillBox(m, -7, -5, -1, 1, -2, 2, pal.shell); // molten glow band (shell = orange)
    // Grate bars across the mouth
    for (let y = -2; y <= 2; y += 2) {
        fillBox(m, -6, -3, y, y, -3, 3, pal.body);
    }
    // Chimney stacks
    fillBox(m, 2, 5, 5, 14, -3, -1, pal.bodyDark);
    fillBox(m, 2, 5, 5, 13, 1, 3, pal.bodyDark);
    fillBox(m, 1, 6, 13, 15, -3, -1, pal.shell);
    fillBox(m, 1, 6, 12, 14, 1, 3, pal.shell);
    // Smoke puffs (voxel nubs)
    fillEllipsoid(m, 3, 16, -2, 2, 2, 2, pal.bodyDark);
    fillEllipsoid(m, 4, 15, 2, 2, 1.5, 2, pal.bodyDark);
    // Anvil — the weakpoint mass, proud of the front
    fillBox(m, -12, -6, -3, 0, -3, 3, pal.shell);
    fillBox(m, -14, -10, -2, -1, -2, 2, pal.shell); // horn toward player
    fillBox(m, -10, -7, -4, -3, -2, 2, pal.bodyDark); // base
    // Hammer arm raised
    fillBox(m, 0, 6, 4, 6, 4, 6, pal.body);
    fillBox(m, 4, 6, 6, 11, 4, 6, pal.bodyDark);
    // Hammer head
    fillBox(m, 2, 8, 11, 14, 3, 7, pal.shell);
    fillBox(m, 3, 7, 12, 13, 2, 8, pal.bodyDark);
    // Secondary arm bracing the anvil
    fillBox(m, -4, 2, -1, 1, -7, -5, pal.body);
    // Side bellows
    fillEllipsoid(m, 4, 0, 7, 3, 4, 2, pal.bodyDark);
    fillEllipsoid(m, 4, 0, -7, 3, 4, 2, pal.bodyDark);
    // Floor plate / slag
    fillBox(m, -8, 10, -8, -6, -6, 6, pal.bodyDark);
    return panelLines(noise(m, pal), pal, 3);
}

// ── L8 Drift Wraith — faceless symmetric wreck, empty seal hole ───────────
// Silhouette: cross of bone spars + hollow torso with a missing center seal.
// Perfect bilateral symmetry is the point (the boss is dead voice architecture).
export function bodyDrift(pal) {
    const m = new Map();
    // Hollow ribcage torso (shell of a person, no face)
    fillEllipsoid(m, 0, 0, 0, 7, 9, 4, pal.body);
    // Carve a cavity by overpainting a dark "void" core — then a true hole
    // is represented as bodyDark empty-looking interior
    fillEllipsoid(m, 0, 0, 0, 4, 6, 2, pal.bodyDark);
    // THE MISSING SEAL — open cross void at center (weakpoint absence)
    for (const k of [...m.keys()]) {
        const [x, y, z] = k.split(',').map(Number);
        if (x * x + y * y <= 6 && Math.abs(z) <= 1) m.delete(k);
    }
    // Seal socket ring around the hole
    for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * 3.5);
        const y = Math.round(Math.sin(ang) * 3.5);
        fillBox(m, x, x, y, y, -1, 1, pal.shell);
    }
    // Horizontal bone spar (symmetric)
    fillBox(m, -14, 14, -1, 1, -1, 1, pal.shell);
    fillBox(m, -14, -12, -2, 2, -2, 2, pal.body);
    fillBox(m, 12, 14, -2, 2, -2, 2, pal.body);
    // Vertical spar
    fillBox(m, -1, 1, -14, 14, -1, 1, pal.shell);
    fillBox(m, -2, 2, -14, -12, -2, 2, pal.body);
    fillBox(m, -2, 2, 12, 14, -2, 2, pal.body);
    // Faceless "head" plate — smooth, no features
    fillBox(m, -3, 3, 8, 13, -3, 3, pal.body);
    fillBox(m, -2, 2, 9, 12, -2, 2, pal.shell);
    // No mouth, no eyes — blank face
    fillBox(m, -4, -3, 10, 11, -1, 1, pal.bodyDark);
    // Floating symmetric paragraph blocks (dead architecture)
    for (const [sx, sy] of [[-8, 6], [8, 6], [-8, -6], [8, -6], [-10, 0], [10, 0]]) {
        fillBox(m, sx - 2, sx + 2, sy - 1, sy + 1, -1, 1, pal.bodyDark);
        fillBox(m, sx - 1, sx + 1, sy, sy, 0, 0, pal.shell);
    }
    // Draped empty cloak
    fillBox(m, -5, 5, -12, -8, -4, 4, pal.body);
    fillBox(m, -4, 4, -13, -11, -3, 3, pal.bodyDark);
    return noise(m, pal);
}

// ── L9 Witness's Shadow — twin Vessel + watching orb ──────────────────────
// Silhouette: dark Vessel facing the player (nose −X) with a violet-band
// Witness twin docked, and a larger "eye" mass behind the eyes.
export function bodyShadow(pal) {
    const m = new Map();
    // Primary: Vessel echo (nose toward player, dark)
    fillBox(m, -6, 5, -1, 2, -2, 2, pal.body);
    fillBox(m, -9, -5, 0, 1, -1, 1, pal.shell);          // needle
    fillBox(m, -3, 3, 0, 0, -5, 5, pal.bodyDark);        // wings
    fillBox(m, 3, 6, 2, 3, 0, 0, pal.body);              // fin
    fillEllipsoid(m, -1, 3, 0, 2.5, 1.5, 1.5, pal.shell); // canopy
    // Scar seams (shell) — same language as GUMOI's kintsugi
    fillBox(m, -4, 2, 1, 1, 2, 2, pal.shell);
    fillBox(m, -4, 2, 1, 1, -2, -2, pal.shell);
    // Docked Witness twin (orb on the nose)
    fillEllipsoid(m, -11, 0, 0, 3.5, 3.5, 3.5, pal.bodyDark);
    fillEllipsoid(m, -11, 0, 0, 2, 2, 2, pal.shell);
    fillBox(m, -13, -9, -1, 1, -3, 3, pal.body); // equatorial band
    // "Thing behind the eyes" — larger shadow mass offset rear/up
    fillEllipsoid(m, 6, 4, 1, 6, 7, 4, pal.bodyDark);
    fillEllipsoid(m, 6, 4, 1, 3, 4, 2, pal.shell);
    // Linking tendril (ship ↔ shadow)
    fillBox(m, 2, 6, 1, 3, 0, 1, pal.shell);
    fillBox(m, 4, 7, 2, 4, 0, 0, pal.body);
    // Watching iris slits
    fillEllipsoid(m, 5, 5, 2, 2, 2, 1, pal.shell);
    fillEllipsoid(m, 5, 5, 2, 1, 1, 1, pal.bodyDark);
    // Drip / shadow skirt
    fillBox(m, -2, 8, -6, -3, -2, 2, pal.bodyDark);
    for (let i = 0; i < 5; i++) {
        fillBox(m, -1 + i * 2, 0 + i * 2, -8 - (i % 3), -6, 0, 0, pal.bodyDark);
    }
    return noise(m, pal);
}

// ── L10 Corrupted Seal — √π / ∞ / τ² ring ─────────────────────────────────
// Silhouette: thick annular seal with glyph core, corrupted spikes, broken arc.
export function bodySeal(pal) {
    const m = new Map();
    // Outer ring
    for (let a = 0; a < 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * 12);
        const y = Math.round(Math.sin(ang) * 12);
        fillBox(m, x - 2, x + 2, y - 2, y + 2, -3, 3, pal.body);
        // Broken segment (corruption missing a bite)
        if (a >= 6 && a <= 9) {
            // skip some fills by not adding mid ring — handled below
        }
    }
    // Carve the broken arc (remove a sector)
    for (const k of [...m.keys()]) {
        const [x, y] = k.split(',').map(Number);
        const ang = Math.atan2(y, x);
        if (ang > 0.3 && ang < 0.9 && x * x + y * y > 80) m.delete(k);
    }
    // Mid ring
    for (let a = 0; a < 36; a++) {
        const ang = (a / 36) * Math.PI * 2;
        if (ang > 0.35 && ang < 0.85) continue; // same wound
        const x = Math.round(Math.cos(ang) * 8);
        const y = Math.round(Math.sin(ang) * 8);
        fillBox(m, x - 1, x + 1, y - 1, y + 1, -2, 2, pal.shell);
    }
    // Inner disc / glyph core
    fillEllipsoid(m, 0, 0, 0, 5, 5, 3, pal.bodyDark);
    // Glyph strokes — rough √π / ∞ / τ marks as readable geometry
    // Horizontal bar + descending leg (π-ish)
    fillBox(m, -4, 4, 2, 3, -1, 1, pal.shell);
    fillBox(m, -3, -2, -3, 3, 0, 0, pal.shell);
    fillBox(m, 2, 3, -3, 3, 0, 0, pal.shell);
    // Infinity loops
    fillEllipsoid(m, -3, -1, 0, 2.5, 1.8, 1, pal.shell);
    fillEllipsoid(m, 3, -1, 0, 2.5, 1.8, 1, pal.shell);
    // Tau crossbar
    fillBox(m, -2, 2, 0, 0, -1, 1, pal.shell);
    fillBox(m, 0, 0, -3, 1, 0, 0, pal.shell);
    // Corrupted spikes outward
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.2;
        if (a > 0.35 && a < 0.85) continue;
        const x0 = Math.round(Math.cos(a) * 13);
        const y0 = Math.round(Math.sin(a) * 13);
        const x1 = Math.round(Math.cos(a) * 17);
        const y1 = Math.round(Math.sin(a) * 17);
        fillBox(m,
            Math.min(x0, x1), Math.max(x0, x1),
            Math.min(y0, y1), Math.max(y0, y1),
            -1, 1, (i % 2) ? pal.shell : pal.bodyDark);
    }
    // Corruption tendrils from the wound
    fillBox(m, 6, 14, 4, 6, -1, 1, pal.bodyDark);
    fillBox(m, 8, 12, 5, 9, 0, 0, pal.body);
    fillEllipsoid(m, 13, 7, 0, 2, 2, 2, pal.bodyDark);
    // Outer notches (mechanical seal teeth)
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        if (a > 0.3 && a < 0.95) continue;
        const x = Math.round(Math.cos(a) * 14);
        const y = Math.round(Math.sin(a) * 14);
        fillBox(m, x - 1, x + 1, y - 1, y + 1, -2, 2, pal.shell);
    }
    return noise(m, pal);
}

export const BOSS_BODY_BUILDERS = {
    default: bodyDefault,
    parrot: bodyParrot,
    jester: bodyJester,
    suit: bodySuit,
    mirror: bodyMirror,
    sun: bodySun,
    forge: bodyForge,
    drift: bodyDrift,
    shadow: bodyShadow,
    seal: bodySeal
};

export function buildBossBody(shape, pal) {
    const fn = BOSS_BODY_BUILDERS[shape] || BOSS_BODY_BUILDERS.default;
    return fn(pal);
}

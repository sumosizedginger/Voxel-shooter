// src/context.js
// Shared game context (the live gameWorld singleton). This module intentionally
// has NO imports, so any module can import it without creating an import cycle.
// game.js populates it; combat/character/world modules read it via `world`
// instead of reaching through the `window.gameWorld` global. That makes the
// dependency explicit in each file's import list and mockable in tests.
export const world = {};

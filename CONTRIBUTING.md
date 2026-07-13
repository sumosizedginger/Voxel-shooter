# Contributing

## Philosophy

This kit is a **copy-and-hack starting point, not a framework**. Three rules
that keep it that way:

- **Zero build step.** Native ES modules only — no bundler, no transpiler, no
  framework. `three` is vendored under `lib/three/` so the kit runs fully
  offline.
- **Small surface.** Prefer a few excellent, honest examples over many
  shallow ones. Prefer hand-written docs ([docs/API.md](docs/API.md)) over
  generated ones.
- **Genre-neutral core, genre-specific everything else.** `engine/`,
  `voxel/`, `combat/`, and `characters/` should work for a belt-scroller, a
  top-down adventure, or a shmup equally. If a change only makes sense for
  one genre, it belongs in a consumer's own code, not here.

## Running tests

```
npm i
npm test           # full suite: unit specs + browser smoke test (needs Chrome)
npm run test:unit  # unit specs only, <1s, no Chrome required
```

Set `CHROME_PATH` if `tests/harness.mjs`'s `findChrome()` doesn't locate your
browser automatically.

## Code style

Match the neighbors: 4-space indent, LF line endings, no semicolon-free
style debates — just follow whatever the file you're editing already does.
`.editorconfig` enforces the mechanical parts. Doc comments (`/** ... */`)
on exported functions follow the existing terse, gotcha-focused style — state
the non-obvious constraint, skip restating the parameter names the signature
already shows.

## Pull requests

- One logical change per PR; keep the diff reviewable.
- Run `npm test` locally before opening — CI runs the same suite.
- If you touch a public export's behavior, update
  [docs/API.md](docs/API.md) and `CHANGELOG.md` in the same PR.
- New genre-neutral capability → add or extend an example
  (`examples/*.html`) proving it, the same way `topdown-8way.html` and
  `voxel-showcase.html` do today.

# Contributing

Thanks for helping. g2-kit is small on purpose: zero runtime dependencies, pure-TS rendering, one SDK touch
point (`src/bridge/sdk.ts`).

## Setup

```bash
npm install
npm test            # unit + golden + snapshot tests (Node, no device)
npm run typecheck
npm run gallery     # renders every component to examples/output/
```

With the simulator installed (it is a devDependency):

```bash
npm run sim:check -- hub-dashboard   # drives the example, saves screenshots to examples/output/sim/
```

## Adding a component

1. Write it with `defineComponent<Props>('Name', recommendedSize, (fb, rect, props, theme) => …)` and export
   `Name`, `renderName` and `NameProps` from the package's `index.ts`.
2. Take every level from `theme.levels`, never a number. Give every distinction a shape difference too
   (see DESIGN.md).
3. Stay inside `rect` (drawing is clipped, but layout should not rely on it) and keep render time well under
   10 ms per 288×144 tile (`npm run bench`).
4. Add a sample to `examples/gallery/samples.ts`. The test suite then smoke-tests it (non-empty, deterministic,
   never draws outside its rect) and records a PNG snapshot.
5. Look at it: `npm run gallery` and open `examples/output/contact-sheet.png`. If you can't read it at a
   glance at 1:1, it isn't done.

## Platform facts

If you learn something about the platform (an event shape, a limit, hardware behaviour), add it to INPUT.md
or DESIGN.md with its source: SDK types, docs, simulator version, or real glasses. Never mark something as
verified on hardware unless it was.

## Pull requests

- Keep changes focused; update snapshots only for intended visual changes (`npx vitest run -u`).
- Update CHANGELOG.md under an "Unreleased" heading.

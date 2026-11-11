# Silicon Run

`index.html` loads `js/silicon-run.js`, a small sequential loader for the classic-script runtime. The loader preserves the shared global lexical scope and source order used by the game. Make runtime changes in the feature file that owns the behavior:

- `js/silicon-run-core.js` defines shared state, cleanroom rendering, XR interaction, machine controls, process flow, menus, and the main loop.
- `js/parallel-wafer-runtime.js` adds parallel wafer populations, concurrent processing, wafer pickup, and shard physics.
- `js/design-workstation-runtime.js` implements the regression, circuit-repair, and two-layer layout challenges.
- `js/design-world-runtime.js` provides the 3D design environment, world controls, and later XR, pause, and release integrations.
- `js/silicon-run-startup.js` connects the photoresist station and initializes the runtime.

Keep the loader's file order in sync with runtime dependencies. The subunits are loaded sequentially as classic scripts; do not convert them individually to modules without also changing their shared state and cross-file bindings.

`js/photoresist-chamber.js` is the shared Three.js chamber component used by the in-game spin-coater and the standalone station page. It owns chamber rendering and local particle simulation; the game runtime supplies the wafer-stage and process bridge.

`js/circuit-symbols.js` contains shared schematic drawing helpers, with focused tests in `tests/circuit-symbols.test.js`. The older files `js/base.js`, `js/parallel-wafers.js`, `js/design-workstation.js`, and `js/bootstrap.js` are unreconciled source fragments; they are not part of the shipped runtime and must not be used to regenerate its feature files.

Run the following checks before release:

```sh
node --check js/photoresist-chamber.js
node --check js/silicon-run.js
node --check js/silicon-run-core.js
node --check js/parallel-wafer-runtime.js
node --check js/design-workstation-runtime.js
node --check js/design-world-runtime.js
node --check js/silicon-run-startup.js
node --test tests/*.test.js
```

GitHub Pages runs the same syntax and test checks before deployment. The service worker precaches the loader and every runtime subunit for offline startup.

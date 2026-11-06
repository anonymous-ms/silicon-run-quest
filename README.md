# Silicon Run

`js/silicon-run.js` is the canonical runtime source loaded by `index.html`. Make runtime changes there and keep the bundle checked in.

`js/photoresist-chamber.js` is the shared Three.js chamber component used by the in-game spin-coater and the standalone station page. It owns chamber rendering and local particle simulation; the game runtime supplies the wafer-stage and process bridge.

The unversioned files `base.js`, `parallel-wafers.js`, `design-workstation.js`, and `bootstrap.js` are older source fragments and do not currently reproduce the runtime. Do not use them to regenerate `silicon-run.js` until they have been reconciled with the shipped features.

Run `node --check js/photoresist-chamber.js` and `node --check js/silicon-run.js` to syntax-check the runtime before release. GitHub Pages runs the same checks before deployment.

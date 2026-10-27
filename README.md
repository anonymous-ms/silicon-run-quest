# Silicon Run

The production bundle is `js/silicon-run.js`. Update that named file in place for every release; don't create version-numbered runtime bundles.

`index.html` currently retains a legacy script reference, so `silicon-run.v812.js` is a minimal compatibility loader that immediately loads `silicon-run.js`. Once the HTML entry point is edited outside this environment, replace it with `./js/silicon-run.js` and remove the loader.

The build script outputs `silicon-run.js`.

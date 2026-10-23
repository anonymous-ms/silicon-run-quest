# Silicon Run modular project

Upload the contents of this folder to the repository root. Keep the folder structure exactly as supplied.

## Runtime files
- `index.html`: page markup only
- `css/styles.css`: all UI styling
- `js/base.js`: original simulator core, Three.js world, desktop and base XR systems
- `js/parallel-wafers.js`: V6 parallel wafer, stock, breakage and concurrent-machine behaviour
- `js/design-workstation.js`: V7 design workstation
- `js/bootstrap.js`: simulator initialisation
- `js/loader.js`: loads the four ordered runtime parts into one private scope
- `service-worker.js`: offline cache and update handling

The ordered loader deliberately preserves the existing shared runtime and override order. Edit only the relevant helper file, while retaining current behaviour.

After deploying a new version, update the `CACHE` constant in `service-worker.js` so installed Quest browsers replace the previous cache.

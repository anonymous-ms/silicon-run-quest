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

## V8.1 correction
Station 1 is a dedicated desk, PC tower, keyboard, mouse and interactive monitor. The generic chamber assembly is not rendered there. V7 feature logic is retained, and helper requests are build-versioned to prevent stale mixtures.

## V8.3
Canvas labels preserve physical height and derive width from texture aspect. Dial and slider labels anchor their inner corner to each graduation. Station 1 is created directly as a desk workstation and never creates a chamber door. Version-specific script filenames prevent stale V8.1 helpers loading.

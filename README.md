# Silicon Run V8.5 stable modular project

The source is separated for targeted maintenance, while GitHub Pages loads a single deterministic runtime bundle.

## Editable source files
- `js/base.v85.js`: original scene, desktop, XR and fabrication systems
- `js/parallel-wafers.v85.js`: multi-wafer, physics, breakage and concurrent processing
- `js/design-workstation.v85.js`: dedicated desktop design workstation and engineering tasks
- `js/bootstrap.v85.js`: startup

## Deployed runtime
- `js/silicon-run.v85.js`: prebuilt concatenation in the required shared private scope
- `js/build.sh`: rebuilds and syntax-checks the runtime after source edits

Station objects now declare `kind: 'design'` or `kind: 'fabrication'`. Door animation, door grabbing and reset rotation explicitly exclude the design workstation. Invisible compatibility objects preserve inherited object-shape expectations without rendering a chamber.

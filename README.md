# Silicon Run

Interactive **WebGL / WebXR** buried-channel CCD semiconductor cleanroom simulator (`index.html`).

Designed to be **approachable on first try yet genuinely skill-testing**, Silicon Run lets **young children, work-experience students, non-technical factory staff, and trained wafer fabrication operators** explore a semiconductor fab bay on **PC Desktop** or **Meta Quest VR**, handle silicon wafers physically, tune multi-variable process equipment, and compete for top quality yield and speedrun times.

---

## Vision, Audiences & Cross-Platform Playability

Silicon Run balances **curiosity and tactile discovery** with **authentic cleanroom discipline**:

| Audience | What They Get Out of Silicon Run | How the Simulator Meets Them |
| --- | --- | --- |
| **Young Children & First-Time Explorers** | Tactile "pick up, load, push glowing button, watch it spin/glow" delight without confusing jargon. | Diagonal equidistant green floor arrows straight from player feet to the active bay; pulsing `START` (green) and `STOP` (red) shader-lit buttons right beside the transparent door; instant visual feedback as silicon wafers change color and grow thicker coatings; forgiving rigid-body wafer drop physics that let you set wafers down on tables/floors instead of shattering every drop. |
| **Work-Experience & STEM Students** | Concrete mental model of how a raw silicon wafer becomes a working CCD image sensor across 11 real fab steps. | Authentic P-type substrate $\rightarrow \text{SiO}_2$ gate/mask oxide $\rightarrow$ I-line lithography $\rightarrow$ RIE oxide etch $\rightarrow$ N-type Phosphorus buried-channel implant $\rightarrow$ RTA $\rightarrow$ Al clock interconnect $\rightarrow$ electrical probe flow; causal controls (`RPM`, `flow`, `volume`, `TMAH`, `CF₄`, dose energy) backed by live deviation notes in the final report. |
| **Non-Technical Factory & Cleanroom Support Staff** | Familiarity with cleanroom layout, equipment anatomy, safety interlocks, ISO zones, and why operator precision matters. | Pre-run interactive **Controls Training** confirming every VR/Desktop input before the clock starts; physical magnetic door interlocks (`< 5°` latch), running-process door locks with operator warnings, clear see-through equipment shrouding, Zone A lithography vs Zone B etch/implant/metal separation at the Air Shower portal, and sharps disposal bins for fractured wafers. |
| **Wafer Fabrication Operators & Speedrunners** | A manual dexterity and recipe-tuning test chasing 99% electrical yield and leaderboard record times. | Unlimited parallel wafer population (`parallel` runtime) allowing multi-machine pipelining, real-time proportional over/under-processing & uncapped coating buildup on mis-tuned recipes, strict manual endpoint timing (`STOP`), and local speedrun + activity benchmarks (`waferFabRunsV2`, `waferFabActivitiesV1`). |

### Dual-Platform Parity (PC Desktop & Meta Quest VR)
- **PC Desktop**: Pointer-lock WASD / Arrow navigation, `Shift` crouch, `Ctrl` capacitor-backed sprint, mouse-wheel dial & slider tuning, projected 5-finger wafer grip (`Left Mouse` hold + `Wheel` depth control), direct `Left Mouse` door handle drag & player-body door push collision, `[M]` full 3D Photoresist Process Module at the spin coater, `[E]` / Click activation, `Esc` pause (including `Unstuck`, `Control Inputs`, `Settings`), and `DEVELOPER` live FoM / 1 Hz FPS overlay.
- **Meta Quest WebXR**: Physical-space locomotion + thumbstick snap-turn/sprint, translucent Meta Quest Touch Plus ghost hands (`createGhostHand`) with animated finger/trigger/thumbstick kinematics, pinch-sphere wafer snapping (`WAFER_SNAP_RADIUS`), physical hinged door swing (`Grip`), wrist-mounted Traveller specification HUD + controller cheat-sheet, shard sweeping (`A`), jump (`X`) / crouch (`Left Grip`), and adjustable XR GUI scale (`5`–`50`).

---

## Cleanroom Fabrication Sequence (Buried-Channel CCD)

Every run tracks a single `200 mm`-scale flat-edged P-type silicon wafer through 11 fabrication and test stages:

1. **Sensor Design Terminal** — Validate pixel array width, row-driver geometry, and CDS ADC crossover (`Design Workstation`: linear regression, CMOS schematic repair, and 2-layer M1/M2/via orthogonal layout).
2. **Oxidation Furnace** — Thermally grow silicon-dioxide ($\text{SiO}_2$) gate dielectric & implant-masking layer in a horizontal quartz tube furnace with animated wafer boat & oxygen jets.
3. **Photoresist Spin Coater** — Swing-arm liquid feed pipe dispenses 320 fine micro-droplet resist particles onto the spinning chuck; film thickness grows uncapped and responds proportionally (and distorts disproportionately) to `RPM`, `flow`, and `volume`.
4. **Soft-Bake Furnace** — Quartz lift pins lower the coated wafer onto dual concentric heater rings to drive off casting solvent.
5. **Mask Aligner & I-Line Exposure** — Align the CCD active-channel photomask and expose under 365 nm I-line UV.
6. **Developer Wet Bench** — Sloshing TMAH bath with fine liquid surface particles (`tideFlow`) and sweeping spray arm to open CCD channel windows.
7. **Reactive Ion Etcher (RIE)** — RF plasma showerhead etches anisotropic $\text{CF}_4$ windows down to active silicon.
8. **Ion Implant Beamline** — Implant **`Phosphorus / N-type`** ions through the oxide windows to form the CCD buried electron channel in P-type silicon.
9. **Rapid Thermal Anneal (RTA)** — Spike-anneal lattice damage and electrically activate the buried-channel junction.
10. **Metal Film Depositor** — Sputter Aluminium interconnect buses for CCD clock phases and optical shielding.
11. **Microscope & Probe Test** — Land Kelvin micro-probes under the turret microscope at nominal 3.3 V bias to sample charge transfer performance and emit the Final Manufacturing Record.

---

## Shipped Runtime Architecture & File Ownership

`index.html` loads Three.js (`0.152.2`), `js/circuit-symbols.js`, `js/photoresist-chamber.js`, and `js/silicon-run.js`. `js/silicon-run.js` sequentially loads the classic-script subunits sharing lexical scope:

- `js/silicon-run-core.js` — Shared `C` palette & `DOOR_MAGNET_ANGLE` (`5 / 90`), 11-station CCD definitions, cleanroom environment (non-overlapping ESD floor tiers, HEPA/service chase, diagonal equidistant green floor arrows), contiguous translucent hollow-cuboid machine shrouds with embedded front-right GLSL glow-shader `START`/`STOP` buttons (`createButtonGlowShader`), Quest Touch Plus ghost hands (`createGhostHand`), controls training (`controlsTraining`), door locking during active cycles (`isDoorLocked` / `notifyDoorLocked`), machine internal animations & fine liquid particles, scoring, reporting, and main loop. The spin-coater and oxidation-furnace geometry, controls, displays, doors, and grouped assemblies are imported from their Orbit Forge assets. The furnace uses its hinged safety-door interlock and sliding-carriage endpoints to load/unload the live wafer, while its recipe dials, E-stop, HMI, lamps, heater rings, and oxygen flow respond to simulator state.
- `js/parallel-wafer-runtime.js` — Unlimited parallel wafers, concurrent multi-station processing, invisible small pinch/snap sphere (`WAFER_SNAP_RADIUS = 0.22`) into any open fabrication chamber, rigid-body wafer surface resting across tables/worktops/desks/sharps-bins/floor/walls with CoG gravitational pivot torque (`resolveWaferRigidStep` / `waferSupportSurfaces`), and high-impact fracture & shard-pile sweeping.
- `js/design-workstation-runtime.js` — 3-stage Sensor Design Workstation (`y = mx + c` regression, CMOS gate repair, M1/M2/via orthogonal layout) and FoM telemetry.
- `js/design-world-runtime.js` — Isolated 3D design room (`z = 165`), Desktop 5-finger projected wafer grip & depth adjustment, Desktop door-handle dragging with `< 5°` magnetic interlock latching and running lock, bipyramid player collider + `Unstuck`, XR design interaction, and service-worker registration.
- `js/cleanroom-lod.js` — Distance-based Near/Mid/Far machine LOD unloading, ceiling PointLight active windowing (4 nearest lights in cleanroom, 0 in Design World), and dynamic LOD telemetry for the developer performance pane (`CleanroomLOD.FutureHooks`).
- `js/cleanroom-debug.js` — Settings-driven 3D diagnostic visualizers (`#debugHitboxes`, `#debugNormals`, `#debugWireframe`) and active debug-flag readout inside the top-left developer performance box (`CleanroomDebug.FutureHooks`).
- `js/cleanroom-realism.js` — PMREM cleanroom environment reflections, 590 nm Bay A lithography safelight accents, procedural perforated ESD floor bump mapping, and interactive Air Shower laminar airflow particles (`CleanroomRealism.FutureHooks`).
- `js/cleanroom-pedagogy.js` — Selectable `Explorer`, `Operator`, and `Certification` difficulty tiers (`#difficultyMode` / `#settingsDifficulty`), strict/forgiving tolerance scaling, spoiler-hiding mode, and real-time 2.5D CCD wafer cross-section canvas (`#crossSectionCanvas` + `CleanroomPedagogy.FutureHooks`).
- `js/cleanroom-audio.js` — Zero-asset procedural WebAudio synthesizer (`#audioEnabled`) for magnetic door latch clicks, locked-door alerts, machine start/stop chimes, and fracture audio (`CleanroomAudio.FutureHooks`).
- `js/silicon-run-startup.js` — Bridges the optional 3D `PhotoresistChamber` module (`[M]` / `#openPhotoresist`), initializes the modular feature layers (`installFeatureModules`), and provides the `?test=oxidation-snap` test-launch hook (`scripts/test-launch.js`).

Keep `js/silicon-run.js` load order synchronized with `service-worker.js` and `index.html`. Subunits share global lexical bindings; do not convert individual files to ES modules without updating cross-file references.

### Supporting Assets & Scripts

- `assets/photolithography-wafer-machine.json` — Orbit Forge model, rig limits, and animation tracks used to build the full-size spin-coater station and its articulated assemblies.
- `assets/oxidation-furnace-sliding-tray-v2.json` — Imported 92-part Orbit Forge oxidation furnace with grouped chassis, controls, safety-door joint, sliding wafer carriage, and carriage animation endpoints. `js/silicon-run.js` loads both machine models before starting the runtime; the service worker precaches this asset for offline use.
- `js/photoresist-chamber.js` — Standalone/embeddable Three.js spin-coating simulation (`PhotoresistChamber.mount`) with octree-accelerated instanced particles and 18-bin film metrology.
- `js/circuit-symbols.js` — Shared UMD schematic helpers (`drawMos`, `drawPowerTerminals`).
- `css/styles.css` & `css/developer-layout.css` — Cleanroom HUD, modal panels, controls training UI, manufacturing report, and stacked developer FoM / 1 Hz FPS panes.
- `manifest.webmanifest` & `service-worker.js` — PWA metadata and offline precache.
- `scripts/test-launch.js` — Local no-cache HTTP server (`?test=oxidation-snap`) for interactive browser inspection.

### Non-Shipped / Legacy Files

Retained for archival reference only (neither loaded by `index.html` nor precached): `silicon-run.js`, `design-workstation-runtime.js`, `design-world-runtime.js`, `js/base.js`, `js/parallel-wafers.js`, `js/design-workstation.js`, `js/bootstrap.js`, `js/build.sh`, `js/vr-dual-trigger.js`.

---

## Roadmap for Further Development (Photorealism & Pedagogy)

To take Silicon Run from an interactive prototype to a benchmark **photorealistic, zero-barrier educational & operator-certification tool**:

1. **Photorealistic Materials & Cleanroom Lighting**
   - Add a `PMREMGenerator` environment cubemap (`scene.environment`) for specular reflections across polished silicon, thin-film $\text{SiO}_2$ interference fringes, quartz tubes, and brushed stainless shrouds.
   - Tint Bay A lithography ambient lighting toward **590 nm amber UV-safe lighting** vs bright white ISO-4 Bay B to visually teach why unexposed photoresist is light-sensitive.
   - Generate procedural normal/roughness/AO textures for perforated ESD floor tiles, cleanroom panels, and HEPA ceiling diffusers, plus selective HDR bloom for plasma discharges and furnace coils.
2. **Causal Physics & Coupled Cross-Stage Yield**
   - Add an inline **2.5D live wafer cross-section visualizer** inside `#machineGui` and the XR wristband showing *why* incorrect `TMAH`, `CF₄`, oxide thickness, or `Phosphorus` energy alters the buried-channel potential well.
   - Link upstream process deviations to downstream physical outcomes (e.g., overlay error visibly shifting Stage 9 clock metal alignment and causing charge-transfer loss or shorts on Stage 10 probing).
3. **Authentic Handling & Safety Drills**
   - Introduce optional **edge-grip vacuum tweezers / FOUP cassettes** (penalizing surface fingerprint/particulate defects on bare patterned wafers) and activate the `z = -17` **Air Shower** as an interactive particle-purge checkpoint between bays.
4. **Tiered Educational Difficulty & Spatial Audio**
   - Offer **Apprentice** (live target bands, floor path arrows, plain-English explanations), **Operator** (targets hidden into a virtual Process Traveller card; rely on gauges & optical thin-film colors), and **Certification** (strict defect budgets and speedrun scoring) modes.
   - Synthesize spatial WebAudio cues (FFU laminar airflow hum, chuck spin pitch, magnetic door latch click, plasma ignition, gas flow hiss) paired with matching Quest haptic envelopes.

---

## Verification & Local Test Server

Run syntax checks across all shipped JS files and execute the unit + integrity test suite (`tests/circuit-symbols.test.js`, `tests/oxidation-snap.test.js`, `tests/runtime-integrity.test.js`):

```sh
node --check js/circuit-symbols.js
node --check js/photoresist-chamber.js
node --check js/silicon-run.js
node --check js/silicon-run-core.js
node --check js/parallel-wafer-runtime.js
node --check js/design-workstation-runtime.js
node --check js/design-world-runtime.js
node --check js/cleanroom-lod.js
node --check js/cleanroom-debug.js
node --check js/cleanroom-realism.js
node --check js/cleanroom-pedagogy.js
node --check js/cleanroom-audio.js
node --check js/silicon-run-startup.js
node --check service-worker.js
node --test tests/*.test.js
```

To launch the local browser test harness directly at the Oxidation Furnace wafer-snap scenario:

```sh
node scripts/test-launch.js
```

The same local server prints a hand/controller alignment harness URL:

```text
http://127.0.0.1:<port>/index.html?debug=hand-align&hand=right
http://127.0.0.1:<port>/index.html?debug-hand-align&hand=right
```

The harness uses no XR tracking or main cleanroom scene. Use the on-screen sliders or keyboard hotkeys to adjust the selected hand root relative to the controller:

- `A/D`, `W/S`, `Q/E`: position X/Y/Z
- Arrow keys: Euler pitch/yaw/roll
- `H`: switch left/right
- `C`: cycle camera view
- `V`: toggle axis gizmos
- `R`: reset the selected hand
- Hold `Shift` for larger keyboard adjustments

(`.github/workflows/deploy-pages.yml` publishes the static root to GitHub Pages on pushes to `main` without running Node checks in CI—always run the checks above locally first.)

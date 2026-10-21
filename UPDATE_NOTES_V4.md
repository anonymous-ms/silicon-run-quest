# Silicon Run V4: Pinch Anchors and Ghost Hands

Replace the repository-root `index.html` and `service-worker.js`, commit both to `main`, and wait for the GitHub Pages deployment.

## Changes

- Removed the opaque procedural glove models.
- Added translucent articulated ghost hands attached to WebXR grip spaces.
- Index finger animation follows trigger pressure.
- Remaining fingers follow grip pressure.
- Thumb pose responds to thumbstick and face-button touch state where exposed by Quest Browser.
- Added a persistent 3D pinch attachment marker to each hand.
- Pinch marker turns green only within the 0.12 m physical attachment radius.
- Wafer, shards, dials, sliders and buttons now use the grip-space pinch point rather than the controller ray origin.
- Either hand independently searches for the nearest local interactive object.
- The wafer attaches exactly to the visible pinch marker and remains visible while held.
- The first stock wafer is staged safely on the table and does not enter gravity before pickup.
- Added a large animated `PINCH WAFER HERE` guide above the initial wafer until the first successful pickup.
- Failed out-of-range pinches give a small haptic response but do not attach the object.
- Existing popup text, wrist specifications, physics, doors, breakage, shards and pause/final overlays are retained.

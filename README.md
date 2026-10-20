# Silicon Run

**Silicon Run** is an immersive WebXR cleanroom and semiconductor wafer-fabrication simulator built with Three.js for Meta Quest 3 and Quest 3S.

The player carries one tracked 200 mm silicon wafer through a complete fabrication line, physically operates machine controls, monitors live process results, and records a final manufacturing outcome. The current version is designed for direct interaction with Meta Quest Touch controllers rather than desktop-style point-and-click input.

## Live Version

Open the deployed simulator in Meta Quest Browser:

```text
https://anonymous-ms.github.io/silicon-run-quest/
```

To begin:

1. Open the URL in Meta Quest Browser.
2. Enter an operator name.
3. Select **ENTER CLEANROOM**.
4. Select **ENTER QUEST VR**.

## Current Version

**V3: Direct physical controls**

This version includes:

- Immersive stereoscopic WebXR rendering
- Six-degree-of-freedom headset and controller tracking
- Head-relative smooth locomotion and snap turning
- Approximately 50% taller player position in the 3D environment
- Visible cleanroom glove models
- Left-wrist process specification handset
- Direct trigger-based wafer, shard, dial, and slider grabbing
- Grip-operated physical machine doors
- Door momentum, friction, limits, and closed-position latching
- Physical wafer gravity, impact detection, breakage, and shard disposal
- Three yellow sharps bins placed through the facility
- Camera-attached pause/options and final-result overlays
- Machine-mounted minimum, midpoint, and maximum control scales
- Haptic feedback for physical actions and interlocks
- Desktop keyboard and mouse fallback controls
- Local run records and benchmark storage

## Quest Controls

### Left controller

```text
Left thumbstick
    Move relative to headset direction

Left thumbstick click
    Toggle the left-wrist process specification HUD

Left trigger
    Grab or release a nearby wafer, shard, dial, or slider

Left grip
    Grab or release a nearby machine door

X button
    Toggle the active-machine objective beacon

Y button
    Restore and display detailed wrist specifications
```

### Right controller

```text
Right thumbstick left/right
    30-degree snap turn

Right thumbstick click
    Open or close the pause/options overlay
    Dismiss the final manufacturing overlay

Right trigger
    Grab or release a nearby wafer, shard, dial, or slider

Right grip
    Grab or release a nearby machine door

A button
    Operate a nearby targeted push button
    Resume from the pause menu

B button
    Pause or resume the simulation
```

## Desktop Controls

Desktop mode remains available for development and fallback testing.

```text
WASD / arrow keys
    Move

Mouse
    Look around

Shift
    Crouch

Ctrl
    Sprint

E / left click
    Operate the targeted control

Mouse wheel
    Adjust the targeted dial or slider
```

## Physical Wafer Workflow

### Issue the wafer

Use the **DISPENSE** control on the blank-wafer stock station. The wafer is placed at the physical stock output and is not automatically attached to the player.

### Pick up the wafer

Move either controller close to the wafer and hold the controller trigger. The wafer follows that hand until the trigger is released.

### Load a machine

1. Grip and physically open the machine door.
2. Pick up the wafer with either trigger.
3. Move the wafer into the chamber input or wafer tray.
4. Release the trigger inside the acceptance zone.
5. Push the door closed until it latches.
6. Configure the process controls.
7. Press **START**.

### Unload a machine

1. Stop the process at the required endpoint.
2. Grip and physically open the door.
3. Reach into the chamber.
4. Hold a trigger to pick up the completed wafer.
5. Withdraw the wafer.
6. Close the machine door to release the next manufacturing stage.

## Machine Doors

Machine doors are physical mechanisms in VR.

- Hold either controller grip near a door to grab it.
- Pull or push the controller to swing the door.
- Doors move between 0 and 90 degrees.
- Released doors retain angular momentum.
- Friction gradually slows the door.
- A door within 5 degrees of closed snaps into the latch position.
- Successful latching produces haptic confirmation.
- Doors may be opened at any time.
- A machine can only start when its wafer is loaded and the door is latched closed.

## Dials and Sliders

Machine controls are directly manipulated in VR.

### Dials

1. Move an empty hand close to the dial.
2. Hold the trigger.
3. Move the hand around the dial centre.
4. Release the trigger when the required value is reached.

### Sliders

1. Move an empty hand close to the slider.
2. Hold the trigger.
3. Move the hand vertically.
4. Release the trigger when the required value is reached.

Every control has a physical scale showing its minimum, midpoint, and maximum. Choice controls show the first, middle, and final available settings.

## Wrist Specification Handset

Press the left thumbstick to toggle the wrist display.

The handset shows:

- Operator lot number
- Current process stage
- Wafer location
- Estimated process quality
- Overall process progress
- Required process endpoint and tolerance
- Machine-control target values and tolerances
- Live process measurement while a tool is running

Press **Y** to restore the detailed specification display.

## Wafer Damage and Sharps Disposal

The wafer behaves as a brittle silicon object.

The wafer can fracture when:

- Dropped from more than approximately its own diameter
- Striking the floor with excessive velocity
- Driven into a machine at excessive speed
- Driven into a wall or room boundary
- Struck by a moving physical obstruction with sufficient impact

A broken wafer creates multiple physics-driven shards.

To clear a broken wafer:

1. Move a controller close to a shard.
2. Hold the trigger to pick up the shard.
3. Carry the shard to one of the yellow sharps bins.
4. Release the shard over the bin opening.
5. Repeat until every shard has been disposed of.

Three yellow sharps bins are distributed through the cleanroom.

## Fabrication Process

The current manufacturing route includes:

1. Sensor design release
2. Thermal oxidation
3. Photoresist spin coating
4. Soft bake
5. Mask alignment and I-line exposure
6. Wet development
7. Reactive ion etching
8. Ion implantation
9. Rapid thermal annealing
10. Metal-film deposition
11. Microscope inspection and probe testing

Every stage records:

- Configured process values
- Manual process endpoint
- Process result
- Stage quality
- Key deviations from the preferred process window

## Process Completion

When all operations are complete, an XR result panel is rendered directly in front of the headset and above the rest of the scene.

The final panel includes:

- Lot identifier
- Manufacturing completion state
- Mean process quality
- Total run time

Press the right thumbstick to dismiss the final overlay.

## Deployment

The application is hosted using GitHub Pages and a GitHub Actions workflow.

Repository structure:

```text
silicon-run-quest/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── .nojekyll
├── index.html
├── manifest.webmanifest
├── service-worker.js
└── README.md
```

Any commit to the `main` branch triggers the Pages deployment workflow.

## Updating the Simulator

To publish a new version:

1. Open the GitHub repository.
2. Replace the root `index.html` with the updated version.
3. Replace `service-worker.js` if the cache version has changed.
4. Commit both files directly to `main`.
5. Open the **Actions** tab.
6. Wait for the deployment workflow to receive a green tick.
7. Refresh the GitHub Pages URL in Meta Quest Browser.

If the previous version remains cached:

1. Close the existing Quest Browser tab.
2. Open the site in a new tab.
3. Restart Quest Browser if necessary.
4. Confirm the cache name in `service-worker.js` was changed for the new release.

## Local Development

Requirements:

- Node.js 20 or later
- npm
- A modern desktop browser

Install dependencies:

```powershell
npm.cmd install
```

Start the local HTTPS development server:

```powershell
npm.cmd run dev
```

The local page is normally available at:

```text
https://localhost:5173/
```

On managed computers, inbound firewall restrictions may prevent another device from accessing the Vite network address. GitHub Pages is the preferred Quest deployment route because it provides trusted HTTPS without requiring an inbound laptop connection.

## Troubleshooting

### ENTER QUEST VR is unavailable

Check that:

- The site is being opened in Meta Quest Browser.
- The GitHub Pages URL begins with `https://`.
- The browser is using the current deployed version.
- WebXR permissions were not denied.

### Old version keeps loading

- Replace `service-worker.js` with the release version.
- Confirm the cache identifier changed.
- Close and reopen the Quest Browser tab.
- Wait for the GitHub Pages workflow to finish before refreshing.

### Controller inputs appear reversed

Exit immersive VR, reconnect both Touch controllers, and re-enter the WebXR session.

### A machine will not start

Confirm that:

- The correct wafer is physically seated.
- The current process stage is the active stage.
- The physical door is within 5 degrees of fully closed.
- The START control is enabled.

### Wafer cannot be picked up

Move the controller closer to the wafer or shard before holding the trigger. Direct physical grabbing uses a short-range proximity check rather than the long controller ray.

## Privacy and Data

Run records are stored locally in the browser using `localStorage`. No database or external account service is used by the simulator.

The GitHub Pages repository and deployed site are public if hosted through a free public GitHub repository. Do not publish confidential or proprietary information without the appropriate approval.

## Technology

- Three.js
- WebGL
- WebXR Device API
- Meta Quest Browser
- GitHub Pages
- GitHub Actions
- JavaScript
- HTML5 Canvas

## Project Status

The project is an active development prototype. The current priority is validating direct physical interaction, controller mapping, process usability, collision behaviour, and stable Meta Quest performance before further visual expansion.

# Silicon Run V5

Replace repository-root `index.html` and `service-worker.js`, commit to `main`, then wait for the GitHub Pages workflow.

## New controls

- X tap: jump
- Left grip hold: crouch
- Right grip hold near a machine: grab/release door
- Y: toggle objective beacon and show handset

## Changes

- Wafer now appears on an illuminated pickup pad on top of the stock work surface.
- After the stock wafer is taken, a replacement appears on the pad after 5 seconds.
- The pad remains highlighted and labelled WAFER PICKUP.
- Left and right hand meshes are true mirrored versions rather than sharing the same finger order.
- Neutral controller-hand poses turn both palms inward.
- Trigger, grip, thumbstick touch and face-button touch continue to animate available finger poses.
- Door acquisition radius increased to 1.05 m and searches the entire nearby door/chamber region.
- Jump has gravity and landing behaviour.
- Left-grip crouch smoothly lowers and restores the XR rig while held.

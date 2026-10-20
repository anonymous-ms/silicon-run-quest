# Silicon Run - Meta Quest WebXR

Static WebXR deployment for Meta Quest 3/3S. The complete simulator is in `index.html`.

## Publish

1. Create a **public** GitHub repository.
2. Upload every file and folder from this package, preserving `.github/workflows/deploy-pages.yml`.
3. Open **Settings -> Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for the Pages deployment to finish.
5. Open the deployed `https://<username>.github.io/<repository>/` address in Quest Browser.
6. Enter an operator name, choose **ENTER CLEANROOM**, then **ENTER QUEST VR**.

## Quest controls

- Left thumbstick: movement relative to headset direction
- Right thumbstick left/right: 30-degree snap turn
- Right controller ray + trigger: operate buttons and select controls
- Right thumbstick up/down: adjust targeted controls
- Physical head movement: look and crouch

## Security note

GitHub Pages is public. Do not publish confidential or proprietary project information without approval.

(function (global) {
  'use strict';

  const LIMITS = { width: 6, depth: 5, height: 4, floor: 0.12, waferY: 0.92, waferRadius: 1.38 };
  const MAX_PARTICLES = 840;
  const BIN_COUNT = 18;
  const DEPOSIT_NM_PER_PARTICLE = 1.7;
  const PARTICLE_RADIUS = 0.035;
  const GRAVITY = 3.1;

  function bounds(minX, minY, minZ, maxX, maxY, maxZ) {
    return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
  }

  function overlaps(a, b) {
    return a.min.x >= b.min.x && a.max.x <= b.max.x &&
      a.min.y >= b.min.y && a.max.y <= b.max.y &&
      a.min.z >= b.min.z && a.max.z <= b.max.z;
  }

  function sphereIntersectsBounds(point, radius, box) {
    let distanceSquared = 0;
    for (const axis of ['x', 'y', 'z']) {
      const nearest = Math.max(box.min[axis], Math.min(point[axis], box.max[axis]));
      const delta = point[axis] - nearest;
      distanceSquared += delta * delta;
    }
    return distanceSquared <= radius * radius;
  }

  // Objects wholly inside an octant descend; chamber-sized surfaces stay in parent nodes for local broad-phase queries.
  class Octree {
    constructor(box, depth = 0) {
      this.box = box;
      this.depth = depth;
      this.items = [];
      this.children = null;
    }

    insert(item) {
      if (this.children) {
        const child = this.childContaining(item.bounds);
        if (child) {
          child.insert(item);
          return;
        }
      }
      this.items.push(item);
      if (this.items.length > 12 && this.depth < 6) this.split();
    }

    childContaining(itemBounds) {
      if (!this.children) return null;
      return this.children.find(child => overlaps(itemBounds, child.box)) || null;
    }

    split() {
      const { min, max } = this.box;
      const midX = (min.x + max.x) * 0.5;
      const midY = (min.y + max.y) * 0.5;
      const midZ = (min.z + max.z) * 0.5;
      this.children = [];
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          for (let z = 0; z < 2; z++) {
            this.children.push(new Octree(bounds(
              x ? midX : min.x, y ? midY : min.y, z ? midZ : min.z,
              x ? max.x : midX, y ? max.y : midY, z ? max.z : midZ
            ), this.depth + 1));
          }
        }
      }
      const retained = [];
      for (const item of this.items) {
        const child = this.childContaining(item.bounds);
        if (child) child.insert(item);
        else retained.push(item);
      }
      this.items = retained;
    }

    querySphere(point, radius, results) {
      if (!sphereIntersectsBounds(point, radius, this.box)) return;
      for (const item of this.items) {
        if (sphereIntersectsBounds(point, radius, item.bounds)) results.push(item);
      }
      if (this.children) {
        for (const child of this.children) child.querySphere(point, radius, results);
      }
    }
  }

  function markup() {
    return `<div class="pr-shell">
      <header class="pr-topbar"><div class="pr-brand"><span class="pr-mark"></span><div><small>PROCESS MODULE PR-204</small><h1>Photoresist Depositing Station</h1></div></div><div class="pr-system"><i></i><span id="systemStateText">System ready</span></div></header>
      <div class="pr-workspace">
        <section class="pr-sim"><header><b>Chamber simulation · 3D view</b><span><i class="pr-live"></i> Physics live <span id="particleBadge">0 particles</span></span></header><div id="simulationViewport"><span class="pr-camera-label">CAM-03 · ISOMETRIC CHAMBER</span><span class="pr-safe-zone">PROCESS CHAMBER</span></div><footer><span>Machine</span><span>Photoresist</span><span>Wafer / metrology surface</span></footer></section>
        <aside class="pr-panel" aria-label="Deposition station controls">
          <section class="pr-module"><header><b>Feed tube position</b><output id="armReadout">RETRACTED</output></header><div class="pr-row"><div><strong>Swing arm</strong><small>Move nozzle over wafer centre.</small></div><button id="armToggle" class="pr-toggle" type="button" role="switch" aria-checked="false" aria-label="Toggle swing arm"></button></div></section>
          <section class="pr-module"><header><b>Flow rate</b><output id="flowReadout">45 %</output></header><input id="flowSlider" type="range" min="10" max="100" value="45" step="5" aria-label="Photoresist flow rate"><div class="pr-ticks"><span>10%</span><span>55%</span><span>100%</span></div></section>
          <section class="pr-module"><header><b>Wafer rotation</b><output id="speedReadout">900 rpm</output></header><input id="speedSlider" type="range" min="0" max="1800" value="900" step="100" aria-label="Wafer rotation speed"><div class="pr-ticks"><span>0 rpm</span><span>900 rpm</span><span>1800 rpm</span></div></section>
          <section class="pr-module"><header><b>Manual deposition</b><output id="depositState">STANDBY</output></header><button id="depositButton" class="pr-deposit" type="button" disabled><strong>PRESS &amp; HOLD</strong><small>Photoresist dispense trigger</small></button><div id="interlock" class="pr-interlock bad"><i></i><span id="interlockText">Interlock: extend feed tube</span></div></section>
          <section class="pr-module pr-metrology"><header><b>Gel thickness metrology</b><output>LIVE AVG</output></header><div class="pr-thickness"><output id="thicknessReadout">0.0</output><span>nm</span></div><div class="pr-meter"><i id="thicknessMeter"></i></div><div id="profileBars" class="pr-bars" aria-label="Thickness profile from wafer edge to edge"></div><div class="pr-chart-labels"><span>EDGE L</span><span id="uniformityReadout">Uniformity --</span><span>EDGE R</span></div></section>
          <section class="pr-module"><header><b>Chamber utilities</b><output id="doorReadout">LOCKED</output></header><div class="pr-utility"><button id="doorButton" type="button">UNLOCK &amp; OPEN</button><button id="resetButton" type="button">RESET PROCESS</button></div><div id="doorHint" class="pr-hint">Door is latched at the frame edge.</div></section>
        </aside>
      </div>
      <div class="pr-footer-note">Drag in the chamber to orbit · scroll to zoom · click the front handle to operate the door</div>
    </div>`;
  }

  function addStyles(doc) {
    if (doc.getElementById('photoresistChamberStyles')) return;
    const style = doc.createElement('style');
    style.id = 'photoresistChamberStyles';
    style.textContent = `
      .pr-shell{--pr-bg:#080e14;--pr-panel:#111b24;--pr-line:#263b49;--pr-cyan:#31d7f3;--pr-green:#55e39f;--pr-pink:#e84fce;color:#e6f0f7;font:12px/1.35 Inter,Segoe UI,system-ui,sans-serif;min-height:100%;padding:12px;background:radial-gradient(ellipse at 42% 0%,rgba(49,215,243,.08),transparent 42%),linear-gradient(135deg,#070b10,#0a1118 55%,#070b10)}
      .pr-topbar{min-height:62px;display:flex;align-items:center;justify-content:space-between;padding:9px 16px;border:1px solid var(--pr-line);border-radius:8px;background:linear-gradient(180deg,#121c26,#0b1219);margin-bottom:10px}
      .pr-brand{display:flex;align-items:center;gap:12px;min-width:0}.pr-mark{width:34px;height:34px;border:1px solid #277386;border-radius:50%;background:radial-gradient(circle,#31d7f3 0 18%,#10303b 22% 43%,transparent 46%);box-shadow:0 0 14px #31d7f333}.pr-brand small{color:var(--pr-cyan);font:800 9px ui-monospace,monospace;letter-spacing:.14em}.pr-brand h1{margin:2px 0 0;font:800 17px/1.15 Inter,Segoe UI,system-ui,sans-serif;letter-spacing:0}.pr-system{display:flex;align-items:center;gap:8px;color:#8ba1b2;font:700 9px ui-monospace,monospace;text-transform:uppercase}.pr-system i,.pr-live{width:7px;height:7px;border-radius:50%;background:var(--pr-green);box-shadow:0 0 9px var(--pr-green);display:inline-block}
      .pr-workspace{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(290px,.75fr);gap:10px;min-height:0}.pr-sim,.pr-panel{border:1px solid var(--pr-line);border-radius:8px;background:linear-gradient(180deg,#0e151d,#080d12);overflow:hidden}.pr-sim{display:grid;grid-template-rows:auto minmax(360px,1fr) auto;min-height:580px}.pr-sim>header,.pr-sim>footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid var(--pr-line);font:800 9px ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase}.pr-sim>header span{color:#8ba1b2;display:flex;gap:10px;align-items:center}.pr-sim>footer{justify-content:flex-start;border:0;border-top:1px solid var(--pr-line);color:#8ba1b2;font-weight:600;letter-spacing:0;text-transform:none}.pr-sim>footer span:before{content:'';display:inline-block;width:7px;height:7px;margin:0 5px 0 0;border-radius:50%;background:var(--pr-cyan)}.pr-sim>footer span:nth-child(2):before{background:var(--pr-pink)}.pr-sim>footer span:nth-child(3):before{background:var(--pr-green)}
      #simulationViewport{position:relative;min-height:360px;overflow:hidden;touch-action:none;background:radial-gradient(ellipse at 50% 90%,#0d2832,#080e14 65%)}#simulationViewport canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.pr-camera-label,.pr-safe-zone{position:absolute;z-index:2;pointer-events:none;color:#8296a0;font:700 8px ui-monospace,monospace;letter-spacing:.12em}.pr-camera-label{left:10px;top:9px}.pr-safe-zone{inset:8% 7%;border:1px dashed #31d7f322;border-radius:6px;color:#31d7f344;text-align:right;padding:8px}
      .pr-panel{padding:9px;display:flex;flex-direction:column;gap:8px;overflow:auto}.pr-module{padding:10px;border:1px solid var(--pr-line);border-radius:7px;background:linear-gradient(155deg,#121d27,#0b1219)}.pr-module header{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;color:#adc2ce;font:800 9px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.pr-module output{color:var(--pr-cyan);font:800 9px ui-monospace,monospace;white-space:nowrap}.pr-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px}.pr-row strong,.pr-row small{display:block}.pr-row strong{font-size:12px}.pr-row small{margin-top:3px;color:#8ba1b2;font-size:9px;line-height:1.35}.pr-toggle{width:54px;height:28px;border:1px solid #405463;border-radius:20px;background:#111b24;position:relative}.pr-toggle:after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#738894;transition:transform .18s,background .18s}.pr-toggle.active{border-color:var(--pr-cyan);background:#31d7f322}.pr-toggle.active:after{transform:translateX(26px);background:var(--pr-cyan);box-shadow:0 0 9px #31d7f399}
      .pr-module input[type=range]{width:100%;height:16px;margin:0;accent-color:var(--pr-cyan)}.pr-ticks,.pr-chart-labels{display:flex;justify-content:space-between;color:#8094a0;font:7px ui-monospace,monospace;text-transform:uppercase}.pr-deposit{width:100%;min-height:58px;border:1px solid #e84fce;border-radius:6px;color:white;background:linear-gradient(180deg,#9a297f,#5b154e);box-shadow:inset 0 0 0 2px #0003,0 3px 0 #310c2a;touch-action:none}.pr-deposit:active,.pr-deposit.pressed{transform:translateY(2px);box-shadow:inset 0 0 0 2px #0003,0 1px 0 #310c2a}.pr-deposit:disabled{filter:grayscale(.8) brightness(.6);cursor:not-allowed}.pr-deposit strong,.pr-deposit small{display:block}.pr-deposit strong{font:900 12px ui-monospace,monospace;letter-spacing:.09em}.pr-deposit small{margin-top:3px;color:#f5c2e9;font:700 8px ui-monospace,monospace;text-transform:uppercase}.pr-interlock{display:flex;align-items:center;gap:7px;margin-top:7px;padding:6px 7px;border:1px solid var(--pr-line);border-radius:5px;color:#8ba1b2;font:8px ui-monospace,monospace}.pr-interlock i{width:6px;height:6px;border-radius:50%;background:var(--pr-green);box-shadow:0 0 7px var(--pr-green)}.pr-interlock.bad{color:#ff9aa6}.pr-interlock.bad i{background:#ff5c70;box-shadow:0 0 7px #ff5c70}
      .pr-thickness{display:flex;align-items:baseline;gap:6px}.pr-thickness output{font:900 36px/1 ui-monospace,monospace;color:var(--pr-cyan);letter-spacing:0}.pr-thickness span{color:#8ba1b2;font-weight:800}.pr-meter{height:6px;margin:6px 0;border:1px solid #304554;border-radius:5px;overflow:hidden;background:#071016}.pr-meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--pr-cyan),var(--pr-pink));transition:width .12s}.pr-bars{height:42px;display:grid;grid-template-columns:repeat(18,1fr);align-items:end;gap:2px}.pr-bars i{display:block;min-height:2px;height:2px;border-radius:2px 2px 0 0;background:linear-gradient(180deg,#ff8cec,#e84fce)}.pr-chart-labels{margin-top:5px}.pr-utility{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pr-utility button{min-height:34px;border:1px solid #3d566b;border-radius:5px;color:#c8d7e1;background:#131e28;font:800 8px ui-monospace,monospace}.pr-utility button:hover{border-color:var(--pr-cyan);color:var(--pr-cyan)}.pr-hint{margin-top:6px;color:#8ba1b2;font-size:8px}.pr-footer-note{padding:7px 3px;color:#718794;font:8px ui-monospace,monospace;text-align:right}
      .pr-runtime-close{position:fixed;z-index:92;right:26px;top:25px;border:1px solid #547080;border-radius:4px;padding:7px 10px;color:#e6f0f7;background:#111b24;font:800 9px ui-monospace,monospace}.pr-runtime-close:hover{border-color:#31d7f3;color:#31d7f3}
      .pr-runtime-overlay{position:fixed;z-index:80;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,7,11,.94);backdrop-filter:blur(8px)}.pr-runtime-overlay[hidden]{display:none}.pr-runtime-frame{position:relative;width:min(1500px,100%);height:min(940px,calc(100vh - 36px));overflow:auto;border:1px solid #294454;border-radius:8px;box-shadow:0 24px 80px #000b}.pr-runtime-root{height:100%}
      @media(max-width:850px){.pr-workspace{grid-template-columns:1fr}.pr-sim{min-height:440px}.pr-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.pr-metrology{grid-row:span 2}}
      @media(max-width:560px){.pr-shell{padding:7px}.pr-topbar{padding:8px}.pr-brand h1{font-size:14px}.pr-system{display:none}.pr-workspace{display:flex;flex-direction:column}.pr-sim{min-height:390px;grid-template-rows:auto minmax(270px,1fr) auto}.pr-panel{display:flex;overflow:auto}.pr-metrology{grid-row:auto}.pr-footer-note{display:none}}
    `;
    doc.head.appendChild(style);
  }

  function mount(options) {
    // The same renderer mounts into the standalone document or the game's modal; bridge callbacks are optional outside the game.
    const THREE = options.THREE || global.THREE;
    const root = options.root || global.document;
    const doc = root.ownerDocument || root;
    const bridge = options.bridge || {};
    if (!THREE || !THREE.WebGLRenderer) throw new Error('Three.js WebGLRenderer is required.');
    addStyles(doc);
    if (!root.querySelector('#simulationViewport')) root.innerHTML = markup();

    const find = id => root.querySelector('#' + id);
    const viewport = find('simulationViewport');
    const armToggle = find('armToggle');
    const armReadout = find('armReadout');
    const flowSlider = find('flowSlider');
    const flowReadout = find('flowReadout');
    const speedSlider = find('speedSlider');
    const speedReadout = find('speedReadout');
    const depositButton = find('depositButton');
    const depositState = find('depositState');
    const interlock = find('interlock');
    const interlockText = find('interlockText');
    const particleBadge = find('particleBadge');
    const thicknessReadout = find('thicknessReadout');
    const thicknessMeter = find('thicknessMeter');
    const uniformityReadout = find('uniformityReadout');
    const profileBars = find('profileBars');
    const doorButton = find('doorButton');
    const doorReadout = find('doorReadout');
    const doorHint = find('doorHint');
    const resetButton = find('resetButton');
    const systemStateText = find('systemStateText');
    if ([viewport, armToggle, flowSlider, speedSlider, depositButton, profileBars].some(value => !value)) {
      throw new Error('Photoresist station dashboard markup is incomplete.');
    }

    const profileNodes = [];
    for (let i = 0; i < BIN_COUNT; i++) {
      const bar = doc.createElement('i');
      profileBars.appendChild(bar);
      profileNodes.push(bar);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080e14);
    scene.fog = new THREE.Fog(0x080e14, 11, 24);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
    let radius = 10.2;
    let azimuth = 0.72;
    let elevation = 0.34;
    const target = new THREE.Vector3(0, 1.45, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    viewport.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbdeeff, 0x111820, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-4, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x31d7f3, 42, 14);
    fillLight.position.set(1, 3.2, 1.8);
    scene.add(fillLight);

    const materials = {
      shell: new THREE.MeshStandardMaterial({ color: 0x182732, metalness: 0.62, roughness: 0.35 }),
      panel: new THREE.MeshStandardMaterial({ color: 0x233846, metalness: 0.55, roughness: 0.29, transparent: true, opacity: 0.46, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: 0x09131a, metalness: 0.3, roughness: 0.55 }),
      cyan: new THREE.MeshStandardMaterial({ color: 0x31d7f3, metalness: 0.36, roughness: 0.25, emissive: 0x07313b }),
      pink: new THREE.MeshStandardMaterial({ color: 0xe84fce, metalness: 0.05, roughness: 0.24, emissive: 0x3c082f }),
      wafer: new THREE.MeshStandardMaterial({ color: 0x8bcbd9, metalness: 0.7, roughness: 0.24 }),
      resistFilm: new THREE.MeshStandardMaterial({ color: 0xf05bd7, metalness: 0.12, roughness: 0.22, transparent: true, opacity: 0.5, emissive: 0x26051f })
    };
    const chamber = new THREE.Group();
    scene.add(chamber);
    function box(width, height, depth, material, parent, x = 0, y = 0, z = 0) {
      const object = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      object.position.set(x, y, z);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }
    const halfW = LIMITS.width * 0.5;
    const halfD = LIMITS.depth * 0.5;
    box(LIMITS.width, 0.22, LIMITS.depth, materials.shell, chamber, 0, 0, 0);
    box(0.12, LIMITS.height, LIMITS.depth, materials.shell, chamber, -halfW, LIMITS.height * 0.5, 0);
    box(0.12, LIMITS.height, LIMITS.depth, materials.shell, chamber, halfW, LIMITS.height * 0.5, 0);
    box(LIMITS.width, LIMITS.height, 0.12, materials.shell, chamber, 0, LIMITS.height * 0.5, -halfD);
    box(LIMITS.width, 0.12, LIMITS.depth, materials.shell, chamber, 0, LIMITS.height, 0);
    box(LIMITS.width - 0.2, 0.06, LIMITS.depth - 0.2, materials.dark, chamber, 0, LIMITS.floor, 0);

    const platform = new THREE.Group();
    platform.position.set(0, LIMITS.waferY, 0);
    chamber.add(platform);
    const chuck = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.65, 0.18, 64), materials.shell);
    chuck.position.y = -0.07;
    platform.add(chuck);
    const wafer = new THREE.Mesh(new THREE.CylinderGeometry(LIMITS.waferRadius, LIMITS.waferRadius, 0.055, 96), materials.wafer);
    wafer.position.y = 0.05;
    platform.add(wafer);
    const film = new THREE.Mesh(new THREE.CircleGeometry(LIMITS.waferRadius * 0.985, 96), materials.resistFilm);
    film.rotation.x = -Math.PI / 2;
    film.position.y = 0.081;
    platform.add(film);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(LIMITS.waferRadius, 0.018, 8, 96), materials.cyan);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.079;
    platform.add(rim);

    const armPivot = new THREE.Group();
    armPivot.position.set(-2.48, 3.45, -2.02);
    chamber.add(armPivot);
    const pivotCap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.24, 24), materials.cyan);
    pivotCap.rotation.z = Math.PI / 2;
    armPivot.add(pivotCap);
    const armLength = Math.hypot(2.48, 2.02);
    const armBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, armLength, 16), materials.shell);
    armBeam.rotation.z = -Math.PI / 2;
    armBeam.position.x = armLength * 0.5;
    armPivot.add(armBeam);
    const armHighlight = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, armLength * 0.92, 8), materials.cyan);
    armHighlight.rotation.z = -Math.PI / 2;
    armHighlight.position.set(armLength * 0.5, -0.105, 0);
    armPivot.add(armHighlight);
    const nozzle = new THREE.Group();
    nozzle.position.x = armLength;
    armPivot.add(nozzle);
    const nozzleHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.23), materials.dark);
    nozzleHead.position.y = -0.08;
    nozzle.add(nozzleHead);
    const nozzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.18, 16), materials.pink);
    nozzleTip.position.y = -0.3;
    nozzle.add(nozzleTip);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.68, 10), materials.cyan);
    tube.position.set(0, 0.42, 0);
    nozzle.add(tube);

    // The front door rotates around a real scene pivot; the damped spring gives it inertia without a heavyweight rigid-body engine.
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-halfW + 0.08, LIMITS.floor, halfD - 0.12);
    chamber.add(doorPivot);
    const door = box(LIMITS.width - 0.3, LIMITS.height - 0.36, 0.13, materials.panel, doorPivot, (LIMITS.width - 0.3) * 0.5, (LIMITS.height - 0.36) * 0.5, 0);
    door.material = materials.panel.clone();
    door.material.opacity = 0.63;
    const handle = box(0.09, 0.42, 0.12, materials.cyan, doorPivot, LIMITS.width - 0.62, 1.78, 0.1);
    const hinges = [0.28, LIMITS.height - 0.38].map(y => {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 16), materials.cyan);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.set(0.05, y, 0);
      doorPivot.add(hinge);
      return hinge;
    });

    const beadGeometry = new THREE.SphereGeometry(PARTICLE_RADIUS, 8, 6);
    const particleMesh = new THREE.InstancedMesh(beadGeometry, materials.pink, MAX_PARTICLES);
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleMesh.frustumCulled = false;
    scene.add(particleMesh);
    const dummy = new THREE.Object3D();
    const active = [];
    const pool = [];
    const deposited = new Float32Array(BIN_COUNT);
    let nextParticleId = 1;
    let doorAngle = 0;
    let doorVelocity = 0;
    let doorTarget = 0;
    let doorLocked = true;
    let armTarget = 0;
    let armAngle = 0;
    let depositing = false;
    let flow = 45;
    let rpm = 900;
    let lastEmission = 0;
    let lastFrame = 0;
    let frameId = 0;
    let destroyed = false;
    let pointer = null;
    let orbitPointer = null;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const canvas = renderer.domElement;

    const surfaces = [
      { kind: 'plane', axis: 'x', value: -halfW + 0.12, normal: { x: 1, y: 0, z: 0 }, bounds: bounds(-halfW - 0.04, 0, -halfD, -halfW + 0.2, LIMITS.height, halfD) },
      { kind: 'plane', axis: 'x', value: halfW - 0.12, normal: { x: -1, y: 0, z: 0 }, bounds: bounds(halfW - 0.2, 0, -halfD, halfW + 0.04, LIMITS.height, halfD) },
      { kind: 'plane', axis: 'z', value: -halfD + 0.12, normal: { x: 0, y: 0, z: 1 }, bounds: bounds(-halfW, 0, -halfD - 0.04, halfW, LIMITS.height, -halfD + 0.2) },
      { kind: 'plane', axis: 'y', value: LIMITS.floor + 0.05, normal: { x: 0, y: 1, z: 0 }, bounds: bounds(-halfW, LIMITS.floor - 0.05, -halfD, halfW, LIMITS.floor + 0.2, halfD) },
      { kind: 'plane', axis: 'y', value: LIMITS.height - 0.12, normal: { x: 0, y: -1, z: 0 }, bounds: bounds(-halfW, LIMITS.height - 0.2, -halfD, halfW, LIMITS.height + 0.04, halfD) },
      { kind: 'wafer', bounds: bounds(-LIMITS.waferRadius, LIMITS.waferY + 0.06, -LIMITS.waferRadius, LIMITS.waferRadius, LIMITS.waferY + 0.14, LIMITS.waferRadius) }
    ];
    const doorSurface = { kind: 'plane', axis: 'z', value: halfD - 0.15, normal: { x: 0, y: 0, z: -1 }, bounds: bounds(-halfW, 0, halfD - 0.24, halfW, LIMITS.height, halfD + 0.02) };

    function newParticle() {
      const particle = pool.pop() || { position: new THREE.Vector3(), velocity: new THREE.Vector3(), id: 0, radius: PARTICLE_RADIUS, bounds: null };
      particle.id = nextParticleId++;
      particle.position.set(0, 0, 0);
      particle.velocity.set(0, 0, 0);
      particle.retired = false;
      particle.previousY = 0;
      return particle;
    }

    function retire(particle) {
      // Remove each particle once and reuse its vector-bearing record instead of allocating during long deposition runs.
      if (particle.retired) return;
      particle.retired = true;
      const index = active.indexOf(particle);
      if (index >= 0) active.splice(index, 1);
      if (pool.length < MAX_PARTICLES) pool.push(particle);
    }

    function emit(time) {
      if (!depositing || !armExtended() || doorIsOpen() || active.length >= MAX_PARTICLES) return;
      const interval = Math.max(7, 1000 / (25 + flow * 1.2));
      if (time - lastEmission < interval) return;
      lastEmission = time;
      armPivot.updateMatrixWorld(true);
      const origin = nozzleTip.getWorldPosition(new THREE.Vector3());
      const particle = newParticle();
      particle.position.set(origin.x + (Math.random() - 0.5) * 0.08, origin.y - 0.13, origin.z + (Math.random() - 0.5) * 0.08);
      particle.velocity.set((Math.random() - 0.5) * 0.12, -0.35 - Math.random() * 0.2, (Math.random() - 0.5) * 0.12);
      active.push(particle);
    }

    function armExtended() { return armTarget > 0.5; }
    function doorIsOpen() { return doorAngle > 0.08; }

    function depositParticle(particle) {
      const x = particle.position.x;
      const bin = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((x / (LIMITS.waferRadius * 2) + 0.5) * BIN_COUNT)));
      deposited[bin] += 1;
      retire(particle);
    }

    function bounce(particle, surface) {
      const axis = surface.axis;
      const normal = surface.normal;
      const distance = (particle.position[axis] - surface.value) * normal[axis];
      if (distance >= particle.radius) return;
      const penetration = particle.radius - distance;
      particle.position.x += normal.x * penetration;
      particle.position.y += normal.y * penetration;
      particle.position.z += normal.z * penetration;
      const normalSpeed = particle.velocity.x * normal.x + particle.velocity.y * normal.y + particle.velocity.z * normal.z;
      if (normalSpeed < 0) {
        particle.velocity.x -= normal.x * normalSpeed * 1.3;
        particle.velocity.y -= normal.y * normalSpeed * 1.3;
        particle.velocity.z -= normal.z * normalSpeed * 1.3;
      }
    }

    function collidePair(a, b) {
      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const dz = b.position.z - a.position.z;
      const minDistance = a.radius + b.radius;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared <= 0.000001 || distanceSquared >= minDistance * minDistance) return;
      const distance = Math.sqrt(distanceSquared);
      const nx = dx / distance, ny = dy / distance, nz = dz / distance;
      const overlap = (minDistance - distance) * 0.5;
      a.position.x -= nx * overlap; a.position.y -= ny * overlap; a.position.z -= nz * overlap;
      b.position.x += nx * overlap; b.position.y += ny * overlap; b.position.z += nz * overlap;
      const relative = (b.velocity.x - a.velocity.x) * nx + (b.velocity.y - a.velocity.y) * ny + (b.velocity.z - a.velocity.z) * nz;
      if (relative < 0) {
        const impulse = -relative * 0.22;
        a.velocity.x -= nx * impulse; a.velocity.y -= ny * impulse; a.velocity.z -= nz * impulse;
        b.velocity.x += nx * impulse; b.velocity.y += ny * impulse; b.velocity.z += nz * impulse;
      }
    }

    function collideWafer(particle) {
      const top = LIMITS.waferY + 0.081;
      // Compare the pre/post integration height so fast drops cannot tunnel through the thin wafer surface.
      if (particle.previousY < top || particle.position.y > top || particle.velocity.y >= 0) return false;
      {
        if (particle.position.x * particle.position.x + particle.position.z * particle.position.z > LIMITS.waferRadius ** 2) {
          retire(particle);
          return true;
        }
        particle.position.y = top + particle.radius;
        depositParticle(particle);
        return true;
      }
      return false;
    }

    // A compact octree is rebuilt per step after integration; large surfaces remain in ancestor nodes while particles descend to local leaves.
    function updateParticles(dt, now) {
      for (const particle of active) {
        particle.velocity.y -= GRAVITY * dt;
        const radialX = particle.position.x;
        const radialZ = particle.position.z;
        const nearWafer = Math.abs(particle.position.y - (LIMITS.waferY + 0.12)) < 0.5 && radialX * radialX + radialZ * radialZ < (LIMITS.waferRadius + 0.3) ** 2;
        if (nearWafer && rpm > 0) {
          const spin = (rpm / 1800) * 3.4;
          particle.velocity.x += (-radialZ * spin - particle.velocity.x) * dt * 0.24;
          particle.velocity.z += (radialX * spin - particle.velocity.z) * dt * 0.24;
        }
        particle.previousY = particle.position.y;
        particle.position.addScaledVector(particle.velocity, dt);
        const r = particle.radius;
        particle.bounds = bounds(particle.position.x - r, particle.position.y - r, particle.position.z - r, particle.position.x + r, particle.position.y + r, particle.position.z + r);
      }
      const tree = new Octree(bounds(-halfW - 0.1, -0.1, -halfD - 0.1, halfW + 0.1, LIMITS.height + 0.1, halfD + 0.1));
      for (const surface of surfaces) tree.insert(surface);
      if (doorAngle < 0.12) tree.insert(doorSurface);
      for (const particle of active) tree.insert({ kind: 'particle', particle, bounds: particle.bounds });

      // Query only nearby octree leaves for particle and surface response; the mesh is one instanced draw for the whole population.
      for (let i = active.length - 1; i >= 0; i--) {
        const particle = active[i];
        const neighbors = [];
        tree.querySphere(particle.position, 0.12, neighbors);
        for (const item of neighbors) {
          if (item.kind === 'particle' && !item.particle.retired && item.particle.id > particle.id) collidePair(particle, item.particle);
          else if (item.kind === 'plane') bounce(particle, item);
          else if (item.kind === 'wafer' && collideWafer(particle)) break;
        }
        if (particle.retired) continue;
        if (particle.position.y < LIMITS.floor + 0.08 || particle.position.z > halfD + 0.2 || Math.abs(particle.position.x) > halfW + 0.2) retire(particle);
      }
      for (let i = 0; i < active.length; i++) {
        const particle = active[i];
        dummy.position.copy(particle.position);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        particleMesh.setMatrixAt(i, dummy.matrix);
      }
      particleMesh.count = active.length;
      particleMesh.instanceMatrix.needsUpdate = true;
      particleBadge.textContent = active.length + ' particles';
      emit(now);
    }

    function updateMetrology() {
      // Thickness is accumulated per left-to-right wafer bin, then reduced into an average and coefficient-of-variation score.
      let total = 0;
      for (const amount of deposited) total += amount;
      const averageNm = total * DEPOSIT_NM_PER_PARTICLE;
      thicknessReadout.value = averageNm.toFixed(1);
      thicknessMeter.style.width = Math.min(100, averageNm / 14) + '%';
      const peak = Math.max(1, ...deposited);
      deposited.forEach((value, index) => { profileNodes[index].style.height = Math.max(2, value / peak * 40) + 'px'; });
      const mean = total / BIN_COUNT;
      const variance = deposited.reduce((sum, value) => sum + (value - mean) ** 2, 0) / BIN_COUNT;
      const uniformity = total < 3 ? null : Math.max(0, 100 - Math.sqrt(variance) / Math.max(0.001, mean) * 45);
      uniformityReadout.textContent = uniformity == null ? 'Uniformity --' : 'Uniformity ' + uniformity.toFixed(1) + '%';
      film.material.opacity = Math.min(0.82, 0.24 + averageNm / 2200);
      if (bridge.onReadout) bridge.onReadout({ thicknessNm: averageNm, uniformity, flow, rpm, armExtended: armExtended(), doorOpen: doorIsOpen(), deposited: total });
    }

    function setArm(extended, notify = true) {
      armTarget = extended ? 1 : 0;
      armToggle.classList.toggle('active', !!extended);
      armToggle.setAttribute('aria-checked', String(!!extended));
      armReadout.textContent = extended ? 'EXTENDED' : 'RETRACTED';
      if (notify && bridge.setArm) bridge.setArm(!!extended);
      updateInterlocks();
    }

    function operateDoor() {
      if (doorLocked) {
        doorLocked = false;
        doorTarget = 1.18;
      } else if (doorTarget > 0.5 || doorAngle > 0.08) {
        doorTarget = 0;
      } else {
        doorLocked = true;
      }
      if (bridge.setDoor) bridge.setDoor(doorTarget > 0.5);
      updateDoorReadout();
      updateInterlocks();
    }

    function updateDoorReadout() {
      if (doorAngle <= 0.08 && doorTarget === 0) {
        if (!doorLocked) doorLocked = true;
        doorReadout.textContent = doorLocked ? 'LOCKED' : 'CLOSED';
      } else doorReadout.textContent = 'OPEN';
      doorButton.textContent = doorLocked ? 'UNLOCK & OPEN' : doorTarget > 0.5 || doorAngle > 0.08 ? 'CLOSE DOOR' : 'LOCK DOOR';
      if (doorHint) doorHint.textContent = doorLocked ? 'Door is latched at the frame edge.' : 'Door hinge is free; close it to re-engage the latch.';
    }

    function updateInterlocks() {
      const runtime = bridge.getState ? bridge.getState() : null;
      const ready = armExtended() && !doorIsOpen() && (!runtime || runtime.canStart || runtime.running);
      depositButton.disabled = !ready && !depositing;
      interlock.classList.toggle('bad', !ready && !depositing);
      if (doorIsOpen()) interlockText.textContent = 'Interlock: close and lock chamber door';
      else if (!armExtended()) interlockText.textContent = 'Interlock: extend feed tube';
      else if (runtime && !runtime.canStart && !runtime.running) interlockText.textContent = 'Interlock: load a wafer and close the door';
      else interlockText.textContent = 'Interlock: deposition enabled';
      if (!ready && depositing) stopDeposit();
    }

    function startDeposit(event) {
      if (event) event.preventDefault();
      updateInterlocks();
      if (depositButton.disabled) return;
      if (bridge.onStart && bridge.onStart() === false) {
        updateInterlocks();
        return;
      }
      depositing = true;
      depositButton.classList.add('pressed');
      depositState.textContent = 'FLOWING';
      systemStateText.textContent = 'Depositing photoresist';
      updateInterlocks();
    }

    function stopDeposit(event, notify = true) {
      if (event) event.preventDefault();
      if (!depositing) return;
      depositing = false;
      depositButton.classList.remove('pressed');
      depositState.textContent = 'STANDBY';
      systemStateText.textContent = 'System ready';
      if (notify && bridge.onStop) bridge.onStop();
      updateInterlocks();
    }

    function resize() {
      const rect = viewport.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    function updateCamera() {
      const horizontal = radius * Math.cos(elevation);
      camera.position.set(target.x + Math.sin(azimuth) * horizontal, target.y + Math.sin(elevation) * radius, target.z + Math.cos(azimuth) * horizontal);
      camera.lookAt(target);
    }

    function onPointerDown(event) {
      if (event.button !== 0) return;
      pointer = { x: event.clientX, y: event.clientY, moved: false };
      orbitPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
    }

    function onPointerMove(event) {
      if (!orbitPointer) return;
      const dx = event.clientX - orbitPointer.x;
      const dy = event.clientY - orbitPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 3 && pointer) pointer.moved = true;
      orbitPointer.x = event.clientX;
      orbitPointer.y = event.clientY;
      azimuth -= dx * 0.006;
      elevation = Math.max(-0.02, Math.min(1.05, elevation + dy * 0.005));
      updateCamera();
    }

    function onPointerUp(event) {
      orbitPointer = null;
      if (pointer && !pointer.moved) {
        const rect = canvas.getBoundingClientRect();
        pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointerNdc, camera);
        if (raycaster.intersectObjects([handle, door], false).length) operateDoor();
      }
      pointer = null;
    }

    function onWheel(event) {
      event.preventDefault();
      radius = Math.max(6.2, Math.min(15, radius + event.deltaY * 0.008));
      updateCamera();
    }

    function onFlow() {
      flow = Number(flowSlider.value);
      flowReadout.value = flow + ' %';
      if (bridge.setFlow) bridge.setFlow(flow);
      updateMetrology();
    }

    function onSpeed() {
      rpm = Number(speedSlider.value);
      speedReadout.value = rpm + ' rpm';
      if (bridge.setRpm) bridge.setRpm(rpm);
      updateMetrology();
    }

    function resetProcess() {
      stopDeposit(null, false);
      for (const particle of active) pool.push(particle);
      active.length = 0;
      deposited.fill(0);
      doorAngle = 0;
      doorVelocity = 0;
      doorTarget = 0;
      doorLocked = true;
      updateDoorReadout();
      updateMetrology();
      if (bridge.onReset) bridge.onReset();
    }

    armToggle.addEventListener('click', () => setArm(armTarget < 0.5));
    doorButton.addEventListener('click', operateDoor);
    resetButton.addEventListener('click', resetProcess);
    flowSlider.addEventListener('input', onFlow);
    speedSlider.addEventListener('input', onSpeed);
    depositButton.addEventListener('pointerdown', startDeposit);
    depositButton.addEventListener('pointerup', stopDeposit);
    depositButton.addEventListener('pointercancel', stopDeposit);
    depositButton.addEventListener('mouseleave', stopDeposit);
    global.addEventListener('pointerup', stopDeposit);
    global.addEventListener('blur', stopDeposit);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    global.addEventListener('resize', resize);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport);
    resize();
    updateCamera();
    updateDoorReadout();
    updateMetrology();
    setArm(false, false);

    function animate(now) {
      if (destroyed) return;
      frameId = global.requestAnimationFrame(animate);
      if (root.closest?.('[hidden]')) return;
      const dt = Math.min(0.025, Math.max(0, (now - (lastFrame || now)) / 1000));
      lastFrame = now;
      const armAngleTarget = armTarget ? -Math.atan2(2.02, 2.48) : 0;
      armAngle += (armAngleTarget - armAngle) * (1 - Math.exp(-dt * 4.2));
      armPivot.rotation.y = armAngle;
      const doorAcceleration = (doorTarget - doorAngle) * 17 - doorVelocity * 7.5;
      doorVelocity += doorAcceleration * dt;
      doorAngle = Math.max(0, Math.min(1.22, doorAngle + doorVelocity * dt));
      doorPivot.rotation.y = -doorAngle;
      if (Math.abs(doorAngle - doorTarget) < 0.006) {
        doorAngle = doorTarget;
        doorVelocity = 0;
      }
      platform.rotation.y += dt * (rpm / 1800) * 1.7;
      updateDoorReadout();
      updateInterlocks();
      updateParticles(dt, now);
      if (frameId % 6 === 0) updateMetrology();
      renderer.render(scene, camera);
    }
    frameId = global.requestAnimationFrame(animate);

    return {
      dispose() {
        destroyed = true;
        global.cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        global.removeEventListener('resize', resize);
        stopDeposit();
        renderer.dispose();
        renderer.domElement.remove();
        for (const material of Object.values(materials)) material.dispose();
        beadGeometry.dispose();
      },
      reset: resetProcess,
      resize,
      setRuntimeState(runtime) {
        if (!runtime) return;
        if (Number.isFinite(runtime.flowPercent) && Number(flowSlider.value) !== runtime.flowPercent) {
          flowSlider.value = String(runtime.flowPercent);
          onFlow();
        }
        if (Number.isFinite(runtime.rpmDisplay) && Number(speedSlider.value) !== runtime.rpmDisplay) {
          speedSlider.value = String(runtime.rpmDisplay);
          onSpeed();
        }
        if (runtime.doorOpen !== undefined && runtime.doorOpen !== doorIsOpen()) {
          doorLocked = !runtime.doorOpen;
          doorTarget = runtime.doorOpen ? 1.18 : 0;
          updateDoorReadout();
        }
        updateInterlocks();
      }
    };
  }

  global.PhotoresistChamber = { mount };
})(window);
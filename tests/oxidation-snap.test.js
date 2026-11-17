const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function createThreeStub() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    divideScalar(s) { return this.multiplyScalar(1 / s); }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    lerp(v, t) {
      this.x += (v.x - this.x) * t;
      this.y += (v.y - this.y) * t;
      this.z += (v.z - this.z) * t;
      return this;
    }
    length() { return Math.hypot(this.x, this.y, this.z); }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    clampLength(min, max) {
      const len = this.length();
      if (len > max && len > 0) this.multiplyScalar(max / len);
      return this;
    }
    normalize() {
      const len = this.length() || 1;
      return this.divideScalar(len);
    }
    negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
    applyQuaternion(q) {
      const x = this.x, y = this.y, z = this.z;
      const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
      const ix = qw * x + qy * z - qz * y;
      const iy = qw * y + qz * x - qx * z;
      const iz = qw * z + qx * y - qy * x;
      const iw = -qx * x - qy * y - qz * z;
      this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
      this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
      this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
      return this;
    }
    applyMatrix4() { return this; }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  }

  class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
    set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
    copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
    clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
    setFromEuler() { return this; }
    setFromAxisAngle(axis, angle) {
      const half = angle * 0.5, s = Math.sin(half);
      this.x = axis.x * s; this.y = axis.y * s; this.z = axis.z * s; this.w = Math.cos(half);
      return this;
    }
    setFromUnitVectors(vFrom, vTo) {
      let r = vFrom.dot(vTo) + 1;
      if (r < 1e-6) {
        r = 0;
        if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) { this.x = -vFrom.y; this.y = vFrom.x; this.z = 0; this.w = r; }
        else { this.x = 0; this.y = -vFrom.z; this.z = vFrom.y; this.w = r; }
      } else {
        this.x = vFrom.y * vTo.z - vFrom.z * vTo.y;
        this.y = vFrom.z * vTo.x - vFrom.x * vTo.z;
        this.z = vFrom.x * vTo.y - vFrom.y * vTo.x;
        this.w = r;
      }
      return this.normalize();
    }
    multiply(q) {
      const ax = this.x, ay = this.y, az = this.z, aw = this.w;
      const bx = q.x, by = q.y, bz = q.z, bw = q.w;
      this.x = ax * bw + aw * bx + ay * bz - az * by;
      this.y = ay * bw + aw * by + az * bx - ax * bz;
      this.z = az * bw + aw * bz + ax * by - ay * bx;
      this.w = aw * bw - ax * bx - ay * by - az * bz;
      return this;
    }
    premultiply(q) {
      const ax = q.x, ay = q.y, az = q.z, aw = q.w;
      const bx = this.x, by = this.y, bz = this.z, bw = this.w;
      this.x = ax * bw + aw * bx + ay * bz - az * by;
      this.y = ay * bw + aw * by + az * bx - ax * bz;
      this.z = az * bw + aw * bz + ax * by - ay * bx;
      this.w = aw * bw - ax * bx - ay * by - az * bz;
      return this;
    }
    normalize() {
      const l = Math.hypot(this.x, this.y, this.z, this.w) || 1;
      this.x /= l; this.y /= l; this.z /= l; this.w /= l;
      return this;
    }
    invert() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
    slerp(q, t) {
      this.x += (q.x - this.x) * t;
      this.y += (q.y - this.y) * t;
      this.z += (q.z - this.z) * t;
      this.w += (q.w - this.w) * t;
      return this.normalize();
    }
  }

  class Euler {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
  }

  class Matrix4 {
    identity() { return this; }
    extractRotation() { return this; }
  }

  class Object3D {
    constructor() {
      this.position = new Vector3();
      this.rotation = new Euler();
      this.quaternion = new Quaternion();
      this.scale = new Vector3(1, 1, 1);
      this.children = [];
      this.parent = null;
      this.visible = true;
      this.userData = {};
      this.material = { color: { setHex() {} }, opacity: 1 };
      this.matrixWorld = new Matrix4();
    }
    add(...objs) {
      for (const o of objs) {
        if (o.parent) o.parent.remove(o);
        o.parent = this;
        this.children.push(o);
      }
    }
    remove(o) {
      const idx = this.children.indexOf(o);
      if (idx >= 0) this.children.splice(idx, 1);
      if (o.parent === this) o.parent = null;
    }
    attach(o) { this.add(o); }
    updateMatrixWorld() {}
    updateWorldMatrix() {}
    rotateZ() {}
    getWorldPosition(out = new Vector3()) {
      out.copy(this.position);
      let p = this.parent;
      while (p) {
        out.add(p.position);
        p = p.parent;
      }
      return out;
    }
    getWorldQuaternion(out = new Quaternion()) {
      return out.copy(this.quaternion);
    }
    traverse(fn) {
      fn(this);
      for (const c of this.children) c.traverse(fn);
    }
  }

  class Group extends Object3D {}
  class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m || this.material; } }
  class Line extends Object3D {}
  class BufferGeometry { setFromPoints() { return this; } setAttribute() { return this; } setIndex() { return this; } computeVertexNormals() {} }
  class Float32BufferAttribute {}
  class MeshBasicMaterial { constructor(opts = {}) { Object.assign(this, opts); this.color = { setHex() {} }; } clone() { return new MeshBasicMaterial(this); } }
  class SphereGeometry {}
  class CylinderGeometry {}
  class Raycaster { constructor() { this.ray = { origin: new Vector3(), direction: new Vector3(0, 0, -1) }; } setFromCamera() {} set() {} intersectObjects() { return []; } }

  return {
    Vector3, Quaternion, Euler, Matrix4, Object3D, Group, Mesh, Line,
    BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, LineBasicMaterial: MeshBasicMaterial, SphereGeometry, CylinderGeometry, Raycaster,
    DoubleSide: 2
  };
}

function createOxidationSandbox() {
  const THREE = createThreeStub();
  const scene = new THREE.Group();
  const camera = new THREE.Object3D();
  const player = new THREE.Object3D();
  player.add(camera);
  scene.add(player);

  const locatorWorld = new THREE.Vector3(6.3, 1.82, 3.0);
  const oxWafer = new THREE.Object3D();
  oxWafer.position.copy(locatorWorld);
  scene.add(oxWafer);

  const oxDoor = new THREE.Object3D();
  const oxMachine = {
    kind: 'fabrication',
    group: new THREE.Group(),
    wafer: oxWafer,
    door: oxDoor,
    doorHandle: new THREE.Object3D(),
    body: null
  };

  const domById = new Map();
  const makeEl = id => {
    const el = {
      id,
      textContent: '',
      innerHTML: '',
      value: '0',
      hidden: false,
      disabled: false,
      style: {},
      className: '',
      classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {},
      addEventListener() {},
      querySelectorAll() { return []; },
      appendChild() {}
    };
    domById.set(id, el);
    return el;
  };
  for (const id of ['lotId', 'cycleBar', 'cycleName', 'cycleTime', 'cycleFill', 'gainSlider', 'interceptSlider', 'designTerminal', 'designCanvas', 'pauseUnstuck', 'crosshair', 'focusTag', 'prompt', 'actionBtn']) {
    makeEl(id);
  }

  const xrController0 = new THREE.Object3D();
  const xrPinch0 = new THREE.Object3D();
  xrController0.add(xrPinch0);
  xrController0.userData = { handIndex: 0, handedness: 'left', pinchAnchor: xrPinch0 };
  scene.add(xrController0);

  let presenting = false;
  const renderer = {
    domElement: { addEventListener() {}, requestPointerLock() {} },
    xr: {
      get isPresenting() { return presenting; },
      addEventListener() {}
    }
  };

  const status = [
    { state: 'complete', values: {}, score: 100, deviations: [], metric: 24, doorTarget: 0, doorAmount: 0, cycle: null },
    { state: 'ready', values: {}, score: null, deviations: [], metric: 0, doorTarget: 1, doorAmount: 1, cycle: null }
  ];
  const stations = [
    { name: 'Sensor Design Terminal', short: 'CCD layout release', side: -1, z: 7, type: 'design', targetSeconds: 24, controls: [], metric: { label: 'Design', unit: 's', target: 24, tol: 2 } },
    { name: 'Oxidation Furnace', short: 'Grow gate/mask oxide', side: 1, z: 3, type: 'deposition', targetSeconds: 30, controls: [], metric: { label: 'Oxide thickness', unit: 'nm', target: 120, tol: 8 } }
  ];

  const sandbox = {
    THREE,
    Math,
    Number,
    String,
    Array,
    Set,
    Map,
    Object,
    JSON,
    Infinity,
    DOOR_MAGNET_ANGLE: 5 / 90,
    performance: { now: () => 1000 },
    $: id => domById.get(id) || makeEl(id),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    C: { cyan: 0x53e7ff, green: 0x67f6a3, amber: 0xffcf56 },
    scene,
    camera,
    player,
    renderer,
    stations,
    status,
    machines: [{}, { kind: 'design', wafer: new THREE.Object3D(), body: null }, oxMachine],
    stockMachine: null,
    colliders: [],
    sharpsBins: [],
    waferShards: [],
    interactives: [],
    keys: {},
    yaw: 0,
    pitch: 0,
    state: {
      started: true,
      paused: false,
      carrying: false,
      current: 1,
      completed: false,
      runStart: 100,
      records: [],
      pattern: 'Logic grid',
      lotId: 'SR-1000',
      handWafer: new THREE.Object3D(),
      waferBroken: false,
      focus: null,
      nearest: null,
      cycle: null
    },
    phys: {
      grab: null,
      doorGrab: null,
      doorVelocities: [0, 0],
      pinchDistance: 0.25,
      stockReady: null,
      stockRespawnAt: 0,
      waferEverPicked: false,
      pickupGuide: null,
      handData: [{}, {}],
      crouchHeld: false,
      baseRigY: 0.86
    },
    xrController0,
    xrController1: new THREE.Object3D(),
    xrLeftSource: null,
    xrRightSource: null,
    xrObjectiveBeacon: null,
    xrTargetRing: null,
    xrHandsetCtx: null,
    xrHandsetTexture: null,
    designMode: { phase: 'idle', step: 0, layer: 'M1', layoutNodes: [], layoutRoutes: [], layoutDraft: null, layoutHoverNodes: [], releasedBodies: new Set(), schematicLinks: new Set() },
    createWafer: () => new THREE.Object3D(),
    refreshWaferVisual: () => {},
    detachPreserve: (obj, newParent) => newParent.attach(obj),
    pinchAnchorFor: c => c?.userData?.pinchAnchor || c,
    pinchWorld: c => (c?.userData?.pinchAnchor || c).getWorldPosition(new THREE.Vector3()),
    ensureWaferPickupGuide: () => new THREE.Object3D(),
    nearestPinchTarget: () => null,
    createMachine: () => {},
    buildEnvironment: () => {},
    updateStockSupply: () => {},
    updateWaferPickupGuide: () => {},
    dispenseWafer: () => {},
    grabWafer: () => false,
    releaseWafer: () => {},
    tryPlaceWafer: () => false,
    exposeCompletedWafer: () => {},
    shatterWafer: () => {},
    grabShard: () => false,
    releaseShard: () => {},
    updateShards: () => {},
    updateWaferPhysics: () => {},
    beginControlGrab: () => {},
    updateControlGrab: () => {},
    onXRTriggerStart: () => {},
    onXRTriggerEnd: () => {},
    onXRSqueezeStart: () => {},
    onXRSqueezeEnd: () => {},
    updateXRMovement: () => {},
    updateXRVertical: () => {},
    updateXRSpatial: () => {},
    updatePhysicalSystem: () => {},
    buttonHint: () => '',
    buttonEnabled: () => true,
    adjustControl: () => {},
    loadWafer: () => {},
    unloadWafer: () => {},
    startProcess: () => {},
    stopProcess: () => {},
    updateCycle: () => {},
    completeStage: () => {},
    finishLot: () => {},
    activateFocused: () => {},
    updateXRButtons: () => {},
    newRun: () => {},
    toggleDoor: () => {},
    updateDoors: () => {},
    updateMovement: () => {},
    raycastFocus: () => {},
    getNearest: () => {},
    loop: () => {},
    bind: () => {},
    setLamp: () => {},
    updateAll: () => {},
    updateHUD: () => {},
    XR_POINTER_REACH: 30,
    navigator: {},
    updateControlMeshes: () => {},
    updateMachineGui: () => {},
    toast: () => {},
    pulseXR: () => {},
    scoreProcess: () => ({ score: 100, deviations: [] }),
    recordActivity: () => {},
    updateBenchmark: () => {},
    showReport: () => {},
    quality: () => 100,
    getRuns: () => [],
    drawMap: () => {},
    drawXRHandset: () => {},
    drawXRPauseOverlay: () => {},
    drawXRDeveloperPane: () => {},
    updateDeveloperMetrics: () => {},
    updateGhostHandPose: () => {},
    beginDoorGrab: () => false,
    updateDoorGrab: () => {},
    showXROverlay: () => {},
    hideXROverlay: () => {},
    edgeButton: () => {},
    requestJump: () => {},
    setXRFocus: () => {},
    document: {
      pointerLockElement: null,
      head: { appendChild() {} },
      createElement: () => ({ textContent: '' }),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {}
    },
    window: { addEventListener() {} },
    addEventListener() {},
    queueMicrotask
  };

  sandbox.setPresenting = value => {
    presenting = value;
    sandbox.document.pointerLockElement = value ? null : renderer.domElement;
  };
  sandbox.setPresenting(false);

  const context = vm.createContext(sandbox);
  const parallelSrc = fs.readFileSync(path.join(ROOT, 'js/parallel-wafer-runtime.js'), 'utf8');
  const worldSrc = fs.readFileSync(path.join(ROOT, 'js/design-world-runtime.js'), 'utf8');
  vm.runInContext(parallelSrc, context);
  vm.runInContext(worldSrc, context);

  sandbox.ensureDesktopGrip();
  const body = sandbox.createParallelWafer(new THREE.Vector3(5.25, 1.82, 3.0), new THREE.Quaternion(), false);
  // Leave body.nextStage = 0 (fresh blank wafer) to verify ANY wafer can be inserted into the Oxidation Furnace.

  return { sandbox, body, oxMachine, oxSt: status[1], locatorWorld, xrController0, xrPinch0, THREE };
}

test('Oxidation Furnace (VR): unheld controller movement does nothing; held wafer snaps inside sphere and unsnaps outside', () => {
  const { sandbox, body, oxMachine, oxSt, locatorWorld, xrController0, xrPinch0 } = createOxidationSandbox();
  sandbox.setPresenting(true);
  const snapInfo = sandbox.machineAcceptanceAtPoint(body, locatorWorld);
  assert(snapInfo && snapInfo.radius > 0 && snapInfo.radius < 0.34 * 0.72,
    'Snapping sphere radius must be smaller than the 0.2448m wafer radius');

  // 1. Not held: moving controller into/out of sphere does nothing to wafer position
  const initialPos = body.view.position.clone();
  xrPinch0.position.set(locatorWorld.x + 0.05, locatorWorld.y, locatorWorld.z);
  sandbox.updatePhysicalSystem(0.016, 1016);
  assert.deepEqual(body.view.position, initialPos);

  // 2. Grab wafer near initialPos, then move VR controller inside Oxidation Furnace snapping sphere (<= 0.22m)
  xrPinch0.position.copy(initialPos);
  assert.equal(sandbox.grabWafer(xrController0), true);

  xrPinch0.position.set(locatorWorld.x - 0.12, locatorWorld.y + 0.05, locatorWorld.z);
  sandbox.updatePhysicalSystem(0.016, 1032);
  assert.equal(body.view.position.distanceTo(locatorWorld), 0);

  // 3. Move VR controller to a different point STILL inside the snapping sphere -> wafer does not move
  xrPinch0.position.set(locatorWorld.x + 0.1, locatorWorld.y - 0.08, locatorWorld.z + 0.05);
  sandbox.updatePhysicalSystem(0.016, 1048);
  assert.equal(body.view.position.distanceTo(locatorWorld), 0);

  // 4. Move VR controller OUTSIDE the snapping sphere (0.35m > 0.22m) while still holding -> wafer aims toward controller target
  const outside = { x: locatorWorld.x - 0.35, y: locatorWorld.y, z: locatorWorld.z };
  xrPinch0.position.set(outside.x, outside.y, outside.z);
  sandbox.updatePhysicalSystem(0.05, 1098);
  assert(body.view.position.distanceTo(locatorWorld) > 0.05, 'Wafer must leave locator when held input moves outside sphere');
  assert(body.view.position.x < locatorWorld.x, 'Wafer must aim toward target outside sphere');

  // 5. Move back inside sphere and release VR trigger -> wafer seats into Oxidation Furnace
  xrPinch0.position.set(locatorWorld.x - 0.08, locatorWorld.y, locatorWorld.z);
  sandbox.updatePhysicalSystem(0.016, 1114);
  assert.equal(body.view.position.distanceTo(locatorWorld), 0);
  sandbox.releaseWafer(xrController0);
  assert.equal(oxSt.state, 'loadedDoorOpen');
  assert.equal(oxMachine.body, body);
  assert.equal(oxMachine.wafer.visible, true);
});

test('Oxidation Furnace (PC Mouse): unheld mouse movement does nothing; held wafer snaps inside sphere and unsnaps outside', () => {
  const { sandbox, body, oxMachine, oxSt, locatorWorld } = createOxidationSandbox();
  sandbox.setPresenting(false);

  // Position player/camera so desktopGrip.anchor starts right at the wafer (5.25, 1.82, 3.0)
  const depth = Math.abs(sandbox.camera.children[0].position.z);
  sandbox.player.position.set(5.25, 1.82, 3.0 + depth); // anchor z = -depth -> world (5.25, 1.82, 3.0)

  // 1. Not held: moving player/mouse anchor into the snapping sphere does nothing to wafer
  const initialPos = body.view.position.clone();
  sandbox.player.position.set(locatorWorld.x, locatorWorld.y, locatorWorld.z + depth);
  sandbox.updateDesktopGrip(0.016, 1016);
  assert.deepEqual(body.view.position, initialPos);

  // 2. Move back, hold left mouse to grab wafer, then move mouse/anchor INSIDE snapping sphere
  sandbox.player.position.set(5.25, 1.82, 3.0 + depth);
  assert.equal(sandbox.grabDesktopWafer(), true);

  sandbox.player.position.set(locatorWorld.x - 0.1, locatorWorld.y, locatorWorld.z + depth);
  sandbox.updateDesktopGrip(0.016, 1032);
  assert.equal(body.view.position.distanceTo(locatorWorld), 0);

  // 3. Move mouse/anchor while still held inside sphere -> wafer stays locked at locator
  sandbox.player.position.set(locatorWorld.x + 0.09, locatorWorld.y + 0.06, locatorWorld.z + depth);
  sandbox.updateDesktopGrip(0.016, 1048);
  assert.equal(body.view.position.distanceTo(locatorWorld), 0);

  // 4. Move mouse/anchor OUTSIDE snapping sphere (0.35m > 0.22m) while held -> wafer aims to move there
  sandbox.player.position.set(locatorWorld.x - 0.35, locatorWorld.y, locatorWorld.z + depth);
  sandbox.updateDesktopGrip(0.05, 1098);
  assert(body.view.position.distanceTo(locatorWorld) > 0.05, 'Wafer must unsnap when PC target moves outside sphere');
  assert(body.view.position.x < locatorWorld.x, 'Wafer must aim toward PC target outside sphere');

  // 5. Move back inside sphere and release left mouse -> wafer seats into Oxidation Furnace
  sandbox.player.position.set(locatorWorld.x - 0.08, locatorWorld.y, locatorWorld.z + depth);
  sandbox.updateDesktopGrip(0.016, 1114);
  assert.equal(body.view.position.distanceTo(locatorWorld), 0);
  assert.equal(sandbox.releaseDesktopWafer(true), true);
  assert.equal(oxSt.state, 'loadedDoorOpen');
  assert.equal(oxMachine.body, body);
  assert.equal(oxMachine.wafer.visible, true);
});

test('Oxidation Furnace cannot run unless a wafer is loaded and the door is closed', () => {
  const { sandbox, body, oxMachine, oxSt, locatorWorld } = createOxidationSandbox();
  sandbox.setPresenting(false);

  // Empty chamber with door closed -> cannot start
  oxSt.doorAmount = 0;
  oxSt.doorTarget = 0;
  assert.equal(sandbox.buttonEnabled({ kind: 'machine', action: 'start', machineIndex: 1 }), false);
  assert.equal(sandbox.startProcess(1), false);
  assert.equal(oxSt.state, 'ready');

  // Open door, snap & release wafer -> loadedDoorOpen -> still cannot start until door closes
  oxSt.doorAmount = 1;
  oxSt.doorTarget = 1;
  const depth = Math.abs(sandbox.camera.children[0].position.z);
  sandbox.player.position.set(5.25, 1.82, 3.0 + depth);
  assert.equal(sandbox.grabDesktopWafer(), true);
  sandbox.player.position.set(locatorWorld.x, locatorWorld.y, locatorWorld.z + depth);
  sandbox.updateDesktopGrip(0.016, 1032);
  assert.equal(sandbox.releaseDesktopWafer(true), true);
  assert.equal(oxSt.state, 'loadedDoorOpen');
  assert.equal(sandbox.buttonEnabled({ kind: 'machine', action: 'start', machineIndex: 1 }), false);
  assert.equal(sandbox.startProcess(1), false);

  // Close door -> loaded -> now machine can start
  oxSt.doorAmount = 0;
  oxSt.doorTarget = 0;
  oxSt.state = 'loaded';
  assert.equal(sandbox.buttonEnabled({ kind: 'machine', action: 'start', machineIndex: 1 }), true);
  assert.equal(sandbox.startProcess(1), true);
  assert.equal(oxSt.state, 'running');
  assert.equal(oxMachine.body, body);
});

test('Latching magnetic interlock swings unheld doors shut under 5 degrees and enables machine start', () => {
  const { sandbox, oxSt } = createOxidationSandbox();
  sandbox.setPresenting(false);
  oxSt.state = 'loadedDoorOpen';

  // Door open at 3.6 deg (< 5 deg = 5/90), not held -> magnetic interlock attracts it shut
  oxSt.doorAmount = 3.6 / 90;
  oxSt.doorTarget = 0;
  sandbox.phys.doorVelocities[1] = 0;
  for (let k = 0; k < 40; k++) sandbox.updateDoors(1 / 60);

  assert.equal(oxSt.doorAmount, 0);
  assert.equal(sandbox.phys.doorVelocities[1], 0);
  assert.equal(oxSt.state, 'loaded');

  // Door open well outside 5 deg -> does NOT magnetically snap shut unless driven closed
  oxSt.state = 'loadedDoorOpen';
  oxSt.doorAmount = 0.25;
  oxSt.doorTarget = 1;
  sandbox.phys.doorVelocities[1] = 0;
  for (let k = 0; k < 20; k++) sandbox.updateDoors(1 / 60);
  assert(oxSt.doorAmount > 0.2, 'Door outside 5-degree catch should remain open');
  assert.equal(oxSt.state, 'loadedDoorOpen');
});

test('Wafer rigid-body physics rests tilted wafers on worktops and floor by pivoting around contact point', () => {
  const { sandbox, body, THREE } = createOxidationSandbox();
  let shattered = false;
  sandbox.shatterWafer = () => { shattered = true; };

  // Start tilted 50 degrees from flat above the Oxidation Furnace worktop deck (topY = 1.675 at x = 6.65, z = 3)
  body.dynamic = true;
  body.heldBy = null;
  body.machineIndex = null;
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.view.position.set(6.65, 1.9, 3.0);
  body.view.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2 + 0.85);

  for (let k = 0; k < 90; k++) sandbox.updateWaferPhysics(1 / 60);

  const normalAfterTable = new THREE.Vector3(0, 0, 1).applyQuaternion(body.view.quaternion).normalize();
  assert.equal(shattered, false, 'Gently laying wafer onto a worktop must not shatter');
  assert(Math.abs(normalAfterTable.y) > 0.99, `Wafer should torque flat on worktop (normal.y=${normalAfterTable.y})`);
  assert(Math.abs(body.view.position.y - (1.675 + 0.012)) < 0.02, `Wafer should rest on worktop surface (y=${body.view.position.y})`);

  // Place tilted wafer over the cleanroom floor (topY = 0 at x = 0, z = 0)
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.view.position.set(0, 0.25, 0);
  body.view.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2 - 0.7);
  body.view.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.3));

  for (let k = 0; k < 90; k++) sandbox.updateWaferPhysics(1 / 60);

  const normalAfterFloor = new THREE.Vector3(0, 0, 1).applyQuaternion(body.view.quaternion).normalize();
  assert.equal(shattered, false, 'Laying wafer gently onto the floor must not shatter');
  assert(Math.abs(normalAfterFloor.y) > 0.99, `Wafer should pivot to lay flat on floor (normal.y=${normalAfterFloor.y})`);
  assert(Math.abs(body.view.position.y - 0.012) < 0.02, `Wafer should rest flat on floor (y=${body.view.position.y})`);
});

test('Running machine locks its door against pulls/toggles and notifies the user', () => {
  const { sandbox, oxSt } = createOxidationSandbox();
  const toasts = [];
  sandbox.toast = msg => { toasts.push(msg); };
  sandbox.setPresenting(false);

  oxSt.state = 'running';
  oxSt.doorAmount = 0;
  oxSt.doorTarget = 0;
  oxSt.cycle = { i: 1, start: 0, processSeconds: 1, timeScale: 4 };
  sandbox.phys.doorVelocities[1] = 2.5;

  // Attempt toggle and door update while running
  sandbox.toggleDoor(1);
  sandbox.updateDoors(1 / 60);

  assert.equal(oxSt.doorAmount, 0, 'Running machine door must stay locked at 0');
  assert.equal(oxSt.doorTarget, 0, 'Running machine doorTarget must remain 0');
  assert.equal(sandbox.phys.doorVelocities[1], 0, 'Running machine door velocity must zero out');
  assert.equal(sandbox.buttonEnabled({ kind: 'machine', action: 'door', machineIndex: 1 }), false);
  assert(toasts.some(t => /locked while running/i.test(t)), 'Operator must be notified that running door is locked');
});

test('Wafers collide laterally and stack cleanly onto other created wafers', () => {
  const { sandbox, body: w1, THREE } = createOxidationSandbox();
  const w2 = sandbox.createParallelWafer(new THREE.Vector3(0.15, 0.012, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), false);

  // Side-by-side collision on the floor: overlapping wafers separate to >= 2*R and exchange impulse
  w1.dynamic = true; w1.heldBy = null; w1.machineIndex = null;
  w1.view.position.set(-0.1, 0.012, 0);
  w1.view.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  w1.velocity.set(1.2, 0, 0);

  w2.dynamic = true; w2.heldBy = null; w2.machineIndex = null;
  w2.velocity.set(-0.8, 0, 0);

  sandbox.updateWaferPhysics(1 / 60);
  const distAfter = Math.hypot(w2.view.position.x - w1.view.position.x, w2.view.position.z - w1.view.position.z);
  assert(distAfter >= 0.48, `Colliding wafers must separate laterally (dist=${distAfter})`);
  assert(w1.velocity.x < 1.0 && w2.velocity.x > -0.5, 'Colliding wafers must bounce off each other');

  // Vertical stacking: w2 dropped gently above stationary flat w1 rests on w1's top face
  w1.view.position.set(0, 0.012, 0);
  w1.velocity.set(0, 0, 0);
  w2.view.position.set(0.02, 0.12, 0);
  w2.velocity.set(0, 0, 0);
  for (let k = 0; k < 45; k++) sandbox.updateWaferPhysics(1 / 60);
  assert(w2.view.position.y > 0.03 && Math.abs(w2.view.position.y - 0.036) < 0.01, `Stacked wafer should rest atop lower wafer (y=${w2.view.position.y})`);
});

test('Final Delivery Bench accepts submitted wafer, completes lot, and triggers review report', () => {
  const { sandbox, body, oxMachine, THREE } = createOxidationSandbox();
  let reportShown = false;
  sandbox.quality = () => 90;
  sandbox.benchmarks = () => ({ best: null, median: null });
  sandbox.getRuns = () => [];
  sandbox.updateBenchmark = () => {};
  sandbox.localStorage = { getItem: () => null, setItem: () => {} };
  sandbox.showReport = () => { reportShown = true; };

  const delLocator = new THREE.Object3D();
  delLocator.position.set(0, 1.43, -39.85);
  const delWafer = new THREE.Object3D();
  delWafer.visible = false;
  sandbox.deliveryStation = { locator: delLocator, wafer: delWafer };

  // Complete the final available station in this 2-station sandbox -> awaits delivery rather than auto-finishing
  oxMachine.body = body;
  body.machineIndex = 1;
  body.records[0] = { score: 92, metric: 24, ratio: 1, processSeconds: 24, elapsedMs: 5000 };
  body.records[1] = { score: 88, metric: 120, ratio: 1, processSeconds: 30, elapsedMs: 8000 };
  sandbox.completeStage(1);
  assert.equal(sandbox.state.awaitingDelivery, true, 'Completing final stage must await delivery bench submission');
  assert.equal(sandbox.state.completed, false, 'Lot should not mark completed until placed on Final Delivery Bench');

  // Place wafer onto Final Delivery Bench locator -> finishes lot & triggers review screen
  body.dynamic = true;
  body.heldBy = null;
  body.view.visible = true;
  body.view.position.set(0, 1.43, -39.85);
  assert.equal(sandbox.tryPlaceWafer(body), true, 'Wafer must snap and submit at Final Delivery Bench');
  assert.equal(sandbox.state.completed, true);
  assert.equal(sandbox.state.awaitingDelivery, false);
  assert.equal(delWafer.visible, true);
  assert.equal(reportShown, true, 'Review and continue report screen must open upon wafer submission');
});

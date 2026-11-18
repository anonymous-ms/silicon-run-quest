const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('runtime loader order matches service-worker precache and index.html scripts', () => {
  const html = read('index.html');
  const loader = read('js/silicon-run.js');
  const sw = read('service-worker.js');

  const filesMatch = loader.match(/const files = \[([\s\S]*?)\];/);
  assert(filesMatch, 'js/silicon-run.js must define the runtime files array');
  const runtimeFiles = [...filesMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(runtimeFiles, [
    'silicon-run-core.js',
    'parallel-wafer-runtime.js',
    'design-workstation-runtime.js',
    'design-world-runtime.js',
    'cleanroom-lod.js',
    'cleanroom-debug.js',
    'cleanroom-realism.js',
    'cleanroom-pedagogy.js',
    'cleanroom-audio.js',
    'silicon-run-startup.js'
  ]);

  for (const file of runtimeFiles) {
    assert(fs.existsSync(path.join(ROOT, 'js', file)), `Missing runtime file js/${file}`);
    assert(sw.includes(`'./js/${file}'`), `service-worker.js must precache ./js/${file}`);
  }

  for (const asset of ['./css/styles.css', './css/developer-layout.css', './js/circuit-symbols.js', './js/photoresist-chamber.js', './js/silicon-run.js']) {
    assert(html.includes(asset), `index.html must reference ${asset}`);
    assert(sw.includes(`'${asset}'`), `service-worker.js must precache ${asset}`);
  }
});

test('service-worker offline fallback does not serve index.html for scripts or styles', () => {
  const sw = read('service-worker.js');
  assert(!/event\.request\.mode\s*===\s*'navigate'\s*\|\|\s*\['script',\s*'style'\]/.test(sw),
    'service-worker.js must not fall back to ./index.html for script/style requests');
  assert(sw.includes('caches.match(event.request)'),
    'service-worker.js must match cached script/style/asset requests when offline');
});

test('every DOM element ID queried by the shipped runtime exists in index.html', () => {
  const html = read('index.html');
  const htmlIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
  const dynamicIds = new Set(['releaseIndicator','handAlignHand','handAlignPosition','handAlignRotation','handAlignReadout','handAlignCopy']);
  const runtimeFiles = [
    'js/silicon-run-core.js',
    'js/parallel-wafer-runtime.js',
    'js/design-workstation-runtime.js',
    'js/design-world-runtime.js',
    'js/cleanroom-lod.js',
    'js/cleanroom-debug.js',
    'js/cleanroom-realism.js',
    'js/cleanroom-pedagogy.js',
    'js/cleanroom-audio.js',
    'js/silicon-run-startup.js'
  ];

  for (const rel of runtimeFiles) {
    const src = read(rel);
    const refs = [...new Set([...src.matchAll(/\$\('([^']+)'\)|getElementById\('([^']+)'\)/g)].map(m => m[1] || m[2]))];
    for (const id of refs) {
      assert(htmlIds.has(id) || dynamicIds.has(id), `${rel} references unknown DOM id #${id}`);
    }
  }
});

test('launch menu release indicator targets an existing header container in index.html', () => {
  const html = read('index.html');
  const worldRuntime = read('js/design-world-runtime.js');
  assert(html.includes('class="menu-brand"'), 'index.html should contain .menu-brand in #intro');
  assert(worldRuntime.includes('#intro .menu-brand'), 'showRelease() must target #intro .menu-brand');
});

test('station recipes, metric formulas, and circuitPool definitions are internally consistent', () => {
  const coreSrc = read('js/silicon-run-core.js');
  const workstationSrc = read('js/design-workstation-runtime.js');

  const stationsMatch = coreSrc.match(/const num=[\s\S]*?const stations=\[[\s\S]*?\];/);
  assert(stationsMatch, 'Could not locate stations table in js/silicon-run-core.js');
  const coreSandbox = { C: { cyan: 0x53e7ff, orange: 0xff9d3c, magenta: 0xff4fe1, violet: 0xb16cff, green: 0x67f6a3 }, Math };
  vm.runInNewContext(`${stationsMatch[0]}\nthis.stations = stations;`, coreSandbox);
  const stations = coreSandbox.stations;

  assert.equal(stations.length, 11);
  assert.equal(stations[0].type, 'design');
  assert.equal(stations[1].type, 'deposition');
  assert.equal(stations[2].type, 'spinner');

  for (const station of stations) {
    assert(station.targetSeconds > 0, `${station.name} targetSeconds must be positive`);
    assert(station.metric && typeof station.metric.calc === 'function', `${station.name} requires metric.calc`);
    assert(station.metric.tol > 0, `${station.name} metric tolerance must be positive`);
    const targetValues = Object.fromEntries(station.controls.map(c => [c.key, c.target]));
    const nominal = station.metric.calc(targetValues, station.targetSeconds);
    assert(Number.isFinite(nominal) && nominal > 0, `${station.name} metric.calc must produce a positive finite value`);
  }

  const poolMatch = workstationSrc.match(/const circuitPool=\[[\s\S]*?\];/);
  assert(poolMatch, 'Could not locate circuitPool in js/design-workstation-runtime.js');
  const circuitSandbox = {};
  vm.runInNewContext(`${poolMatch[0]}\nthis.circuitPool = circuitPool;`, circuitSandbox);

  for (const circuit of circuitSandbox.circuitPool) {
    const nodeIds = new Set(circuit.nodes.map(([id]) => id));
    for (const [deviceId] of circuit.devices) {
      assert(nodeIds.has(`${deviceId}G`), `${circuit.id}: missing gate node ${deviceId}G`);
    }
    for (const [a, b] of circuit.edges) {
      assert(nodeIds.has(a) && nodeIds.has(b), `${circuit.id}: edge ${a}-${b} references missing node`);
    }
    for (const [, nodeId] of circuit.supplies) {
      assert(nodeIds.has(nodeId), `${circuit.id}: supply references missing node ${nodeId}`);
    }
    const pool = circuit.edges.filter(edge => !edge.includes('VDD') && !edge.includes('GND'));
    let disjointPairs = 0;
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (!pool[i].some(node => pool[j].includes(node))) disjointPairs++;
      }
    }
    assert(disjointPairs > 0, `${circuit.id}: must have at least one disjoint edge pair`);
  }
});

test('photoresist bridge does not override cleanroom or VR metric before module activation', () => {
  const startupSrc = read('js/silicon-run-startup.js');
  assert(startupSrc.includes('chamberModuleUsed'), 'js/silicon-run-startup.js must gate 3D chamber metric override on chamberModuleUsed');
  assert(/calculateMetric=function\(i,t\)\{return i===photoresistIndex&&chamberModuleUsed&&photoresistReadout\?/.test(startupSrc),
    'calculateMetric wrapper must fall back to previousMetric unless chamberModuleUsed is true');
});

test('parallel wafer runtime retains stage deviations and honours playerOnly colliders', () => {
  const parallelSrc = read('js/parallel-wafer-runtime.js');
  const coreSrc = read('js/silicon-run-core.js');
  assert(parallelSrc.includes('deviations:result.deviations'), 'stopProcess must preserve deviations on body.records[i]');
  assert(parallelSrc.includes('!collider.playerOnly'), 'updateWaferPhysics must skip playerOnly colliders');
  assert(parallelSrc.includes('state.completed=!!body.completed'), 'syncActiveWafer must synchronize state.completed');
  assert(coreSrc.includes('r?.deviations?.[0]'), 'showReport must read persisted record deviations');
});

test('snapping sphere is invisible and machines require loaded wafers, shrouds, particles, and controls training', () => {
  const coreSrc = read('js/silicon-run-core.js');
  const startupSrc = read('js/silicon-run-startup.js');
  assert(startupSrc.includes('sphere.visible=false'), 'Debug snap sphere must be invisible');
  assert(coreSrc.includes('controlBlue:'), 'Control blue must be factored into C.controlBlue');
  assert(coreSrc.includes('C.controlBlue'), 'makeControl must reference C.controlBlue');
  assert(coreSrc.includes('function createShroudEnclosure('), 'Machines must build see-through shrouding');
  assert(coreSrc.includes('function createChamberParticles('), 'Machines must build chamber particle emitters');
  assert(coreSrc.includes('const controlsTraining='), 'Tutorial must include pre-run controls training');
  assert(coreSrc.includes("if(tutorial){startControlsTraining("), 'Tutorial launch must start controls training before the level timer');
});

test('CCD fabrication sequence, bright tutorial arrows, button glow shader, and magnetic door interlock exist', () => {
  const coreSrc = read('js/silicon-run-core.js');
  const designWorldSrc = read('js/design-world-runtime.js');
  const parallelSrc = read('js/parallel-wafer-runtime.js');
  assert(coreSrc.includes("target: 'Phosphorus / N-type'") || coreSrc.includes("'Phosphorus / N-type','Boron / P-type'"),
    'Ion Implant Beamline must target N-type phosphorus buried channel for CCD fabrication');
  assert(coreSrc.includes('ROUTE_ARROW_COUNT') && coreSrc.includes('Math.atan2(-ux,-uz)'),
    'Green directional arrows must run diagonally and equidistantly from player position to target');
  assert(coreSrc.includes('function createButtonGlowShader(') && coreSrc.includes('THREE.ShaderMaterial'),
    'Start and Stop buttons must use a custom GLSL ShaderMaterial glow effect');
  assert(coreSrc.includes('startGreen:') && coreSrc.includes('stopRed:'),
    'Start and Stop buttons must stay green and red respectively');
  assert(coreSrc.includes('DOOR_MAGNET_ANGLE=5/90') && coreSrc.includes('DOOR_MAGNET_ANGLE') && designWorldSrc.includes('DOOR_MAGNET_ANGLE'),
    'Both XR and Desktop doors must apply magnetic closing attraction under 5 degrees');
  assert(parallelSrc.includes('function resolveWaferRigidStep(') && parallelSrc.includes('function waferSupportSurfaces('),
    'Wafer physics must model CoG torque around surface contact points across tables, floor, and walls');
  assert(coreSrc.includes('function isDoorLocked(') && coreSrc.includes('function notifyDoorLocked('),
    'Running machines must lock their door and notify the operator');
  assert(!coreSrc.includes('const doorBtn=') && !coreSrc.includes('loadBtn=') && !coreSrc.includes('unloadBtn='),
    'Bottom 4 buttons must be removed in favor of upper START/STOP embedded in frontRight shroud panel');
  assert(coreSrc.includes("frontRight.userData.shroudPart='frontRight'") && coreSrc.includes('armPivot.position.set(.68,2.45,-.33)'),
    'Shroud must enclose all faces with contiguous oblongs and spin coater swing arm must reach center');
  assert(coreSrc.includes('320,\'spinSpray\'') && coreSrc.includes('.0105') && coreSrc.includes('resistScaleZ=Math.max(.05,coat*(1-clear))'),
    'Photolithography must use 5x fine 1/4-size particles and uncap resist thickness growth');
});

test('modular realism, pedagogy cross-section, and audio extension scripts expose init and FutureHooks', () => {
  const realismSrc = read('js/cleanroom-realism.js');
  const pedagogySrc = read('js/cleanroom-pedagogy.js');
  const audioSrc = read('js/cleanroom-audio.js');
  const startupSrc = read('js/silicon-run-startup.js');

  assert(realismSrc.includes('globalThis.CleanroomRealism') && realismSrc.includes('FutureHooks') && realismSrc.includes('PMREMGenerator'),
    'cleanroom-realism module must expose CleanroomRealism.FutureHooks and PMREM lighting');
  assert(pedagogySrc.includes('globalThis.CleanroomPedagogy') && pedagogySrc.includes('renderCrossSection') && pedagogySrc.includes('certification'),
    'cleanroom-pedagogy module must expose modes and live 2.5D cross-section rendering');
  assert(audioSrc.includes('globalThis.CleanroomAudio') && audioSrc.includes('FutureHooks') && audioSrc.includes('playLatchClick') && audioSrc.includes('playUnlatchClick') && audioSrc.includes('playButtonClick') && audioSrc.includes('playWaferShatter') && audioSrc.includes('startMachineWhir') && audioSrc.includes('playDialClick'),
    'cleanroom-audio module must expose WebAudio shatter, whir, dial click, button click, door latch/unlatch, and extension stubs');
  assert(startupSrc.includes('installFeatureModules'),
    'silicon-run-startup must initialize the optional modular feature scripts');
});

test('CleanroomPedagogy mode switching controls route arrow visibility, target hints, and tolerance scaling', () => {
  const pedagogySrc = read('js/cleanroom-pedagogy.js');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sandbox = {
    Math, Number, String, Array, Object,
    clamp,
    state: { hideRouteArrows: false, cycle: null, records: [], current: 1 },
    status: [],
    stations: [],
    effects: [],
    guideBeacon: null,
    guideFloorRing: null,
    $: () => null,
    specText: c => `Required: ${c.target}`,
    controlFitness: (c, v) => clamp(100 - Math.abs(Number(v) - c.target) / c.tol * 25, 0, 100),
    updateMachineGui: () => {},
    animateEffects: () => {},
    globalThis: {}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(pedagogySrc, sandbox);
  sandbox.CleanroomPedagogy.init();

  sandbox.CleanroomPedagogy.setMode('certification');
  assert.equal(sandbox.state.hideRouteArrows, true, 'Certification mode must hide floor arrows');
  assert(/Certification/i.test(sandbox.specText({ target: 120 })), 'Certification mode must hide numeric target spoiler');

  const ctrl = { kind: 'number', target: 100, tol: 10 };
  const certScore = sandbox.controlFitness(ctrl, 110);
  sandbox.CleanroomPedagogy.setMode('explorer');
  assert.equal(sandbox.state.hideRouteArrows, false, 'Explorer mode must enable floor arrows');
  const expScore = sandbox.controlFitness(ctrl, 110);
  assert(expScore > certScore, `Explorer tolerance score (${expScore}) must exceed certification (${certScore})`);
});

test('2-layer layout checks IN1->OUT1, IN2->OUT2, IN3->OUT3 with crossover pin order and allows imperfect release with penalties', () => {
  const workSrc = read('js/design-workstation-runtime.js');
  const worldSrc = read('js/design-world-runtime.js');
  const lodSrc = read('js/cleanroom-lod.js');

  assert(workSrc.includes('intentionally mis-ordered'), 'Intentional output pin mis-ordering note must be documented');
  assert(workSrc.includes('openPenalty=opens*22'), 'Open nets must apply a score penalty in layout scoring');
  assert(workSrc.includes("$('performanceStats')"), 'Developer metrics must populate #performanceStats with draw calls & triangles');
  assert(!worldSrc.includes('if(designMode.layoutComplete){'), 'Stage 2 design release must accept imperfect layouts with score penalties');
  assert(lodSrc.includes('globalThis.CleanroomLOD') && lodSrc.includes('PROFILES'), 'Distance-based LOD module must be defined');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const canvasEl = { width: 1280, height: 800, getContext: () => null };
  const fakeEl = () => ({ textContent: '', innerHTML: '', className: '', disabled: false, value: '0', setAttribute() {}, classList: { toggle() {} } });
  const dom = new Map([['designCanvas', canvasEl]]);
  const releasedBody = { id: 1, lotId: 'SR-4242', nextStage: 0, records: [], pattern: '' };
  const sandbox = {
    THREE: { Vector3: class { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z} }, Quaternion: class {} },
    Math, Number, String, Array, Object, Set, Map, JSON,
    clamp,
    performance: { now: () => 5000 },
    devicePixelRatio: 1,
    renderer: { xr: { isPresenting: false }, info: { render: { calls: 42, triangles: 1234 } } },
    designWorld: { active: false },
    stations: [{ controls: [], metric: { label: 'Design', unit: 's', target: 24, tol: 2 } }],
    status: [{ state: 'ready', values: {}, score: null, deviations: [], metric: 0 }],
    parallel: { active: releasedBody },
    state: { started: true, current: 0 },
    userPreferences: { developerPanel: true },
    keys: {},
    document: { pointerLockElement: null, body: { classList: { add() {}, remove() {} } }, querySelectorAll: () => [] },
    $: id => dom.get(id) || fakeEl(),
    carriedWafers: () => [],
    setLamp: () => {},
    syncActiveWafer: () => {},
    updateAll: () => {},
    toast: () => {},
    recordActivity: () => {},
    setDesignProgress: () => {},
    setDesignMessage: () => {},
    drawDesignStage: () => {},
    renderDesignStep: () => {},
    closeDesignMode: () => {},
    escapeHtml: s => String(s),
    globalThis: {}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(workSrc + '\nglobalThis.__dm=designMode;', sandbox);
  sandbox.initializeLayoutNodes();

  const geom = sandbox.layoutGeometry(1280, 800);
  assert.deepEqual([...geom.inputs.map(n => n.id)], ['IN1', 'IN2', 'IN3']);
  assert.deepEqual([...geom.outputs.map(n => n.id)], ['OUT2', 'OUT3', 'OUT1'], 'OUT2 must sit top and OUT1 bottom for intentional crossover');

  // Wire ONLY IN1 -> OUT1 cleanly on M1 avoiding keepouts -> 1 connected (IN1->OUT1), 2 open
  const in1 = sandbox.layoutNode('IN1'), out1 = sandbox.layoutNode('OUT1');
  sandbox.__dm.layoutRoutes.push({
    fromId: 'IN1', toId: 'OUT1', layer: 'M1',
    points: [
      { x: in1.x, y: in1.y, layer: 'M1' },
      { x: 1280 * 0.2, y: in1.y, layer: 'M1' },
      { x: 1280 * 0.2, y: 800 * 0.52, layer: 'M1' },
      { x: 1280 * 0.8, y: 800 * 0.52, layer: 'M1' },
      { x: 1280 * 0.8, y: out1.y, layer: 'M1' },
      { x: out1.x, y: out1.y, layer: 'M1' }
    ]
  });
  sandbox.rebuildLayoutNodeMetals();
  const netResult = sandbox.scoreLayoutNetwork();
  assert.equal(sandbox.layoutNetConnected('N1'), true, 'IN1 must map to OUT1 (N1)');
  assert.equal(netResult.connected, 1, 'Only IN1->OUT1 is connected so far');
  assert.equal(netResult.opens, 2, 'Remaining 2 nets are open');
  assert(netResult.score < 70 && netResult.score > 40, `2 open nets should yield ~55% score (got ${netResult.score})`);

  // Releasing with 2 opens still succeeds and records penalized score + deviations
  sandbox.__dm.regressionBest = { score: 100, m: 1, c: 0 };
  sandbox.__dm.schematicScore = 100;
  sandbox.releaseDesign();
  assert.equal(releasedBody.nextStage, 1, 'Wafer must still be released to Oxidation Furnace despite layout mistakes');
  assert(releasedBody.records[0].score < 100, `Released score must include layout penalty (got ${releasedBody.records[0].score})`);
  assert(releasedBody.records[0].deviations.some(d => /open/i.test(d)), 'Released record must preserve open net deviation');
});

test('LED light bars orient longitudinally and Settings includes Developer View, Hitboxes, Normals, and Wireframe toggles', () => {
  const coreSrc = read('js/silicon-run-core.js');
  const debugSrc = read('js/cleanroom-debug.js');
  const html = read('index.html');
  const devCss = read('css/developer-layout.css');

  assert(coreSrc.includes('box(.44,.05,3.2,mat(col,0,.22)'), 'Ceiling LED light strips must orient longitudinally along Z');
  for (const id of ['developerViewEnabled', 'debugHitboxes', 'debugNormals', 'debugWireframe', 'developerDebugFlags']) {
    assert(html.includes(`id="${id}"`), `index.html must include #${id}`);
  }
  assert(debugSrc.includes('globalThis.CleanroomDebug') && debugSrc.includes('applyWireframe') && debugSrc.includes('rebuildHitboxes') && debugSrc.includes('rebuildNormals'),
    'cleanroom-debug.js must implement Hitboxes, Normals, and Wireframe visualizers');
  assert(devCss.includes('top: 416px') && devCss.includes('left: 16px'),
    'Developer stack box must sit separately under the top-left #hud panel');
});

test('Hand alignment harness launches without VR tracking and exposes live transforms', () => {
  const startupSrc = read('js/silicon-run-startup.js');
  const serverSrc = read('scripts/test-launch.js');
  const readme = read('README.md');
  assert(startupSrc.includes("params.get('debug')==='hand-align'") && startupSrc.includes('installHandAlignLaunchHook'),
    'The shipped startup must expose a standalone ?debug=hand-align launch hook');
  assert(startupSrc.includes('hand-align-panel') && startupSrc.includes('__handAlignDebug') && startupSrc.includes('copyJson'),
    'The harness must expose live adjustment, JSON export, and a debug API');
  assert(startupSrc.includes('ArrowHelper') && startupSrc.includes('0xff2947') && startupSrc.includes('0x67f66a') && startupSrc.includes('0x2a88ff'),
    'The harness must render red X, green Y, and blue Z controller/hand coordinate gizmos');
  assert(serverSrc.includes('?debug=hand-align&hand=right'), 'The local test server must print the hand alignment URL');
  assert(readme.includes('?debug=hand-align&hand=right'), 'README must document the isolated hand alignment launch');
});

test('VR controls training uses a fixed black 3D UI stage and retains handset models', () => {
  const coreSrc = read('js/silicon-run-core.js');
  assert(coreSrc.includes('enterXRTrainingEnvironment') && coreSrc.includes('leaveXRTrainingEnvironment'),
    'VR training must enter and leave a dedicated isolated training stage');
  assert(coreSrc.includes("scene.background=new THREE.Color(0x000000)") && coreSrc.includes('xrTrainingHiddenRoots'),
    'VR training must hide the cleanroom behind a black scene');
  assert(coreSrc.includes('camera.getWorldQuaternion(worldQuaternion)') && coreSrc.includes('xrTrainingRoot.quaternion.copy(worldQuaternion)') && coreSrc.includes('camera.getWorldDirection(direction)'),
    'The training card must be fixed in world 3D space in front of the initial VR view');
  assert(coreSrc.includes("xrMainMenuActive=true;state.paused=true;enterXRTrainingEnvironment();drawXRMainMenuOverlay()"),
    'Entering VR from the first menu must create the dark fixed-card void before showing menu choices');
  assert(coreSrc.includes('leaveXRTrainingEnvironment();') && coreSrc.includes('beginMenuRun(tutorial);'),
    'Choosing a VR menu action must leave the void and only then start the chosen tutorial or run');
  assert(coreSrc.includes('xrHandset.visible=false') && coreSrc.includes('freezeXRWorldForPause()'),
    'VR training must freeze world movement and keep ghost controller/hand models visible');
});

test('VR handsets use mirrored handedness and calibrated zero-pose offsets', () => {
  const coreSrc = read('js/silicon-run-core.js');
  const baseSrc = read('js/base.js');
  assert(coreSrc.includes('XR_HAND_ZERO_POSE') && coreSrc.includes('applyGhostHandZeroPose'),
    'VR ghost controllers must use a named per-hand zero-pose and live handedness calibration');
  assert(coreSrc.includes("left:{mirror:1") && coreSrc.includes("right:{mirror:-1"),
    'Left and right handset models must use opposite left-right mirror factors');
  assert(coreSrc.includes("left:{mirror:1,position:[-.028,-.085,-.070],rotation:[-.82,-.42,.38]") &&
         coreSrc.includes("right:{mirror:-1,position:[.028,-.085,-.070],rotation:[-.82,.42,-.38]"),
    'Left and right hands must use the calibrated down/back/palm-in grip pose');
  assert(coreSrc.includes("deviceRotation:[-.34,0,0]"),
    'The physical controller mesh must retain a neutral local axis instead of inheriting handset roll');
  assert(baseSrc.includes("mirror=handedness==='left'?1:-1"), 'Legacy handset renderer must share the handedness mirror convention');
});

test('Map, VR menu, design-world isolation, requirements, and station wafer visibility', () => {
  const coreSrc = read('js/silicon-run-core.js');
  const worldSrc = read('js/design-world-runtime.js');
  assert(coreSrc.includes('h-20-(10-z)/49*(h-38)'), 'The cleanroom map Z axis must be vertically flipped');
  assert(coreSrc.includes('rotate(Math.PI-yaw)'), 'The rendered player arrow must rotate 180 degrees with the map');
  assert(coreSrc.includes('drawXRMainMenuOverlay') && coreSrc.includes('START TUTORIAL') && coreSrc.includes('startVRMainMenuChoice'),
    'VR must expose a first-session menu and launch the tutorial or standard run');
  assert(coreSrc.includes('Process target and all recipe requirements shown above'), 'VR wrist specifications must display process requirements');
  assert(worldSrc.includes('cleanroomHiddenRoots') && worldSrc.includes('child.visible=false') && worldSrc.includes('cleanroomHiddenRoots=null'),
    'Entering the isolated sensor design world must hide and restore cleanroom scene roots');
  assert(coreSrc.includes('wafer.visible=false;g.add(wafer)') && coreSrc.includes('m.wafer.visible=false'),
    'Fabrication stations must not create or restore a wafer before one is seated');
});

test('Stock station uses 3-sided black cassette box and auto-replenishing robot arm with no DISPENSE button', () => {
  const coreSrc = read('js/silicon-run-core.js');
  const parallelSrc = read('js/parallel-wafer-runtime.js');
  const pedagogySrc = read('js/cleanroom-pedagogy.js');
  const html = read('index.html');
  assert(!coreSrc.includes("'DISPENSE'"), 'DISPENSE button must be removed from stock station');
  assert(coreSrc.includes('rackBox') && coreSrc.includes('function updateStockRobot('),
    'Stock station must include 3-sided cassette box and animated robot arm');
  assert(parallelSrc.includes("stockMachine.robot.phase!=='offering'") && parallelSrc.includes('body.grabbable===false'),
    'Stock wafer must only become grabbable once the robot offer animation completes');
  assert(html.includes('id="processStrip"') && html.includes('id="tutorialPips"'),
    'index.html must include #processStrip sequence visualization and #tutorialPips step tracker');
  assert(pedagogySrc.includes('function renderProcessStrip(') && pedagogySrc.includes('function computeCoupledDeviceElectricals('),
    'cleanroom-pedagogy.js must render the visual process strip and compute coupled CCD electrical metrics');
});

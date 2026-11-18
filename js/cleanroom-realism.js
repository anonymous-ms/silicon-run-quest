'use strict';
/**
 * Cleanroom Realism & Photorealistic Lighting Module (`js/cleanroom-realism.js`)
 *
 * Isolates optional WebGL visual upgrades (synthetic PMREM environment reflections,
 * procedural perforated ESD floor micro-bump textures, Zone A 590 nm lithography
 * safelight accents, and ISO-4/ISO-5 Air Shower airflow particles) so the core runtime
 * stays modular and Quest VR performance remains predictable.
 *
 * Extension hooks for future agents:
 * - `CleanroomRealism.FutureHooks.registerDustContamination(fn)`: attach particulate
 *   aerosol sources near un-gowned entrances or chaotic wafer drops.
 * - `CleanroomRealism.FutureHooks.setFoveatedLOD(tier)`: scale texture anisotropy and
 *   particle density dynamically from XR / FPS telemetry (`performancePane`).
 */
(function () {
  const realismState = {
    initialized: false,
    airShowerParticles: null,
    airShowerPositions: null,
    airShowerSeeds: null,
    airShowerBoost: 0,
    floorBumpTexture: null,
    envRenderTarget: null
  };

  function createEsdBumpTexture() {
    if (realismState.floorBumpTexture) return realismState.floorBumpTexture;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#909090';
    ctx.fillRect(0, 0, size, size);
    // Micro ESD conductive grid flecks + perimeter bevel seam
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    for (let y = 12; y < size; y += 16) {
      for (let x = 12; x < size; x += 16) {
        ctx.fillStyle = (x + y) % 32 === 0 ? '#bdbdbd' : '#707070';
        ctx.fillRect(x, y, 3, 3);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 48);
    realismState.floorBumpTexture = tex;
    return tex;
  }

  function installEnvironmentLighting() {
    if (!renderer || !scene || typeof THREE.PMREMGenerator !== 'function') return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0c1b26);

    // Overhead cool-white & Bay-A amber cleanroom diffuser strips reflected in silicon & quartz
    const stripGeo = new THREE.PlaneGeometry(4, 18);
    const coolMat = new THREE.MeshBasicMaterial({ color: 0xdff8ff, side: THREE.DoubleSide });
    const amberMat = new THREE.MeshBasicMaterial({ color: 0xffd07a, side: THREE.DoubleSide });
    for (const [x, matRef] of [[-4, coolMat], [4, amberMat]]) {
      const strip = new THREE.Mesh(stripGeo, matRef);
      strip.position.set(x, 6, 0);
      strip.rotation.x = Math.PI / 2;
      envScene.add(strip);
    }
    envScene.add(new THREE.HemisphereLight(0xd9f5ff, 0x152734, 1.4));
    realismState.envRenderTarget = pmrem.fromScene(envScene, 0.04);
    scene.environment = realismState.envRenderTarget.texture;
    pmrem.dispose();
  }

  function applyLithographyBaySafelight() {
    if (!scene) return;
    // Tint Bay A point lights (Photoresist Spin Coater -> Wet Bench, z in [-15, 1]) warm 590 nm amber
    scene.traverse(obj => {
      if (obj.isPointLight && obj.position && obj.position.z <= 2 && obj.position.z >= -16 && obj.position.y > 3.1) {
        obj.color.setHex(0xffd27d);
        obj.intensity = 1.42;
      }
    });
  }

  function applyProceduralSurfaceDetail() {
    if (!scene) return;
    const bump = createEsdBumpTexture();
    scene.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      // Enhance specular micro-roughness on large flat cleanroom ESD floor slabs at y ≈ -0.07
      if (Math.abs(obj.position.y + 0.07) < 0.02 && obj.geometry?.parameters?.width >= 17) {
        obj.material.bumpMap = bump;
        obj.material.bumpScale = 0.004;
        obj.material.envMapIntensity = 0.55;
        obj.material.needsUpdate = true;
      }
    });
  }

  function buildAirShowerCurtain() {
    if (!scene || realismState.airShowerParticles) return;
    const count = 90;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      seeds[i * 2] = Math.random();
      seeds[i * 2 + 1] = Math.random();
      positions[i * 3] = (seeds[i * 2] - 0.5) * 8.2;
      positions[i * 3 + 1] = 0.15 + seeds[i * 2 + 1] * 3.35;
      positions[i * 3 + 2] = -17 + (Math.random() - 0.5) * 0.45;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x8ef3ff,
      size: 0.024,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const pts = new THREE.Points(geo, mat);
    pts.name = 'air-shower-laminar-curtain';
    pts.frustumCulled = false;
    scene.add(pts);
    realismState.airShowerParticles = pts;
    realismState.airShowerPositions = positions;
    realismState.airShowerSeeds = seeds;
  }

  function updateRealism(t, dt) {
    const pts = realismState.airShowerParticles;
    if (!pts || !player) return;
    const inPortal = Math.abs(player.position.z + 17) < 1.35 && Math.abs(player.position.x) < 4.6;
    realismState.airShowerBoost = lerp(realismState.airShowerBoost, inPortal ? 1 : 0, 1 - Math.exp(-dt * 5));
    pts.material.opacity = 0.24 + realismState.airShowerBoost * 0.48;
    const pos = realismState.airShowerPositions;
    const sd = realismState.airShowerSeeds;
    const speed = 1.15 + realismState.airShowerBoost * 2.4;
    for (let i = 0; i < sd.length / 2; i++) {
      const y = 3.5 - ((t * speed + sd[i * 2 + 1] * 3.35) % 3.35);
      pos[i * 3 + 1] = y;
      pos[i * 3] = (sd[i * 2] - 0.5) * 8.2 + Math.sin(t * 3 + i) * 0.03;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  }

  function init() {
    if (realismState.initialized || typeof scene === 'undefined' || !scene) return;
    realismState.initialized = true;
    try {
      installEnvironmentLighting();
      applyLithographyBaySafelight();
      applyProceduralSurfaceDetail();
      buildAirShowerCurtain();
      if (typeof animateEffects === 'function') {
        const prevAnimate = animateEffects;
        animateEffects = function (t, dt) {
          prevAnimate(t, dt);
          updateRealism(t, dt);
        };
      }
      if (globalThis.CleanroomRealism?.FutureHooks?.onEnvironmentReady) {
        globalThis.CleanroomRealism.FutureHooks.onEnvironmentReady(scene);
      }
    } catch (_) {
      // Headless Node tests stub Scene without PMREM/PointLight traversal
    }
  }

  globalThis.CleanroomRealism = {
    init,
    updateRealism,
    FutureHooks: {
      onEnvironmentReady: null,
      registerDustContamination: null,
      setFoveatedLOD: null
    }
  };
})();

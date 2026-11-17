'use strict';
/**
 * Cleanroom Debug Visualizers Module (`js/cleanroom-debug.js`)
 *
 * Provides settings-driven 3D diagnostic overlays for developer inspection:
 * - `debugHitboxes`: renders machine/player colliders, snap-sphere locators, and wafer colliders.
 * - `debugNormals`: renders surface/vertex normal vectors on nearby cleanroom & wafer meshes.
 * - `debugWireframe`: toggles wireframe rendering across physical scene geometries.
 *
 * Extension hooks for future agents:
 * - `CleanroomDebug.FutureHooks.setNormalLength(meters)`: adjust normal vector tick length.
 * - `CleanroomDebug.FutureHooks.registerCustomOverlay(fn)`: draw additional spatial debug shapes.
 */
(function () {
  const stateDebug = {
    initialized: false,
    root: null,
    hitboxes: null,
    normals: null,
    normalLength: 0.12,
    lastRebuildAt: 0
  };

  function clearGroup(group) {
    if (!group) return;
    while (group.children.length) {
      const child = group.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  function applyWireframe(enabled) {
    if (!scene) return;
    scene.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      if (stateDebug.root && (obj === stateDebug.root || obj.parent === stateDebug.root || obj.parent?.parent === stateDebug.root)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m || m.colorWrite === false || m.map) continue;
        if (m.__origWireframe === undefined) m.__origWireframe = !!m.wireframe;
        m.wireframe = enabled ? true : m.__origWireframe;
      }
    });
  }

  function addBoxWireframe(group, cx, cy, cz, w, h, d, color) {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.88, toneMapped: false });
    const lines = new THREE.LineSegments(geo, mat);
    lines.position.set(cx, cy, cz);
    group.add(lines);
  }

  function rebuildHitboxes() {
    clearGroup(stateDebug.hitboxes);
    if (!userPreferences.debugHitboxes || !stateDebug.hitboxes) return;

    if (Array.isArray(colliders)) {
      for (const c of colliders) {
        if (!c) continue;
        addBoxWireframe(stateDebug.hitboxes, c.x, 1.4, c.z, c.w, 2.8, c.d, c.playerOnly ? 0xffcf56 : 0x53e7ff);
      }
    }

    if (Array.isArray(machines)) {
      const snapR = typeof WAFER_SNAP_RADIUS === 'number' ? WAFER_SNAP_RADIUS : 0.22;
      for (const m of machines) {
        if (!m || m.kind !== 'fabrication' || !m.wafer) continue;
        const p = m.wafer.getWorldPosition(new THREE.Vector3());
        const geo = new THREE.EdgesGeometry(new THREE.SphereGeometry(snapR, 12, 8));
        const mat = new THREE.LineBasicMaterial({ color: 0x67f6a3, transparent: true, opacity: 0.78, toneMapped: false });
        const seg = new THREE.LineSegments(geo, mat);
        seg.position.copy(p);
        stateDebug.hitboxes.add(seg);
      }
    }

    if (typeof parallel !== 'undefined' && Array.isArray(parallel.wafers)) {
      const r = 0.2448 * 2;
      for (const body of parallel.wafers) {
        if (!body?.view?.visible || body.broken) continue;
        const p = body.view.getWorldPosition(new THREE.Vector3());
        addBoxWireframe(stateDebug.hitboxes, p.x, p.y, p.z, r, 0.03, r, 0xffef5c);
      }
    }
  }

  function rebuildNormals() {
    clearGroup(stateDebug.normals);
    if (!userPreferences.debugNormals || !stateDebug.normals || !scene || !player) return;

    const verts = [];
    const pPos = player.position;
    const len = stateDebug.normalLength;
    const vPos = new THREE.Vector3();
    const vNorm = new THREE.Vector3();
    const nMat3 = new THREE.Matrix3();

    scene.traverse(obj => {
      if (!obj.isMesh || !obj.visible || !obj.geometry) return;
      if (stateDebug.root && (obj === stateDebug.root || obj.parent === stateDebug.root || obj.parent?.parent === stateDebug.root)) return;
      if (obj.material?.colorWrite === false || obj.userData?.labelWidth) return;
      const wp = obj.getWorldPosition(new THREE.Vector3());
      if (wp.distanceTo(pPos) > 13 && obj.geometry?.parameters?.width < 10) return;

      const posAttr = obj.geometry.attributes?.position;
      const normAttr = obj.geometry.attributes?.normal;
      if (!posAttr || !normAttr) return;

      obj.updateWorldMatrix(true, false);
      nMat3.getNormalMatrix(obj.matrixWorld);
      const stride = Math.max(1, Math.floor(posAttr.count / 24));
      for (let i = 0; i < posAttr.count; i += stride) {
        vPos.fromBufferAttribute(posAttr, i).applyMatrix4(obj.matrixWorld);
        vNorm.fromBufferAttribute(normAttr, i).applyMatrix3(nMat3).normalize();
        verts.push(
          vPos.x, vPos.y, vPos.z,
          vPos.x + vNorm.x * len, vPos.y + vNorm.y * len, vPos.z + vNorm.z * len
        );
        if (verts.length > 18000) break;
      }
    });

    if (verts.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xff4fe1, transparent: true, opacity: 0.9, toneMapped: false });
      stateDebug.normals.add(new THREE.LineSegments(geo, mat));
    }
  }

  function updateDebugFlagsLabel() {
    const el = $('developerDebugFlags');
    if (!el) return;
    const active = [];
    if (userPreferences.debugHitboxes) active.push('Hitboxes');
    if (userPreferences.debugNormals) active.push('Normals');
    if (userPreferences.debugWireframe) active.push('Wireframe');
    el.textContent = `Debug: ${active.length ? active.join(' · ') : 'None'}`;
  }

  function sync() {
    if (!scene) return;
    if (!stateDebug.root) {
      stateDebug.root = new THREE.Group();
      stateDebug.root.name = 'cleanroom-debug-overlays';
      stateDebug.hitboxes = new THREE.Group();
      stateDebug.normals = new THREE.Group();
      stateDebug.root.add(stateDebug.hitboxes, stateDebug.normals);
      scene.add(stateDebug.root);
    }
    applyWireframe(!!userPreferences.debugWireframe);
    rebuildHitboxes();
    rebuildNormals();
    updateDebugFlagsLabel();
  }

  function init() {
    if (stateDebug.initialized) return;
    stateDebug.initialized = true;
    sync();
    if (typeof loop === 'function') {
      const prevLoop = loop;
      loop = function (now) {
        prevLoop(now);
        if ((userPreferences.debugHitboxes || userPreferences.debugNormals) && now - stateDebug.lastRebuildAt > 250) {
          stateDebug.lastRebuildAt = now;
          if (userPreferences.debugHitboxes) rebuildHitboxes();
          if (userPreferences.debugNormals) rebuildNormals();
        }
      };
    }
  }

  globalThis.CleanroomDebug = {
    init,
    sync,
    FutureHooks: {
      setNormalLength(meters) {
        stateDebug.normalLength = Math.max(0.02, Number(meters) || 0.12);
        rebuildNormals();
      },
      registerCustomOverlay: null
    }
  };
})();

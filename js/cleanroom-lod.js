'use strict';
/**
 * Distance-Based Cleanroom LOD, Light Windowing & Draw-Call Optimizer (`js/cleanroom-lod.js`)
 *
 * Reduces GPU fragment-shader overhead and draw calls across the 11-station fab hall by:
 * 1. Keeping only the nearest 4 overhead ceiling PointLights active per player Z band
 *    (0 while inside the isolated Design Room at z = 165) while keeping diffuser strips glowing.
 * 2. Classifying each station into Near (<= 12 m), Mid (12..22 m), and Far (> 22 m) LOD tiers:
 *    - Near: full dials, scale ticks/labels, internal chamber assemblies, shroud & door.
 *    - Mid: reduces eligible primitive geometry and unloads fine labels while retaining the chamber.
 *    - Far / Design World: reduces eligible geometry and keeps the outer hull and overhead sign.
 *
 * Extension hooks for future agents:
 * - `CleanroomLOD.FutureHooks.setLodProfile(name)`: swap between `'desktop'`, `'quest'`, and `'ultra'`
 *   distance thresholds from XR frame-timing heuristics.
 * - `CleanroomLOD.FutureHooks.registerInstancedPropGroup(group)`: register additional repeated cleanroom props.
 */
(function () {
  const PROFILES = {
    desktop: { near: 12, mid: 22, maxLights: 4 },
    quest: { near: 9.5, mid: 17, maxLights: 3 },
    ultra: { near: 18, mid: 32, maxLights: 6 }
  };

  let activeProfile = 'desktop';
  const machineRecords = [];
  const ceilingLights = [];
  const stats = { near: 0, mid: 0, far: 0, activeLights: 0 };
  const geometryVariants = new WeakMap();
  let initialized = false;
  let lastUpdateAt = 0;

  function makePrimitiveGeometry(geometry, tier) {
    const p = geometry.parameters;
    const lower = tier === 'mid' ? 0.5 : 0.25;
    const segments = (value, minimum) => Math.max(minimum, Math.floor(value * lower));
    switch (geometry.type) {
      case 'SphereGeometry':
        return new THREE.SphereGeometry(
          p.radius, segments(p.widthSegments, 6), segments(p.heightSegments, 4),
          p.phiStart, p.phiLength, p.thetaStart, p.thetaLength
        );
      case 'CylinderGeometry':
        return new THREE.CylinderGeometry(
          p.radiusTop, p.radiusBottom, p.height, segments(p.radialSegments, 6),
          p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength
        );
      case 'ConeGeometry':
        return new THREE.ConeGeometry(
          p.radius, p.height, segments(p.radialSegments, 6),
          p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength
        );
      case 'TorusGeometry':
        return new THREE.TorusGeometry(
          p.radius, p.tube, segments(p.radialSegments, 3),
          segments(p.tubularSegments, 6), p.arc
        );
      default:
        return null;
    }
  }

  function canReplaceGeometry(geometry) {
    if (!geometry?.parameters || !geometry.attributes?.position || geometry.groups?.length) return false;
    if (Object.keys(geometry.morphAttributes || {}).length) return false;
    if (Object.keys(geometry.attributes).some(name => !['position', 'normal', 'uv'].includes(name))) return false;
    const position = geometry.attributes.position;
    const triangles = geometry.index ? geometry.index.count / 3 : position.count / 3;
    if (triangles < 96) return false;

    // Rebuild the original settings to reject transformed or custom-edited geometries.
    const baseline = makeBaselineGeometry(geometry);
    if (!baseline) return false;
    const baselinePositions = baseline.attributes.position.array;
    const sourcePositions = position.array;
    const matches = baselinePositions.length === sourcePositions.length &&
      baselinePositions.every((value, index) => Math.abs(value - sourcePositions[index]) < 1e-6);
    baseline.dispose();
    return matches;
  }

  function makeBaselineGeometry(geometry) {
    const p = geometry.parameters;
    switch (geometry.type) {
      case 'SphereGeometry':
        return new THREE.SphereGeometry(p.radius, p.widthSegments, p.heightSegments, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
      case 'CylinderGeometry':
        return new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
      case 'ConeGeometry':
        return new THREE.ConeGeometry(p.radius, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
      case 'TorusGeometry':
        return new THREE.TorusGeometry(p.radius, p.tube, p.radialSegments, p.tubularSegments, p.arc);
      default:
        return null;
    }
  }

  function getGeometryVariants(geometry) {
    if (geometryVariants.has(geometry)) return geometryVariants.get(geometry);
    const variants = { near: geometry, mid: geometry, far: geometry };
    if (canReplaceGeometry(geometry)) {
      for (const tier of ['mid', 'far']) {
        const candidate = makePrimitiveGeometry(geometry, tier);
        if (candidate && candidate.attributes.position.count < geometry.attributes.position.count) {
          variants[tier] = candidate;
        } else {
          candidate?.dispose();
        }
      }
    }
    geometryVariants.set(geometry, variants);
    return variants;
  }

  function collectGeometryLods(group) {
    const records = [];
    const visit = obj => {
      if (obj.isMesh && obj.geometry && !obj.userData?.interactive) {
        const variants = getGeometryVariants(obj.geometry);
        if (variants.mid !== variants.near || variants.far !== variants.near) {
          records.push({ mesh: obj, variants });
        }
      }
      obj.children?.forEach(visit);
    };
    visit(group);
    return records;
  }

  function classifyMachine(m, index) {
    if (!m?.group || m.kind === 'stock') return null;
    const fineDetails = [];
    const midDetails = [];
    const lights = [];
    const keepVisible = new Set();

    // Always keep base cabinet, deck, overhead nameplate, status lamp, and shroud silhouette in Far LOD
    if (m.lamp) keepVisible.add(m.lamp);
    if (m.modelHull) keepVisible.add(m.modelHull);
    if (m.shroud?.group) midDetails.push(m.shroud.group);
    if (m.door) midDetails.push(m.door);

    m.group.children.forEach(child => {
      if (keepVisible.has(child)) return;
      if (child.isPointLight) {
        lights.push(child);
        return;
      }
      if (child === m.shroud?.group || child === m.door) return;
      // Overhead nameplate & main lower housing slabs belong to the lightweight Far silhouette
      const isOverheadLabel = child.position && child.position.y > 3.05 && child.userData?.labelWidth >= 2;
      const w = child.geometry?.parameters?.width || 0;
      const isHullBox = child.position && child.position.y < 1.66 && w >= 1.5;
      if (isOverheadLabel || isHullBox) return;

      // Control panel scale text labels & tiny graduation ticks can be culled first at Mid distance
      if (child.userData?.anchor || (child.position?.z > 0.9 && w < 0.08 && !child.userData?.interactive)) {
        fineDetails.push(child);
        return;
      }
      // Everything inside the chamber (optics, heaters, probes, chuck, wafer, controls) unloads at Far LOD
      midDetails.push(child);
    });

    return {
      m,
      index,
      tier: 'near',
      fineDetails,
      midDetails,
      lights,
      geometryLods: collectGeometryLods(m.group)
    };
  }

  function applyTier(rec, tier) {
    rec.tier = tier;
    const showMid = tier !== 'far';
    const showFine = tier === 'near';
    for (const obj of rec.midDetails) obj.visible = showMid;
    for (const obj of rec.fineDetails) obj.visible = showFine;
    // Keep near machine chamber lights in the renderer's stable light set.
    // Process state changes only their intensity, avoiding shader recompilation
    // when a machine transitions from idle to running.
    for (const light of rec.lights) {
      light.visible = tier === 'near';
    }
    for (const { mesh, variants } of rec.geometryLods) {
      const geometry = variants[tier] || variants.near;
      if (mesh.geometry !== geometry) mesh.geometry = geometry;
    }
  }

  function update(now = performance.now()) {
    if (!initialized || !player) return;
    if (now - lastUpdateAt < 90) return;
    lastUpdateAt = now;

    const inDesignWorld = typeof designWorld !== 'undefined' && !!designWorld?.active;
    const prof = PROFILES[activeProfile] || PROFILES.desktop;
    const px = player.position.x, pz = player.position.z;

    let near = 0, mid = 0, far = 0;
    for (const rec of machineRecords) {
      const wx = rec.m.world?.x ?? 0, wz = rec.m.world?.z ?? 0;
      const dist = inDesignWorld ? 999 : Math.hypot(wx - px, wz - pz);
      const isRunningNear = status[rec.index]?.state === 'running' && dist <= prof.mid;
      const tier = (dist <= prof.near || isRunningNear) ? 'near' : dist <= prof.mid ? 'mid' : 'far';
      applyTier(rec, tier);
      if (tier === 'near') near++;
      else if (tier === 'mid') mid++;
      else far++;
    }

    // Activate only the nearest ceiling PointLights along Z to minimize PBR shader light loops
    let activeLights = 0;
    if (ceilingLights.length) {
      const sorted = ceilingLights
        .map(light => ({ light, dz: Math.abs(light.position.z - pz) }))
        .sort((a, b) => a.dz - b.dz);
      const limit = inDesignWorld ? 0 : prof.maxLights;
      sorted.forEach((entry, idx) => {
        const on = idx < limit && entry.dz < 18;
        entry.light.visible = on;
        if (on) activeLights++;
      });
    }

    stats.near = near;
    stats.mid = mid;
    stats.far = far;
    stats.activeLights = activeLights;
  }

  function init() {
    if (initialized || typeof scene === 'undefined' || !scene || !Array.isArray(machines)) return;
    initialized = true;
    machineRecords.length = 0;
    ceilingLights.length = 0;

    machines.forEach((m, arrIdx) => {
      if (!m || m.kind !== 'fabrication') return;
      const rec = classifyMachine(m, m.index ?? (arrIdx - 1));
      if (rec) machineRecords.push(rec);
    });

    scene.traverse(obj => {
      if (obj.isPointLight && obj.parent === scene && obj.position?.y > 3.1) {
        ceilingLights.push(obj);
      }
    });

    if (typeof loop === 'function') {
      const prevLoop = loop;
      loop = function (now) {
        update(now);
        prevLoop(now);
      };
    }
    update(performance.now());
  }

  function setLodProfile(profileName) {
    if (!PROFILES[profileName]) return activeProfile;
    activeProfile = profileName;
    lastUpdateAt = 0;
    update(performance.now());
    return activeProfile;
  }

  globalThis.CleanroomLOD = {
    PROFILES,
    init,
    update,
    setLodProfile,
    getStats: () => ({ ...stats, profile: activeProfile }),
    FutureHooks: {
      setLodProfile,
      registerInstancedPropGroup: null
    }
  };
})();

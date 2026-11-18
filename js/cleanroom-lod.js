'use strict';
/**
 * Distance-Based Cleanroom LOD, Light Windowing & Draw-Call Optimizer (`js/cleanroom-lod.js`)
 *
 * Reduces GPU fragment-shader overhead and draw calls across the 11-station fab hall by:
 * 1. Keeping only the nearest 4 overhead ceiling PointLights active per player Z band
 *    (0 while inside the isolated Design Room at z = 165) while keeping diffuser strips glowing.
 * 2. Classifying each station into Near (<= 12 m), Mid (12..22 m), and Far (> 22 m) LOD tiers:
 *    - Near: full dials, scale ticks/labels, internal chamber assemblies, shroud & door.
 *    - Mid: unloads fine scale labels & control tick sprites while retaining shroud, door & hull.
 *    - Far / Design World: keeps lightweight outer hull & overhead sign only, unloading chamber interiors.
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
  let initialized = false;
  let lastUpdateAt = 0;

  function classifyMachine(m, index) {
    if (!m?.group || m.kind === 'stock') return null;
    const fineDetails = [];
    const midDetails = [];
    const lights = [];
    const keepVisible = new Set();

    // Always keep base cabinet, deck, overhead nameplate, status lamp, and shroud silhouette in Far LOD
    if (m.lamp) keepVisible.add(m.lamp);
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
      lights
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

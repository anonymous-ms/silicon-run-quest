'use strict';
/**
 * Cleanroom Pedagogy, Difficulty Modes & 2.5D Cross-Section Module (`js/cleanroom-pedagogy.js`)
 *
 * Adapts the simulator for young learners, work-experience students, non-technical factory staff,
 * and experienced wafer fabrication operators via three difficulty modes plus a real-time
 * 2.5D CCD wafer cross-section diagram inside `#machineGui`.
 *
 * Extension hooks for future agents:
 * - `CleanroomPedagogy.FutureHooks.computeCoupledDeviceElectricals(records)`: compute realistic
 *   CCD charge-transfer efficiency (CTE) and dark-current impact from upstream layer thicknesses.
 * - `CleanroomPedagogy.FutureHooks.exportTrainingTranscript(run)`: export JSON/CSV lab records.
 */
(function () {
  const DIFFICULTY_KEY = 'siliconRunDifficultyV1';
  const MODES = {
    explorer: {
      label: 'Explorer (Guided & Forgiving)',
      showRouteArrows: true,
      showTargetHints: true,
      toleranceMultiplier: 1.3
    },
    operator: {
      label: 'Operator (Standard Cleanroom)',
      showRouteArrows: true,
      showTargetHints: true,
      toleranceMultiplier: 1.0
    },
    certification: {
      label: 'Certification (Strict / No Spoilers)',
      showRouteArrows: false,
      showTargetHints: false,
      toleranceMultiplier: 0.85
    }
  };

  let currentMode = 'operator';
  try {
    const saved = localStorage.getItem(DIFFICULTY_KEY);
    if (saved && MODES[saved]) currentMode = saved;
  } catch (_) {}

  function getMode() {
    return currentMode;
  }

  function setMode(mode) {
    if (!MODES[mode]) return currentMode;
    currentMode = mode;
    try { localStorage.setItem(DIFFICULTY_KEY, mode); } catch (_) {}
    state.hideRouteArrows = !MODES[mode].showRouteArrows;
    const menuSelect = $('difficultyMode');
    const settingsSelect = $('settingsDifficulty');
    if (menuSelect) menuSelect.value = mode;
    if (settingsSelect) settingsSelect.value = mode;
    return currentMode;
  }

  function renderCrossSection(activeMachineIndex) {
    const canvas = $('crossSectionCanvas');
    const caption = $('crossSectionCaption');
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#051118';
    ctx.fillRect(0, 0, w, h);

    const recRatio = idx => {
      if (state.cycle && state.cycle.i === idx) {
        return Math.max(0, (status[idx]?.metric || 0) / Math.max(1e-4, stations[idx].metric.target));
      }
      return Math.max(0, state.records[idx]?.ratio || 0);
    };

    const ox = recRatio(1);
    const coat = recRatio(2);
    const bake = recRatio(3);
    const exp = recRatio(4);
    const dev = recRatio(5);
    const etch = recRatio(6);
    const imp = recRatio(7);
    const rta = recRatio(8);
    const film = recRatio(9);

    // 1. P-type Silicon Substrate
    const subY = h - 22;
    ctx.fillStyle = '#526878';
    ctx.fillRect(10, subY, w - 20, 18);
    ctx.fillStyle = '#cfe5ef';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillText('P-TYPE Si SUBSTRATE', 16, h - 9);

    // Active CCD window spans middle x ∈ [95..205]
    const winL = 96, winR = 202, winW = winR - winL;

    // 2. Implanted & Activated N-Type Phosphorus Buried Channel
    if (imp > 0.02) {
      const impH = Math.min(11, 4 + imp * 5);
      ctx.fillStyle = rta > 0.25 ? '#9f67ff' : '#7344b5';
      ctx.fillRect(winL, subY - 1, winW, impH);
      ctx.fillStyle = '#f3e7ff';
      ctx.fillText('N+ BURIED CHANNEL', winL + 6, subY + 8);
    }

    // 3. Thermally Grown SiO2 Gate / Mask Oxide (uncapped visual growth up to canvas ceiling)
    const oxH = ox > 0 ? Math.min(20, Math.max(3, ox * 9)) : 0;
    let stackTopY = subY;
    if (oxH > 0) {
      const etchedOpen = etch > 0.35;
      ctx.fillStyle = '#367ff0';
      if (!etchedOpen) {
        ctx.fillRect(10, subY - oxH, w - 20, oxH);
      } else {
        // Oxide remains left/right of etched active channel window
        ctx.fillRect(10, subY - oxH, winL - 10, oxH);
        ctx.fillRect(winR, subY - oxH, w - 10 - winR, oxH);
      }
      stackTopY -= oxH;
    }

    // 4. I-Line Photoresist Coating (grows uncapped upward with proportional skew wave)
    const clear = Math.min(0.95, dev * 0.72);
    const resistH = coat > 0 ? Math.min(24, Math.max(2, coat * 8 * (1 - clear))) : 0;
    if (resistH > 0.5) {
      const v = status[2]?.values || {};
      const skew = Math.abs((v.flow || 1.8) / 1.8 - 3000 / (v.rpm || 3000));
      ctx.fillStyle = bake > 0.4 ? '#c82a54' : '#f24788';
      const yRes = Math.max(4, stackTopY - resistH);
      if (dev > 0.25) {
        ctx.fillRect(10, yRes, winL - 10, resistH);
        ctx.fillRect(winR, yRes, w - 10 - winR, resistH);
      } else {
        // Show slight dome bump proportional to recipe control skew
        const bulge = Math.min(5, skew * 3);
        ctx.beginPath();
        ctx.moveTo(10, stackTopY);
        ctx.lineTo(10, yRes);
        ctx.quadraticCurveTo(w * 0.5, yRes - bulge, w - 10, yRes);
        ctx.lineTo(w - 10, stackTopY);
        ctx.closePath();
        ctx.fill();
      }
      if (exp > 0.1 && dev < 0.7) {
        ctx.fillStyle = 'rgba(83,231,255,0.45)';
        ctx.fillRect(winL, yRes, winW, resistH);
      }
      stackTopY = yRes;
    }

    // 5. Aluminium Clock Interconnect & Optical Shield
    if (film > 0.03) {
      const metalChoice = status[9]?.values?.metal || 'Aluminium';
      ctx.fillStyle = metalChoice === 'Gold' ? '#ffd24d' : metalChoice === 'Copper' ? '#e88b58' : '#d2e6f7';
      const metH = Math.min(12, Math.max(3, film * 6));
      const yMet = Math.max(4, (ox > 0 && etch < 0.35 ? subY - oxH : subY) - metH);
      ctx.fillRect(10, yMet, w - 20, metH);
    }

    if (caption) {
      const s = activeMachineIndex != null ? stations[activeMachineIndex] : null;
      if (activeMachineIndex === stations.length - 1 && state.records.filter(Boolean).length >= 3) {
        const elec = computeCoupledDeviceElectricals(state.records);
        caption.textContent = `CCD Health: CTE ${elec.ctePct.toFixed(2)}% · Dark current ${elec.darkCurrent.toFixed(1)} e⁻/px/s`;
      } else {
        caption.textContent = s
          ? `${s.short}: ${MODES[currentMode].showTargetHints ? s.note : 'Monitor live gauges & physical layer response.'}`
          : 'Live CCD layer stack updates as each fab station processes your wafer.';
      }
    }
  }

  function computeCoupledDeviceElectricals(records) {
    const r = i => records?.[i];
    const oxErr = r(1) ? Math.abs(1 - (r(1).ratio || 1)) : 0.35;
    const impScore = r(7)?.score ?? 55;
    const rtaScore = r(8)?.score ?? 55;
    const etchScore = r(6)?.score ?? 55;
    const overlayErr = r(4)?.values?.overlay ?? 0.8;
    const ctePenalty = oxErr * 1.8 + Math.max(0, 100 - impScore) * 0.04 + Math.max(0, 100 - etchScore) * 0.03 + Math.max(0, overlayErr - 0.8) * 0.8;
    const ctePct = clamp(99.98 - ctePenalty, 82, 99.99);
    const darkCurrent = clamp(1.4 + Math.max(0, 100 - rtaScore) * 0.35 + oxErr * 12, 1.2, 65);
    return { ctePct, darkCurrent };
  }

  let lastStripSig = '';
  function renderProcessStrip() {
    const strip = $('processStrip');
    if (!strip || !Array.isArray(stations)) return;
    const show = !!state.started && !state.completed && !renderer?.xr?.isPresenting;
    strip.classList.toggle('visible', show);
    if (!show) return;
    const sig = stations.map((_, i) => `${i}:${status[i]?.state}:${Math.round(state.records[i]?.score || 0)}:${state.current}`).join('|');
    if (sig === lastStripSig) return;
    lastStripSig = sig;
    const shortTag = ['Design', 'Oxide', 'Coat', 'Bake', 'Align', 'Dev', 'Etch', 'Implant', 'RTA', 'Metal', 'Probe'];
    strip.innerHTML = stations.map((s, i) => {
      const st = status[i];
      const rec = state.records[i];
      const cls = st?.state === 'running' ? 'proc-step active running' : i === state.current ? 'proc-step active' : rec ? 'proc-step done' : 'proc-step';
      const badge = rec ? ` ✓${Math.round(rec.score)}%` : st?.state === 'running' ? ' ●' : '';
      return `<span class="${cls}">${String(i + 1).padStart(2, '0')} ${shortTag[i] || s.short}${badge}</span>`;
    }).join('<span class="proc-arrow">›</span>');
  }

  function installHooks() {
    if (typeof specText === 'function') {
      const prevSpecText = specText;
      specText = function (c) {
        if (!MODES[currentMode].showTargetHints) {
          return 'Certification mode: verify target on Process Traveller & gauges';
        }
        return prevSpecText(c);
      };
    }

    if (typeof controlFitness === 'function') {
      const prevControlFitness = controlFitness;
      controlFitness = function (c, v) {
        if (c.kind === 'choice') return prevControlFitness(c, v);
        const mult = MODES[currentMode].toleranceMultiplier || 1;
        return clamp(100 - Math.abs(Number(v) - c.target) / (c.tol * mult) * 25, 0, 100);
      };
    }

    if (typeof updateMachineGui === 'function') {
      const prevUpdateGui = updateMachineGui;
      updateMachineGui = function () {
        prevUpdateGui();
        const target = state.focus?.userData;
        const idx = target?.machineIndex ?? state.nearest?.index ?? state.current;
        renderCrossSection(idx);
        renderProcessStrip();
      };
    }

    if (typeof updateHUD === 'function') {
      const prevHud = updateHUD;
      updateHUD = function () {
        prevHud();
        renderProcessStrip();
      };
    }

    if (typeof animateEffects === 'function') {
      const prevAnimate = animateEffects;
      animateEffects = function (t, dt) {
        state.hideRouteArrows = !MODES[currentMode].showRouteArrows;
        prevAnimate(t, dt);
        if (state.hideRouteArrows && Array.isArray(effects)) {
          for (const e of effects) {
            if (e.kind === 'route') e.obj.visible = false;
          }
          if (guideBeacon) guideBeacon.visible = false;
          if (guideFloorRing) guideFloorRing.visible = false;
        }
      };
    }

    const menuSelect = $('difficultyMode');
    const settingsSelect = $('settingsDifficulty');
    if (menuSelect) {
      menuSelect.value = currentMode;
      menuSelect.addEventListener('change', () => setMode(menuSelect.value));
    }
    if (settingsSelect) {
      settingsSelect.value = currentMode;
      settingsSelect.addEventListener('change', () => setMode(settingsSelect.value));
    }
    state.hideRouteArrows = !MODES[currentMode].showRouteArrows;
  }

  globalThis.CleanroomPedagogy = {
    MODES,
    getMode,
    setMode,
    renderCrossSection,
    renderProcessStrip,
    computeCoupledDeviceElectricals,
    init: installHooks,
    FutureHooks: {
      computeCoupledDeviceElectricals,
      exportTrainingTranscript: null
    }
  };
})();

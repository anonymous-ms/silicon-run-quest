'use strict';
/**
 * Procedural WebAudio Cleanroom Soundscape (`js/cleanroom-audio.js`)
 *
 * Generates zero-asset synthesized audio cues:
 * - Magnetic door latch clicks & locked-door interlock alerts
 * - Layered crystalline glass-breaking wafer shatter (`playWaferShatter`)
 * - Steady mechanical whirring & vibrating loops while fabrication machines run
 *   (`startMachineWhir` / `stopMachineWhir`)
 *
 * Safe no-op in headless Node tests or muted browsers.
 *
 * Extension hooks for future agents:
 * - `CleanroomAudio.FutureHooks.attachSpatialStationPanner(stationIndex, audioNode)`:
 *   upgrade global oscillators to HRTF 3D spatial PannerNodes anchored at each station.
 * - `CleanroomAudio.FutureHooks.playAirShowerWhoosh()`: trigger filtered noise bursts
 *   synchronized with `CleanroomRealism` air-shower boosts at `z = -17`.
 */
(function () {
  const AUDIO_KEY = 'siliconRunAudioV1';
  let audioCtx = null;
  let noiseBuffer = null;
  let enabled = true;
  const activeWhirs = new Map();

  try {
    const saved = localStorage.getItem(AUDIO_KEY);
    if (saved === '0') enabled = false;
  } catch (_) {}

  function ensureContext() {
    if (!enabled) return null;
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      return audioCtx;
    }
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch (_) {
      return null;
    }
    return audioCtx;
  }

  function getNoiseBuffer(ctx) {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return buf;
  }

  function playTone(freq, endFreq, durationSec, type = 'sine', gainPeak = 0.06, delaySec = 0) {
    const ctx = ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + durationSec);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec + 0.02);
    } catch (_) {}
  }

  function playFilteredNoise(filterType, freq, q, durationSec, gainPeak, delaySec = 0) {
    const ctx = ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delaySec;
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(freq, now);
      filter.Q.setValueAtTime(q, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainPeak, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      src.stop(now + durationSec + 0.02);
    } catch (_) {}
  }

  function playLatchClick() {
    playTone(1350, 520, 0.055, 'triangle', 0.05);
    playTone(115, 70, 0.075, 'sine', 0.06);
  }

  function playUnlatchClick() {
    playTone(340, 820, 0.045, 'triangle', 0.045);
    playFilteredNoise('bandpass', 2400, 1.8, 0.03, 0.03, 0);
  }

  function playButtonClick(enabledState = true) {
    if (enabledState) {
      playTone(1180, 640, 0.032, 'triangle', 0.045);
      playFilteredNoise('bandpass', 2800, 2.0, 0.018, 0.025, 0);
    } else {
      playTone(230, 145, 0.05, 'sine', 0.03);
    }
  }

  function playLockBeep() {
    playTone(430, 320, 0.11, 'square', 0.035);
  }

  function playChime(good = true) {
    playTone(good ? 523.25 : 293.66, good ? 783.99 : 220, 0.22, 'sine', 0.055);
  }

  function playDialClick(isDial = true) {
    playTone(isDial ? 2250 : 1550, isDial ? 980 : 720, 0.022, 'triangle', 0.032);
    playFilteredNoise('bandpass', isDial ? 3600 : 2400, 2.2, 0.014, 0.024, 0);
  }

  function playWaferShatter() {
    const ctx = ensureContext();
    if (!ctx) return;
    // Initial brittle glass crack + high-frequency fracture noise
    playFilteredNoise('highpass', 3200, 0.8, 0.07, 0.09, 0);
    playTone(3600, 920, 0.045, 'triangle', 0.06, 0);
    // Secondary fine glass shard scatter + crystalline pings
    playFilteredNoise('bandpass', 5400, 1.4, 0.19, 0.05, 0.02);
    const shardFreqs = [2240, 2980, 3710, 4490, 5180, 3340, 5920];
    shardFreqs.forEach((f, idx) => {
      const delay = 0.012 + idx * 0.019 + (idx % 2) * 0.008;
      const dur = 0.06 + (idx % 3) * 0.035;
      playTone(f, f * 0.96, dur, idx % 2 ? 'sine' : 'triangle', 0.028, delay);
    });
  }

  function startMachineWhir(i) {
    const ctx = ensureContext();
    if (!ctx || activeWhirs.has(i)) return;
    try {
      const now = ctx.currentTime;
      const station = Array.isArray(stations) ? stations[i] : null;
      const isSpin = station?.type === 'spinner' || station?.type === 'wetbench';
      const rpmFactor = isSpin ? clamp((status[i]?.values?.rpm || 3000) / 3000, 0.6, 1.4) : 1;
      const baseFreq = (isSpin ? 82 : 64) * rpmFactor;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.linearRampToValueAtTime(0.032, now + 0.18);
      master.connect(ctx.destination);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isSpin ? 420 : 280, now);
      filter.Q.setValueAtTime(1.8, now);
      filter.connect(master);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc1.connect(filter);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(baseFreq * 2.01, now);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.42, now);
      osc2.connect(subGain);
      subGain.connect(filter);

      // Steady vibration & whirring LFO modulating pitch + amplitude
      const vibLfo = ctx.createOscillator();
      vibLfo.type = 'sine';
      vibLfo.frequency.setValueAtTime(isSpin ? 15 : 11, now);
      const vibFreqGain = ctx.createGain();
      vibFreqGain.gain.setValueAtTime(3.2, now);
      vibLfo.connect(vibFreqGain);
      vibFreqGain.connect(osc1.frequency);
      vibFreqGain.connect(osc2.frequency);

      const vibAmpGain = ctx.createGain();
      vibAmpGain.gain.setValueAtTime(0.009, now);
      vibLfo.connect(vibAmpGain);
      vibAmpGain.connect(master.gain);

      // Steady bearing / airflow bed
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = getNoiseBuffer(ctx);
      noiseSrc.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(isSpin ? 520 : 310, now);
      noiseFilter.Q.setValueAtTime(2.4, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.28, now);
      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);

      osc1.start(now);
      osc2.start(now);
      vibLfo.start(now);
      noiseSrc.start(now);
      activeWhirs.set(i, { master, osc1, osc2, vibLfo, noiseSrc });
    } catch (_) {}
  }

  function stopMachineWhir(i) {
    const entry = activeWhirs.get(i);
    if (!entry || !audioCtx) {
      activeWhirs.delete(i);
      return;
    }
    activeWhirs.delete(i);
    try {
      const now = audioCtx.currentTime;
      entry.master.gain.cancelScheduledValues(now);
      entry.master.gain.setValueAtTime(Math.max(0.0001, entry.master.gain.value), now);
      entry.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      const stopAt = now + 0.18;
      entry.osc1.stop(stopAt);
      entry.osc2.stop(stopAt);
      entry.vibLfo.stop(stopAt);
      entry.noiseSrc.stop(stopAt);
    } catch (_) {}
  }

  function stopAllWhirs() {
    for (const key of [...activeWhirs.keys()]) stopMachineWhir(key);
  }

  function setEnabled(next) {
    enabled = !!next;
    try { localStorage.setItem(AUDIO_KEY, enabled ? '1' : '0'); } catch (_) {}
    const checkbox = $('audioEnabled');
    if (checkbox) checkbox.checked = enabled;
    if (!enabled) stopAllWhirs();
    return enabled;
  }

  function init() {
    const unlock = () => ensureContext();
    globalThis.addEventListener?.('pointerdown', unlock, { once: true, passive: true });
    globalThis.addEventListener?.('keydown', unlock, { once: true, passive: true });

    const audioBox = $('audioEnabled');
    if (audioBox) {
      audioBox.checked = enabled;
      audioBox.addEventListener('change', () => setEnabled(audioBox.checked));
    }

    if (typeof notifyDoorLocked === 'function') {
      const prevLocked = notifyDoorLocked;
      notifyDoorLocked = function (i) {
        prevLocked(i);
        playLockBeep();
      };
    }

    if (typeof startProcess === 'function') {
      const prevStart = startProcess;
      startProcess = function (i) {
        const ok = prevStart(i);
        if (ok) {
          playTone(260, 440, 0.14, 'triangle', 0.045);
          startMachineWhir(i);
        }
        return ok;
      };
    }

    if (typeof stopProcess === 'function') {
      const prevStop = stopProcess;
      stopProcess = function (i) {
        stopMachineWhir(i);
        prevStop(i);
        playChime((status[i]?.score || 0) >= 65);
      };
    }

    if (typeof newRun === 'function') {
      const prevNewRun = newRun;
      newRun = function () {
        stopAllWhirs();
        prevNewRun();
      };
    }

    if (typeof completeStage === 'function') {
      const prevComplete = completeStage;
      completeStage = function (i) {
        prevComplete(i);
      };
    }

    if (typeof activateFocused === 'function') {
      const prevActivate = activateFocused;
      activateFocused = function () {
        const d = state.focus?.userData;
        if (d?.type === 'button') {
          const en = typeof buttonEnabled === 'function' ? buttonEnabled(d) : true;
          playButtonClick(en);
        }
        return prevActivate();
      };
    }

    if (typeof activateDesignAction === 'function') {
      const prevDesignAct = activateDesignAction;
      activateDesignAction = function (button) {
        if (button) playButtonClick(true);
        return prevDesignAct(button);
      };
    }

    if (typeof updateDoors === 'function') {
      const doorLatched = new Map();
      const prevUpdateDoors = updateDoors;
      updateDoors = function (dt) {
        if (Array.isArray(status)) {
          status.forEach((st, i) => {
            if (!doorLatched.has(i)) doorLatched.set(i, (st?.doorAmount || 0) <= 0.002);
          });
        }
        prevUpdateDoors(dt);
        if (Array.isArray(status)) {
          status.forEach((st, i) => {
            const m = machines[i + 1];
            if (!m || m.kind !== 'fabrication') return;
            const nowLatched = (st?.doorAmount || 0) <= 0.002;
            const prev = doorLatched.get(i);
            if (prev !== undefined && prev !== nowLatched) {
              if (nowLatched) playLatchClick();
              else playUnlatchClick();
            }
            doorLatched.set(i, nowLatched);
          });
        }
      };
    }

    if (typeof shatterWafer === 'function') {
      const prevShatter = shatterWafer;
      shatterWafer = function (...args) {
        playWaferShatter();
        return prevShatter.apply(this, args);
      };
    }

    if (typeof adjustControl === 'function') {
      const prevAdjust = adjustControl;
      adjustControl = function (d, dir) {
        const idx = d?.machineIndex;
        const key = d?.controlKey;
        const before = idx != null && key ? status[idx]?.values?.[key] : undefined;
        prevAdjust(d, dir);
        const after = idx != null && key ? status[idx]?.values?.[key] : undefined;
        if (before !== after) {
          const spec = stations[idx]?.controls?.find(x => x.key === key);
          playDialClick(spec?.style !== 'slider');
        }
      };
    }
  }

  globalThis.CleanroomAudio = {
    init,
    setEnabled,
    isEnabled: () => enabled,
    playLatchClick,
    playUnlatchClick,
    playButtonClick,
    playLockBeep,
    playChime,
    playDialClick,
    playWaferShatter,
    startMachineWhir,
    stopMachineWhir,
    stopAllWhirs,
    FutureHooks: {
      attachSpatialStationPanner: null,
      playAirShowerWhoosh: null
    }
  };
})();

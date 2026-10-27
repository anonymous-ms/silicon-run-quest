/**
 * Silicon Run WebXR dual-trigger compatibility shim.
 *
 * Load this after three.min.js and before silicon-run.v812.js. It observes the
 * controllers requested from each WebXRManager. If the game registers a
 * trigger/select handler for one controller but leaves the equivalent event
 * unbound on the other, the same handler is attached to the unbound controller.
 * The original handler therefore receives the actual event target and keeps the
 * game's existing controller-ray hit testing, including desktop-screen hits.
 */
(function installDualTriggerShim(global) {
  'use strict';

  const THREE = global.THREE;
  if (!THREE || !THREE.WebGLRenderer || THREE.WebGLRenderer.__siliconRunDualTrigger) {
    return;
  }

  const OriginalRenderer = THREE.WebGLRenderer;
  const TRIGGER_EVENTS = ['selectstart', 'selectend', 'select'];

  function patchXRManager(xr) {
    if (!xr || xr.__siliconRunDualTrigger) return;

    Object.defineProperty(xr, '__siliconRunDualTrigger', {
      value: true,
      configurable: false,
      enumerable: false
    });

    const originalGetController = xr.getController.bind(xr);
    const controllers = new Map();
    const controllerState = new WeakMap();
    let syncTimer = 0;

    function stateFor(controller) {
      let state = controllerState.get(controller);
      if (!state) {
        state = {
          originalAdd: controller.addEventListener.bind(controller),
          originalRemove: controller.removeEventListener.bind(controller),
          listeners: new Map(TRIGGER_EVENTS.map((type) => [type, new Set()]))
        };
        controllerState.set(controller, state);
      }
      return state;
    }

    function addLocal(controller, type, listener) {
      const state = stateFor(controller);
      const listeners = state.listeners.get(type);
      if (!listeners || listeners.has(listener)) return;
      listeners.add(listener);
      state.originalAdd(type, listener);
    }

    function removeLocal(controller, type, listener) {
      const state = stateFor(controller);
      const listeners = state.listeners.get(type);
      if (!listeners || !listeners.delete(listener)) return;
      state.originalRemove(type, listener);
    }

    function syncUnboundControllerEvents() {
      syncTimer = 0;
      if (controllers.size < 2) return;

      for (const type of TRIGGER_EVENTS) {
        const entries = Array.from(controllers.values()).map((controller) => ({
          controller,
          listeners: stateFor(controller).listeners.get(type)
        }));
        const populated = entries.filter((entry) => entry.listeners.size > 0);
        const empty = entries.filter((entry) => entry.listeners.size === 0);

        // Do not interfere when the game deliberately configured both hands.
        if (populated.length !== 1 || empty.length === 0) continue;

        for (const target of empty) {
          for (const listener of populated[0].listeners) {
            addLocal(target.controller, type, listener);
          }
        }
      }
    }

    function scheduleSync() {
      if (syncTimer) global.clearTimeout(syncTimer);
      syncTimer = global.setTimeout(syncUnboundControllerEvents, 0);
    }

    function patchController(controller, index) {
      if (controllerState.has(controller)) return controller;
      const state = stateFor(controller);
      controllers.set(index, controller);

      controller.addEventListener = function addEventListener(type, listener, options) {
        if (!TRIGGER_EVENTS.includes(type) || typeof listener !== 'function') {
          state.originalAdd(type, listener, options);
          return;
        }
        addLocal(controller, type, listener);
        scheduleSync();
      };

      controller.removeEventListener = function removeEventListener(type, listener, options) {
        if (!TRIGGER_EVENTS.includes(type) || typeof listener !== 'function') {
          state.originalRemove(type, listener, options);
          return;
        }
        removeLocal(controller, type, listener);
      };

      scheduleSync();
      return controller;
    }

    xr.getController = function getController(index) {
      return patchController(originalGetController(index), index);
    };

    if (typeof xr.addEventListener === 'function') {
      xr.addEventListener('sessionstart', function onSessionStart() {
        global.setTimeout(syncUnboundControllerEvents, 50);
      });
    }
  }

  class DualTriggerRenderer extends OriginalRenderer {
    constructor() {
      super(...arguments);
      patchXRManager(this.xr);
    }
  }

  Object.defineProperty(DualTriggerRenderer, '__siliconRunDualTrigger', {
    value: true
  });
  THREE.WebGLRenderer = DualTriggerRenderer;
})(window);

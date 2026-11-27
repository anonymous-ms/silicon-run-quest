'use strict';

/*
 * Silicon Run VR wafer and imported-machine corrections.
 * Loaded after parallel-wafer-runtime.js and before startup.
 */
(function installWaferVrFixes(global) {
  const CANONICAL_WORLD_SCALE = 1;
  const PHOTO_OPEN_STOP = Math.PI / 2;
  const OPEN_PICKUP_THRESHOLD = .45;

  function machineFor(index) {
    return machines[index + 1] || null;
  }

  function isImportedPhotolithography(machine) {
    return !!machine && machine.station?.type === 'spinner';
  }

  function setCanonicalWorldScale(object) {
    if (!object) return;
    const parentScale = object.parent
      ? object.parent.getWorldScale(new THREE.Vector3())
      : new THREE.Vector3(1, 1, 1);
    object.scale.set(
      CANONICAL_WORLD_SCALE / Math.max(Math.abs(parentScale.x), 1e-6),
      CANONICAL_WORLD_SCALE / Math.max(Math.abs(parentScale.y), 1e-6),
      CANONICAL_WORLD_SCALE / Math.max(Math.abs(parentScale.z), 1e-6)
    );
  }

  function mountPhysicalWafer(body, machine) {
    if (!body || !machine?.waferPivot) return false;
    machine.waferPivot.attach(body.view);
    body.view.position.set(0, 0, 0);
    body.view.quaternion.identity();
    setCanonicalWorldScale(body.view);
    body.view.visible = true;
    body.dynamic = false;
    body.velocity?.set(0, 0, 0);
    body.acceleration?.set(0, 0, 0);
    body.angularVelocity?.set(0, 0, 0);
    machine.wafer.visible = false;
    machine.body = body;
    return true;
  }

  function releasePhysicalWafer(body, machine) {
    if (!body) return;
    detachPreserve(body.view, scene);
    setCanonicalWorldScale(body.view);
    body.view.visible = true;
    if (machine) {
      machine.body = null;
      machine.wafer.visible = false;
    }
    body.machineIndex = null;
  }

  function completedMountedWaferCanBePicked(body) {
    if (!body || body.machineIndex == null) return false;
    const index = body.machineIndex;
    const machine = machineFor(index);
    const stationState = status[index];
    return !!machine && machine.body === body &&
      stationState?.state === 'done' &&
      stationState.doorAmount > OPEN_PICKUP_THRESHOLD;
  }

  function nearestPickableWafer(controller, maxDistance = phys.pinchDistance) {
    const handPosition = pinchWorld(controller);
    let best = null;
    let bestDistance = maxDistance;
    for (const body of parallel.wafers) {
      if (!body || body.broken || body.grabbable === false || body.heldBy != null || !body.view.visible) continue;
      if (body.machineIndex != null && !completedMountedWaferCanBePicked(body)) continue;
      const point = body.view.getWorldPosition(new THREE.Vector3());
      const distance = handPosition.distanceTo(point);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { body, point, distance };
      }
    }
    return best;
  }

  const originalTryPlaceWafer = tryPlaceWafer;
  tryPlaceWafer = function fixedTryPlaceWafer(body = parallel.active) {
    if (!body || body.broken || !body.view.visible) return false;
    const accepted = machineAcceptance(body);
    if (!accepted) return false;
    if (accepted.isDelivery) return originalTryPlaceWafer(body);

    const { i, machine, st } = accepted;
    body.machineIndex = i;
    body.staged = false;
    if (!mountPhysicalWafer(body, machine)) return originalTryPlaceWafer(body);
    st.state = 'loadedDoorOpen';
    syncActiveWafer(body);
    refreshWaferVisual(body.view);
    toast(`${body.lotId} seated in ${stations[i].name}.`);
    pulseXR(.65, 70);
    updateAll();
    return true;
  };

  grabWafer = function fixedGrabWafer(controller) {
    if (getHandGrab(controller)) return false;
    const near = nearestPickableWafer(controller);
    if (!near) return false;

    const body = near.body;
    const mountedIndex = body.machineIndex;
    const mountedMachine = mountedIndex == null ? null : machineFor(mountedIndex);
    const wasStaged = !!body.staged;

    if (mountedIndex != null) {
      releasePhysicalWafer(body, mountedMachine);
      status[mountedIndex].state = 'unloadedDoorOpen';
      setLamp(mountedIndex);
    } else {
      detachPreserve(body.view, scene);
      setCanonicalWorldScale(body.view);
    }

    body.dynamic = false;
    body.velocity?.set(0, 0, 0);
    body.acceleration?.set(0, 0, 0);
    body.angularVelocity?.set(0, 0, 0);
    body.staged = false;
    body.heldBy = handKey(controller);

    if (phys.stockReady === body.view) phys.stockReady = null;
    if (wasStaged && stockMachine?.robot) {
      stockMachine.robot.phase = 'animating';
      stockMachine.robot.t = 0;
    }

    const grab = {
      kind: 'wafer',
      controller,
      body,
      last: pinchWorld(controller).clone(),
      velocity: new THREE.Vector3(),
      snappedStation: null
    };
    setHandGrab(controller, grab);
    updateHeldWaferGrab(grab, 0);
    syncActiveWafer(body);
    phys.waferEverPicked = true;
    if (phys.pickupGuide) phys.pickupGuide.visible = false;
    scheduleStockReplacement();
    pulseXR(.6, 65);
    toast(`${controller.userData.handedness || 'Controller'} hand grabbed wafer ${body.lotId}.`);
    updateAll();
    return true;
  };

  exposeCompletedWafer = function fixedExposeCompletedWafer() {
    status.forEach((stationState, index) => {
      if (stationState.state !== 'done' || stationState.doorAmount <= OPEN_PICKUP_THRESHOLD) return;
      const machine = machineFor(index);
      const body = machine?.body;
      if (!body || body.heldBy != null || body.broken) return;
      if (machine.waferPivot && body.view.parent !== machine.waferPivot) mountPhysicalWafer(body, machine);
      body.view.visible = true;
      body.dynamic = false;
      machine.wafer.visible = false;
      refreshWaferVisual(body.view);
    });
  };

  enforceStationWaferVisibility = function fixedStationWaferVisibility() {
    status.forEach((stationState, index) => {
      const machine = machineFor(index);
      if (!machine?.wafer) return;
      const occupied = !!machine.body && !machine.body.broken;
      machine.wafer.visible = false;
      if (!occupied) return;
      const body = machine.body;
      if (machine.waferPivot && body.view.parent !== machine.waferPivot && body.heldBy == null) {
        mountPhysicalWafer(body, machine);
      }
      body.view.visible = true;
      body.dynamic = false;
      if (['loadedDoorOpen', 'loaded', 'running', 'done'].includes(stationState.state)) {
        refreshWaferVisual(
          body.view,
          stationState.state === 'running' ? index : -1,
          stationState.state === 'running' ? stationState.metric / Math.max(1, stations[index].metric.target) : 0,
          stationState.values
        );
      }
    });
  };

  const originalNewRun = newRun;
  newRun = function fixedNewRun() {
    const result = originalNewRun.apply(this, arguments);
    machines.slice(1).forEach(machine => {
      machine.body = null;
      if (machine.wafer) machine.wafer.visible = false;
    });
    status.forEach(stationState => { stationState.transfer = null; });
    return result;
  };

  const originalUpdateDoors = updateDoors;
  updateDoors = function fixedUpdateDoors(dt) {
    machines.slice(1).forEach(machine => {
      if (isImportedPhotolithography(machine)) machine.doorMaxAngle = PHOTO_OPEN_STOP;
    });
    originalUpdateDoors(dt);
    machines.slice(1).forEach(machine => {
      if (!isImportedPhotolithography(machine)) return;
      const index = machine.index;
      const stationState = status[index];
      machine.doorMaxAngle = PHOTO_OPEN_STOP;
      if (stationState.doorAmount >= .995) {
        stationState.doorAmount = 1;
        stationState.doorTarget = 1;
        phys.doorVelocities[index] = 0;
        machine.door.rotation.y = -PHOTO_OPEN_STOP;
      }
    });
  };

  const originalSqueezeEnd = onXRSqueezeEnd;
  onXRSqueezeEnd = function fixedSqueezeEnd(controller) {
    const grabbedIndex = phys.doorGrab?.controller === controller ? phys.doorGrab.i : null;
    originalSqueezeEnd(controller);
    if (grabbedIndex == null) return;
    const machine = machineFor(grabbedIndex);
    const stationState = status[grabbedIndex];
    if (!isImportedPhotolithography(machine) || stationState.doorAmount <= DOOR_MAGNET_ANGLE) return;
    phys.doorVelocities[grabbedIndex] = 0;
    stationState.doorTarget = stationState.doorAmount >= .92 ? 1 : stationState.doorAmount;
    stationState.doorManual = false;
  };

  global.SiliconRunWaferVrFixes = Object.freeze({
    canonicalWorldScale: CANONICAL_WORLD_SCALE,
    photolithographyOpenStopRadians: PHOTO_OPEN_STOP
  });
})(window);

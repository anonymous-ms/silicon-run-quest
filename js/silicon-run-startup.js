'use strict';
const photoresistIndex=stations.findIndex(station=>station.type==='spinner');
let photoresistReadout=null,photoresistChamber=null,chamberModuleUsed=false;
// Keep chamber UI units ergonomic while translating its 0-100% and 0-1800 rpm sliders into the existing recipe ranges.
function installPhotoresistStation(){
  if(photoresistIndex<0||!globalThis.PhotoresistChamber)return;
  const launcher=$('openPhotoresist'),overlay=document.createElement('div'),frame=document.createElement('section'),root=document.createElement('div'),close=document.createElement('button');
  overlay.className='pr-runtime-overlay';overlay.hidden=true;
  frame.className='pr-runtime-frame';frame.setAttribute('role','dialog');frame.setAttribute('aria-modal','true');frame.setAttribute('aria-label','Photoresist deposition station');
  root.className='pr-runtime-root';close.className='pr-runtime-close';close.type='button';close.textContent='EXIT STATION';
  frame.append(close,root);overlay.appendChild(frame);document.body.appendChild(overlay);
  launcher.style.cssText='width:100%;margin-top:9px;padding:8px;border:1px solid #31d7f3;border-radius:4px;color:#03151b;background:linear-gradient(90deg,#4de0ff,#78ffbd);font-weight:900;font-size:9px;pointer-events:auto';
  function runtimeState(){
    const st=status[photoresistIndex],machine=machines[photoresistIndex+1];
    return{canStart:!!machine?.body&&st.state==='loaded'&&st.doorAmount<=5/90,running:st.state==='running',doorOpen:st.doorAmount>.08,flowPercent:Math.round(10+(st.values.flow-.8)/2.2*90),rpmDisplay:Math.round((st.values.rpm-1800)*.75)}
  }
  function closeStation(){
    if(overlay.hidden)return;
    overlay.hidden=true;
    if(photoresistChamber)photoresistChamber.setRuntimeState(runtimeState());
  }
  function openStation(){
    overlay.hidden=false;
    Object.keys(keys).forEach(key=>keys[key]=false);
    try{document.exitPointerLock?.()}catch{}
    photoresistChamber?.resize();
    requestAnimationFrame(()=>{photoresistChamber?.resize();photoresistChamber?.setRuntimeState(runtimeState())});
  }
  function resetChamberState(){
    chamberModuleUsed=false;
    photoresistReadout=null;
    if(photoresistChamber&&status[photoresistIndex]?.state!=='running')photoresistChamber.reset();
  }
  photoresistChamber=PhotoresistChamber.mount({root,bridge:{
    getState:runtimeState,
    setFlow(percent){status[photoresistIndex].values.flow=clamp(.8+(percent-10)/90*2.2,.8,3);updateControlMeshes(photoresistIndex)},
    setRpm(value){status[photoresistIndex].values.rpm=clamp(1800+value/ .75,1800,4200);updateControlMeshes(photoresistIndex)},
    setDoor(open){const st=status[photoresistIndex];if(open!==(st.doorTarget>.5))toggleDoor(photoresistIndex)},
    onStart(){const st=status[photoresistIndex],machine=machines[photoresistIndex+1];if(st.state==='loaded'&&machine?.body&&st.doorAmount<=5/90)startProcess(photoresistIndex);if(st.state==='running'){chamberModuleUsed=true;return true}return false},
    onStop(){if(status[photoresistIndex].state==='running'){if(chamberModuleUsed&&photoresistReadout)status[photoresistIndex].metric=photoresistReadout.thicknessNm/1000;stopProcess(photoresistIndex)}},
    onReset(){chamberModuleUsed=false;photoresistReadout=null;const st=status[photoresistIndex];if(st.state!=='running')return;st.cycle=null;st.metric=0;st.state='loaded';state.cycle=runningCycles()[0]?.cycle||null;setLamp(photoresistIndex);updateAll()},
    onReadout(value){if(!chamberModuleUsed&&overlay.hidden)return;photoresistReadout=value;if(chamberModuleUsed&&status[photoresistIndex].state==='running')status[photoresistIndex].metric=value.thicknessNm/1000}
  }});
  launcher.onclick=openStation;close.onclick=closeStation;
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeStation()});
  addEventListener('keydown',event=>{
    if(!overlay.hidden){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeStation();return}
      event.stopImmediatePropagation();
      return;
    }
    if(event.code==='KeyM'&&!event.repeat&&!launcher.hidden&&state.started&&!state.paused&&!designWorld.active&&designMode.phase==='idle'&&!renderer.xr.isPresenting){
      const editing=event.target instanceof Element&&!!event.target.closest('input,textarea,select,[contenteditable="true"]');
      if(!editing){event.preventDefault();openStation()}
    }
  },true);
  addEventListener('keyup',event=>{if(!overlay.hidden)event.stopImmediatePropagation()},true);
  const previousMetric=calculateMetric;
  calculateMetric=function(i,t){return i===photoresistIndex&&chamberModuleUsed&&photoresistReadout?photoresistReadout.thicknessNm/1000:previousMetric(i,t)};
  const previousCompleteStage=completeStage;
  completeStage=function(i){previousCompleteStage(i);if(i===photoresistIndex)resetChamberState()};
  const previousNewRunPhotoresist=newRun;
  newRun=function(){previousNewRunPhotoresist();resetChamberState()};
  const previousMachineGui=updateMachineGui;
  updateMachineGui=function(){
    previousMachineGui();
    const focused=state.focus?.userData?.machineIndex;
    const nearby=state.nearest?.index;
    const visible=state.started&&(focused===photoresistIndex||focused==null&&nearby===photoresistIndex);
    launcher.hidden=!visible;
    launcher.textContent=status[photoresistIndex].state==='running'?'OPEN LIVE 3D STATION [M]':'OPEN 3D PROCESS MODULE [M]';
    if(!overlay.hidden)photoresistChamber.setRuntimeState(runtimeState())
  };
  const previousLoop=loop;
  loop=function(now){previousLoop(now);if(!overlay.hidden)photoresistChamber.setRuntimeState(runtimeState())};
}

function installTestLaunchHook(){
  const hook=new URLSearchParams(location.search).get('test');
  if(hook!=='oxidation-snap')return;
  state.username='TestOperator';
  if($('username'))$('username').value='TestOperator';
  if($('operator'))$('operator').textContent='TestOperator';
  state.started=true;
  if($('intro'))$('intro').style.display='none';
  if($('xrButton'))$('xrButton').style.display='block';
  newRun();
  state.runStart=performance.now();
  const oxidationIndex=stations.findIndex(station=>station.type==='deposition');
  if(oxidationIndex<0)return;
  const machine=machines[oxidationIndex+1],st=status[oxidationIndex];
  status[0].state='complete';
  setLamp(0);
  st.state='ready';
  st.doorTarget=1;
  st.doorAmount=1;
  phys.doorVelocities[oxidationIndex]=0;
  if(machine?.door)machine.door.rotation.y=-Math.PI/2;
  setLamp(oxidationIndex);
  const body=spawnStockWafer(true);
  if(body){
    body.nextStage=oxidationIndex;
    body.startedAt=state.runStart;
    body.staged=false;
    body.view.position.set(5.25,1.9,3);
    body.view.rotation.set(-Math.PI/2,0,0);
    syncActiveWafer(body);
  }
  player.position.set(4.2,2.58,3);
  yaw=-Math.PI/2;
  pitch=-.25;
  player.rotation.y=yaw;
  camera.rotation.order='YXZ';
  camera.rotation.x=pitch;
  if(machine?.wafer){
    const locator=machine.wafer.getWorldPosition(new THREE.Vector3());
    const sphere=new THREE.Mesh(
      new THREE.SphereGeometry(WAFER_SNAP_RADIUS,24,16),
      new THREE.MeshBasicMaterial({color:C.cyan,wireframe:true,transparent:true,opacity:.28,depthWrite:false})
    );
    sphere.position.copy(locator);
    sphere.visible=false;
    sphere.name='oxidation-snap-sphere-debug';
    scene.add(sphere);
  }
  updateAll();
  toast('Test hook active: Oxidation Furnace snap sphere ready. Click viewport and hold left mouse on wafer.');
  globalThis.__oxidationSnapTestHook={
    stationIndex:oxidationIndex,
    snapRadius:WAFER_SNAP_RADIUS,
    locatorWorld:()=>machine.wafer.getWorldPosition(new THREE.Vector3()),
    getWafer:()=>body,
    getState:()=>{
      const grab=getHandGrab(desktopGrip.controller)||[...parallel.grabs.values()][0]||null;
      const locator=machine.wafer.getWorldPosition(new THREE.Vector3());
      const waferPos=body?body.view.getWorldPosition(new THREE.Vector3()):null;
      return{
        snappedStation:grab?.snappedStation??null,
        waferPos:waferPos?waferPos.toArray():null,
        locatorPos:locator.toArray(),
        distanceToLocator:waferPos?waferPos.distanceTo(locator):null,
        stationState:st.state,
        seated:machine.body===body
      };
    }
  };
}

function installFeatureModules(){
  globalThis.CleanroomRealism?.init();
  globalThis.CleanroomLOD?.init();
  globalThis.CleanroomDebug?.init();
  globalThis.CleanroomPedagogy?.init();
  globalThis.CleanroomAudio?.init();
}

try{buildEnvironment();bind();setupLaunchMenu();installFeatureModules();updateBenchmark();updateActivityLeaderboard();stations.forEach((_,i)=>updateControlMeshes(i));installPhotoresistStation();installTestLaunchHook();renderer.setAnimationLoop(loop)}catch(err){console.error(err);document.body.innerHTML=`<div style="padding:40px;color:white;font-family:system-ui"><h1>Simulator could not initialise</h1><p>${err.message}</p><p>WebGL is required.</p></div>`}  

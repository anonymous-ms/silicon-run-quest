'use strict';
const photoresistIndex=stations.findIndex(station=>station.type==='spinner');
let photoresistReadout=null,photoresistChamber=null;
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
  photoresistChamber=PhotoresistChamber.mount({root,bridge:{
    getState:runtimeState,
    setFlow(percent){status[photoresistIndex].values.flow=clamp(.8+(percent-10)/90*2.2,.8,3);updateControlMeshes(photoresistIndex)},
    setRpm(value){status[photoresistIndex].values.rpm=clamp(1800+value/ .75,1800,4200);updateControlMeshes(photoresistIndex)},
    setDoor(open){const st=status[photoresistIndex];if(open!==(st.doorTarget>.5))toggleDoor(photoresistIndex)},
    onStart(){const st=status[photoresistIndex],machine=machines[photoresistIndex+1];if(st.state==='loaded'&&machine?.body&&st.doorAmount<=5/90)startProcess(photoresistIndex);return st.state==='running'},
    onStop(){if(status[photoresistIndex].state==='running'){if(photoresistReadout)status[photoresistIndex].metric=photoresistReadout.thicknessNm/1000;stopProcess(photoresistIndex)}},
    onReset(){const st=status[photoresistIndex];if(st.state!=='running')return;st.cycle=null;st.metric=0;st.state='loaded';state.cycle=runningCycles()[0]?.cycle||null;setLamp(photoresistIndex);updateAll()},
    onReadout(value){photoresistReadout=value;if(status[photoresistIndex].state==='running')status[photoresistIndex].metric=value.thicknessNm/1000}
  }});
  launcher.onclick=openStation;close.onclick=closeStation;
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeStation()});
  addEventListener('keydown',event=>{
    if(overlay.hidden)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeStation();return}
    event.stopImmediatePropagation()
  },true);
  addEventListener('keyup',event=>{if(!overlay.hidden)event.stopImmediatePropagation()},true);
  const previousMetric=calculateMetric;
  calculateMetric=function(i,t){return i===photoresistIndex&&photoresistReadout?photoresistReadout.thicknessNm/1000:previousMetric(i,t)};
  const previousMachineGui=updateMachineGui;
  updateMachineGui=function(){
    previousMachineGui();
    const focused=state.focus?.userData?.machineIndex;
    const nearby=state.nearest?.index;
    const visible=state.started&&(focused===photoresistIndex||focused==null&&nearby===photoresistIndex);
    launcher.hidden=!visible;
    launcher.textContent=status[photoresistIndex].state==='running'?'OPEN LIVE 3D STATION':'OPEN 3D PROCESS MODULE';
    if(!overlay.hidden)photoresistChamber.setRuntimeState(runtimeState())
  };
  const previousLoop=loop;
  loop=function(now){previousLoop(now);if(!overlay.hidden)photoresistChamber.setRuntimeState(runtimeState())};
}

try{buildEnvironment();bind();setupLaunchMenu();updateBenchmark();updateActivityLeaderboard();stations.forEach((_,i)=>updateControlMeshes(i));installPhotoresistStation();renderer.setAnimationLoop(loop)}catch(err){console.error(err);document.body.innerHTML=`<div style="padding:40px;color:white;font-family:system-ui"><h1>Simulator could not initialise</h1><p>${err.message}</p><p>WebGL is required.</p></div>`}  

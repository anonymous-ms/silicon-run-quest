'use strict';
// V6: parallel wafer population, concurrent machines, swept shard piles and XR sprint.      
const parallel={      
  wafers:[],      
  grabs:new Map(),      
  nextWaferId:1,      
  nextPileId:1,      
  stockRespawnAt:0,      
  stockDelayMs:650,      
  sprintHeld:false,      
  active:null      
};      
const handKey=c=>c?.userData?.handIndex??c?.userData?.hand??0;      
const getHandGrab=c=>parallel.grabs.get(handKey(c))||null;      
const setHandGrab=(c,grab)=>{const key=handKey(c);parallel.grabs.set(key,grab);phys.grab=grab};      
const clearHandGrab=c=>{const key=handKey(c),grab=parallel.grabs.get(key);parallel.grabs.delete(key);if(phys.grab===grab)phys.grab=null;return grab};      
const runningCycles=()=>status.map((st,i)=>st.cycle?{i,cycle:st.cycle}:null).filter(Boolean);      
const carriedWafers=()=>parallel.wafers.filter(w=>w.heldBy!=null&&!w.broken);      
function syncActiveWafer(body){      
  if(!body)return;      
  parallel.active=body;      
  state.handWafer=body.view;      
  state.current=Math.min(body.nextStage,stations.length-1);      
  state.records=body.records;      
  state.pattern=body.pattern;      
  state.lotId=body.lotId;      
  state.carrying=carriedWafers().length>0;      
  state.waferBroken=false;      
  state.completed=!!body.completed;      
  $('lotId').textContent=body.lotId      
}      
function createParallelWafer(position,quaternion,staged=true){      
  const view=createWafer(.72);      
  scene.add(view);      
  view.position.copy(position);      
  if(quaternion)view.quaternion.copy(quaternion);      
  view.scale.setScalar(1);      
  view.visible=true;      
  const body={      
    id:parallel.nextWaferId++,      
    lotId:'SR-'+String(Math.floor(1000+Math.random()*9000)),      
    view,      
    velocity:new THREE.Vector3(),      
    acceleration:new THREE.Vector3(),      
    angularVelocity:new THREE.Vector3(),      
    releaseY:position.y,      
    dynamic:false,      
    staged,      
    heldBy:null,      
    machineIndex:null,      
    broken:false,      
    nextStage:0,      
    records:[],      
    pattern:'Logic grid',      
    startedAt:0,      
    elapsed:0,      
    completed:false      
  };      
  view.userData.waferBody=body;      
  parallel.wafers.push(body);      
  if(!parallel.active)syncActiveWafer(body);      
  return body      
}      
function removeParallelWafer(body){      
  if(!body)return;      
  body.view.parent?.remove(body.view);      
  const index=parallel.wafers.indexOf(body);      
  if(index>=0)parallel.wafers.splice(index,1);      
  if(parallel.active===body){      
    parallel.active=parallel.wafers.find(w=>!w.broken)||null;      
    if(parallel.active)syncActiveWafer(parallel.active)      
  }      
}      
function stockWafer(){      
  return parallel.wafers.find(w=>w.staged&&!w.broken&&!w.heldBy&&w.machineIndex==null)      
}      
function scheduleStockReplacement(delay=parallel.stockDelayMs){      
  parallel.stockRespawnAt=Math.min(parallel.stockRespawnAt||Infinity,performance.now()+delay)      
}      
function spawnStockWafer(force=false){      
  if(stockWafer()||!stockMachine)return null;      
  if(!force&&stockMachine.robot&&stockMachine.robot.phase!=='offering')return null;      
  const body=createParallelWafer(stockSpawnWorld(),stockSpawnQuaternion(),true);      
  body.grabbable=true;      
  body.dynamic=false;      
  phys.stockReady=body.view;      
  phys.waferStaged=true;      
  parallel.stockRespawnAt=0;      
  if(!state.runStart)state.runStart=performance.now();      
  status.forEach((st,i)=>{if(st.state==='locked'){st.state='ready';setLamp(i)}});      
  toast('A fresh blank wafer is offered by the stock robot arm.');      
  return body      
}      
function nearestAvailableWafer(c,max=phys.pinchDistance){      
  const p=pinchWorld(c);      
  let best=null,d=max;      
  for(const body of parallel.wafers){      
    if(body.broken||body.grabbable===false||body.heldBy!=null||body.machineIndex!=null||!body.view.visible)continue;      
    const q=body.view.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);      
    if(n<=d){d=n;best={body,distance:n,point:q}}      
  }      
  return best      
}      
function nearestPinchTargetV6(anchor){      
  if(!anchor)return null;      
  const p=anchor.getWorldPosition(new THREE.Vector3());      
  let best=null,d=.34;      
  for(const body of parallel.wafers){      
    if(body.broken||body.heldBy!=null||body.machineIndex!=null||!body.view.visible)continue;      
    const q=body.view.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);      
    if(n<d){d=n;best={kind:'wafer',object:body.view,distance:n,point:q}}      
  }      
  for(const shard of waferShards){      
    const q=shard.mesh.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);      
    if(n<d){d=n;best={kind:'shard',object:shard.mesh,distance:n,point:q}}      
  }      
  if(state.focus){      
    const q=state.focus.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);      
    if(n<d){d=n;best={kind:state.focus.userData.type,object:state.focus,distance:n,point:q}}      
  }      
  return best      
}      
nearestPinchTarget=nearestPinchTargetV6;      
const v5BuildEnvironment=buildEnvironment;      
buildEnvironment=function(){      
  v5BuildEnvironment();      
  if(state.handWafer){      
    state.handWafer.parent?.remove(state.handWafer);      
    state.handWafer.visible=false      
  }      
  phys.stockReady=null;      
  phys.stockRespawnAt=0;      
  phys.pickupGuide=null      
};      
placeWaferAtStock=function(){      
  const body=spawnStockWafer();      
  if(body)syncActiveWafer(body);      
  ensureWaferPickupGuide()      
};      
updateStockSupply=function(now){      
  const dt=Math.min(.05,(now-(stockMachine?._lastSupplyAt||now))/1000||.016);      
  if(stockMachine)stockMachine._lastSupplyAt=now;      
  if(typeof updateStockRobot==='function')updateStockRobot(dt);      
  const ready=stockWafer();      
  if(!ready&&stockMachine?.robot?.phase==='offering')spawnStockWafer();      
  const activeReady=stockWafer();      
  phys.stockReady=activeReady?.view||null;      
  phys.waferStaged=!!activeReady;      
  if(stockMachine?.ring){      
    const pulse=.88+.14*Math.sin(now*.005);      
    stockMachine.ring.scale.setScalar(pulse);      
    stockMachine.ring.material.color.setHex(activeReady?C.green:C.cyan)      
  }      
};      
updateWaferPickupGuide=function(now){      
  const guide=ensureWaferPickupGuide(),body=stockWafer();      
  guide.visible=renderer.xr.isPresenting&&!!body&&!phys.waferEverPicked;      
  if(guide.visible){      
    const p=body.view.getWorldPosition(new THREE.Vector3());      
    guide.position.set(p.x,p.y+.025,p.z);      
    guide.rotation.y=now*.001;      
    guide.scale.setScalar(.95+.08*Math.sin(now*.006))      
  }      
};      
dispenseWafer=function(){      
  if(!state.started||stockWafer())return;      
  if(!state.runStart)state.runStart=performance.now();      
  status.forEach((st,i)=>{if(st.state==='locked'){st.state='ready';setLamp(i)}});      
  const body=spawnStockWafer();      
  if(body)syncActiveWafer(body);      
  toast('Unlimited wafer supply enabled. Pick up the blank with either trigger.');      
  updateAll()      
};      
const WAFER_SNAP_RADIUS=.22;
function machineAcceptanceAtPoint(body,point){
  if(!body||body.broken||!point)return null;
  let best=null,bestDistance=WAFER_SNAP_RADIUS;
  for(let i=0;i<stations.length;i++){
    const machine=machines[i+1],st=status[i];
    if(!machine||machine.kind!=='fabrication'||st.state!=='ready'||st.doorAmount<=.45||machine.body||!machine.wafer)continue;
    const target=machine.wafer.getWorldPosition(new THREE.Vector3());
    const distance=point.distanceTo(target);
    if(distance<=bestDistance){
      bestDistance=distance;
      best={i,machine,st,target,quaternion:machine.wafer.getWorldQuaternion(new THREE.Quaternion()),radius:WAFER_SNAP_RADIUS};
    }
  }
  if(typeof deliveryStation!=='undefined'&&deliveryStation?.locator&&!body.completed&&(body.nextStage>=stations.length||body.records?.some(Boolean))){
    const target=deliveryStation.locator.getWorldPosition(new THREE.Vector3());
    const distance=point.distanceTo(target);
    if(distance<=bestDistance){
      best={i:'delivery',isDelivery:true,target,quaternion:deliveryStation.locator.getWorldQuaternion(new THREE.Quaternion()),radius:WAFER_SNAP_RADIUS};
    }
  }
  return best
}
function updateHeldWaferGrab(grab,dt=0){
  if(!grab||grab.kind!=='wafer')return null;
  const body=grab.body,anchor=pinchAnchorFor(grab.controller);
  if(!body||!anchor)return null;
  anchor.updateMatrixWorld?.(true);
  const targetPoint=anchor.getWorldPosition(new THREE.Vector3());
  const targetQuat=anchor.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.08,0,0)));
  const snap=machineAcceptanceAtPoint(body,targetPoint);
  if(snap){
    body.view.position.copy(snap.target);
    body.view.quaternion.copy(snap.quaternion);
    grab.snappedStation=snap.i;
    grab.velocity.set(0,0,0);
    grab.last.copy(snap.target);
    return snap;
  }
  grab.snappedStation=null;
  if(dt>0){
    const alpha=1-Math.exp(-dt*26);
    body.view.position.lerp(targetPoint,alpha);
    body.view.quaternion.slerp(targetQuat,alpha);
    grab.velocity.copy(targetPoint).sub(grab.last).divideScalar(Math.max(dt,.001));
  }else{
    body.view.position.copy(targetPoint);
    body.view.quaternion.copy(targetQuat);
  }
  grab.last.copy(targetPoint);
  return null;
}
grabWafer=function(c){      
  if(getHandGrab(c))return false;      
  const near=nearestAvailableWafer(c);      
  if(!near)return false;      
  const body=near.body;      
  detachPreserve(body.view,scene);      
  body.view.scale.setScalar(1);      
  body.dynamic=false;      
  body.velocity?.set(0,0,0);      
  body.acceleration?.set(0,0,0);      
  body.angularVelocity?.set(0,0,0);      
  const wasStaged=!!body.staged;      
  body.staged=false;      
  body.heldBy=handKey(c);      
  if(phys.stockReady===body.view)phys.stockReady=null;      
  if(wasStaged&&stockMachine?.robot){stockMachine.robot.phase='animating';stockMachine.robot.t=0}      
  if(body.machineIndex!=null){      
    const i=body.machineIndex;      
    if(status[i].state==='done')status[i].state='unloadedDoorOpen'      
  }      
  const grab={kind:'wafer',controller:c,body,last:pinchWorld(c).clone(),velocity:new THREE.Vector3(),snappedStation:null};      
  setHandGrab(c,grab);      
  updateHeldWaferGrab(grab,0);      
  syncActiveWafer(body);      
  phys.waferEverPicked=true;      
  if(phys.pickupGuide)phys.pickupGuide.visible=false;      
  scheduleStockReplacement();      
  pulseXR(.6,65);      
  toast(`${c.userData.handedness||'Controller'} hand grabbed wafer ${body.lotId}.`);      
  return true      
};      
releaseWafer=function(c){      
  const grab=getHandGrab(c);      
  if(grab?.kind!=='wafer')return;      
  const body=grab.body;      
  detachPreserve(body.view,scene);      
  body.velocity.copy(grab.velocity);      
  body.releaseY=body.view.getWorldPosition(new THREE.Vector3()).y;      
  body.dynamic=true;      
  body.heldBy=null;      
  clearHandGrab(c);      
  state.carrying=carriedWafers().length>0;      
  tryPlaceWafer(body);      
  pulseXR(.25,28)      
};      
function machineAcceptance(body){      
  if(!body||body.broken||!body.view.visible)return null;      
  return machineAcceptanceAtPoint(body,body.view.getWorldPosition(new THREE.Vector3()))      
}      
tryPlaceWafer=function(body=parallel.active){      
  if(!body||body.broken||!body.view.visible)return false;      
  const accepted=machineAcceptance(body);      
  if(!accepted)return false;      
  if(accepted.isDelivery){      
    body.dynamic=false;      
    body.staged=false;      
    body.view.visible=false;      
    body.completed=true;      
    body.elapsed=performance.now()-(body.startedAt||state.runStart||performance.now());      
    state.awaitingDelivery=false;      
    if(deliveryStation?.wafer){deliveryStation.wafer.visible=true;syncActiveWafer(body);refreshWaferVisual(deliveryStation.wafer)}      
    pulseXR(.8,90);      
    finishLot(body);      
    return true      
  }      
  const {i,machine,st}=accepted;      
  body.dynamic=false;      
  body.machineIndex=i;      
  body.view.visible=false;      
  machine.body=body;      
  machine.wafer.visible=true;      
  refreshWaferVisual(machine.wafer);      
  st.state='loadedDoorOpen';      
  syncActiveWafer(body);      
  toast(`${body.lotId} seated in ${stations[i].name}.`);      
  pulseXR(.65,70);      
  updateAll();      
  return true      
};      
exposeCompletedWafer=function(){      
  status.forEach((st,i)=>{      
    const machine=machines[i+1],body=machine?.body;      
    if(st.state!=='done'||st.doorAmount<=.45||!body||body.heldBy!=null||body.broken)return;      
    if(!body.view.visible){      
      const wp=machine.wafer.getWorldPosition(new THREE.Vector3());      
      const wq=machine.wafer.getWorldQuaternion(new THREE.Quaternion());      
      machine.wafer.visible=false;      
      body.view.position.copy(wp);      
      body.view.quaternion.copy(wq);      
      body.view.visible=true;      
      body.dynamic=false      
    }      
  })      
};      
function arcShardGeometry(inner=.09,outer=.28,start=0,length=1){      
  const shape=new THREE.Shape(),steps=8;      
  for(let n=0;n<=steps;n++){      
    const a=start+length*n/steps,x=Math.cos(a)*outer,y=Math.sin(a)*outer;      
    if(n===0)shape.moveTo(x,y);else shape.lineTo(x,y)      
  }      
  for(let n=steps;n>=0;n--){      
    const a=start+length*n/steps;      
    shape.lineTo(Math.cos(a)*inner,Math.sin(a)*inner)      
  }      
  shape.closePath();      
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false,steps:1});      
  geometry.center();      
  return geometry      
}      
function crackedFragmentGeometry(radius=.08){      
  const shape=new THREE.Shape(),points=5+Math.floor(Math.random()*3);      
  for(let n=0;n<points;n++){      
    const a=n/points*Math.PI*2,r=radius*(.48+Math.random()*.52);      
    const x=Math.cos(a)*r,y=Math.sin(a)*r;      
    if(n===0)shape.moveTo(x,y);else shape.lineTo(x,y)      
  }      
  shape.closePath();      
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:false,steps:1});      
  geometry.center();      
  return geometry      
}      
shatterWafer=function(body,point,impact){      
  if(!body||body.broken)return;      
  body.broken=true;      
  body.dynamic=false;      
  body.heldBy=null;      
  body.view.visible=false;      
  if(body.machineIndex!=null){      
    const machine=machines[body.machineIndex+1];      
    if(machine?.body===body){machine.body=null;machine.wafer.visible=false;status[body.machineIndex].state='ready'}      
  }      
  const pileId=parallel.nextPileId++,count=18;      
  for(let i=0;i<count;i++){      
    const isArc=i<8;      
    const geometry=isArc      
      ?arcShardGeometry(.05+Math.random()*.07,.19+Math.random()*.1,Math.random()*Math.PI*2,.34+Math.random()*.72)      
      :crackedFragmentGeometry(.035+Math.random()*.065);      
    const shard=mesh(geometry,mat(isArc?0xb9ccd2:0x92a8b0,.72,.18),scene,point.x,Math.max(point.y,.05),point.z);      
    shard.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);      
    const v=new THREE.Vector3((Math.random()-.5)*impact,(Math.random()*.7+.15)*impact,(Math.random()-.5)*impact);      
    waferShards.push({mesh:shard,v,life:0,pileId})      
  }      
  removeParallelWafer(body);      
  scheduleStockReplacement(200);      
  toast('WAFER FRACTURE. Arc shards and cracked fragments can be swept with A near the pile.','bad');      
  pulseXR(1,160)      
};      
function nearestShardForHand(c,max=phys.pinchDistance){      
  const p=pinchWorld(c);let best=null,d=max;      
  for(const shard of waferShards){      
    const q=shard.mesh.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);      
    if(n<d){d=n;best=shard}      
  }      
  return best      
}      
grabShard=function(c){      
  if(getHandGrab(c))return false;      
  const shard=nearestShardForHand(c);      
  if(!shard)return false;      
  detachPreserve(shard.mesh,pinchAnchorFor(c));      
  shard.mesh.position.set(0,0,0);      
  shard.v.set(0,0,0);      
  setHandGrab(c,{kind:'shard',controller:c,shard,last:pinchWorld(c).clone(),velocity:new THREE.Vector3()});      
  pulseXR(.2,25);      
  return true      
};      
releaseShard=function(c){      
  const grab=getHandGrab(c);      
  if(grab?.kind!=='shard')return;      
  detachPreserve(grab.shard.mesh,scene);      
  grab.shard.v.copy(grab.velocity);      
  clearHandGrab(c)      
};      
function sweepNearestShardPile(c){      
  const p=pinchWorld(c);let nearest=null,d=.55;      
  for(const shard of waferShards){      
    const n=p.distanceTo(shard.mesh.getWorldPosition(new THREE.Vector3()));      
    if(n<d){d=n;nearest=shard}      
  }      
  if(!nearest)return false;      
  const pileId=nearest.pileId;      
  for(let i=waferShards.length-1;i>=0;i--){      
    const shard=waferShards[i];      
    if(shard.pileId!==pileId)continue;      
    for(const [key,grab] of parallel.grabs){      
      if(grab.kind==='shard'&&grab.shard===shard)parallel.grabs.delete(key)      
    }      
    shard.mesh.parent?.remove(shard.mesh);      
    waferShards.splice(i,1)      
  }      
  pulseXR(.75,90);      
  toast('Broken wafer pile swept and removed.');      
  return true      
}      
updateShards=function(dt){      
  for(let i=waferShards.length-1;i>=0;i--){      
    const shard=waferShards[i];      
    if([...parallel.grabs.values()].some(g=>g.kind==='shard'&&g.shard===shard))continue;      
    shard.v.y-=9.81*dt;      
    shard.mesh.position.addScaledVector(shard.v,dt);      
    shard.life+=dt;      
    if(shard.mesh.position.y<.03){      
      shard.mesh.position.y=.03;      
      shard.v.y=Math.abs(shard.v.y)*.2;      
      shard.v.x*=.75;shard.v.z*=.75      
    }      
    const bin=sharpsBins.find(b=>Math.abs(shard.mesh.position.x-b.x)<.24&&Math.abs(shard.mesh.position.z-b.z)<.24&&shard.mesh.position.y<.75);      
    if(bin){shard.mesh.parent?.remove(shard.mesh);waferShards.splice(i,1)}      
  }      
};      
const WAFER_COLLIDER_RADIUS=.34*.72,WAFER_HALF_THICK=.012,WAFER_SHATTER_SPEED=4.2,WAFER_RIM_INERTIA=.085;
const WAFER_COLLIDER_PTS=(()=>{
  const pts=[],flatY=-WAFER_COLLIDER_RADIUS*.87;
  for(const z of [-WAFER_HALF_THICK,WAFER_HALF_THICK]){
    pts.push(new THREE.Vector3(0,0,z));
    for(let k=0;k<16;k++){
      const a=k/16*Math.PI*2,lx=Math.cos(a)*WAFER_COLLIDER_RADIUS,ly=Math.max(flatY,Math.sin(a)*WAFER_COLLIDER_RADIUS);
      pts.push(new THREE.Vector3(lx,ly,z));
    }
  }
  return pts;
})();
const _wfTmpPt=new THREE.Vector3(),_wfNormal=new THREE.Vector3(),_wfUp=new THREE.Vector3(0,1,0),_wfDeltaQ=new THREE.Quaternion(),_wfAlignQ=new THREE.Quaternion(),_wfAxis=new THREE.Vector3();
function waferSupportSurfaces(){
  const list=[{minX:-8.9,maxX:8.9,minZ:-41.9,maxZ:11.9,topY:0,bottomY:-.25,kind:'floor'}];
  list.push({minX:-1.54,maxX:1.54,minZ:8.94,maxZ:11.06,topY:1.675,bottomY:0,kind:'table'});
  list.push({minX:-.47,maxX:.47,minZ:8.95,maxZ:9.89,topY:1.908,bottomY:1.675,kind:'pad'});
  if(Array.isArray(stations)){
    for(let i=0;i<stations.length;i++){
      const s=stations[i];if(!s)continue;
      const cx=(s.side||0)*6.65,cz=s.z;
      if(s.type==='design'){
        list.push({minX:-7.29,maxX:-5.91,minZ:cz-1.525,maxZ:cz+1.525,topY:1.245,bottomY:0,kind:'desk'});
      }else{
        list.push({minX:cx-1.06,maxX:cx+1.06,minZ:cz-1.54,maxZ:cz+1.54,topY:1.675,bottomY:0,kind:'worktop'});
      }
    }
  }
  if(typeof deliveryStation!=='undefined'&&deliveryStation){
    list.push({minX:-1.54,maxX:1.54,minZ:-41.125,maxZ:-39.275,topY:1.36,bottomY:0,kind:'delivery'});
  }
  if(Array.isArray(sharpsBins)){
    for(const b of sharpsBins){if(!b)continue;list.push({minX:b.x-.24,maxX:b.x+.24,minZ:b.z-.24,maxZ:b.z+.24,topY:.6,bottomY:0,kind:'bin'})}
  }
  return list;
}
function resolveWaferRigidStep(body,surfaces,h){
  const p=body.view.position,q=body.view.quaternion;
  if(!body.acceleration)body.acceleration=new THREE.Vector3();
  if(!body.angularVelocity)body.angularVelocity=new THREE.Vector3();
  body.acceleration.set(0,-9.81,0);
  body.velocity.addScaledVector(body.acceleration,h);
  p.addScaledVector(body.velocity,h);
  const angSpd=body.angularVelocity.length();
  if(angSpd>1e-5){
    _wfAxis.copy(body.angularVelocity).divideScalar(angSpd);
    _wfDeltaQ.setFromAxisAngle(_wfAxis,angSpd*h);
    q.premultiply(_wfDeltaQ).normalize();
  }
  // Room wall collisions & graceful slide/rebound (only shatter on high-speed slam)
  for(const lp of WAFER_COLLIDER_PTS){
    _wfTmpPt.copy(lp).applyQuaternion(q).add(p);
    if(_wfTmpPt.x>8.85){p.x-=(_wfTmpPt.x-8.85);if(body.velocity.x>WAFER_SHATTER_SPEED)return'shatter';if(body.velocity.x>0)body.velocity.x=-body.velocity.x*.22;body.angularVelocity.z+=(_wfTmpPt.y-p.y)*1.6}
    else if(_wfTmpPt.x<-8.85){p.x+=(-8.85-_wfTmpPt.x);if(-body.velocity.x>WAFER_SHATTER_SPEED)return'shatter';if(body.velocity.x<0)body.velocity.x=-body.velocity.x*.22;body.angularVelocity.z-=(_wfTmpPt.y-p.y)*1.6}
    if(_wfTmpPt.z>11.85){p.z-=(_wfTmpPt.z-11.85);if(body.velocity.z>WAFER_SHATTER_SPEED)return'shatter';if(body.velocity.z>0)body.velocity.z=-body.velocity.z*.22;body.angularVelocity.x-=(_wfTmpPt.y-p.y)*1.6}
    else if(_wfTmpPt.z<-41.85){p.z+=(-41.85-_wfTmpPt.z);if(-body.velocity.z>WAFER_SHATTER_SPEED)return'shatter';if(body.velocity.z<0)body.velocity.z=-body.velocity.z*.22;body.angularVelocity.x+=(_wfTmpPt.y-p.y)*1.6}
  }
  // Lateral collider obstacle resolution for solid cabinets (skip playerOnly colliders)
  if(Array.isArray(colliders)){
    for(const collider of colliders){
      if(collider&&!collider.playerOnly&&p.y<1.58){
        const dx=p.x-collider.x,dz=p.z-collider.z,hx=collider.w*.5+WAFER_COLLIDER_RADIUS*.75,hz=collider.d*.5+WAFER_COLLIDER_RADIUS*.75;
        if(Math.abs(dx)<hx&&Math.abs(dz)<hz){
          if(body.velocity.length()>WAFER_SHATTER_SPEED)return'shatter';
          const ox=hx-Math.abs(dx),oz=hz-Math.abs(dz);
          if(ox<oz){p.x+=(dx>=0?ox:-ox);body.velocity.x=(dx>=0?1:-1)*Math.abs(body.velocity.x)*.2}
          else{p.z+=(dz>=0?oz:-oz);body.velocity.z=(dz>=0?1:-1)*Math.abs(body.velocity.z)*.2}
        }
      }
    }
  }
  // Include other visible, unmounted wafers as circular support surfaces so wafers can stack and tip over each other
  for(const other of parallel.wafers){
    if(!other||other===body||other.broken||!other.view?.visible||other.machineIndex!=null)continue;
    const op=other.view.position;
    if(p.y<op.y+WAFER_HALF_THICK*1.1)continue;
    const dx=p.x-op.x,dz=p.z-op.z;
    if(dx*dx+dz*dz>4*WAFER_COLLIDER_RADIUS*WAFER_COLLIDER_RADIUS)continue;
    surfaces.push({minX:op.x-WAFER_COLLIDER_RADIUS,maxX:op.x+WAFER_COLLIDER_RADIUS,minZ:op.z-WAFER_COLLIDER_RADIUS,maxZ:op.z+WAFER_COLLIDER_RADIUS,topY:op.y+WAFER_HALF_THICK,bottomY:op.y-WAFER_HALF_THICK,cx:op.x,cz:op.z,rSq:WAFER_COLLIDER_RADIUS*WAFER_COLLIDER_RADIUS,kind:'wafer'});
  }
  // Find highest supporting horizontal surface under or touching the wafer mesh collider
  let bestSurface=null,bestPen=0,cx=0,cy=0,cz=0,wSum=0,touchCount=0;
  for(const s of surfaces){
    if(p.y<s.topY-.14)continue;
    if(p.x+WAFER_COLLIDER_RADIUS<s.minX||p.x-WAFER_COLLIDER_RADIUS>s.maxX||p.z+WAFER_COLLIDER_RADIUS<s.minZ||p.z-WAFER_COLLIDER_RADIUS>s.maxZ)continue;
    let sMaxPen=-Infinity,sCx=0,sCy=0,sCz=0,sWSum=0,sCount=0;
    for(const lp of WAFER_COLLIDER_PTS){
      _wfTmpPt.copy(lp).applyQuaternion(q).add(p);
      if(_wfTmpPt.x<s.minX||_wfTmpPt.x>s.maxX||_wfTmpPt.z<s.minZ||_wfTmpPt.z>s.maxZ)continue;
      if(s.rSq!=null){const rx=_wfTmpPt.x-s.cx,rz=_wfTmpPt.z-s.cz;if(rx*rx+rz*rz>s.rSq)continue}
      const pen=s.topY-_wfTmpPt.y;
      if(pen>=0){
        if(pen>sMaxPen)sMaxPen=pen;
        const w=pen+.0015;
        sCx+=_wfTmpPt.x*w;sCy+=_wfTmpPt.y*w;sCz+=_wfTmpPt.z*w;sWSum+=w;sCount++;
      }
    }
    if(sCount>0&&(!bestSurface||s.topY>bestSurface.topY)){
      bestSurface=s;bestPen=sMaxPen;cx=sCx/sWSum;cy=sCy/sWSum;cz=sCz/sWSum;wSum=sWSum;touchCount=sCount;
    }
  }
  if(bestSurface){
    const impactDown=-body.velocity.y;
    p.y+=bestPen;cy+=bestPen;
    if(impactDown>WAFER_SHATTER_SPEED)return'shatter';
    if(body.velocity.y<0)body.velocity.y=impactDown>.45?impactDown*.14:0;
    const dampXZ=Math.exp(-8.5*h);
    body.velocity.x*=dampXZ;body.velocity.z*=dampXZ;
    // Weight at CoG creates torque tau = r x W about the mesh-surface contact point
    const rx=p.x-cx,rz=p.z-cz,leverXZ=Math.hypot(rx,rz);
    _wfNormal.set(0,0,1).applyQuaternion(q).normalize();
    if(_wfNormal.y<0)_wfNormal.negate();
    const flatError=Math.hypot(_wfNormal.x,_wfNormal.z);
    if(leverXZ>.014&&flatError>.025){
      const tauX=rz*9.81/WAFER_RIM_INERTIA,tauZ=-rx*9.81/WAFER_RIM_INERTIA;
      body.angularVelocity.x=(body.angularVelocity.x+tauX*h)*Math.exp(-5.4*h);
      body.angularVelocity.z=(body.angularVelocity.z+tauZ*h)*Math.exp(-5.4*h);
      body.angularVelocity.y*=Math.exp(-9*h);
    }else{
      // Broad contact / near-flat settling: align local wafer normal gently onto surface normal
      _wfAlignQ.setFromUnitVectors(_wfNormal,_wfUp);
      const flatQ=_wfAlignQ.clone().multiply(q);
      q.slerp(flatQ,1-Math.exp(-16*h)).normalize();
      body.angularVelocity.multiplyScalar(Math.exp(-14*h));
      if(flatError<.02){p.y=bestSurface.topY+WAFER_HALF_THICK;body.velocity.y=0;body.angularVelocity.set(0,0,0)}
    }
  }
  return'ok';
}
function resolveWaferPairCollisions(){
  const list=parallel.wafers,minDist=WAFER_COLLIDER_RADIUS*2;
  for(let i=0;i<list.length;i++){
    const a=list[i];
    if(!a||a.broken||!a.view?.visible||a.machineIndex!=null)continue;
    const aFree=a.dynamic&&a.heldBy==null;
    for(let j=i+1;j<list.length;j++){
      const b=list[j];
      if(!b||b.broken||!b.view?.visible||b.machineIndex!=null)continue;
      const bFree=b.dynamic&&b.heldBy==null;
      if(!aFree&&!bFree)continue;
      const pa=a.view.position,pb=b.view.position;
      const dy=pb.y-pa.y;
      // Stacked vertically rather than colliding side-by-side
      if(Math.abs(dy)>=WAFER_HALF_THICK*1.45)continue;
      let dx=pb.x-pa.x,dz=pb.z-pa.z,hd=Math.hypot(dx,dz);
      if(hd>=minDist)continue;
      if(hd<1e-5){dx=1;dz=0;hd=1}
      const nx=dx/hd,nz=dz/hd,overlap=minDist-hd;
      if(aFree&&bFree){pa.x-=nx*overlap*.5;pa.z-=nz*overlap*.5;pb.x+=nx*overlap*.5;pb.z+=nz*overlap*.5}
      else if(aFree){pa.x-=nx*overlap;pa.z-=nz*overlap}
      else{pb.x+=nx*overlap;pb.z+=nz*overlap}
      const va=a.velocity,vb=b.velocity,vRelN=(vb.x-va.x)*nx+(vb.z-va.z)*nz;
      if(vRelN<0){
        if(-vRelN>WAFER_SHATTER_SPEED){
          if(aFree)shatterWafer(a,pa.clone(),Math.abs(vRelN));
          if(bFree)shatterWafer(b,pb.clone(),Math.abs(vRelN));
          continue;
        }
        const jImp=-(1.35)*vRelN*(aFree&&bFree?.5:1);
        if(aFree){va.x-=nx*jImp;va.z-=nz*jImp;if(a.angularVelocity)a.angularVelocity.y+=(Math.random()-.5)*1.2}
        if(bFree){vb.x+=nx*jImp;vb.z+=nz*jImp;if(b.angularVelocity)b.angularVelocity.y+=(Math.random()-.5)*1.2}
      }
    }
  }
}
updateWaferPhysics=function(dt){      
  const safeDt=Math.min(Math.max(dt||0,0),.05);
  if(safeDt<=0)return;
  const substeps=safeDt>.016?2:1,h=safeDt/substeps,baseSurfaces=waferSupportSurfaces();
  for(let s=0;s<substeps;s++){
    for(const body of [...parallel.wafers]){      
      if(!body.dynamic||body.broken||!body.view.visible||body.heldBy!=null||body.machineIndex!=null)continue;      
      if(resolveWaferRigidStep(body,[...baseSurfaces],h)==='shatter'){
        shatterWafer(body,body.view.position.clone(),Math.max(1.8,body.velocity.length()));
      }
    }
    resolveWaferPairCollisions();
  }
  for(const body of [...parallel.wafers]){
    if(body.dynamic&&!body.broken&&body.view.visible&&body.heldBy==null&&body.machineIndex==null)tryPlaceWafer(body);
  }
};      
beginControlGrab=function(c,d){      
  if(getHandGrab(c))return;      
  const machine=machines[d.machineIndex+1],ref=machine.controls[stations[d.machineIndex].controls.findIndex(x=>x.key===d.controlKey)],wp=pinchWorld(c);      
  setHandGrab(c,{kind:'control',controller:c,data:d,ref,start:wp.clone(),last:wp.clone()});      
  pulseXR(.35,35)      
};      
updateControlGrab=function(){      
  for(const grab of parallel.grabs.values()){      
    if(grab.kind!=='control')continue;      
    const i=grab.data.machineIndex,spec=stations[i].controls.find(x=>x.key===grab.data.controlKey),machine=machines[i+1],p=pinchWorld(grab.controller),local=machine.group.worldToLocal(p.clone()),ref=grab.ref;      
    if(spec.style==='slider'){      
      const motion=local.y-machine.group.worldToLocal(grab.last.clone()).y;      
      if(Math.abs(motion)>.008)adjustControl(grab.data,Math.sign(motion))      
    }else{      
      const center=(ref.rotor||ref.mesh).getWorldPosition(new THREE.Vector3()),a=Math.atan2(p.y-center.y,p.x-center.x),b=Math.atan2(grab.last.y-center.y,grab.last.x-center.x),delta=a-b;      
      if(Math.abs(delta)>.035)adjustControl(grab.data,Math.sign(delta))      
    }      
    grab.last.copy(p)      
  }      
};      
onXRTriggerStart=function(c){      
  if(state.paused||getHandGrab(c))return;      
  if(grabWafer(c))return;      
  if(grabShard(c))return;      
  const near=nearestInteractiveAtPinch(c),data=near?.data;      
  if(data?.type==='control'){state.focus=near.object;beginControlGrab(c,data);return}      
  if(data?.type==='button'){state.focus=near.object;activateFocused();pulseXR(.45,45);return}      
  pulseXR(.08,18)      
};      
onXRTriggerEnd=function(c){      
  const grab=getHandGrab(c);      
  if(grab?.kind==='wafer')releaseWafer(c);      
  else if(grab?.kind==='shard')releaseShard(c);      
  else if(grab?.kind==='control')clearHandGrab(c)      
};      
onXRSqueezeStart=function(c){      
  if(state.paused)return;      
  if(c.userData.handedness==='left'){phys.crouchHeld=true;pulseXR(.16,20)}      
  else{parallel.sprintHeld=true;beginDoorGrab(c)}      
};      
onXRSqueezeEnd=function(c){      
  if(c.userData.handedness==='left')phys.crouchHeld=false;      
  else parallel.sprintHeld=false;      
  if(phys.doorGrab?.controller===c){      
    const i=phys.doorGrab.i,st=status[i];      
    phys.doorGrab=null;      
    if(st.doorAmount<5/90){st.doorAmount=0;phys.doorVelocities[i]=0;pulseXR(.75,70)}      
  }      
};      
updateXRMovement=function(dt,now){      
  const session=renderer.xr.getSession();if(!session)return;      
  updateXRVertical(dt);      
  const sources=[...session.inputSources];let left=null,right=null;      
  for(const src of sources){if(src.handedness==='left')left=src;if(src.handedness==='right')right=src}      
  xrLeftSource=left||xrLeftSource;xrRightSource=right||xrRightSource;      
  const lg=left?.gamepad,rg=right?.gamepad,sprint=parallel.sprintHeld||!!rg?.buttons?.[1]?.pressed,speed=sprint?4.9:2.45;      
  if(lg&&lg.axes.length>=4){      
    let sx=lg.axes[2]||0,sy=lg.axes[3]||0;      
    if(Math.abs(sx)<.15)sx=0;if(Math.abs(sy)<.15)sy=0;      
    camera.getWorldDirection(xrHeadDirection);xrHeadDirection.y=0;      
    if(xrHeadDirection.lengthSq()<.001)xrHeadDirection.set(0,0,-1);      
    xrHeadDirection.normalize();      
    const side=new THREE.Vector3().crossVectors(xrHeadDirection,new THREE.Vector3(0,1,0)).normalize();      
    let nx=clamp(player.position.x+(side.x*sx+xrHeadDirection.x*-sy)*speed*dt,-8.25,8.25),nz=clamp(player.position.z+(side.z*sx+xrHeadDirection.z*-sy)*speed*dt,-40.5,11.2);      
    for(const collider of colliders){if(Math.abs(nx-collider.x)<collider.w/2+.34&&Math.abs(nz-collider.z)<collider.d/2+.34){nx=player.position.x;nz=player.position.z;break}}      
    player.position.x=nx;player.position.z=nz      
  }      
  if(rg&&rg.axes.length>=4){      
    const ax=rg.axes[2]||0,ay=rg.axes[3]||0;      
    if(Math.abs(ay)>.7&&state.focus?.userData.type==='control'&&now-xrAdjustAt>180){adjustControl(state.focus.userData,ay<0?1:-1);pulseXR(.18,22);xrAdjustAt=now}      
    if(Math.abs(ax)>.75&&!xrTurnLatch){player.rotation.y-=Math.sign(ax)*Math.PI/6;pulseXR(.22,28);xrTurnLatch=true}else if(Math.abs(ax)<.3)xrTurnLatch=false      
  }      
  updateXRSpatial(now)      
};      
updatePhysicalSystem=function(dt,now){      
  if(!renderer.xr.isPresenting)return;      
  exposeCompletedWafer();      
  for(const grab of parallel.grabs.values()){      
    if(grab.kind==='wafer'){updateHeldWaferGrab(grab,dt);continue}      
    if(grab.kind!=='shard')continue;      
    const p=pinchWorld(grab.controller);      
    grab.velocity.copy(p).sub(grab.last).divideScalar(Math.max(dt,.001));      
    grab.last.copy(p)      
  }      
  updateGhostHandPose(phys.handData[0],xrController0.userData.handedness==='right'?xrRightSource:xrLeftSource,dt);      
  updateGhostHandPose(phys.handData[1],xrController1.userData.handedness==='left'?xrLeftSource:xrRightSource,dt);      
  updateWaferPickupGuide(now);      
  updateStockSupply(now);      
  updateControlGrab();      
  updateDoorGrab(dt);      
  updateWaferPhysics(dt);      
  updateShards(dt)      
};      
buttonHint=function(d){      
  if(d.kind==='stock')return stockWafer()?'Pickup pad already occupied':'Dispense another blank wafer';      
  const locked=typeof isDoorLocked==='function'?isDoorLocked(d.machineIndex):status[d.machineIndex]?.state==='running';      
  if(d.action==='door')return locked?'Door is locked while the machine is running — press STOP first':'Pull or click the 3D door handle to open or close this machine';      
  const st=status[d.machineIndex],machine=machines[d.machineIndex+1];      
  if(d.action==='chamber')return st.doorAmount>.92?(machine.body?'Remove or inspect the machine wafer':'Insert the wafer for this process stage'):'Open the door first';      
  if(d.action==='start')return'Requires a loaded wafer and fully closed door';      
  if(d.action==='stop')return'Requires this machine to be running with its door closed';      
  return''      
};      
buttonEnabled=function(d){      
  if(d.kind==='stock')return state.started&&!stockWafer();      
  if(d.kind!=='machine')return true;      
  const i=d.machineIndex,st=status[i],machine=machines[i+1],body=machine?.body;      
  if(d.action==='door')return !(typeof isDoorLocked==='function'?isDoorLocked(i):st?.state==='running');      
  if(d.action==='chamber')return st.doorAmount>.92&&((st.state==='ready'&&!body&&carriedWafers().length>0)||(st.state==='done'&&!!body));      
  if(d.action==='start')return machine?.kind==='fabrication'&&st.state==='loaded'&&!!body&&!!machine.wafer?.visible&&st.doorAmount<=5/90;      
  if(d.action==='stop')return st.state==='running'&&st.doorAmount<.02&&!!st.cycle&&performance.now()-st.cycle.start>400;      
  return false      
};      
adjustControl=function(d,dir){      
  const i=d.machineIndex,st=status[i],station=stations[i];      
  if(!['ready','loadedDoorOpen','loaded'].includes(st.state)){toast('Recipe controls are locked while this machine is running.','warn');return}      
  const control=station.controls.find(x=>x.key===d.controlKey);      
  if(control.kind==='choice'){      
    let n=control.options.indexOf(st.values[control.key]);      
    n=(n+dir+control.options.length)%control.options.length;      
    st.values[control.key]=control.options[n]      
  }else st.values[control.key]=clamp(Number((st.values[control.key]+dir*control.step).toFixed(8)),control.min,control.max);      
  updateControlMeshes(i);updateMachineGui()      
};      
loadWafer=function(i){      
  const held=carriedWafers(),body=held.find(w=>w===parallel.active)||held[0];      
  if(!body)return;      
  const grab=[...parallel.grabs.values()].find(g=>g.kind==='wafer'&&g.body===body);      
  if(grab)clearHandGrab(grab.controller);      
  body.heldBy=null;      
  detachPreserve(body.view,scene);      
  const machine=machines[i+1],target=machine.wafer.getWorldPosition(new THREE.Vector3());      
  body.view.position.copy(target);      
  body.view.visible=true;      
  tryPlaceWafer(body)      
};      
unloadWafer=function(i){exposeCompletedWafer();toast('Completed wafer exposed for direct pickup.')};      
startProcess=function(i){      
  const st=status[i],station=stations[i],machine=machines[i+1],body=machine?.body;      
  if(!machine||machine.kind!=='fabrication'||!body||!machine.wafer?.visible||st.state!=='loaded'||st.doorAmount>5/90||st.cycle){      
    toast('Load a wafer and close the door before starting '+(station?.name||'this station')+'.','warn');      
    return false      
  }      
  syncActiveWafer(body);      
  st.state='running';st.metric=0;      
  st.cycle={i,start:performance.now(),processSeconds:0,timeScale:clamp(station.targetSeconds/8,3,25)};      
  state.cycle=st.cycle;      
  setLamp(i);      
  $('cycleBar').style.opacity='1';      
  toast(`${station.name} started while other machines remain interactive.`);      
  updateAll();      
  return true      
};      
stopProcess=function(i){      
  const st=status[i],station=stations[i],body=machines[i+1].body;      
  if(!st.cycle||!body)return;      
  syncActiveWafer(body);      
  const activityTime=performance.now()-st.cycle.start;
  const result=scoreProcess(i);      
  st.score=result.score;st.deviations=result.deviations;st.state='done';      
  body.records[i]={score:result.score,metric:st.metric,ratio:st.metric/station.metric.target,values:{...st.values},deviations:result.deviations,processSeconds:st.cycle.processSeconds,elapsedMs:activityTime};  
  recordActivity(station.short,activityTime,result.score,body.lotId);
  if(i===0)body.pattern=st.values.pattern;      
  st.cycle=null;      
  state.cycle=runningCycles()[0]?.cycle||null;      
  state.records=body.records;state.pattern=body.pattern;      
  setLamp(i);refreshWaferVisual(machines[i+1].wafer);      
  toast(`${station.short}: ${result.score.toFixed(0)}% recorded for ${body.lotId}. Open the door and collect it.`,result.score>=80?'':result.score>=60?'warn':'bad');      
  updateAll()      
};      
updateCycle=function(now){      
  const active=[];      
  status.forEach((st,i)=>{      
    if(!st.cycle)return;      
    const station=stations[i],cycle=st.cycle;      
    cycle.processSeconds=(now-cycle.start)/1000*cycle.timeScale;      
    st.metric=calculateMetric(i,cycle.processSeconds);      
    const m=machines[i+1];if(m?.wafer)refreshWaferVisual(m.wafer,i,st.metric/station.metric.target,st.values);      
    active.push({i,cycle,station,st})      
  });      
  state.cycle=active[0]?.cycle||null;      
  if(!active.length){$('cycleBar').style.opacity='0';return}      
  const focusedIndex=state.focus?.userData?.machineIndex;      
  const shown=active.find(x=>x.i===focusedIndex)||active[0],ratio=shown.st.metric/shown.station.metric.target;      
  $('cycleBar').style.opacity='1';      
  $('cycleName').textContent=active.length>1?`${active.length} MACHINES ACTIVE · ${shown.station.name.toUpperCase()}`:shown.station.name.toUpperCase();      
  $('cycleTime').textContent=`${shown.cycle.processSeconds.toFixed(1)} process s · ${formatMetric(shown.st.metric,shown.station.metric)} ${shown.station.metric.unit}`;      
  $('cycleFill').style.width=clamp(ratio*100,0,100)+'%';      
  updateMachineGui()      
};      
completeStage=function(i){      
  const st=status[i],machine=machines[i+1],body=machine.body;      
  if(!body)return;      
  machine.body=null;      
  body.machineIndex=null;      
  body.nextStage=i+1;      
  st.state='ready';st.metric=0;st.score=null;st.deviations=[];st.cycle=null;      
  st.values=Object.fromEntries(stations[i].controls.map(c=>[c.key,c.initial]));      
  setLamp(i);      
  syncActiveWafer(body);      
  if(body.nextStage>=stations.length){      
    body.readyForDelivery=true;      
    state.awaitingDelivery=true;      
    toast(`${body.lotId} final stage complete! Place the wafer onto the Final Delivery Bench at the far end of the cleanroom.`);      
  }else toast(`${body.lotId} released for ${stations[body.nextStage].name}.`);      
  updateAll()      
};      
finishLot=function(body=parallel.active){      
  if(!body)return;      
  syncActiveWafer(body);      
  state.completed=true;      
  state.awaitingDelivery=false;      
  state.elapsed=body.elapsed||performance.now()-(body.startedAt||state.runStart);      
  const q=quality(),before=benchmarks(),runs=getRuns();      
  runs.push({user:state.username,time:Math.round(state.elapsed),quality:Math.round(q),pattern:body.pattern,date:new Date().toISOString(),processes:body.records});      
  localStorage.setItem('waferFabRunsV2',JSON.stringify(runs.slice(-100)));      
  updateBenchmark();showReport(before);updateAll()      
};      
const v5ActivateFocused=activateFocused;      
activateFocused=function(){      
  const object=state.focus,data=object?.userData;      
  if(data?.kind==='machine'&&data.machineIndex!=null){      
    const body=machines[data.machineIndex+1]?.body;      
    if(body)syncActiveWafer(body)      
  }      
  v5ActivateFocused()      
};      
updateXRButtons=function(now){      
  if(!renderer.xr.isPresenting)return;      
  const l=xrLeftSource?.gamepad,r=xrRightSource?.gamepad;      
  if(l){      
    edgeButton('ls',!!l.buttons[3]?.pressed,()=>{phys.hudVisible=!phys.hudVisible;pulseXR(.3,35)});      
    edgeButton('lx',!!l.buttons[4]?.pressed,()=>requestJump());      
    edgeButton('ly',!!l.buttons[5]?.pressed,()=>{phys.beaconVisible=!phys.beaconVisible;phys.hudVisible=true;if(xrObjectiveBeacon)xrObjectiveBeacon.visible=phys.beaconVisible;drawXRHandset(performance.now())})
  }      
  if(r){      
    edgeButton('rs',!!r.buttons[3]?.pressed,()=>{if(state.completed){hideXROverlay()}else{state.paused=!state.paused;state.paused?showXROverlay('pause'):hideXROverlay()}pulseXR(.4,45)});      
    edgeButton('ra',!!r.buttons[4]?.pressed,()=>{if(state.paused){state.paused=false;hideXROverlay()}else if(!sweepNearestShardPile(xrController1)&&state.focus?.userData.type==='button')activateFocused()});      
    edgeButton('rb',!!r.buttons[5]?.pressed,()=>{state.paused=!state.paused;state.paused?showXROverlay('pause'):hideXROverlay()})      
  }      
};      
const v5NewRun=newRun;      
newRun=function(){      
  for(const body of [...parallel.wafers])removeParallelWafer(body);      
  for(const shard of [...waferShards])shard.mesh.parent?.remove(shard.mesh);      
  waferShards.length=0;parallel.grabs.clear();parallel.active=null;parallel.stockRespawnAt=0;parallel.sprintHeld=false;      
  machines.slice(1).forEach(machine=>{machine.body=null;machine.wafer.visible=false});      
  v5NewRun();      
  status.forEach((st,i)=>{st.state='ready';st.cycle=null;setLamp(i)});      
  state.completed=false;state.cycle=null;state.runStart=0;state.carrying=false;state.waferBroken=false;      
  toast('Parallel cleanroom ready. Dispense wafers without a population limit.');      
  updateAll()      
};  


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
const WAFER_RADIUS=.34*.72;      
const WAFER_HALF_THICKNESS=.045*.72;      
const WAFER_SNAP_RADIUS=WAFER_RADIUS/3;      
let waferCollisionMeshes=null;      
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
function spawnStockWafer(){      
  if(stockWafer()||!stockMachine)return null;      
  const body=createParallelWafer(stockSpawnWorld(),stockSpawnQuaternion(),true);      
  phys.stockReady=body.view;      
  phys.waferStaged=true;      
  parallel.stockRespawnAt=0;      
  toast('A fresh blank wafer is available on the pickup pad.');      
  return body      
}      
function waferReadyForPickup(body){      
  if(body.machineIndex==null)return true;      
  const st=status[body.machineIndex];      
  return !!st&&['done','unloadedDoorOpen'].includes(st.state)&&st.doorAmount>.45      
}      
function nearestAvailableWafer(c,max=phys.pinchDistance){      
  const p=pinchWorld(c);      
  let best=null,d=max;      
  for(const body of parallel.wafers){      
    if(body.broken||body.heldBy!=null||!waferReadyForPickup(body)||!body.view.visible)continue;      
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
    if(body.broken||body.heldBy!=null||!waferReadyForPickup(body)||!body.view.visible)continue;      
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
  waferCollisionMeshes=null;      
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
  if(parallel.stockRespawnAt&&now>=parallel.stockRespawnAt&&!stockWafer())spawnStockWafer();      
  const ready=stockWafer();      
  phys.stockReady=ready?.view||null;      
  phys.waferStaged=!!ready;      
  if(stockMachine?.ring){      
    const pulse=.88+.14*Math.sin(now*.005);      
    stockMachine.ring.scale.setScalar(pulse);      
    stockMachine.ring.material.color.setHex(ready?C.green:C.cyan)      
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
grabWafer=function(c){      
  if(getHandGrab(c))return false;      
  const near=nearestAvailableWafer(c);      
  if(!near)return false;      
  const body=near.body,anchor=pinchAnchorFor(c),sourceMachineIndex=body.machineIndex;      
  detachPreserve(body.view,scene);      
  const target=pinchWorld(c);      
  body.view.position.copy(target);      
  body.view.scale.setScalar(1);      
  body.dynamic=false;      
  body.staged=false;      
  body.heldBy=handKey(c);      
  if(phys.stockReady===body.view)phys.stockReady=null;      
  if(sourceMachineIndex!=null){      
    const machine=machines[sourceMachineIndex+1];      
    if(status[sourceMachineIndex].state==='done')status[sourceMachineIndex].state='unloadedDoorOpen';      
    if(machine?.body===body){machine.body=null;machine.wafer.visible=false}      
    body.machineIndex=null      
  }      
  const grab={kind:'wafer',controller:c,body,last:target.clone(),velocity:new THREE.Vector3(),slotMachineIndex:sourceMachineIndex};      
  setHandGrab(c,grab);      
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
function availableMachineSlot(body){      
  const i=body.nextStage;      
  if(i<0||i>=stations.length)return null;      
  const machine=machines[i+1],st=status[i];      
  if(!machine||st.state!=='ready'||st.doorAmount<=.45||machine.body)return null;      
  const target=machine.wafer.getWorldPosition(new THREE.Vector3());      
  return{i,machine,st,target}      
}      
function machineAcceptance(body){      
  const slot=availableMachineSlot(body);      
  if(!slot)return null;      
  const point=body.view.getWorldPosition(new THREE.Vector3());      
  return point.distanceTo(slot.target)<WAFER_SNAP_RADIUS?slot:null      
}      
tryPlaceWafer=function(body=parallel.active){      
  if(!body||body.broken||!body.view.visible)return false;      
  const accepted=machineAcceptance(body);      
  if(!accepted)return false;      
  const {i,machine,st}=accepted;      
  body.dynamic=false;      
  body.machineIndex=i;      
  body.view.position.copy(accepted.target);      
  body.view.quaternion.copy(machine.wafer.getWorldQuaternion(new THREE.Quaternion()));      
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
shatterWafer=function(body,point,impact,direction){      
  if(!body||body.broken)return;      
  const center=body.view.getWorldPosition(new THREE.Vector3()),orientation=body.view.getWorldQuaternion(new THREE.Quaternion());      
  const hitDirection=(direction||body.velocity).clone();      
  if(hitDirection.lengthSq()<1e-6)hitDirection.set(0,1,0);else hitDirection.normalize();      
  body.broken=true;      
  body.dynamic=false;      
  body.heldBy=null;      
  for(const [key,grab]of parallel.grabs){if(grab.kind==='wafer'&&grab.body===body){parallel.grabs.delete(key);if(phys.grab===grab)phys.grab=null}}      
  state.carrying=carriedWafers().length>0;      
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
    const angle=Math.random()*Math.PI*2,radius=Math.sqrt(Math.random())*WAFER_RADIUS*.9;      
    const offset=new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,(Math.random()-.5)*WAFER_HALF_THICKNESS).applyQuaternion(orientation);      
    const origin=center.clone().add(offset);      
    const shard=mesh(geometry,mat(isArc?0xb9ccd2:0x92a8b0,.72,.18),scene,origin.x,Math.max(origin.y,.05),origin.z);      
    shard.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);      
    const radial=offset.clone();if(radial.lengthSq()<1e-6)radial.set(Math.cos(angle),Math.sin(angle),0);radial.normalize();      
    const variation=new THREE.Vector3((Math.random()-.5)*impact*.08,(Math.random()-.5)*impact*.08,(Math.random()-.5)*impact*.08);      
    const v=body.velocity.clone().add(new THREE.Vector3().crossVectors(body.angularVelocity,offset)).addScaledVector(hitDirection,impact*.24).addScaledVector(radial,impact*(.12+Math.random()*.12)).add(variation);      
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
function waferWorldExtents(body){      
  const normal=new THREE.Vector3(0,0,1).applyQuaternion(body.view.getWorldQuaternion(new THREE.Quaternion()));      
  return new THREE.Vector3(      
    WAFER_RADIUS*Math.sqrt(Math.max(0,1-normal.x*normal.x))+WAFER_HALF_THICKNESS*Math.abs(normal.x),      
    WAFER_RADIUS*Math.sqrt(Math.max(0,1-normal.y*normal.y))+WAFER_HALF_THICKNESS*Math.abs(normal.y),      
    WAFER_RADIUS*Math.sqrt(Math.max(0,1-normal.z*normal.z))+WAFER_HALF_THICKNESS*Math.abs(normal.z)      
  )      
}      
function machineWaferCollisionBounds(){      
  if(!waferCollisionMeshes){      
    waferCollisionMeshes=[];      
    machines.forEach((machine,index)=>{      
      machine.group.traverse(object=>{      
        if(!object.isMesh||object===machine.wafer||object===machine.chamberTarget||object.userData.labelWidth!=null)return;      
        for(let parent=object;parent&&parent!==machine.group;parent=parent.parent){if(parent===machine.wafer||parent===machine.chamberTarget)return}      
        waferCollisionMeshes.push({mesh:object,machineGroup:machine.group,machineIndex:index-1,bounds:new THREE.Box3(),geometry:object.geometry})      
      })      
    })      
  }      
  for(const entry of waferCollisionMeshes){      
    let visible=true;      
    for(let parent=entry.mesh;parent;parent=parent.parent){if(!parent.visible){visible=false;break}if(parent===entry.machineGroup)break}      
    if(!visible){entry.bounds.makeEmpty();continue}      
    const geometry=entry.mesh.geometry;      
    if(!geometry.boundingBox)geometry.computeBoundingBox();      
    entry.mesh.updateWorldMatrix(true,false);      
    entry.bounds.copy(geometry.boundingBox).applyMatrix4(entry.mesh.matrixWorld)      
  }      
  return waferCollisionMeshes      
}      
function resolveWaferAABB(position,extents,bounds){      
  const minX=bounds.min.x-extents.x,maxX=bounds.max.x+extents.x,minY=bounds.min.y-extents.y,maxY=bounds.max.y+extents.y,minZ=bounds.min.z-extents.z,maxZ=bounds.max.z+extents.z;      
  if(position.x<=minX||position.x>=maxX||position.y<=minY||position.y>=maxY||position.z<=minZ||position.z>=maxZ)return null;      
  const distances=[position.x-minX,maxX-position.x,position.y-minY,maxY-position.y,position.z-minZ,maxZ-position.z];      
  let axis=distances.indexOf(Math.min(...distances)),normal=new THREE.Vector3();      
  if(axis<2){normal.x=axis===0?-1:1;position.x=axis===0?minX-1e-4:maxX+1e-4}      
  else if(axis<4){normal.y=axis===2?-1:1;position.y=axis===2?minY-1e-4:maxY+1e-4}      
  else{normal.z=axis===4?-1:1;position.z=axis===4?minZ-1e-4:maxZ+1e-4}      
  const center=position.clone(),point=center.clone().addScaledVector(normal,-extents.getComponent(axis>>1));      
  return{normal,point,center}      
}      
function applyHeldWaferContact(body,grab,contact,impactDirection){      
  const approach=Math.max(0,-grab.velocity.dot(contact.normal));      
  if(approach<.03)return false;      
  body.velocity.copy(grab.velocity);      
  const tangent=grab.velocity.clone().addScaledVector(contact.normal,approach),impulse=contact.normal.clone().multiplyScalar(approach*.45).addScaledVector(tangent,-.2);      
  const offset=contact.point.clone().sub(contact.center||body.view.position);      
  body.angularVelocity.add(new THREE.Vector3().crossVectors(offset,impulse).multiplyScalar(18));      
  if(approach>3.2){shatterWafer(body,contact.point,approach,impactDirection);return true}      
  grab.velocity.addScaledVector(contact.normal,approach);      
  body.velocity.copy(grab.velocity);      
  return false      
}      
function integrateHeldWafer(body,grab,dt){      
  const hand=pinchWorld(grab.controller),previousHand=grab.last.clone();      
  grab.velocity.copy(hand).sub(previousHand).divideScalar(Math.max(dt,.001));      
  grab.last.copy(hand);      
  const accepted=machineAcceptance(body),snapped=accepted&&hand.distanceTo(accepted.target)<WAFER_SNAP_RADIUS;      
  let target=hand;      
  if(snapped){      
    target=accepted.target;      
    grab.slotMachineIndex=accepted.i;      
    body.view.position.copy(target);      
    body.view.quaternion.copy(accepted.machine.wafer.getWorldQuaternion(new THREE.Quaternion()));      
    body.angularVelocity.multiplyScalar(Math.exp(-dt*12));      
  }else{      
    const start=body.view.position.clone(),blend=1-Math.exp(-14*Math.max(dt,0)),delta=target.clone().sub(start).multiplyScalar(blend),steps=Math.max(1,Math.ceil(delta.length()/.025)),extents=waferWorldExtents(body),machineBounds=machineWaferCollisionBounds();      
    for(let step=1;step<=steps;step++){      
      const candidate=start.clone().addScaledVector(delta,step/steps),contacts=[];      
      const roomX=8.8-extents.x,roomNearZ=-41.8+extents.z,roomFarZ=11.8-extents.z;      
      if(candidate.x>roomX){candidate.x=roomX;contacts.push({normal:new THREE.Vector3(-1,0,0),point:candidate.clone().add(new THREE.Vector3(extents.x,0,0)),center:candidate.clone()})}      
      if(candidate.x< -roomX){candidate.x=-roomX;contacts.push({normal:new THREE.Vector3(1,0,0),point:candidate.clone().add(new THREE.Vector3(-extents.x,0,0)),center:candidate.clone()})}      
      if(candidate.z>roomFarZ){candidate.z=roomFarZ;contacts.push({normal:new THREE.Vector3(0,0,-1),point:candidate.clone().add(new THREE.Vector3(0,0,extents.z)),center:candidate.clone()})}      
      if(candidate.z<roomNearZ){candidate.z=roomNearZ;contacts.push({normal:new THREE.Vector3(0,0,1),point:candidate.clone().add(new THREE.Vector3(0,0,-extents.z)),center:candidate.clone()})}      
      if(candidate.y<.03+extents.y){candidate.y=.03+extents.y;contacts.push({normal:new THREE.Vector3(0,1,0),point:candidate.clone().add(new THREE.Vector3(0,-extents.y,0)),center:candidate.clone()})}      
      for(const collider of colliders){      
        if(machines.some(machine=>Math.abs(machine.world.x-collider.x)<.001&&Math.abs(machine.world.z-collider.z)<.001))continue;      
        const y=collider.y??1.5,h=collider.h??3,bounds=new THREE.Box3(new THREE.Vector3(collider.x-collider.w/2,y-h/2,collider.z-collider.d/2),new THREE.Vector3(collider.x+collider.w/2,y+h/2,collider.z+collider.d/2));      
        const contact=resolveWaferAABB(candidate,extents,bounds);if(contact)contacts.push(contact)      
      }      
      for(const entry of machineBounds){      
        if(entry.machineIndex===grab.slotMachineIndex)continue;      
        const geom=entry.geometry;
        if(geom&&geom.type==='RingGeometry'){
          entry.mesh.updateWorldMatrix(true,false);
          const invMatrix=entry.mesh.matrixWorld.clone().invert();
          const localPos=candidate.clone().applyMatrix4(invMatrix);
          const r=Math.hypot(localPos.x,localPos.y);
          const inner=geom.parameters.innerRadius;
          if(r<inner)continue;
        }
        const contact=resolveWaferAABB(candidate,extents,entry.bounds);if(contact)contacts.push(contact)      
      }
      const playerLow=player.position.y-1.5,playerHigh=player.position.y+.18,dx=candidate.x-player.position.x,dz=candidate.z-player.position.z,playerDistance=Math.hypot(dx,dz),playerClearance=.34+WAFER_RADIUS;      
      if(candidate.y+extents.y>playerLow&&candidate.y-extents.y<playerHigh&&playerDistance<playerClearance){      
        const nx=playerDistance>.001?dx/playerDistance:(grab.velocity.x<0?1:-1),nz=playerDistance>.001?dz/playerDistance:(grab.velocity.z<0?1:0);      
        candidate.x=player.position.x+nx*(playerClearance+1e-4);candidate.z=player.position.z+nz*(playerClearance+1e-4);      
        const normal=new THREE.Vector3(nx,0,nz);contacts.push({normal,point:candidate.clone().addScaledVector(normal,-WAFER_RADIUS),center:candidate.clone()})      
      }      
      for(const contact of contacts){if(applyHeldWaferContact(body,grab,contact,grab.velocity.clone().normalize()))return}      
      body.view.position.copy(candidate)      
    }      
    if(grab.slotMachineIndex!=null){      
      const machine=machines[grab.slotMachineIndex+1],collider=colliders.find(c=>Math.abs(c.x-machine.world.x)<.001&&Math.abs(c.z-machine.world.z)<.001);      
      if(!collider||Math.abs(body.view.position.x-collider.x)>collider.w/2+extents.x||Math.abs(body.view.position.z-collider.z)>collider.d/2+extents.z)grab.slotMachineIndex=null      
    }      
    body.view.quaternion.setFromAxisAngle(body.angularVelocity.clone().normalize(),body.angularVelocity.length()*dt).multiply(body.view.quaternion);      
    body.angularVelocity.multiplyScalar(Math.exp(-dt*.32));      
    body.velocity.copy(grab.velocity)      
  }      
}      
updateWaferPhysics=function(dt){      
  for(const body of [...parallel.wafers]){      
    if(body.heldBy!=null&&!body.broken&&body.view.visible){const grab=[...parallel.grabs.values()].find(g=>g.kind==='wafer'&&g.body===body);if(grab)integrateHeldWafer(body,grab,dt);continue}      
    if(!body.dynamic||body.broken||!body.view.visible||body.machineIndex!=null)continue;      
    const spin=body.angularVelocity.length();if(spin>.0001)body.view.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(body.angularVelocity.clone().normalize(),spin*dt));body.angularVelocity.multiplyScalar(Math.exp(-dt*.32));      
    body.velocity.y-=9.81*dt;      
    body.view.position.addScaledVector(body.velocity,dt);      
    const p=body.view.position;      
    if(p.y<.08){      
      const drop=body.releaseY-p.y,impact=Math.abs(body.velocity.y);      
      if(drop>.75||impact>2.8){shatterWafer(body,p.clone(),Math.max(1.4,impact*.35));continue}
      p.y=.08;      
      body.velocity.y=Math.abs(body.velocity.y)*.18;      
      body.velocity.x*=.65;body.velocity.z*=.65      
    }      
    if(Math.abs(p.x)>8.8||p.z>11.8||p.z<-41.8){shatterWafer(body,p.clone(),2.2);continue}      
    let shattered=false;      
    for(const collider of colliders){      
      if(Math.abs(p.x-collider.x)<collider.w/2&&Math.abs(p.z-collider.z)<collider.d/2&&p.y<2.8&&body.velocity.length()>2){
        shatterWafer(body,p.clone(),body.velocity.length());shattered=true;break      
      }      
    }      
    if(!shattered)tryPlaceWafer(body)      
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
    movePlayerColliderTo(player.position.x+(side.x*sx+xrHeadDirection.x*-sy)*speed*dt,player.position.z+(side.z*sx+xrHeadDirection.z*-sy)*speed*dt,playerRoomBounds())      
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
    if(!['wafer','shard'].includes(grab.kind))continue;      
    if(grab.kind==='wafer')continue;      
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
  if(d.action==='door')return'Open or close this machine independently';      
  const st=status[d.machineIndex],machine=machines[d.machineIndex+1];      
  if(d.action==='chamber')return st.doorAmount>.92?(machine.body?'Remove or inspect the machine wafer':'Insert the wafer for this process stage'):'Open the door first';      
  if(d.action==='load')return'Requires an open door and a matching carried wafer';      
  if(d.action==='start')return'Requires a loaded wafer and fully closed door';      
  if(d.action==='stop')return'Requires this machine to be running with its door closed';      
  if(d.action==='unload')return'Requires a completed process and open door';      
  return''      
};      
buttonEnabled=function(d){      
  if(d.kind==='stock')return state.started&&!stockWafer();      
  if(d.kind!=='machine')return true;      
  const i=d.machineIndex,st=status[i],machine=machines[i+1],body=machine?.body;      
  if(d.action==='door')return true;      
  if(d.action==='chamber')return st.doorAmount>.92&&((st.state==='ready'&&carriedWafers().some(w=>w.nextStage===i))||(st.state==='done'&&!!body));      
  if(d.action==='load')return st.state==='ready'&&st.doorAmount>.92&&carriedWafers().some(w=>w.nextStage===i);      
  if(d.action==='start')return st.state==='loaded'&&!!body&&st.doorAmount<=5/90;      
  if(d.action==='stop')return st.state==='running'&&st.doorAmount<.02&&!!st.cycle&&performance.now()-st.cycle.start>400;      
  if(d.action==='unload')return st.state==='done'&&!!body&&st.doorAmount>.92;      
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
  const body=carriedWafers().find(w=>w.nextStage===i);      
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
  const st=status[i],station=stations[i],body=machines[i+1].body;      
  if(!body||st.cycle)return;      
  syncActiveWafer(body);      
  st.state='running';st.metric=0;      
  st.cycle={i,start:performance.now(),processSeconds:0,timeScale:clamp(station.targetSeconds/8,3,25)};      
  state.cycle=st.cycle;      
  setLamp(i);      
  $('cycleBar').style.opacity='1';      
  toast(`${station.name} started while other machines remain interactive.`);      
  updateAll()      
};      
stopProcess=function(i){      
  const st=status[i],station=stations[i],body=machines[i+1].body;      
  if(!st.cycle||!body)return;      
  syncActiveWafer(body);      
  const activityTime=performance.now()-st.cycle.start;
  const result=scoreProcess(i);      
  st.score=result.score;st.deviations=result.deviations;st.state='done';      
  body.records[i]={score:result.score,metric:st.metric,ratio:st.metric/station.metric.target,values:{...st.values},processSeconds:st.cycle.processSeconds,elapsedMs:activityTime};  
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
    body.completed=true;      
    body.elapsed=performance.now()-(body.startedAt||state.runStart||performance.now());      
    finishLot(body)      
  }else toast(`${body.lotId} released for ${stations[body.nextStage].name}.`);      
  updateAll()      
};      
finishLot=function(body=parallel.active){      
  if(!body)return;      
  syncActiveWafer(body);      
  state.completed=true;      
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


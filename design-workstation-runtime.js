'use strict';
// V7: manual sensor-design workstation with camera focus and three engineering stages.  
const designMode={  
  phase:'idle',step:0,start:0,duration:1250,  
  fromPos:new THREE.Vector3(),toPos:new THREE.Vector3(),returnPos:new THREE.Vector3(),  
  fromYaw:0,toYaw:0,returnYaw:0,fromPitch:0,toPitch:0,returnPitch:0,  
  gain:0,intercept:0,gainComplete:false,regression:null,regressionAttempts:0,regressionBest:null,stageStartedAt:0,timingStep:-1,  
  schematicComplete:false,schematicSubmitted:false,schematicScore:0,layoutComplete:false,layoutScore:0,layoutConnected:0,
  schematicDrag:null,schematicLinks:new Set(),circuit:null,
  layer:'M1',layoutActive:null,layoutNodes:[],layoutRoutes:[],layoutDraft:null,layoutHoverNodes:[],
  releasedBodies:new Set()  
};  
const smoothstep=t=>t*t*(3-2*t);  
const angleLerp=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;  
function resizeDesignCanvas(){  
  const canvas=$('designCanvas'),rect=canvas.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,2);  
  const w=Math.max(320,Math.floor(rect.width*scale)),h=Math.max(240,Math.floor(rect.height*scale));  
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}  
  drawDesignStage()  
}  
function designScreen(){  
  return machines[1]?.designScreen||effects.find(e=>e.kind==='screen'&&e.index===0)?.obj||null  
}  
function startDesignMode(){  
  if(designWorld.active||designMode.phase==='world')return;  
  if(designMode.step===1||designMode.step===2){enterDesignWorld(designMode.step);return;}  
  if(renderer.xr.isPresenting){renderDesignStep();enterDesignWorld(designMode.step);return}
  const screen=designScreen();  
  if(!screen)return;  
  if(document.pointerLockElement)document.exitPointerLock?.();  
  designMode.phase='moving-in';designMode.start=performance.now();  
  designMode.returnPos.copy(player.position);designMode.returnYaw=yaw;designMode.returnPitch=pitch;  
  designMode.fromPos.copy(player.position);designMode.fromYaw=yaw;designMode.fromPitch=pitch;  
  const wp=screen.getWorldPosition(new THREE.Vector3()),q=screen.getWorldQuaternion(new THREE.Quaternion());  
  const normal=new THREE.Vector3(0,0,1).applyQuaternion(q).normalize();  
  designMode.toPos.copy(wp).addScaledVector(normal,1.58);designMode.toPos.y=wp.y-.03;  
  const look=wp.clone().sub(designMode.toPos).normalize();  
  designMode.toYaw=Math.atan2(-look.x,-look.z);designMode.toPitch=Math.asin(clamp(look.y,-1,1));  
  $('designTerminal').className='moving';$('designTerminal').setAttribute('aria-hidden','false');  
  document.body.classList.add('design-editing');  
  Object.keys(keys).forEach(k=>keys[k]=false);  
}  
function closeDesignMode(){  
  if(designMode.phase==='idle'||designMode.phase==='moving-out')return;  
  designMode.phase='moving-out';designMode.start=performance.now();  
  designMode.fromPos.copy(player.position);designMode.fromYaw=yaw;designMode.fromPitch=pitch;  
  designMode.toPos.copy(designMode.returnPos);designMode.toYaw=designMode.returnYaw;designMode.toPitch=designMode.returnPitch;  
  $('designTerminal').className='moving';  
}  
function updateDesignCamera(now){  
  if(!designMode.phase.startsWith('moving'))return;  
  const t=clamp((now-designMode.start)/designMode.duration,0,1),u=smoothstep(t);  
  player.position.lerpVectors(designMode.fromPos,designMode.toPos,u);  
  yaw=angleLerp(designMode.fromYaw,designMode.toYaw,u);pitch=lerp(designMode.fromPitch,designMode.toPitch,u);  
  player.rotation.y=yaw;camera.rotation.order='YXZ';camera.rotation.x=pitch;  
  if(t<1)return;  
  if(designMode.phase==='moving-in'){  
    designMode.phase='active';$('designTerminal').className='active';  
    renderDesignStep();setTimeout(resizeDesignCanvas,0)  
  }else{  
    designMode.phase='idle';$('designTerminal').className='';$('designTerminal').setAttribute('aria-hidden','true');  
    document.body.classList.remove('design-editing');renderer.domElement.requestPointerLock?.()  
  }  
}  
function setDesignMessage(text,type=''){  
  const el=$('designMessage');el.textContent=text;el.className='design-message '+type  
}  
function setDesignProgress(valid,value,label){  
  $('designNext').disabled=!valid;$('designLiveValue').textContent=value;$('designLiveLabel').textContent=label  
}  
function renderDesignStep(){  
  if(designMode.timingStep!==designMode.step){designMode.timingStep=designMode.step;designMode.stageStartedAt=performance.now()}
  document.querySelectorAll('[data-design-step]').forEach((el,i)=>{  
    el.classList.toggle('current',i===designMode.step);  
    el.classList.toggle('done',i<designMode.step||(i===0&&designMode.gainComplete)||(i===1&&designMode.schematicComplete)||(i===2&&designMode.layoutComplete))  
  });  
  $('designBack').disabled=designMode.step===0;$('regressionScorePanel').hidden=designMode.step!==0||!designMode.gainComplete;
  $('gainControls').hidden=designMode.step!==0;$('schematicTools').hidden=designMode.step!==1;$('layoutTools').hidden=designMode.step!==2;$('designReset').hidden=designMode.step===1;  
  const active=parallel?.active;  
  $('designLot').innerHTML=`${active?.lotId||'NO ACTIVE WAFER'}<br>MANUAL ENGINEERING CHANGE CONTROL`;  
  if(designMode.step===0){  
    $('designTitle').textContent='Linear regression calibration';  
    $('designInstructions').textContent='Adjust m and c for y = mx + c. Fit quality remains hidden until submission.';  
    $('designCriteria').innerHTML='<b>Scoring</b><br>Actual least-squares regression is calculated from the generated points. Repeat submissions receive a penalty.';  
    $('designNext').textContent='VERIFY & CONTINUE';  
    updateGainState()  
  }else if(designMode.step===1){  
    ensureCircuitChallenge();$('designTitle').textContent=designMode.circuit.name+' connection repair';  
    $('designInstructions').textContent='Two connections have been removed. Draw wires between any terminals, then submit for open and short analysis.';  
    $('designCriteria').innerHTML='<b>Assessment</b><br>Correct repairs, remaining opens and incorrect shorts are scored on submission.';  
    $('designNext').textContent='VERIFY & CONTINUE';  
    updateSchematicState()  
  }else{  
    $('designTitle').textContent='Two-layer physical layout';  
    $('designInstructions').textContent='Choose a metal layer, then press and hold an existing terminal or junction. Drag to another point and release to commit an orthogonal wire. Junctions gain an automatic via when connected on both layers.';
    $('designCriteria').innerHTML='<b>Release criterion</b><br>Route IN1 → OUT2, IN2 → OUT3 and IN3 → OUT1 without opens or shorts. At least one net must use both metal layers through a via.';
    $('designNext').textContent='RELEASE DESIGN';  
    updateLayoutState()  
  }  
  drawDesignStage()  
}  
function createRegressionChallenge(){const gm=-3.25+Math.random()*6.5,gc=-5+Math.random()*10,points=[];for(let i=0;i<13;i++){const x=-5+i*10/12;points.push({x,y:gm*x+gc+(Math.random()-.5)*1.5})}const ax=points.reduce((a,p)=>a+p.x,0)/points.length,ay=points.reduce((a,p)=>a+p.y,0)/points.length,den=points.reduce((a,p)=>a+(p.x-ax)**2,0)||1,m=points.reduce((a,p)=>a+(p.x-ax)*(p.y-ay),0)/den,c=ay-m*ax,sse=points.reduce((a,p)=>a+(p.y-(m*p.x+c))**2,0);designMode.regression={points,optimum:{m,c,sse}};designMode.gain=0;designMode.intercept=0;designMode.regressionAttempts=0;designMode.regressionBest=null;designMode.gainComplete=false;$('gainSlider').value='0';$('interceptSlider').value='0';if($('regressionScorePanel'))$('regressionScorePanel').hidden=true;if($('regressionScoreValue'))$('regressionScoreValue').textContent='--%'}  
function regressionScore(){const r=designMode.regression,u=r.points.reduce((a,p)=>a+(p.y-(designMode.gain*p.x+designMode.intercept))**2,0),scale=Math.max(1,r.points.reduce((a,p)=>a+p.y*p.y,0)),raw=100*Math.exp(-8*Math.max(0,u-r.optimum.sse)/scale),penalty=Math.max(0,designMode.regressionAttempts-1)*7;return{score:clamp(raw-penalty,0,100),penalty}}  
function submitRegression(){designMode.regressionAttempts++;const q=regressionScore(),elapsed=performance.now()-designMode.stageStartedAt;if(!designMode.regressionBest||q.score>designMode.regressionBest.score)designMode.regressionBest={...q,m:designMode.gain,c:designMode.intercept};designMode.gainComplete=true;recordActivity('Linear regression',elapsed,q.score);$('designNext').disabled=false;$('designLiveLabel').textContent='BEST SUBMITTED SCORE';$('designLiveValue').textContent=designMode.regressionBest.score.toFixed(1)+'%';$('regressionScoreValue').textContent=designMode.regressionBest.score.toFixed(1)+'%';$('regressionScorePanel').hidden=false;setDesignMessage(`Attempt ${designMode.regressionAttempts}: ${q.score.toFixed(1)}%. ${q.penalty?q.penalty+' point repeat penalty.':'First submission.'}`,'good')}
function updateGainState(){if(!designMode.regression)createRegressionChallenge();$('gainValue').textContent=designMode.gain.toFixed(2);$('interceptValue').textContent=designMode.intercept.toFixed(2);$('designNext').disabled=!designMode.gainComplete;if(!designMode.gainComplete){$('designLiveLabel').textContent='FIT QUALITY';$('designLiveValue').textContent='HIDDEN';setDesignMessage('Adjust both coefficients and submit when ready.')}drawDesignStage()}  
const circuitPool=[
  {id:'inv',name:'CMOS inverter buffer',devices:[['P1','p',.34,.32],['N1','n',.34,.68],['P2','p',.68,.32],['N2','n',.68,.68]],nodes:[['IN',.08,.5],['P1G',.25,.32],['N1G',.25,.68],['X1P',.34,.43],['X1N',.34,.57],['X1J',.5,.5],['P2G',.59,.32],['N2G',.59,.68],['OUTP',.68,.43],['OUTN',.68,.57],['OUTJ',.8,.5],['OUT',.92,.5],['P1S',.34,.21],['P2S',.68,.21],['N1S',.34,.79],['N2S',.68,.79]],edges:[['IN','P1G'],['IN','N1G'],['X1P','X1J'],['X1N','X1J'],['X1J','P2G'],['X1J','N2G'],['OUTP','OUTJ'],['OUTN','OUTJ'],['OUTJ','OUT']],supplies:[['VDD','P1S'],['VDD','P2S'],['GND','N1S'],['GND','N2S']]},
  {id:'nand',name:'Two-input CMOS NAND gate',devices:[['P1','p',.26,.27],['P2','p',.74,.27],['N1','n',.5,.58],['N2','n',.5,.78]],nodes:[['A',.08,.38],['P1G',.17,.27],['N1G',.41,.58],['B',.08,.68],['P2G',.65,.27],['N2G',.41,.78],['P1S',.26,.16],['P2S',.74,.16],['P1D',.26,.38],['P2D',.74,.38],['N1D',.5,.47],['J1',.5,.42],['Y',.91,.43],['N1S',.5,.67],['N2D',.5,.69],['N2S',.5,.88]],edges:[['A','P1G'],['A','N1G'],['B','P2G'],['B','N2G'],['P1D','J1'],['P2D','J1'],['N1D','J1'],['J1','Y'],['N1S','N2D']],supplies:[['VDD','P1S'],['VDD','P2S'],['GND','N2S']]},
  {id:'amp',name:'Five-transistor differential amplifier',devices:[['M3','p',.36,.24],['M4','p',.64,.24],['M1','n',.36,.57],['M2','n',.64,.57],['M5','n',.5,.81]],nodes:[['M3S',.36,.13],['M4S',.64,.13],['M3G',.45,.24],['G34',.5,.24],['M3D',.36,.35],['M4G',.55,.24],['M4D',.64,.35],['D13',.36,.405],['D24',.64,.405],['VINP',.07,.57],['M1G',.27,.57],['VINN',.93,.57],['M2G',.73,.57],['M1D',.36,.46],['M2D',.64,.46],['M1S',.36,.68],['M2S',.64,.68],['S12',.5,.68],['M5D',.5,.72],['VBIAS',.15,.81],['M5G',.41,.81],['M5S',.5,.9],['VOUT',.91,.4]],edges:[['M3G','G34'],['M4G','G34'],['G34','D13'],['M3D','D13'],['M1D','D13'],['M4D','D24'],['M2D','D24'],['D24','VOUT'],['VINP','M1G'],['VINN','M2G'],['M1S','S12'],['M2S','S12'],['VBIAS','M5G'],['M5D','S12']],supplies:[['VDD','M3S'],['VDD','M4S'],['GND','M5S']]}
];
function edgeKey(a,b){return[a,b].sort().join('|')}  
function ensureCircuitChallenge(force=false){
  if(designMode.circuit&&!force)return;
  const t=circuitPool[Math.floor(Math.random()*circuitPool.length)],pool=t.edges.filter(edge=>!edge.includes('VDD')&&!edge.includes('GND')),validPairs=[];
  for(let first=0;first<pool.length;first++)for(let second=first+1;second<pool.length;second++)if(!pool[first].some(node=>pool[second].includes(node)))validPairs.push([pool[first],pool[second]]);
  if(!validPairs.length)throw new Error(`Circuit challenge "${t.id}" has no two disjoint connections to remove.`);
  const removed=validPairs[Math.floor(Math.random()*validPairs.length)];
  designMode.circuit={...t,removed:new Set(removed.map(edge=>edgeKey(...edge)))};designMode.schematicLinks.clear();designMode.schematicSubmitted=false;designMode.schematicComplete=false
}  
function schematicGeometry(w,h){ensureCircuitChallenge();return designMode.circuit.nodes.map(([id,x,y])=>({id,label:id,px:x*w,py:y*h}))}  
function submitSchematic(){const req=designMode.circuit.removed,u=designMode.schematicLinks,opens=[...req].filter(k=>!u.has(k)).length,shorts=[...u].filter(k=>!req.has(k)).length,correct=[...u].filter(k=>req.has(k)).length,score=clamp(100-opens*35-shorts*25,0,100);designMode.schematicSubmitted=true;designMode.schematicScore=score;designMode.schematicComplete=!opens&&!shorts;recordActivity('Circuit repair',performance.now()-designMode.stageStartedAt,score);$('designNext').disabled=!designMode.schematicComplete;$('designLiveLabel').textContent='CIRCUIT SCORE';$('designLiveValue').textContent=score.toFixed(0)+'%';setDesignMessage(`${correct} correct, ${opens} open, ${shorts} short.` ,designMode.schematicComplete?'good':score>=50?'warn':'bad');drawDesignStage()}  
function updateSchematicState(){ensureCircuitChallenge();$('designNext').disabled=!designMode.schematicComplete;if(!designMode.schematicSubmitted){$('designLiveLabel').textContent='ASSESSMENT';$('designLiveValue').textContent='NOT SUBMITTED';setDesignMessage('Repair both removed connections, then submit.')}}  
function clearSchematicWires(){designMode.schematicLinks.clear();designMode.schematicDrag=null;designMode.schematicSubmitted=false;designMode.schematicComplete=false;updateSchematicState();drawDesignStage()}
function layoutGeometry(w,h){  
  const paletteW=0,plotW=w,margin=Math.max(45,plotW*.065),innerH=h-2*margin;  
  const outputNets=[2,3,1];return{margin,plotW,paletteW,inputs:[0,1,2].map(i=>({id:`IN${i+1}`,kind:'input',net:`N${i+1}`,label:`IN${i+1}`,x:margin+18,y:margin+innerH*(.22+i*.28)})),outputs:outputNets.map((labelNet,i)=>({id:`OUT${labelNet}`,kind:'output',net:`N${i+1}`,label:`OUT${labelNet}`,x:plotW-margin-18,y:margin+innerH*(.22+i*.28)})),keepouts:[{x:plotW*.31,y:margin,w:plotW*.14,h:h*.29},{x:plotW*.55,y:h-margin-h*.31,w:plotW*.14,h:h*.31}]}
  }  
function initializeLayoutNodes(){const canvas=$('designCanvas');if(canvas.width<960||canvas.height<600){canvas.width=1280;canvas.height=800}const g=layoutGeometry(canvas.width,canvas.height);designMode.layoutNodes=[...g.inputs,...g.outputs].map(node=>({...node,terminal:true,metals:new Set()}));designMode.layoutHoverNodes=[]}
function layoutNode(id){return designMode.layoutNodes.find(node=>node.id===id)}
function nearestLayoutNode(point,excludeId=null,max=Math.max(30,$('designCanvas').width*.025)){let best=null,d=max;for(const node of designMode.layoutNodes){if(node.id===excludeId)continue;const distance=Math.hypot(point.x-node.x,point.y-node.y);if(distance<d){best=node;d=distance}}return best}
function pointSegmentDistance(p,a,b){  
  const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,c1=vx*wx+vy*wy,c2=vx*vx+vy*vy,t=c2?clamp(c1/c2,0,1):0;  
  return Math.hypot(p.x-(a.x+t*vx),p.y-(a.y+t*vy))  
}  
function segmentsIntersect(a,b,c,d){  
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);  
  const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);  
  return c1*c2<0&&c3*c4<0  
}  
function segmentIntersectsRect(a,b,r){
  let low=0,high=1;const dx=b.x-a.x,dy=b.y-a.y;
  const clip=(p,q)=>{if(Math.abs(p)<1e-9)return q>=0;const t=q/p;if(p<0){if(t>high)return false;low=Math.max(low,t)}else{if(t<low)return false;high=Math.min(high,t)}return true};
  return clip(-dx,a.x-r.x)&&clip(dx,r.x+r.w-a.x)&&clip(-dy,a.y-r.y)&&clip(dy,r.y+r.h-a.y)
}
function layoutDraftValid(draft){  
  if(!draft||draft.points.length<2||draft.points.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))return false;
  return !draft.toId||Boolean(layoutNode(draft.toId))
}  
function layoutNetConnected(net){
  const start=layoutNode(`IN${net.slice(1)}`),target=`OUT${({N1:2,N2:3,N3:1})[net]}`;if(!start||!layoutNode(target))return false;
  const queue=[...start.metals].map(layer=>({id:start.id,layer})),seen=new Set();
  while(queue.length){const current=queue.shift(),key=`${current.id}:${current.layer}`;if(seen.has(key))continue;seen.add(key);if(current.id===target)return true;
    for(const route of designMode.layoutRoutes){if(route.layer!==current.layer)continue;if(route.fromId===current.id)queue.push({id:route.toId,layer:current.layer});else if(route.toId===current.id)queue.push({id:route.fromId,layer:current.layer})}
    const node=layoutNode(current.id);if(node&&!node.terminal&&node.metals.size>1)for(const layer of node.metals)if(layer!==current.layer)queue.push({id:node.id,layer})
  }
  return false
}
function rebuildLayoutNodeMetals(){designMode.layoutNodes.forEach(node=>node.metals.clear());for(const route of designMode.layoutRoutes){layoutNode(route.fromId)?.metals.add(route.layer);layoutNode(route.toId)?.metals.add(route.layer)}}
function layoutNetworkComponents(){
  const adjacency=new Map(),componentByState=new Map(),stateKey=(id,layer)=>`${id}|${layer}`,connect=(a,b)=>{if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a).add(b);adjacency.get(b).add(a)};
  for(const route of designMode.layoutRoutes)connect(stateKey(route.fromId,route.layer),stateKey(route.toId,route.layer));
  for(const node of designMode.layoutNodes)if(!node.terminal&&node.metals.size>1){const layers=[...node.metals];for(let i=1;i<layers.length;i++)connect(stateKey(node.id,layers[0]),stateKey(node.id,layers[i]))}
  const components=[];for(const start of adjacency.keys()){if(componentByState.has(start))continue;const id=components.length,component={id,nets:new Set(),layers:new Set()},queue=[start];componentByState.set(start,id);while(queue.length){const current=queue.pop(),split=current.lastIndexOf('|'),node=layoutNode(current.slice(0,split));component.layers.add(current.slice(split+1));if(node?.net)component.nets.add(node.net);for(const next of adjacency.get(current)||[])if(!componentByState.has(next)){componentByState.set(next,id);queue.push(next)}}components.push(component)}return{components,componentByState,stateKey}
}
function layoutTrackDistance(a,b,c,d){if(segmentsIntersect(a,b,c,d))return 0;return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b))}
function layoutRouteViolations(route,g){
  const boundary=route.points.some(point=>point.x<g.margin||point.x>g.plotW-g.margin||point.y<g.margin||point.y>$('designCanvas').height-g.margin)?1:0;
  const keepOuts=g.keepouts.filter(rect=>route.points.slice(1).some((point,index)=>segmentIntersectsRect(route.points[index],point,rect))).length;
  return{boundary,keepOuts}
}
function scoreLayoutNetwork(){
  const network=layoutNetworkComponents(),wrongConnections=network.components.reduce((count,component)=>count+Math.max(0,component.nets.size-1),0),shortPairs=new Set(),trackWidth=10,g=layoutGeometry($('designCanvas').width,$('designCanvas').height);let length=0,boundaryViolations=0,keepOutViolations=0;
  designMode.layoutRoutes.forEach(route=>{const violations=layoutRouteViolations(route,g);boundaryViolations+=violations.boundary;keepOutViolations+=violations.keepOuts});
  designMode.layoutRoutes.forEach((route,index)=>{for(let pointIndex=1;pointIndex<route.points.length;pointIndex++){const a=route.points[pointIndex-1],b=route.points[pointIndex];length+=Math.hypot(b.x-a.x,b.y-a.y);for(let otherIndex=index+1;otherIndex<designMode.layoutRoutes.length;otherIndex++){const other=designMode.layoutRoutes[otherIndex];if(route.layer!==other.layer)continue;const firstComponent=network.componentByState.get(network.stateKey(route.fromId,route.layer)),secondComponent=network.componentByState.get(network.stateKey(other.fromId,other.layer));if(firstComponent===secondComponent)continue;const firstNets=network.components[firstComponent]?.nets||new Set(),secondNets=network.components[secondComponent]?.nets||new Set(),sharedNet=[...firstNets].some(net=>secondNets.has(net));if(sharedNet&&firstNets.size===1&&secondNets.size===1)continue;for(let otherPoint=1;otherPoint<other.points.length;otherPoint++)if(layoutTrackDistance(a,b,other.points[otherPoint-1],other.points[otherPoint])<=trackWidth){shortPairs.add(`${index}:${otherIndex}`);break}}}});
  const shorts=shortPairs.size,lengthPenalty=length*.001,boundaryPenalty=boundaryViolations*15,keepOutPenalty=keepOutViolations*15,score=clamp(100-wrongConnections*24-shorts*25-boundaryPenalty-keepOutPenalty-lengthPenalty,0,100),connected=[1,2,3].filter(index=>layoutNetConnected(`N${index}`)).length,twoLayerNet=network.components.some(component=>component.nets.size===1&&component.layers.has('M1')&&component.layers.has('M2'));return{score,wrongConnections,shorts,boundaryViolations,keepOutViolations,boundaryPenalty,keepOutPenalty,length,lengthPenalty,connected,twoLayerNet}
}
function updateLayoutState(){  
  const result=scoreLayoutNetwork(),vias=designMode.layoutNodes.filter(node=>!node.terminal&&node.metals.size>1).length;designMode.layoutScore=result.score;designMode.layoutConnected=result.connected;designMode.layoutComplete=result.connected===3&&!result.wrongConnections&&!result.shorts&&!result.boundaryViolations&&!result.keepOutViolations&&result.twoLayerNet;
  setDesignProgress(designMode.layoutComplete,`${result.connected}/3 · ${result.score.toFixed(1)}%`,'NET QUALITY');
  const issues=`${result.wrongConnections} wrong connections · ${result.shorts} shorts · ${result.boundaryViolations} boundary breaches · ${result.keepOutViolations} keep-out breaches · ${result.lengthPenalty.toFixed(1)} length penalty · ${result.twoLayerNet?'two-layer route present':'no via-linked two-layer route'}`;
  setDesignMessage(designMode.layoutComplete?`All nets connect without shorts or restricted-area breaches; at least one uses both layers with ${vias} automatic vias. ${issues}.`:`${issues}. Connect IN1 → OUT2, IN2 → OUT3 and IN3 → OUT1; at least one net must cross layers at a junction.`,designMode.layoutComplete?'good':result.wrongConnections||result.shorts||result.boundaryViolations||result.keepOutViolations?'warn':'')
}  
function developerSnapshot(){
  const rows=[];let stage='Awaiting stage',score=null,formula='';
  const add=(label,value,effect,diagnostic=false)=>rows.push({label,value:String(value),effect,diagnostic});
  const inDesign=designWorld.active||designMode.phase!=='idle'||parallel?.active?.nextStage===0;
  if(inDesign&&designMode.step===0){
    stage='Linear regression';
    if(!designMode.regression)return{stage,rows,score:null,formula:'Fit score is available after the regression challenge initializes.'};
    const result=regressionScore(),r=designMode.regression,sse=r.points.reduce((sum,p)=>sum+(p.y-(designMode.gain*p.x+designMode.intercept))**2,0),scale=Math.max(1,r.points.reduce((sum,p)=>sum+p.y*p.y,0)),fit=100*Math.exp(-8*Math.max(0,sse-r.optimum.sse)/scale);
    add('Residual SSE',sse.toFixed(2),`Fit baseline ${r.optimum.sse.toFixed(2)}`);add('Fit merit',fit.toFixed(1),`Base merit ${fit.toFixed(1)} points`);add('Repeat penalty',result.penalty,`-${result.penalty} points`);score=result.score;formula=`FoM = clamp(${fit.toFixed(1)} - ${result.penalty}, 0, 100)`;
  }else if(inDesign&&designMode.step===1){
    stage='Circuit repair';ensureCircuitChallenge();const required=designMode.circuit.removed,links=designMode.schematicLinks,opens=[...required].filter(key=>!links.has(key)).length,shorts=[...links].filter(key=>!required.has(key)).length,correct=[...links].filter(key=>required.has(key)).length;
    add('Required links',correct,`${correct} correct connections`);add('Opens',opens,`-${opens*35} points`);add('Shorts',shorts,`-${shorts*25} points`);score=clamp(100-opens*35-shorts*25,0,100);formula=`FoM = clamp(100 - ${opens}×35 - ${shorts}×25, 0, 100)`;
  }else if(inDesign&&designMode.step===2){
    stage='Two-layer layout';const result=scoreLayoutNetwork(),opens=Math.max(0,3-result.connected),openGate=opens?'blocked':'pass',viaGate=result.twoLayerNet?'pass':'blocked';
    add('Open nets',opens,`${openGate} release gate`);add('Wrong connections',result.wrongConnections,`-${result.wrongConnections*24} points`);add('Short pairs',result.shorts,`-${result.shorts*25} points`);add('Boundary breaches',result.boundaryViolations,`-${result.boundaryPenalty} points`);add('Keep-out breaches',result.keepOutViolations,`-${result.keepOutPenalty} points`);add('Route length penalty',result.lengthPenalty.toFixed(2),`-${result.lengthPenalty.toFixed(2)} points`);add('Two-layer via route',result.twoLayerNet?'yes':'no',`${viaGate} release gate`);score=result.score;formula=`FoM = clamp(100 - ${result.wrongConnections}×24 - ${result.shorts}×25 - ${result.boundaryViolations}×15 - ${result.keepOutViolations}×15 - ${result.lengthPenalty.toFixed(2)}, 0, 100)`;
  }else if(state.started&&parallel?.active&&stations[state.current]){
    const index=Math.min(state.current,stations.length-1),station=stations[index],st=status[index],controlRows=station.controls.map(control=>{const fitness=controlFitness(control,st.values[control.key]),award=fitness*control.weight;return{control,fitness,award}}),endpoint=clamp(100-Math.abs(st.metric-station.metric.target)/station.metric.tol*25,0,100),weighted=controlRows.reduce((sum,row)=>sum+row.award,endpoint*1.8),weight=controlRows.reduce((sum,row)=>sum+row.control.weight,1.8);
    stage=station.short;controlRows.forEach(({control,fitness,award})=>add(control.label,`${fitness.toFixed(1)}%`,`weight ${control.weight} · ${award.toFixed(1)} pts`));add(station.metric.label,`${endpoint.toFixed(1)}%`,`weight 1.8 · ${(endpoint*1.8).toFixed(1)} pts`);score=weighted/weight;formula=`FoM = ${weighted.toFixed(1)} weighted points / ${weight.toFixed(1)} total weight`;
  }
  return{stage,rows,score,formula}
}
function renderDeveloperPane(){
  const snapshot=developerSnapshot(),body=$('developerBreakdown');if(!body)return;
  body.innerHTML=`<div class="developer-stage">${escapeHtml(snapshot.stage)}</div><table class="developer-table"><thead><tr><th>Calculation</th><th>Count / value</th><th>Penalty / award</th></tr></thead><tbody>${snapshot.rows.map(row=>`<tr class="${row.diagnostic?'diagnostic':''}"><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.effect)}</td></tr>`).join('')}</tbody></table><small class="developer-formula">${escapeHtml(snapshot.formula)}</small>`;
  $('developerFom').textContent=`FoM: ${snapshot.score==null?'--':snapshot.score.toFixed(1)+'%'}`;
}
function drawXRDeveloperPane(ctx){if(!ctx||!userPreferences.developerPanel)return;const snapshot=developerSnapshot();ctx.fillStyle='rgba(2,10,16,.96)';ctx.fillRect(390,78,350,380);ctx.strokeStyle='#53e7ff';ctx.lineWidth=3;ctx.strokeRect(390,78,350,380);ctx.fillStyle='#53e7ff';ctx.font='900 17px monospace';ctx.fillText('STAGE MERIT',410,108);ctx.fillStyle='#d9e8ed';ctx.font='800 14px monospace';ctx.fillText(snapshot.stage.slice(0,30),410,134);ctx.font='12px monospace';snapshot.rows.slice(0,8).forEach((row,index)=>{ctx.fillStyle=row.diagnostic?'#ffcf56':'#b8cbd3';ctx.fillText(`${row.label}: ${row.value}`.slice(0,40),410,164+index*25);ctx.fillStyle='#819da9';ctx.fillText(row.effect.slice(0,38),410,180+index*25)});ctx.fillStyle='#67f6a3';ctx.font='900 15px monospace';ctx.fillText(`FoM ${snapshot.score==null?'--':snapshot.score.toFixed(1)+'%'} · ${currentFPS} FPS`,410,426);ctx.fillStyle='#8ca7b8';ctx.font='12px monospace';ctx.fillText('Performance sample: 1 Hz',410,446)}
function updateDeveloperMetrics(now){
  fpsFrameCount++;if(!fpsSampleAt)fpsSampleAt=now;if(now-fpsSampleAt<1000)return;currentFPS=Math.round(fpsFrameCount*1000/(now-fpsSampleAt));fpsFrameCount=0;fpsSampleAt=now;
  if(userPreferences.developerPanel){$('performanceFps').textContent=`${currentFPS} FPS`;renderDeveloperPane();if(renderer.xr.isPresenting)drawXRHandset(now)}
}
function drawGain(ctx,w,h){if(!designMode.regression)createRegressionChallenge();const r=designMode.regression,p={l:w*.1,r:w*.05,t:h*.09,b:h*.13},pw=w-p.l-p.r,ph=h-p.t-p.b,ys=r.points.flatMap(q=>[q.y,designMode.gain*q.x+designMode.intercept]),ya=Math.max(8,...ys.map(Math.abs))*1.12,X=x=>p.l+(x+5)/10*pw,Y=y=>p.t+(ya-y)/(2*ya)*ph;ctx.fillStyle='#02090e';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#183544';for(let i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(p.l+pw*i/10,p.t);ctx.lineTo(p.l+pw*i/10,h-p.b);ctx.stroke()}for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(p.l,p.t+ph*i/8);ctx.lineTo(w-p.r,p.t+ph*i/8);ctx.stroke()}ctx.strokeStyle='#789aaa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.l,Y(0));ctx.lineTo(w-p.r,Y(0));ctx.moveTo(X(0),p.t);ctx.lineTo(X(0),h-p.b);ctx.stroke();ctx.strokeStyle='#ff9d3c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(X(-5),Y(-5*designMode.gain+designMode.intercept));ctx.lineTo(X(5),Y(5*designMode.gain+designMode.intercept));ctx.stroke();ctx.fillStyle='#53e7ff';for(const q of r.points){ctx.beginPath();ctx.arc(X(q.x),Y(q.y),6,0,7);ctx.fill()}ctx.fillStyle='#9ab5c1';ctx.font='16px monospace';ctx.fillText('● measured samples',p.l+10,p.t+22);ctx.fillStyle='#ff9d3c';ctx.fillText('— candidate y = mx + c',p.l+10,p.t+46)}  
function drawMos(ctx,device,w,h,nodes){const gate=nodes.find(node=>node.id===device[0]+'G');CircuitSymbols.drawMos(ctx,device,w,h,'#f4f5f1',gate)}  
function drawSchematic(ctx,w,h){
  ensureCircuitChallenge();
  const c=designMode.circuit,n=schematicGeometry(w,h),by=id=>n.find(node=>node.id===id);
  ctx.fillStyle='#f4f5f1';ctx.fillRect(0,0,w,h);
  c.devices.forEach(device=>drawMos(ctx,device,w,h,n));
  for(const[a,b]of c.edges){
    if(c.removed.has(edgeKey(a,b)))continue;
    const p=by(a),q=by(b),elbow=(p.px+q.px)/2;
    ctx.strokeStyle='#163c74';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(elbow,p.py);ctx.lineTo(elbow,q.py);ctx.lineTo(q.px,q.py);ctx.stroke()
  }
  for(const key of designMode.schematicLinks){
    const[a,b]=key.split('|'),p=by(a),q=by(b),elbow=(p.px+q.px)/2;
    ctx.strokeStyle=designMode.schematicSubmitted?(c.removed.has(key)?'#43c971':'#ff5f73'):'#f08a31';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(elbow,p.py);ctx.lineTo(elbow,q.py);ctx.lineTo(q.px,q.py);ctx.stroke()
  }
  const supplyTerminals=(c.supplies||[]).map(([id,nodeId])=>{const node=by(nodeId);return{id,px:node.px,py:node.py}});
  CircuitSymbols.drawPowerTerminals(ctx,supplyTerminals,w,h);
  const missingPairs=[...c.removed].map(key=>key.split('|')),ends=new Set(missingPairs.flat()),pairColors=['#ed334d','#1675e8'];
  for(const node of n){
    const pairIndex=missingPairs.findIndex(pair=>pair.includes(node.id)),missing=pairIndex>=0;
    if(missing){ctx.strokeStyle=pairColors[pairIndex];ctx.lineWidth=7;ctx.beginPath();ctx.arc(node.px,node.py,18,0,Math.PI*2);ctx.stroke()}
    ctx.fillStyle=missing?'#fff4a8':'#dce8ec';ctx.strokeStyle=missing?pairColors[pairIndex]:'#446273';ctx.lineWidth=missing?5:4;ctx.beginPath();ctx.arc(node.px,node.py,missing?10:6,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(['IN','OUT','Y','A','B','VDD','GND','VINP','VINN','VOUT','VBIAS'].includes(node.id)){ctx.fillStyle='#17232a';ctx.fillText(node.id,node.px+10,node.py-10)}
  }
  if(designMode.schematicDrag){
    const p=by(designMode.schematicDrag.from),x=designMode.schematicDrag.x,y=designMode.schematicDrag.y,elbow=(p.px+x)/2;
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='rgba(0,229,255,.24)';ctx.lineWidth=28;ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(elbow,p.py);ctx.lineTo(elbow,y);ctx.lineTo(x,y);ctx.stroke();ctx.strokeStyle='#63f3ff';ctx.lineWidth=10;ctx.setLineDash([15,9]);ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(elbow,p.py);ctx.lineTo(elbow,y);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.restore()
  }
  ctx.fillStyle='#17232a';ctx.font='900 18px system-ui';ctx.fillText(c.name.toUpperCase(),20,52)
}
function drawLayoutLabels(ctx,w,h){const g=layoutGeometry(w,h);ctx.fillStyle='#ff9aa8';ctx.font=`${Math.max(11,w*.014)}px monospace`;ctx.fillText('OUTER NO-GO BOUNDARY',g.margin+10,g.margin-12);ctx.fillStyle='#fff';ctx.font=`700 ${Math.max(16,w*.022)}px monospace`;for(const[ index,rect]of g.keepouts.entries())ctx.fillText('KEEP OUT',rect.x+10,index===0?rect.y+rect.h-10:rect.y+24);ctx.fillStyle='#eaf7fb';ctx.font=`900 ${Math.min(Math.max(18,w*.022),g.margin*.42)}px monospace`;ctx.textBaseline='middle';for(const node of designMode.layoutNodes){if(!node.terminal)continue;ctx.textAlign=node.kind==='input'?'right':'left';ctx.fillText(node.label,node.x+(node.kind==='input'?-24:24),node.y)}ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#95aeb9';ctx.font='12px monospace';ctx.fillText('HOLD NODE · DRAG · RELEASE TO WIRE',18,h-18)}
function drawLayout(ctx,w,h){  
  const g=layoutGeometry(w,h),colors={M1:'#ffe52b',M2:'#168dff'};ctx.fillStyle='#061017';ctx.fillRect(0,0,w,h);  
  ctx.fillStyle='rgba(120,38,45,.3)';ctx.fillRect(0,0,g.plotW,g.margin);ctx.fillRect(0,h-g.margin,g.plotW,g.margin);ctx.fillRect(0,g.margin,g.margin,h-2*g.margin);ctx.fillRect(g.plotW-g.margin,g.margin,g.margin,h-2*g.margin);ctx.strokeStyle='#ff6579';ctx.lineWidth=4;ctx.strokeRect(g.margin,g.margin,g.plotW-2*g.margin,h-2*g.margin);g.keepouts.forEach(r=>{ctx.fillStyle='#241a1b';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle='#81524c';ctx.strokeRect(r.x,r.y,r.w,r.h)});  
  const routeDraw=(route,alpha=1)=>{ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=colors[route.layer];ctx.lineWidth=9;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(route.points[0].x,route.points[0].y);route.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.restore()};  
  if(designMode.layoutDraft){const end=designMode.layoutDraft.points.at(-1);ctx.fillStyle=designMode.layoutDraft.valid?colors[designMode.layoutDraft.layer]:'#ff6579';ctx.beginPath();ctx.arc(end.x,end.y,10,0,Math.PI*2);ctx.fill()}  
  if(!designWorld.active)drawLayoutLabels(ctx,w,h)
}  
function drawDesignStage(){  
  const canvas=$('designCanvas');if(!canvas||!canvas.width)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;  
  if(designMode.step===0)drawGain(ctx,w,h);else if(designMode.step===1)drawSchematic(ctx,w,h);else drawLayout(ctx,w,h)  
}  
function designPointer(e){  
  if(Number.isFinite(e.designX)&&Number.isFinite(e.designY))return{x:e.designX,y:e.designY};  
  const canvas=$('designCanvas'),r=canvas.getBoundingClientRect();  
  if(!r.width||!r.height)return{x:NaN,y:NaN};  
  return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}  
}  
function nearestDesignNode(p,nodes,max=designWorld?.active?42:24){let best=null,d=max;for(const n of nodes){const q=Math.hypot(p.x-n.px,p.y-n.py);if(q<d){d=q;best=n}}return best}  
function onDesignPointerDown(e){  
  if(designMode.step!==1)return;const p=designPointer(e);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return;const nodes=schematicGeometry($('designCanvas').width,$('designCanvas').height),n=nearestDesignNode(p,nodes,designWorld.active?42:Math.max(30,$('designCanvas').width*.025));  
  if(n){designMode.schematicDrag={from:n.id,x:p.x,y:p.y};if(!designWorld.active)$('designCanvas').setPointerCapture?.(e.pointerId);drawDesignStage()}  
}  
function onDesignPointerMove(e){  
  if(designMode.step===1&&designMode.schematicDrag){const p=designPointer(e);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return;designMode.schematicDrag.x=p.x;designMode.schematicDrag.y=p.y;drawDesignStage()}  
}  
function onDesignPointerUp(e){if(designMode.step!==1||!designMode.schematicDrag)return;const p=designPointer(e),nodes=schematicGeometry($('designCanvas').width,$('designCanvas').height),from=nodes.find(n=>n.id===designMode.schematicDrag.from),to=nearestDesignNode(p,nodes,designWorld.active?42:Math.max(30,$('designCanvas').width*.025));if(to&&to.id!==from.id){const k=edgeKey(from.id,to.id);designMode.schematicLinks.has(k)?designMode.schematicLinks.delete(k):designMode.schematicLinks.add(k);designMode.schematicSubmitted=false;designMode.schematicComplete=false}designMode.schematicDrag=null;updateSchematicState();drawDesignStage()}  
function freeLayoutPoint(p){const c=$('designCanvas'),g=layoutGeometry(c.width,c.height);return{x:clamp(p.x,0,g.plotW),y:clamp(p.y,0,c.height)}}
function layoutElbowPoints(start,end,layer){const dx=end.x-start.x,dy=end.y-start.y,points=[{x:start.x,y:start.y,layer}];if(Math.abs(dx)>=Math.abs(dy)){if(Math.abs(dy)<1){points.push({x:end.x,y:end.y,layer});return points}const midX=start.x+dx/2;points.push({x:midX,y:start.y,layer},{x:midX,y:end.y,layer})}else{if(Math.abs(dx)<1){points.push({x:end.x,y:end.y,layer});return points}const midY=start.y+dy/2;points.push({x:start.x,y:midY,layer},{x:end.x,y:midY,layer})}points.push({x:end.x,y:end.y,layer});return points}
function beginLayoutWire(point){const node=nearestLayoutNode(point);if(!node){setDesignMessage('Start on one of the six terminals or a wire junction.','warn');return}designMode.layoutDraft={fromId:node.id,toId:null,layer:designMode.layer,points:[{x:node.x,y:node.y,layer:designMode.layer}],valid:false};updateLayoutWire(point)}
function updateLayoutWire(point){const draft=designMode.layoutDraft;if(!draft)return;const target=nearestLayoutNode(point,draft.fromId),end=target?{x:target.x,y:target.y}:freeLayoutPoint(point),start=layoutNode(draft.fromId);draft.toId=target?.id||null;draft.points=layoutElbowPoints(start,end,draft.layer);draft.valid=target?.id!==draft.fromId&&Math.hypot(end.x-start.x,end.y-start.y)>Math.max(18,$('designCanvas').width*.012)&&layoutDraftValid(draft);designMode.layoutHoverNodes=target?[{id:target.id}]:[];drawDesignStage()}
function finishLayoutWire(point){if(!designMode.layoutDraft)return;updateLayoutWire(point);const draft=designMode.layoutDraft;if(!draft.valid){designMode.layoutDraft=null;designMode.layoutHoverNodes=[];setDesignMessage('Wire rejected. Start on a terminal or junction and finish at another node or a free endpoint.','warn');drawDesignStage();return}const start=layoutNode(draft.fromId);let end=layoutNode(draft.toId);if(!end){const point=draft.points.at(-1);let index=1;while(layoutNode(`J${index}`))index++;end={id:`J${index}`,kind:'junction',label:'JUNCTION',x:point.x,y:point.y,terminal:false,metals:new Set()};designMode.layoutNodes.push(end)}if(designMode.layoutRoutes.some(route=>route.layer===draft.layer&&((route.fromId===start.id&&route.toId===end.id)||(route.fromId===end.id&&route.toId===start.id)))){if(end.id.startsWith('J')&&!end.metals.size)designMode.layoutNodes.pop();designMode.layoutDraft=null;designMode.layoutHoverNodes=[];setDesignMessage('Those two points are already connected on this layer.','warn');drawDesignStage();return}start.metals.add(draft.layer);end.metals.add(draft.layer);designMode.layoutRoutes.push({fromId:start.id,toId:end.id,layer:draft.layer,points:draft.points.map(point=>({...point}))});designMode.layoutDraft=null;designMode.layoutHoverNodes=[];updateLayoutState();drawDesignStage();if(designWorld.active)syncDesignBoard()}
function layoutPaletteAction(){return false}
function onDesignClick(e){if(designMode.step!==2||designWorld.active)return;const point=designPointer(e);if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return;if(layoutPaletteAction(point))return;if(!designMode.layoutDraft)beginLayoutWire(point);else finishLayoutWire(point)}
function resetDesignStage(){  
  if(designMode.step===0){createRegressionChallenge();updateGainState()}  
  if(designMode.step===1){clearSchematicWires()}  
  if(designMode.step===2){designMode.layoutActive=null;designMode.layoutRoutes=[];designMode.layoutDraft=null;initializeLayoutNodes();updateLayoutState();drawDesignStage();if(designWorld.active)syncDesignBoard()}  
}  
function releaseDesign(){  
  const body=parallel?.active;  
  if(!body){setDesignMessage('Dispense a wafer before releasing a fabrication design.','warn');return}  
  if(body.nextStage!==0){setDesignMessage('The active wafer already has a released sensor design.','warn');return}  
  recordActivity('Two-layer layout',performance.now()-designMode.stageStartedAt,designMode.layoutScore||0,body.lotId);
  body.pattern='Logic grid';body.records[0]={score:100,metric:24,ratio:1,processSeconds:24,values:{regressionScore:designMode.regressionBest?.score||0,gradient:designMode.regressionBest?.m??designMode.gain,intercept:designMode.regressionBest?.c??designMode.intercept,circuit:designMode.circuit?.id,circuitScore:designMode.schematicScore,layoutNets:3,metalLayers:2}};  
  body.nextStage=1;body.startedAt=body.startedAt||performance.now();designMode.releasedBodies.add(body.id);  
  status[0].state='complete';status[0].metric=24;status[0].score=100;status[0].deviations=[];setLamp(0);  
  syncActiveWafer(body);state.current=1;toast(`${body.lotId} sensor design released. Proceed to the oxidation furnace.`);updateAll();closeDesignMode()  
}  


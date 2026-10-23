// V7: manual sensor-design workstation with camera focus and three engineering stages.
const designMode={
  phase:'idle',step:0,start:0,duration:1250,
  fromPos:new THREE.Vector3(),toPos:new THREE.Vector3(),returnPos:new THREE.Vector3(),
  fromYaw:0,toYaw:0,returnYaw:0,fromPitch:0,toPitch:0,returnPitch:0,
  gain:1,targetGain:1.85,gainComplete:false,
  schematicComplete:false,layoutComplete:false,
  schematicDrag:null,schematicLinks:new Set(),
  layer:'M1',layoutActive:null,layoutRoutes:[],layoutDraft:[],
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
  if(renderer.xr.isPresenting){toast('The desktop design workstation uses the monitor overlay. Exit VR to operate it.','warn');return}
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
  document.querySelectorAll('[data-design-step]').forEach((el,i)=>{
    el.classList.toggle('current',i===designMode.step);
    el.classList.toggle('done',i<designMode.step||(i===0&&designMode.gainComplete)||(i===1&&designMode.schematicComplete)||(i===2&&designMode.layoutComplete))
  });
  $('designBack').disabled=designMode.step===0;
  $('gainControls').hidden=designMode.step!==0;$('layoutTools').hidden=designMode.step!==2;
  const active=parallel?.active;
  $('designLot').innerHTML=`${active?.lotId||'NO ACTIVE WAFER'}<br>MANUAL ENGINEERING CHANGE CONTROL`;
  if(designMode.step===0){
    $('designTitle').textContent='Output relationship transfer function';
    $('designInstructions').textContent='Use the gain slider while reading the graph. The cyan points are the measured output relationship; the orange line is the predicted response for your selected gain.';
    $('designCriteria').innerHTML='<b>Release criterion</b><br>Determine the output gain to within ±0.05. No automatic fitting is performed.';
    $('designNext').textContent='VERIFY & CONTINUE';
    updateGainState()
  }else if(designMode.step===1){
    $('designTitle').textContent='Schematic connection drawing';
    $('designInstructions').textContent='Drag from an open node to the matching labelled node. Each connection is drawn manually and becomes locked only when the two net names agree.';
    $('designCriteria').innerHTML='<b>Release criterion</b><br>Join NET_A, NET_B, NET_C and NET_D without connecting unlike node labels.';
    $('designNext').textContent='VERIFY & CONTINUE';
    updateSchematicState()
  }else{
    $('designTitle').textContent='Two-layer physical layout';
    $('designInstructions').textContent='Route IN1, IN2 and IN3 to the matching output pads. Click an input to begin, click grid points to add orthogonal metal, switch M1/M2 to place a via, then click the matching output.';
    $('designCriteria').innerHTML='<b>Release criterion</b><br>Complete all three nets. Every route must use both metal layers and avoid same-layer shorts.';
    $('designNext').textContent='RELEASE DESIGN';
    updateLayoutState()
  }
  drawDesignStage()
}
function updateGainState(){
  const error=Math.abs(designMode.gain-designMode.targetGain),fit=Math.max(0,Math.round(100-error/1.35*100));
  designMode.gainComplete=error<=.05;$('gainValue').textContent=designMode.gain.toFixed(2)+'×';
  setDesignProgress(designMode.gainComplete,fit+'%','TRACE OVERLAP');
  setDesignMessage(designMode.gainComplete?'Measured points and calculated transfer function agree. The gain can be released.':error<.25?'Close fit — refine the gain until both traces overlap.':'Adjust the gain manually by comparing the orange line with the measured cyan points.',designMode.gainComplete?'good':'');
  drawDesignStage()
}
function schematicGeometry(w,h){
  const nodes=[
    {id:'a1',net:'NET_A',x:.18,y:.27,label:'ADC_OUT'},{id:'a2',net:'NET_A',x:.77,y:.18,label:'AMP_IN'},
    {id:'b1',net:'NET_B',x:.21,y:.7,label:'BIAS_REF'},{id:'b2',net:'NET_B',x:.72,y:.58,label:'BIAS_IN'},
    {id:'c1',net:'NET_C',x:.43,y:.2,label:'CLK_DRV'},{id:'c2',net:'NET_C',x:.82,y:.77,label:'CLK_BUS'},
    {id:'d1',net:'NET_D',x:.39,y:.78,label:'GND_SENSE'},{id:'d2',net:'NET_D',x:.61,y:.39,label:'GND_STAR'}
  ];nodes.forEach(n=>{n.px=n.x*w;n.py=n.y*h});return nodes
}
function updateSchematicState(){
  designMode.schematicComplete=designMode.schematicLinks.size===4;
  setDesignProgress(designMode.schematicComplete,`${designMode.schematicLinks.size} / 4`,'NETS JOINED');
  setDesignMessage(designMode.schematicComplete?'All disconnected circuit nodes are joined to their matching nets.':'Drag between matching open circles. A valid wire locks in orange; an invalid connection is rejected.',designMode.schematicComplete?'good':'')
}
function layoutGeometry(w,h){
  return{
    inputs:[0,1,2].map(i=>({net:`N${i+1}`,label:`IN${i+1}`,x:55,y:h*(.24+i*.26)})),
    outputs:[0,1,2].map(i=>({net:`N${i+1}`,label:`OUT${i+1}`,x:w-55,y:h*(.24+i*.26)})),
    keepouts:[{x:w*.32,y:h*.14,w:w*.13,h:h*.32},{x:w*.55,y:h*.54,w:w*.13,h:h*.32}]
  }
}
function pointSegmentDistance(p,a,b){
  const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,c1=vx*wx+vy*wy,c2=vx*vx+vy*vy,t=c2?clamp(c1/c2,0,1):0;
  return Math.hypot(p.x-(a.x+t*vx),p.y-(a.y+t*vy))
}
function segmentsIntersect(a,b,c,d){
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);
  return c1*c2<0&&c3*c4<0
}
function layoutPointBlocked(point){
  const canvas=$('designCanvas'),g=layoutGeometry(canvas.width,canvas.height);
  return g.keepouts.some(r=>point.x>r.x&&point.x<r.x+r.w&&point.y>r.y&&point.y<r.y+r.h)
}
function layoutDraftValid(){
  if(designMode.layoutDraft.length<2)return true;
  const b=designMode.layoutDraft.at(-1),a=designMode.layoutDraft.at(-2);
  if(layoutPointBlocked(b))return false;
  for(const route of designMode.layoutRoutes){
    for(let i=1;i<route.points.length;i++){
      const c=route.points[i-1],d=route.points[i];
      if(c.layer===a.layer&&d.layer===b.layer&&a.layer===c.layer&&segmentsIntersect(a,b,c,d))return false
    }
  }
  return true
}
function updateLayoutState(){
  designMode.layoutComplete=designMode.layoutRoutes.length===3;
  const vias=designMode.layoutRoutes.reduce((n,r)=>n+r.vias,0);
  setDesignProgress(designMode.layoutComplete,`${designMode.layoutRoutes.length} / 3`,'SIGNALS ROUTED');
  setDesignMessage(designMode.layoutComplete?`All signal nets are routed across M1 and M2 with ${vias} verified vias.`:'Start at an input pad. Add orthogonal points, change metal layer at least once, and finish on the matching output.',designMode.layoutComplete?'good':'')
}
function drawGain(ctx,w,h){
  ctx.fillStyle='#02090e';ctx.fillRect(0,0,w,h);
  const m={l:w*.1,r:w*.05,t:h*.1,b:h*.13},pw=w-m.l-m.r,ph=h-m.t-m.b;
  ctx.strokeStyle='#183544';ctx.lineWidth=1;
  for(let i=0;i<=10;i++){const x=m.l+pw*i/10;ctx.beginPath();ctx.moveTo(x,m.t);ctx.lineTo(x,h-m.b);ctx.stroke()}
  for(let i=0;i<=8;i++){const y=m.t+ph*i/8;ctx.beginPath();ctx.moveTo(m.l,y);ctx.lineTo(w-m.r,y);ctx.stroke()}
  ctx.strokeStyle='#789aaa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m.l,m.t);ctx.lineTo(m.l,h-m.b);ctx.lineTo(w-m.r,h-m.b);ctx.stroke();
  const map=(x,g)=>({x:m.l+x/5*pw,y:h-m.b-(.22+g*x)/10*ph});
  ctx.strokeStyle='#ff9d3c';ctx.lineWidth=4;ctx.beginPath();
  for(let i=0;i<=50;i++){const p=map(i/10,designMode.gain);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();
  ctx.fillStyle='#53e7ff';ctx.strokeStyle='#53e7ff';
  for(let x=.4;x<=4.8;x+=.55){const p=map(x,designMode.targetGain);ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='#9ab5c1';ctx.font=`${Math.max(12,w*.018)}px monospace`;ctx.fillText('INPUT',w*.46,h*.96);
  ctx.save();ctx.translate(w*.025,h*.58);ctx.rotate(-Math.PI/2);ctx.fillText('OUTPUT',0,0);ctx.restore();
  ctx.fillStyle='#53e7ff';ctx.fillText('● measured response',m.l+10,m.t+22);ctx.fillStyle='#ff9d3c';ctx.fillText('— selected transfer function',m.l+10,m.t+46)
}
function drawSchematic(ctx,w,h){
  ctx.fillStyle='#f1f4f3';ctx.fillRect(0,0,w,h);const nodes=schematicGeometry(w,h);
  ctx.strokeStyle='#bf433b';ctx.lineWidth=5;
  [[.08,.27,.18,.27],[.77,.18,.9,.18],[.08,.7,.21,.7],[.72,.58,.91,.58],[.43,.08,.43,.2],[.82,.77,.93,.77],[.39,.78,.39,.91],[.61,.39,.61,.27]].forEach(a=>{ctx.beginPath();ctx.moveTo(a[0]*w,a[1]*h);ctx.lineTo(a[2]*w,a[3]*h);ctx.stroke()});
  ctx.fillStyle='#17232a';ctx.font=`700 ${Math.max(12,w*.017)}px monospace`;
  nodes.forEach(n=>{ctx.fillText(n.label,n.px+(n.px<w/2?14:-ctx.measureText(n.label).width-14),n.py-14);ctx.fillStyle='#43c971';ctx.beginPath();ctx.arc(n.px,n.py,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#175a31';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#17232a'});
  for(const key of designMode.schematicLinks){const [aId,bId]=key.split('|'),a=nodes.find(n=>n.id===aId),b=nodes.find(n=>n.id===bId);ctx.strokeStyle='#f08a31';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(a.px,a.py);ctx.bezierCurveTo((a.px+b.px)/2,a.py,(a.px+b.px)/2,b.py,b.px,b.py);ctx.stroke()}
  if(designMode.schematicDrag){const a=nodes.find(n=>n.id===designMode.schematicDrag.from);ctx.strokeStyle='#f0c34d';ctx.lineWidth=4;ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(a.px,a.py);ctx.lineTo(designMode.schematicDrag.x,designMode.schematicDrag.y);ctx.stroke();ctx.setLineDash([])}
}
function drawLayout(ctx,w,h){
  ctx.fillStyle='#061017';ctx.fillRect(0,0,w,h);const g=layoutGeometry(w,h);
  ctx.strokeStyle='#17313e';ctx.lineWidth=1;
  const grid=Math.max(22,Math.round(w/28));for(let x=0;x<w;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  g.keepouts.forEach(r=>{ctx.fillStyle='#241a1b';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle='#81524c';ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#b8837a';ctx.font=`${Math.max(11,w*.014)}px monospace`;ctx.fillText('KEEP OUT',r.x+10,r.y+20)});
  const pad=(p,left)=>{ctx.fillStyle=left?'#ff6583':'#6c79ff';ctx.fillRect(p.x-13,p.y-18,26,36);ctx.fillStyle='#eaf7fb';ctx.font=`700 ${Math.max(11,w*.015)}px monospace`;ctx.fillText(p.label,left?p.x+20:p.x-20-ctx.measureText(p.label).width,p.y+5)};
  g.inputs.forEach(p=>pad(p,true));g.outputs.forEach(p=>pad(p,false));
  const routeDraw=points=>{for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];ctx.strokeStyle=b.layer==='M2'?'#ff5bbd':'#53e7ff';ctx.lineWidth=8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();if(a.layer!==b.layer){ctx.fillStyle='#ffe07a';ctx.beginPath();ctx.arc(a.x,a.y,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#4d3a0b';ctx.lineWidth=2;ctx.stroke()}}};
  designMode.layoutRoutes.forEach(r=>routeDraw(r.points));routeDraw(designMode.layoutDraft);
  if(designMode.layoutDraft.length){const p=designMode.layoutDraft.at(-1);ctx.fillStyle=designMode.layer==='M2'?'#ff5bbd':'#53e7ff';ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='#53e7ff';ctx.fillRect(18,18,24,6);ctx.fillStyle='#8da9b5';ctx.font=`${Math.max(11,w*.014)}px monospace`;ctx.fillText('M1',50,25);ctx.fillStyle='#ff5bbd';ctx.fillRect(88,18,24,6);ctx.fillStyle='#8da9b5';ctx.fillText('M2',120,25);ctx.fillStyle='#ffe07a';ctx.beginPath();ctx.arc(173,21,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8da9b5';ctx.fillText('VIA',187,25)
}
function drawDesignStage(){
  const canvas=$('designCanvas');if(!canvas||!canvas.width)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  if(designMode.step===0)drawGain(ctx,w,h);else if(designMode.step===1)drawSchematic(ctx,w,h);else drawLayout(ctx,w,h)
}
function designPointer(e){
  const canvas=$('designCanvas'),r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}
}
function nearestDesignNode(p,nodes,max=24){let best=null,d=max;for(const n of nodes){const q=Math.hypot(p.x-n.px,p.y-n.py);if(q<d){d=q;best=n}}return best}
function onDesignPointerDown(e){
  if(designMode.step!==1)return;const p=designPointer(e),nodes=schematicGeometry($('designCanvas').width,$('designCanvas').height),n=nearestDesignNode(p,nodes);
  if(n){designMode.schematicDrag={from:n.id,x:p.x,y:p.y};$('designCanvas').setPointerCapture?.(e.pointerId);drawDesignStage()}
}
function onDesignPointerMove(e){
  if(designMode.step===1&&designMode.schematicDrag){const p=designPointer(e);designMode.schematicDrag.x=p.x;designMode.schematicDrag.y=p.y;drawDesignStage()}
}
function onDesignPointerUp(e){
  if(designMode.step!==1||!designMode.schematicDrag)return;
  const p=designPointer(e),nodes=schematicGeometry($('designCanvas').width,$('designCanvas').height),from=nodes.find(n=>n.id===designMode.schematicDrag.from),to=nearestDesignNode(p,nodes);
  if(to&&to.id!==from.id&&to.net===from.net){const key=[from.id,to.id].sort().join('|');designMode.schematicLinks.add(key);setDesignMessage(`${from.net} connected: ${from.label} to ${to.label}.`,'good')}
  else setDesignMessage('Connection rejected. Join only nodes carrying the same net name.','warn');
  designMode.schematicDrag=null;updateSchematicState();drawDesignStage()
}
function snapLayoutPoint(p){
  const grid=Math.max(22,Math.round($('designCanvas').width/28));
  return{x:Math.round(p.x/grid)*grid,y:Math.round(p.y/grid)*grid,layer:designMode.layer}
}
function nearestPad(p,pads,max=30){let best=null,d=max;for(const pad of pads){const q=Math.hypot(p.x-pad.x,p.y-pad.y);if(q<d){d=q;best=pad}}return best}
function onDesignClick(e){
  if(designMode.step!==2)return;const canvas=$('designCanvas'),p=designPointer(e),g=layoutGeometry(canvas.width,canvas.height);
  if(!designMode.layoutActive){
    const input=nearestPad(p,g.inputs);if(!input||designMode.layoutRoutes.some(r=>r.net===input.net))return;
    designMode.layoutActive=input.net;designMode.layoutDraft=[{x:input.x,y:input.y,layer:designMode.layer}];setDesignMessage(`${input.label} selected. Add route points and finish on ${input.net.replace('N','OUT')}.`);drawDesignStage();return
  }
  const output=nearestPad(p,g.outputs);
  if(output){
    if(output.net!==designMode.layoutActive){setDesignMessage('That output belongs to a different signal net.','warn');return}
    const last=designMode.layoutDraft.at(-1),end={x:output.x,y:output.y,layer:designMode.layer};
    if(last.x!==end.x&&last.y!==end.y)designMode.layoutDraft.push({x:last.x,y:end.y,layer:designMode.layer});
    designMode.layoutDraft.push(end);
    const layers=new Set(designMode.layoutDraft.map(q=>q.layer)),vias=designMode.layoutDraft.slice(1).filter((q,i)=>q.layer!==designMode.layoutDraft[i].layer).length;
    if(layers.size<2||vias<1){designMode.layoutDraft.pop();setDesignMessage('Use both M1 and M2 and place at least one via before reaching the output.','warn');drawDesignStage();return}
    if(!layoutDraftValid()){designMode.layoutDraft.pop();setDesignMessage('Route rejected: the final segment crosses a keep-out or same-layer trace.','warn');drawDesignStage();return}
    designMode.layoutRoutes.push({net:designMode.layoutActive,points:designMode.layoutDraft.map(q=>({...q})),vias});
    designMode.layoutActive=null;designMode.layoutDraft=[];updateLayoutState();drawDesignStage();return
  }
  const q=snapLayoutPoint(p),last=designMode.layoutDraft.at(-1);
  if(last.x!==q.x&&last.y!==q.y){const elbow={x:q.x,y:last.y,layer:designMode.layer};designMode.layoutDraft.push(elbow);if(!layoutDraftValid()){designMode.layoutDraft.pop();setDesignMessage('That segment would create a same-layer short or enter a keep-out.','warn');return}}
  designMode.layoutDraft.push(q);
  if(!layoutDraftValid()){designMode.layoutDraft.pop();setDesignMessage('That segment would create a same-layer short or enter a keep-out.','warn')}
  drawDesignStage()
}
function resetDesignStage(){
  if(designMode.step===0){designMode.gain=1;$('gainSlider').value='1';updateGainState()}
  if(designMode.step===1){designMode.schematicLinks.clear();designMode.schematicDrag=null;updateSchematicState();drawDesignStage()}
  if(designMode.step===2){designMode.layoutActive=null;designMode.layoutRoutes=[];designMode.layoutDraft=[];updateLayoutState();drawDesignStage()}
}
function releaseDesign(){
  const body=parallel?.active;
  if(!body){setDesignMessage('Dispense a wafer before releasing a fabrication design.','warn');return}
  if(body.nextStage!==0){setDesignMessage('The active wafer already has a released sensor design.','warn');return}
  body.pattern='Logic grid';body.records[0]={score:100,metric:24,ratio:1,processSeconds:24,values:{gain:designMode.gain,schematicNets:4,layoutNets:3,metalLayers:2}};
  body.nextStage=1;body.startedAt=body.startedAt||performance.now();designMode.releasedBodies.add(body.id);
  status[0].state='complete';status[0].metric=24;status[0].score=100;status[0].deviations=[];setLamp(0);
  syncActiveWafer(body);state.current=1;toast(`${body.lotId} sensor design released. Proceed to the oxidation furnace.`);updateAll();closeDesignMode()
}
const v6CreateMachine=createMachine;
createMachine=function(s,i){
  if(s.type!=='design'){v6CreateMachine(s,i);machines[i+1].kind='fabrication';return}
  const g=new THREE.Group(),x=s.side*6.65;
  g.position.set(x,0,s.z);g.rotation.y=s.side<0?Math.PI/2:-Math.PI/2;scene.add(g);
  const deskMat=mat(0x263946,.25,.38),edgeMat=mat(0x638397,.55,.22),pcMat=mat(0x0b1720,.45,.24),screenMat=mat(0x087e9c,.1,.18,true,.96,C.cyan);
  box(3.05,.13,1.38,deskMat,g,0,1.18,.05);
  [[-1.25,-.42],[1.25,-.42],[-1.25,.52],[1.25,.52]].forEach(([lx,lz])=>box(.15,1.16,.15,edgeMat,g,lx,.58,lz));
  box(.78,.94,.66,pcMat,g,-1.02,1.72,-.08);
  const towerGlow=box(.055,.29,.025,screenMat,g,-.63,1.78,.265);towerGlow.material.emissiveIntensity=.7;
  box(.13,.5,.13,edgeMat,g,.05,1.48,-.03);box(.84,.08,.46,edgeMat,g,.05,1.23,.04);
  box(1.4,.84,.11,pcMat,g,.05,1.94,.08);
  const screen=box(1.24,.68,.026,screenMat,g,.05,1.94,.145);
  screen.userData={interactive:true,type:'button',kind:'designTerminal',label:'DESIGN COMPUTER',machineIndex:i,visualButton:false,baseColor:s.color};interactives.push(screen);
  const keyboard=box(1.05,.045,.36,mat(0x152630,.35,.26),g,.25,1.27,.48);keyboard.rotation.x=-.08;
  for(let r=0;r<3;r++)for(let c=0;c<10;c++)box(.067,.018,.054,mat(0x8fb0be,.25,.35),g,-.1+c*.094,1.305-r*.003,.38+r*.078);
  const mouse=cyl(.082,.045,mat(0x8fb0be,.35,.28),g,1.04,1.275,.47,20);mouse.scale.z=1.35;
  const lamp=cyl(.07,.12,mat(C.cyan,.2,.22),g,1.28,1.36,.51);lamp.material.emissive.setHex(C.cyan);lamp.material.emissiveIntensity=.8;
  const label=labelMesh('SENSOR DESIGN WORKSTATION','#53e7ff',2.7,.45,25);label.position.set(0,2.73,.18);g.add(label);
  const hiddenDoor=new THREE.Object3D(),hiddenHandle=new THREE.Object3D(),hiddenTray=new THREE.Object3D(),hiddenTarget=new THREE.Object3D(),hiddenWafer=new THREE.Object3D();hiddenDoor.visible=hiddenHandle.visible=hiddenTray.visible=hiddenTarget.visible=hiddenWafer.visible=false;hiddenDoor.userData.handle=hiddenHandle;g.add(hiddenDoor,hiddenHandle,hiddenTray,hiddenTarget,hiddenWafer);const machine={kind:'design',group:g,lamp,station:s,index:i,world:new THREE.Vector3(x,1.5,s.z),designScreen:screen,door:hiddenDoor,doorHandle:hiddenHandle,wafer:hiddenWafer,tray:hiddenTray,chamberTarget:hiddenTarget,controls:[],buttons:{},body:null};
  machine.wafer.visible=false;g.add(machine.wafer);machines.push(machine);addCollider(x,s.z,3.25,1.8)
};
const v6ButtonEnabled=buttonEnabled;
buttonEnabled=function(d){if(d?.kind==='designTerminal')return state.started;if(d?.kind==='machine'&&d.machineIndex===0)return false;return v6ButtonEnabled(d)};
const v6ButtonHint=buttonHint;
buttonHint=function(d){if(d?.kind==='designTerminal')return'Enter manual sensor design edit mode';if(d?.kind==='machine'&&d.machineIndex===0)return'Use the design computer screen instead of the fabrication controls';return v6ButtonHint(d)};
const v6AdjustControl=adjustControl;
adjustControl=function(d,dir){if(d?.machineIndex===0){toast('Use the design computer for this engineering stage.','warn');return}v6AdjustControl(d,dir)};
const v6UpdateHUDDesign=updateHUD;
updateHUD=function(){
  v6UpdateHUDDesign();
  const body=parallel?.active;
  if(body&&body.nextStage===0&&!body.completed){
    $('objectiveMain').textContent='Open the sensor design workstation';
    $('objectiveSub').textContent='Click the illuminated computer screen. Movement will lock while you complete all three manual design stages.'
  }
};
const v6ActivateFocusedDesign=activateFocused;
activateFocused=function(){
  if(state.focus?.userData?.kind==='designTerminal'){startDesignMode();return}
  v6ActivateFocusedDesign()
};
const v6UpdateMovement=updateMovement;
updateMovement=function(dt){if(designMode.phase!=='idle')return;v6UpdateMovement(dt)};
const v6RaycastFocus=raycastFocus;
raycastFocus=function(){
  if(designMode.phase!=='idle')return;
  v6RaycastFocus();
  if(state.focus?.userData?.type==='control'&&state.focus.userData.machineIndex===0){
    $('actionBtn').disabled=true;$('actionBtn').textContent='USE THE DESIGN COMPUTER SCREEN';
    $('focusTag').textContent='DESIGN CONTROL LOCKED — CLICK THE COMPUTER SCREEN'
  }
};
const v6GetNearest=getNearest;
getNearest=function(){if(designMode.phase!=='idle')return;v6GetNearest()};
const v6Loop=loop;
loop=function(now){updateDesignCamera(now);v6Loop(now)};
const v6Bind=bind;
bind=function(){
  v6Bind();
  $('gainSlider').addEventListener('input',e=>{designMode.gain=Number(e.target.value);updateGainState()});
  $('designCanvas').addEventListener('pointerdown',onDesignPointerDown);
  $('designCanvas').addEventListener('pointermove',onDesignPointerMove);
  $('designCanvas').addEventListener('pointerup',onDesignPointerUp);
  $('designCanvas').addEventListener('click',onDesignClick);
  $('designExit').onclick=closeDesignMode;$('designReset').onclick=resetDesignStage;
  $('designBack').onclick=()=>{if(designMode.step>0){designMode.step--;renderDesignStep()}};
  $('designNext').onclick=()=>{if(designMode.step<2){designMode.step++;renderDesignStep()}else releaseDesign()};
  document.querySelectorAll('.layer-btn').forEach(btn=>btn.onclick=()=>{
    designMode.layer=btn.dataset.layer;document.querySelectorAll('.layer-btn').forEach(b=>b.classList.toggle('active',b===btn));
    if(designMode.layoutDraft.length){const p=designMode.layoutDraft.at(-1);designMode.layoutDraft.push({...p,layer:designMode.layer})}
    drawDesignStage()
  });
  $('undoRoute').onclick=()=>{if(designMode.layoutDraft.length>1)designMode.layoutDraft.pop();drawDesignStage()};
  $('clearRoute').onclick=()=>{designMode.layoutActive=null;designMode.layoutDraft=[];drawDesignStage()};
  addEventListener('resize',resizeDesignCanvas);
  addEventListener('keydown',e=>{if(designMode.phase==='active'&&e.code==='Escape'){e.preventDefault();closeDesignMode()}},true)
};
const v7NewRunDesign=newRun;
newRun=function(){
  v7NewRunDesign();
  designMode.step=0;designMode.gain=1;designMode.gainComplete=false;designMode.schematicComplete=false;designMode.layoutComplete=false;
  designMode.schematicDrag=null;designMode.schematicLinks.clear();designMode.layer='M1';designMode.layoutActive=null;designMode.layoutRoutes=[];designMode.layoutDraft=[];designMode.releasedBodies.clear();
  if($('gainSlider'))$('gainSlider').value='1';
  document.querySelectorAll('.layer-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.layer==='M1'));
  if(designMode.phase!=='idle'){designMode.phase='idle';$('designTerminal').className='';document.body.classList.remove('design-editing')}
};

// V7: manual sensor-design workstation with camera focus and three engineering stages.
const designMode={
  phase:'idle',step:0,start:0,duration:1250,
  fromPos:new THREE.Vector3(),toPos:new THREE.Vector3(),returnPos:new THREE.Vector3(),
  fromYaw:0,toYaw:0,returnYaw:0,fromPitch:0,toPitch:0,returnPitch:0,
  gain:0,intercept:0,gainComplete:false,regression:null,regressionAttempts:0,regressionBest:null,
  schematicComplete:false,schematicSubmitted:false,schematicScore:0,layoutComplete:false,
  schematicDrag:null,schematicLinks:new Set(),circuit:null,
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
  $('gainControls').hidden=designMode.step!==0;$('schematicTools').hidden=designMode.step!==1;$('layoutTools').hidden=designMode.step!==2;
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
    $('designInstructions').textContent='Route IN1, IN2 and IN3 to the matching output pads. Click an input to begin, click grid points to add orthogonal metal, switch M1/M2 to place a via, then click the matching output.';
    $('designCriteria').innerHTML='<b>Release criterion</b><br>Complete all three nets. Every route must use both metal layers and avoid same-layer shorts.';
    $('designNext').textContent='RELEASE DESIGN';
    updateLayoutState()
  }
  drawDesignStage()
}
function createRegressionChallenge(){const gm=-3.25+Math.random()*6.5,gc=-5+Math.random()*10,points=[];for(let i=0;i<13;i++){const x=-5+i*10/12;points.push({x,y:gm*x+gc+(Math.random()-.5)*1.5})}const ax=points.reduce((a,p)=>a+p.x,0)/points.length,ay=points.reduce((a,p)=>a+p.y,0)/points.length,den=points.reduce((a,p)=>a+(p.x-ax)**2,0)||1,m=points.reduce((a,p)=>a+(p.x-ax)*(p.y-ay),0)/den,c=ay-m*ax,sse=points.reduce((a,p)=>a+(p.y-(m*p.x+c))**2,0);designMode.regression={points,optimum:{m,c,sse}};designMode.gain=0;designMode.intercept=0;designMode.regressionAttempts=0;designMode.regressionBest=null;designMode.gainComplete=false;$('gainSlider').value='0';$('interceptSlider').value='0'}
function regressionScore(){const r=designMode.regression,u=r.points.reduce((a,p)=>a+(p.y-(designMode.gain*p.x+designMode.intercept))**2,0),scale=Math.max(1,r.points.reduce((a,p)=>a+p.y*p.y,0)),raw=100*Math.exp(-8*Math.max(0,u-r.optimum.sse)/scale),penalty=Math.max(0,designMode.regressionAttempts-1)*7;return{score:clamp(raw-penalty,0,100),penalty}}
function submitRegression(){designMode.regressionAttempts++;const q=regressionScore();if(!designMode.regressionBest||q.score>designMode.regressionBest.score)designMode.regressionBest={...q,m:designMode.gain,c:designMode.intercept};designMode.gainComplete=true;$('designNext').disabled=false;$('designLiveLabel').textContent='BEST SUBMITTED SCORE';$('designLiveValue').textContent=designMode.regressionBest.score.toFixed(1)+'%';setDesignMessage(`Attempt ${designMode.regressionAttempts}: ${q.score.toFixed(1)}%. ${q.penalty?q.penalty+' point repeat penalty.':'First submission.'}`,'good')}
function updateGainState(){if(!designMode.regression)createRegressionChallenge();$('gainValue').textContent=designMode.gain.toFixed(2);$('interceptValue').textContent=designMode.intercept.toFixed(2);$('designNext').disabled=!designMode.gainComplete;if(!designMode.gainComplete){$('designLiveLabel').textContent='FIT QUALITY';$('designLiveValue').textContent='HIDDEN';setDesignMessage('Adjust both coefficients and submit when ready.')}drawDesignStage()}
const circuitPool=[{id:'inv',name:'CMOS inverter buffer',devices:[['P1','p',.34,.32],['N1','n',.34,.68],['P2','p',.68,.32],['N2','n',.68,.68]],nodes:[['IN',.08,.5],['P1G',.25,.32],['N1G',.25,.68],['X1P',.34,.43],['X1N',.34,.57],['P2G',.59,.32],['N2G',.59,.68],['OUTP',.68,.43],['OUTN',.68,.57],['OUT',.92,.5],['VDD',.5,.08],['P1S',.34,.21],['P2S',.68,.21],['GND',.5,.92],['N1S',.34,.79],['N2S',.68,.79]],edges:[['IN','P1G'],['IN','N1G'],['X1P','X1N'],['X1P','P2G'],['X1P','N2G'],['OUTP','OUTN'],['OUTP','OUT'],['VDD','P1S'],['VDD','P2S'],['GND','N1S'],['GND','N2S']]},{id:'nand',name:'Two-input CMOS NAND gate',devices:[['P1','p',.34,.27],['P2','p',.66,.27],['N1','n',.5,.58],['N2','n',.5,.78]],nodes:[['A',.08,.38],['P1G',.25,.27],['N1G',.41,.58],['B',.08,.68],['P2G',.57,.27],['N2G',.41,.78],['VDD',.5,.07],['P1S',.34,.16],['P2S',.66,.16],['P1D',.34,.38],['P2D',.66,.38],['N1D',.5,.47],['Y',.91,.43],['N1S',.5,.67],['N2D',.5,.69],['N2S',.5,.88],['GND',.5,.95]],edges:[['A','P1G'],['A','N1G'],['B','P2G'],['B','N2G'],['VDD','P1S'],['VDD','P2S'],['P1D','P2D'],['P1D','N1D'],['P1D','Y'],['N1S','N2D'],['N2S','GND']]},{id:'amp',name:'Five-transistor differential amplifier',devices:[['M3','p',.36,.24],['M4','p',.64,.24],['M1','n',.36,.57],['M2','n',.64,.57],['M5','n',.5,.81]],nodes:[['VDD',.5,.06],['M3S',.36,.13],['M4S',.64,.13],['M3G',.27,.24],['M3D',.36,.35],['M4G',.55,.24],['M4D',.64,.35],['VINP',.07,.57],['M1G',.27,.57],['VINN',.93,.57],['M2G',.73,.57],['M1D',.36,.46],['M2D',.64,.46],['M1S',.36,.68],['M2S',.64,.68],['M5D',.5,.72],['VBIAS',.15,.81],['M5G',.41,.81],['M5S',.5,.9],['GND',.5,.96],['VOUT',.91,.4]],edges:[['VDD','M3S'],['VDD','M4S'],['M3G','M3D'],['M3G','M4G'],['M3D','M1D'],['M4D','M2D'],['M4D','VOUT'],['VINP','M1G'],['VINN','M2G'],['M1S','M2S'],['M1S','M5D'],['VBIAS','M5G'],['M5S','GND']]}];
function edgeKey(a,b){return[a,b].sort().join('|')}
function ensureCircuitChallenge(force=false){if(designMode.circuit&&!force)return;const t=circuitPool[Math.floor(Math.random()*circuitPool.length)],pool=t.edges.filter(e=>!e.includes('VDD')&&!e.includes('GND')),removed=[];while(removed.length<2)removed.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);designMode.circuit={...t,removed:new Set(removed.map(e=>edgeKey(...e)))};designMode.schematicLinks.clear();designMode.schematicSubmitted=false;designMode.schematicComplete=false}
function schematicGeometry(w,h){ensureCircuitChallenge();return designMode.circuit.nodes.map(([id,x,y])=>({id,label:id,px:x*w,py:y*h}))}
function submitSchematic(){const req=designMode.circuit.removed,u=designMode.schematicLinks,opens=[...req].filter(k=>!u.has(k)).length,shorts=[...u].filter(k=>!req.has(k)).length,correct=[...u].filter(k=>req.has(k)).length,score=clamp(100-opens*35-shorts*25,0,100);designMode.schematicSubmitted=true;designMode.schematicScore=score;designMode.schematicComplete=!opens&&!shorts;$('designNext').disabled=!designMode.schematicComplete;$('designLiveLabel').textContent='CIRCUIT SCORE';$('designLiveValue').textContent=score.toFixed(0)+'%';setDesignMessage(`${correct} correct, ${opens} open, ${shorts} short.` ,designMode.schematicComplete?'good':score>=50?'warn':'bad');drawDesignStage()}
function updateSchematicState(){ensureCircuitChallenge();$('designNext').disabled=!designMode.schematicComplete;if(!designMode.schematicSubmitted){$('designLiveLabel').textContent='ASSESSMENT';$('designLiveValue').textContent='NOT SUBMITTED';setDesignMessage('Repair both removed connections, then submit.')}}
function layoutGeometry(w,h){
    const margin=Math.max(45,w*.065),innerH=h-2*margin;
    return{margin,inputs:[0,1,2].map(i=>({net:`N${i+1}`,label:`IN${i+1}`,x:margin+18,y:margin+innerH*(.22+i*.28)})),outputs:[0,1,2].map(i=>({net:`N${i+1}`,label:`OUT${i+1}`,x:w-margin-18,y:margin+innerH*(.22+i*.28)})),keepouts:[{x:w*.31,y:margin,w:w*.14,h:h*.29},{x:w*.55,y:h-margin-h*.31,w:w*.14,h:h*.31}]}
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
  const canvas=$('designCanvas'),w=canvas.width,h=canvas.height,g=layoutGeometry(w,h);
  if(point.x<g.margin||point.x>w-g.margin||point.y<g.margin||point.y>h-g.margin)return true;return g.keepouts.some(r=>point.x>r.x&&point.x<r.x+r.w&&point.y>r.y&&point.y<r.y+r.h)
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
function drawGain(ctx,w,h){if(!designMode.regression)createRegressionChallenge();const r=designMode.regression,p={l:w*.1,r:w*.05,t:h*.09,b:h*.13},pw=w-p.l-p.r,ph=h-p.t-p.b,ys=r.points.flatMap(q=>[q.y,designMode.gain*q.x+designMode.intercept]),ya=Math.max(8,...ys.map(Math.abs))*1.12,X=x=>p.l+(x+5)/10*pw,Y=y=>p.t+(ya-y)/(2*ya)*ph;ctx.fillStyle='#02090e';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#183544';for(let i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(p.l+pw*i/10,p.t);ctx.lineTo(p.l+pw*i/10,h-p.b);ctx.stroke()}for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(p.l,p.t+ph*i/8);ctx.lineTo(w-p.r,p.t+ph*i/8);ctx.stroke()}ctx.strokeStyle='#789aaa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.l,Y(0));ctx.lineTo(w-p.r,Y(0));ctx.moveTo(X(0),p.t);ctx.lineTo(X(0),h-p.b);ctx.stroke();ctx.strokeStyle='#ff9d3c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(X(-5),Y(-5*designMode.gain+designMode.intercept));ctx.lineTo(X(5),Y(5*designMode.gain+designMode.intercept));ctx.stroke();ctx.fillStyle='#53e7ff';for(const q of r.points){ctx.beginPath();ctx.arc(X(q.x),Y(q.y),6,0,7);ctx.fill()}ctx.fillStyle='#9ab5c1';ctx.font='16px monospace';ctx.fillText('● measured samples',p.l+10,p.t+22);ctx.fillStyle='#ff9d3c';ctx.fillText('— candidate y = mx + c',p.l+10,p.t+46)}
function drawMos(ctx,d,w,h){const[id,t,xn,yn]=d,x=xn*w,y=yn*h,c=t==='p'?'#f59ac3':'#f2ad72';ctx.strokeStyle=c;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-18,y-28);ctx.lineTo(x-18,y+28);ctx.moveTo(x+5,y-24);ctx.lineTo(x+5,y+24);ctx.moveTo(x+5,y-24);ctx.lineTo(x+5,y-46);ctx.moveTo(x+5,y+24);ctx.lineTo(x+5,y+46);ctx.moveTo(x-40,y);ctx.lineTo(x-18,y);ctx.stroke();if(t==='p'){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-12,y,6,0,7);ctx.fill();ctx.stroke()}ctx.fillStyle=c;ctx.font='700 14px monospace';ctx.fillText(id+' '+(t==='p'?'PMOS':'NMOS'),x+14,y)}
function drawSchematic(ctx,w,h){ensureCircuitChallenge();const c=designMode.circuit,n=schematicGeometry(w,h),by=id=>n.find(x=>x.id===id);ctx.fillStyle='#f4f5f1';ctx.fillRect(0,0,w,h);c.devices.forEach(d=>drawMos(ctx,d,w,h));for(const[a,b]of c.edges){if(c.removed.has(edgeKey(a,b)))continue;const p=by(a),q=by(b),m=(p.px+q.px)/2;ctx.strokeStyle='#163c74';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(m,p.py);ctx.lineTo(m,q.py);ctx.lineTo(q.px,q.py);ctx.stroke()}for(const k of designMode.schematicLinks){const[a,b]=k.split('|'),p=by(a),q=by(b);ctx.strokeStyle=designMode.schematicSubmitted?(c.removed.has(k)?'#43c971':'#ff5f73'):'#f08a31';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.bezierCurveTo((p.px+q.px)/2,p.py,(p.px+q.px)/2,q.py,q.px,q.py);ctx.stroke()}const ends=new Set([...c.removed].flatMap(k=>k.split('|')));for(const p of n){ctx.fillStyle=ends.has(p.id)?'#fff4a8':'#dce8ec';ctx.strokeStyle=ends.has(p.id)?'#f08a31':'#446273';ctx.lineWidth=ends.has(p.id)?4:2;ctx.beginPath();ctx.arc(p.px,p.py,ends.has(p.id)?9:6,0,7);ctx.fill();ctx.stroke();if(['IN','OUT','Y','A','B','VDD','GND','VINP','VINN','VOUT','VBIAS'].includes(p.id)){ctx.fillStyle='#17232a';ctx.fillText(p.id,p.px+10,p.py-10)}}if(designMode.schematicDrag){const p=by(designMode.schematicDrag.from);ctx.strokeStyle='#f0c34d';ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(designMode.schematicDrag.x,designMode.schematicDrag.y);ctx.stroke()}ctx.fillStyle='#17232a';ctx.font='900 18px system-ui';ctx.fillText(c.name.toUpperCase(),20,28)}
function drawLayout(ctx,w,h){
  ctx.fillStyle='#061017';ctx.fillRect(0,0,w,h);const g=layoutGeometry(w,h);
  ctx.strokeStyle='#17313e';ctx.lineWidth=1;
  const grid=Math.max(22,Math.round(w/28));for(let x=0;x<w;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  ctx.fillStyle='rgba(120,38,45,.3)';ctx.fillRect(0,0,w,g.margin);ctx.fillRect(0,h-g.margin,w,g.margin);ctx.fillRect(0,g.margin,g.margin,h-2*g.margin);ctx.fillRect(w-g.margin,g.margin,g.margin,h-2*g.margin);ctx.strokeStyle='#ff6579';ctx.lineWidth=4;ctx.strokeRect(g.margin,g.margin,w-2*g.margin,h-2*g.margin);ctx.fillStyle='#ff9aa8';ctx.font=`${Math.max(11,w*.014)}px monospace`;ctx.fillText('OUTER NO-GO BOUNDARY',g.margin+10,g.margin-12);g.keepouts.forEach(r=>{ctx.fillStyle='#241a1b';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle='#81524c';ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#b8837a';ctx.font=`${Math.max(11,w*.014)}px monospace`;ctx.fillText('KEEP OUT',r.x+10,r.y+20)});
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
function onDesignPointerUp(e){if(designMode.step!==1||!designMode.schematicDrag)return;const p=designPointer(e),nodes=schematicGeometry($('designCanvas').width,$('designCanvas').height),from=nodes.find(n=>n.id===designMode.schematicDrag.from),to=nearestDesignNode(p,nodes);if(to&&to.id!==from.id){const k=edgeKey(from.id,to.id);designMode.schematicLinks.has(k)?designMode.schematicLinks.delete(k):designMode.schematicLinks.add(k);designMode.schematicSubmitted=false;designMode.schematicComplete=false}designMode.schematicDrag=null;updateSchematicState();drawDesignStage()}
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
  if(designMode.step===0){createRegressionChallenge();updateGainState()}
  if(designMode.step===1){ensureCircuitChallenge(true);updateSchematicState();drawDesignStage()}
  if(designMode.step===2){designMode.layoutActive=null;designMode.layoutRoutes=[];designMode.layoutDraft=[];updateLayoutState();drawDesignStage()}
}
function releaseDesign(){
  const body=parallel?.active;
  if(!body){setDesignMessage('Dispense a wafer before releasing a fabrication design.','warn');return}
  if(body.nextStage!==0){setDesignMessage('The active wafer already has a released sensor design.','warn');return}
  body.pattern='Logic grid';body.records[0]={score:100,metric:24,ratio:1,processSeconds:24,values:{regressionScore:designMode.regressionBest?.score||0,gradient:designMode.regressionBest?.m??designMode.gain,intercept:designMode.regressionBest?.c??designMode.intercept,circuit:designMode.circuit?.id,circuitScore:designMode.schematicScore,layoutNets:3,metalLayers:2}};
  body.nextStage=1;body.startedAt=body.startedAt||performance.now();designMode.releasedBodies.add(body.id);
  status[0].state='complete';status[0].metric=24;status[0].score=100;status[0].deviations=[];setLamp(0);
  syncActiveWafer(body);state.current=1;toast(`${body.lotId} sensor design released. Proceed to the oxidation furnace.`);updateAll();closeDesignMode()
}

// V8.7 isolated 3D schematic and layout spaces.
const designWorld={root:null,board:null,texture:null,active:false,stage:0,returnPos:new THREE.Vector3(),returnYaw:0,returnPitch:0,dragging:false,xrDragging:new Set(),w:12,h:7.2};
function ensureDesignWorld(){
  if(designWorld.root)return;
  const root=new THREE.Group();root.position.set(0,0,165);root.visible=false;scene.add(root);designWorld.root=root;
  const floor=box(24,.12,24,mat(0x0c1b24,.05,.58),root,0,-.08,0),wall=mat(0x142c38,.08,.56);
  box(24,9,.2,wall,root,0,4.5,-9);box(24,9,.2,wall,root,0,4.5,11);box(.2,9,20,wall,root,-12,4.5,1);box(.2,9,20,wall,root,12,4.5,1);
  box(13,8,.22,mat(0x315669,.5,.22),root,0,4.3,-8.72);
  designWorld.texture=new THREE.CanvasTexture($('designCanvas'));designWorld.texture.colorSpace=THREE.SRGBColorSpace;designWorld.texture.minFilter=THREE.LinearFilter;
  designWorld.board=mesh(new THREE.PlaneGeometry(designWorld.w,designWorld.h),new THREE.MeshBasicMaterial({map:designWorld.texture,toneMapped:false,side:THREE.DoubleSide}),root,0,4.3,-8.58);designWorld.board.userData.designBoard=true;
  const head=labelMesh('INTERACTIVE DESIGN SPACE','#53e7ff',6,.5,28);head.position.set(0,8.65,-8.54);root.add(head);
  const help=labelMesh('DRAW: CLICK/TRIGGER  •  ENTER: SUBMIT/NEXT  •  C: CLEAR  •  ESC: EXIT','#e9f7fb',8,.3,20);help.position.set(0,.42,-8.54);root.add(help);
  for(let x=-9;x<=9;x+=3){const light=new THREE.PointLight(x%6?0x53e7ff:0xb16cff,.75,8,2);light.position.set(x,6,1);root.add(light)}
}
function syncDesignBoard(){if(!designWorld.active)return;drawDesignStage();designWorld.texture.needsUpdate=true}
function enterDesignWorld(stage){
  ensureDesignWorld();if(!designWorld.active){designWorld.returnPos.copy(player.position);designWorld.returnYaw=yaw;designWorld.returnPitch=pitch}
  designWorld.active=true;designWorld.stage=stage;designWorld.root.visible=true;designMode.phase='world';$('designTerminal').className='';$('designTerminal').setAttribute('aria-hidden','true');document.body.classList.remove('design-editing');
  player.position.set(0,renderer.xr.isPresenting?.86:2.58,172);yaw=0;pitch=-.03;player.rotation.y=yaw;camera.rotation.x=pitch;Object.keys(keys).forEach(k=>keys[k]=false);if(!renderer.xr.isPresenting)renderer.domElement.requestPointerLock?.();syncDesignBoard();toast(stage===1?'Circuit schematic space: draw missing wires on the fixed board.':'Layout space: route M1/M2 on the fixed board inside the no-go boundary.')
}
function leaveDesignWorld(returnOverlay=true){
  if(!designWorld.active)return;designWorld.active=false;designWorld.root.visible=false;designWorld.dragging=false;designWorld.xrDragging.clear();player.position.copy(designWorld.returnPos);yaw=designWorld.returnYaw;pitch=designWorld.returnPitch;player.rotation.y=yaw;camera.rotation.x=pitch;
  if(returnOverlay){designMode.phase='active';$('designTerminal').className='active';$('designTerminal').setAttribute('aria-hidden','false');document.body.classList.add('design-editing');renderDesignStep();setTimeout(resizeDesignCanvas,0)}else designMode.phase='idle'
}
function boardPointFromRay(origin,direction){
  if(!designWorld.active)return null;designWorld.board.updateMatrixWorld(true);const normal=new THREE.Vector3(0,0,1).applyQuaternion(designWorld.board.getWorldQuaternion(new THREE.Quaternion())),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,designWorld.board.getWorldPosition(new THREE.Vector3())),hit=new THREE.Vector3();if(!new THREE.Ray(origin,direction).intersectPlane(plane,hit))return null;const q=designWorld.board.worldToLocal(hit.clone());if(Math.abs(q.x)>designWorld.w/2||Math.abs(q.y)>designWorld.h/2)return null;return{x:(q.x/designWorld.w+.5)*$('designCanvas').width,y:(.5-q.y/designWorld.h)*$('designCanvas').height,world:hit}
}
function desktopDesignPoint(){raycaster.setFromCamera({x:0,y:0},camera);return boardPointFromRay(raycaster.ray.origin,raycaster.ray.direction)}
function xrDesignPoint(c){const m=new THREE.Matrix4().identity().extractRotation(c.matrixWorld),o=new THREE.Vector3().setFromMatrixPosition(c.matrixWorld),d=new THREE.Vector3(0,0,-1).applyMatrix4(m).normalize();return boardPointFromRay(o,d)}
function fakeEvent(p){const c=$('designCanvas'),r=c.getBoundingClientRect();return{clientX:r.left+p.x/c.width*r.width,clientY:r.top+p.y/c.height*r.height,pointerId:1}}
function designBoardAction(action,p){if(!p)return;const e=fakeEvent(p);if(designWorld.stage===1){if(action==='down')onDesignPointerDown(e);else if(action==='move')onDesignPointerMove(e);else onDesignPointerUp(e)}else if(action==='down')onDesignClick(e);syncDesignBoard()}
function designDesktopDown(e){if(!designWorld.active||e.button!==0)return;e.stopImmediatePropagation();if(document.pointerLockElement!==renderer.domElement){renderer.domElement.requestPointerLock?.();return}const p=desktopDesignPoint();if(p){designWorld.dragging=true;designBoardAction('down',p)}}
function designDesktopUp(){if(designWorld.active&&designWorld.dragging){designBoardAction('up',desktopDesignPoint());designWorld.dragging=false}}
function designXRStart(c){if(!designWorld.active)return false;const p=xrDesignPoint(c);if(!p)return false;designWorld.xrDragging.add(handKey(c));designBoardAction('down',p);pulseXR(.35,35);return true}
function designXREnd(c){if(!designWorld.active||!designWorld.xrDragging.has(handKey(c)))return false;designBoardAction('up',xrDesignPoint(c));designWorld.xrDragging.delete(handKey(c));return true}
function updateDesignInteraction(){if(!designWorld.active)return;if(designWorld.dragging)designBoardAction('move',desktopDesignPoint());for(const c of [xrController0,xrController1])if(designWorld.xrDragging.has(handKey(c)))designBoardAction('move',xrDesignPoint(c));syncDesignBoard()}
function updateDesignLocomotion(dt){
  if(renderer.xr.isPresenting||!designWorld.active)return;let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),n=Math.hypot(f,r)||1;f/=n;r/=n;const crouch=keys.ShiftLeft||keys.ShiftRight,sprint=(keys.ControlLeft||keys.ControlRight)&&!crouch,speed=crouch?1.2:sprint?5.2:2.75;player.position.x=clamp(player.position.x+(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed*dt,-10.8,10.8);player.position.z=clamp(player.position.z+(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed*dt,157,175);player.position.y=lerp(player.position.y,crouch?1.29:2.58,1-Math.exp(-dt*10));player.rotation.y=yaw;camera.rotation.x=pitch
}
function updateDesignXRLocomotion(dt,now){
  if(!designWorld.active)return false;const session=renderer.xr.getSession();if(!session)return true;updateXRVertical(dt);const src=[...session.inputSources],left=src.find(x=>x.handedness==='left'),right=src.find(x=>x.handedness==='right'),lg=left?.gamepad,rg=right?.gamepad;if(lg&&lg.axes.length>=4){let sx=Math.abs(lg.axes[2])>.15?lg.axes[2]:0,sy=Math.abs(lg.axes[3])>.15?lg.axes[3]:0;camera.getWorldDirection(xrHeadDirection);xrHeadDirection.y=0;xrHeadDirection.normalize();const side=new THREE.Vector3().crossVectors(xrHeadDirection,new THREE.Vector3(0,1,0)).normalize(),sp=rg?.buttons?.[1]?.pressed?4.9:2.45;player.position.x=clamp(player.position.x+(side.x*sx+xrHeadDirection.x*-sy)*sp*dt,-10.8,10.8);player.position.z=clamp(player.position.z+(side.z*sx+xrHeadDirection.z*-sy)*sp*dt,157,175)}if(rg&&rg.axes.length>=4){const ax=rg.axes[2]||0;if(Math.abs(ax)>.75&&!xrTurnLatch){player.rotation.y-=Math.sign(ax)*Math.PI/6;xrTurnLatch=true}else if(Math.abs(ax)<.3)xrTurnLatch=false}updateXRSpatial(now);return true
}
function designWorldCommand(code){
  if(!designWorld.active)return false;
  if(code==='Escape'){leaveDesignWorld(true);return true}
  if(code==='KeyC'){if(designWorld.stage===1){designMode.schematicLinks.clear();designMode.schematicSubmitted=false;designMode.schematicComplete=false;updateSchematicState()}else{designMode.layoutActive=null;designMode.layoutRoutes=[];designMode.layoutDraft=[];updateLayoutState()}syncDesignBoard();return true}
  if(code==='Enter'||code==='KeyE'){
    if(designWorld.stage===1){if(!designMode.schematicComplete){submitSchematic();syncDesignBoard();return true}designMode.step=2;renderDesignStep();enterDesignWorld(2);return true}
    if(designMode.layoutComplete){leaveDesignWorld(false);releaseDesign()}else setDesignMessage('Complete all three two-layer routes before release.','warn');syncDesignBoard();return true
  }
  return false
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
updateMovement=function(dt){if(designWorld.active){updateDesignLocomotion(dt);return}if(designMode.phase!=='idle')return;v6UpdateMovement(dt)};
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
loop=function(now){updateDesignCamera(now);updateDesignInteraction();v6Loop(now)};
const v6Bind=bind;
bind=function(){
  v6Bind();
  $('gainSlider').addEventListener('input',e=>{designMode.gain=Number(e.target.value);updateGainState()});$('interceptSlider').addEventListener('input',e=>{designMode.intercept=Number(e.target.value);updateGainState()});$('regressionSubmit').onclick=submitRegression;$('schematicSubmit').onclick=submitSchematic;$('clearSchematic').onclick=()=>{designMode.schematicLinks.clear();designMode.schematicSubmitted=false;designMode.schematicComplete=false;updateSchematicState();drawDesignStage()};
  $('designCanvas').addEventListener('pointerdown',onDesignPointerDown);
  $('designCanvas').addEventListener('pointermove',onDesignPointerMove);
  $('designCanvas').addEventListener('pointerup',onDesignPointerUp);
  $('designCanvas').addEventListener('click',onDesignClick);
  $('designExit').onclick=()=>{if(designWorld.active)leaveDesignWorld(false);closeDesignMode()};$('designReset').onclick=resetDesignStage;
  $('designBack').onclick=()=>{if(designWorld.active)leaveDesignWorld(false);if(designMode.step>0){designMode.step--;renderDesignStep();if(designMode.step>0)enterDesignWorld(designMode.step)}};
  $('designNext').onclick=()=>{if(designMode.step===0){designMode.step=1;renderDesignStep();enterDesignWorld(1)}else if(designMode.step===1){leaveDesignWorld(false);designMode.step=2;renderDesignStep();enterDesignWorld(2)}else{if(designWorld.active)leaveDesignWorld(false);releaseDesign()}};
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
const v7XRMove=updateXRMovement;updateXRMovement=function(dt,now){if(updateDesignXRLocomotion(dt,now))return;v7XRMove(dt,now)};const v7XRStart=onXRTriggerStart,v7XREnd=onXRTriggerEnd;onXRTriggerStart=function(c){if(designXRStart(c))return;v7XRStart(c)};onXRTriggerEnd=function(c){if(designXREnd(c))return;v7XREnd(c)};  
  const v7NewRunDesign=newRun;
newRun=function(){
  v7NewRunDesign();
  designMode.step=0;designMode.gain=0;designMode.intercept=0;designMode.gainComplete=false;designMode.regression=null;designMode.regressionAttempts=0;designMode.regressionBest=null;designMode.schematicComplete=false;designMode.schematicSubmitted=false;designMode.schematicScore=0;designMode.circuit=null;designMode.layoutComplete=false;
  designMode.schematicDrag=null;designMode.schematicLinks.clear();designMode.layer='M1';designMode.layoutActive=null;designMode.layoutRoutes=[];designMode.layoutDraft=[];designMode.releasedBodies.clear();
  if($('gainSlider'))$('gainSlider').value='0';if($('interceptSlider'))$('interceptSlider').value='0';
  document.querySelectorAll('.layer-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.layer==='M1'));
  if(designWorld.active)leaveDesignWorld(false);if(designMode.phase!=='idle'){designMode.phase='idle';$('designTerminal').className='';document.body.classList.remove('design-editing')}
};

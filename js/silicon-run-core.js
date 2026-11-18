'use strict';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;        
const C={cyan:0x53e7ff,blue:0x177ddc,controlBlue:0x165b9c,white:0xe9f7fb,dark:0x07121d,orange:0xff9d3c,amber:0xffcf56,violet:0xb16cff,green:0x67f6a3,red:0xff5f73,magenta:0xff4fe1,startGreen:0x18df5c,startGreenIdle:0x11592b,stopRed:0xff2e43,stopRedIdle:0x6b1822,guideBright:0xb8ff1a,guideTurn:0xffd829};
const DOOR_MAGNET_ANGLE=5/90;
const num=(key,label,min,max,step,target,tol,unit,initial,style='dial',weight=1)=>({kind:'number',key,label,min,max,step,target,tol,unit,initial,style,weight});
const choice=(key,label,options,target,initial,weight=1)=>({kind:'choice',key,label,options,target,initial,style:'dial',weight});
const stations=[
{name:'Sensor Design Terminal',short:'CCD layout release',zone:'DESIGN',color:C.cyan,side:-1,z:7,type:'design',desc:'Validate the buried-channel CCD pixel pitch, transfer register, and reticle layout.',note:'Match pixel array width, row-transfer driver geometry and CDS ADC crossover before starting wafer fab.',targetSeconds:24,metric:{label:'Design verification',unit:'s',target:24,tol:2,calc:(v,t)=>t},controls:[choice('pattern','Device pattern',['Logic grid','Memory array','Sensor rings'],'Logic grid','Sensor rings',1),num('pixels','Pixel array width',512,1536,128,1024,64,'px',768,'slider',1.3),num('driver','Row-driver width',8,22,1,14,1,'µm',11,'dial',1),num('adc','ADC crossover',55,92,1,74,3,'% FS',84,'slider',1.2)]},
{name:'Oxidation Furnace',short:'Grow gate/mask oxide',zone:'CLEANROOM A',color:0x31aaff,side:1,z:3,type:'deposition',desc:'Thermally grow a SiO₂ gate dielectric and implant-masking layer on P-type silicon.',note:'Dry thermal oxidation grows the insulator beneath CCD transfer gates and masks non-channel silicon.',targetSeconds:30,metric:{label:'Oxide thickness',unit:'nm',target:120,tol:8,calc:(v,t)=>v.rate*t},controls:[num('rate','Growth rate',2,7,.1,4,.5,'nm/s',5.6,'dial',1.3),num('temp','Furnace temperature',850,1150,5,1000,20,'°C',1070,'slider',1.2),num('flow','O₂ flow',12,36,1,24,3,'sccm',30,'dial',1)]},
{name:'Photoresist Spin Coater',short:'Coat I-line resist',zone:'CLEANROOM A',color:0x42e8ff,side:-1,z:-1,type:'spinner',desc:'Spin-coat positive I-line photoresist across the oxidised CCD wafer.',note:'Chuck speed, dispense flow and dispense volume combine proportionally to drive film thickness and uniformity.',targetSeconds:30,metric:{label:'Resist coating',unit:'µm',target:1.4,tol:.12,calc:(v,t)=>{const pFlow=(v.flow||1.8)/1.8,pRpm=3000/(v.rpm||3000),pVol=(v.volume||3)/3,skew=1+.45*Math.abs(Math.log(Math.max(.2,pFlow*pRpm)));return 1.4*(t/30)*Math.pow(pFlow,.65)*Math.pow(pRpm,.55)*Math.pow(pVol,.35)*skew}},controls:[num('rpm','Chuck speed',1800,4200,50,3000,200,'rpm',2450,'dial',1.2),num('flow','Resist flow',.8,3,.1,1.8,.2,'mL/s',2.5,'slider',1.1),num('volume','Dispense volume',2,5,.1,3,.3,'mL',4.1,'dial',1)]},
{name:'Soft-Bake Furnace',short:'Soft-bake resist',zone:'CLEANROOM A',color:C.orange,side:1,z:-5,type:'furnace',desc:'Drive casting solvent out of the spin-coated photoresist before CCD mask exposure.',note:'Under-baking smears edges; over-baking desensitises photo-active compound. Stop cleanly at 100%.',targetSeconds:60,metric:{label:'Solvent removal / soft-bake',unit:'%',target:100,tol:6,calc:(v,t)=>100*(t/60)*Math.exp((v.temp-105)/85)},controls:[num('temp','Bake temperature',80,135,1,105,3,'°C',116,'slider',1.4),num('exhaust','Exhaust flow',8,24,1,16,3,'L/min',11,'dial',1)]},
{name:'Mask Aligner & I-Line Exposure',short:'Expose CCD channels',zone:'CLEANROOM A',color:0x35ffe0,side:-1,z:-9,type:'aligner',desc:'Align the CCD active-channel reticle to the wafer flat and expose under I-line UV.',note:'Overlay accuracy and accumulated 365 nm I-line dose define the buried-channel pixel columns.',targetSeconds:30,metric:{label:'Accumulated UV dose',unit:'mJ/cm²',target:95,tol:5,calc:(v,t)=>v.doseRate*t},controls:[num('overlay','Overlay error',0,3,.1,.8,.3,'µm',1.9,'slider',1.5),num('doseRate','Dose rate',1.8,4.5,.1,3.2,.25,'mJ/cm²/s',2.5,'dial',1.2),choice('line','Exposure source',['365 nm I-line','405 nm H-line','248 nm DUV'],'365 nm I-line','405 nm H-line',1.4)]},
{name:'Developer Wet Bench',short:'Develop channel mask',zone:'CLEANROOM A',color:0x54f49c,side:1,z:-13,type:'wetbench',desc:'Develop exposed photoresist in TMAH 2.38% and DI-rinse to open CCD channel windows.',note:'Correct chemistry and bath agitation clear the exposed active areas without eroding pixel walls.',targetSeconds:45,metric:{label:'Pattern developed',unit:'%',target:100,tol:7,calc:(v,t)=>100*(t/45)*(v.chem==='TMAH 2.38%'?1:v.chem==='KOH 5%'?1.35:.18)*Math.pow(v.rpm/600,.18)},controls:[choice('chem','Developer chemistry',['TMAH 2.38%','KOH 5%','DI water only'],'TMAH 2.38%','KOH 5%',1.5),num('rpm','Rinse agitation',300,900,25,600,100,'rpm',425,'dial',1),num('temp','Bath temperature',18,30,.5,23,.8,'°C',27,'slider',1.2)]},
{name:'Reactive Ion Etcher',short:'Etch oxide windows',zone:'CLEANROOM B',color:C.magenta,side:-1,z:-21,type:'rie',desc:'Anisotropically etch windows in the SiO₂ mask down to active silicon for CCD channel doping.',note:'CF₄ plasma pressure and RF power control anisotropic sidewall profile and oxide etch depth.',targetSeconds:55,metric:{label:'Etched depth',unit:'nm',target:110,tol:8,calc:(v,t)=>2*t*(v.power/180)*Math.pow(35/v.pressure,.3)*Math.pow(v.flow/28,.18)},controls:[num('power','RF power',110,260,5,180,15,'W',225,'dial',1.3),num('pressure','Chamber pressure',18,60,1,35,5,'mTorr',48,'slider',1.1),num('flow','CF₄ flow',18,42,1,28,3,'sccm',35,'dial',1)]},
{name:'Ion Implant Beamline',short:'Implant N buried channel',zone:'CLEANROOM B',color:C.violet,side:1,z:-25,type:'implanter',desc:'Implant N-type phosphorus ions into P-type silicon to create the CCD buried charge channel.',note:'Phosphorus / N-type counter-doping keeps packet electrons below the Si–SiO₂ interface for low CTE loss.',targetSeconds:40,metric:{label:'Implant dosage',unit:'×10¹² ions/cm²',target:12,tol:1,calc:(v,t)=>v.current*t},controls:[choice('dopant','Dopant polarity',['Phosphorus / N-type','Boron / P-type','Arsenic / N-type'],'Phosphorus / N-type','Boron / P-type',1.8),num('current','Beam dose rate',.15,.48,.01,.3,.03,'×10¹²/cm²/s',.4,'dial',1.4),num('energy','Beam energy',20,70,1,40,4,'keV',53,'slider',1.2)]},
{name:'Rapid Thermal Anneal',short:'Activate buried channel',zone:'CLEANROOM B',color:0xffb144,side:-1,z:-29,type:'furnace',desc:'Repair crystal damage and activate the buried-channel phosphorus profile with a rapid spike anneal.',note:'Tight thermal budget repairs Si traps causing dark current while preventing excess N-channel diffusion.',targetSeconds:30,metric:{label:'Dopant activation',unit:'%',target:100,tol:7,calc:(v,t)=>100*(t/30)*Math.exp((v.temp-980)/190)},controls:[num('temp','Peak temperature',880,1080,5,980,15,'°C',1035,'slider',1.5),num('ramp','Ramp rate',35,90,1,65,7,'°C/s',48,'dial',1.1),choice('ambient','Process ambient',['N₂ inert','O₂ oxidising','Forming gas'],'N₂ inert','O₂ oxidising',1.2)]},
{name:'Metal Film Depositor',short:'Deposit Al clock & shield',zone:'CLEANROOM B',color:0x6ab8ff,side:1,z:-33,type:'metal',desc:'Deposit high-purity Aluminium interconnects for CCD multi-phase clock buses and optical shielding.',note:'Target metal, chamber vacuum and deposition rate control clock line conductivity and step coverage.',targetSeconds:200,metric:{label:'Metal film thickness',unit:'nm',target:500,tol:25,calc:(v,t)=>v.rate*t},controls:[choice('metal','Target material',['Aluminium','Copper','Gold'],'Aluminium','Copper',1.4),num('rate','Deposition rate',1,4.5,.1,2.5,.3,'nm/s',3.4,'dial',1.3),num('vacuum','Chamber vacuum',1,9,.5,5,1,'×10⁻⁶ mbar',8,'slider',1.1)]},
{name:'Microscope & Probe Test',short:'Probe CCD charge transfer',zone:'TEST',color:C.green,side:-1,z:-37,type:'probe',desc:'Land Kelvin probes on the CCD clock and output amplifier pads to verify charge transfer.',note:'Align probes and set nominal 3.3 V output amplifier bias to capture full CCD sample statistics.',targetSeconds:10,metric:{label:'Electrical samples',unit:'samples',target:100,tol:8,calc:(v,t)=>10*t},controls:[num('probeX','Probe X position',20,80,1,62,4,'%',49,'slider',1.4),num('probeY','Probe Y position',20,80,1,38,4,'%',54,'slider',1.4),num('bias','Sensor bias',2.5,4,.05,3.3,.1,'V',3.65,'dial',1.2)]}
];
const state={started:false,username:'',lotId:'',carrying:false,current:0,completed:false,awaitingDelivery:false,runStart:0,elapsed:0,stamina:1,crouching:false,sprinting:false,nearest:null,focus:null,cycle:null,records:[],pattern:'Logic grid',waferBroken:false,paused:false};        
const status=stations.map(s=>({state:'locked',values:Object.fromEntries(s.controls.map(c=>[c.key,c.initial])),score:null,deviations:[],metric:0,doorTarget:0,doorAmount:0,transfer:null}));        
let scene,camera,renderer,player,clock,yaw=Math.PI,pitch=-.03,lastFrame=0,stockMachine=null,deliveryStation=null;let xrController0=null,xrController1=null,xrGrip0=null,xrGrip1=null,xrRay=null,xrAdjustAt=0,xrTurnLatch=false,xrHandset=null,xrHandsetCanvas=null,xrHandsetCtx=null,xrHandsetTexture=null,xrHandsetUpdated=0,xrTargetRing=null,xrObjectiveBeacon=null,xrLeftSource=null,xrRightSource=null,xrOverlay=null,xrOverlayCanvas=null,xrOverlayCtx=null,xrOverlayTexture=null;const machines=[],interactives=[],effects=[],colliders=[],keys={},sharpsBins=[],waferShards=[];const raycaster=new THREE.Raycaster();const xrTempMatrix=new THREE.Matrix4(),xrOrigin=new THREE.Vector3(),xrDirection=new THREE.Vector3(),xrHeadDirection=new THREE.Vector3();const phys={grab:null,doorGrab:null,waferBody:null,waferVelocity:new THREE.Vector3(),waferLastPos:new THREE.Vector3(),waferReleaseY:0,waferFree:false,lastHandPos:new THREE.Vector3(),handVelocity:new THREE.Vector3(),doorVelocities:[],buttons:{},hudVisible:true,beaconVisible:true,handData:[],waferStaged:false,waferEverPicked:false,pickupGuide:null,pinchDistance:.12,stockReady:null,stockRespawnAt:0,stockRespawnMs:5000,jumpVelocity:0,jumpOffset:0,crouchHeld:false,baseRigY:.86};        
let xrRay0=null,xrHitBlobs=[];
let xrMainMenuActive=false;
const XR_POINTER_REACH=30;
const PREFERENCES_KEY='siliconRunPreferencesV1',ACTIVITY_RECORDS_KEY='waferFabActivitiesV1',GUI_TEXT_SIZES=[5,8,12,20,30,50];
const userPreferences=loadUserPreferences();
let tutorialMode=false,tutorialLastObjective='',tutorialDismissed=false;
function loadUserPreferences(){try{const value=JSON.parse(localStorage.getItem(PREFERENCES_KEY)||'{}'),guiTextSize=GUI_TEXT_SIZES.includes(Number(value.guiTextSize))?Number(value.guiTextSize):12;return{username:String(value.username||''),lookSensitivity:clamp(Number(value.lookSensitivity)||1,.5,2),tutorialHints:value.tutorialHints!==false,guiTextSize,developerPanel:value.developerPanel===true,debugHitboxes:value.debugHitboxes===true,debugNormals:value.debugNormals===true,debugWireframe:value.debugWireframe===true}}catch{return{username:'',lookSensitivity:1,tutorialHints:true,guiTextSize:12,developerPanel:false,debugHitboxes:false,debugNormals:false,debugWireframe:false}}}
function saveUserPreferences(){try{localStorage.setItem(PREFERENCES_KEY,JSON.stringify(userPreferences))}catch{}}
const GUI_TEXT_SCALE=[.72,.84,1,1.14,1.3,1.5];
let desktopDeveloperBuffer='',desktopDeveloperBufferAt=0,xrPausePage='pause';
let fpsFrameCount=0,fpsSampleAt=0,currentFPS=0;
function applyGuiTextSize(size=userPreferences.guiTextSize){const index=Math.max(0,GUI_TEXT_SIZES.indexOf(Number(size)));document.documentElement.style.setProperty('--gui-scale',String(GUI_TEXT_SCALE[index]));if($('guiTextSize'))$('guiTextSize').value=String(index);if($('guiTextSizeValue'))$('guiTextSizeValue').textContent=String(GUI_TEXT_SIZES[index])}
function setGuiTextSize(size){const index=typeof size==='number'&&Number.isInteger(size)&&size>=0&&size<GUI_TEXT_SIZES.length?size:GUI_TEXT_SIZES.indexOf(Number(size));if(index<0)return;userPreferences.guiTextSize=GUI_TEXT_SIZES[index];applyGuiTextSize();saveUserPreferences();if(renderer?.xr?.isPresenting){drawXRHandset(performance.now());drawXRPauseOverlay()}}
function adjustGuiTextSize(delta){const current=Math.max(0,GUI_TEXT_SIZES.indexOf(userPreferences.guiTextSize));setGuiTextSize(clamp(current+delta,0,GUI_TEXT_SIZES.length-1))}
function toggleDeveloperPanel(){userPreferences.developerPanel=!userPreferences.developerPanel;saveUserPreferences();updateDeveloperPaneVisibility();if(renderer?.xr?.isPresenting)drawXRHandset(performance.now())}
function updateDeveloperPaneVisibility(){const visible=userPreferences.developerPanel&&!renderer?.xr?.isPresenting;$('developerDebugPane').hidden=!visible;$('performancePane').hidden=!visible;const stack=document.querySelector('.developer-stack'),hud=$('hud');if(stack&&hud&&visible){const rect=hud.getBoundingClientRect();stack.style.top=Math.round(rect.bottom+10)+'px'}if(visible)renderDeveloperPane();globalThis.CleanroomDebug?.sync?.()}
function installScaledCanvasText(ctx){if(!ctx||ctx.__scaledGuiText)return;const fillText=ctx.fillText.bind(ctx);ctx.fillText=(text,x,y,maxWidth)=>{const original=ctx.font,scaled=original.replace(/(\d+(?:\.\d+)?)px(?=\/|\s)/,(_,value)=>`${Number(value)*GUI_TEXT_SCALE[Math.max(0,GUI_TEXT_SIZES.indexOf(userPreferences.guiTextSize))]}px`);ctx.font=scaled;fillText(text,x,y,maxWidth);ctx.font=original};ctx.__scaledGuiText=true}
const mat=(color,metal=.05,rough=.55,transparent=false,opacity=1,emissive=0)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,transparent,opacity,emissive,emissiveIntensity:emissive?1:0});        
function mesh(geo,material,parent=scene,x=0,y=0,z=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}        
function box(w,h,d,material,parent,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),material,parent,x,y,z)}        
function cyl(r,h,material,parent,x=0,y=0,z=0,seg=28){return mesh(new THREE.CylinderGeometry(r,r,h,seg),material,parent,x,y,z)}        
function canvasTexture(text,color='#9eeeff',bg='#06121b',w=640,h=116,font=34){    
const value=String(text).toUpperCase(),fontPx=Math.max(48,font*4),padX=2,padY=1;    
const c=document.createElement('canvas'),probe=c.getContext('2d');    
probe.font=`900 ${fontPx}px ui-monospace,monospace`;    
const measured=probe.measureText(value);    
c.width=Math.max(8,Math.ceil(measured.width+padX*2));    
c.height=Math.max(8,Math.ceil(fontPx*1.04+padY*2));    
const g=c.getContext('2d'),line=Math.max(2,Math.round(fontPx*.035));    
g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);    
g.strokeStyle='#31566b';g.lineWidth=line;    
g.strokeRect(line/2,line/2,c.width-line,c.height-line);    
g.font=`900 ${fontPx}px ui-monospace,monospace`;    
g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';    
g.fillText(value,c.width/2,c.height/2+fontPx*.02);    
const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;    
t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;    
return t    
}    
function labelMesh(text,color='#9eeeff',w=2.7,h=.48,font=32){  
  const texture=canvasTexture(text,color,'#06121b',640,116,font),aspect=texture.image.width/texture.image.height;  
  const correctedWidth=h*aspect;  
  const label=new THREE.Mesh(new THREE.PlaneGeometry(correctedWidth,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false}));  
  label.userData.labelWidth=correctedWidth;label.userData.labelHeight=h;label.userData.requestedWidth=w;  
  return label  
}        
function addCollider(x,z,w,d){colliders.push({x,z,w,d})}        
let _waferDieTexture=null,guideBeacon=null,guideFloorRing=null;
function waferPatternTexture(){
  if(_waferDieTexture)return _waferDieTexture;
  const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
  g.clearRect(0,0,256,256);
  g.strokeStyle='rgba(94,242,221,.85)';g.lineWidth=2;
  for(let k=16;k<256;k+=24){
    g.beginPath();g.moveTo(k,0);g.lineTo(k,256);g.stroke();
    g.beginPath();g.moveTo(0,k);g.lineTo(256,k);g.stroke();
  }
  g.fillStyle='rgba(110,255,220,.32)';
  for(let x=20;x<240;x+=24)for(let y=20;y<240;y+=24)g.fillRect(x,y,16,16);
  _waferDieTexture=new THREE.CanvasTexture(c);_waferDieTexture.colorSpace=THREE.SRGBColorSpace;
  return _waferDieTexture;
}
function createFlatWaferGeometry(radius,height,seg=48,flatClamp=.91){
  const geo=new THREE.CylinderGeometry(radius,radius,height,seg,1);
  geo.rotateX(Math.PI/2);
  const pos=geo.attributes.position,limit=-radius*flatClamp;
  for(let k=0;k<pos.count;k++){
    if(pos.getY(k)<limit)pos.setY(k,limit);
  }
  pos.needsUpdate=true;
  geo.computeVertexNormals();
  return geo;
}
function createFlatCircleGeometry(radius,seg=48,flatClamp=.91){
  const geo=new THREE.CircleGeometry(radius,seg);
  const pos=geo.attributes.position,limit=-radius*flatClamp;
  for(let k=0;k<pos.count;k++){
    if(pos.getY(k)<limit)pos.setY(k,limit);
  }
  pos.needsUpdate=true;
  geo.computeVertexNormals();
  return geo;
}
function createWafer(scale=1){
  const g=new THREE.Group(),r=.34*scale;
  g.userData.waferScale=scale;
  const base=mesh(createFlatWaferGeometry(r,.024*scale),mat(0xc2ced4,.9,.1),g);
  const layers=[
    ['oxide',r*.976,.008*scale,new THREE.MeshPhysicalMaterial({color:0x5076a0,metalness:.38,roughness:.2,transparent:true,opacity:0,iridescence:.85,iridescenceIOR:1.46,iridescenceThicknessRange:[80,420]}),.014*scale],
    ['resist',r*.97,.009*scale,new THREE.MeshStandardMaterial({color:0xe83b7c,metalness:.08,roughness:.18,transparent:true,opacity:0}),.021*scale],
    ['exposure',r*.965,.006*scale,new THREE.MeshBasicMaterial({color:0x53e7ff,transparent:true,opacity:0,depthWrite:false,toneMapped:false}),.026*scale],
    ['pattern',r*.96,0,new THREE.MeshStandardMaterial({color:0x5ef2dd,map:waferPatternTexture(),metalness:.45,roughness:.18,transparent:true,opacity:0}),.03*scale],
    ['implant',r*.962,.007*scale,new THREE.MeshStandardMaterial({color:0xb16cff,metalness:.42,roughness:.2,transparent:true,opacity:0,emissive:0x3f1070,emissiveIntensity:.25}),.033*scale],
    ['metal',r*.968,.01*scale,new THREE.MeshPhysicalMaterial({color:0xd2e6f7,transparent:true,opacity:0,metalness:.88,roughness:.12,iridescence:.6,iridescenceIOR:1.8,iridescenceThicknessRange:[120,700]}),.037*scale]
  ];
  for(const [name,lr,lh,lmat,lz] of layers){
    const geo=lh>0?createFlatWaferGeometry(lr,lh):createFlatCircleGeometry(lr);
    const lm=mesh(geo,lmat,g,0,0,lz);
    lm.userData.layer=name;lm.userData.baseZ=lz;lm.userData.baseThickness=lh;
  }
  return g;
}
function refreshWaferVisual(group,liveIndex=-1,liveRatio=0,liveValues=null){
  if(!group)return;
  const scale=group.userData.waferScale||.72;
  const rec=i=>liveIndex===i?{ratio:liveRatio,values:liveValues||status[i]?.values}:state.records[i];
  const raw=i=>Math.max(0,rec(i)?.ratio||0);
  const ox=raw(1);
  const coatRec=rec(2),coat=raw(2),coatVals=coatRec?.values||status[2]?.values||{};
  const bake=raw(3);
  const exp=raw(4);
  const dev=raw(5);
  const etch=raw(6);
  const imp=raw(7);
  const rta=raw(8);
  const filmRec=rec(9),film=raw(9);
  const metalChoice=filmRec?.values?.metal||status[9]?.values?.metal||'Aluminium';
  const metalHex=metalChoice==='Gold'?0xffd24d:metalChoice==='Copper'?0xe88b58:0xd2e6f7;
  // Photolith control disproportion ratios relative to nominal recipe (3000 rpm, 1.8 mL/s, 3.0 mL)
  const pFlow=(coatVals.flow||1.8)/1.8,pRpm=3000/(coatVals.rpm||3000),pVol=(coatVals.volume||3)/3;
  const resistSkew=Math.abs(pFlow-1)+Math.abs(pRpm-1)+Math.abs(pVol-1);
  const clear=clamp(dev*.68,0,.78);
  const oxScaleZ=Math.max(.05,ox),resistScaleZ=Math.max(.05,coat*(1-clear)),filmScaleZ=Math.max(.05,film);
  let stackZ=.012*scale;
  const layerMap={};
  group.traverse(o=>{if(o.userData.layer)layerMap[o.userData.layer]=o});
  if(layerMap.oxide){
    const o=layerMap.oxide,h=(o.userData.baseThickness||.008*scale)*oxScaleZ;
    o.scale.set(1,1,ox>0?oxScaleZ:1);
    o.position.set(0,0,ox>0?stackZ+h*.5:o.userData.baseZ);
    if(ox>0)stackZ+=h;
    o.material.opacity=clamp(ox*.76,0,.92);
    const oxPhase=ox%1.5,hue=ox<=0?0x5076a0:oxPhase<.45?0x9c7248:oxPhase<.9?0x6d52b8:0x2f74d8;
    o.material.color.setHex(hue);
  }
  if(layerMap.resist){
    const o=layerMap.resist,h=(o.userData.baseThickness||.009*scale)*resistScaleZ;
    const radSpread=coat>0?clamp(1+(pRpm-1)*.04+(pFlow-1)*.03,.86,1.04):1;
    const wobbleX=coat>0&&resistSkew>.15?Math.sin(coat*2.4)*Math.min(.018,resistSkew*.012)*scale:0;
    const wobbleY=coat>0&&resistSkew>.15?Math.cos(coat*1.9)*Math.min(.018,resistSkew*.012)*scale:0;
    o.scale.set(radSpread,radSpread,coat>0?resistScaleZ:1);
    o.position.set(wobbleX,wobbleY,coat>0?stackZ+h*.5:o.userData.baseZ);
    if(coat>0)stackZ+=h;
    o.material.opacity=clamp(coat*.68*(1-clear),0,.96);
    o.material.roughness=clamp(.16+Math.max(0,pFlow-pRpm)*.24+Math.max(0,coat-1.2)*.05,.08,.75);
    const baseHue=bake>.45?0xc82a54:coat>1.3?0x9e1646:coat<.6&&resistSkew>.35?0xf672a5:0xf24788;
    o.material.color.setHex(baseHue);
  }
  if(layerMap.exposure){
    const o=layerMap.exposure;
    o.position.set(0,0,stackZ+.002*scale);
    o.material.opacity=clamp(exp*.38*(1-clamp(dev,0,1)),0,.48);
  }
  if(layerMap.pattern){
    const o=layerMap.pattern;
    o.position.set(0,0,stackZ+.0035*scale);
    o.material.opacity=clamp(Math.max(dev*.35,etch*.9),0,.94);
  }
  if(layerMap.implant){
    const o=layerMap.implant;
    o.position.set(0,0,stackZ+.005*scale);
    o.material.opacity=clamp(imp*.45+rta*.2,0,.62);
    o.material.emissiveIntensity=rta>.1?.45+Math.min(.45,rta*.3):.18;
  }
  if(layerMap.metal){
    const o=layerMap.metal,h=(o.userData.baseThickness||.01*scale)*filmScaleZ;
    o.scale.set(1,1,film>0?filmScaleZ:1);
    o.position.set(0,0,film>0?stackZ+h*.5:o.userData.baseZ);
    o.material.color.setHex(metalHex);
    o.material.opacity=clamp(film*.82,0,.96);
  }
}
function createChevronArrow(col,coreCol=C.guideTurn){
  const g=new THREE.Group();
  const wingMat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.94,toneMapped:false});
  const innerMat=new THREE.MeshBasicMaterial({color:coreCol,transparent:true,opacity:.98,toneMapped:false});
  const left=box(.14,.035,.46,wingMat,g,-.16,.03,0);left.rotation.y=-.58;
  const right=box(.14,.035,.46,wingMat,g,.16,.03,0);right.rotation.y=.58;
  const iLeft=box(.065,.045,.28,innerMat,g,-.1,.04,.04);iLeft.rotation.y=-.58;
  const iRight=box(.065,.045,.28,innerMat,g,.1,.04,.04);iRight.rotation.y=.58;
  g.userData.arrowMaterials=[wingMat,innerMat];
  return g;
}
function buildEnvironment(){scene=new THREE.Scene();scene.background=new THREE.Color(0x07101a);scene.fog=new THREE.Fog(0x07101a,22,68);camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,130);player=new THREE.Object3D();player.position.set(0,1.72,7.7);player.rotation.y=Math.PI;player.add(camera);scene.add(player);renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');$('game').appendChild(renderer.domElement);clock=new THREE.Clock();setupXR();scene.add(new THREE.HemisphereLight(0xcbefff,0x0b1620,1.35));const sun=new THREE.DirectionalLight(0xffffff,1.15);sun.position.set(4,12,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
// Raised cleanroom ESD floor split cleanly by zone (no overlapping slabs or Z-fighting), top face at y = 0.000
box(18,.14,8,mat(0xcbe2ea,.12,.22),scene,0,-.07,8);
box(18,.14,21,mat(0xd8e8ee,.12,.22),scene,0,-.07,-6.5);
box(18,.14,25,mat(0xd5d8ec,.12,.22),scene,0,-.07,-29.5);
const seamMat=mat(0x7c97a3,.22,.55),seamDummy=new THREE.Object3D();
const zSeamGeo=new THREE.BoxGeometry(17.8,.003,.02),zSeamMesh=new THREE.InstancedMesh(zSeamGeo,seamMat,35);
for(let k=0,z=11;z>=-41;z-=1.5,k++){seamDummy.position.set(0,.0015,z);seamDummy.updateMatrix();zSeamMesh.setMatrixAt(k,seamDummy.matrix)}
zSeamMesh.instanceMatrix.needsUpdate=true;scene.add(zSeamMesh);
const xSeamGeo=new THREE.BoxGeometry(.02,.003,53.6),xSeamMesh=new THREE.InstancedMesh(xSeamGeo,seamMat,11);
for(let k=0,x=-7.5;x<=7.5;x+=1.5,k++){seamDummy.position.set(x,.0015,-15);seamDummy.updateMatrix();xSeamMesh.setMatrixAt(k,seamDummy.matrix)}
xSeamMesh.instanceMatrix.needsUpdate=true;scene.add(xSeamMesh);
box(.14,.003,53,mat(0x1684b8,.15,.28,false,1,0x0b4b6a),scene,-2.15,.0045,-15);
box(.14,.003,53,mat(0x1684b8,.15,.28,false,1,0x0b4b6a),scene,2.15,.0045,-15);
const safetyStripe=mat(0xe6b835,.1,.45);
box(.08,.003,52,safetyStripe,scene,-4.4,.004,-15);box(.08,.003,52,safetyStripe,scene,4.4,.004,-15);
// Cleanroom walls, stainless crash rails, mullions, glazed service chase + process piping
const wall=mat(0xeaf3f3,0,.48),steel=mat(0x8ba2ad,.72,.24),pipeMat=mat(0xa8bcc4,.82,.22);
box(.18,4.2,54,wall,scene,-9,2,-15);box(.18,4.2,54,wall,scene,9,2,-15);box(18,4.2,.18,wall,scene,0,2,12);box(18,4.2,.18,wall,scene,0,2,-42);
box(.08,.18,53.8,steel,scene,-8.86,.09,-15);box(.08,.18,53.8,steel,scene,8.86,.09,-15);
box(.06,.09,53.6,steel,scene,-8.85,.92,-15);box(.06,.09,53.6,steel,scene,8.85,.92,-15);
for(let z=10;z>=-40;z-=3){box(.08,4.1,.08,steel,scene,-8.86,2.05,z);box(.08,4.1,.08,steel,scene,8.86,2.05,z)}
const windowMat=mat(0x6ad0f0,.08,.1,true,.22);
for(let z=8;z>-41;z-=6){
  box(.05,1.75,3.9,windowMat,scene,-8.88,2.08,z);box(.05,1.75,3.9,windowMat,scene,8.88,2.08,z);
  // Outer service chase process piping behind observation glass
  for(const sx of [-9.45,9.45]){
    const riser=cyl(.08,3.6,pipeMat,scene,sx,1.9,z-.8,12);riser.castShadow=false;
    const riser2=cyl(.05,3.6,mat(0x4c9ec4,.6,.28),scene,sx,1.9,z+.7,12);riser2.castShadow=false;
  }
}
// Ceiling plenum, HEPA FFU panels, overhead stainless exhaust trunk & cable tray
box(18,.14,54,mat(0x16242d,.35,.5),scene,0,4.18,-15);
const duct=cyl(.26,52,pipeMat,scene,-3.6,3.82,-15,16);duct.rotation.x=Math.PI/2;
const ductR=cyl(.26,52,pipeMat,scene,3.6,3.82,-15,16);ductR.rotation.x=Math.PI/2;
box(.55,.08,52,mat(0x3a4f5c,.65,.35),scene,0,3.96,-15);
for(let z=10;z>-42;z-=4){
  const col=z>-17?0x8deeff:0xc7bcff;
  const light=new THREE.PointLight(col,1.55,10,2);light.position.set(0,3.42,z);scene.add(light);
  const p=box(.44,.05,3.2,mat(col,0,.22),scene,0,3.90,z);p.material.emissive.setHex(col);p.material.emissiveIntensity=1.05;
  for(const hx of [-5.8,5.8]){
    const hepa=box(2.1,.04,2.4,mat(0xd8eef5,.15,.4,false,1,0x3c6978),scene,hx,4.06,z);hepa.material.emissiveIntensity=.35;
  }
}
// Realistic Air Shower ISO Transfer Portal at z=-17
const frame=mat(0x425d6d,.7,.24);
box(.42,3.9,.56,frame,scene,-4.7,1.95,-17);box(.42,3.9,.56,frame,scene,4.7,1.95,-17);box(9.8,.34,.56,frame,scene,0,3.78,-17);
box(9.1,3.35,.04,mat(0x80d9f1,.1,.08,true,.12),scene,0,1.85,-17);
for(const ax of [-4.4,4.4])for(const ay of [1.1,1.75,2.4,3.05]){const noz=cyl(.045,.12,steel,scene,ax,ay,-17,10);noz.rotation.z=Math.PI/2}
const showerBar=box(4.4,.08,.12,mat(0x53e7ff,0,.2,false,1,0x53e7ff),scene,0,3.55,-16.72);showerBar.material.emissiveIntensity=1.1;
const air=labelMesh('AIR SHOWER • ISO-4 TO ISO-5 TRANSFER','#72eeff',4.8,.52,26);air.position.set(0,3.3,-16.72);scene.add(air);
const zoneA=labelMesh('CLEANROOM A • LITHOGRAPHY BAY','#53e7ff',4.6,.6,26);zoneA.position.set(0,3.25,1);scene.add(zoneA);
const zoneB=labelMesh('CLEANROOM B • ETCH, IMPLANT + FILMS','#b889ff',5.1,.6,24);zoneB.position.set(0,3.25,-24);scene.add(zoneB);
// The old player capsule was parented to yaw-only movement, so it could swing across the first-person view without following pitch. Keep the unobstructed camera and render only the carried wafer in first person.
state.handWafer=createWafer(.72);state.handWafer.position.set(.48,-.38,-.8);state.handWafer.rotation.set(.6,-.25,.15);state.handWafer.visible=false;camera.add(state.handWafer);bindWaferPhysics(state.handWafer);createStockMachine();stations.forEach((s,i)=>createMachine(s,i));createDeliveryStation();
const ROUTE_ARROW_COUNT=44,ROUTE_ARROW_STEP=1.25;
for(let k=0;k<ROUTE_ARROW_COUNT;k++){const a=createChevronArrow(C.startGreen,0x9eff52);a.position.set(0,.035,10);a.visible=false;scene.add(a);effects.push({kind:'route',obj:a,routeIndex:k})}
// Floating overhead station guide beacon & floor target ring for vivid tutorial & production routing
guideBeacon=new THREE.Group();
const gbRing=mesh(new THREE.TorusGeometry(.38,.032,10,36),new THREE.MeshBasicMaterial({color:C.startGreen,transparent:true,opacity:.92,toneMapped:false}),guideBeacon);gbRing.rotation.x=Math.PI/2;
const gbArrow=mesh(new THREE.ConeGeometry(.18,.42,12),new THREE.MeshBasicMaterial({color:0x9eff52,toneMapped:false}),guideBeacon,0,-.32,0);gbArrow.rotation.x=Math.PI;
guideFloorRing=mesh(new THREE.RingGeometry(.46,.66,36),new THREE.MeshBasicMaterial({color:C.startGreen,side:THREE.DoubleSide,transparent:true,opacity:.82,toneMapped:false}),scene,0,.018,10);guideFloorRing.rotation.x=-Math.PI/2;
scene.add(guideBeacon);guideBeacon.visible=false;guideFloorRing.visible=false;
createSharpsBins();createXROverlay()}        
function createGhostHand(grip,handedness,index){
  const mirror=handedness==='left'?-1:1;
  // Translucent Meta Quest frosted ghost hand gripping the Touch Plus controller
  const root=new THREE.Group();
  const ghostMat=new THREE.MeshStandardMaterial({color:0xeef6fb,transparent:true,opacity:.44,roughness:.36,metalness:.06,emissive:0x2e5e78,emissiveIntensity:.24,depthWrite:false});
  const rimMat=new THREE.MeshBasicMaterial({color:0xb8e9ff,transparent:true,opacity:.32,depthWrite:false,toneMapped:false});
  root.position.set(0,-.024,-.008);root.rotation.set(-.34,mirror*.11,mirror*.07);root.scale.x=mirror;grip.add(root);
  // Sculpted wrist cuff + palm pad
  const cuff=mesh(new THREE.CylinderGeometry(.032,.038,.065,16),ghostMat,root,0,-.028,.048);cuff.rotation.x=Math.PI/2+.16;
  const cuffRim=mesh(new THREE.TorusGeometry(.035,.0025,8,24),rimMat,root,0,-.034,.078);cuffRim.rotation.x=.16;
  const glovePalm=mesh(new THREE.SphereGeometry(1,20,16),ghostMat,root,0,-.006,-.02);glovePalm.scale.set(.048,.024,.062);
  const thumbPad=mesh(new THREE.SphereGeometry(1,14,12),ghostMat,root,-.03,-.008,-.014);thumbPad.scale.set(.024,.02,.034);
  const fingers=[];
  const makeTaper=(rBase,rTip,len)=>{const g=new THREE.CylinderGeometry(rTip,rBase,len,12);g.translate(0,len*.5,0);g.rotateX(-Math.PI/2);return g};
  const makeFinger=(x,y,z,name,len,rad)=>{
    const base=new THREE.Group();base.position.set(x,y,z);root.add(base);
    const mid=new THREE.Group();mid.position.set(0,0,-len*.46);base.add(mid);
    const tip=new THREE.Group();tip.position.set(0,0,-len*.31);mid.add(tip);
    mesh(new THREE.SphereGeometry(rad,10,8),ghostMat,base,0,0,0);
    mesh(makeTaper(rad,rad*.86,len*.46),ghostMat,base,0,0,0);
    mesh(new THREE.SphereGeometry(rad*.86,10,8),ghostMat,mid,0,0,0);
    mesh(makeTaper(rad*.86,rad*.74,len*.31),ghostMat,mid,0,0,0);
    mesh(new THREE.SphereGeometry(rad*.74,10,8),ghostMat,tip,0,0,0);
    mesh(makeTaper(rad*.74,rad*.54,len*.23),ghostMat,tip,0,0,0);
    const cap=mesh(new THREE.SphereGeometry(rad*.52,10,8),ghostMat,tip,0,0,-len*.23);
    fingers.push({name,base,mid,tip,cap});return tip;
  };
  makeFinger(-.031,.006,-.058,'index',.074,.0092);
  makeFinger(-.011,.008,-.066,'middle',.082,.0095);
  makeFinger(.011,.006,-.064,'ring',.076,.0089);
  makeFinger(.031,.002,-.056,'little',.064,.008);
  const thumbBase=new THREE.Group();thumbBase.position.set(-.042,.003,-.018);thumbBase.rotation.set(-.14,.32,.46);root.add(thumbBase);
  const thumbMid=new THREE.Group();thumbMid.position.set(0,0,-.034);thumbBase.add(thumbMid);
  mesh(new THREE.SphereGeometry(.0115,10,8),ghostMat,thumbBase,0,0,0);
  mesh(makeTaper(.0115,.0098,.034),ghostMat,thumbBase,0,0,0);
  mesh(new THREE.SphereGeometry(.0098,10,8),ghostMat,thumbMid,0,0,0);
  mesh(makeTaper(.0098,.0078,.029),ghostMat,thumbMid,0,0,0);
  const thumbTip=mesh(new THREE.SphereGeometry(.0076,10,8),ghostMat,thumbMid,0,0,-.029);

  // Meta Quest Touch Plus ringless controller geometry
  const device=new THREE.Group();device.position.set(0,-.042,.024);grip.add(device);
  const whiteShell=mat(0xeef2f5,.08,.36);
  const faceplateMat=mat(0x1b2128,.16,.44);
  const bezelMat=mat(0xcad5dc,.42,.28);
  const makeCtrlMat=()=>new THREE.MeshStandardMaterial({color:0x232a33,metalness:.22,roughness:.36});
  const makeTriggerMat=()=>new THREE.MeshStandardMaterial({color:0xdde4e9,metalness:.14,roughness:.36});
  // Ergonomic tapered pistol handle + lower palm contour + lanyard loop
  const handle=new THREE.Group();handle.position.set(0,-.056,.016);handle.rotation.x=-.34;device.add(handle);
  const gripUpper=mesh(new THREE.CylinderGeometry(.023,.020,0.095,18),whiteShell,handle,0,0,0);gripUpper.scale.set(.92,1,1.14);
  const gripCap=mesh(new THREE.SphereGeometry(.02,14,10),whiteShell,handle,0,-.048,0);gripCap.scale.set(.92,.65,1.14);
  const gripNeck=mesh(new THREE.CylinderGeometry(.032,.023,.038,18),whiteShell,handle,0,.056,-.004);gripNeck.scale.set(1.05,1,1.18);
  const lanyard=mesh(new THREE.TorusGeometry(.011,.0018,6,18),mat(0xc7d1d8,.1,.6),handle,0,-.058,.012);lanyard.rotation.y=Math.PI/2;
  // Tilted ringless oval-circular matte-black thumb faceplate + white underside shell + metallic bezel
  const face=new THREE.Group();face.position.set(0,.022,-.018);face.rotation.x=.38;device.add(face);
  const faceBase=mesh(new THREE.CylinderGeometry(.054,.048,.018,28),whiteShell,face,0,-.006,0);faceBase.scale.set(1.06,1,1.14);
  const facePlate=mesh(new THREE.CylinderGeometry(.052,.053,.007,28),faceplateMat,face,0,.005,0);facePlate.scale.set(1.04,1,1.12);
  const faceRim=mesh(new THREE.TorusGeometry(.0535,.0022,8,32),bezelMat,face,0,.004,0);faceRim.rotation.x=Math.PI/2;faceRim.scale.set(1.04,1.12,1);
  // Concave thumbstick (inner-upper quadrant, mirrored cleanly per hand)
  const stickPivot=new THREE.Group();stickPivot.position.set(-mirror*.018,.009,-.018);face.add(stickPivot);
  const stickWell=mesh(new THREE.CylinderGeometry(.016,.016,.004,18),mat(0x101419,.1,.6),face,-mirror*.018,.007,-.018);
  const stickStem=mesh(new THREE.CylinderGeometry(.0055,.0065,.013,12),makeCtrlMat(),stickPivot,0,.006,0);
  const stickCap=mesh(new THREE.CylinderGeometry(.0115,.009,.005,18),makeCtrlMat(),stickPivot,0,.013,0);
  const stickRim=mesh(new THREE.TorusGeometry(.01,.0016,6,18),bezelMat,stickPivot,0,.015,0);stickRim.rotation.x=Math.PI/2;
  // Two glossy domed face buttons (A/B on right, X/Y on left) + recessed Menu/Meta pill button + LED dot
  const faceButtons=[
    mesh(new THREE.CylinderGeometry(.0078,.0082,.006,16),makeCtrlMat(),face,mirror*.016,.009,.016),
    mesh(new THREE.CylinderGeometry(.0078,.0082,.006,16),makeCtrlMat(),face,mirror*.028,.009,-.006)
  ];
  const menuButton=mesh(new THREE.CylinderGeometry(.0065,.0068,.005,16),makeCtrlMat(),face,-mirror*.026,.009,.014);
  const led=mesh(new THREE.SphereGeometry(.0018,8,6),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),face,0,.009,-.044);
  // Curved front index trigger + flush inner side grip trigger
  const triggerPivot=new THREE.Group();triggerPivot.position.set(0,-.006,-.048);device.add(triggerPivot);
  const trigger=mesh(new THREE.BoxGeometry(.017,.034,.02),makeTriggerMat(),triggerPivot,0,-.012,-.008);trigger.rotation.x=.32;
  const gripButton=mesh(new THREE.BoxGeometry(.012,.042,.018),makeTriggerMat(),handle,-mirror*.019,.014,-.008);

  const pinchAnchor=new THREE.Group();pinchAnchor.position.set(mirror*.002,.005,-.121);grip.add(pinchAnchor);
  const marker=mesh(new THREE.TorusGeometry(.014,.0035,8,24),new THREE.MeshBasicMaterial({color:C.cyan,transparent:true,opacity:.9,depthTest:false,toneMapped:false}),pinchAnchor);marker.rotation.x=Math.PI/2;marker.renderOrder=50;
  const dot=mesh(new THREE.SphereGeometry(.0055,10,7),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,toneMapped:false}),pinchAnchor);dot.renderOrder=51;
  const data={index,handedness,mirror,grip,root,fingers,thumbBase,thumbMid,thumbTip,pinchAnchor,marker,dot,device,triggerPivot,triggerMesh:trigger,gripButton,stickPivot,stick:stickCap,faceButtons,menuButton,led,trigger:0,gripValue:0};
  phys.handData[index]=data;return data;
}
function updateGhostHandPose(data,source,dt){
  if(!data)return;
  const gp=source?.gamepad,trigger=gp?.buttons?.[0]?.value||0,grip=gp?.buttons?.[1]?.value||0;
  const stickX=gp?.axes?.[2]||0,stickY=gp?.axes?.[3]||0;
  const primary=gp?.buttons?.[4]?.touched||gp?.buttons?.[4]?.pressed;
  const secondary=gp?.buttons?.[5]?.touched||gp?.buttons?.[5]?.pressed;
  const stick=gp?.buttons?.[3]?.touched||gp?.buttons?.[3]?.pressed||Math.hypot(stickX,stickY)>.18;
  const menu=!!gp?.buttons?.[6]?.pressed;
  data.trigger=lerp(data.trigger,trigger,1-Math.exp(-dt*18));
  data.gripValue=lerp(data.gripValue,grip,1-Math.exp(-dt*15));
  for(const f of data.fingers){
    const neutral=f.name==='index'?.22:.58;
    const curl=f.name==='index'?lerp(neutral,1.0,data.trigger):lerp(neutral,1.02,Math.max(data.gripValue,data.trigger*.15));
    f.base.rotation.x=lerp(f.base.rotation.x,-curl*.82,.34);
    f.mid.rotation.x=lerp(f.mid.rotation.x,-curl*1.05,.34);
    f.tip.rotation.x=lerp(f.tip.rotation.x,-curl*.62,.34);
  }
  const thumbTargetPitch=primary?-.48:secondary?-.42:stick?-.34:-.18;
  const thumbTargetYaw=primary?-.16:secondary?-.26:.28+clamp(stickX,-1,1)*data.mirror*.2;
  data.thumbBase.rotation.x=lerp(data.thumbBase.rotation.x,thumbTargetPitch,.3);
  data.thumbBase.rotation.y=lerp(data.thumbBase.rotation.y,thumbTargetYaw,.3);
  data.thumbMid.rotation.x=lerp(data.thumbMid.rotation.x,(primary||secondary||stick)?-.52:-.24,.3);
  if(data.triggerPivot)data.triggerPivot.rotation.x=data.trigger*.42;
  if(data.stickPivot){data.stickPivot.rotation.z=-stickX*.34;data.stickPivot.rotation.x=stickY*.34}
  data.gripButton.position.x=-data.mirror*(.019-data.gripValue*.004);
  data.faceButtons[0].position.y=gp?.buttons?.[4]?.pressed?.006:.009;
  data.faceButtons[1].position.y=gp?.buttons?.[5]?.pressed?.006:.009;
  const activeStep=typeof controlsTrainingCurrent==='function'&&controlsTraining.active?controlsTrainingCurrent():null;
  const pulseOn=Math.sin(performance.now()*.012)>0;
  const hl=(mesh,active,idleColor,inputId)=>{
    const trainTarget=activeStep&&activeStep.vrHand===data.handedness&&activeStep.vrInput===inputId;
    if(active){mesh.material.color.setHex(C.green);mesh.material.emissive.setHex(C.green);mesh.material.emissiveIntensity=.85}
    else if(trainTarget){const col=pulseOn?C.cyan:C.amber;mesh.material.color.setHex(col);mesh.material.emissive.setHex(col);mesh.material.emissiveIntensity=.95}
    else{mesh.material.color.setHex(idleColor);mesh.material.emissive.setHex(0x000000);mesh.material.emissiveIntensity=0}
  };
  hl(data.triggerMesh,data.trigger>.08,0xdde4e9,'trigger');
  hl(data.gripButton,data.gripValue>.12,0xdde4e9,'grip');
  hl(data.stick,stick,0x232a33,'stick');
  hl(data.faceButtons[0],!!primary,0x232a33,'face0');
  hl(data.faceButtons[1],!!secondary,0x232a33,'face1');
  hl(data.menuButton,menu,0x232a33,'menu');
  const near=nearestPinchTarget(data.pinchAnchor),allowed=near&&near.distance<=phys.pinchDistance;
  data.marker.visible=true;data.marker.material.color.setHex(allowed?C.green:near?C.amber:C.cyan);
  data.dot.material.color.setHex(allowed?0xffffff:C.cyan);
  data.marker.scale.setScalar(.9+.18*Math.sin(performance.now()*.012));
}
function createXRHandset(){        
xrHandsetCanvas=document.createElement('canvas');xrHandsetCanvas.width=768;xrHandsetCanvas.height=512;xrHandsetCtx=xrHandsetCanvas.getContext('2d');installScaledCanvasText(xrHandsetCtx);xrHandsetTexture=new THREE.CanvasTexture(xrHandsetCanvas);xrHandsetTexture.colorSpace=THREE.SRGBColorSpace;const g=new THREE.Group(),body=box(.31,.205,.018,mat(0x06131d,.25,.3),g,0,0,0),screen=mesh(new THREE.PlaneGeometry(.286,.181),new THREE.MeshBasicMaterial({map:xrHandsetTexture,toneMapped:false}),g,0,0,.012);const rim=box(.325,.219,.012,mat(C.cyan,.25,.3,true,.55,C.cyan),g,0,0,-.006);rim.scale.set(1,1,.45);screen.renderOrder=3;g.position.set(.115,.115,-.13);g.rotation.set(-.72,.18,.1);xrGrip0.add(g);xrHandset=g;return g}        
function createXRSpatialAids(){        
xrTargetRing=mesh(new THREE.RingGeometry(.035,.052,32),new THREE.MeshBasicMaterial({color:C.cyan,side:THREE.DoubleSide,transparent:true,opacity:.9,depthTest:false}),scene);xrTargetRing.visible=false;xrTargetRing.renderOrder=20;xrHitBlobs=[0,1].map(()=>{const blob=mesh(new THREE.SphereGeometry(.055,16,12),new THREE.MeshBasicMaterial({color:C.green,depthTest:false,toneMapped:false}),scene);blob.visible=false;blob.renderOrder=1001;return blob});const beacon=new THREE.Group();const halo=mesh(new THREE.TorusGeometry(.23,.018,10,30),new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:.75,toneMapped:false}),beacon);halo.rotation.x=Math.PI/2;const arrow=mesh(new THREE.ConeGeometry(.09,.24,12),new THREE.MeshBasicMaterial({color:C.green,toneMapped:false}),beacon,0,-.22,0);arrow.rotation.x=Math.PI;scene.add(beacon);xrObjectiveBeacon=beacon;beacon.visible=false}        
function drawXRHandset(now){        
if(!xrHandsetCtx||now-xrHandsetUpdated<120)return false;xrHandsetUpdated=now;const g=xrHandsetCtx,w=xrHandsetCanvas.width,h=xrHandsetCanvas.height,s=stations[state.current],st=status[state.current],done=state.records.filter(Boolean).length,dev=!!userPreferences.developerPanel,barW=dev?330:700;g.fillStyle='#04101a';g.fillRect(0,0,w,h);g.strokeStyle='#53e7ff';g.lineWidth=10;g.strokeRect(6,6,w-12,h-12);g.fillStyle='#53e7ff';g.font='900 38px system-ui';g.fillText('SILICON RUN // WRIST',34,56);g.fillStyle='#7594a6';g.font='700 22px monospace';g.fillText('LOT',34,104);g.fillText('STAGE',34,145);g.fillText('WAFER',34,186);g.fillText('QUALITY',34,227);g.fillStyle='#eefcff';g.fillText(state.lotId||'—',170,104);g.fillText(state.completed?'COMPLETE':(s?.short||'Wafer stock').toUpperCase(),170,145);g.fillText(state.carrying?'IN LEFT HAND':state.cycle?'IN PROCESS':'AT STATION / STOCK',170,186);g.fillText(state.runStart?quality().toFixed(1)+'%':'AWAITING RUN',170,227);g.fillStyle='#132936';g.fillRect(34,258,barW,22);g.fillStyle='#67f6a3';g.fillRect(34,258,barW*(done/stations.length),22);g.fillStyle='#ffcf56';g.font='900 23px monospace';g.fillText(state.completed?'LOT COMPLETE':!state.runStart?'DISPENSE BLANK WAFER':s?.name.toUpperCase()||'PROCEED',34,328);g.fillStyle='#a9c0cb';g.font='19px monospace';const target=st&&s?`${s.metric.label}: ${s.metric.target} ± ${s.metric.tol} ${s.metric.unit}`:'Follow active route';g.fillText(target.slice(0,dev?32:66),34,366);if(s){g.font='16px monospace';s.controls.forEach((c,i)=>{g.fillStyle='#a9c0cb';g.fillText((c.kind==='choice'?`${c.label}: ${c.target}`:`${c.label}: ${c.target} ± ${c.tol} ${c.unit}`).slice(0,dev?34:76),34,398+i*28)})}if(st&&s&&st.state==='running'){g.fillStyle='#67f6a3';g.font='900 25px monospace';g.fillText(`LIVE: ${formatMetric(st.metric,s.metric)} ${s.metric.unit}`,dev?34:420,dev?476:454)}if(!dev){g.fillStyle='#7894a3';g.font='15px monospace';g.fillText('Process target and all recipe requirements shown above',34,488)}xrHandsetTexture.needsUpdate=true;return true}
function pulseXR(strength=.35,duration=35){const src=xrRightSource||xrLeftSource,act=src?.gamepad?.hapticActuators?.[0];if(act?.pulse)act.pulse(strength,duration).catch(()=>{})}        
function setupXR(){        
const makeRay=()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-1)]),l=new THREE.Line(g,new THREE.LineBasicMaterial({color:C.cyan,transparent:true,opacity:.62}));l.name='XR interaction ray';l.scale.z=XR_POINTER_REACH;return l};        
xrController0=renderer.xr.getController(0);xrController1=renderer.xr.getController(1);xrGrip0=renderer.xr.getControllerGrip(0);xrGrip1=renderer.xr.getControllerGrip(1);player.add(xrController0,xrController1,xrGrip0,xrGrip1);createGhostHand(xrGrip0,'left',0);createGhostHand(xrGrip1,'right',1);xrController0.userData.grip=xrGrip0;xrController0.userData.pinchAnchor=phys.handData[0].pinchAnchor;xrController0.userData.handIndex=0;xrController1.userData.grip=xrGrip1;xrController1.userData.pinchAnchor=phys.handData[1].pinchAnchor;xrController1.userData.handIndex=1;xrRay0=makeRay();xrController0.add(xrRay0);xrRay=makeRay();xrController1.add(xrRay);createXRHandset();createXRSpatialAids();        
xrController0.addEventListener('connected',e=>{xrController0.userData.handedness=e.data.handedness;if(e.data.handedness==='left')xrLeftSource=e.data;else if(e.data.handedness==='right')xrRightSource=e.data});xrController1.addEventListener('connected',e=>{xrController1.userData.handedness=e.data.handedness;if(e.data.handedness==='right')xrRightSource=e.data;else if(e.data.handedness==='left')xrLeftSource=e.data});        
[xrController0,xrController1].forEach((c,i)=>{c.userData.hand=i===0?'left':'right';c.addEventListener('selectstart',()=>onXRTriggerStart(c));c.addEventListener('selectend',()=>onXRTriggerEnd(c));c.addEventListener('squeezestart',()=>onXRSqueezeStart(c));c.addEventListener('squeezeend',()=>onXRSqueezeEnd(c))});        
renderer.xr.addEventListener('sessionstart',()=>{document.body.classList.add('xr-presenting');$('xrButton').style.display='none';if(document.pointerLockElement)document.exitPointerLock?.();player.position.y=.86;if(!state.started){xrMainMenuActive=true;state.paused=true;drawXRMainMenuOverlay()}if(state.handWafer&&state.handWafer.parent===camera){camera.remove(state.handWafer);scene.add(state.handWafer);state.handWafer.visible=false}if(controlsTraining.active){startControlsTraining('vr')}toast('Quest physical-space mode active. Left wrist shows the traveller.');});        
renderer.xr.addEventListener('sessionend',()=>{document.body.classList.remove('xr-presenting');xrMainMenuActive=false;if(xrOverlay)xrOverlay.visible=false;$('xrButton').style.display=state.started?'block':'none';player.position.y=2.58;if(state.handWafer){state.handWafer.parent?.remove(state.handWafer);camera.add(state.handWafer);state.handWafer.position.set(.48,-.38,-.8);state.handWafer.rotation.set(.6,-.25,.15);state.handWafer.scale.setScalar(1)}});        
if(!navigator.xr){$('xrButton').disabled=true;$('xrButton').textContent='WEBXR NOT AVAILABLE'}        
}        
async function enterXR(){        
if(!navigator.xr){toast('WebXR is unavailable. Open this HTTPS page in Quest Browser.','bad');return}        
try{const supported=await navigator.xr.isSessionSupported('immersive-vr');if(!supported){toast('Immersive VR is not supported by this browser.','bad');return}const session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['bounded-floor','hand-tracking']});await renderer.xr.setSession(session)}catch(err){console.error(err);toast('Could not enter VR: '+err.message,'bad')}        
}        
function xrInteractiveHit(controller,maxDistance=XR_POINTER_REACH){
if(!controller)return null;controller.updateMatrixWorld(true);xrTempMatrix.identity().extractRotation(controller.matrixWorld);xrOrigin.setFromMatrixPosition(controller.matrixWorld);xrDirection.set(0,0,-1).applyMatrix4(xrTempMatrix).normalize();raycaster.set(xrOrigin,xrDirection);return raycaster.intersectObjects(interactives,false).find(hit=>hit.distance<maxDistance)||null
}
function xrPointerHit(controller){
if(!controller)return null;controller.updateMatrixWorld(true);xrTempMatrix.identity().extractRotation(controller.matrixWorld);xrOrigin.setFromMatrixPosition(controller.matrixWorld);xrDirection.set(0,0,-1).applyMatrix4(xrTempMatrix).normalize();raycaster.set(xrOrigin,xrDirection);const hit=raycaster.intersectObjects(interactives,false).find(value=>value.distance<XR_POINTER_REACH);let point=hit?.point||null,distance=hit?.distance||XR_POINTER_REACH;if(designWorld.active){const boardHit=boardPointFromRay(xrOrigin,xrDirection);if(boardHit){const boardDistance=boardHit.world.distanceTo(xrOrigin);if(boardDistance<XR_POINTER_REACH&&boardDistance<distance){point=boardHit.world;distance=boardDistance}}}return{point,distance,direction:xrDirection.clone(),origin:xrOrigin.clone()}
}
function updateXRInteractionBeams(){
if(!renderer.xr.isPresenting)return;[xrController0,xrController1].forEach((controller,index)=>{if(!controller)return;const beam=index===0?xrRay0:xrRay,blob=xrHitBlobs[index],hit=xrPointerHit(controller);if(beam){beam.scale.z=hit.distance;beam.material.color.setHex(hit.point?C.green:C.cyan);beam.material.opacity=hit.point?.95:.55}if(blob){blob.visible=!!hit.point;if(hit.point){blob.position.copy(hit.point).addScaledVector(hit.direction,-.015);blob.scale.setScalar(.85+.15*Math.sin(performance.now()*.012))}}})
}
function setXRFocus(){        
if(!xrController1)return;const hit=xrInteractiveHit(xrController1,3.4),found=hit?.object||null,hitDistance=hit?.distance||XR_POINTER_REACH,point=hit?.point||null;if(state.focus!==found&&found)pulseXR(.12,18);state.focus=found;if(xrRay){xrRay.scale.z=hitDistance;xrRay.material.color.setHex(found?(found.userData.type==='control'||buttonEnabled(found.userData)?C.green:C.red):C.cyan)}if(xrTargetRing){xrTargetRing.visible=!!point;if(point){xrTargetRing.position.copy(point);xrTargetRing.quaternion.copy(xrController1.quaternion);xrTargetRing.scale.setScalar(.9+.12*Math.sin(performance.now()*.012))}}updateMachineGui()        
}        
function updateXRSpatial(now){        
const redrawn=drawXRHandset(now);if(redrawn&&renderer.xr.isPresenting&&userPreferences.developerPanel){drawXRDeveloperPane(xrHandsetCtx);xrHandsetTexture.needsUpdate=true}if(xrHandset)xrHandset.visible=renderer.xr.isPresenting&&(phys.hudVisible||userPreferences.developerPanel)&&!state.paused;if(xrObjectiveBeacon){const target=!state.runStart?stockMachine:machines[state.current+1];xrObjectiveBeacon.visible=renderer.xr.isPresenting&&phys.beaconVisible&&!state.completed&&!!target;if(target){target.group.getWorldPosition(xrObjectiveBeacon.position);xrObjectiveBeacon.position.y=3.45;xrObjectiveBeacon.rotation.y=now*.0015;const q=.85+.12*Math.sin(now*.004);xrObjectiveBeacon.scale.setScalar(q)}}if(renderer.xr.isPresenting)updateXRInteractionBeams()}        
function updateXRVertical(dt){const crouchTarget=phys.crouchHeld?-.62:0;phys.jumpVelocity-=5.8*dt;phys.jumpOffset+=phys.jumpVelocity*dt;if(phys.jumpOffset<0){phys.jumpOffset=0;phys.jumpVelocity=0}const currentBase=player.position.y-phys.jumpOffset;const desired=phys.baseRigY+crouchTarget;player.position.y=lerp(currentBase,desired,1-Math.exp(-dt*12))+phys.jumpOffset}        
function requestJump(){if(phys.jumpOffset<=.002&&!phys.crouchHeld){phys.jumpVelocity=2.6;pulseXR(.45,45)}}        
function updateXRMovement(dt,now){        
const session=renderer.xr.getSession();if(!session)return;updateXRVertical(dt);const sources=[...session.inputSources];let left=null,right=null;for(const src of sources){if(src.handedness==='left')left=src;if(src.handedness==='right')right=src}xrLeftSource=left||xrLeftSource;xrRightSource=right||xrRightSource;const lg=left?.gamepad,rg=right?.gamepad;        
if(lg&&lg.axes.length>=4){let sx=lg.axes[2]||0,sy=lg.axes[3]||0;if(Math.abs(sx)<.15)sx=0;if(Math.abs(sy)<.15)sy=0;camera.getWorldDirection(xrHeadDirection);xrHeadDirection.y=0;if(xrHeadDirection.lengthSq()<.001)xrHeadDirection.set(0,0,-1);xrHeadDirection.normalize();const side=new THREE.Vector3().crossVectors(xrHeadDirection,new THREE.Vector3(0,1,0)).normalize();let nx=clamp(player.position.x+(side.x*sx+xrHeadDirection.x*-sy)*2.45*dt,-8.25,8.25),nz=clamp(player.position.z+(side.z*sx+xrHeadDirection.z*-sy)*2.45*dt,-40.5,11.2);for(const c of colliders){if(Math.abs(nx-c.x)<c.w/2+.34&&Math.abs(nz-c.z)<c.d/2+.34){nx=player.position.x;nz=player.position.z;break}}player.position.x=nx;player.position.z=nz}        
if(rg&&rg.axes.length>=4){const ax=rg.axes[2]||0,ay=rg.axes[3]||0;if(Math.abs(ay)>.7&&state.focus?.userData.type==='control'&&now-xrAdjustAt>180){adjustControl(state.focus.userData,ay<0?1:-1);pulseXR(.18,22);xrAdjustAt=now}if(Math.abs(ax)>.75&&!xrTurnLatch){player.rotation.y-=Math.sign(ax)*Math.PI/6;pulseXR(.22,28);xrTurnLatch=true}else if(Math.abs(ax)<.3)xrTurnLatch=false}        
updateXRSpatial(now)        
}        
function createSharpsBins(){        
[[-7.4,8],[7.4,-14],[-7.4,-35]].forEach(([x,z],i)=>{const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);box(.48,.6,.48,mat(0xffcf22,.05,.7),g,0,.3,0);box(.38,.02,.3,mat(0x161616,.1,.7),g,0,.615,0);const l=labelMesh('SHARPS','#161616',.43,.12,25);l.position.set(0,.48,.246);g.add(l);sharpsBins.push({group:g,x,z})})}        
function ensureWaferPickupGuide(){if(phys.pickupGuide)return phys.pickupGuide;const g=new THREE.Group(),ring=mesh(new THREE.TorusGeometry(.42,.016,10,48),new THREE.MeshBasicMaterial({color:C.cyan,transparent:true,opacity:.9,toneMapped:false}),g);ring.rotation.x=Math.PI/2;const pillar=mesh(new THREE.CylinderGeometry(.008,.008,.5,8),new THREE.MeshBasicMaterial({color:C.cyan,transparent:true,opacity:.55,toneMapped:false}),g,0,.27,0);const arrow=mesh(new THREE.ConeGeometry(.065,.16,12),new THREE.MeshBasicMaterial({color:C.green,toneMapped:false}),g,0,.58,0);arrow.rotation.x=Math.PI;const label=labelMesh('PINCH WAFER HERE','#ffffff',1.25,.24,28);label.position.set(0,.78,0);label.rotation.x=-.18;g.add(label);g.visible=false;scene.add(g);phys.pickupGuide=g;return g}        
function updateWaferPickupGuide(now){const g=ensureWaferPickupGuide();g.visible=renderer.xr.isPresenting&&phys.waferStaged&&!phys.waferEverPicked&&state.handWafer?.visible;if(g.visible){const p=state.handWafer.getWorldPosition(new THREE.Vector3());g.position.set(p.x,p.y+.025,p.z);g.rotation.y=now*.001;const q=.95+.08*Math.sin(now*.006);g.scale.setScalar(q)}}        
function createXROverlay(){xrOverlayCanvas=document.createElement('canvas');xrOverlayCanvas.width=1024;xrOverlayCanvas.height=640;xrOverlayCtx=xrOverlayCanvas.getContext('2d');installScaledCanvasText(xrOverlayCtx);xrOverlayTexture=new THREE.CanvasTexture(xrOverlayCanvas);xrOverlayTexture.colorSpace=THREE.SRGBColorSpace;xrOverlay=mesh(new THREE.PlaneGeometry(1.35,.84),new THREE.MeshBasicMaterial({map:xrOverlayTexture,transparent:true,depthTest:false,toneMapped:false}),camera,0,0,-1.45);xrOverlay.renderOrder=999;xrOverlay.visible=false}
function drawXRMainMenuOverlay(){
  if(!xrOverlayCtx||!xrOverlayTexture)return;
  const g=xrOverlayCtx;
  g.fillStyle='rgba(3,12,20,.98)';g.fillRect(0,0,1024,640);
  g.strokeStyle='#53e7ff';g.lineWidth=10;g.strokeRect(10,10,1004,620);
  g.textAlign='center';g.fillStyle='#53e7ff';g.font='900 58px system-ui';
  g.fillText('SILICON RUN',512,120);
  g.fillStyle='#a9c0cb';g.font='22px monospace';
  g.fillText('SELECT HOW TO ENTER THE CLEANROOM',512,170);
  g.fillStyle='rgba(12,34,46,.96)';g.strokeStyle='#67f6a3';g.lineWidth=4;
  g.fillRect(112,250,800,115);g.strokeRect(112,250,800,115);
  g.fillStyle='#67f6a3';g.font='900 36px system-ui';g.fillText('START TUTORIAL',512,305);
  g.fillStyle='#d9e8ed';g.font='20px monospace';g.fillText('A BUTTON / RIGHT TRIGGER',512,340);
  g.fillStyle='rgba(12,34,46,.96)';g.strokeStyle='#53e7ff';
  g.fillRect(112,390,800,115);g.strokeRect(112,390,800,115);
  g.fillStyle='#53e7ff';g.font='900 36px system-ui';g.fillText('START STANDARD RUN',512,445);
  g.fillStyle='#d9e8ed';g.font='20px monospace';g.fillText('B BUTTON',512,480);
  g.fillStyle='#8ca7b8';g.font='17px monospace';
  g.fillText('The tutorial displays every instruction in VR. No keyboard is required.',512,570);
  xrOverlayTexture.needsUpdate=true;if(xrOverlay)xrOverlay.visible=true;
}
function startVRMainMenuChoice(tutorial){
  xrMainMenuActive=false;
  state.paused=false;
  if(!($('username')?.value.trim())&&$('username'))$('username').value='VR Operator';
  if(!($('operator')?.textContent.trim()))$('operator').textContent=$('username')?.value.trim()||'VR Operator';
  userPreferences.username=$('username')?.value.trim()||'VR Operator';
  saveUserPreferences();
  hideXROverlay();
  beginMenuRun(tutorial);
}
const controlsTraining={
  active:false,mode:'desktop',stepIndex:0,completed:false,mouseMoveDistance:0,edgeLatches:{},
  desktopSteps:[
    {id:'move',title:'Move Around Cleanroom (W A S D)',desc:'Press movement keys 3 times to walk through the cleanroom bays.',loc:'Keyboard: W, A, S, D or Arrow keys (left hand)',target:3,keys:['W','A','S','D']},
    {id:'look',title:'Look & Aim (Mouse)',desc:'Move the mouse to aim the centre reticle at machines, doors, and dials.',loc:'Mouse: Move cursor across viewport',target:3,keys:['MouseMove']},
    {id:'crouch',title:'Crouch (Shift)',desc:'Hold Shift 3 times to crouch down and reach lower panel buttons.',loc:'Keyboard: Left Shift (left pinky)',target:3,keys:['Shift']},
    {id:'sprint',title:'Sprint (Ctrl)',desc:'Tap or hold Ctrl 3 times while moving to sprint using capacitor stamina.',loc:'Keyboard: Left Ctrl (bottom-left corner)',target:3,keys:['Ctrl']},
    {id:'operate',title:'Operate & Grab Wafers (E / Left Click)',desc:'Press E or Left Click 3 times. Point & press to operate controls; hold Left Mouse to grab and move wafers.',loc:'Keyboard: E (next to W) or Mouse Left Button',target:3,keys:['E','LeftClick']},
    {id:'wheel',title:'Adjust Dials & Reach Depth (Mouse Wheel)',desc:'Scroll the Mouse Wheel 3 ticks to rotate dials/sliders or adjust held wafer depth.',loc:'Mouse: Scroll wheel between Left & Right buttons',target:3,keys:['Wheel']},
    {id:'help',title:'Control Help & Pause (F1 / Esc)',desc:'Press F1 or Esc once to confirm you know how to open Controls Help or Pause.',loc:'Keyboard: F1 or Escape (top-left row)',target:1,keys:['F1','Esc']}
  ],
  vrSteps:[
    {id:'r_trigger',vrHand:'right',vrInput:'trigger',title:'Right Trigger (Index Finger)',desc:'Pull the Right Trigger 3 times. Used to grab/release wafers, pull sliders, and select controls.',loc:'Right Touch Plus: Under front index finger',target:3},
    {id:'l_trigger',vrHand:'left',vrInput:'trigger',title:'Left Trigger (Index Finger)',desc:'Pull the Left Trigger 3 times. Used to grab/release wafers or adjust controls with your left hand.',loc:'Left Touch Plus: Under front index finger',target:3},
    {id:'r_grip',vrHand:'right',vrInput:'grip',title:'Right Grip (Middle Finger)',desc:'Squeeze the Right Grip 3 times. Used to grab & swing machine doors and sprint while moving.',loc:'Right Touch Plus: Inner handle under middle finger',target:3},
    {id:'l_grip',vrHand:'left',vrInput:'grip',title:'Left Grip (Middle Finger)',desc:'Squeeze the Left Grip 3 times. Hold to crouch down for lower panel switches.',loc:'Left Touch Plus: Inner handle under middle finger',target:3},
    {id:'btn_a',vrHand:'right',vrInput:'face0',title:'A Button',desc:'Press the A button 3 times. Activates focused machine buttons and sweeps broken wafer shard piles.',loc:'Right Touch Plus: Lower face button on dark circular pad',target:3},
    {id:'btn_b',vrHand:'right',vrInput:'face1',title:'B Button',desc:'Press the B button 3 times. Opens or closes the Pause & Settings overlay.',loc:'Right Touch Plus: Upper face button on dark circular pad',target:3},
    {id:'btn_x',vrHand:'left',vrInput:'face0',title:'X Button',desc:'Press the X button 3 times. Jumps in physical-space mode.',loc:'Left Touch Plus: Lower face button on dark circular pad',target:3},
    {id:'btn_y',vrHand:'left',vrInput:'face1',title:'Y Button',desc:'Press the Y button 3 times. Toggles the overhead cleanroom objective beacon.',loc:'Left Touch Plus: Upper face button on dark circular pad',target:3},
    {id:'l_stick',vrHand:'left',vrInput:'stick',title:'Left Thumbstick + L3 Click',desc:'Push or click the Left Thumbstick 3 times. Walks around the room; L3 click toggles the wrist traveller HUD.',loc:'Left Touch Plus: Upper-inner thumbstick on faceplate',target:3},
    {id:'r_stick',vrHand:'right',vrInput:'stick',title:'Right Thumbstick + R3 Click',desc:'Push or click the Right Thumbstick 3 times. Snap-turns left/right, adjusts focused controls, R3 pauses.',loc:'Right Touch Plus: Upper-inner thumbstick on faceplate',target:3}
  ],
  counts:{}
};
function controlsTrainingSteps(){return controlsTraining.mode==='vr'?controlsTraining.vrSteps:controlsTraining.desktopSteps}
function controlsTrainingCurrent(){const steps=controlsTrainingSteps();return steps[clamp(controlsTraining.stepIndex,0,steps.length-1)]||null}
function controlsTrainingEdge(key,active){const prev=!!controlsTraining.edgeLatches[key];controlsTraining.edgeLatches[key]=!!active;return!!active&&!prev}
function advanceControlsTraining(stepId,amount=1){
  if(!controlsTraining.active)return;
  const cur=controlsTrainingCurrent();if(!cur||cur.id!==stepId)return;
  controlsTraining.counts[cur.id]=Math.min(cur.target,(controlsTraining.counts[cur.id]||0)+amount);
  if(controlsTraining.mode==='vr')pulseXR(.28,32);
  if(controlsTraining.counts[cur.id]>=cur.target){
    const steps=controlsTrainingSteps();
    if(controlsTraining.stepIndex<steps.length-1){controlsTraining.stepIndex++;if(controlsTraining.mode==='vr')pulseXR(.5,55)}
    else{controlsTraining.completed=true;if(controlsTraining.mode==='vr'){finishControlsTraining();return}}
  }
  if(controlsTraining.mode==='desktop')renderDesktopControlsTraining();
  else drawXRPauseOverlay();
}
function startControlsTraining(mode=renderer?.xr?.isPresenting?'vr':'desktop'){
  controlsTraining.active=true;controlsTraining.mode=mode;controlsTraining.stepIndex=0;controlsTraining.completed=false;controlsTraining.counts={};controlsTraining.mouseMoveDistance=0;controlsTraining.edgeLatches={};
  if(mode==='desktop'){
    state.paused=true;document.exitPointerLock?.();
    if($('controlsTrainingPanel'))$('controlsTrainingPanel').hidden=false;
    renderDesktopControlsTraining();
  }else{
    state.paused=true;
    if($('controlsTrainingPanel'))$('controlsTrainingPanel').hidden=true;
    showXROverlay('pause');
  }
}
function finishControlsTraining(){
  controlsTraining.active=false;controlsTraining.completed=true;
  if($('controlsTrainingPanel'))$('controlsTrainingPanel').hidden=true;
  state.paused=false;
  if(renderer?.xr?.isPresenting)hideXROverlay();
  else try{renderer.domElement.requestPointerLock?.()?.catch(()=>{})}catch{}
  newRun();
  toast('Controls verified! Tutorial cleanroom run started. Dispense a blank wafer to begin the timer.');
  refreshTutorialCoach();
}
function renderDesktopControlsTraining(){
  if(!$('controlsTrainingPanel'))return;
  const steps=controlsTraining.desktopSteps,cur=controlsTrainingCurrent();
  const count=cur?(controlsTraining.counts[cur.id]||0):0;
  $('trainingPromptTitle').textContent=controlsTraining.completed?'All Controls Verified!':cur.title;
  $('trainingPromptText').textContent=controlsTraining.completed?'Every input check passed. Click START CLEANROOM LEVEL to begin the guided cleanroom tutorial.':cur.desc;
  $('trainingLocationText').textContent=controlsTraining.completed?'Ready — timer remains at 00:00.000 until you dispense a wafer.':`WHERE: ${cur.loc}`;
  $('trainingProgressBadge').textContent=controlsTraining.completed?'READY':`${count} / ${cur.target}`;
  $('trainingMeterFill').style.width=(controlsTraining.completed?100:count/cur.target*100)+'%';
  $('trainingBegin').disabled=!controlsTraining.completed;
  document.querySelectorAll('#trainingDiagram [data-key]').forEach(el=>{
    el.classList.toggle('target-highlight',!controlsTraining.completed&&cur.keys.includes(el.dataset.key));
  });
  $('trainingChecklist').innerHTML=steps.map((s,idx)=>{
    const c=controlsTraining.counts[s.id]||0,done=c>=s.target;
    const cls=done?'done':idx===controlsTraining.stepIndex&&!controlsTraining.completed?'current':'';
    return`<li class="${cls}"><span>${escapeHtml(s.title.split('(')[0].trim())}</span><strong>${c}/${s.target}</strong></li>`;
  }).join('');
}
function pollVRControlsTraining(){
  if(!controlsTraining.active||!renderer?.xr?.isPresenting)return;
  if(controlsTraining.mode!=='vr'){controlsTraining.mode='vr';controlsTraining.stepIndex=0;controlsTraining.counts={};controlsTraining.edgeLatches={};if($('controlsTrainingPanel'))$('controlsTrainingPanel').hidden=true;showXROverlay('pause')}
  const l=xrLeftSource?.gamepad,r=xrRightSource?.gamepad;
  const check=(key,active,stepId)=>{if(controlsTrainingEdge(key,active))advanceControlsTraining(stepId,1)};
  if(r){
    check('rt',(r.buttons?.[0]?.value||0)>.55,'r_trigger');
    check('rg',(r.buttons?.[1]?.value||0)>.55,'r_grip');
    check('ra',xrButtonPressed(xrRightSource,4),'btn_a');
    check('rb',xrButtonPressed(xrRightSource,5),'btn_b');
    const rsMove=Math.hypot(r.axes?.[2]||0,r.axes?.[3]||0)>.55||xrButtonPressed(xrRightSource,3);
    check('rs',rsMove,'r_stick');
  }
  if(l){
    check('lt',(l.buttons?.[0]?.value||0)>.55,'l_trigger');
    check('lg',(l.buttons?.[1]?.value||0)>.55,'l_grip');
    check('lx',xrButtonPressed(xrLeftSource,4),'btn_x');
    check('ly',xrButtonPressed(xrLeftSource,5),'btn_y');
    const lsMove=Math.hypot(l.axes?.[2]||0,l.axes?.[3]||0)>.55||xrButtonPressed(xrLeftSource,3);
    check('ls',lsMove,'l_stick');
  }
  if(l&&r&&xrButtonPressed(xrLeftSource,5)&&xrButtonPressed(xrRightSource,5)){
    if(controlsTrainingEdge('skip_vr',true))finishControlsTraining();
  }else controlsTrainingEdge('skip_vr',false);
  drawXRPauseOverlay();
}
function showXROverlay(mode='pause'){if(mode==='pause'){drawXRPauseOverlay();if(xrOverlay)xrOverlay.visible=true;return}const g=xrOverlayCtx;g.fillStyle='rgba(3,12,20,.96)';g.fillRect(0,0,1024,640);g.strokeStyle='#67f6a3';g.lineWidth=14;g.strokeRect(10,10,1004,620);g.textAlign='center';g.fillStyle='#67f6a3';g.font='900 64px system-ui';g.fillText('LOT COMPLETE',512,110);g.fillStyle='#eefcff';g.font='32px monospace';g.fillText(`${state.lotId} // QUALITY ${quality().toFixed(1)}%`,512,190);g.fillText(`TIME ${formatTime(state.elapsed)}`,512,245);g.fillStyle='#a9c0cb';g.fillText('Right stick click: close report',512,520);xrOverlayTexture.needsUpdate=true;xrOverlay.visible=true}
function xrButtonPressed(source,index){const button=source?.gamepad?.buttons?.[index];return!!(button?.pressed||(button?.value||0)>.28)}
function drawXRDiagramLabel(ctx,x,y,width,title,action,active,highlighted=false){ctx.fillStyle=active?'rgba(13,66,41,.96)':highlighted?'rgba(14,54,72,.96)':'rgba(5,16,24,.94)';ctx.strokeStyle=active?'#67f6a3':highlighted?'#ffcf56':'#466170';ctx.lineWidth=active||highlighted?3:2;ctx.fillRect(x,y,width,46);ctx.strokeRect(x,y,width,46);ctx.textAlign='left';ctx.fillStyle=active?'#8cffb8':highlighted?'#ffe28a':'#e5f1f5';ctx.font='800 13px monospace';ctx.fillText(title,x+9,y+18);ctx.fillStyle=active?'#c5ffda':'#9db3bd';ctx.font='11px monospace';ctx.fillText(action,x+9,y+35)}
function drawXRControllerGlyph(ctx,cx,cy,hand,source,highlightInput=null){
  const gp=source?.gamepad,axes=gp?.axes||[],stickX=axes[2]||0,stickY=axes[3]||0,stickActive=Math.hypot(stickX,stickY)>.18,stickClick=xrButtonPressed(source,3),faceOne=xrButtonPressed(source,4),faceTwo=xrButtonPressed(source,5),trigger=clamp(gp?.buttons?.[0]?.value||0,0,1),grip=clamp(gp?.buttons?.[1]?.value||0,0,1),active='#67f6a3',warn='#ffcf56';
  const pulse=Math.sin(performance.now()*.012)>0;
  const mirror=hand==='left'?-1:1;
  ctx.save();ctx.translate(cx,cy);
  // Ringless Meta Quest Touch Plus handle + dark circular faceplate silhouette
  ctx.fillStyle='#e5ecf0';ctx.strokeStyle='#91a5af';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-26,-2);ctx.lineTo(-22,126);ctx.quadraticCurveTo(0,152,22,126);ctx.lineTo(26,-2);ctx.closePath();ctx.fill();ctx.stroke();
  // Grip button on inner handle side
  ctx.fillStyle=grip>.08?active:highlightInput==='grip'?(pulse?warn:'#53e7ff'):'#b8c5cd';
  ctx.fillRect(mirror>0?-29:17,22,12,42);
  // Circular/oval matte-charcoal thumb faceplate with light bezel
  ctx.fillStyle='#192027';ctx.strokeStyle='#d7e2e8';ctx.lineWidth=4;
  ctx.beginPath();ctx.ellipse(0,-58,68,72,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Front index trigger peeking under nose
  ctx.fillStyle=trigger>.08?active:highlightInput==='trigger'?(pulse?warn:'#53e7ff'):'#cfd9df';
  ctx.beginPath();ctx.roundRect?.(-16,-142,32,14,5)??ctx.rect(-16,-142,32,14);ctx.fill();
  // Thumbstick (upper-inner)
  const sx=-mirror*24,sy=-74;
  ctx.fillStyle='#0a1015';ctx.strokeStyle=stickActive?active:highlightInput==='stick'?(pulse?warn:'#53e7ff'):'#788b95';ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(sx,sy,22,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=stickActive?active:'#495b66';
  ctx.beginPath();ctx.arc(sx+clamp(stickX,-1,1)*11,sy+clamp(stickY,-1,1)*11,10,0,Math.PI*2);ctx.fill();
  // Face buttons (X/Y on left, A/B on right)
  const firstLabel=hand==='left'?'X':'A',secondLabel=hand==='left'?'Y':'B';
  [[mirror*22,-32,firstLabel,faceOne,'face0'],[mirror*38,-68,secondLabel,faceTwo,'face1']].forEach(([x,y,label,pressed,id])=>{
    const hi=highlightInput===id;
    ctx.fillStyle=pressed?active:hi?(pulse?warn:'#53e7ff'):'#1f2830';
    ctx.strokeStyle=pressed?'#b8ffcf':hi?'#fff':'#80949e';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=pressed||hi?'#03130a':'#eaf4f7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 12px monospace';ctx.fillText(label,x,y);
  });
  // Menu / Meta pill button
  ctx.fillStyle=stickClick?active:'#24343d';ctx.strokeStyle='#80949e';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(-mirror*32,-26,8,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Callout ring around highlighted training target
  const spots={trigger:[0,-135],grip:[mirror>0?-23:23,43],stick:[sx,sy],face0:[mirror*22,-32],face1:[mirror*38,-68]};
  if(highlightInput&&spots[highlightInput]){
    const [hx,hy]=spots[highlightInput];
    ctx.strokeStyle=pulse?'#ffcf56':'#53e7ff';ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(hx,hy,28,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
  const panelLeft=hand==='left'?20:520,labelLeft=panelLeft+14,labelRight=panelLeft+328,buttonW=142;
  drawXRDiagramLabel(ctx,labelLeft,196,buttonW,'TRIGGER','GRAB / SELECT',trigger>.08,highlightInput==='trigger');
  drawXRDiagramLabel(ctx,labelLeft,250,buttonW,'GRIP',hand==='left'?'CROUCH':'DOOR / SPRINT',grip>.08,highlightInput==='grip');
  drawXRDiagramLabel(ctx,labelRight,250,buttonW,'STICK',hand==='left'?'MOVE':'TURN / ADJUST',stickActive,highlightInput==='stick');
  drawXRDiagramLabel(ctx,labelRight,302,buttonW,hand==='left'?'L3 CLICK':'R3 CLICK',hand==='left'?'SPEC HUD':'PAUSE / RESUME',stickClick,highlightInput==='stick');
  drawXRDiagramLabel(ctx,labelRight,354,buttonW,`${firstLabel} BUTTON`,hand==='left'?'JUMP':'OPERATE / SWEEP',faceOne,highlightInput==='face0');
  drawXRDiagramLabel(ctx,labelRight,406,buttonW,`${secondLabel} BUTTON`,hand==='left'?'BEACON':'PAUSE / MENU',faceTwo,highlightInput==='face1');
}
function drawXRPauseOverlay(){
  if(!xrOverlayCtx||!xrOverlayTexture)return;
  const g=xrOverlayCtx;g.fillStyle='rgba(3,12,20,.98)';g.fillRect(0,0,1024,640);g.strokeStyle='#53e7ff';g.lineWidth=8;g.strokeRect(8,8,1008,624);g.textAlign='center';g.textBaseline='alphabetic';
  if(controlsTraining.active){
    const cur=controlsTrainingCurrent(),steps=controlsTraining.vrSteps,count=cur?(controlsTraining.counts[cur.id]||0):0;
    g.fillStyle='#53e7ff';g.font='900 34px system-ui';g.fillText('VR TOUCH PLUS CONTROLS TRAINING',512,50);
    g.fillStyle='#ffcf56';g.font='800 18px monospace';g.fillText(`STEP ${controlsTraining.stepIndex+1}/${steps.length} · ${cur.title.toUpperCase()} (${count}/${cur.target})`,512,82);
    g.fillStyle='#e3f1f6';g.font='14px monospace';g.fillText(cur.desc.slice(0,86),512,108);
    g.fillStyle='rgba(9,24,33,.88)';g.strokeStyle='#315163';g.lineWidth=2;g.fillRect(18,124,484,420);g.strokeRect(18,124,484,420);g.fillRect(522,124,484,420);g.strokeRect(522,124,484,420);
    g.fillStyle='#d9e8ed';g.font='800 15px monospace';g.fillText('LEFT TOUCH PLUS',260,152);g.fillText('RIGHT TOUCH PLUS',764,152);
    drawXRControllerGlyph(g,260,382,'left',xrLeftSource,cur.vrHand==='left'?cur.vrInput:null);
    drawXRControllerGlyph(g,764,382,'right',xrRightSource,cur.vrHand==='right'?cur.vrInput:null);
    g.fillStyle='#67f6a3';g.font='800 15px monospace';g.fillText(`LOCATION: ${cur.loc}`,512,576);
    g.fillStyle='#8ca7b8';g.font='13px monospace';g.fillText('Timer stays at 00:00 until training finishes · Hold Y + B to skip',512,608);
    xrOverlayTexture.needsUpdate=true;return;
  }
  g.fillStyle='#53e7ff';g.font='900 44px system-ui';g.fillText(xrPausePage==='more'?'MORE SETTINGS':'PAUSED',512,62);
  if(xrPausePage==='more'){
    g.fillStyle='#d9e8ed';g.font='800 19px monospace';g.fillText('DEVELOPER DIAGNOSTICS',512,160);g.fillStyle=userPreferences.developerPanel?'#67f6a3':'#a9c0cb';g.font='900 27px monospace';g.fillText(userPreferences.developerPanel?'ON':'OFF',512,205);g.fillStyle='#d9e8ed';g.font='800 19px monospace';g.fillText(`GUI TEXT SIZE: ${userPreferences.guiTextSize}`,512,292);g.fillStyle='#a9c0cb';g.font='16px monospace';g.fillText('LEFT Y: TOGGLE DIAGNOSTICS',512,375);g.fillText('RIGHT A / B: SMALLER / LARGER TEXT',512,413);g.fillText('LEFT X: BACK',512,471);if(userPreferences.developerPanel){g.fillStyle='#67f6a3';g.fillText(`${currentFPS} FPS · FoM ${developerSnapshot().score?.toFixed(1)??'--'}%`,512,526)}g.fillStyle='#67f6a3';g.font='800 16px monospace';g.fillText('RIGHT STICK: RESUME',512,592)
  }else{
    g.fillStyle='#b8cbd3';g.font='16px monospace';g.fillText('PLAYER AND WORLD INPUTS LOCKED',512,94);g.fillStyle='rgba(9,24,33,.88)';g.strokeStyle='#315163';g.lineWidth=2;g.fillRect(18,122,484,484);g.strokeRect(18,122,484,484);g.fillRect(522,122,484,484);g.strokeRect(522,122,484,484);g.fillStyle='#d9e8ed';g.font='800 16px monospace';g.fillText('LEFT TOUCH PLUS CONTROLLER',260,154);g.fillText('RIGHT TOUCH PLUS CONTROLLER',764,154);drawXRControllerGlyph(g,260,400,'left',xrLeftSource);drawXRControllerGlyph(g,764,400,'right',xrRightSource);g.fillStyle='#b8cbd3';g.font='14px monospace';g.fillText('LEFT X: MORE SETTINGS',512,558);g.fillStyle='#67f6a3';g.font='800 14px monospace';g.fillText('PRESS RIGHT STICK, A OR B TO RESUME',512,592)
  }
  xrOverlayTexture.needsUpdate=true
}
function freezeXRWorldForPause(){for(const controller of [xrController0,xrController1]){if(!controller)continue;const grab=parallel.grabs.get(handKey(controller));if(!grab)continue;if(grab.kind==='wafer'){detachPreserve(grab.body.view,scene);grab.body.heldBy=null;grab.body.dynamic=false;grab.body.velocity.set(0,0,0)}else if(grab.kind==='shard'){detachPreserve(grab.shard.mesh,scene);grab.shard.v.set(0,0,0)}clearHandGrab(controller)}phys.grab=null;phys.doorGrab=null;phys.doorVelocities.fill(0);phys.crouchHeld=false;parallel.sprintHeld=false;state.carrying=carriedWafers().length>0}
function setXRPaused(paused){if(state.paused===paused)return;state.paused=paused;if(paused){xrPausePage='pause';freezeXRWorldForPause();showXROverlay('pause')}else hideXROverlay()}
function hideXROverlay(){if(xrOverlay)xrOverlay.visible=false}        
function controllerWorld(c){return c.getWorldPosition(new THREE.Vector3())}        
function pinchAnchorFor(c){return c?.userData?.pinchAnchor||c}        
function pinchWorld(c){return pinchAnchorFor(c).getWorldPosition(new THREE.Vector3())}        
function nearestWaferDistance(c){if(!state.handWafer||!state.handWafer.visible)return Infinity;return pinchWorld(c).distanceTo(state.handWafer.getWorldPosition(new THREE.Vector3()))}        
function nearestPinchTarget(anchor){if(!anchor)return null;const p=anchor.getWorldPosition(new THREE.Vector3());let best=null,d=.34;if(state.handWafer?.visible&&!state.waferBroken){const q=state.handWafer.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);if(n<d){d=n;best={kind:'wafer',object:state.handWafer,distance:n,point:q}}}for(const shard of waferShards){const q=shard.mesh.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);if(n<d){d=n;best={kind:'shard',object:shard.mesh,distance:n,point:q}}}if(state.focus){const q=state.focus.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);if(n<d){d=n;best={kind:state.focus.userData.type,object:state.focus,distance:n,point:q}}}return best}        
function nearestInteractiveAtPinch(c,max=phys.pinchDistance){const p=pinchWorld(c);let best=null,d=max;for(const object of interactives){const q=object.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);if(n<=d){d=n;best={object,data:object.userData,distance:n,point:q}}}return best}        
function detachPreserve(obj,newParent){obj.updateMatrixWorld(true);newParent.attach(obj)}        
function bindWaferPhysics(view){phys.waferBody={view,velocity:phys.waferVelocity,dynamic:false,staged:false};view.userData.physicsBody=phys.waferBody;return phys.waferBody}        
function setWaferDynamic(dynamic){phys.waferFree=dynamic;if(phys.waferBody)phys.waferBody.dynamic=dynamic}        
function setWaferStaged(staged){phys.waferStaged=staged;if(phys.waferBody)phys.waferBody.staged=staged}        
function stockSpawnWorld(){return stockMachine.group.localToWorld(stockMachine.spawnLocal.clone())}        
function stockSpawnQuaternion(){const q=stockMachine.group.getWorldQuaternion(new THREE.Quaternion()),flat=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));return q.multiply(flat)}        
function placeWaferAtStock(){const wafer=phys.waferBody?.view||state.handWafer;if(wafer.parent)wafer.parent.remove(wafer);scene.add(wafer);wafer.position.copy(stockSpawnWorld());wafer.quaternion.copy(stockSpawnQuaternion());wafer.scale.setScalar(1);wafer.visible=true;phys.stockReady=wafer;phys.waferVelocity.set(0,0,0);setWaferDynamic(false);setWaferStaged(true);phys.stockRespawnAt=0;state.carrying=false;ensureWaferPickupGuide()}        
function exposeCompletedWafer(){const i=state.current,st=status[i],m=machines[i+1],wafer=phys.waferBody?.view||state.handWafer;if(st?.state==='done'&&st.doorAmount>.45&&m.wafer.visible&&!state.carrying&&!state.waferBroken){const wp=m.wafer.getWorldPosition(new THREE.Vector3()),wq=m.wafer.getWorldQuaternion(new THREE.Quaternion());m.wafer.visible=false;if(wafer.parent)wafer.parent.remove(wafer);scene.add(wafer);wafer.position.copy(wp);wafer.quaternion.copy(wq);wafer.scale.setScalar(1);wafer.visible=true;phys.waferVelocity.set(0,0,0);setWaferDynamic(true);setWaferStaged(false)}}        
function nearestShard(c){const p=pinchWorld(c);let best=null,d=phys.pinchDistance;for(const q of waferShards){const n=p.distanceTo(q.mesh.position);if(n<d){d=n;best=q}}return best}        
function grabShard(c){const q=nearestShard(c);if(!q)return false;const anchor=pinchAnchorFor(c);detachPreserve(q.mesh,anchor);q.mesh.position.set(0,0,0);q.v.set(0,0,0);phys.grab={kind:'shard',controller:c,shard:q};pulseXR(.2,25);return true}        
function releaseShard(c){const g=phys.grab;if(g?.kind!=='shard'||g.controller!==c)return;detachPreserve(g.shard.mesh,scene);g.shard.v.copy(phys.handVelocity);phys.grab=null}        
function updateStockRobot(dt){
  const r=stockMachine?.robot;if(!r)return;
  if(r.phase==='animating'){
    r.t=Math.min(1,r.t+dt/2.1);
    const t=r.t;
    let yawA=-Math.PI/2,lift=.28,reach=.44,showWafer=false;
    if(t<.24){
      const u=t/.24;yawA=-Math.PI/2;lift=.28;reach=lerp(.44,1.04,u);showWafer=false;
    }else if(t<.38){
      const u=(t-.24)/.14;yawA=-Math.PI/2;lift=lerp(.28,.42,u);reach=1.04;showWafer=true;
    }else if(t<.58){
      const u=(t-.38)/.20;yawA=-Math.PI/2;lift=.42;reach=lerp(1.04,.44,u);showWafer=true;
    }else if(t<.80){
      const u=(t-.58)/.22;yawA=lerp(-Math.PI/2,r.yawOffer,u);lift=lerp(.42,.33,u);reach=.44;showWafer=true;
    }else{
      const u=(t-.80)/.20;yawA=r.yawOffer;lift=.33;reach=lerp(.44,r.reachOffer,u);showWafer=true;
    }
    r.turret.rotation.y=yawA;r.lift.position.y=lift;r.fork.position.z=reach;
    r.boom.scale.z=Math.max(.1,reach);r.boom.position.z=reach*.5;
    r.armWafer.visible=showWafer&&t<1;
    if(t>=1){r.phase='offering';r.armWafer.visible=false}
  }else{
    r.turret.rotation.y=r.yawOffer;r.lift.position.y=.33;r.fork.position.z=r.reachOffer;
    r.boom.scale.z=r.reachOffer;r.boom.position.z=r.reachOffer*.5;
    r.armWafer.visible=false;
  }
}
function updateStockSupply(now){
  const dt=Math.min(.05,(now-(stockMachine?._lastSupplyAt||now))/1000||.016);
  if(stockMachine)stockMachine._lastSupplyAt=now;
  updateStockRobot(dt);
  if(stockMachine?.robot?.phase==='offering'&&!phys.stockReady){
    const spare=createWafer(.72);spare.position.copy(stockSpawnWorld());spare.quaternion.copy(stockSpawnQuaternion());spare.scale.setScalar(1);scene.add(spare);phys.stockReady=spare;phys.stockRespawnAt=0;
  }
  if(stockMachine?.ring){const pulse=.88+.14*Math.sin(now*.005);stockMachine.ring.scale.setScalar(pulse);stockMachine.ring.material.color.setHex(phys.stockReady?C.green:C.cyan)}
}
function grabWafer(c){const d=nearestWaferDistance(c);if(state.waferBroken||d>phys.pinchDistance)return false;const wafer=phys.waferBody?.view||state.handWafer,anchor=pinchAnchorFor(c);detachPreserve(wafer,anchor);wafer.position.set(0,0,0);wafer.rotation.set(-.08,0,0);wafer.scale.setScalar(1);wafer.visible=true;state.carrying=true;setWaferDynamic(false);setWaferStaged(false);phys.waferEverPicked=true;phys.stockReady=null;phys.stockRespawnAt=performance.now()+phys.stockRespawnMs;if(phys.pickupGuide)phys.pickupGuide.visible=false;if(status[state.current]?.state==='done')status[state.current].state='unloadedDoorOpen';phys.grab={kind:'wafer',controller:c,anchor};phys.lastHandPos.copy(pinchWorld(c));pulseXR(.6,65);toast(`${c.userData.handedness||'Controller'} hand attached at pinch marker.`);return true}        
function releaseWafer(c){if(phys.grab?.kind!=='wafer'||phys.grab.controller!==c)return;const wafer=phys.waferBody?.view||state.handWafer;detachPreserve(wafer,scene);phys.waferVelocity.copy(phys.handVelocity);phys.waferReleaseY=wafer.getWorldPosition(new THREE.Vector3()).y;wafer.visible=true;setWaferDynamic(true);setWaferStaged(false);state.carrying=false;phys.grab=null;tryPlaceWafer();pulseXR(.25,28)}        
function tryPlaceWafer(){const wafer=phys.waferBody?.view||state.handWafer;if(!wafer?.visible||state.waferBroken)return;const i=state.current,m=machines[i+1],st=status[i],wp=wafer.getWorldPosition(new THREE.Vector3()),target=m.wafer.getWorldPosition(new THREE.Vector3());if(st.doorAmount>.45&&wp.distanceTo(target)<.52&&['ready','done'].includes(st.state)){setWaferDynamic(false);wafer.visible=false;if(st.state==='ready'){m.wafer.visible=true;refreshWaferVisual(m.wafer);st.state='loadedDoorOpen';toast('Wafer seated physically. Close the door to enable START.')}else{m.wafer.visible=false;wafer.visible=true;wafer.position.copy(target);setWaferDynamic(true);toast('Completed wafer removed. Pick it up with trigger.')}pulseXR(.65,70);updateAll()}}        
function shatterWafer(point,impact){if(state.waferBroken)return;state.waferBroken=true;state.carrying=false;setWaferDynamic(false);setWaferStaged(false);if(phys.pickupGuide)phys.pickupGuide.visible=false;if(state.handWafer)state.handWafer.visible=false;for(let i=0;i<14;i++){const shard=mesh(crackedFragmentGeometry(.035+Math.random()*.035),mat(0xb9ccd2,.72,.18),scene,point.x,point.y,point.z);const v=new THREE.Vector3((Math.random()-.5)*impact,(Math.random()*.7+.15)*impact,(Math.random()-.5)*impact);waferShards.push({mesh:shard,v,life:0})}toast('WAFER FRACTURE. Dispose of every shard in a yellow sharps bin.','bad');pulseXR(1,160)}        
function beginControlGrab(c,d){const m=machines[d.machineIndex+1],ref=m.controls[stations[d.machineIndex].controls.findIndex(x=>x.key===d.controlKey)],wp=pinchWorld(c);phys.grab={kind:'control',controller:c,data:d,ref,start:wp.clone(),last:wp.clone()};pulseXR(.35,35)}        
function updateControlGrab(){const g=phys.grab;if(g?.kind!=='control')return;const i=g.data.machineIndex,spec=stations[i].controls.find(x=>x.key===g.data.controlKey),m=machines[i+1],p=pinchWorld(g.controller),local=m.group.worldToLocal(p.clone());const ref=g.ref;if(spec.style==='slider'){const motion=local.y-m.group.worldToLocal(g.last.clone()).y;if(Math.abs(motion)>.008)adjustControl(g.data,Math.sign(motion))}else{const center=(ref.rotor||ref.mesh).getWorldPosition(new THREE.Vector3()),a=Math.atan2(p.y-center.y,p.x-center.x),b=Math.atan2(g.last.y-center.y,g.last.x-center.x),delta=a-b;if(Math.abs(delta)>.035)adjustControl(g.data,Math.sign(delta))}g.last.copy(p)}        
const _doorLockNoticeAt=[];
function isDoorLocked(i){return status[i]?.state==='running'}
function notifyDoorLocked(i){
  const now=performance.now();
  if(now-(_doorLockNoticeAt[i]||0)<1200)return;
  _doorLockNoticeAt[i]=now;
  toast((stations[i]?.name||'Machine')+' door is locked while running. Press STOP first.','warn');
  pulseXR(.22,30);
}
function beginDoorGrab(c){
const p=pinchWorld(c);
let best=null,bestD=1.05;
status.forEach((st,i)=>{
const m=machines[i+1];if(!m||m.kind!=='fabrication'||!m.door)return;const grip=m.doorHandle||m.door.userData.handle||m.door;
const gripP=grip.getWorldPosition(new THREE.Vector3()),d=p.distanceTo(gripP);
if(d<bestD){bestD=d;best={i,m,grip}}
});
if(!best)return false;
if(isDoorLocked(best.i)){notifyDoorLocked(best.i);return false}
state.focus=best.grip;
phys.doorGrab={i:best.i,controller:c,last:p.clone(),handle:best.grip};
phys.doorVelocities[best.i]=0;
pulseXR(.48,45);
toast('Door handle grip attached. Pull or push the handle to swing the door.');
return true
}
function updateDoorGrab(dt){const g=phys.doorGrab;if(!g)return;const st=status[g.i];if(isDoorLocked(g.i)){phys.doorGrab=null;st.doorAmount=0;st.doorTarget=0;phys.doorVelocities[g.i]=0;notifyDoorLocked(g.i);return}const m=machines[g.i+1],p=pinchWorld(g.controller),pivot=m.door.getWorldPosition(new THREE.Vector3()),lp=m.group.worldToLocal(p.clone()),lh=m.group.worldToLocal(g.last.clone()),a=Math.atan2(lp.z,lp.x),b=Math.atan2(lh.z,lh.x),delta=a-b;st.doorAmount=clamp(st.doorAmount+delta/(Math.PI/2),0,1);phys.doorVelocities[g.i]=delta/(Math.PI/2)/Math.max(dt,.001);g.last.copy(p)}
function onXRTriggerStart(c){if(state.paused)return;if(grabShard(c))return;if(grabWafer(c))return;const rayHit=xrInteractiveHit(c);if(rayHit?.object.userData.kind==='designTerminal'){state.focus=rayHit.object;activateFocused();pulseXR(.45,45);return}const near=nearestInteractiveAtPinch(c),d=near?.data;if(d?.type==='control'){state.focus=near.object;beginControlGrab(c,d);return}if(d?.type==='button'){state.focus=near.object;activateFocused();pulseXR(.45,45);return}pulseXR(.08,18)}        
function onXRTriggerEnd(c){if(phys.grab?.kind==='wafer')releaseWafer(c);else if(phys.grab?.kind==='shard')releaseShard(c);else if(phys.grab?.kind==='control'&&phys.grab.controller===c)phys.grab=null}        
function onXRSqueezeStart(c){if(state.paused)return;if(c.userData.handedness==='left'){phys.crouchHeld=true;pulseXR(.16,20)}else beginDoorGrab(c)}        
function onXRSqueezeEnd(c){if(c.userData.handedness==='left')phys.crouchHeld=false;if(phys.doorGrab?.controller===c){const i=phys.doorGrab.i,st=status[i];phys.doorGrab=null;if(st.doorAmount<5/90){st.doorAmount=0;phys.doorVelocities[i]=0;pulseXR(.75,70)}}}        
function updateWaferPhysics(dt){const body=phys.waferBody,wafer=body?.view;if(!body?.dynamic||!wafer?.visible||state.waferBroken)return;body.velocity.y-=9.81*dt;wafer.position.addScaledVector(body.velocity,dt);const p=wafer.position;if(p.y<.08){const drop=phys.waferReleaseY-p.y,impact=Math.abs(body.velocity.y);if(drop>.5||impact>2.2){shatterWafer(p.clone(),Math.max(1.4,impact*.35));return}p.y=.08;body.velocity.y=Math.abs(body.velocity.y)*.18;body.velocity.x*=.65;body.velocity.z*=.65}if(Math.abs(p.x)>8.8||p.z>11.8||p.z<-41.8){shatterWafer(p.clone(),2.2);return}for(const c of colliders){if(!c.playerOnly&&Math.abs(p.x-c.x)<c.w/2&&Math.abs(p.z-c.z)<c.d/2&&p.y<2.8&&body.velocity.length()>1.7){shatterWafer(p.clone(),body.velocity.length());return}}tryPlaceWafer()}        
function updateShards(dt){for(let i=waferShards.length-1;i>=0;i--){const q=waferShards[i];if(phys.grab?.kind==='shard'&&phys.grab.shard===q)continue;q.v.y-=9.81*dt;q.mesh.position.addScaledVector(q.v,dt);q.life+=dt;if(q.mesh.position.y<.03){q.mesh.position.y=.03;q.v.y=Math.abs(q.v.y)*.2;q.v.x*=.75;q.v.z*=.75}const bin=sharpsBins.find(b=>Math.abs(q.mesh.position.x-b.x)<.24&&Math.abs(q.mesh.position.z-b.z)<.24&&q.mesh.position.y<.75);if(bin){scene.remove(q.mesh);waferShards.splice(i,1)}}if(state.waferBroken&&waferShards.length===0){toast('Sharps cleared. Start another run for a replacement wafer.');state.waferBroken=false}}        
function updatePhysicalSystem(dt,now){if(!renderer.xr.isPresenting)return;exposeCompletedWafer();if(phys.grab?.kind==='wafer'||phys.grab?.kind==='shard'){const p=pinchWorld(phys.grab.controller);phys.handVelocity.copy(p).sub(phys.lastHandPos).divideScalar(Math.max(dt,.001));phys.lastHandPos.copy(p)}updateGhostHandPose(phys.handData[0],xrController0.userData.handedness==='right'?xrRightSource:xrLeftSource,dt);updateGhostHandPose(phys.handData[1],xrController1.userData.handedness==='left'?xrLeftSource:xrRightSource,dt);updateWaferPickupGuide(now);updateStockSupply(now);updateControlGrab();updateDoorGrab(dt);updateWaferPhysics(dt);updateShards(dt)}        
function edgeButton(key,pressed,fn){if(pressed&&!phys.buttons[key])fn();phys.buttons[key]=pressed}        
function updateXRButtons(now){if(!renderer.xr.isPresenting)return;const l=xrLeftSource?.gamepad,r=xrRightSource?.gamepad;if(l){edgeButton('ls',!!l.buttons[3]?.pressed,()=>{phys.hudVisible=!phys.hudVisible;pulseXR(.3,35)});edgeButton('lx',!!l.buttons[4]?.pressed,()=>requestJump());edgeButton('ly',!!l.buttons[5]?.pressed,()=>{phys.beaconVisible=!phys.beaconVisible;phys.hudVisible=true;if(xrObjectiveBeacon)xrObjectiveBeacon.visible=phys.beaconVisible;drawXRHandset(performance.now())})}if(r){edgeButton('rs',!!r.buttons[3]?.pressed,()=>{if(state.completed){hideXROverlay()}else{state.paused=!state.paused;state.paused?showXROverlay('pause'):hideXROverlay()}pulseXR(.4,45)});edgeButton('ra',!!r.buttons[4]?.pressed,()=>{if(state.paused){state.paused=false;hideXROverlay()}else if(state.focus?.userData.type==='button')activateFocused()});edgeButton('rb',!!r.buttons[5]?.pressed,()=>{state.paused=!state.paused;state.paused?showXROverlay('pause'):hideXROverlay()})}}        
function machineShell(g,s){
  const isFab=s.type!=='stock'&&s.type!=='design';
  box(3.1,.28,2.16,mat(0x263e4c,.55,.25),g,0,.14,0);
  box(2.96,1.32,2.02,mat(0x172b38,.5,.3),g,0,.94,0);
  box(3.08,.075,2.12,mat(s.color,.35,.22),g,0,1.6375,0);
  const lamp=cyl(.07,.12,mat(0x263846,.2,.22),g,isFab?1.30:1.22,isFab?3.065:1.735,isFab?.84:.76);
  const label=labelMesh(s.name,'#'+s.color.toString(16).padStart(6,'0'),2.7,.48,27);
  label.position.set(0,isFab?3.28:2.82,.18);g.add(label);return lamp;
}
function createStockMachine(){
  const spec={name:'Blank Wafer Stock',color:C.cyan,side:0,z:10,type:'stock'},g=new THREE.Group();
  g.position.set(0,0,10);g.rotation.y=Math.PI;scene.add(g);
  const lamp=machineShell(g,spec),boxMat=mat(0x0b0f14,.32,.45),steel=mat(0x9fb4bf,.82,.2),dark=mat(0x16222c,.6,.28);
  // 3-sided matte-black wafer cassette box (open side facing +X toward the robot arm) holding 10 stacked blank wafers
  const rackBox=new THREE.Group();rackBox.position.set(-.68,1.675,-.24);rackBox.rotation.y=Math.PI/2;g.add(rackBox);
  box(.62,.035,.62,boxMat,rackBox,0,.0175,0);
  box(.62,.035,.62,boxMat,rackBox,0,.70,0);
  box(.62,.72,.04,boxMat,rackBox,0,.36,-.29);
  box(.04,.72,.62,boxMat,rackBox,-.29,.36,0);
  box(.04,.72,.62,boxMat,rackBox,.29,.36,0);
  for(let k=0;k<10;k++){const sw=createWafer(.72);sw.position.set(0,.08+k*.058,0);sw.rotation.x=-Math.PI/2;rackBox.add(sw)}
  // Articulated SCARA wafer-handling robot arm picking from the 3-sided box and extending out over the pickup ring
  const turret=new THREE.Group();turret.position.set(.48,1.675,-.28);g.add(turret);
  cyl(.14,.26,steel,turret,0,.13,0,20);
  const lift=new THREE.Group();lift.position.set(0,.33,0);turret.add(lift);
  cyl(.11,.14,dark,lift,0,0,0,16);
  const boom=box(.06,.045,1,steel,lift,0,0,.5);
  const fork=new THREE.Group();fork.position.set(0,0,.95);lift.add(fork);
  box(.18,.016,.24,steel,fork,0,-.012,.08);
  const armWafer=createWafer(.72);armWafer.position.set(0,.015,.12);armWafer.rotation.x=-Math.PI/2;armWafer.visible=false;fork.add(armWafer);
  const pad=cyl(.47,.035,mat(0x132c38,.25,.42,true,.35,C.cyan),g,0,1.89,.68,32);pad.userData.stockPad=true;
  const ring=mesh(new THREE.RingGeometry(.31,.43,48),new THREE.MeshBasicMaterial({color:C.cyan,transparent:true,opacity:.75,side:THREE.DoubleSide,toneMapped:false}),g,0,1.915,.68);ring.rotation.x=-Math.PI/2;
  const pickupLabel=labelMesh('WAFER PICKUP','#ffffff',1.2,.2,27);pickupLabel.position.set(0,2.42,.68);pickupLabel.rotation.y=Math.PI;g.add(pickupLabel);
  const yawOffer=Math.atan2(-.48,.96),reachOffer=Math.hypot(-.48,.96)-.12;
  const robot={turret,lift,boom,fork,armWafer,phase:'animating',t:0,yawOffer,reachOffer};
  stockMachine={group:g,lamp,world:new THREE.Vector3(0,1.4,10),button:null,pad,ring,rackBox,robot,spawnLocal:new THREE.Vector3(0,2.02,.68)};
  machines.push(stockMachine);addCollider(0,10,3.8,2.2);
}
function createDeliveryStation(){
  const g=new THREE.Group();
  g.position.set(0,0,-40.2);g.rotation.y=0;scene.add(g);
  box(3.1,.28,1.9,mat(0x263e4c,.55,.25),g,0,.14,0);
  box(2.9,1.02,1.65,mat(0x132734,.5,.3),g,0,.79,0);
  box(3.08,.08,1.85,mat(C.green,.35,.22),g,0,1.32,0);
  const lamp=cyl(.07,.12,mat(C.green,.2,.22,false,1,C.green),g,1.25,1.42,.7);lamp.material.emissiveIntensity=.75;
  const pad=cyl(.44,.035,mat(0x0d2b22,.25,.38,true,.42,C.green),g,0,1.38,.35,32);
  const ring=mesh(new THREE.RingGeometry(.29,.41,48),new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:.85,side:THREE.DoubleSide,toneMapped:false}),g,0,1.405,.35);
  ring.rotation.x=-Math.PI/2;
  const wafer=createWafer(.72);wafer.position.set(0,1.43,.35);wafer.rotation.set(-Math.PI/2,0,0);wafer.visible=false;g.add(wafer);
  const locator=new THREE.Object3D();locator.position.set(0,1.43,.35);locator.rotation.set(-Math.PI/2,0,0);g.add(locator);
  const banner=labelMesh('FINAL WAFER DELIVERY • SUBMISSION BENCH','#67f6a3',2.95,.46,24);
  banner.position.set(0,2.25,0);g.add(banner);
  const subLabel=labelMesh('PLACE COMPLETED WAFER HERE','#ffffff',1.45,.2,24);
  subLabel.position.set(0,1.78,.35);g.add(subLabel);
  deliveryStation={group:g,lamp,pad,ring,wafer,locator,world:new THREE.Vector3(0,1.36,-40.2)};
  addCollider(0,-40.2,3.2,2.0);
}
function createButtonGlowShader(hexColor){
  return new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color(hexColor)},uTime:{value:0},uIntensity:{value:0}},
    vertexShader:'varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uColor;uniform float uTime;uniform float uIntensity;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float rim=pow(clamp(1.0-abs(dot(normalize(vN),normalize(vV))),0.0,1.0),1.35);float edge=smoothstep(0.0,0.48,vUv.y)*smoothstep(1.0,0.52,vUv.y);float pulse=0.78+0.22*sin(uTime*6.2);float a=clamp((0.38+0.62*rim)*max(0.28,edge)*pulse*uIntensity,0.0,1.0);gl_FragColor=vec4(uColor*(1.15+0.45*pulse),a);}',
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false
  });
}
function makeButton(parent,x,y,z,label,color,data){
  const rad=data?.radius??.13,depth=data?.depth??.08,lblGap=data?.labelGap??(rad+.09);
  const m=cyl(rad,depth,mat(color,.35,.22,false,1,color),parent,x,y,z,20);
  m.rotation.x=Math.PI/2;m.material.emissiveIntensity=.25;
  m.userData={interactive:true,type:'button',label,...data,baseColor:color,disabledColor:data?.disabledColor??null};
  if(data?.glowShader){
    const glowMat=createButtonGlowShader(color);
    const halo=new THREE.Mesh(new THREE.CylinderGeometry(rad*1.36,rad*1.5,depth+.01,28,1,true),glowMat);
    const disc=new THREE.Mesh(new THREE.RingGeometry(rad*.86,rad*1.7,28),glowMat);
    disc.rotation.x=-Math.PI/2;disc.position.y=depth*.52;halo.add(disc);
    m.add(halo);halo.visible=false;
    m.userData.glowMesh=halo;m.userData.glowMaterial=glowMat;
  }
  interactives.push(m);
  const l=labelMesh(label,'#ffffff',data?.labelWidth??.72,data?.labelHeight??.19,data?.labelFont??28);
  l.position.set(x,y-lblGap,z+depth*.55);parent.add(l);
  return m;
}
function controlScaleValue(c,v,includeUnit=false){      
if(c.kind==='choice')return String(v);      
const decimals=c.step<1?(String(c.step).split('.')[1]||'').length:0;      
const value=Number(v).toFixed(decimals);      
return includeUnit&&c.unit?`${value} ${c.unit}`:value      
}      
function addControlScaleLabel(parent,text,anchorX,anchorY,z,w=.46,h=.105,font=17,centreX=0,centreY=0){  
const label=labelMesh(String(text),'#c9e1e9',w,h,font),lw=label.userData.labelWidth||w,lh=label.userData.labelHeight||h;  
const dx=anchorX-centreX,dy=anchorY-centreY;  
const sx=Math.abs(dx)<1e-5?0:Math.sign(dx),sy=Math.abs(dy)<1e-5?0:Math.sign(dy);  
// The inner corner, not the label centre, is attached to the graduation point.  
label.position.set(anchorX+sx*lw*.5,anchorY+sy*lh*.5,z);  
label.renderOrder=8;label.userData.anchor={x:anchorX,y:anchorY,cornerX:-sx,cornerY:-sy};  
parent.add(label);  
return label  
}      
function makeControl(parent,c,index,machineIndex){      
const col=index%2?0x78ffbd:C.controlBlue,x=index%2?.55:-.55,y=1.36-Math.floor(index/2)*.64,z=1.04,data={interactive:true,type:'control',machineIndex,controlKey:c.key,label:c.label,baseColor:col};      
const values=c.kind==='choice'?[c.options[0],c.options[Math.floor(c.options.length/2)],c.options[c.options.length-1]]:[c.min,(c.min+c.max)/2,c.max];      
if(c.style==='slider'){      
const frameColor=index%2?0x31473f:0x263f52;      
const frame=box(.39,.56,.055,mat(frameColor,.55,.28),parent,x,y,z-.025);      
const slot=box(.075,.43,.045,mat(0x071119,.25,.32),parent,x,y,z+.012);      
const knob=box(.29,.095,.09,mat(col,.35,.22,false,1,col),parent,x,y,z+.075);      
knob.material.emissiveIntensity=.3;      
const side=index%2?1:-1,labelX=x+side*.34,tickX=x+side*.14;      
[-.215,0,.215].forEach((dy,k)=>{      
const tick=box(.09,.012,.025,mat(0xb9d3dd,.55,.2),parent,tickX,y+dy,z+.065);      
const includeUnit=k===2&&c.kind!=='choice';      
addControlScaleLabel(parent,controlScaleValue(c,values[k],includeUnit),tickX+side*.075,y+dy,z+.078,c.kind==='choice'?.58:.42,.105,c.kind==='choice'?14:17,x,y)      
});      
const hit=box(.52,.64,.035,mat(0x000000,0,1,true,.001),parent,x,y,z+.135);      
hit.material.depthWrite=false;      
hit.material.colorWrite=false;      
hit.userData={...data,sliderTarget:true,visualButton:false};      
interactives.push(hit);      
return{mesh:knob,track:true,frame,slot,hit}      
}      
const rotor=new THREE.Group();      
rotor.position.set(x,y,z);      
parent.add(rotor);      
const dial=cyl(.15,.1,mat(col,.45,.18,false,1,col),rotor,0,0,0,28);      
dial.rotation.x=Math.PI/2;      
dial.material.emissiveIntensity=.25;      
const pointer=box(.025,.13,.035,mat(0xffffff,0,.18),rotor,0,.07,.061);      
const angles=[-2.25,0,2.25],radius=.255;      
angles.forEach((angle,k)=>{      
const tx=x-Math.sin(angle)*radius,ty=y+Math.cos(angle)*radius;      
const tick=box(.012,.055,.024,mat(0xb9d3dd,.55,.2),parent,x-Math.sin(angle)*.19,y+Math.cos(angle)*.19,z+.064);      
tick.rotation.z=angle;      
const includeUnit=k===2&&c.kind!=='choice';      
addControlScaleLabel(parent,controlScaleValue(c,values[k],includeUnit),x-Math.sin(angle)*.225,y+Math.cos(angle)*.225,z+.078,c.kind==='choice'?.54:.39,.105,c.kind==='choice'?13:16,x,y)      
});      
dial.userData=data;      
pointer.userData=data;      
interactives.push(dial,pointer);      
return{mesh:dial,rotor,track:false,pointer}      
}        
function createDoor(g,color,machineIndex,style='framed'){      
  const pivot=new THREE.Group();      
  pivot.position.set(-.94,2.235,.995);      
  g.add(pivot);      
  const data={interactive:true,type:'button',label:'DOOR HANDLE',kind:'machine',action:'door',machineIndex,baseColor:color,visualButton:false};      
  const frameMat=mat(0x627a88,.72,.26),gasketMat=mat(0x162129,.15,.72),glassMat=new THREE.MeshPhysicalMaterial({color:0xdff6ff,metalness:.05,roughness:.08,transparent:true,opacity:.26,transmission:0,depthWrite:false,side:THREE.DoubleSide});
  const doorW=1.66,doorH=1.12;
  const door=box(doorW,doorH,.05,glassMat,pivot,doorW*.5,0,0);
  // Stainless perimeter door frame + hinges matching flush against the shroud door oblongs
  box(doorW,.065,.065,frameMat,pivot,doorW*.5,doorH*.5-.0325,0);
  box(doorW,.065,.065,frameMat,pivot,doorW*.5,-doorH*.5+.0325,0);
  box(.07,doorH,.065,frameMat,pivot,.035,0,0);
  box(.07,doorH,.065,frameMat,pivot,doorW-.035,0,0);
  for(const hy of [-.34,.34])cyl(.028,.12,frameMat,pivot,0,hy,.032,12);
  if(style==='tube'||style==='vacuum'){
    mesh(new THREE.TorusGeometry(.42,.038,10,36),frameMat,pivot,doorW*.5,-.02,.02);
    mesh(new THREE.TorusGeometry(.38,.015,8,32),gasketMat,pivot,doorW*.5,-.02,-.005);
  }else if(style==='oven'){
    const heatTint=new THREE.MeshBasicMaterial({color:0xff9a44,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide});
    const innerGlass=box(doorW-.24,doorH-.24,.018,heatTint,pivot,doorW*.5,0,.012);
    innerGlass.userData.nonInteractive=true;
  }
  const handleMat=mat(0xcad9e0,.84,.14);      
  const upperMount=box(.11,.055,.17,handleMat,pivot,doorW-.18,.26,.09);      
  const lowerMount=box(.11,.055,.17,handleMat,pivot,doorW-.18,-.26,.09);      
  const handle=cyl(.034,.72,handleMat,pivot,doorW-.12,0,.18,20);      
  door.userData=data;      
  handle.userData={...data,gripPoint:true};      
  upperMount.userData=handle.userData;      
  lowerMount.userData=handle.userData;      
  interactives.push(door,handle,upperMount,lowerMount);      
  pivot.userData.surface=door;      
  pivot.userData.handle=handle;      
  return pivot      
}
function createShroudEnclosure(g,color){
  // Translucent hollow cuboid enclosure made of one contiguous oblong per outer face (left, right, back, top)
  // plus three flush oblongs framing the left, right (button panel) and top edges of the front door.
  const shroudMat=new THREE.MeshPhysicalMaterial({color:0xd8f3ff,metalness:.06,roughness:.08,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
  const group=new THREE.Group();group.name='translucent-shroud-cuboid';g.add(group);
  const T=.05,H=1.28,Y_MID=2.315,Y_TOP=2.98;
  box(T,H,1.94,shroudMat,group,-1.455,Y_MID,0);
  box(T,H,1.94,shroudMat,group,1.455,Y_MID,0);
  box(2.96,H,T,shroudMat,group,0,Y_MID,-.995);
  box(2.96,T,2.04,shroudMat,group,0,Y_TOP,0);
  const frontLeft=box(.54,1.12,T,shroudMat,group,-1.21,2.235,.995);
  const frontRight=box(.76,1.12,T,shroudMat,group,1.10,2.235,.995);
  const frontAbove=box(2.96,.16,T,shroudMat,group,0,2.875,.995);
  frontLeft.userData.shroudPart='frontLeft';
  frontRight.userData.shroudPart='frontRight';
  frontAbove.userData.shroudPart='frontAbove';
  return{group,frontLeft,frontRight,frontAbove};
}
let _dropletTex=null;
function liquidDropletTexture(){
  if(_dropletTex)return _dropletTex;
  const c=document.createElement('canvas');c.width=32;c.height=32;
  const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(16,16,1,16,16,15);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(.55,'rgba(255,220,245,.88)');
  grad.addColorStop(1,'rgba(255,200,240,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,32,32);
  _dropletTex=new THREE.CanvasTexture(c);
  return _dropletTex;
}
function createChamberParticles(parent,color,count,pattern,origin={x:0,y:2.12,z:.15},size=.042){
  const positions=new Float32Array(count*3),seeds=new Float32Array(count*3);
  for(let k=0;k<count;k++){
    seeds[k*3]=Math.random();seeds[k*3+1]=Math.random();seeds[k*3+2]=Math.random();
    positions[k*3]=origin.x;positions[k*3+1]=origin.y;positions[k*3+2]=origin.z;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const pMat=new THREE.PointsMaterial({color,size,map:liquidDropletTexture(),alphaTest:.05,transparent:true,opacity:.88,blending:THREE.AdditiveBlending,depthWrite:false});
  const pts=new THREE.Points(geo,pMat);
  pts.visible=false;pts.frustumCulled=false;parent.add(pts);
  return{pts,positions,seeds,count,pattern,origin,size};
}
function createMachine(s,i){
  const g=new THREE.Group(),x=s.side*6.65;
  g.position.set(x,0,s.z);g.rotation.y=s.side<0?Math.PI/2:-Math.PI/2;scene.add(g);
  const lamp=machineShell(g,s),accent=mat(s.color,.35,.25),dark=mat(0x0b1620,.65,.24),steel=mat(0x9fb4bf,.82,.2),copper=mat(0xd47e4a,.8,.22),gold=mat(0xdfb84c,.85,.18);
  const isRta=s.type==='furnace'&&s.name.includes('Rapid');
  const doorStyle=s.type==='deposition'?'tube':s.type==='spinner'?'dome':s.type==='rie'||s.type==='metal'?'vacuum':s.type==='furnace'?'oven':'framed';
  let shroud=null,chamberLight=null;
  if(s.type!=='design'){
    shroud=createShroudEnclosure(g,s.color);
    chamberLight=new THREE.PointLight(s.color,0,3.2,2);
    chamberLight.position.set(0,2.35,.25);
    g.add(chamberLight);
  }
  const tray=box(.76,.05,.76,mat(0xaabcc2,.78,.18),g,0,1.72,.35);
  const wafer=createWafer(.72);wafer.position.set(0,1.82,.35);wafer.rotation.set(-Math.PI/2,0,0);wafer.visible=false;g.add(wafer);

  if(s.type==='design'){
    box(2.2,1.1,.14,dark,g,0,2.05,.05);
    const screen=box(1.95,.86,.04,mat(0x0b85a5,.1,.2,true,.9,C.cyan),g,0,2.05,.14);
    effects.push({kind:'screen',obj:screen,index:i});
  }else if(s.type==='deposition'){
    // Oxidation Furnace: see-through quartz tube, heater coils, quartz wafer boat, rear O2 gas manifold & jets
    const CY=2.1,TUBE_R=.46,TUBE_LEN=1.6,COIL_R=.53,FLANGE_R=.66;
    const inner=mat(0x22333b,.18,.75),rackMetal=mat(0x9baeb0,.65,.3),gasMat=mat(0x8db6bc,.45,.3);
    const quartz=new THREE.MeshPhysicalMaterial({color:0xd8f6f2,metalness:.04,roughness:.12,transparent:true,opacity:.26,side:THREE.DoubleSide,depthWrite:false});
    const flangeMat=new THREE.MeshStandardMaterial({color:0x70858b,metalness:.55,roughness:.36,side:THREE.DoubleSide});
    const tube=mesh(new THREE.CylinderGeometry(TUBE_R,TUBE_R,TUBE_LEN,40,1,true),quartz,g,0,CY,0);tube.rotation.x=Math.PI/2;
    mesh(new THREE.RingGeometry(TUBE_R,FLANGE_R,48),flangeMat,g,0,CY,TUBE_LEN/2);
    mesh(new THREE.RingGeometry(TUBE_R,FLANGE_R,48),flangeMat,g,0,CY,-TUBE_LEN/2);
    mesh(new THREE.CircleGeometry(TUBE_R,40),inner,g,0,CY,-TUBE_LEN/2+.01);
    const heaterMaterial=new THREE.MeshStandardMaterial({color:0x6a2a19,metalness:.72,roughness:.3,emissive:0xff481c,emissiveIntensity:.06});
    let heater=null;
    for(let z=-.6;z<=.61;z+=.2){const ring=mesh(new THREE.TorusGeometry(COIL_R,.02,8,40),heaterMaterial,g,0,CY,z);heater=heater||ring}
    g.remove(tray);tray.geometry.dispose();tray.material.dispose();
    const rack=new THREE.Group();rack.name='oxidation-quartz-wafer-rack';g.add(rack);
    for(const rx of [-.22,.22])box(.04,.04,.9,quartz,rack,rx,1.72,.35);
    for(const rz of [-.05,.75])box(.48,.03,.04,quartz,rack,0,1.72,rz);
    const inlet=cyl(.04,.3,gasMat,g,0,CY,-TUBE_LEN/2-.15,16);inlet.rotation.x=Math.PI/2;
    const jets=[];
    for(const [dx,dy] of [[-.16,.16],[.16,.16],[-.16,-.16],[.16,-.16]]){
      const nozzle=cyl(.016,.2,rackMetal,g,dx,CY+dy,-.7,12);nozzle.rotation.x=Math.PI/2;
      const jet=mesh(new THREE.ConeGeometry(.035,.22,12),new THREE.MeshBasicMaterial({color:0x8cecff,transparent:true,opacity:0,depthWrite:false}),g,dx,CY+dy,-.52);
      jet.rotation.x=Math.PI/2;jet.visible=false;jets.push(jet);
    }
    effects.push({kind:'oxidationFurnace',index:i,heater,jets,rack,wafer,light:chamberLight});
  }else if(s.type==='spinner'){
    // Photoresist Spin Coater: stainless catch-cup bowl, vacuum spin chuck, centering pins, robotic dispense swing-arm & resist bottle
    const bowl=mesh(new THREE.CylinderGeometry(.62,.54,.28,32,1,true),steel,g,0,1.74,.35);
    const bowlLip=mesh(new THREE.TorusGeometry(.62,.028,8,32),dark,g,0,1.88,.35);bowlLip.rotation.x=Math.PI/2;
    const chuck=new THREE.Group();chuck.position.set(0,1.76,.35);g.add(chuck);
    cyl(.26,.1,steel,chuck,0,0,0,24);
    for(let p=0;p<3;p++){const a=p*Math.PI*2/3;cyl(.015,.06,accent,chuck,Math.cos(a)*.24,.06,Math.sin(a)*.24,8)}
    const armPivot=new THREE.Group();armPivot.position.set(.68,2.45,-.33);armPivot.rotation.y=.16;g.add(armPivot);
    const armLen=Math.hypot(.68,.68);
    cyl(.065,.18,dark,armPivot,0,-.06,0,16);
    box(.055,.048,armLen,steel,armPivot,0,.04,armLen*.5);
    box(.022,.022,armLen-.04,mat(0xf24788,.15,.2,true,.85,0xe84fce),armPivot,0,.072,armLen*.5);
    const nozzle=cyl(.026,.14,mat(0xe84fce,.3,.25,false,1,0xe84fce),armPivot,0,-.04,armLen,12);nozzle.material.emissiveIntensity=.25;
    const stream=cyl(.009,.48,new THREE.MeshBasicMaterial({color:0xf44f8c,transparent:true,opacity:0,depthWrite:false}),armPivot,0,-.32,armLen,10);
    // Side amber resist bottle + feed riser connected directly into the swing arm pivot
    cyl(.09,.28,mat(0xb85218,.15,.22,true,.82),g,.95,1.81,-.55,14);
    const bottleTop=new THREE.Vector3(.95,1.96,-.55),pivotTop=new THREE.Vector3(.68,2.49,-.33);
    const riserPos=bottleTop.clone().lerp(pivotTop,.5),riserLen=bottleTop.distanceTo(pivotTop);
    const feedPipe=cyl(.014,riserLen,mat(0xf24788,.15,.25,true,.78),g,riserPos.x,riserPos.y,riserPos.z,10);
    feedPipe.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pivotTop.clone().sub(bottleTop).normalize());
    // Fine liquid photolithography mist droplets: 5x count (320) and 1/4x particle size (.0105)
    const particles=createChamberParticles(g,0xf460a6,320,'spinSpray',{x:0,y:2.32,z:.35},.0105);
    effects.push({kind:'spinner',index:i,chuck,armPivot,armLen,stream,wafer,light:chamberLight,particles});
  }else if(s.type==='furnace'&&!isRta){
    // Soft-Bake Furnace: precision proximity hotplate platen, concentric heater rings, 3 quartz lift pins, overhead exhaust baffle
    const platen=cyl(.56,.1,mat(0x475660,.75,.28),g,0,1.72,.35,32);
    const ringMat=new THREE.MeshStandardMaterial({color:0x6e2d18,metalness:.5,roughness:.3,emissive:0xff6b24,emissiveIntensity:.1});
    const ring1=mesh(new THREE.TorusGeometry(.24,.016,8,28),ringMat,g,0,1.77,.35);ring1.rotation.x=Math.PI/2;
    const ring2=mesh(new THREE.TorusGeometry(.42,.016,8,32),ringMat,g,0,1.77,.35);ring2.rotation.x=Math.PI/2;
    const liftPins=new THREE.Group();g.add(liftPins);
    for(let p=0;p<3;p++){const a=p*Math.PI*2/3;cyl(.014,.14,mat(0xd8f2ed,.1,.15,true,.65),liftPins,Math.cos(a)*.2,.174,.35+Math.sin(a)*.2,8);liftPins.children[p].position.y=1.74}
    box(1.35,.12,.95,dark,g,0,2.62,.15);
    cyl(.16,.28,steel,g,0,2.76,-.15,16);
    effects.push({kind:'softbake',index:i,ring:ring1,liftPins,wafer,light:chamberLight});
  }else if(s.type==='furnace'&&isRta){
    // Rapid Thermal Anneal: gold-reflective cavity, upper & lower linear tungsten-halogen IR lamp tubes, pyrometer column
    box(1.42,.06,1.15,gold,g,0,1.66,.2);box(1.42,.06,1.15,gold,g,0,2.68,.2);
    const lampMat=new THREE.MeshStandardMaterial({color:0xfff2cf,metalness:.2,roughness:.15,emissive:0xffaa33,emissiveIntensity:.15});
    const lamps=[];
    for(let lz=-.25;lz<=.55;lz+=.2){
      const topTube=cyl(.022,1.25,lampMat,g,0,2.56,lz,10);topTube.rotation.z=Math.PI/2;lamps.push(topTube);
      const botTube=cyl(.022,1.25,lampMat,g,0,1.72,lz,10);botTube.rotation.z=Math.PI/2;lamps.push(botTube);
    }
    for(let p=0;p<3;p++){const a=p*Math.PI*2/3;cyl(.012,.14,mat(0xe0f8ff,.1,.15,true,.7),g,Math.cos(a)*.22,1.76,.35+Math.sin(a)*.22,8)}
    cyl(.06,.3,steel,g,0,2.8,.35,12);
    effects.push({kind:'rta',index:i,lampMat,wafer,light:chamberLight});
  }else if(s.type==='aligner'){
    // Mask Aligner & I-Line Exposure: XYtheta chuck stage, suspended quartz photomask in micrometer frame, overhead Hg-arc condenser + shutter
    const stage=box(.9,.12,.9,dark,g,0,1.74,.35);
    const maskFrame=box(.96,.04,.96,steel,g,0,2.14,.35);
    box(.74,.02,.74,new THREE.MeshPhysicalMaterial({color:0xaaf5ff,transparent:true,opacity:.35,roughness:.08,depthWrite:false}),g,0,2.14,.35);
    box(.16,.95,.22,dark,g,-.68,2.25,-.2);
    const head=new THREE.Group();head.position.set(0,2.54,.35);g.add(head);
    cyl(.32,.28,dark,head,0,.18,0,20);cyl(.2,.24,copper,head,0,-.06,0,20);
    const shutter=box(.42,.025,.42,steel,g,0,2.34,.35);
    const beam=cyl(.34,.52,new THREE.MeshBasicMaterial({color:0x42f0ff,transparent:true,opacity:.04,depthWrite:false}),g,0,2.08,.35,24);
    effects.push({kind:'aligner',index:i,stage,shutter,beam,wafer,light:chamberLight});
  }else if(s.type==='wetbench'){
    // Developer Wet Bench: white PVDF basin, SRD rotor cup, sloshing fluid surface, sweeping spray arm, rear slotted exhaust plenum
    box(1.52,.16,1.28,mat(0xdce8ee,.1,.32),g,0,1.68,.2);
    mesh(new THREE.CylinderGeometry(.56,.52,.22,28,1,true),mat(0x284b5c,.3,.35),g,0,1.76,.35);
    const fluidSurface=cyl(.52,.025,new THREE.MeshPhysicalMaterial({color:0x3be6c4,metalness:.08,roughness:.12,transparent:true,opacity:.48,depthWrite:false}),g,0,1.8,.35,28);
    const rotor=cyl(.28,.08,accent,g,0,1.76,.35,24);
    box(1.45,.72,.22,mat(0xb8ccd4,.25,.35),g,0,2.16,-.68);
    const sprayArm=new THREE.Group();sprayArm.position.set(-.58,2.22,.05);g.add(sprayArm);
    box(.58,.04,.05,steel,sprayArm,.29,0,0);box(.04,.04,.32,steel,sprayArm,.56,0,.15);cyl(.02,.1,accent,sprayArm,.56,-.06,.3,10);
    const sprayCone=mesh(new THREE.ConeGeometry(.14,.36,14),new THREE.MeshBasicMaterial({color:0x54f49c,transparent:true,opacity:0,depthWrite:false}),sprayArm,.56,-.24,.3);
    cyl(.1,.32,mat(0x31a8d8,.15,.25,true,.75),g,-.68,1.88,-.45,12);
    cyl(.1,.32,mat(0x54f49c,.15,.25,true,.75),g,.68,1.88,-.45,12);
    const particles=createChamberParticles(g,0x8affea,200,'tideFlow',{x:0,y:1.82,z:.35},.0105);
    effects.push({kind:'wetbench',index:i,rotor,fluidSurface,sprayArm,sprayCone,wafer,light:chamberLight,particles});
  }else if(s.type==='rie'){
    // Reactive Ion Etcher: lower RF pedestal + dark-space ceramic ring, upper showerhead electrode, RF matchbox & turbopump flange
    cyl(.44,.14,steel,g,0,1.72,.35,28);
    mesh(new THREE.TorusGeometry(.42,.035,8,28),mat(0xdbe4e8,.1,.45),g,0,1.79,.35).rotation.x=Math.PI/2;
    const showerhead=new THREE.Group();showerhead.position.set(0,2.45,.35);g.add(showerhead);
    cyl(.46,.1,steel,showerhead,0,0,0,28);
    cyl(.12,.38,copper,showerhead,0,.24,0,16);
    box(.48,.22,.48,dark,g,0,2.78,.35);
    const plasma=cyl(.42,.44,new THREE.MeshBasicMaterial({color:C.magenta,transparent:true,opacity:.04,blending:THREE.AdditiveBlending,depthWrite:false}),g,0,2.1,.35,28);
    effects.push({kind:'rie',index:i,showerhead,plasma,wafer,light:chamberLight});
  }else if(s.type==='implanter'){
    // Ion Implant Beamline: evacuated accelerator tube, 5 focusing electromagnet coils, XY scanner plates, Faraday cup & angled target platen
    const tube=cyl(.24,1.35,dark,g,-.28,2.18,-.22,20);tube.rotation.z=Math.PI/2;
    const coils=[];
    for(let q=-.75;q<=.15;q+=.22){
      const coilMat=new THREE.MeshStandardMaterial({color:0x63449e,metalness:.55,roughness:.28,emissive:C.violet,emissiveIntensity:.12});
      const coil=mesh(new THREE.TorusGeometry(.32,.048,10,24),coilMat,g,q,2.18,-.22);coil.rotation.y=Math.PI/2;coils.push(coil);
    }
    box(.14,.28,.36,copper,g,.38,2.18,-.22);
    const targetPlaten=cyl(.34,.08,steel,g,.15,1.82,.35,24);targetPlaten.rotation.x=-.22;
    const beam=box(1.25,.045,.045,new THREE.MeshBasicMaterial({color:0xd18eff,transparent:true,opacity:.05,blending:THREE.AdditiveBlending,depthWrite:false}),g,-.15,2.06,.05);
    beam.rotation.y=-.52;beam.rotation.z=-.25;
    effects.push({kind:'implanter',index:i,coils,beam,wafer,light:chamberLight});
  }else if(s.type==='metal'){
    // Metal Film Depositor: stainless vacuum baseplate, overhead magnetron sputter cathode target, rotating shutter blade, QCM thickness sensor
    cyl(.5,.1,steel,g,0,1.72,.35,28);
    const targetMat=new THREE.MeshStandardMaterial({color:0xd2e6f7,metalness:.88,roughness:.16,emissive:0x4da8ff,emissiveIntensity:.1});
    cyl(.4,.08,targetMat,g,0,2.56,.35,28);
    mesh(new THREE.TorusGeometry(.34,.04,10,28),copper,g,0,2.62,.35).rotation.x=Math.PI/2;
    const shutter=new THREE.Group();shutter.position.set(-.45,2.34,.35);g.add(shutter);
    box(.56,.02,.46,steel,shutter,.45,0,0);
    cyl(.04,.18,gold,g,.52,1.98,.35,12);
    const plume=cyl(.38,.62,new THREE.MeshBasicMaterial({color:0x7fd4ff,transparent:true,opacity:.04,blending:THREE.AdditiveBlending,depthWrite:false}),g,0,2.16,.35,24);
    effects.push({kind:'metal',index:i,targetMat,shutter,plume,wafer,light:chamberLight});
  }else if(s.type==='probe'){
    // Microscope & Probe Test: granite vibration platen, motorized XYZ stage, 3-objective microscope turret, 4 micro-positioner probe needles
    box(1.36,.1,1.02,mat(0x2a3338,.2,.5),g,0,1.67,.28);
    const stage=new THREE.Group();stage.position.set(0,1.75,.35);g.add(stage);
    cyl(.38,.06,steel,stage,0,0,0,24);
    box(.16,.9,.2,dark,g,-.62,2.2,-.15);
    const head=box(.52,.22,.44,dark,g,0,2.58,.24);
    const turret=new THREE.Group();turret.position.set(0,2.42,.35);g.add(turret);
    cyl(.16,.08,steel,turret,0,0,0,18);
    for(let o=0;o<3;o++){const a=o*Math.PI*2/3;cyl(.045,.14,gold,turret,Math.cos(a)*.09,-.08,Math.sin(a)*.09,12)}
    const probes=[];
    for(const [px,pz] of [[-.56,.02],[.56,.02],[-.56,.68],[.56,.68]]){
      box(.12,.14,.12,dark,g,px,1.82,pz);
      const arm=box(.32,.025,.025,gold,g,px*.68,1.88,pz*.85+.05);
      arm.lookAt(g.localToWorld?.(new THREE.Vector3(0,1.84,.35))||new THREE.Vector3(0,1.84,.35));
      probes.push(arm);
    }
    const scanBeam=cyl(.04,.52,new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:.08,blending:THREE.AdditiveBlending,depthWrite:false}),g,0,2.1,.35,16);
    effects.push({kind:'probe',index:i,stage,turret,probes,scanBeam,wafer,light:chamberLight});
  }

  let chamberTarget=null;
  if(s.type!=='deposition'){
    chamberTarget=box(1.54,1.02,.035,mat(0x000000,0,1,true,.001),g,-.11,2.235,.86);
    chamberTarget.material.depthWrite=false;chamberTarget.material.colorWrite=false;
    chamberTarget.userData={interactive:true,type:'button',label:'CHAMBER',kind:'machine',action:'chamber',machineIndex:i,baseColor:s.color,visualButton:false};
    interactives.push(chamberTarget);
  }
  const door=createDoor(g,s.color,i,doorStyle),panel=box(1.55,1.18,.05,mat(0x0a1720,.55,.22),g,0,.99,1.005);
  const controls=s.controls.map((c,j)=>makeControl(g,c,j,i));
  const btnParent=shroud?.frontRight||g;
  const startBtn=makeButton(btnParent,shroud?0:1.10,shroud?.22:2.455,shroud?.025:1.02,'START',C.startGreen,{kind:'machine',action:'start',machineIndex:i,disabledColor:C.startGreenIdle,glowShader:true,radius:.10,depth:.07,labelWidth:.52,labelHeight:.14,labelFont:24,labelGap:.165}),
    stopBtn=makeButton(btnParent,shroud?0:1.10,shroud?-.20:2.035,shroud?.025:1.02,'STOP',C.stopRed,{kind:'machine',action:'stop',machineIndex:i,disabledColor:C.stopRedIdle,glowShader:true,radius:.10,depth:.07,labelWidth:.52,labelHeight:.14,labelFont:24,labelGap:.165});
  const m={group:g,shroud,lamp,station:s,index:i,world:new THREE.Vector3(x,1.5,s.z),door,doorHandle:door.userData.handle,wafer,tray,chamberTarget,controls,buttons:{start:startBtn,stop:stopBtn}};
  machines.push(m);addCollider(x,s.z,2.6,3.7);
  if(s.type==='deposition')colliders[colliders.length-1].playerOnly=true;
}

function updateChamberParticles(p,on,t,waferCenter={x:0,y:1.83,z:.35}){
  if(!p)return;
  p.pts.visible=on;
  if(!on)return;
  const pos=p.positions,sd=p.seeds,n=p.count,ox=p.origin.x,oy=p.origin.y,oz=p.origin.z;
  const fallDist=Math.max(.12,oy-waferCenter.y);
  for(let k=0;k<n;k++){
    const u=(t*(.85+sd[k*3]*.55)+sd[k*3+1])%1,a=sd[k*3+2]*Math.PI*2;
    if(p.pattern==='spinSpray'){
      // Fine liquid photoresist droplets descend from feed-arm nozzle onto wafer centre, then spin radially
      if(u<.42){
        const fall=u/.42;
        pos[k*3]=ox+(sd[k*3]-.5)*.009;
        pos[k*3+1]=oy-fall*fallDist;
        pos[k*3+2]=oz+(sd[k*3+2]-.5)*.009;
      }else{
        const spin=(u-.42)/.58,rad=.015+spin*.22;
        pos[k*3]=ox+Math.cos(a+t*11)*rad;
        pos[k*3+1]=waferCenter.y+.012*(1-spin);
        pos[k*3+2]=oz+Math.sin(a+t*11)*rad;
      }
    }else if(p.pattern==='tideFlow'){
      // Fine liquid surface particles ride the slosh tide vector across the bath surface
      const tx=Math.cos(t*2.5),tz=Math.sin(t*3.1),px=-tz,pz=tx;
      const along=(u-.5)*.78,across=(sd[k*3]-.5)*.56;
      const sx=tx*along+px*across,sz=tz*along+pz*across;
      const tiltY=-sx*Math.cos(t*2.5)*.06+sz*Math.sin(t*3.1)*.06;
      pos[k*3]=ox+sx;
      pos[k*3+1]=oy+tiltY+Math.sin(t*4.2)*.012;
      pos[k*3+2]=oz+sz;
    }
  }
  p.pts.geometry.attributes.position.needsUpdate=true;
}

function animateEffects(t,dt){
  const toDelivery=!!(state.awaitingDelivery||(typeof parallel!=='undefined'&&parallel?.active?.nextStage>=stations.length))&&!state.completed&&!!deliveryStation;
  const activeTarget=toDelivery?deliveryStation:(!state.runStart?stockMachine:machines[state.current+1]);
  const side=toDelivery?0:(activeTarget?.station?.side||0);
  const targetZ=activeTarget?.world?.z??10;
  const targetFloorX=toDelivery?0:(side?side*4.55:0),targetFloorZ=toDelivery?-38.3:(side?targetZ:8.1);
  if(deliveryStation?.ring){
    const pulse=toDelivery?.92+.16*Math.sin(t*5):.9+.05*Math.sin(t*2);
    deliveryStation.ring.scale.setScalar(pulse);
    deliveryStation.ring.material.opacity=toDelivery?.95:.55;
  }
  const showGuide=state.started&&!state.completed&&!controlsTraining.active&&!!activeTarget;
  interactives.forEach(o=>{
    const gm=o.userData?.glowMaterial;
    if(gm)gm.uniforms.uTime.value=t;
  });
  if(guideBeacon&&guideFloorRing){
    guideBeacon.visible=showGuide&&!renderer.xr.isPresenting;
    guideFloorRing.visible=showGuide;
    if(showGuide&&activeTarget){
      activeTarget.group.getWorldPosition(guideBeacon.position);
      guideBeacon.position.y=3.35+Math.sin(t*3.2)*.1;
      guideBeacon.rotation.y=t*1.8;
      guideFloorRing.position.set(targetFloorX,.018,targetFloorZ);
      guideFloorRing.scale.setScalar(.96+.14*Math.sin(t*4.5));
    }
  }
  const dx=targetFloorX-player.position.x,dz=targetFloorZ-player.position.z,pathDist=Math.hypot(dx,dz);
  const ux=dx/(pathDist||1),uz=dz/(pathDist||1),heading=Math.atan2(-ux,-uz);
  const startD=Math.min(.75,pathDist*.12),endD=Math.max(startD,pathDist-.55),span=endD-startD;
  const arrowCount=showGuide&&pathDist>=1.05?Math.min(44,Math.floor(span/1.25)+1):0;
  effects.forEach(e=>{
    if(e.kind==='route'){
      const active=e.routeIndex<arrowCount;
      e.obj.visible=active;
      if(active){
        const d=startD+e.routeIndex*1.25;
        const wave=Math.sin(t*5.5-e.routeIndex*.85);
        e.obj.position.set(player.position.x+ux*d,.032+Math.max(0,wave)*.03,player.position.z+uz*d);
        e.obj.rotation.y=heading;
        const baseScale=state.tutorialMode?1.18:.98;
        e.obj.scale.setScalar(baseScale*(.92+.18*Math.max(0,wave)));
        if(e.obj.userData.arrowMaterials){
          e.obj.userData.arrowMaterials[0].color.setHex(C.startGreen);
          e.obj.userData.arrowMaterials[0].opacity=.72+.28*Math.max(0,wave);
        }
      }
      return;
    }
    const st=status[e.index],on=st?.state==='running';
    const heatProg=on?clamp((st?.metric||0)/Math.max(1,(stations[e.index]?.metric?.target||100)*.65),.25,1):0;
    if(e.kind==='screen'){e.obj.material.emissiveIntensity=.75+.2*Math.sin(t*2);return}
    if(e.light)e.light.intensity=on?(e.kind==='oxidationFurnace'||e.kind==='softbake'||e.kind==='rta'?2.2+heatProg*2.4+.5*Math.sin(t*10):2.2+.6*Math.sin(t*10)):0;
    if(e.particles&&e.kind!=='spinner')updateChamberParticles(e.particles,on,t);
    if(e.kind==='oxidationFurnace'){
      const cycleStart=st?.cycle?.start;
      const startupRamp=on&&cycleStart!=null?clamp((performance.now()-cycleStart)/500,0,1):on?1:0;
      const heaterTarget=1.6+heatProg*2.2+.45*Math.sin(t*8);
      e.heater.material.emissiveIntensity=on?lerp(.06,heaterTarget,startupRamp):.06;
      e.heater.material.emissive.setHex(on&&heatProg>.65&&startupRamp>.65?0xff8c2a:0xff481c);
      if(e.light){
        e.light.visible=true;
        e.light.color.setHex(0xff7d32);
        e.light.intensity=on?lerp(0,2.2+heatProg*2.4+.5*Math.sin(t*10),startupRamp):0;
      }
      e.jets.forEach((jet,index)=>{
        jet.visible=on&&startupRamp>.28;
        jet.material.opacity=on&&startupRamp>.28?(.22+.1*Math.sin(t*12+index))*startupRamp:0;
      });
      if(e.rack)e.rack.position.z=on?Math.sin(t*2.4)*.035*startupRamp:0;
      if(e.wafer&&on)e.wafer.position.z=.35+Math.sin(t*2.4)*.035*startupRamp;
    }else if(e.kind==='spinner'){
      const rpmRate=clamp((st?.values?.rpm||3000)/300,4,16);
      if(on){e.chuck.rotation.y+=dt*rpmRate;if(e.wafer)e.wafer.rotation.z+=dt*rpmRate}
      const targetArmAngle=on?-Math.PI/4:.16;
      e.armPivot.rotation.y=lerp(e.armPivot.rotation.y,targetArmAngle,1-Math.exp(-dt*6.5));
      const ry=e.armPivot.rotation.y,armLen=e.armLen||Math.hypot(.68,.68);
      const tipX=e.armPivot.position.x+Math.sin(ry)*armLen,tipZ=e.armPivot.position.z+Math.cos(ry)*armLen;
      const pouring=on&&Math.abs(ry-targetArmAngle)<.24;
      if(e.particles){e.particles.origin.x=tipX;e.particles.origin.y=2.30;e.particles.origin.z=tipZ;updateChamberParticles(e.particles,pouring,t)}
      if(e.stream){e.stream.material.opacity=pouring?.52+.16*Math.sin(t*16):0}
    }else if(e.kind==='softbake'){
      e.ring.material.emissiveIntensity=on?1.5+heatProg*2.1+.4*Math.sin(t*7):.1;
      e.ring.material.emissive.setHex(on&&heatProg>.65?0xffa042:0xff6b24);
      if(e.light)e.light.color.setHex(0xff8e36);
      const pinY=on?1.72:1.78;
      e.liftPins.position.y=lerp(e.liftPins.position.y,pinY-1.74,1-Math.exp(-dt*6));
      if(e.wafer&&st?.state!=='loading'&&st?.state!=='unloading')e.wafer.position.y=on?1.81:1.85;
    }else if(e.kind==='rta'){
      e.lampMat.emissiveIntensity=on?2.2+heatProg*2.2+.55*Math.sin(t*14):.15;
      if(e.light)e.light.color.setHex(0xffbe55);
    }else if(e.kind==='aligner'){
      const line=st?.values?.line||'365 nm I-line';
      const hex=line.includes('405')?0x4c7eff:line.includes('248')?0xe25bff:0x42f0ff;
      e.beam.material.color.setHex(hex);if(e.light)e.light.color.setHex(hex);
      e.beam.material.opacity=on?.32+.1*Math.sin(t*12):.03;
      e.shutter.position.x=lerp(e.shutter.position.x,on?.42:0,1-Math.exp(-dt*8));
      if(on){e.stage.position.x=Math.sin(t*3)*.04;if(e.wafer)e.wafer.position.x=e.stage.position.x}else{e.stage.position.x=0}
    }else if(e.kind==='wetbench'){
      if(e.fluidSurface){
        e.fluidSurface.rotation.x=on?Math.sin(t*3.1)*.07:0;
        e.fluidSurface.rotation.z=on?Math.cos(t*2.5)*.07:0;
        e.fluidSurface.position.y=on?1.8+Math.sin(t*4.2)*.012:1.8;
      }
      if(on){e.rotor.rotation.y+=dt*9;if(e.wafer)e.wafer.rotation.z+=dt*9;e.sprayArm.rotation.y=Math.sin(t*3.2)*.26}
      else e.sprayArm.rotation.y=lerp(e.sprayArm.rotation.y,-.45,1-Math.exp(-dt*5));
      e.sprayCone.material.opacity=on?.35+.12*Math.sin(t*14):0;
    }else if(e.kind==='rie'){
      e.plasma.material.opacity=on?.42+.16*Math.sin(t*15):.03;
      e.showerhead.position.y=on?2.42+.04*Math.sin(t*5):2.45;
    }else if(e.kind==='implanter'){
      e.beam.material.opacity=on?.75+.2*Math.sin(t*18):.04;
      e.beam.rotation.y=on?-.52+Math.sin(t*9)*.08:-.52;
      e.coils.forEach((c,idx)=>{c.material.emissiveIntensity=on?.9+.5*Math.sin(t*10+idx):'.12'*1});
    }else if(e.kind==='metal'){
      const metal=st?.values?.metal||'Aluminium';
      const hex=metal==='Gold'?0xffd24d:metal==='Copper'?0xe88b58:0x9be2ff;
      e.targetMat.color.setHex(hex);e.plume.material.color.setHex(hex);if(e.light)e.light.color.setHex(hex);
      e.targetMat.emissiveIntensity=on?.9+.3*Math.sin(t*8):.1;
      e.plume.material.opacity=on?.32+.1*Math.sin(t*9):.03;
      e.shutter.rotation.y=lerp(e.shutter.rotation.y,on?1.15:0,1-Math.exp(-dt*6));
      if(on&&e.wafer)e.wafer.rotation.z+=dt*1.8;
    }else if(e.kind==='probe'){
      if(on){
        e.stage.position.x=Math.sin(t*2.6)*.05;e.stage.position.z=.35+Math.cos(t*2.1)*.04;
        if(e.wafer){e.wafer.position.x=e.stage.position.x;e.wafer.position.z=e.stage.position.z}
        e.turret.rotation.y+=dt*.6;
      }else{e.stage.position.set(0,1.75,.35)}
      e.scanBeam.material.opacity=on?.48+.2*Math.sin(t*16):.04;
    }
  });
}
function newRun(){state.lotId='SR-'+String(Math.floor(1000+Math.random()*9000));state.carrying=false;state.current=0;state.completed=false;state.awaitingDelivery=false;state.runStart=0;state.elapsed=0;state.cycle=null;state.records=[];state.pattern='Logic grid';phys.stockRespawnAt=0;phys.stockReady=null;phys.waferEverPicked=false;setWaferDynamic(false);setWaferStaged(false);phys.waferVelocity.set(0,0,0);phys.jumpOffset=0;phys.jumpVelocity=0;phys.crouchHeld=false;player.position.set(0,renderer.xr.isPresenting?.86:2.58,7.7);yaw=Math.PI;pitch=-.03;player.rotation.y=yaw;status.forEach((st,i)=>{st.state='locked';st.values=Object.fromEntries(stations[i].controls.map(c=>[c.key,c.initial]));st.score=null;st.deviations=[];st.metric=0;st.doorTarget=0;st.doorAmount=0;st.transfer=null;machines[i+1].wafer.visible=false;if(machines[i+1].kind==='fabrication'&&machines[i+1].door)machines[i+1].door.rotation.y=0});if(stockMachine?.robot){stockMachine.robot.phase='animating';stockMachine.robot.t=0}if(deliveryStation?.wafer)deliveryStation.wafer.visible=false;state.handWafer.visible=false;$('lotId').textContent=state.lotId;$('report').style.display='none';updateAll();toast('Traveller '+state.lotId+' prepared. Robot is presenting a blank wafer.')}
function formatTime(ms){const t=Math.max(0,ms),m=Math.floor(t/60000),s=Math.floor(t%60000/1000),x=Math.floor(t%1000);return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(x).padStart(3,'0')}`}        
function getRuns(){try{return JSON.parse(localStorage.getItem('waferFabRunsV2')||'[]').filter(r=>Number.isFinite(r.time))}catch(e){return[]}}        
function benchmarks(){const a=getRuns().map(r=>r.time).sort((x,y)=>x-y);if(!a.length)return{best:null,median:null};return{best:a[0],median:a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2}}        
function escapeHtml(s){const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}        
function updateBenchmark(){const runs=getRuns().sort((a,b)=>a.time-b.time),b=benchmarks();$('benchmark').textContent=`Best ${b.best==null?'—':formatTime(b.best)} · Median ${b.median==null?'—':formatTime(b.median)}`;$('leaderboard').innerHTML='<b>LOCAL SPEEDRUN LOG</b><br>'+(runs.length?runs.slice(0,5).map((r,i)=>`${i+1}. ${escapeHtml(r.user||'Operator')} — ${formatTime(r.time)} — Q${Number(r.quality||0).toFixed(0)}%`).join('<br>'):'No completed runs yet.')}        
function getActivityRecords(){try{const stored=localStorage.getItem(ACTIVITY_RECORDS_KEY);if(stored!==null){const records=JSON.parse(stored);return Array.isArray(records)?records:[]}const migrated=[];for(const run of getRuns())(run.processes||[]).forEach((process,index)=>{if(!process)return;migrated.push({user:run.user||'Operator',lotId:run.lotId||'',activity:stations[index]?.short||`Process ${index+1}`,timeMs:Math.round((process.processSeconds||0)*1000),success:Number(process.score)||0,date:run.date||''})});localStorage.setItem(ACTIVITY_RECORDS_KEY,JSON.stringify(migrated));return migrated}catch{return[]}}
function recordActivity(activity,timeMs,success,lotId=state.lotId){const records=getActivityRecords();records.push({user:state.username||'Operator',lotId,activity,timeMs:Math.max(0,Math.round(timeMs)),success:clamp(Number(success)||0,0,100),date:new Date().toISOString(),mode:tutorialMode?'Tutorial':'Run'});try{localStorage.setItem(ACTIVITY_RECORDS_KEY,JSON.stringify(records.slice(-1500)))}catch{}updateActivityLeaderboard()}
function updateActivityLeaderboard(){const body=$('activityLeaderboard');if(!body)return;const user=$('username')?.value.trim().toLowerCase()||'',records=getActivityRecords().filter(record=>!user||(record.user||'').toLowerCase()===user),activities=['Linear regression','Circuit repair','Two-layer layout',...stations.slice(1).map(station=>station.short)],bestByActivity=new Map();for(const record of records){const best=bestByActivity.get(record.activity);if(!best||record.timeMs<best.timeMs)bestByActivity.set(record.activity,record)}body.innerHTML=activities.map(activity=>{const record=bestByActivity.get(activity);return`<tr><td>${escapeHtml(activity)}</td><td>${record?formatTime(record.timeMs):'--:--.---'}</td><td>${record?Number(record.success).toFixed(1)+'%':'--'}</td></tr>`}).join('');const bestSuccess=records.length?Math.max(...records.map(record=>Number(record.success)||0)):null;$('activitySummary').textContent=`${records.length} completed activities · Best success ${bestSuccess==null?'--':bestSuccess.toFixed(1)+'%'}`;$('scoreboardOperator').textContent=user?escapeHtml($('username').value.trim().toUpperCase()):'ALL OPERATORS'}
function beginMenuRun(tutorial){let username=$('username').value.trim();if(!username){if(renderer?.xr?.isPresenting)username='VR Operator';else{$('menuNotice').textContent='Enter a username to save your activity records.';$('username').focus();return}}$('username').value=username;userPreferences.username=username;saveUserPreferences();state.username=username;$('operator').textContent=username;tutorialMode=tutorial;tutorialLastObjective='';tutorialDismissed=false;state.started=true;state.paused=false;$('intro').style.display='none';$('xrButton').style.display='block';newRun();if(tutorial){startControlsTraining(renderer?.xr?.isPresenting?'vr':'desktop');return}try{renderer.domElement.requestPointerLock?.()?.catch(()=>{})}catch{}refreshTutorialCoach()}
function showDesktopPause(){if(!state.started||renderer.xr.isPresenting)return;state.paused=true;$('desktopPausePanel').hidden=false;$('controlHelpPanel').hidden=true;$('settingsPanel').hidden=true;document.exitPointerLock?.();$('pauseResume').focus()}
function resumeDesktop(){state.paused=false;$('desktopPausePanel').hidden=true;$('controlHelpPanel').hidden=true;if(state.started)renderer.domElement.requestPointerLock?.()}
function showControlHelp(){if(state.started){state.paused=true;document.exitPointerLock?.()}$('desktopPausePanel').hidden=true;$('controlHelpPanel').hidden=false;$('closeControlHelp').focus()}
function returnToPause(){ $('controlHelpPanel').hidden=true;if(state.started){state.paused=true;$('desktopPausePanel').hidden=false}else state.paused=false }
function onDesktopKeydown(event){
  if(renderer.xr.isPresenting)return;
  if(controlsTraining.active&&controlsTraining.mode==='desktop'){
    const code=event.code;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))advanceControlsTraining('move',1);
    else if(code==='ShiftLeft'||code==='ShiftRight')advanceControlsTraining('crouch',1);
    else if(code==='ControlLeft'||code==='ControlRight')advanceControlsTraining('sprint',1);
    else if(code==='KeyE')advanceControlsTraining('operate',1);
    else if(code==='F1'||code==='Escape'){event.preventDefault();advanceControlsTraining('help',1)}
    return;
  }
  const target=event.target,editing=target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"]');
  const developerInputAllowed=!state.started||state.paused||document.pointerLockElement!==renderer.domElement||designWorld.active;
  if(developerInputAllowed&&!editing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&event.key.length===1&&/[a-z]/i.test(event.key)){const now=performance.now();if(now-desktopDeveloperBufferAt>3000)desktopDeveloperBuffer='';desktopDeveloperBufferAt=now;desktopDeveloperBuffer=(desktopDeveloperBuffer+event.key.toUpperCase()).slice(-9);if('DEVELOPER'.startsWith(desktopDeveloperBuffer)){event.preventDefault();event.stopImmediatePropagation();if(desktopDeveloperBuffer==='DEVELOPER'){desktopDeveloperBuffer='';desktopDeveloperBufferAt=0;toggleDeveloperPanel()}return}}else{desktopDeveloperBuffer='';desktopDeveloperBufferAt=0}
  if(designWorld.active||designMode.phase!=='idle')return;
  if(event.code==='Escape'){
    if(!$('settingsPanel').hidden){event.preventDefault();$('settingsPanel').hidden=true;applyGuiTextSize();if(state.paused)$('desktopPausePanel').hidden=false;return}
    if(!$('controlHelpPanel').hidden){event.preventDefault();returnToPause();return}
    if(!state.started)return;
    event.preventDefault();if(!$('desktopPausePanel').hidden)resumeDesktop();else showDesktopPause();return
  }
  if(event.code==='F1'&&!editing){event.preventDefault();if(!$('controlHelpPanel').hidden)returnToPause();else showControlHelp()}
}
function refreshTutorialCoach(){
  const panel=$('tutorialCoach');if(!panel)return;
  if(!tutorialMode||!userPreferences.tutorialHints||!state.started){panel.hidden=true;return}
  let title=$('objectiveMain').textContent,description=$('objectiveSub').textContent;
  const inDesign=designMode.phase==='active'||designMode.phase==='world'||designWorld.active;
  const pips=$('tutorialPips');
  if(!state.runStart&&!state.carrying){
    title='Pick up a wafer from the robot arm';
    description='Wait for the stock robot arm to offer the wafer over the glowing ring, then hold Left Mouse (or VR Trigger) to pick it up.';
    if(pips)pips.innerHTML='<span class="tut-pip now">1. PICK UP WAFER FROM ROBOT</span><span class="tut-pip">2. DESIGN TERMINAL</span>';
  }else if(inDesign){
    if(designMode.step===0){title='Calibrate the sensor response';description=designMode.gainComplete?'Regression submitted. Verify and continue to circuit repair.':'Adjust gradient and intercept, then submit the regression fit.'}
    else if(designMode.step===1){title='Repair the circuit';description=designMode.schematicComplete?'Circuit verified. Submit to continue to the two-layer layout.':'Connect the two missing circuit terminals, then submit for verification.'}
    else{title='Route the crossover';description='Connect IN1 → OUT1, IN2 → OUT2, and IN3 → OUT3. Use M1 & M2 crossovers at junctions to avoid shorts, or release when ready.'}
    if(pips)pips.innerHTML=`<span class="tut-pip ${designMode.step>0?'done':'now'}">1. REGRESSION</span><span class="tut-pip ${designMode.step>1?'done':designMode.step===1?'now':''}">2. CIRCUIT</span><span class="tut-pip ${designMode.step===2?'now':''}">3. 2-LAYER LAYOUT</span>`;
  }else{
    const st=status[state.current];
    if(pips&&st){
      const sDoorOpen=st.doorAmount>.45||['loadedDoorOpen','done','unloadedDoorOpen','complete'].includes(st.state);
      const sSeated=['loadedDoorOpen','loaded','running','done'].includes(st.state);
      const sClosed=['loaded','running'].includes(st.state)||st.state==='complete';
      const sRun=st.state==='running'||st.state==='done'||st.state==='unloadedDoorOpen'||st.state==='complete';
      const sDone=['done','unloadedDoorOpen','complete'].includes(st.state);
      const cls=(done,now)=>done?'tut-pip done':now?'tut-pip now':'tut-pip';
      pips.innerHTML=`<span class="${cls(sDoorOpen,st.state==='ready'&&!sDoorOpen)}">1. OPEN DOOR</span><span class="${cls(sSeated,st.state==='ready'&&sDoorOpen)}">2. SEAT WAFER</span><span class="${cls(sClosed,st.state==='loadedDoorOpen')}">3. LATCH &amp; TUNE</span><span class="${cls(sDone,st.state==='loaded'||st.state==='running')}">4. START / STOP</span><span class="${cls(st.state==='complete',st.state==='done'||st.state==='unloadedDoorOpen')}">5. COLLECT</span>`;
    }
  }
  const key=`${title}|${description}`;if(key!==tutorialLastObjective){tutorialLastObjective=key;tutorialDismissed=false}
  const designActive=parallel?.active?.nextStage===0;$('tutorialStep').textContent=designActive?`GUIDED DESIGN · ${designMode.step+1}/3`:`GUIDED PRODUCTION · ${Math.min(state.current+1,stations.length)}/${stations.length}`;
  $('tutorialTitle').textContent=title;$('tutorialText').textContent=description;panel.hidden=tutorialDismissed;
}
function setupLaunchMenu(){
  $('username').value=userPreferences.username;$('scoreboardOperator').textContent=userPreferences.username?userPreferences.username.toUpperCase():'ALL OPERATORS';updateActivityLeaderboard();
  $('username').addEventListener('input',()=>{userPreferences.username=$('username').value.trim();saveUserPreferences();$('menuNotice').textContent='';updateActivityLeaderboard()});
  $('startGame').onclick=()=>beginMenuRun(false);$('startTutorial').onclick=()=>beginMenuRun(true);
  const panel=$('settingsPanel'),loadSettings=()=>{userPreferences.username=$('username').value.trim()||userPreferences.username;$('lookSensitivity').value=String(userPreferences.lookSensitivity);$('lookSensitivityValue').textContent=userPreferences.lookSensitivity.toFixed(1)+'×';$('tutorialHints').checked=userPreferences.tutorialHints;if($('developerViewEnabled'))$('developerViewEnabled').checked=!!userPreferences.developerPanel;if($('debugHitboxes'))$('debugHitboxes').checked=!!userPreferences.debugHitboxes;if($('debugNormals'))$('debugNormals').checked=!!userPreferences.debugNormals;if($('debugWireframe'))$('debugWireframe').checked=!!userPreferences.debugWireframe;applyGuiTextSize()};
  $('openSettings').onclick=()=>{loadSettings();panel.hidden=false};$('closeSettings').onclick=()=>{panel.hidden=true;applyGuiTextSize();if(state.paused)$('desktopPausePanel').hidden=false};$('lookSensitivity').addEventListener('input',event=>{$('lookSensitivityValue').textContent=Number(event.target.value).toFixed(1)+'×'});$('guiTextSize').addEventListener('input',event=>applyGuiTextSize(GUI_TEXT_SIZES[Number(event.target.value)]));
  $('saveSettings').onclick=()=>{userPreferences.lookSensitivity=clamp(Number($('lookSensitivity').value)||1,.5,2);userPreferences.tutorialHints=$('tutorialHints').checked;userPreferences.guiTextSize=GUI_TEXT_SIZES[Number($('guiTextSize').value)]??12;if($('developerViewEnabled'))userPreferences.developerPanel=$('developerViewEnabled').checked;if($('debugHitboxes'))userPreferences.debugHitboxes=$('debugHitboxes').checked;if($('debugNormals'))userPreferences.debugNormals=$('debugNormals').checked;if($('debugWireframe'))userPreferences.debugWireframe=$('debugWireframe').checked;applyGuiTextSize();saveUserPreferences();updateDeveloperPaneVisibility();panel.hidden=true;if(state.paused)$('desktopPausePanel').hidden=false;refreshTutorialCoach()};
  $('pauseResume').onclick=resumeDesktop;$('pauseControls').onclick=showControlHelp;$('closeControlHelp').onclick=returnToPause;$('pauseSettings').onclick=()=>{loadSettings();$('desktopPausePanel').hidden=true;panel.hidden=false};
  $('dismissTutorial').onclick=()=>{tutorialDismissed=true;panel.hidden=true};$('exitTutorial').onclick=()=>{tutorialMode=false;panel.hidden=true};
  $('newLot').addEventListener('click',()=>{tutorialMode=false;tutorialDismissed=true;refreshTutorialCoach()});
  if($('trainingSkip'))$('trainingSkip').onclick=finishControlsTraining;
  if($('trainingBegin'))$('trainingBegin').onclick=finishControlsTraining;
  addEventListener('mousedown',e=>{if(controlsTraining.active&&controlsTraining.mode==='desktop'&&e.button===0&&!e.target?.closest?.('button'))advanceControlsTraining('operate',1)});
  addEventListener('wheel',()=>{if(controlsTraining.active&&controlsTraining.mode==='desktop')advanceControlsTraining('wheel',1)},{passive:true});
  addEventListener('mousemove',e=>{if(controlsTraining.active&&controlsTraining.mode==='desktop'){controlsTraining.mouseMoveDistance+=Math.hypot(e.movementX||0,e.movementY||0);if(controlsTraining.mouseMoveDistance>70){controlsTraining.mouseMoveDistance=0;advanceControlsTraining('look',1)}}});
  applyGuiTextSize();updateDeveloperPaneVisibility();
  addEventListener('mousemove',event=>{if(document.pointerLockElement===renderer.domElement&&state.started&&userPreferences.lookSensitivity!==1){const extra=userPreferences.lookSensitivity-1;yaw-=event.movementX*.0022*extra;pitch=clamp(pitch-event.movementY*.0019*extra,-1.35,1.35)}})
}
function currentElapsed(){return state.runStart?(state.completed?state.elapsed:performance.now()-state.runStart):0}        
function quality(){const done=state.records.filter(Boolean);return done.length?done.reduce((a,r)=>a+r.score,0)/done.length:100}        
function updateHUD(){const s=stations[state.current],st=status[state.current];$('hudStage').textContent=state.completed?'Lot complete':!state.carrying&&!state.records.length?'Wafer stock':s?.short||'Complete';$('hudWafer').textContent=state.carrying?'In hand':state.cycle?'In process':st&&['loaded','loadedDoorOpen','running','done'].includes(st.state)?'At station':state.completed?'Released':'Not issued';$('hudQuality').textContent=state.runStart?quality().toFixed(1)+'%':'Awaiting run';$('lotProgress').style.width=(state.records.filter(Boolean).length/stations.length*100)+'%';const ms=currentElapsed();$('hudTime').textContent=formatTime(ms);const b=benchmarks();$('hudTime').style.color=b.best==null||ms<=b.best?'#67f6a3':b.median==null||ms<=b.median?'#ffcf56':'#ffffff';refreshWaferVisual(state.handWafer);const layerLines=[];if(state.runStart)layerLines.push('<span>✓ Blank P-type CCD substrate</span>');if(state.records[0])layerLines.push(`<span>Recipe: ${escapeHtml(state.pattern)}</span>`);state.records.forEach((r,i)=>{if(i>0&&r)layerLines.push(`<span>${stations[i].short}: ${formatMetric(r.metric,stations[i].metric)} ${stations[i].metric.unit}</span>`)});$('waferLayers').innerHTML='<b>CARRIED WAFER</b>'+(layerLines.length?layerLines.join(''):'<span>No wafer issued</span>');        
if(state.completed){$('objectiveMain').textContent='Lot complete — manufacturing record released';$('objectiveSub').textContent='Review the report or start another wafer run.'}else if(state.awaitingDelivery){$('objectiveMain').textContent='Submit wafer at Final Delivery Bench';$('objectiveSub').textContent='Place the wafer onto the illuminated green submission pad at the far end of the cleanroom.'}else if(!state.runStart){$('objectiveMain').textContent='Pick up the blank 200 mm wafer';$('objectiveSub').textContent='Take the wafer offered by the stock robot arm (grab with Left Mouse or VR trigger).'}else if(st){const name=s.name;if(st.state==='ready'&&state.carrying){$('objectiveMain').textContent='Open '+name+' and load the wafer';$('objectiveSub').textContent='Pull or click the chamber door open, then seat the wafer inside.'}else if(st.state==='loadedDoorOpen'){$('objectiveMain').textContent='Close the chamber door';$('objectiveSub').textContent='START beside the door remains interlocked until the door latches shut.'}else if(st.state==='loaded'){$('objectiveMain').textContent='Set the recipe and start '+name;$('objectiveSub').textContent='Adjust lower dials/sliders, then press green START right beside the door.'}else if(st.state==='running'){$('objectiveMain').textContent=name+' is running (door locked)';$('objectiveSub').textContent='Watch through the clear hood and press red STOP beside the door at the endpoint.'}else if(st.state==='done'){$('objectiveMain').textContent='Open '+name+' and collect the wafer';$('objectiveSub').textContent='Open the door, pick up the wafer by hand, then close the door.'}else if(st.state==='unloadedDoorOpen'){$('objectiveMain').textContent='Close '+name+' after unloading';$('objectiveSub').textContent='The next traveller operation releases when the door latches shut.'}else{$('objectiveMain').textContent='Proceed to '+name;$('objectiveSub').textContent=s.desc}}}        
function valueText(c,v){if(c.kind==='choice')return v;const decimals=c.step<1?(String(c.step).split('.')[1]||'').length:0;return Number(v).toFixed(decimals)+' '+c.unit}        
function specText(c){return c.kind==='choice'?'Required: '+c.target:`Required: ${c.target} ± ${c.tol} ${c.unit}`}        
function controlFitness(c,v){if(c.kind==='choice')return v===c.target?100:0;return clamp(100-Math.abs(Number(v)-c.target)/c.tol*25,0,100)}        
function machineStateText(st){return st.state.replace(/([A-Z])/g,' $1').toUpperCase()}        
function updateMachineGui(){const target=state.focus?.userData,m=target?.machineIndex!=null?machines[target.machineIndex+1]:state.nearest?.index!=null?machines[state.nearest.index+1]:null;if(!m){$('machineGui').classList.remove('active');$('machineName').textContent='NO MACHINE TARGETED';return}$('machineGui').classList.add('active');const s=m.station,st=status[m.index];$('machineName').textContent=s.name.toUpperCase();$('machineState').textContent=machineStateText(st);$('recipeText').innerHTML=`<b>${s.short}</b><br>${s.desc}<br><span style="color:#7f9cab">${s.note}</span>`;if(target?.type==='control'){const c=s.controls.find(x=>x.key===target.controlKey);$('controlLabel').textContent=c.label.toUpperCase();$('controlValue').textContent=valueText(c,st.values[c.key]);$('controlSpec').textContent=specText(c)}else if(target?.type==='button'){$('controlLabel').textContent=(target.label||'BUTTON').toUpperCase();$('controlValue').textContent=buttonEnabled(target)?'ENABLED':'INTERLOCKED';$('controlSpec').textContent=buttonHint(target)}else{$('controlLabel').textContent='POINT AT A DIAL, SLIDER OR BUTTON';$('controlValue').textContent='—';$('controlSpec').textContent='Mouse wheel adjusts the targeted control'}const metric=st.metric||0,ratio=metric/s.metric.target;$('metricLabel').textContent=s.metric.label.toUpperCase();$('metricValue').textContent=`${formatMetric(metric,s.metric)} / ${s.metric.target} ${s.metric.unit}`;$('metricFill').style.width=clamp(ratio*100,0,100)+'%';$('metricFill').style.background=ratio>1.08?'linear-gradient(90deg,#ffcf56,#ff6579)':'linear-gradient(90deg,#53e7ff,#67f6a3)'}        
function formatMetric(v,m){const d=m.unit==='µm'||m.unit.includes('ions')?2:m.unit==='%'||m.unit==='samples'||m.unit==='nm'||m.unit==='s'?1:1;return Number(v).toFixed(d)}        
function buttonHint(d){if(d.kind==='stock')return'Issues one tracked blank wafer';if(d.action==='door')return isDoorLocked(d.machineIndex)?'Door is locked while the machine is running — press STOP first':'Pull or click the 3D door handle to open or close it';if(d.action==='chamber'){const st=status[d.machineIndex];if(st?.doorAmount<.92)return'Open the door, then look inside the chamber';if(st?.state==='ready')return state.carrying?'Insert the carried wafer by hand':'A carried wafer is required';if(st?.state==='done')return state.carrying?'Your hands are already occupied':'Remove the completed wafer by hand';return'Chamber access is available when loading or unloading'}if(d.action==='start')return'Requires loaded wafer and fully closed door';if(d.action==='stop')return'Requires running process and fully closed door';return''}
function buttonEnabled(d){if(d.kind==='stock')return state.started&&!state.runStart&&!state.carrying;if(d.kind!=='machine')return true;const i=d.machineIndex,st=status[i],m=machines[i+1];if(i!==state.current||state.completed)return false;if(d.action==='door')return !isDoorLocked(i);if(d.action==='chamber')return st.doorAmount>.92&&((st.state==='ready'&&state.carrying)||(st.state==='done'&&!state.carrying));if(d.action==='start')return m?.kind==='fabrication'&&st.state==='loaded'&&!!m?.wafer?.visible&&st.doorAmount<=(5/90);if(d.action==='stop')return st.state==='running'&&st.doorAmount<.02&&state.cycle&&performance.now()-state.cycle.start>400;return false}
function updateButtonVisuals(){const t=performance.now()*.001;interactives.forEach(o=>{if(o.userData.type!=='button'||o.userData.visualButton===false)return;const en=buttonEnabled(o.userData),idleCol=o.userData.disabledColor??0x34434b;o.material.color.setHex(en?o.userData.baseColor:idleCol);o.material.emissive.setHex(en?o.userData.baseColor:idleCol);o.material.emissiveIntensity=en?(o.userData.glowMaterial?1.45+0.25*Math.sin(t*6.2):.48):(o.userData.disabledColor!=null?.18:0);if(o.userData.glowMesh&&o.userData.glowMaterial){o.userData.glowMesh.visible=en;o.userData.glowMaterial.uniforms.uTime.value=t;o.userData.glowMaterial.uniforms.uIntensity.value=en?1.15:0}})}        
function setLamp(i){const m=machines[i+1],st=status[i];let col=0x263846;if(['ready','loadedDoorOpen','loaded','done','unloadedDoorOpen'].includes(st.state))col=stations[i].color;if(st.state==='running')col=C.amber;if(st.state==='complete')col=C.green;m.lamp.material.color.setHex(col);m.lamp.material.emissive.setHex(col);m.lamp.material.emissiveIntensity=st.state==='locked'?0:.8}        
function toast(msg,type=''){const d=document.createElement('div');d.className='toast '+type;d.textContent=msg;$('log').appendChild(d);while($('log').children.length>4)$('log').firstChild.remove();setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),320)},4200)}        
function dispenseWafer(){if(!buttonEnabled({kind:'stock'}))return;state.runStart=performance.now();state.carrying=false;state.waferBroken=false;status[0].state='ready';setLamp(0);placeWaferAtStock();toast('Blank wafer issued. Pick it up with either trigger.');updateAll()}        
function activateFocused(){const o=state.focus;if(!o)return;const d=o.userData;if(d.type==='control'){adjustControl(d,1);return}if(!buttonEnabled(d)){toast('Control interlocked: '+buttonHint(d),'warn');return}if(d.kind==='stock'){dispenseWafer();return}const i=d.machineIndex;if(d.action==='door')toggleDoor(i);if(d.action==='chamber'){if(status[i].state==='ready')loadWafer(i);else if(status[i].state==='done')unloadWafer(i)}if(d.action==='load')loadWafer(i);if(d.action==='start')startProcess(i);if(d.action==='stop')stopProcess(i);if(d.action==='unload')unloadWafer(i)}        
function toggleDoor(i){if(isDoorLocked(i)){notifyDoorLocked(i);return}const st=status[i];st.doorTarget=st.doorTarget>.5?0:1;toast((st.doorTarget?'Opening ':'Closing ')+stations[i].name+' door.');updateAll()}
function loadWafer(i){const st=status[i],m=machines[i+1];state.carrying=false;state.handWafer.visible=false;st.state='loading';m.wafer.visible=true;m.wafer.position.set(0,1.45,1.75);m.wafer.rotation.set(-Math.PI/2,0,0);st.transfer={mode:'load',t:0};toast('Hand-guided wafer insertion started.');updateAll()}        
function unloadWafer(i){const st=status[i];st.state='unloading';st.transfer={mode:'unload',t:0};toast('Lifting the completed wafer out of '+stations[i].name+' by hand.');updateAll()}        
function startProcess(i){const st=status[i],s=stations[i],m=machines[i+1];if(!m||m.kind!=='fabrication'||!m.wafer?.visible||st.state!=='loaded'||st.doorAmount>(5/90))return false;st.state='running';st.metric=0;state.cycle={i,start:performance.now(),processSeconds:0,timeScale:clamp(s.targetSeconds/8,3,25)};setLamp(i);$('cycleBar').style.opacity='1';toast(s.name+' started. Manual STOP required at the process endpoint.');updateAll();return true}        
function calculateMetric(i,t){const s=stations[i],st=status[i];try{return Math.max(0,s.metric.calc(st.values,t))}catch(e){return 0}}        
function scoreProcess(i){const s=stations[i],st=status[i];let sum=0,w=0,deviations=[];s.controls.forEach(c=>{const f=controlFitness(c,st.values[c.key]);sum+=f*c.weight;w+=c.weight;if(f<75)deviations.push({f,txt:c.kind==='choice'?`${c.label}: ${st.values[c.key]}; required ${c.target}.`:`${c.label}: ${valueText(c,st.values[c.key])}; target ${c.target} ± ${c.tol} ${c.unit}.`})});const endpoint=clamp(100-Math.abs(st.metric-s.metric.target)/s.metric.tol*25,0,100);sum+=endpoint*1.8;w+=1.8;if(endpoint<75)deviations.push({f:endpoint,txt:`${s.metric.label}: ${formatMetric(st.metric,s.metric)} ${s.metric.unit}; target ${s.metric.target} ± ${s.metric.tol} ${s.metric.unit}.`});deviations.sort((a,b)=>a.f-b.f);return{score:sum/w,deviations:deviations.map(d=>d.txt),endpoint}}        
function stopProcess(i){if(!state.cycle||state.cycle.i!==i)return;const st=status[i],s=stations[i],result=scoreProcess(i);st.score=result.score;st.deviations=result.deviations;st.state='done';state.records[i]={score:result.score,metric:st.metric,ratio:st.metric/s.metric.target,values:{...st.values},processSeconds:state.cycle.processSeconds};if(i===0)state.pattern=st.values.pattern;state.cycle=null;$('cycleBar').style.opacity='0';setLamp(i);refreshWaferVisual(machines[i+1].wafer);const tone=result.score>=80?'':result.score>=60?'warn':'bad';toast(`${s.short}: ${result.score.toFixed(0)}% stage quality recorded. Open the door and unload.`,tone);updateAll()}        
function completeStage(i){const st=status[i];st.state='complete';setLamp(i);state.current=i+1;if(state.current>=stations.length){finishLot();return}status[state.current].state='ready';setLamp(state.current);toast('Transfer complete. Next: '+stations[state.current].name+'.');updateAll()}        
function finishLot(){state.completed=true;state.elapsed=performance.now()-state.runStart;state.carrying=true;state.handWafer.visible=true;const q=quality(),before=benchmarks(),runs=getRuns();runs.push({user:state.username,time:Math.round(state.elapsed),quality:Math.round(q),pattern:state.pattern,date:new Date().toISOString(),processes:state.records});localStorage.setItem('waferFabRunsV2',JSON.stringify(runs.slice(-100)));updateBenchmark();showReport(before);updateAll()}        
function showReport(before=benchmarks()){
  document.exitPointerLock?.();
  const q=quality(),yieldPct=clamp(22+q*.78-state.records.filter(r=>r&&r.score<60).length*3.5,2,99.2),grade=yieldPct>=92?'A':yieldPct>=82?'B':yieldPct>=68?'C':yieldPct>=50?'D':'F',relation=before.best==null?'First recorded benchmark.':state.elapsed<=before.best?'New local best time.':state.elapsed<=before.median?'Finished within the previous median.':'Finished beyond the previous median.';
  const rankedRuns=getRuns().slice().sort((a,b)=>(Number(b.quality)||0)-(Number(a.quality)||0)||(a.time-b.time));
  const myRankIdx=rankedRuns.findIndex(r=>Math.abs(r.time-Math.round(state.elapsed))<=50&&(r.user||'Operator')===(state.username||'Operator'));
  const rankNum=myRankIdx>=0?myRankIdx+1:1,totalRuns=Math.max(1,rankedRuns.length);
  $('reportGrade').textContent=grade;$('reportGrade').style.color=grade==='A'?'#67f6a3':grade==='B'?'#53e7ff':grade==='C'?'#ffcf56':'#ff6579';
  $('reportTitle').textContent=state.lotId+' wafer submitted';
  $('reportSub').textContent=`${state.username||'Operator'} ranked #${rankNum} of ${totalRuns} submissions. ${relation}`;
  $('reportKpis').innerHTML=`<div class="kpi"><small>EST. ELECTRICAL YIELD</small><strong>${yieldPct.toFixed(1)}%</strong></div><div class="kpi"><small>MEAN PROCESS QUALITY</small><strong>${q.toFixed(1)}%</strong></div><div class="kpi"><small>RANKING</small><strong>#${rankNum} / ${totalRuns}</strong></div><div class="kpi"><small>TOTAL RUN TIME</small><strong>${formatTime(state.elapsed)}</strong></div>`;
  $('reportRows').innerHTML=stations.map((s,i)=>{const r=state.records[i],d=r?.deviations?.[0]||status[i].deviations[0]||'Inside the preferred process window',score=r?r.score:0,stageTime=r?.elapsedMs?formatTime(r.elapsedMs):r?.processSeconds!=null?r.processSeconds.toFixed(1)+'s':'--';return`<tr><td>${String(i+1).padStart(2,'0')} / ${s.short}</td><td style="color:${score>=80?'#67f6a3':score>=60?'#ffcf56':'#ff6579'}">${r?score.toFixed(0)+'%':'--'}</td><td>${stageTime}</td><td>${r?`${formatMetric(r.metric,s.metric)} ${s.metric.unit}`:'--'}</td><td>${d}</td></tr>`}).join('');
  if($('reportRanking')){$('reportRanking').innerHTML=`<b>LEADERBOARD RANKINGS (TOP 5)</b>`+rankedRuns.slice(0,5).map((r,idx)=>`<div class="rank-row${idx+1===rankNum?' me':''}"><span>#${idx+1} · ${escapeHtml(r.user||'Operator')}</span><span>${Number(r.quality||0).toFixed(0)}%</span><span>${formatTime(r.time)}</span></div>`).join('')}
  $('report').style.display=renderer.xr.isPresenting?'none':'grid';
  if(renderer.xr.isPresenting)showXROverlay('complete');
}
function updateTransfers(dt){status.forEach((st,i)=>{const m=machines[i+1];if(st.transfer){st.transfer.t=clamp(st.transfer.t+dt/1.35,0,1);const u=st.transfer.mode==='load'?st.transfer.t:1-st.transfer.t;m.wafer.position.y=lerp(1.45,1.82,u)+Math.sin(st.transfer.t*Math.PI)*.2;m.wafer.position.z=lerp(1.75,.35,u);if(st.transfer.t>=1){if(st.transfer.mode==='load'){st.state='loadedDoorOpen';m.wafer.position.set(0,1.82,.35);refreshWaferVisual(m.wafer);toast('Wafer seated. Close the chamber door.')}else{m.wafer.visible=false;state.carrying=true;state.handWafer.visible=true;refreshWaferVisual(state.handWafer);st.state='unloadedDoorOpen';toast('Wafer collected. Close the chamber door.')}st.transfer=null;updateAll()}}})}        
function updateDoors(dt){status.forEach((st,i)=>{const m=machines[i+1];if(!m||m.kind!=='fabrication'||!m.door)return;if(isDoorLocked(i)){st.doorAmount=0;st.doorTarget=0;phys.doorVelocities[i]=0;m.door.rotation.y=0;return}if(!renderer.xr.isPresenting){if(st.doorAmount>0&&st.doorAmount<DOOR_MAGNET_ANGLE&&st.doorTarget<=.5){st.doorAmount=Math.max(0,st.doorAmount-1.35*dt)}else{st.doorAmount=lerp(st.doorAmount,st.doorTarget,1-Math.exp(-dt*5.5))}}else if(!phys.doorGrab||phys.doorGrab.i!==i){let v=phys.doorVelocities[i]||0;if(st.doorAmount>0&&st.doorAmount<DOOR_MAGNET_ANGLE&&v<=.65){v-=3.4*dt;if(v>0)v*=.45}else{v*=Math.exp(-dt*3.2)}st.doorAmount=clamp(st.doorAmount+v*dt,0,1);phys.doorVelocities[i]=v;if(st.doorAmount<=.002||(st.doorAmount<DOOR_MAGNET_ANGLE&&Math.abs(v)<.2&&v<=0)){if(st.doorAmount>0)pulseXR(.55,55);st.doorAmount=0;st.doorTarget=0;phys.doorVelocities[i]=0}}
if((st.doorAmount<=.002&&st.doorTarget===0)||Math.abs(st.doorAmount-st.doorTarget)<.008&&!renderer.xr.isPresenting){st.doorAmount=st.doorAmount<=.002?0:st.doorTarget}m.door.rotation.y=-st.doorAmount*Math.PI/2;if(st.doorAmount===0){if(st.state==='loadedDoorOpen')st.state='loaded';else if(st.state==='unloadedDoorOpen')completeStage(i)}})}        
function updateCycle(now){if(!state.cycle)return;const c=state.cycle,s=stations[c.i],st=status[c.i],m=machines[c.i+1];c.processSeconds=(now-c.start)/1000*c.timeScale;st.metric=calculateMetric(c.i,c.processSeconds);const ratio=st.metric/s.metric.target;if(m?.wafer)refreshWaferVisual(m.wafer,c.i,ratio,st.values);$('cycleName').textContent=s.name.toUpperCase();$('cycleTime').textContent=`${c.processSeconds.toFixed(1)} process s · ${formatMetric(st.metric,s.metric)} ${s.metric.unit}`;$('cycleFill').style.width=clamp(ratio*100,0,100)+'%';updateMachineGui()}        
function adjustControl(d,dir){const i=d.machineIndex,st=status[i],s=stations[i];if(i!==state.current||!['ready','loadedDoorOpen','loaded'].includes(st.state)){toast('Recipe controls are locked in the current machine state.','warn');return}const c=s.controls.find(x=>x.key===d.controlKey);if(c.kind==='choice'){let n=c.options.indexOf(st.values[c.key]);n=(n+dir+c.options.length)%c.options.length;st.values[c.key]=c.options[n]}else st.values[c.key]=clamp(Number((st.values[c.key]+dir*c.step).toFixed(8)),c.min,c.max);updateControlMeshes(i);updateMachineGui()}        
function updateControlMeshes(i){const s=stations[i],st=status[i],m=machines[i+1];if(!s||!st||!m||!Array.isArray(m.controls)||m.controls.length===0)return;s.controls.forEach((c,j)=>{const ref=m.controls[j];if(!ref)return;const v=st.values[c.key];let n=c.kind==='choice'?c.options.indexOf(v)/Math.max(1,c.options.length-1):(v-c.min)/(c.max-c.min);if(ref.track&&ref.mesh)ref.mesh.position.y=1.36-Math.floor(j/2)*.64+(n-.5)*.34;else{const target=ref.rotor||ref.mesh;if(target)target.rotation.z=-2.25+n*4.5}})}        
function raycastFocus(){if(renderer.xr.isPresenting){setXRFocus();return}raycaster.setFromCamera({x:0,y:0},camera);const hits=raycaster.intersectObjects(interactives,false);let found=null;for(const h of hits){const d=h.object.getWorldPosition(new THREE.Vector3()).distanceTo(camera.getWorldPosition(new THREE.Vector3()));if(d<3.4){found=h.object;break}}if(state.focus!==found){if(state.focus?.material?.emissive)state.focus.material.emissiveIntensity=state.focus.userData.type==='button'?.42:.25;state.focus=found;if(found?.material?.emissive)found.material.emissiveIntensity=.9}const tag=$('focusTag');tag.style.opacity=found?'1':'0';if(found){const d=found.userData;tag.textContent=d.type==='control'?`${d.label} — WHEEL TO ADJUST`:`${d.label} — CLICK / E`;const enabled=d.type==='control'||buttonEnabled(d);tag.style.borderColor=enabled?'#53e7ff':'#ff6579';$('actionBtn').disabled=!enabled;$('actionBtn').textContent=d.type==='control'?`ADJUST ${d.label.toUpperCase()} [WHEEL]`:`PRESS ${d.label.toUpperCase()} [E]`}else{$('actionBtn').disabled=true;$('actionBtn').textContent='POINT AT A MACHINE CONTROL'}updateMachineGui()}        
function getNearest(){let best=null,dist=3.5;stations.forEach((s,i)=>{const d=Math.hypot(player.position.x-s.side*6.65,player.position.z-s.z);if(d<dist){dist=d;best={index:i,name:s.name}}});const ds=Math.hypot(player.position.x,player.position.z-10);if(ds<dist){dist=ds;best={index:null,name:'Blank Wafer Stock'}}if(deliveryStation){const dd=Math.hypot(player.position.x,player.position.z+40.2);if(dd<dist)best={index:null,name:'Final Delivery Bench'}}state.nearest=best;$('prompt').textContent=best?.name==='Final Delivery Bench'?'Place completed wafer onto the green submission pad':best?'Point at the physical machine panel':'Follow the illuminated floor route'}
function updateMovement(dt){if(renderer.xr.isPresenting||!state.started||document.pointerLockElement!==renderer.domElement)return;state.crouching=!!(keys.ShiftLeft||keys.ShiftRight);const moving=!!(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD||keys.ArrowUp||keys.ArrowDown||keys.ArrowLeft||keys.ArrowRight);state.sprinting=!!(keys.ControlLeft||keys.ControlRight)&&moving&&!state.crouching;const tau=3.34,target=state.sprinting?0:1;state.stamina=target+(state.stamina-target)*Math.exp(-dt/tau);const walk=state.crouching?1.2:2.75,added=state.sprinting?4.4*state.stamina:0,speed=walk+added;let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),len=Math.hypot(f,r)||1;f/=len;r/=len;let nx=clamp(player.position.x+(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed*dt,-8.25,8.25),nz=clamp(player.position.z+(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed*dt,-40.5,11.2);for(const c of colliders){if(Math.abs(nx-c.x)<c.w/2+.34&&Math.abs(nz-c.z)<c.d/2+.34){nx=player.position.x;nz=player.position.z;break}}player.position.x=nx;player.position.z=nz;player.position.y=lerp(player.position.y,state.crouching?1.29:2.58,1-Math.exp(-dt*10));player.rotation.y=yaw;camera.rotation.order='YXZ';camera.rotation.x=pitch;$('staminaBar').style.width=state.stamina*100+'%';$('staminaNumber').textContent=Math.round(state.stamina*100)+'%';$('staminaBar').style.background=state.stamina<.25?'#ff6579':'linear-gradient(90deg,#17a9ee,#54f7a1)'}        
function drawMap(){const c=$('map'),x=c.getContext('2d'),w=c.width,h=c.height;x.clearRect(0,0,w,h);x.fillStyle='#07131e';x.fillRect(0,0,w,h);x.strokeStyle='#2a5267';x.lineWidth=3;x.strokeRect(36,10,w-72,h-20);x.fillStyle='rgba(50,211,244,.08)';x.fillRect(39,13,w-78,145);x.fillStyle='rgba(177,108,255,.08)';x.fillRect(39,160,w-78,h-173);x.fillStyle='#5e8295';x.font='700 12px monospace';x.fillText('LITHOGRAPHY',45,29);x.fillText('IMPLANT + FILMS',45,177);const zx=z=>h-20-(10-z)/49*(h-38),xx=a=>w/2+a/9*(w/2-42);x.fillStyle=!state.runStart?'#fff':'#355060';x.beginPath();x.arc(xx(0),zx(10),!state.runStart?7:4,0,Math.PI*2);x.fill();stations.forEach((s,i)=>{x.fillStyle=i===state.current&&!state.completed?'#fff':status[i].state==='complete'?'#67f6a3':'#355060';x.beginPath();x.arc(xx(s.side*6.65),zx(s.z),i===state.current?7:4,0,Math.PI*2);x.fill()});x.save();x.translate(xx(player.position.x),zx(player.position.z));x.rotate(Math.PI-yaw);x.fillStyle='#53e7ff';x.beginPath();x.moveTo(0,-8);x.lineTo(6,6);x.lineTo(0,4);x.lineTo(-6,6);x.closePath();x.fill();x.restore()}        
function updateAll(){updateHUD();updateMachineGui();updateButtonVisuals();status.forEach((_,i)=>{setLamp(i);updateControlMeshes(i)})}        
function enforceStationWaferVisibility(){status.forEach((st,i)=>{const machine=machines[i+1];if(!machine?.wafer)return;const seated=['loadedDoorOpen','loaded','running','done'].includes(st.state);if(!seated)machine.wafer.visible=false})}
function loop(now){const dt=Math.min(.05,(now-lastFrame)/1000||0);lastFrame=now;if(renderer.xr.isPresenting)updateXRMovement(dt,now);else updateMovement(dt);if(!state.paused){updatePhysicalSystem(dt,now);updateDoors(dt);updateTransfers(dt);updateCycle(now);}enforceStationWaferVisibility();updateXRButtons(now);animateEffects(now/1000,dt);getNearest();raycastFocus();updateButtonVisuals();if(state.started)updateHUD();refreshTutorialCoach();if(state.handWafer?.visible&&!renderer.xr.isPresenting&&state.carrying)state.handWafer.rotation.z=.15+Math.sin(now*.004)*.025;drawMap();renderer.render(scene,camera)}
function bind(){addEventListener('keydown',e=>{keys[e.code]=true;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyE'].includes(e.code)&&document.pointerLockElement===renderer.domElement)e.preventDefault();if(e.code==='KeyE'&&!e.repeat&&state.started&&document.pointerLockElement===renderer.domElement)activateFocused()});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement&&state.started){yaw-=e.movementX*.0022;pitch=clamp(pitch-e.movementY*.0019,-1.35,1.35)}});addEventListener('wheel',e=>{if(document.pointerLockElement===renderer.domElement&&state.focus?.userData.type==='control'){e.preventDefault();adjustControl(state.focus.userData,e.deltaY<0?1:-1)}},{passive:false});renderer.domElement.addEventListener('click',()=>{if(!state.started)return;if(document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.();else activateFocused()});$('actionBtn').onclick=activateFocused;$('startGame').onclick=()=>{const name=$('username').value.trim();if(!name){$('username').focus();return}state.username=name;$('operator').textContent=name;state.started=true;$('intro').style.display='none';$('xrButton').style.display='block';newRun();renderer.domElement.requestPointerLock?.()};$('xrButton').onclick=enterXR;if($('introVR'))$('introVR').onclick=enterXR;$('username').addEventListener('keydown',e=>{if(e.key==='Enter')$('startGame').click()});$('closeReport').onclick=()=>{$('report').style.display='none';renderer.domElement.requestPointerLock?.()};$('newLot').onclick=()=>{newRun();renderer.domElement.requestPointerLock?.()};addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))})}


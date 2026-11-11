'use strict';
// V8.7 isolated 3D schematic and layout spaces.  
const designWorld={root:null,board:null,texture:null,labelCanvas:null,labelTexture:null,labelOverlay:null,active:false,stage:0,returnPos:new THREE.Vector3(),returnYaw:0,returnPitch:0,dragging:false,gainDrag:null,xrDragging:new Set(),w:12,h:7.5,layout3D:null,layout3DSignature:'',layoutPreview3D:null,actionPanel:null,actionButtons:[],actionSignature:'',actionNotice:''};
function ensureDesignWorld(){  
  if(designWorld.root)return;  
  const root=new THREE.Group();root.position.set(0,0,165);root.visible=false;scene.add(root);designWorld.root=root;  
  const floor=box(24,.12,24,mat(0x0c1b24,.05,.58),root,0,-.08,0),wall=mat(0x142c38,.08,.56);  
  box(24,9,.2,wall,root,0,4.5,-9);box(24,9,.2,wall,root,0,4.5,11);box(.2,9,20,wall,root,-12,4.5,1);box(.2,9,20,wall,root,12,4.5,1);  
  box(17,9,.22,mat(0x315669,.5,.22),root,.5,4.3,-8.72);  
  designWorld.texture=new THREE.CanvasTexture($('designCanvas'));designWorld.texture.colorSpace=THREE.SRGBColorSpace;designWorld.texture.minFilter=THREE.LinearFilter;  
  designWorld.board=new THREE.Mesh(new THREE.PlaneGeometry(designWorld.w,designWorld.h),new THREE.MeshBasicMaterial({map:designWorld.texture,toneMapped:false,side:THREE.DoubleSide}));root.add(designWorld.board);designWorld.board.position.set(-1.5,4.3,-8.45);designWorld.board.userData.designBoard=true;designWorld.board.castShadow=false;designWorld.board.receiveShadow=false;
  designWorld.labelCanvas=document.createElement('canvas');designWorld.labelCanvas.width=$('designCanvas').width;designWorld.labelCanvas.height=$('designCanvas').height;designWorld.labelTexture=new THREE.CanvasTexture(designWorld.labelCanvas);designWorld.labelTexture.colorSpace=THREE.SRGBColorSpace;designWorld.labelTexture.minFilter=THREE.LinearFilter;designWorld.labelOverlay=new THREE.Mesh(new THREE.PlaneGeometry(designWorld.w,designWorld.h),new THREE.MeshBasicMaterial({map:designWorld.labelTexture,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));designWorld.labelOverlay.position.z=.24;designWorld.labelOverlay.renderOrder=40;designWorld.board.add(designWorld.labelOverlay);
  const head=labelMesh('INTERACTIVE DESIGN SPACE','#53e7ff',6,.5,28);head.position.set(-1.5,8.65,-8.54);root.add(head);  
  const leftLight=new THREE.PointLight(0x53e7ff,.75,8,2);leftLight.position.set(-5,6,1);root.add(leftLight);const rightLight=new THREE.PointLight(0x53e7ff,.75,8,2);rightLight.position.set(5,6,1);root.add(rightLight);ensureDesignActionPanel()  
}  
function worldActionList(){if(designWorld.stage===0)return[['SUBMIT FIT','submit'],['EXIT','exit']];if(designWorld.stage===1)return[['CLEAR WIRES','clear'],['SUBMIT / NEXT','submit'],['EXIT','exit']];return[['M1','m1'],['M2','m2'],['UNDO WIRE','undo'],['CLEAR ROUTES','clear'],['RELEASE DESIGN','submit'],['EXIT','exit']]}
function ensureDesignActionPanel(){if(designWorld.actionPanel)return;const panel=new THREE.Group();panel.position.set(6.4,4.3,-8.72);designWorld.root.add(panel);box(3.55,8.1,.18,mat(0x0a1a24,.2,.55),panel,0,0,0);const title=labelMesh('DESIGN CONTROLS','#53e7ff',2.8,.32,30);title.position.set(0,3.55,.105);panel.add(title);designWorld.actionPanel=panel;rebuildDesignActionButtons()}
function rebuildDesignActionButtons(){if(!designWorld.actionPanel)return;for(const button of designWorld.actionButtons){button.parent?.remove(button);button.userData.labelMesh?.parent?.remove(button.userData.labelMesh);button.geometry.dispose();button.material.dispose();button.userData.labelMesh?.material.map?.dispose();button.userData.labelMesh?.material.dispose();button.userData.labelMesh?.geometry.dispose()}designWorld.actionButtons=[];const actions=worldActionList(),buttonH=.82,gap=.22,total=actions.length*buttonH+(actions.length-1)*gap,top=total/2-buttonH/2;actions.forEach(([label,action],index)=>{const y=top-index*(buttonH+gap),layer=action==='m1'||action==='m2',selected=layer&&designMode.layer===action.toUpperCase(),color=layer?(action==='m1'?0xffe52b:0x168dff):action==='submit'?0x67f6a3:0x54717f,surface=box(3.1,buttonH,.09,mat(selected?color:0x142a35,.24,.4,false,1,selected?color:0),designWorld.actionPanel,0,y,.15);surface.material.emissiveIntensity=selected?.32:0;surface.userData={action,label,baseColor:color,layer,selected};const caption=labelMesh(label,'#eff8fb',2.6,layer?.68:.34,layer?60:30);caption.position.set(0,y,.205);designWorld.actionPanel.add(caption);surface.userData.labelMesh=caption;designWorld.actionButtons.push(surface)});designWorld.actionSignature=`${designWorld.stage}:${designMode.layer}:${designMode.layoutComplete}`}
function setDesignPanelStatus(text,color='#a9c0cb'){if(!designWorld.actionPanel)return;if(designWorld.actionStatus?.userData.text===text&&designWorld.actionStatus.userData.color===color)return;if(designWorld.actionStatus){const old=designWorld.actionStatus;old.parent?.remove(old);old.material.map?.dispose();old.material.dispose();old.geometry.dispose()}const label=labelMesh(text,color,3.1,.28,23);label.position.set(0,-3.62,.105);label.userData.text=text;label.userData.color=color;designWorld.actionPanel.add(label);designWorld.actionStatus=label}
function syncDesignActionPanel(){ensureDesignActionPanel();const signature=`${designWorld.stage}:${designMode.layer}:${designMode.layoutComplete}`;if(signature!==designWorld.actionSignature)rebuildDesignActionButtons();if(designWorld.actionNotice)setDesignPanelStatus(designWorld.actionNotice,'#ff8b79');else if(designWorld.stage===2)setDesignPanelStatus(`${designMode.layoutConnected}/3 NETS · ${designMode.layoutScore.toFixed(1)}% QUALITY`,designMode.layoutComplete?'#67f6a3':'#d5e5ea');else setDesignPanelStatus(designWorld.stage===0?'FIT THE REGRESSION':'REPAIR TWO CIRCUIT CONNECTIONS')}
function designActionHit(origin,direction){raycaster.set(origin,direction);return raycaster.intersectObjects(designWorld.actionButtons,false)[0]?.object||null}
function activateDesignAction(button){if(!button)return false;const action=button.userData.action;if(action==='m1'||action==='m2')setWorldLayer(action.toUpperCase());else executeWorldAction(action);return true}
function designXRAction(controller){if(!controller||!designWorld.actionButtons.length)return null;controller.updateMatrixWorld(true);const rotation=new THREE.Matrix4().extractRotation(controller.matrixWorld),origin=new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld),direction=new THREE.Vector3(0,0,-1).applyMatrix4(rotation).normalize();return designActionHit(origin,direction)}
function designDesktopAction(){raycaster.setFromCamera({x:0,y:0},camera);return raycaster.intersectObjects(designWorld.actionButtons,false)[0]?.object||null}
function disposeDesignObject(root){root.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.()});root.parent?.remove(root)}  
function boardLocalFromCanvas(x,y){const c=$('designCanvas');return{x:(x/c.width-.5)*designWorld.w,y:(.5-y/c.height)*designWorld.h}}  
function layoutBox(parent,x,y,w,h,z,depth,material){const q=boardLocalFromCanvas(x,y),sx=w/$('designCanvas').width*designWorld.w,sy=h/$('designCanvas').height*designWorld.h,m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,depth),material);m.position.set(q.x,q.y,z+depth/2);m.renderOrder=20;parent.add(m);return m}  
function layoutSegment3D(parent,a,b,layer,material){const pa=boardLocalFromCanvas(a.x,a.y),pb=boardLocalFromCanvas(b.x,b.y),z=layer==='M2'?.325:.055,thickness=.035,width=.105,dx=pb.x-pa.x,dy=pb.y-pa.y,length=Math.hypot(dx,dy);if(length<.002)return;const m=new THREE.Mesh(new THREE.BoxGeometry(length,width,thickness),material);m.position.set((pa.x+pb.x)/2,(pa.y+pb.y)/2,z);m.rotation.z=Math.atan2(dy,dx);m.renderOrder=24;parent.add(m)}  
function layoutVia3D(parent,p,material){const q=boardLocalFromCanvas(p.x,p.y),height=.325-.055+.035+.025,m=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,height,20),material);m.rotation.x=Math.PI/2;m.position.set(q.x,q.y,.055+height/2-.0175);m.renderOrder=26;parent.add(m)}  
function layoutSignature(){return JSON.stringify({stage:designWorld.stage,routes:designMode.layoutRoutes})}  
function syncLayout3D(force=false){  
  if(!designWorld.active||designWorld.stage!==2){if(designWorld.layout3D){disposeDesignObject(designWorld.layout3D);designWorld.layout3D=null;designWorld.layout3DSignature=''}return}  
  const signature=layoutSignature();if(!force&&signature===designWorld.layout3DSignature)return;designWorld.layout3DSignature=signature;if(designWorld.layout3D)disposeDesignObject(designWorld.layout3D);  
  const group=new THREE.Group();group.name='layout-depth-geometry';designWorld.board.add(group);designWorld.layout3D=group;  
  const M1=new THREE.MeshStandardMaterial({color:0xffe52b,metalness:.72,roughness:.24,emissive:0x665800,emissiveIntensity:.35});  
  const M2=new THREE.MeshStandardMaterial({color:0x168dff,metalness:.72,roughness:.24,emissive:0x092e66,emissiveIntensity:.45});  
  const VIA=new THREE.MeshStandardMaterial({color:0xd56b1f,metalness:.68,roughness:.28,emissive:0x612606,emissiveIntensity:.3});  
  const IN=new THREE.MeshStandardMaterial({color:0xff6579,metalness:.42,roughness:.3});  
  const OUT=new THREE.MeshStandardMaterial({color:0x6f78ff,metalness:.42,roughness:.3});  
  const NO_GO=new THREE.MeshStandardMaterial({color:0x78262d,metalness:.08,roughness:.7,transparent:true,opacity:.72});
  const g=layoutGeometry($('designCanvas').width,$('designCanvas').height),padW=28,padH=36,top=.22;  
  for(const q of g.inputs)layoutBox(group,q.x,q.y,padW,padH,0,top,IN);  
  for(const q of g.outputs)layoutBox(group,q.x,q.y,padW,padH,0,top,OUT);  
  for(const r of g.keepouts)layoutBox(group,r.x+r.w/2,r.y+r.h/2,r.w,r.h,0,top,NO_GO);  
  const canvas=$('designCanvas'),margin=g.margin;layoutBox(group,g.plotW/2,margin/2,g.plotW,margin,0,top,NO_GO);layoutBox(group,g.plotW/2,canvas.height-margin/2,g.plotW,margin,0,top,NO_GO);layoutBox(group,margin/2,canvas.height/2,margin,canvas.height-2*margin,0,top,NO_GO);layoutBox(group,g.plotW-margin/2,canvas.height/2,margin,canvas.height-2*margin,0,top,NO_GO);
  for(const route of designMode.layoutRoutes)for(let i=1;i<route.points.length;i++)layoutSegment3D(group,route.points[i-1],route.points[i],route.layer,route.layer==='M2'?M2:M1);  
  for(const node of designMode.layoutNodes)if(!node.terminal&&node.metals.size>1)layoutVia3D(group,node,VIA)  
}  
function ensureLayoutPreview3D(){if(designWorld.layoutPreview3D)return;const group=new THREE.Group();group.name='layout-wire-preview';designWorld.board.add(group);designWorld.layoutPreview3D=group;for(let i=0;i<3;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,.105,.04),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.38,depthWrite:false,toneMapped:false}));mesh.renderOrder=60;mesh.visible=false;group.add(mesh)}for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.2,.018,8,32),new THREE.MeshBasicMaterial({color:0xff334f,transparent:true,opacity:.85,depthWrite:false,toneMapped:false}));ring.renderOrder=70;ring.visible=false;group.add(ring)}}
function updateLayoutPreview3D(){if(!designWorld.active||designWorld.stage!==2){if(designWorld.layoutPreview3D)designWorld.layoutPreview3D.visible=false;return}ensureLayoutPreview3D();const group=designWorld.layoutPreview3D;group.visible=true;group.children.forEach(mesh=>mesh.visible=false);const draft=designMode.layoutDraft;if(draft)draft.points.slice(1).forEach((point,index)=>{const mesh=group.children[index],a=draft.points[index],pa=boardLocalFromCanvas(a.x,a.y),pb=boardLocalFromCanvas(point.x,point.y),dx=pb.x-pa.x,dy=pb.y-pa.y,length=Math.hypot(dx,dy);mesh.visible=length>.002;mesh.position.set((pa.x+pb.x)/2,(pa.y+pb.y)/2,draft.layer==='M2'?.325:.055);mesh.rotation.z=Math.atan2(dy,dx);mesh.scale.x=Math.max(length,.001);mesh.material.color.setHex(draft.valid?(draft.layer==='M2'?0x168dff:0xffe52b):0xff6579)});const pulse=.85+.25*Math.sin(performance.now()*.012);designMode.layoutHoverNodes.slice(0,2).forEach((hover,index)=>{const node=layoutNode(hover.id),ring=group.children[index+3];if(!node||!ring)return;const point=boardLocalFromCanvas(node.x,node.y);ring.visible=true;ring.position.set(point.x,point.y,.38);ring.scale.setScalar(pulse)})}
function drawWorldGainControls(ctx,w,h){
  const left=w*.08,right=w*.66,trackW=right-left;
  ctx.fillStyle='rgba(3,14,22,.94)';ctx.fillRect(0,h*.72,w,h*.23);
  [['GRADIENT m',designMode.gain,-4,4,h*.78],['INTERCEPT c',designMode.intercept,-8,8,h*.88]].forEach(([label,value,min,max,y])=>{
    ctx.fillStyle='#d9edf4';ctx.font='700 20px monospace';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,left,y-19);
    ctx.fillStyle='#8da9b5';ctx.textAlign='right';ctx.fillText(value.toFixed(2),right,y-19);
    ctx.fillStyle='#193340';ctx.fillRect(left,y-5,trackW,10);
    ctx.fillStyle='#53e7ff';ctx.fillRect(left,y-5,trackW*(value-min)/(max-min),10);
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(left+trackW*(value-min)/(max-min),y,13,0,Math.PI*2);ctx.fill()
  });
  const x=w*.72,y=h*.755,bw=w*.24,bh=h*.17;ctx.fillStyle='rgba(4,27,22,.98)';ctx.fillRect(x,y,bw,bh);ctx.strokeStyle='#67f6a3';ctx.lineWidth=3;ctx.strokeRect(x,y,bw,bh);ctx.fillStyle='#a8c9b8';ctx.textAlign='left';ctx.font='800 16px monospace';ctx.fillText('REGRESSION MATCH',x+14,y+27);ctx.fillStyle='#67f6a3';ctx.font='900 36px monospace';ctx.fillText(designMode.gainComplete?`${designMode.regressionBest.score.toFixed(1)}%`:'--%',x+14,y+70)
}
function syncDesignBoard(){if(!designWorld.active)return;const c=$('designCanvas');if(c.width<960||c.height<600){c.width=1280;c.height=800}if(designWorld.labelCanvas.width!==c.width||designWorld.labelCanvas.height!==c.height){designWorld.labelCanvas.width=c.width;designWorld.labelCanvas.height=c.height}drawDesignStage();const ctx=c.getContext('2d');if(designWorld.stage===0)drawWorldGainControls(ctx,c.width,c.height);const p=renderer.xr.isPresenting?null:desktopDesignPoint();if(p){ctx.strokeStyle='#53e7ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.moveTo(p.x-15,p.y);ctx.lineTo(p.x+15,p.y);ctx.moveTo(p.x,p.y-15);ctx.lineTo(p.x,p.y+15);ctx.stroke()}const labels=designWorld.labelCanvas.getContext('2d');labels.clearRect(0,0,designWorld.labelCanvas.width,designWorld.labelCanvas.height);if(designWorld.stage===2)drawLayoutLabels(labels,c.width,c.height);designWorld.labelTexture.needsUpdate=true;syncDesignActionPanel();syncLayout3D();updateLayoutPreview3D();designWorld.texture.needsUpdate=true}
function enterDesignWorld(stage){  
  ensureDesignWorld();if(!designWorld.active){designWorld.returnPos.copy(player.position);designWorld.returnYaw=yaw;designWorld.returnPitch=pitch}  
  designWorld.active=true;designWorld.stage=stage;$('designReset').hidden=stage===1;designWorld.root.visible=true;if(stage===2){if(!designMode.layoutNodes.length)initializeLayoutNodes();designWorld.layout3DSignature='';updateLayoutState()}state.focus=null;state.nearest=null;$('designTerminal').className='';$('designTerminal').setAttribute('aria-hidden','true');document.body.classList.remove('design-editing');designMode.phase='world';$('designTerminal').className='';$('designTerminal').setAttribute('aria-hidden','true');document.body.classList.remove('design-editing');  
  player.position.set(0,renderer.xr.isPresenting?.86:2.58,172);yaw=0;pitch=-.03;player.rotation.y=yaw;camera.rotation.x=pitch;Object.keys(keys).forEach(k=>keys[k]=false);if(!renderer.xr.isPresenting)renderer.domElement.requestPointerLock?.();syncDesignBoard();toast(stage===1?'Circuit space active: click-drag directly between wall terminals. F submits, R resets, X clears.':'Layout active: choose M1 or M2, hold a terminal or junction, drag an elbow and release to commit. F releases.')  
}  
function leaveDesignWorld(returnOverlay=true){  
  if(!designWorld.active)return;if(designWorld.layout3D){disposeDesignObject(designWorld.layout3D);designWorld.layout3D=null;designWorld.layout3DSignature=''}designWorld.active=false;designWorld.root.visible=false;designWorld.dragging=false;state.focus=null;state.nearest=null;designWorld.xrDragging.clear();player.position.copy(designWorld.returnPos);yaw=designWorld.returnYaw;pitch=designWorld.returnPitch;player.rotation.y=yaw;camera.rotation.x=pitch;  
  if(returnOverlay&&designMode.step===0){designMode.phase='active';$('designTerminal').className='active';$('designTerminal').setAttribute('aria-hidden','false');document.body.classList.add('design-editing');renderDesignStep();setTimeout(resizeDesignCanvas,0)}else{designMode.phase='idle';$('designTerminal').className='';$('designTerminal').setAttribute('aria-hidden','true');document.body.classList.remove('design-editing')}  
}  
function worldToolbarButtons(){return[]}  
function drawWorldToolbar(){}  
function toolbarActionAt(){return null}  
function setWorldLayer(layer){designMode.layer=layer;document.querySelectorAll('.layer-btn').forEach(b=>b.classList.toggle('active',b.dataset.layer===layer));if(designWorld.active)syncDesignBoard();else drawDesignStage()}  
function executeWorldAction(action){  
  if(action==='exit'){leaveDesignWorld(false);closeDesignMode();return}  
  if(action==='submit'&&designWorld.stage===0){if(!designMode.gainComplete){submitRegression();syncDesignBoard();return}designMode.step=1;designMode.schematicDrag=null;renderDesignStep();designWorld.stage=1;syncDesignBoard();toast('Regression verified. Circuit repair is now active on the wall.');return}
  if(action==='reset'){resetDesignStage();syncDesignBoard();return}  
  if(action==='clear'){if(designWorld.stage===1){designMode.schematicLinks.clear();designMode.schematicDrag=null;designMode.schematicSubmitted=false;designMode.schematicComplete=false;updateSchematicState()}else{designMode.layoutDraft=null;designMode.layoutRoutes=[];initializeLayoutNodes();updateLayoutState()}syncDesignBoard();return}  
  if(action==='undo'){const route=designMode.layoutRoutes.pop();if(route){rebuildLayoutNodeMetals();const end=layoutNode(route.toId);if(end&&!end.terminal&&!end.metals.size)designMode.layoutNodes=designMode.layoutNodes.filter(node=>node!==end);updateLayoutState()}syncDesignBoard();return}  
  if(action==='m1'||action==='m2'){setWorldLayer(action.toUpperCase());return}  
  if(action==='submit'){
    if(designWorld.stage===1){submitSchematic();syncDesignBoard();if(designMode.schematicComplete){designMode.step=2;designWorld.stage=2;designWorld.layout3DSignature='';designMode.layoutActive=null;designMode.layoutDraft=null;initializeLayoutNodes();renderDesignStep();syncDesignBoard();toast('Circuit verified. Two-layer layout is now active on the wall.')}return}  
    if(designMode.layoutComplete){const body=parallel?.active;if(!body){const message='Release blocked: dispense a wafer first.';setDesignMessage(message,'warn');toast(message,'warn');syncDesignActionPanel();return}if(body.nextStage!==0){const message='Release blocked: this wafer already has a sensor design.';setDesignMessage(message,'warn');toast(message,'warn');syncDesignActionPanel();return}leaveDesignWorld(false);releaseDesign();toast('Sensor design released. The next production activity is ready.');return}  
    const result=scoreLayoutNetwork(),message=`Release blocked: ${result.connected}/3 nets, ${result.wrongConnections} wrong connections, ${result.shorts} shorts, ${result.boundaryViolations} boundary breaches, ${result.keepOutViolations} keep-out breaches.`;designWorld.actionNotice=message.toUpperCase();setDesignMessage(message,'warn');toast(message,'warn');syncDesignActionPanel();return  
  }  
}  
function boardPointFromRay(origin,direction){  
  if(!designWorld.active)return null;designWorld.board.updateMatrixWorld(true);const normal=new THREE.Vector3(0,0,1).applyQuaternion(designWorld.board.getWorldQuaternion(new THREE.Quaternion())),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,designWorld.board.getWorldPosition(new THREE.Vector3())),hit=new THREE.Vector3();if(!new THREE.Ray(origin,direction).intersectPlane(plane,hit))return null;const q=designWorld.board.worldToLocal(hit.clone());if(Math.abs(q.x)>designWorld.w/2||Math.abs(q.y)>designWorld.h/2)return null;return{x:(q.x/designWorld.w+.5)*$('designCanvas').width,y:(.5-q.y/designWorld.h)*$('designCanvas').height,world:hit}  
}  
function desktopDesignPoint(){raycaster.setFromCamera({x:0,y:0},camera);return boardPointFromRay(raycaster.ray.origin,raycaster.ray.direction)}  
function xrDesignPoint(c){const m=new THREE.Matrix4().identity().extractRotation(c.matrixWorld),o=new THREE.Vector3().setFromMatrixPosition(c.matrixWorld),d=new THREE.Vector3(0,0,-1).applyMatrix4(m).normalize();return boardPointFromRay(o,d)}  
function fakeEvent(p){return{designX:p.x,designY:p.y,pointerId:1}}  
function updateWorldGainSlider(p,index){const c=$('designCanvas'),ratio=clamp((p.x-c.width*.08)/(c.width*.58),0,1);if(index===0){designMode.gain=Number((-4+ratio*8).toFixed(2));$('gainSlider').value=String(designMode.gain)}else{designMode.intercept=Number((-8+ratio*16).toFixed(2));$('interceptSlider').value=String(designMode.intercept)}updateGainState()}
function designBoardAction(action,p){if(state.paused)return;if(action==='up'&&designWorld.stage===0)designWorld.gainDrag=null;if(!p)return;if(designWorld.stage===0){const c=$('designCanvas'),x=p.x/c.width,y=p.y/c.height;if(action==='down'&&x>=.08&&x<=.66&&y>=.745&&y<=.815)designWorld.gainDrag=0;else if(action==='down'&&x>=.08&&x<=.66&&y>=.845&&y<=.915)designWorld.gainDrag=1;if((action==='down'||action==='move')&&designWorld.gainDrag!==null)updateWorldGainSlider(p,designWorld.gainDrag);syncDesignBoard();return}if(designWorld.stage===1){const e=fakeEvent(p);if(action==='down')onDesignPointerDown(e);else if(action==='move')onDesignPointerMove(e);else onDesignPointerUp(e);syncDesignBoard();return}if(action==='down')beginLayoutWire(p);else if(action==='move')updateLayoutWire(p);else finishLayoutWire(p);syncDesignBoard()}  
function designDesktopDown(e){if(!designWorld.active||e.button!==0)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.();const action=designDesktopAction();if(action){activateDesignAction(action);return}const p=desktopDesignPoint();if(p){designWorld.dragging=true;designBoardAction('down',p)}}  
function blockDesignWorldActivation(e){if(!designWorld.active)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}  
function designDesktopPointerDown(e){if(designWorld.active)blockDesignWorldActivation(e)}  
function designDesktopUp(e){if(!designWorld.active||!designWorld.dragging)return;e?.preventDefault?.();e?.stopImmediatePropagation?.();designBoardAction('up',desktopDesignPoint());designWorld.dragging=false}  
function designXRStart(c){if(!designWorld.active)return false;const action=designXRAction(c);if(action){activateDesignAction(action);pulseXR(.45,45);return true}const p=xrDesignPoint(c);if(!p)return false;designWorld.xrDragging.add(handKey(c));designBoardAction('down',p);pulseXR(.35,35);return true}  
function designXREnd(c){if(!designWorld.active||!designWorld.xrDragging.has(handKey(c)))return false;designBoardAction('up',xrDesignPoint(c));if(designWorld.stage===0)designWorld.gainDrag=null;designWorld.xrDragging.delete(handKey(c));return true}  
function updateDesignInteraction(){if(!designWorld.active||state.paused)return;const action=renderer.xr.isPresenting?designXRAction(xrController1):designDesktopAction();for(const button of designWorld.actionButtons){const hovered=button===action,selected=button.userData.layer&&designMode.layer===button.userData.action.toUpperCase(),releaseBlocked=button.userData.action==='submit'&&designWorld.stage===2&&!designMode.layoutComplete,color=releaseBlocked?0x713441:hovered?0x67f6a3:selected?button.userData.baseColor:0x142a35;button.material.color.setHex(color);button.material.emissive.setHex(hovered||selected?color:0);button.material.emissiveIntensity=hovered?.35:selected?.24:0;button.scale.setScalar(hovered?1.035:1)}if(designWorld.stage===2){const hovers=[];if(renderer.xr.isPresenting){for(const c of [xrController0,xrController1]){const point=xrDesignPoint(c),node=point&&nearestLayoutNode(point,designMode.layoutDraft?.fromId);if(node)hovers.push({id:node.id})}}else{const point=desktopDesignPoint(),node=point&&nearestLayoutNode(point,designMode.layoutDraft?.fromId);if(node)hovers.push({id:node.id})}designMode.layoutHoverNodes=hovers}if(designWorld.dragging)designBoardAction('move',desktopDesignPoint());for(const c of [xrController0,xrController1])if(designWorld.xrDragging.has(handKey(c)))designBoardAction('move',xrDesignPoint(c));syncDesignBoard()}
function updateDesignLocomotion(dt){  
  if(renderer.xr.isPresenting||!designWorld.active)return;let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),n=Math.hypot(f,r)||1;f/=n;r/=n;const crouch=keys.ShiftLeft||keys.ShiftRight,sprint=(keys.ControlLeft||keys.ControlRight)&&!crouch,speed=crouch?1.2:sprint?5.2:2.75;movePlayerColliderTo(player.position.x+(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed*dt,player.position.z+(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed*dt,playerRoomBounds());player.position.y=lerp(player.position.y,crouch?1.29:2.58,1-Math.exp(-dt*10));player.rotation.y=yaw;camera.rotation.x=pitch  
}  
function updateDesignXRLocomotion(dt,now){  
  if(!designWorld.active)return false;const session=renderer.xr.getSession();if(!session)return true;updateXRVertical(dt);const src=[...session.inputSources],left=src.find(x=>x.handedness==='left'),right=src.find(x=>x.handedness==='right'),lg=left?.gamepad,rg=right?.gamepad;if(lg&&lg.axes.length>=4){let sx=Math.abs(lg.axes[2])>.15?lg.axes[2]:0,sy=Math.abs(lg.axes[3])>.15?lg.axes[3]:0;camera.getWorldDirection(xrHeadDirection);xrHeadDirection.y=0;xrHeadDirection.normalize();const side=new THREE.Vector3().crossVectors(xrHeadDirection,new THREE.Vector3(0,1,0)).normalize(),sp=rg?.buttons?.[1]?.pressed?4.9:2.45;movePlayerColliderTo(player.position.x+(side.x*sx+xrHeadDirection.x*-sy)*sp*dt,player.position.z+(side.z*sx+xrHeadDirection.z*-sy)*sp*dt,playerRoomBounds())}if(rg&&rg.axes.length>=4){const ax=rg.axes[2]||0;if(Math.abs(ax)>.75&&!xrTurnLatch){player.rotation.y-=Math.sign(ax)*Math.PI/6;xrTurnLatch=true}else if(Math.abs(ax)<.3)xrTurnLatch=false}updateXRSpatial(now);return true  
}  
function designWorldCommand(code){  
    if(!designWorld.active)return false;  
    const map={Escape:'exit',KeyR:'reset',KeyX:'clear',KeyZ:'undo',Digit1:'m1',Digit2:'m2',KeyF:'submit'};  
    const action=map[code];if(!action)return false;if(designWorld.stage===1&&['undo','m1','m2'].includes(action))return true;executeWorldAction(action);return true  
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
  if(designWorld.active||designMode.phase==='world')return;  
  if(state.focus?.userData?.kind==='designTerminal'){startDesignMode();return}  
  v6ActivateFocusedDesign()  
};  
const v6UpdateMovement=updateMovement;  
updateMovement=function(dt){if(designWorld.active){updateDesignLocomotion(dt);return}if(designMode.phase!=='idle')return;v6UpdateMovement(dt)};  
const v6RaycastFocus=raycastFocus;  
raycastFocus=function(){  
  if(designWorld.active||designMode.phase==='world'){state.focus=null;state.nearest=null;$('focusTag').textContent='3D DESIGN BOARD — DRAW DIRECTLY';$('actionBtn').disabled=true;$('actionBtn').textContent='USE BOARD OR SHORTCUTS';return}  
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
  addEventListener('keydown',onDesktopKeydown,true);
    renderer.domElement.addEventListener('pointerdown',designDesktopPointerDown,true);  
    renderer.domElement.addEventListener('mousedown',designDesktopDown,true);  
    renderer.domElement.addEventListener('click',blockDesignWorldActivation,true);  
    renderer.domElement.addEventListener('dblclick',blockDesignWorldActivation,true);  
    renderer.domElement.addEventListener('contextmenu',blockDesignWorldActivation,true);  
    addEventListener('mouseup',designDesktopUp,true);  
    addEventListener('keydown',e=>{if(designWorldCommand(e.code)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}},true);  
    document.querySelectorAll('.design-step').forEach((tab,index)=>{tab.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();if(index===0&&designMode.step===0)return;if(index===1||index===2){designMode.step=index;enterDesignWorld(index)}}});  
    $('gainSlider').addEventListener('input',e=>{designMode.gain=Number(e.target.value);updateGainState()});$('interceptSlider').addEventListener('input',e=>{designMode.intercept=Number(e.target.value);updateGainState()});$('regressionSubmit').onclick=submitRegression;$('schematicSubmit').onclick=submitSchematic;$('clearSchematic').onclick=clearSchematicWires;  
  $('designCanvas').addEventListener('pointerdown',onDesignPointerDown);  
  $('designCanvas').addEventListener('pointermove',onDesignPointerMove);  
  $('designCanvas').addEventListener('pointerup',onDesignPointerUp);  
  $('designCanvas').addEventListener('click',onDesignClick);  
  $('designExit').onclick=()=>{if(designWorld.active)leaveDesignWorld(false);closeDesignMode()};$('designReset').onclick=resetDesignStage;  
  $('designBack').onclick=()=>{if(designWorld.active)leaveDesignWorld(false);if(designMode.step>0){designMode.step--;renderDesignStep();if(designMode.step>0)enterDesignWorld(designMode.step)}};  
  $('designNext').onclick=()=>{if(designMode.step===0){designMode.step=1;renderDesignStep();enterDesignWorld(1)}else if(!designWorld.active&&designMode.step>0)enterDesignWorld(designMode.step)};  
  document.querySelectorAll('.layer-btn').forEach(btn=>btn.onclick=()=>setWorldLayer(btn.dataset.layer));  
  $('undoRoute').onclick=()=>executeWorldAction('undo');  
  $('clearRoute').onclick=()=>executeWorldAction('clear');  
  addEventListener('resize',resizeDesignCanvas);  
  addEventListener('keydown',e=>{if(designMode.phase==='active'&&e.code==='Escape'){e.preventDefault();closeDesignMode()}},true)  
};  
const v7XRMove=updateXRMovement;updateXRMovement=function(dt,now){if(updateDesignXRLocomotion(dt,now))return;v7XRMove(dt,now)};const v7XRStart=onXRTriggerStart,v7XREnd=onXRTriggerEnd;onXRTriggerStart=function(c){if(designWorld.active){designXRStart(c);return}const hit=xrInteractiveHit(c);if(hit?.object.userData.kind==='designTerminal'){state.focus=hit.object;activateFocused();pulseXR(.45,45);return}v7XRStart(c)};onXRTriggerEnd=function(c){if(designWorld.active){designXREnd(c);return}v7XREnd(c)};    
  const v7NewRunDesign=newRun;  
newRun=function(){  
  v7NewRunDesign();  
  designMode.step=0;designMode.timingStep=-1;designMode.stageStartedAt=0;designMode.gain=0;designMode.intercept=0;designMode.gainComplete=false;designMode.regression=null;designMode.regressionAttempts=0;designMode.regressionBest=null;designMode.schematicComplete=false;designMode.schematicSubmitted=false;designMode.schematicScore=0;designMode.circuit=null;designMode.layoutComplete=false;  
  designMode.schematicDrag=null;designMode.schematicLinks.clear();designMode.layer='M1';designMode.layoutActive=null;designMode.layoutNodes=[];designMode.layoutRoutes=[];designMode.layoutDraft=null;designMode.layoutHoverNodes=[];designMode.releasedBodies.clear();  
  if($('gainSlider'))$('gainSlider').value='0';if($('interceptSlider'))$('interceptSlider').value='0';  
  document.querySelectorAll('.layer-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.layer==='M1'));  
  if(designWorld.active)leaveDesignWorld(false);if(designMode.phase!=='idle'){designMode.phase='idle';$('designTerminal').className='';document.body.classList.remove('design-editing')}  
};  

// V8.12: projected desktop mouse grip for physical wafer handling.
const desktopGrip={
  controller:new THREE.Group(),anchor:null,visual:null,hand:null,fingers:[],beam:null,hover:null,
  reach:.42,depth:1.05,desiredDepth:1.05,minDepth:.4,maxDepth:8,wheelRemainder:0,suppressClick:false,xrSnapshots:new Map()
};
desktopGrip.controller.userData={handIndex:'mouse',handedness:'Desktop'};
let desktopDoorGrab=null;
const PLAYER_COLLISION_RADIUS=.34;
function ensurePlayerCollisionGeometry(){
  if(!player||player.userData.playerCollider)return;const vertices=[0,.18,0,0,-1.5,0,-.34,-.42,-.34,.34,-.42,-.34,.34,-.42,.34,-.34,-.42,.34],indices=[0,2,3,0,3,4,0,4,5,0,5,2,1,3,2,1,4,3,1,5,4,1,2,5],edges=[[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,3],[3,4],[4,5],[5,2]],edgePositions=[];
  for(const [a,b]of edges)edgePositions.push(...vertices.slice(a*3,a*3+3),...vertices.slice(b*3,b*3+3));const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));mesh.name='player-bipyramid-collider';mesh.visible=false;mesh.userData={shape:'elongated-square-bipyramid',radius:PLAYER_COLLISION_RADIUS};const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(edgePositions,3));const outline=new THREE.LineSegments(lines,new THREE.LineBasicMaterial({transparent:true,opacity:0}));outline.name='player-bipyramid-edges';outline.visible=false;player.add(mesh,outline);player.userData.playerCollider=mesh
}
function playerRoomBounds(){return designWorld.active?{minX:-10.8,maxX:10.8,minZ:157,maxZ:175}:{minX:-8.25,maxX:8.25,minZ:-40.5,maxZ:11.2}}
function movePlayerColliderTo(targetX,targetZ,bounds=playerRoomBounds(),origin=player.position){
  let x=origin.x,z=origin.z;const endX=clamp(targetX,bounds.minX,bounds.maxX),endZ=clamp(targetZ,bounds.minZ,bounds.maxZ),blocked=(px,pz)=>colliders.some(collider=>Math.abs(px-collider.x)<collider.w/2+PLAYER_COLLISION_RADIUS&&Math.abs(pz-collider.z)<collider.d/2+PLAYER_COLLISION_RADIUS),axes=Math.abs(endX-x)>=Math.abs(endZ-z)?['x','z']:['z','x'];
  for(const axis of axes){if(axis==='x'){if(!blocked(endX,z))x=endX}else if(!blocked(x,endZ))z=endZ}player.position.x=x;player.position.z=z
}
function unstuckPlayer(){
  ensurePlayerCollisionGeometry();const designRoom=designWorld.active;player.position.set(0,renderer.xr.isPresenting?phys.baseRigY:(state.crouching?1.29:2.58),designRoom?166:-15);player.rotation.y=yaw;camera.rotation.x=pitch;Object.keys(keys).forEach(key=>keys[key]=false);phys.crouchHeld=false;parallel.sprintHeld=false;desktopDoorGrab=null;drawMap();
}
function ensureDesktopGrip(){
  if(desktopGrip.anchor||!camera)return;
  const anchor=new THREE.Group();anchor.name='desktop-grip-anchor';anchor.position.set(0,0,-desktopGrip.depth);camera.add(anchor);
  desktopGrip.anchor=anchor;desktopGrip.controller.userData.pinchAnchor=anchor;
  const hand=new THREE.Group();hand.name='desktop-hand';anchor.add(hand);desktopGrip.hand=hand;desktopGrip.visual=hand;
  const skin=new THREE.MeshBasicMaterial({color:0xb5a58f,transparent:true,opacity:.5,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}),palmGeometry=new THREE.BufferGeometry();
  palmGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.045,.055,.018,.045,.055,.018,.076,-.085,.018,-.076,-.085,.018,-.045,.055,-.018,.045,.055,-.018,.076,-.085,-.018,-.076,-.085,-.018],3));palmGeometry.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);palmGeometry.computeVertexNormals();
  const palm=new THREE.Mesh(palmGeometry,skin);palm.renderOrder=40;hand.add(palm);
  const boneMaterial=skin.clone(),jointGeometry=new THREE.SphereGeometry(.01,8,6),boneGeometry=new THREE.CylinderGeometry(.62,.9,1,10),digits=[
    {base:[-.061,-.078],lengths:[.045,.036,.027],spread:-.2},
    {base:[-.022,-.084],lengths:[.052,.041,.03],spread:-.07},
    {base:[.022,-.084],lengths:[.049,.039,.028],spread:.07},
    {base:[.061,-.078],lengths:[.041,.033,.024],spread:.2},
    {base:[-.058,-.014],lengths:[.037,.029,.023],thumb:true,spread:0}
  ];
  desktopGrip.fingers=digits.map((digit,index)=>{const group=new THREE.Group();group.name=`desktop-finger-${index+1}`;hand.add(group);return{...digit,group,bones:digit.lengths.map(()=>{const bone=new THREE.Mesh(boneGeometry,boneMaterial);bone.renderOrder=41;group.add(bone);return bone}),joints:Array.from({length:digit.lengths.length+1},()=>{const joint=new THREE.Mesh(jointGeometry,skin);joint.renderOrder=42;group.add(joint);return joint}),curl:0}});
  const beamGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.025,-.12),new THREE.Vector3(0,-.09,-desktopGrip.depth+.05)]);
  desktopGrip.beam=new THREE.Line(beamGeometry,new THREE.LineBasicMaterial({color:C.cyan,transparent:true,opacity:.16,depthTest:false,toneMapped:false}));desktopGrip.beam.renderOrder=39;camera.add(desktopGrip.beam);
  updateDesktopHandPose(0,0,false);
  const style=document.createElement('style');style.textContent='#crosshair.desktop-wafer-ready:before,#crosshair.desktop-wafer-ready:after{background:#67f6a3;box-shadow:0 0 9px #67f6a3}#crosshair.desktop-wafer-held:before,#crosshair.desktop-wafer-held:after{background:#ffcf56;box-shadow:0 0 9px #ffcf56}';document.head.appendChild(style);
  const controls=document.querySelector('.controls');if(controls)controls.innerHTML='<b>MOVE</b> WASD / arrows &nbsp; <b>LOOK</b> mouse<br><b>GRAB WAFER</b> hold left mouse &nbsp; <b>OPERATE</b> click / E<br><b>CROUCH</b> Shift &nbsp; <b>SPRINT</b> Ctrl &nbsp; <b>ADJUST</b> wheel'
}
function desktopGripEnabled(){return state.started&&!renderer.xr.isPresenting&&document.pointerLockElement===renderer.domElement&&designMode.phase==='idle'&&!designWorld.active}
function nearestDesktopWafer(max=desktopGrip.reach){
  if(!desktopGrip.anchor)return null;const p=desktopGrip.anchor.getWorldPosition(new THREE.Vector3());let best=null,d=max;
  for(const body of parallel.wafers){
    if(body.broken||body.heldBy!=null||!body.view.visible)continue;
    if(body.machineIndex!=null){const st=status[body.machineIndex];if(!st||!['done','unloadedDoorOpen'].includes(st.state)||st.doorAmount<=.45)continue}
    const q=body.view.getWorldPosition(new THREE.Vector3()),n=p.distanceTo(q);if(n<=d){d=n;best={body,distance:n,point:q}}
  }
  return best
}
function nearestDesktopDoorHandle(){
  raycaster.setFromCamera({x:0,y:0},camera);const origin=raycaster.ray.origin,direction=raycaster.ray.direction;let best=null,bestDistance=.62;
  status.forEach((st,index)=>{const machine=machines[index+1],handle=machine?.doorHandle;if(!machine||machine.kind!=='fabrication'||!handle)return;const point=handle.getWorldPosition(new THREE.Vector3()),along=point.clone().sub(origin).dot(direction);if(along<0||along>4.5)return;const distance=point.distanceTo(origin.clone().addScaledVector(direction,along));if(distance<bestDistance){bestDistance=distance;best={index,machine,handle}}});
  return best
}
function beginDesktopDoorGrab(){
  if(state.paused||desktopDoorGrab||getHandGrab(desktopGrip.controller))return false;const target=nearestDesktopDoorHandle();if(!target)return false;
  desktopDoorGrab={index:target.index,lastAt:performance.now()};phys.doorVelocities[target.index]=0;return true
}
function endDesktopDoorGrab(){desktopDoorGrab=null}
function moveDesktopDoor(event){
  if(!desktopDoorGrab)return;event.preventDefault();event.stopImmediatePropagation();const now=performance.now(),elapsed=Math.max(.001,(now-desktopDoorGrab.lastAt)/1000),delta=((event.movementX||0)-(event.movementY||0)*.45)*.0025;desktopDoorGrab.lastAt=now;const index=desktopDoorGrab.index;phys.doorVelocities[index]=clamp((phys.doorVelocities[index]||0)+delta/elapsed,-4,4)
}
function colourDesktopGrip(colour,opacity){
  if(!desktopGrip.visual)return;
  if(desktopGrip.beam){desktopGrip.beam.material.color.setHex(colour);desktopGrip.beam.material.opacity=opacity*.36}
}
function updateDesktopHandPose(dt,now,grabbing){
  if(!desktopGrip.hand)return;const moving=Number(!!(keys.KeyW||keys.ArrowUp))+Number(!!(keys.KeyS||keys.ArrowDown))+Number(!!(keys.KeyA||keys.ArrowLeft))+Number(!!(keys.KeyD||keys.ArrowRight)),sway=Math.sin(now*.009)*(.002+moving*.002),targetCurl=grabbing?.72:.08;
  const cameraOrientation=camera.getWorldQuaternion(new THREE.Quaternion()),handOrientation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),player.rotation.y).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));desktopGrip.hand.quaternion.copy(cameraOrientation.invert().multiply(handOrientation));desktopGrip.hand.position.set(0,sway,0);desktopGrip.hand.rotateZ(Math.sin(now*.006)*.018+((keys.KeyA||keys.ArrowLeft)?-.025:0)+((keys.KeyD||keys.ArrowRight)?.025:0));
  for(const finger of desktopGrip.fingers){finger.curl=lerp(finger.curl,targetCurl,1-Math.exp(-12*Math.max(dt,.001)));let point=new THREE.Vector3(finger.base[0],finger.base[1],.008);finger.joints[0].position.copy(point);
    for(let index=0;index<finger.lengths.length;index++){const length=finger.lengths[index],bend=finger.curl*[.08,.42,.82][index],fan=finger.spread;if(finger.thumb){const angle=-2.65+finger.curl*(index+1)*.8;point.add(new THREE.Vector3(Math.cos(angle),Math.sin(angle),0).multiplyScalar(length))}else point.add(new THREE.Vector3(Math.sin(fan)*length,-Math.cos(fan)*Math.cos(bend)*length,Math.sin(bend)*length));const next=point.clone(),bone=finger.bones[index],direction=next.clone().sub(finger.joints[index].position);bone.position.copy(finger.joints[index].position).add(next).multiplyScalar(.5);bone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());const width=index===0?.018:.014;bone.scale.set(width,direction.length(),width);finger.joints[index+1].position.copy(next);point=next}
  }
}
function grabDesktopWafer(){
  if(!desktopGripEnabled()||getHandGrab(desktopGrip.controller))return false;const near=nearestDesktopWafer();if(!near)return false;
  const body=near.body,anchor=desktopGrip.anchor;desktopGrip.desiredDepth=desktopGrip.depth;desktopGrip.wheelRemainder=0;anchor.position.z=-desktopGrip.desiredDepth;const target=anchor.getWorldPosition(new THREE.Vector3());detachPreserve(body.view,scene);body.view.position.copy(target);body.view.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.08,0,0)));body.view.scale.setScalar(1);
  body.dynamic=false;body.staged=false;body.heldBy='mouse';if(phys.stockReady===body.view)phys.stockReady=null;
  if(body.machineIndex!=null&&status[body.machineIndex].state==='done')status[body.machineIndex].state='unloadedDoorOpen';
  const grab={kind:'wafer',controller:desktopGrip.controller,body,last:target.clone(),velocity:new THREE.Vector3()};setHandGrab(desktopGrip.controller,grab);
  syncActiveWafer(body);phys.waferEverPicked=true;if(phys.pickupGuide)phys.pickupGuide.visible=false;scheduleStockReplacement();desktopGrip.suppressClick=true;
  toast(`Desktop grip picked up wafer ${body.lotId}. Release left mouse to let go.`);return true
}
function releaseDesktopWafer(place=true){
  const grab=getHandGrab(desktopGrip.controller);if(grab?.kind!=='wafer')return false;const body=grab.body;
  body.velocity.copy(grab.velocity).clampLength(0,3.2);body.releaseY=body.view.getWorldPosition(new THREE.Vector3()).y;body.dynamic=true;body.heldBy=null;clearHandGrab(desktopGrip.controller);
  desktopGrip.desiredDepth=desktopGrip.depth;desktopGrip.wheelRemainder=0;desktopGrip.anchor.position.z=-desktopGrip.depth;
  state.carrying=carriedWafers().length>0;if(place)tryPlaceWafer(body);return true
}
function desktopWaferPositionBlocked(point){
  if(Math.abs(point.x)>8.8-.36||point.z>11.8-.36||point.z<-41.8+.36)return true;
  return point.y<1.95&&colliders.some(collider=>Math.abs(point.x-collider.x)<collider.w/2+.36&&Math.abs(point.z-collider.z)<collider.d/2+.36)
}
function moveHeldDesktopWafer(grab,dt){
  const view=grab.body.view,previous=view.position.clone(),target=desktopGrip.anchor.getWorldPosition(new THREE.Vector3()),blend=1-Math.exp(-9*Math.max(dt,0)),delta=target.sub(previous).multiplyScalar(blend),steps=Math.max(1,Math.ceil(delta.length()/.05)),position=previous.clone();
  for(let step=1;step<=steps;step++){const candidate=previous.clone().addScaledVector(delta,step/steps);if(desktopWaferPositionBlocked(candidate))break;position.copy(candidate)}
  view.position.copy(position);grab.velocity.copy(position.sub(previous).divideScalar(Math.max(dt,.001)));grab.body.velocity.copy(grab.velocity);grab.last.copy(position)
}
function updateDesktopGrip(dt,now){
  ensureDesktopGrip();const enabled=desktopGripEnabled();desktopGrip.anchor.visible=enabled;desktopGrip.beam.visible=enabled;if(!enabled){desktopGrip.hover=null;return}
  const grab=getHandGrab(desktopGrip.controller);
  if(grab?.kind==='wafer'){moveHeldDesktopWafer(grab,dt);desktopGrip.hover=null;colourDesktopGrip(C.amber,.62)}
  else{desktopGrip.hover=nearestDesktopWafer();colourDesktopGrip(desktopGrip.hover?C.green:C.cyan,desktopGrip.hover?.58:.34)}
  updateDesktopHandPose(dt,now,grab?.kind==='wafer')
}
function adjustDesktopGripDistance(event){
  if(desktopDoorGrab){event.preventDefault();const unit=event.deltaMode===1?3:event.deltaMode===2?1:100,force=clamp(event.deltaY/unit,-3,3);phys.doorVelocities[desktopDoorGrab.index]=clamp((phys.doorVelocities[desktopDoorGrab.index]||0)+force*.55,-4,4);return}
  if(getHandGrab(desktopGrip.controller)?.kind!=='wafer')return;
  event.preventDefault();const unit=event.deltaMode===1?3:event.deltaMode===2?1:100;desktopGrip.wheelRemainder+=event.deltaY/unit;const steps=Math.trunc(desktopGrip.wheelRemainder);if(!steps)return;desktopGrip.wheelRemainder-=steps;desktopGrip.desiredDepth=clamp(desktopGrip.desiredDepth*Math.pow(1.03,steps),desktopGrip.minDepth,desktopGrip.maxDepth);desktopGrip.anchor.position.z=-desktopGrip.desiredDepth
}
function closestPointOnDesktopDoor(machine,point){
  machine.door.updateWorldMatrix(true,false);const a=machine.door.localToWorld(new THREE.Vector3(-.92,0,0)),b=machine.door.localToWorld(new THREE.Vector3(.92,0,0)),dx=b.x-a.x,dz=b.z-a.z,t=clamp(((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return{x:a.x+dx*t,z:a.z+dz*t}
}
function applyDesktopDoorPlayerImpact(dt){
  if(!state.started||state.paused||renderer.xr.isPresenting||document.pointerLockElement!==renderer.domElement)return;let forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),right=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),length=Math.hypot(forward,right);if(!length)return;forward/=length;right/=length;const speed=(state.crouching?1.2:2.75)+(state.sprinting?4.4*state.stamina:0),vx=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,vz=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed,playerPoint={x:player.position.x,z:player.position.z};
  status.forEach((st,index)=>{const machine=machines[index+1];if(!machine||machine.kind!=='fabrication'||!machine.door)return;const nearest=closestPointOnDesktopDoor(machine,playerPoint),dx=nearest.x-playerPoint.x,dz=nearest.z-playerPoint.z,distance=Math.hypot(dx,dz);if(distance>.48||distance<1e-4||(vx*dx+vz*dz)/distance<=0)return;const pivot=machine.door.getWorldPosition(new THREE.Vector3()),handle=machine.door.localToWorld(new THREE.Vector3(.92,0,0)),torque=(handle.x-pivot.x)*vz-(handle.z-pivot.z)*vx;if(Math.abs(torque)<.01)return;phys.doorVelocities[index]=clamp((phys.doorVelocities[index]||0)+Math.sign(torque)*Math.min(1.2,speed*dt*1.35),-4,4)})
}
function resolveDesktopDoorPlayerCollision(previous){
  if(renderer.xr.isPresenting)return;const radius=.39;
  status.forEach((st,index)=>{const machine=machines[index+1];if(!machine||machine.kind!=='fabrication'||!machine.door||player.position.y<1.1)return;const closest=closestPointOnDesktopDoor(machine,player.position),dx=player.position.x-closest.x,dz=player.position.z-closest.z,distance=Math.hypot(dx,dz),clearance=radius+.055;if(distance>=clearance)return;let nx,nz;if(distance<1e-5){nx=player.position.x-previous.x;nz=player.position.z-previous.z;const len=Math.hypot(nx,nz);if(len<1e-5){nx=-(machine.door.getWorldDirection(new THREE.Vector3()).z);nz=machine.door.getWorldDirection(new THREE.Vector3()).x}else{nx/=len;nz/=len}}else{nx=dx/distance;nz=dz/distance}const correction=clearance-distance;player.position.x+=nx*correction;player.position.z+=nz*correction})
}
const v812UpdateMovement=updateMovement;
updateMovement=function(dt){const previous=player.position.clone();applyDesktopDoorPlayerImpact(dt);const intended=colliders.splice(0);try{v812UpdateMovement(dt)}finally{colliders.push(...intended)}const targetX=player.position.x,targetZ=player.position.z;player.position.x=previous.x;player.position.z=previous.z;movePlayerColliderTo(targetX,targetZ,playerRoomBounds(),previous);resolveDesktopDoorPlayerCollision(previous)};
const v812ToggleDoor=toggleDoor;
toggleDoor=function(index){const opening=status[index].doorTarget<=.5;v812ToggleDoor(index);if(!renderer.xr.isPresenting)phys.doorVelocities[index]=opening?3.2:-3.2};
const v812UpdateDoors=updateDoors;
updateDoors=function(dt){
  if(renderer.xr.isPresenting){v812UpdateDoors(dt);return}
  status.forEach((st,index)=>{const machine=machines[index+1];if(!machine||machine.kind!=='fabrication'||!machine.door)return;let velocity=phys.doorVelocities[index]||0;
    st.doorAmount=clamp(st.doorAmount+velocity*dt,0,1.5);velocity*=Math.exp(-dt*(desktopDoorGrab?.index===index?1.9:2.8));if(st.doorAmount===0&&velocity<0||st.doorAmount===1.5&&velocity>0)velocity=0;
    phys.doorVelocities[index]=velocity;machine.door.rotation.y=-st.doorAmount*Math.PI/2;if(st.doorAmount===0){if(st.state==='loadedDoorOpen')st.state='loaded';else if(st.state==='unloadedDoorOpen')completeStage(index)}
  })
};
const v811PhysicalSystem=updatePhysicalSystem;
updatePhysicalSystem=function(dt,now){
  if(renderer.xr.isPresenting){v811PhysicalSystem(dt,now);return}
  exposeCompletedWafer();updateStockSupply(now);updateDesktopGrip(dt,now);updateWaferPhysics(dt);updateShards(dt)
};
function captureDesktopGripXRState(){
  desktopGrip.xrSnapshots.clear();
  for(const body of parallel.wafers)desktopGrip.xrSnapshots.set(body.id,{position:body.view.getWorldPosition(new THREE.Vector3()),quaternion:body.view.getWorldQuaternion(new THREE.Quaternion()),visible:body.view.visible})
}
const v811LoopDesktopGrip=loop;
loop=function(now){v811LoopDesktopGrip(now);if(renderer.xr.isPresenting)captureDesktopGripXRState()};
const v811RaycastFocus=raycastFocus;
raycastFocus=function(){
  v811RaycastFocus();if(!state.started||renderer.xr.isPresenting||designMode.phase!=='idle'||designWorld.active)return;
  ensureDesktopGrip();const grab=getHandGrab(desktopGrip.controller),near=grab?.kind==='wafer'?null:nearestDesktopWafer(),crosshair=$('crosshair'),tag=$('focusTag');
  crosshair.classList.toggle('desktop-wafer-ready',!!near&&!grab);crosshair.classList.toggle('desktop-wafer-held',grab?.kind==='wafer');
  if(grab?.kind==='wafer'){tag.style.opacity='1';tag.style.borderColor='#ffcf56';tag.textContent=`${grab.body.lotId} — RELEASE LEFT MOUSE TO DROP`;$('prompt').textContent='Projected grip holding wafer · release left mouse to place or drop'}
  else if(near){tag.style.opacity='1';tag.style.borderColor='#67f6a3';tag.textContent=`${near.body.lotId} — HOLD LEFT MOUSE TO GRAB`;$('prompt').textContent='Wafer within projected grip range · hold left mouse to pick up'}
};
const v811BindDesktopGrip=bind;
bind=function(){
  v811BindDesktopGrip();ensureDesktopGrip();ensurePlayerCollisionGeometry();$('pauseUnstuck').onclick=unstuckPlayer;
  renderer.domElement.addEventListener('click',e=>{if(desktopGrip.suppressClick){e.preventDefault();e.stopImmediatePropagation();desktopGrip.suppressClick=false}},true);
  renderer.domElement.addEventListener('mousedown',e=>{if(e.button!==0||!desktopGripEnabled())return;if(beginDesktopDoorGrab()){desktopGrip.suppressClick=true;e.preventDefault();e.stopPropagation();return}if(grabDesktopWafer()){e.preventDefault();e.stopPropagation()}},true);
  document.addEventListener('mousemove',moveDesktopDoor,true);
  addEventListener('wheel',adjustDesktopGripDistance,{passive:false,capture:true});
  addEventListener('mouseup',e=>{if(e.button!==0)return;if(desktopDoorGrab){endDesktopDoorGrab();desktopGrip.suppressClick=true}if(getHandGrab(desktopGrip.controller)?.kind==='wafer'){releaseDesktopWafer(true);desktopGrip.suppressClick=true}},true);
  addEventListener('blur',()=>{endDesktopDoorGrab();releaseDesktopWafer(true)});
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==renderer.domElement){endDesktopDoorGrab();releaseDesktopWafer(true)}});
  renderer.xr.addEventListener('sessionstart',()=>{endDesktopDoorGrab();releaseDesktopWafer(true);desktopGrip.anchor.visible=false;desktopGrip.beam.visible=false});
  renderer.xr.addEventListener('sessionend',()=>{
    const released=[];
    for(const [key,grab] of [...parallel.grabs]){
      if(key==='mouse')continue;
      if(grab.kind==='wafer'){grab.body.heldBy=null;grab.body.dynamic=true;grab.body.velocity.copy(grab.velocity);released.push(grab.body)}
      else if(grab.kind==='shard'){detachPreserve(grab.shard.mesh,scene);grab.shard.v.copy(grab.velocity)}
      parallel.grabs.delete(key);if(phys.grab===grab)phys.grab=null
    }
    queueMicrotask(()=>{
      for(const body of parallel.wafers){const snap=desktopGrip.xrSnapshots.get(body.id);if(!snap)continue;const view=body.view;view.parent?.remove(view);scene.add(view);view.position.copy(snap.position);view.quaternion.copy(snap.quaternion);view.scale.setScalar(1);view.visible=snap.visible;if(released.includes(body)){body.releaseY=snap.position.y;tryPlaceWafer(body)}}
      state.carrying=carriedWafers().length>0;desktopGrip.xrSnapshots.clear()
    })
  })
};
const v811NewRunDesktopGrip=newRun;
newRun=function(){releaseDesktopWafer(false);v811NewRunDesktopGrip();desktopGrip.hover=null;desktopGrip.suppressClick=false};


// V8.13: controller-ray selection for the design workstation display.
function xrScreenTarget(controller){
  if(!controller)return null;
  const rotation=new THREE.Matrix4().extractRotation(controller.matrixWorld);
  const origin=new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
  const direction=new THREE.Vector3(0,0,-1).applyMatrix4(rotation).normalize();
  raycaster.set(origin,direction);
  for(const hit of raycaster.intersectObjects(interactives,false)){
    if(hit.distance>3.4)break;
    if(hit.object.userData?.kind==='designTerminal')return hit.object;
  }
  return null;
}
const v812TriggerStart=onXRTriggerStart;
onXRTriggerStart=function(controller){
  if(!state.paused&&!designWorld.active){
    const screen=xrScreenTarget(controller);
    if(screen){
      state.focus=screen;
      pulseXR(.35,35);
      activateFocused();
      return;
    }
  }
  v812TriggerStart(controller);
};
const v812SetXRFocus=setXRFocus;
setXRFocus=function(controller=xrController1){
  v812SetXRFocus();
  if(!renderer.xr.isPresenting||!controller||designWorld.active)return;
  const screen=xrScreenTarget(controller);
  if(screen){
    state.focus=screen;
    if(xrTargetRing){
      const point=screen.getWorldPosition(new THREE.Vector3());
      xrTargetRing.visible=true;
      xrTargetRing.position.copy(point);
      xrTargetRing.quaternion.copy(controller.quaternion);
    }
  }
};
// V8.13.1: either Quest controller can select the design computer at close range.
const XR_DESIGN_SCREEN_RANGE=XR_POINTER_REACH;
function xrDesignScreenHit(controller){
  if(!controller)return null;
  const rotation=new THREE.Matrix4().extractRotation(controller.matrixWorld);
  const origin=new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
  const direction=new THREE.Vector3(0,0,-1).applyMatrix4(rotation).normalize();
  raycaster.set(origin,direction);
  for(const hit of raycaster.intersectObjects(interactives,false)){
    if(hit.distance>XR_DESIGN_SCREEN_RANGE)break;
    if(hit.object.userData?.kind==='designTerminal')return hit;
  }
  return null;
}
function xrScreenTarget(controller){return xrDesignScreenHit(controller)?.object||null}
const v813TriggerStart=onXRTriggerStart;
onXRTriggerStart=function(controller){
  if(!state.paused&&!designWorld.active){
    const hit=xrDesignScreenHit(controller);
    if(hit){state.focus=hit.object;pulseXR(.35,35);activateFocused();return}
  }
  v813TriggerStart(controller);
};

// V8.13.2: fixed release metadata on the startup panel and service-worker activation.
(function(){
  const VERSION='V8.13.2', UPDATED='24 OCT 2026';
  function showRelease(){
    const host=document.querySelector('#intro .cardInner');
    if(!host||document.getElementById('releaseIndicator'))return;
    const tag=document.createElement('div');
    tag.id='releaseIndicator';tag.className='release-indicator';tag.setAttribute('aria-label','Latest code update');
    tag.innerHTML='<span>CODE UPDATED</span><strong>'+VERSION+'</strong><time datetime="2026-10-24">'+UPDATED+'</time>';
    host.insertBefore(tag,host.firstChild);
  }
  showRelease();
  if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(function(){});});
})();

const v814XRMovement=updateXRMovement;
updateXRMovement=function(dt,now){if(state.paused){drawXRPauseOverlay();return}v814XRMovement(dt,now)};
const v814XRButtons=updateXRButtons;
updateXRButtons=function(now){
  if(!renderer.xr.isPresenting)return;
  const session=renderer.xr.getSession(),sources=session?[...session.inputSources]:[];
  xrLeftSource=sources.find(source=>source.handedness==='left')||xrLeftSource;
  xrRightSource=sources.find(source=>source.handedness==='right')||xrRightSource;
  if(state.paused){
    const left=xrLeftSource?.gamepad,right=xrRightSource?.gamepad;
    if(left){edgeButton('ls',!!left.buttons[3]?.pressed,unstuckPlayer);edgeButton('lx',!!left.buttons[4]?.pressed,()=>{xrPausePage=xrPausePage==='more'?'pause':'more';drawXRPauseOverlay()});edgeButton('ly',!!left.buttons[5]?.pressed,()=>{if(xrPausePage==='more'){toggleDeveloperPanel();drawXRPauseOverlay()}})}
    if(right){const resume=()=>{setXRPaused(false);pulseXR(.4,45)};edgeButton('rs',!!right.buttons[3]?.pressed,resume);edgeButton('ra',!!right.buttons[4]?.pressed,()=>xrPausePage==='more'?adjustGuiTextSize(-1):resume());edgeButton('rb',!!right.buttons[5]?.pressed,()=>xrPausePage==='more'?adjustGuiTextSize(1):resume())}
    drawXRPauseOverlay();return
  }
  const wasPaused=state.paused;v814XRButtons(now);
  if(!wasPaused&&state.paused){xrPausePage='pause';freezeXRWorldForPause()}
  if(state.paused)drawXRPauseOverlay()
};
const v814Loop=loop;
loop=function(now){
  updateDeveloperMetrics(now);
  if(renderer.xr.isPresenting&&state.paused){updateXRButtons(now);if(state.paused)drawXRPauseOverlay();renderer.render(scene,camera);return}
  v814Loop(now)
};
const v814XRTriggerStart=onXRTriggerStart,v814XRTriggerEnd=onXRTriggerEnd,v814XRSqueezeStart=onXRSqueezeStart,v814XRSqueezeEnd=onXRSqueezeEnd;
onXRTriggerStart=function(controller){if(state.paused)return;v814XRTriggerStart(controller)};
onXRTriggerEnd=function(controller){if(state.paused){designWorld.xrDragging.delete(handKey(controller));return}v814XRTriggerEnd(controller)};
onXRSqueezeStart=function(controller){if(state.paused)return;v814XRSqueezeStart(controller)};
onXRSqueezeEnd=function(controller){if(state.paused)return;v814XRSqueezeEnd(controller)};
const v812DrawXRPauseOverlay=drawXRPauseOverlay;
drawXRPauseOverlay=function(){v812DrawXRPauseOverlay();if(xrPausePage==='more'||!xrOverlayCtx||!xrOverlayTexture)return;const ctx=xrOverlayCtx;ctx.fillStyle='rgba(3,12,20,.98)';ctx.fillRect(240,538,544,30);ctx.textAlign='center';ctx.fillStyle='#b8cbd3';ctx.font='14px monospace';ctx.fillText('LEFT STICK CLICK: UNSTUCK',512,558);xrOverlayTexture.needsUpdate=true};



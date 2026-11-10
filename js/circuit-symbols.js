(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CircuitSymbols=api
})(globalThis,function(){
  function drawMos(ctx,device,width,height,background='#f4f5f1',gateInput=null){
    const [id,type,normalizedX,normalizedY]=device;
    const centerX=normalizedX*width,centerY=normalizedY*height;
    const color=type==='p'?'#a332e8':'#e66b00';
    const gateInputX=gateInput?.x??gateInput?.px??centerX-82,gateY=gateInput?.y??gateInput?.py??centerY;
    const gateDirection=gateInputX<=centerX?-1:1;
    const terminalOffset=height*.11,channelHalfHeight=30,channelX=centerX+gateDirection*20,gateX=centerX+gateDirection*40,gateHalfHeight=18;
    ctx.strokeStyle=color;
    ctx.lineWidth=8;
    ctx.beginPath();
    ctx.moveTo(centerX,centerY-terminalOffset);
    ctx.lineTo(centerX,centerY-channelHalfHeight);
    ctx.lineTo(channelX,centerY-channelHalfHeight);
    ctx.lineTo(channelX,centerY+channelHalfHeight);
    ctx.lineTo(centerX,centerY+channelHalfHeight);
    ctx.lineTo(centerX,centerY+terminalOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gateInputX,gateY);
    ctx.lineTo(gateX,gateY);
    ctx.moveTo(gateX,gateY-gateHalfHeight);
    ctx.lineTo(gateX,gateY+gateHalfHeight);
    ctx.stroke();
    if(type==='p'){
      const bubbleRadius=6;
      ctx.beginPath();
      ctx.arc(gateX+gateDirection*bubbleRadius,gateY,bubbleRadius,0,Math.PI*2);
      ctx.fillStyle=background;
      ctx.fill();
      ctx.strokeStyle=color;
      ctx.stroke()
    }
    ctx.fillStyle=color;
    ctx.font='700 14px monospace';
    ctx.textAlign=gateDirection<0?'left':'right';
    ctx.fillText(`${id} ${type==='p'?'PMOS':'NMOS'}`,centerX-gateDirection*28,centerY);
    ctx.textAlign='left'
  }
  function drawPowerTerminals(ctx,terminals,width,height){
    const edgePadding=height*.05,capY=edgePadding,capHalfWidth=30,groundTipY=height-edgePadding,groundHeight=30,groundBaseY=groundTipY-groundHeight,groundHalfWidth=30;
    ctx.strokeStyle='#111111';ctx.lineWidth=8;ctx.font='700 18px monospace';ctx.textAlign='left';
    for(const terminal of terminals){
      const {id,px,py}=terminal;
      if(id==='VDD'){
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,capY);ctx.stroke();
        ctx.beginPath();ctx.moveTo(px-capHalfWidth,capY);ctx.lineTo(px+capHalfWidth,capY);ctx.stroke();
        ctx.fillStyle='#17232a';ctx.fillText('VDD',Math.min(px+capHalfWidth+8,width-52),capY+24)
      }else if(id==='GND'){
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,groundBaseY);ctx.stroke();
        ctx.beginPath();ctx.moveTo(px-groundHalfWidth,groundBaseY);ctx.lineTo(px+groundHalfWidth,groundBaseY);ctx.lineTo(px,groundTipY);ctx.closePath();ctx.fillStyle='#000000';ctx.fill();
        ctx.fillStyle='#17232a';ctx.fillText('GND',Math.min(px+groundHalfWidth+8,width-52),groundTipY-5)
      }
    }
    ctx.textAlign='left'
  }
  return{drawMos,drawPowerTerminals}
});

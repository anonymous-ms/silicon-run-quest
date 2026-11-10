(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CircuitSymbols=api
})(globalThis,function(){
  function drawMos(ctx,device,width,height,background='#f4f5f1'){
    const [id,type,normalizedX,normalizedY]=device;
    const centerX=normalizedX*width,centerY=normalizedY*height;
    const color=type==='p'?'#f59ac3':'#f2ad72';
    const terminalOffset=height*.11,channelHalfHeight=30,channelX=centerX-20,gateX=centerX-40,gateHalfHeight=18;
    ctx.strokeStyle=color;
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.moveTo(centerX,centerY-terminalOffset);
    ctx.lineTo(centerX,centerY-channelHalfHeight);
    ctx.lineTo(channelX,centerY-channelHalfHeight);
    ctx.lineTo(channelX,centerY+channelHalfHeight);
    ctx.lineTo(centerX,centerY+channelHalfHeight);
    ctx.lineTo(centerX,centerY+terminalOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX-82,centerY);
    ctx.lineTo(gateX,centerY);
    ctx.moveTo(gateX,centerY-gateHalfHeight);
    ctx.lineTo(gateX,centerY+gateHalfHeight);
    ctx.stroke();
    if(type==='p'){
      const bubbleRadius=6;
      ctx.beginPath();
      ctx.arc(gateX-bubbleRadius,centerY,bubbleRadius,0,Math.PI*2);
      ctx.fillStyle=background;
      ctx.fill();
      ctx.strokeStyle=color;
      ctx.stroke()
    }
    ctx.fillStyle=color;
    ctx.font='700 14px monospace';
    ctx.fillText(`${id} ${type==='p'?'PMOS':'NMOS'}`,centerX+28,centerY)
  }
  return{drawMos}
});

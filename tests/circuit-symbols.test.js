const assert=require('node:assert/strict');
const test=require('node:test');
const {drawMos,drawPowerTerminals}=require('../js/circuit-symbols.js');

function createContext(){
  const paths=[];
  const fills=[];
  const strokes=[];
  const texts=[];
  let currentPath=[];
  let fillStyle;
  let strokeStyle;
  let lineWidth;
  let textAlign='left';
  return{
    paths,
    fills,
    strokes,
    texts,
    beginPath(){currentPath=[];paths.push(currentPath)},
    moveTo(x,y){currentPath.push(['M',x,y])},
    lineTo(x,y){currentPath.push(['L',x,y])},
    closePath(){currentPath.push(['Z'])},
    arc(x,y,radius,start,end){currentPath.push(['A',x,y,radius,start,end])},
    stroke(){strokes.push({path:currentPath.slice(),style:strokeStyle,lineWidth})},
    fill(){fills.push({path:currentPath.slice(),style:fillStyle})},
    fillText(text,x,y){texts.push({text,x,y,align:textAlign})},
    set strokeStyle(value){strokeStyle=value},
    set fillStyle(value){fillStyle=value},
    get fillStyle(){return fillStyle},
    set textAlign(value){textAlign=value},
    get textAlign(){return textAlign},
    set lineWidth(value){lineWidth=value},
    set font(value){}
  }
}

test('MOS source-drain path has four corners and lands on its terminals',()=>{
  const context=createContext();
  drawMos(context,['N1','n',.34,.32],1000,800,'#f4f5f1',{px:250,py:256});
  assert.deepEqual(context.paths[0],[
    ['M',340,168],['L',340,226],['L',320,226],
    ['L',320,286],['L',340,286],['L',340,344]
  ]);
});

test('NMOS gate lead extends from its terminal to the perpendicular gate bar',()=>{
  const context=createContext();
  drawMos(context,['N1','n',.34,.32],1000,800,'#f4f5f1',{px:250,py:256});
  assert.deepEqual(context.paths[1],[
    ['M',250,256],['L',300,256],['M',300,238],['L',300,274]
  ]);
  assert(context.strokes.every(stroke=>stroke.style==='#e66b00'&&stroke.lineWidth===8));
});

test('PMOS gate is insulated and has a background-filled bubble',()=>{
  const context=createContext();
  drawMos(context,['P1','p',.34,.32],1000,800,'#f4f5f1',{x:250,y:256});
  assert.deepEqual(context.paths[1],[
    ['M',250,256],['L',300,256],['M',300,238],['L',300,274]
  ]);
  assert.deepEqual(context.paths[2],[['A',294,256,6,0,Math.PI*2]]);
  assert.deepEqual(context.fills,[{path:context.paths[2],style:'#f4f5f1'}]);
  assert(context.strokes.every(stroke=>stroke.style==='#a332e8'&&stroke.lineWidth===8));
});

test('right-side gate terminal connects to a right-facing gate bar',()=>{
  const context=createContext();
  drawMos(context,['M2','n',.64,.57],1000,800,'#f4f5f1',{px:730,py:456});
  assert.deepEqual(context.paths[1],[
    ['M',730,456],['L',680,456],['M',680,438],['L',680,474]
  ]);
});

test('right-facing transistor mirrors every symbol element and its label',()=>{
  const left=createContext(),right=createContext();
  drawMos(left,['P1','p',.34,.32],1000,800,'#f4f5f1',{x:250,y:256});
  drawMos(right,['P2','p',.34,.32],1000,800,'#f4f5f1',{x:430,y:256});
  const mirroredPaths=left.paths.map(path=>path.map(([kind,...values])=>{
    if(kind==='A')return[kind,680-values[0],...values.slice(1)];
    return[kind,680-values[0],...values.slice(1)]
  }));
  assert.deepEqual(right.paths,mirroredPaths);
  assert.equal(left.texts[0].x,368);
  assert.equal(left.texts[0].align,'left');
  assert.equal(right.texts[0].x,312);
  assert.equal(right.texts[0].align,'right');
});

test('each supply terminal gets an edge-reaching line, enlarged symbol, and label',()=>{
  const context=createContext();
  drawPowerTerminals(context,[{id:'VDD',px:100,py:100},{id:'GND',px:200,py:700}],1000,800);
  assert.deepEqual(context.paths[0],[['M',100,100],['L',100,40]]);
  assert.deepEqual(context.paths[1],[['M',70,40],['L',130,40]]);
  assert.deepEqual(context.paths[2],[['M',200,700],['L',200,730]]);
  assert.deepEqual(context.paths[3],[['M',170,730],['L',230,730],['L',200,760],['Z']]);
  assert.deepEqual(context.fills,[{path:context.paths[3],style:'#000000'}]);
  assert(context.strokes.every(stroke=>stroke.style==='#111111'&&stroke.lineWidth===8));
  assert.deepEqual(context.texts,[{text:'VDD',x:138,y:64,align:'left'},{text:'GND',x:238,y:755,align:'left'}]);
});

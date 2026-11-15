// Stage 12: ascending stairs must match their visible geometry on both qualities.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../src');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const N=40,c=Math.floor(N/2);
const cells=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>
  x===0||z===0||x===N-1||z===N-1?1:0));
const context={console,Math,Number,Array,Map,Set,Int8Array,Int16Array,Float32Array,
 mapSize:N,mapCells:cells,sectorStyle:0,mapRooms:[],mapFeatures:[],glReady:true,
 touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 buildFloorDecal:()=>{},TAU:Math.PI*2,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
 hypot:Math.hypot,save:{settings:{quality:2,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},spawnX:c+.5,spawnZ:c+.5,portal:{x:c+.5,z:c+.5},
 themes:Array.from({length:18},()=>({wall:[.2,.2,.2],floor:[.1,.1,.1],accent:[.7,.3,.2]})),
 game:{p:null,t:0}};
vm.createContext(context);
vm.runInContext(read('03-height-and-collision.js')+read('04a-static-world-solids.js')+
 read('05-world-mesh.js'),context);
const evalIn=s=>vm.runInContext(s,context);
let checks=0;
function check(cnd,msg){assert.ok(cnd,msg);checks++;}
function initialize(style,quality){
 context.sectorStyle=style;context.save.settings.quality=quality;
 context.makeStairHeights(4);context.createWorldMesh(4);
}
function player(x,z){
 const p={x,z,feetY:context.floorHeight(x,z),grounded:true,vy:0};
 context.game.p=p;return p;
}
function walk(p,speed,frames){
 for(let i=0;i<frames;i++){
  context.moveEntity(p,speed,0,.23);
  context.updateVertical(p,1/60);
 }
}
for(const quality of [0,2]){
 initialize(0,quality);
 const normal=player(c+7.5,c+.5);
 walk(normal,-.06,105);
 check(normal.x<c+1.5,`normal stairs snagged quality=${quality} at x=${normal.x} feet=${normal.feetY}`);
 check(normal.feetY>.82,`normal stair summit was not reached quality=${quality}`);
 initialize(15,quality);
 const overpass=player(c-14.5,c+.5);
 walk(overpass,.06,240);
 check(overpass.x>c-2.8,`overpass ascent snagged quality=${quality} at x=${overpass.x} feet=${overpass.feetY}`);
 check(overpass.feetY>2.18,`overpass summit was not reached quality=${quality}`);
 // Walking off-centre must not require pixel-perfect alignment with a stair.
 for(const offset of [-2.2,-1.7,-.4,.4,1.7,2.2]){
  initialize(0,quality);
  const side=player(c+7.5,c+offset);
  walk(side,-.06,105);
  check(side.x<c+1.5,`off-centre normal ascent stuck at z=${side.z} quality=${quality}`);
  check(side.feetY>.60,`off-centre stair did not rise at z=${side.z}`);
 }
 for(const offset of [-1.7,-.4,.4,1.7]){
  initialize(15,quality);
  const side=player(c-14.5,c+offset);
  walk(side,.06,240);
  check(side.x>c-2.8,`off-centre bridge ascent stuck at z=${side.z} quality=${quality}`);
  check(side.feetY>2.18,`off-centre bridge did not reach upper deck`);
 }
}
// A single long frame must not get blocked after climbing the first riser.
initialize(0,2);
const lowFps=player(c+6.45,c+.5);
context.moveEntity(lowFps,-2.6,0,.23);
context.updateVertical(lowFps,.05);
check(lowFps.x<c+3.95,`long step stuck on intermediate tread at x=${lowFps.x}`);
check(lowFps.feetY>.45,`long step lost elevation at y=${lowFps.feetY}`);
// Two perpendicular risers can be crossed sequentially inside the same
// diagonal microstep; the second axis must see the just-updated foot height.
initialize(0,0);
vm.runInContext(`heightCells.fill(0);
 heightCells[10*mapSize+11]=.215; heightCells[11*mapSize+11]=.43;`,context);
const corner=player(10.97,10.97);
context.moveEntity(corner,.08,.08,.23);
context.updateVertical(corner,.016);
check(corner.x>11&&corner.z>11,`diagonal step corner snagged ${corner.x},${corner.z}`);
check(Math.abs(corner.feetY-.43)<.0001,'diagonal stair corner did not climb both risers');
// A normal 0.215 m descent is supported; a full drop must become airborne.
const down=player(c+1.5,c+.5);down.feetY=context.floorHeight(down.x,down.z);
context.moveEntity(down,4.55,0,.23);context.updateVertical(down,.016);
check(down.grounded===true,`normal descending stairs unexpectedly became a fall`);
check(down.feetY===0,`descent did not settle down to flat ground x=${down.x} y=${down.feetY}`);
const cliff=player(10.5,12.5);cliff.feetY=.86;
vm.runInContext(`heightCells[12*mapSize+10]=.86;`,context);
context.moveEntity(cliff,1.1,0,.23);context.updateVertical(cliff,.016);
check(!cliff.grounded,`a high ledge was silently stepped down`);
check(cliff.feetY>.7,`a high ledge caused an instantaneous downward teleport`);
// Step assistance must never allow walking through a full-height obstruction.
initialize(0,2);
context.registerWorldSolid(c+5.3,.05,c+.1,c+5.45,2.4,c+.9,'structure');
const barred=player(c+6.6,c+.5);
walk(barred,-.06,65);
check(barred.x>c+5.45+.22,`operator penetrated a real post at x=${barred.x}`);
console.log(`STAGE12 STAIRS: ${checks} real-mesh + frame-coherence checks passed`);

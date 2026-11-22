'use strict';
// Reproduces the Stage105 visible cavity beneath a physically SOLID height
// field. Production WebGL risers must reach the steel foundation, and Canvas
// columns must project the same full-height face at the DDA boundary.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const faces=[];
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,Map,Set,
 touchOnly:false,sectorStyle:0,worldMapBoss:false,isBalconySector:()=>false,mapSize:12,mapCells:Array.from({length:12},()=>Array(12).fill(0)),glReady:false,
 TAU:2*Math.PI,quad:(v,a,b,d,e,n,color)=>faces.push({corners:[a,b,d,e],n,color}),
 themes:[],clamp:(a,min,max)=>Math.max(min,Math.min(max,a)),hypot:Math.hypot};
vm.createContext(c);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js','05-world-mesh.js','11-fallback-render.js','14-combat-raycast.js'])vm.runInContext(src(f),c,{filename:f});
let checks=0;
const test=(v,s)=>{assert.ok(v,s);checks++};
const ev=s=>vm.runInContext(s,c);
// A 1.32m solid stair column borders a 0.66m tread on its NORTH side.
// The older renderer drew only the 0.66..1.32 strip, leaving the lower
// solid steel 0..0.66 with no visible side from close/oblique views.
ev('drawSolidStairRisers([],4,5,1.32,.66,1.32,1.32,1.32,[.3,.4,.5])');
test(faces.length===1,'exactly one exposed north face for this stair');
test(faces[0].corners.every(p=>p[2]===5),'solid north face has correct Z boundary');
test(Math.min(...faces[0].corners.map(p=>p[1]))===0,'solid north face must reach foundation');
test(Math.max(...faces[0].corners.map(p=>p[1]))===1.32,'solid north face must meet top tread');
test(faces[0].corners.every(p=>p[0]>=4&&p[0]<=5),'wall does not extend outside the real terrain tile');
test(faces[0].n[2]===-1,'north face normal is outward');
faces.length=0;
ev('drawSolidStairRisers([],4,5,1.32,0,0,.66,0,[.3,.4,.5])');
test(faces.length===4,'every exposed side of a four-way raised tile is sealed');
for(const side of faces){
 test(Math.min(...side.corners.map(p=>p[1]))===0,'all four sides reach physical foundation');
 test(Math.max(...side.corners.map(p=>p[1]))===1.32,'all four sides reach same physical top');
}
faces.length=0;
ev('drawSolidStairRisers([],4,5,1.32,1.32,1.32,1.32,1.32,[.3,.4,.5])');
test(faces.length===0,'equal adjacent solid steps have no artificial internal face');
ev('drawSolidStairRisers([],4,5,0,0,0,0,0,[.3,.4,.5])');
test(faces.length===0,'ordinary level ground creates no fake vertical wall');
// Fallback projection: the same physical face is shown at the correct
// distance, and is MUCH larger when the observer stands flush to the step.
const near=ev('fallbackSolidRiserSpan(1.32,.25,1.47,300,320)');
const far=ev('fallbackSolidRiserSpan(1.32,2.0,1.47,300,320)');
test(near.top>far.top,'nearby riser top projects lower on screen (correct perspective)');
test(near.bottom-near.top>far.bottom-far.top,'nearby riser fills larger portion of screen');
test(near.bottom>near.top,'opaque wall has positive projected extent');
// The physics collision oracle is an entire height-map column from -100 to top.
ev('heightCells=new Float32Array(144);heightCells[5*12+4]=1.32;');
const hit=ev('rayWall({x:4.5,y:.45,z:4.5},{x:0,y:0,z:1},2)');
test(hit&&hit.kind==='stairs'&&Math.abs(hit.t-.5)<1e-6,'real raycast blocks space below solid step');
test(ev('!collide(4.5,4.5,.22)'), 'adjacent open tile remains physically accessible');
console.log(`Stage106 opaque solid stair faces: ${checks} PASS`);

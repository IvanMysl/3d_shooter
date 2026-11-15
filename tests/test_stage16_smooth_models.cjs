'use strict';
// Stage 16: executable geometry-quality checks without browser/GPU dependency.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
const allocated=[];
const gl={ARRAY_BUFFER:34962,STATIC_DRAW:35044,createBuffer:()=>({}),bindBuffer:()=>{},
 bufferData:(_target,data)=>{allocated[allocated.length-1]=data;},uniform1f:()=>{}};
const ctx={Math,Number,Array,Float32Array,Uint16Array,Map,Set,gl,TAU:Math.PI*2,
 hypot:Math.hypot,glReady:false,save:{settings:{quality:2}},touchOnly:false,
 enemies:{},clamp:(x,a,b)=>Math.max(a,Math.min(b,x))};
vm.createContext(ctx);
// Runtime toMesh is used unchanged. Keep every vertex buffer so bounds and
// winding can be checked from the exact interleaved GPU representation.
const originalCreate=gl.createBuffer;
gl.createBuffer=()=>{const b=originalCreate();allocated.push(null);return b;};
const gsrc=src('02-geometry.js');
vm.runInContext(gsrc.slice(0,gsrc.indexOf('const ID=')),ctx);
vm.runInContext(src('07-robot-foundry-core.js'),ctx);
vm.runInContext(src('08-robot-foundry-rigs.js'),ctx);
vm.runInContext(src('09-robot-foundry-artifacts.js'),ctx);
const get=expr=>vm.runInContext(expr,ctx);
const meshData=mesh=>{assert(mesh&&mesh.b&&Number.isInteger(mesh.n));
 // The latest toMesh() call owns the latest buffer; also store the typed array
 // on the fake GPU buffer object below for stable indexing.
 return mesh.b.data;};
// Associate uploaded data with its bound fake GPU buffer, like real WebGL.
let active=null;
gl.bindBuffer=(_target,b)=>{active=b;};
gl.bufferData=(_target,data)=>{active.data=data;};

function meshCheck(mesh,name,bounds){
 const a=meshData(mesh);
 check(a instanceof Float32Array&&a.length===mesh.n*10,`${name}: wrong layout`);
 check(mesh.n>0&&mesh.n%3===0,`${name}: not triangulated`);
 const centroid=[0,0,0];
 for(let k=0;k<a.length;k+=10){
  for(let j=0;j<10;j++)check(Number.isFinite(a[k+j]),`${name}: non-finite vertex`);
  const n=Math.hypot(a[k+3],a[k+4],a[k+5]);
  check(Math.abs(n-1)<.015,`${name}: invalid normal ${n}`);
  for(let j=0;j<3;j++){
   centroid[j]+=a[k+j];
   if(bounds)check(a[k+j]>=bounds[j][0]-.001&&a[k+j]<=bounds[j][1]+.001,
    `${name}: outside ${j}-bounds ${a[k+j]}`);
  }
 }
 return a;
}
function windingQuality(a){
 let good=0,bad=0,flat=0;
 for(let k=0;k<a.length;k+=30){
  const A=[a[k],a[k+1],a[k+2]],B=[a[k+10],a[k+11],a[k+12]],C=[a[k+20],a[k+21],a[k+22]];
  const u=B.map((v,i)=>v-A[i]),v=C.map((w,i)=>w-A[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const length=Math.hypot(...n);if(length<1e-7){flat++;continue;}
  const dot=n.reduce((z,x,i)=>z+x*a[k+3+i],0);
  if(dot>0)good++;else bad++;
 }
 return {good,bad,flat};
}

// 1. Rounded suit: curvature, six outward faces, no seams/inverted geometry.
const rounded=get('makeRoundedBox()');
const a=meshCheck(rounded,'rounded-player',[[-.5,.5],[-.5,.5],[-.5,.5]]);
check(rounded.n===1296,'rounded box requires 7x7 face sampling');
const roundWinding=windingQuality(a);
check(roundWinding.bad===0&&roundWinding.good>300,'rounded suit has inward faces');
let curvedNormals=0;
for(let k=0;k<a.length;k+=10){
 const n=[Math.abs(a[k+3]),Math.abs(a[k+4]),Math.abs(a[k+5])];
 if(n.filter(x=>x>.15).length>=2)curvedNormals++;
}
check(curvedNormals>a.length/10*.2,'rounded geometry lacks curved edge normals');

// 2. Rounded robotic actuator shell and piston side normals match winding.
const ellipsoid=get('(()=>{const m=robotMaker();m.ellipsoid(0,0,0,1,.7,.9,[.6,.7,.8],0,16,9);return m.finish()})()');
const ea=meshCheck(ellipsoid,'ellipsoid',[[-1,1],[-.7,.7],[-.9,.9]]);
const eWinding=windingQuality(ea);
check(eWinding.bad===0&&eWinding.good>=200,'robot ellipsoid is inverted');
const piston=get('(()=>{const m=robotMaker();m.rod([0,0,0],[0,.8,0],.2,[.5,.7,.9],0,12);return m.finish()})()');
const pa=meshCheck(piston,'piston',[[-.2,.2],[0,.8],[-.2,.2]]);
const pWinding=windingQuality(pa);
check(pWinding.bad===0,'piston surface is inverted');

// 3. Body and articulating limbs across every archetype stay fully finite.
for(const kind of ['scout','charger','shooter','brute','sniper','medic','warden','artillery','raider','drone','boss']){
 const body=get(`buildRobotBody(${JSON.stringify(kind)},false)`);
 meshCheck(body,`${kind}-body`,[[-2,2],[0,3.2],[-1.6,1.6]]);
 for(const part of ['upperArm','foreArm','upperLeg','lowerLeg']){
  const limb=get(`buildRobotArticulatedPart(${JSON.stringify(kind)},${JSON.stringify(part)})`);
  meshCheck(limb,`${kind}-${part}`,[[-1.3,1.3],[-1.6,.6],[-1.4,1.4]]);
 }
}

// 4. Interceptor, heavy sentinel and manta each have unique mesh silhouettes
// while remaining inside the Stage 15 world-space wing/thruster hit volumes.
const signatures=[];
for(const kind of ['skyhunter','skyguard','stormray']){
 const mesh=get(`buildRobotAirframeVariant(${JSON.stringify(kind)})`);
 const points=meshCheck(mesh,`${kind}-airframe`,[[-1.30,1.30],[.7,1.8],[-.9,1.1]]);
 check(mesh.n<3000,`${kind}: overlay too expensive per visible enemy`);
 const extrema=[Infinity,-Infinity,Infinity,-Infinity,Infinity,-Infinity];
 for(let k=0;k<points.length;k+=10){
  for(let j=0;j<3;j++){
   extrema[j*2]=Math.min(extrema[j*2],points[k+j]);
   extrema[j*2+1]=Math.max(extrema[j*2+1],points[k+j]);
  }
 }
 signatures.push([mesh.n,...extrema].map(x=>x.toFixed(3)).join(','));
}
check(new Set(signatures).size===3,'airframe variants are identical');
// 5. Verify the real startup builds all three overlays and one rounded suit.
get('initRobotFoundry()');
check(get("['skyhunter','skyguard','stormray'].every(x=>airRobotVariants[x]?.n>0)"),
 'foundry does not initialize all aerial variants');
check(get("Object.keys(robotFoundry).length===11"),'existing robot archetypes were lost');
check(src('01-webgl-shaders.js').includes('geom.rounded=makeRoundedBox()'),
 'rounded suit not registered in WebGL startup');
check(src('09a-player-third-person.js').includes('const shell=geom.rounded||geom.bevel'),
 'new suit shell was not wired to the renderer');
check(src('09-robot-foundry-artifacts.js').includes('airRobotVariants[e.type]'),
 'aerial overlays were not wired to enemy rendering');

// 6. Both Canvas fallback versions must render on real and legacy 2D contexts.
// Soft-corner paths are optional to preserve old embedded browsers/Canvas mocks.
const canvasCtx={Math,Number,Array,TAU:Math.PI*2,
 weapons:Array.from({length:10},(_,i)=>({color:[.3+i*.05,.65,.85]})),
 clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
 operatorPalette:()=>({primary:[.3,.4,.5],shadow:[.2,.3,.4],light:[.5,.6,.7],
  black:[.1,.1,.1],joint:[.2,.2,.2],visor:[.3,.8,.9],accent:[.6,.5,.2],grade:2})};
vm.createContext(canvasCtx);
const actorSource=src('09a-player-third-person.js');
const robotSource=src('11-fallback-render.js');
vm.runInContext(actorSource.slice(actorSource.indexOf('function drawFallbackOperator('),
 actorSource.indexOf('// Reflect saved camera mode')),canvasCtx);
vm.runInContext(robotSource.slice(robotSource.indexOf('function drawFallbackRobot('),
 robotSource.indexOf('function renderFallback(')),canvasCtx);
for(const curves of [true,false]){
 const stats={path:0,curves:0};
 const canvas={};
 for(const name of ['save','restore','scale','translate','rotate','beginPath','moveTo','lineTo',
  'closePath','fill','stroke','fillRect','strokeRect','arc']){
  canvas[name]=()=>{if(name==='beginPath')stats.path++;};
 }
 if(curves)canvas.quadraticCurveTo=()=>{stats.curves++;};
 canvasCtx.canvas=canvas;
 vm.runInContext('drawFallbackOperator(canvas,{bodyArmorType:11},115)',canvasCtx);
 for(const kind of ['skyhunter','skyguard','stormray','drone','scout','boss']){
  canvasCtx.flyer={type:kind,boss:kind==='boss',airborne:['skyhunter','skyguard','stormray','drone'].includes(kind),
   radius:.51,hp:100,maxhp:100,robotCycle:1.3,robotMotion:1,color:[.4,.7,.8],id:1};
  vm.runInContext('drawFallbackRobot(canvas,flyer,85,.4)',canvasCtx);
 }
 check(stats.path>70,`Canvas fallback ${curves}: missing silhouette paths`);
 if(curves)check(stats.curves>30,'Canvas curved corner paths are not used');
}
console.log(`stage16 smooth-model regression: ${checks} checks PASS; rounded ${rounded.n} vertices; robot shell ${ellipsoid.n}; variants distinct; total uploaded meshes ${allocated.length}`);

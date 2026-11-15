'use strict';
// Stage 17: real procedural energy meshes, correctly oriented trails and
// impact-particle lifecycle. These tests do not need a graphics driver.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;const check=(v,message)=>{assert.ok(v,message);checks++;};
const ctx={Math,Number,Array,Float32Array,TAU:Math.PI*2};
let active=null;
const gl={ARRAY_BUFFER:1,STATIC_DRAW:2,createBuffer:()=>({}),
 bindBuffer:(_k,b)=>{active=b},bufferData:(_k,a)=>{active.data=a}};
ctx.gl=gl;vm.createContext(ctx);
vm.runInContext(src('02-geometry.js').split('const ID=')[0],ctx);
const value=x=>vm.runInContext(x,ctx);
const geometry=(mesh,label,maxVertices)=>{
 const a=mesh.b.data;
 check(a.length===mesh.n*10&&mesh.n%3===0,`${label} GPU stride`);
 check(mesh.n<=maxVertices,`${label} too expensive`);
 let good=0,bad=0,zero=0,emissive=0;
 for(let k=0;k<a.length;k+=10){
  for(let j=0;j<10;j++)check(Number.isFinite(a[k+j]),`${label} invalid float ${j}`);
  check(Math.abs(Math.hypot(a[k+3],a[k+4],a[k+5])-1)<.01,`${label} bad normal`);
  if(a[k+9]>.2)emissive++;
 }
 for(let k=0;k<a.length;k+=30){
  const u=[a[k+10]-a[k],a[k+11]-a[k+1],a[k+12]-a[k+2]];
  const v=[a[k+20]-a[k],a[k+21]-a[k+1],a[k+22]-a[k+2]];
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(Math.hypot(...n)<1e-8){zero++;continue}
  const d=n.reduce((sum,x,i)=>sum+x*a[k+3+i],0);
  if(d>0)good++;else bad++;
 }
 check(emissive>mesh.n*.25,`${label} missing baked emission`);
 check(good>mesh.n/10&&bad===0,`${label} surface winding inconsistent (${bad} inverted)`);
 return {vertices:mesh.n,good,bad,zero};
};
const beam=geometry(value('makeEnergyBeam(10)'),'tapered laser',200);
const spark=geometry(value('makeSparkOrb(8,5)'),'smooth spark',200);
check(beam.vertices===180&&spark.vertices===192,'unexpected mesh detail level');
const gpuInit=src('01-webgl-shaders.js');
check(gpuInit.includes('geom.tracer=makeEnergyBeam(10)')&&
 gpuInit.includes('geom.spark=makeSparkOrb(8,5)'),
 'new meshes are not uploaded at WebGL initialization');

// Beam head must be aligned with the current 3D velocity and the midpoint
// must lie behind the visible projectile, including pure vertical flight.
const drawCalls=[];
const fxCtx={Math,Number,geom:{tracer:'beam',cylinder:'old'},draw:(...a)=>drawCalls.push(a)};
vm.createContext(fxCtx);
const drawSrc=src('10-first-person-render.js');
vm.runInContext(drawSrc.slice(drawSrc.indexOf('function drawEnergyTail('),
 drawSrc.indexOf('function render(){')),fxCtx);
for(const [vx,vy,vz] of [[10,0,0],[-10,2,3],[0,15,0],[0,-9,0],[0,0,-10],[1,2,3]]){
 const projectile={x:3,y:5,z:7,vx,vy,vz};
 fxCtx.projectile=projectile;
 vm.runInContext('drawEnergyTail(projectile,[1,.5,.2],.08,1.3)',fxCtx);
 const d=drawCalls.at(-1),speed=Math.hypot(vx,vy,vz);
 check(d[0]==='beam','energy tail does not use smooth mesh');
 check(d[6]>.05&&d[6]<=1.3,'energy tail length exceeds cap');
 const diff=[projectile.x-d[1],projectile.y-d[2],projectile.z-d[3]];
 const dot=(diff[0]*vx+diff[1]*vy+diff[2]*vz)/speed;
 check(dot>0&&Math.abs(dot-d[6]*.5)<1e-8,'tail midpoint is not behind projectile');
 check(d.every(x=>typeof x!=='number'||Number.isFinite(x)),'non-finite tail matrix');
}
const before=drawCalls.length;
fxCtx.projectile={x:3,y:5,z:7,vx:0,vy:0,vz:0};
vm.runInContext('drawEnergyTail(projectile,[1,1,1],.08,1.3)',fxCtx);
check(drawCalls.length===before,'stationary projectile should not draw a tail');

// Canvas backup: laser corona plus white core. Both use exactly the same
// endpoints as before, only the compositing changes.
let strokes=0;
const canvas={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++}};
const fallback=src('11-fallback-render.js');
const fallbackCtx={Math,Number,C:canvas,TAU:Math.PI*2,
 clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
 proj:p=>({x:p.x*10,y:p.y*10}),
 g:{tracers:[{a:{x:1,y:2},b:{x:8,y:7},life:.08,maxLife:.12,r:.017,col:[.3,.8,1]}]}};
vm.createContext(fallbackCtx);
vm.runInContext(fallback.slice(fallback.indexOf('for(const tr of (g.tracers||[])){'),
 fallback.indexOf('for(const b of (g.projectiles||[])){')),fallbackCtx);
check(strokes===2,'Canvas dual-layer glowing beam was not drawn');

// Sparks born from either pipeline keep their *original* lifetime for a
// monotonic fade, without changing the collision/physics side of the game.
const creation={Math,Number,TAU:Math.PI*2,game:{particles:[]},
 save:{settings:{quality:2}},rand:(a,b)=>(a+b)*.5};
vm.createContext(creation);
const burstSrc=src('13-enemy-navigation-spawn.js');
vm.runInContext(burstSrc.slice(burstSrc.indexOf('function burst(')),creation);
const impacts=src('17-weapon-combat.js');
vm.runInContext(impacts.slice(impacts.indexOf('function sparkImpact('),
 impacts.indexOf('function addSurfaceMark(')),creation);
vm.runInContext('burst(0,1,0,[1,.5,.3],6);sparkImpact(0,2,0,{nx:0,ny:1,nz:0},[.5,1,.3],8)',creation);
check(creation.game.particles.length===14,'particle count was modified');
check(creation.game.particles.every(p=>p.life===p.maxLife&&p.life>0),
 'new particle lacks a full original lifetime');
check(drawSrc.includes('const maxSparks=save.settings.quality===0?75:touchOnly?110:145'),
 'particle rendering lacks a mobile/low-quality cap');
check(drawSrc.includes('geom.spark||geom.orb')&&drawSrc.includes('drawEnergyTail(b,'),
 'energy effects not wired to bullets/projectiles');
console.log(`stage17 FX regression: ${checks} checks PASS; beam ${beam.vertices} vertices, spark ${spark.vertices} vertices; Canvas dual pass and lifetime OK`);

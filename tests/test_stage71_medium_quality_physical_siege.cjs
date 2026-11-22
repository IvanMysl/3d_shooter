'use strict';
// Third graphics preset: low/high invariants alone are not enough to prove
// that touch-capable medium-quality devices retain solid 3D fortifications.
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,
 clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:true,touchOnly:true,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:c=>c,
 save:{settings:{quality:1,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(ctx);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(file),ctx,{filename:file});
const ev=s=>vm.runInContext(s,ctx);
const check=(condition,msg)=>{assert.ok(condition,msg);checks++;};
const close=b=>b.map(v=>v.toFixed(5)).join(',');
let checks=0,worlds=0,bosses=0,regulars=0,real=0,sampled=0;
const reached=(sx,sz,tx,tz)=>{
 const n=ctx.mapSize,visit=new Uint8Array(n*n),q=new Int32Array(n*n);
 let head=0,tail=0;
 const start=Math.floor(sz)*n+Math.floor(sx),finish=Math.floor(tz)*n+Math.floor(tx);
 visit[start]=1;q[tail++]=start;
 while(head<tail){
  const cell=q[head++];if(cell===finish)return true;
  const x=cell%n,z=Math.floor(cell/n);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||visit[k]||ctx.mapCells[Z][X]||
     !ctx.enemyNavEdge(x,z,X,Z))continue;
   visit[k]=1;q[tail++]=k;
  }
 }
 return false;
};
for(let level=1;level<=100;level++){
 ctx.glReady=true;ctx.touchOnly=true;ctx.save.settings.quality=1;
 ctx.buildMap(level);worlds++;
 const boss=level%5===0,roof=ctx.ceilingHeight();
 const plan=ev(boss?'bossApproachPlan':'secondaryYard');
 const parts=boss?ctx.bossSiegeBoxes(level,plan,roof):
  ctx.secondaryCanopyBoxes(level,plan,roof);
 check(plan!==null,`L${level}: medium-quality special arena missing`);
 check(parts.length>=7,`L${level}: medium-quality architecture absent`);
 if(boss)bosses++;else regulars++;
 const solids=new Set(ev('worldSolidGrid').flatMap(a=>a||[]).map(s=>close(s.box)));
 let available=0;
 for(const part of parts){
  const b=part.box;
  check(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&b[5]>b[2],
   `L${level}: medium-quality invalid physical volume`);
  if(!solids.has(close(b)))continue;
  real++;available++;
  if(b[1]>3.0){
   for(let z=Math.max(1,Math.floor(b[2]));z<=Math.min(ctx.mapSize-2,Math.floor(b[5]));z++)
    for(let x=Math.max(1,Math.floor(b[0]));x<=Math.min(ctx.mapSize-2,Math.floor(b[3]));x++){
     if(ctx.mapCells[z][x]!==0)continue;
     check(b[1]>=Math.max(ctx.floorHeightAtCell(x,z),ctx.deckAtCell(x,z))+2.25-.001,
      `L${level}: medium graphics obstruct old footway at ${x},${z}`);
    }
  }
  if(sampled<350&&part.role!=='wallFoundation'){
   const mx=(b[0]+b[3])/2,mz=(b[2]+b[5])/2,my=(b[1]+b[4])/2;
   check(ctx.worldSolidBodyCollision(mx,mz,.11,b[1]-.045,.46),
    `L${level}: medium graphics draws a ghost obstacle`);
   check(ctx.rayWall({x:mx,y:my,z:mz},{x:1,y:0,z:0},.07)?.t<.001,
    `L${level}: medium graphics lets bullets through`);
   check(ctx.sweepWorldSphere({x:mx,y:my,z:mz},
     {x:1,y:0,z:0},.07,.08)?.t<.001,
    `L${level}: medium graphics lets rockets through`);
   sampled++;
  }
 }
 check(available>=6,`L${level}: most medium-quality fort parts not rendered`);
 check(reached(ctx.spawnX,ctx.spawnZ,plan.cx+.5,plan.cz+.5),
  `L${level}: robot cannot walk into medium-quality yard/fort`);
 check(ev('worldSolidCount')<17000,`L${level}: mobile static-solid budget exceeded`);
}
check(worlds===100&&bosses===20&&regulars===80&&sampled===350&&real>=1000,
 'incomplete 100-level touch/medium-quality graphics and collision audit');
console.log(`Stage71 medium mobile: ${checks} checks PASS, `+
 `${bosses} boss forts + ${regulars} ordinary yards, ${real} exactly `+
 `registered 3D volumes, ${sampled} independent triple collisions, `+
 `100 reachable robot routes and mobile solid budget verified`);

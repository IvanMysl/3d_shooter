'use strict';
// Real map samples: actual off-centre links and upper deck exits.
// Compare accepted sweeps to dense direct checks, and walk the accepted
// ground edges with the actual actor controller in both directions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,meshes=0;
const check=(v,m)=>{assert.ok(v,m);checks++};
const c={Math,console,Number,Set,Map,Array,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['boss'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
const webgl=new Set((process.env.WEBGL_LEVELS||'1,8,35,70,99,100').split(',').map(Number));
let joins=0,accepted=0,upperTrials=0,upperPaths=0,upperSegments=0,blocked=0,stops=0;
const profile={radius:.23,height:1.95};
for(const level of levels){
 c.game=null;c.glReady=webgl.has(level);c.save.settings.quality=level%3;c.buildMap(level);if(c.glReady)meshes++;
 c.game={p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ)},nodes:[],devices:[],nodesDestroyed:0,mission:{type:'purge'},enemies:[],t:0};
 const n=c.mapSize,ground=[],upper=[];
 for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)if(c.mapCells[z][x]===0){
  if(c.deckAtCell(x,z)>0)upper.push([x,z]);
  if(c.mapCells[z]?.[x+1]===0&&x+1<n-1)ground.push([x,z]);
 }
 // An inexpensive local field with real ground goals at the perimeter of
 // each deck component; the production BFS must connect only through
 // actual short steps. No need to flood the whole map for each sample.
 const field=new Int16Array(n*n);field.fill(32767);
 for(const [x,z] of upper)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const X=x+dx,Z=z+dz;if(c.deckAtCell(X,Z)>0)continue;
  const g=c.missionGroundPoint(X,Z);if(g)field[Z*n+X]=0;
 }
 const count=Math.min(15,ground.length);
 for(let i=0;i<count;i++){
  const [x,z]=ground[Math.floor((i+.5)*ground.length/count)],b=c.missionGroundPoint(x+1,z);
  const start=c.missionGroundPoint(x,z);if(!start||!b)continue;
  const a={x:start.x+.22,z:start.z+(i%2?.29:-.29),feetY:start.feetY};
  if(c.collide(a.x,a.z,.23)||c.worldSolidBodyCollision(a.x,a.z,.23,a.feetY,1.95))continue;
  joins++;const pass=c.missionRouteLink(a,b);if(!pass){blocked++;continue;}accepted++;
  const pose=c.worldActorSweepPlan(a.x,a.z,b.x,b.z,.23,a.feetY,true,true,1.95);
  check(pose&&Math.abs(pose.feet-b.feetY)<.005,`L${level} exact link accepted`);
  let feet=a.feetY;for(let j=1;j<=24;j++){
   const u=(j-1)/24,t=j/24,px=a.x+(b.x-a.x)*u,pz=a.z+(b.z-a.z)*u,X=a.x+(b.x-a.x)*t,Z=a.z+(b.z-a.z)*t;
   const m=c.worldActorSweepPlan(px,pz,X,Z,.23,feet,true,true,1.95);
   check(m&&!c.worldSolidBodyCollision(X,Z,.23,m.feet,1.95),`L${level} actual short walking segment`);feet=m.feet;
  }
  check(Math.abs(feet-b.feetY)<.005,`L${level} final actual height`);
 }
 // Test a real edge of a full wall on every generated map.
 let done=false;for(let z=1;z<n-1&&!done;z++)for(let x=1;x<n-2&&!done;x++)if(c.mapCells[z][x]===0&&c.mapCells[z][x+1]===1){
  const a=c.missionGroundPoint(x,z);if(!a)continue;
  const q=c.worldActorAdvance(a.x,a.z,x+1.5,a.z,.23,a.feetY,true,false,1.95);
  if(!q)continue;
  check(!q.complete&&!c.collide(q.x,q.z,.23)&&!c.worldSolidBodyCollision(q.x,q.z,.23,q.feet,1.95),`L${level} cannot cross generated wall`);
  check(q.x<x+1-.23+.00001,`L${level} no wall penetration`);stops++;done=true;
 }
 const uc=Math.min(4,upper.length);
 for(let i=0;i<uc;i++){
  const [x,z]=upper[Math.floor((i+.5)*upper.length/uc)],a=c.missionUpperPoint(x,z);if(!a)continue;upperTrials++;
  const path=c.missionUpperExit(a,field);if(!path){if(process.env.REPORT_MISSING)console.log(JSON.stringify({missing:true,level,x,z,feetY:a.feetY}));continue;}upperPaths++;
  check(field[Math.floor(path.at(-1).z)*n+Math.floor(path.at(-1).x)]===0,`L${level} reaches selected real ground exit`);
  for(let j=1;j<path.length;j++){check(c.missionRouteLink(path[j-1],path[j]),`L${level} valid upper route segment`);upperSegments++;}
 }
 worlds++;
}
console.log(JSON.stringify({stage:113,worlds,meshes,checks,joins,accepted,blocked,stops,upperTrials,upperPaths,upperSegments}));

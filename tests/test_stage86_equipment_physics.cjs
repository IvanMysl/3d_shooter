'use strict';
// Stage86: fully solid live equipment on all 100 maps. Check the world at
// exact-body, robot-path and ray/sphere levels, not only model declarations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let assertions=0;const check=(ok,msg)=>{assert.ok(ok,msg);assertions++;};
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(name),c,{filename:name});
const rangeStart=Math.max(1,Number(process.env.FIRST||1)),rangeEnd=Math.min(100,Number(process.env.LAST||100));
let equipment=0,rounds=0,blocked=0,glScenes=0,unreachable=0,probes=0;
const cardinal=[[1,0],[-1,0],[0,1],[0,-1]];
for(let level=rangeStart;level<=rangeEnd;level++){
 c.game=null;c.glReady=(level===1||level===14||level===35||level===70||level===99);
 c.save.settings.quality=level%2?0:2;
 c.buildMap(level);if(c.glReady)glScenes++;
 const before=c.missionGroundField(c.spawnX,c.spawnZ);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:0,
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:0},
  t:0,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],portalReady:false};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const after=c.missionGroundField(c.spawnX,c.spawnZ);
 const key=(x,z)=>Math.floor(z)*c.mapSize+Math.floor(x);
 check(after[key(c.portal.x,c.portal.z)]>=0,`L${level}: actual portal made inaccessible`);
 let beforeN=0,afterN=0;
 for(let z=1;z<c.mapSize-1;z++)for(let x=1;x<c.mapSize-1;x++){
  const k=z*c.mapSize+x;
  if(before[k]>=0)beforeN++;
  if(after[k]>=0)afterN++;
 }
 // Placed steel equipment may consume its own tile, but must not cut off
 // adjacent rooms and long ground corridors behind the placement.
 const steel=g.nodes.length+g.devices.length+(g.mission?.caches?.length||0);
 check(beforeN-afterN<=steel+2,`L${level}: isolated ${beforeN-afterN} accessible tiles with only ${steel} equipment bodies`);
 unreachable+=beforeN-afterN-steel;
 const objects=[...g.nodes,...g.devices];
 check(c.worldEquipmentStats().bodies===objects.length+(g.mission?.caches?.length||0),`L${level}: stale/omitted equipment`);
 for(const o of objects){
  equipment++;
  const ground=c.floorHeight(o.x,o.z),r=g.nodes.includes(o)?.37:.36;
  check(c.worldSolidBodyCollision(o.x,o.z,.25,ground,1.68),`L${level}: equipment can be walked through`);
  check(!c.collide(o.x,o.z,.70),`L${level}: equipment inside brick wall`);
  check(c.missionApproachDistance(after,o)>=0,`L${level}: blocked interaction perimeter`);
  const x=Math.floor(o.x),z=Math.floor(o.z);
  let reachable=false;
  for(const [dx,dz] of cardinal){
   const X=x+dx,Z=z+dz;if(X<1||Z<1||X>=c.mapSize-1||Z>=c.mapSize-1)continue;
   if(after[key(X+.5,Z+.5)]>=0){
    const ox=X+.5,oz=Z+.5;
    if(!c.worldSolidBodyCollision(ox,oz,.23,ground,1.92))reachable=true;
   }
  }
  check(reachable,`L${level}: no reachable player interaction tile`);
  // A neighbouring stair lip may legitimately intercept the projectile
  // *before* equipment. Probe all four sides and require at least one
  // actual unobstructed approach to the steel face.
  let hits=0,balls=0,misses=0;
  for(const [dx,dz] of cardinal){
   const origin={x:o.x+dx*(r+.08),y:ground+.52,z:o.z+dz*(r+.08)};
   const aim={x:-dx,y:0,z:-dz};
   const h=c.rayWall(origin,aim,.45);
   if(h&&h.t<=.12&&(h.kind==='node'||h.kind==='equipment'))hits++;
   const ball=c.sweepWorldSphere(origin,aim,.45,.13);
   if(ball&&ball.t<.2&&(ball.kind==='node'||ball.kind==='equipment'))balls++;
   const high=c.sweepWorldSphere({x:origin.x,y:ground+1.5,z:origin.z},aim,.2,.13);
   if(!high||(high.kind!=='node'&&high.kind!=='equipment'))misses++;
  }
  check(hits>=1,`L${level}: steel housing lets hitscan through on all four sides`);
  check(balls>=1,`L${level}: no rocket contacts the physical steel housing`);
  check(misses>=1,`L${level}: phantom collider above the actual housing`);
  probes+=3;
 }
 // Previously placed map object remains physical even after use. Destroyed
 // reactors vanish, including from the raycast and robot navigation.
 const node=g.nodes.find(n=>n.type!==2);
 if(node){
  const gnd=c.floorHeight(node.x,node.z),ray={x:node.x-.37-.08,y:gnd+.52,z:node.z};
  check(c.rayWall(ray,{x:1,y:0,z:0},.5)?.kind==='node',`L${level}: pre-kill node ray`);
  node.dead=true;c.enemyNavMask=null;c.enemyNavEdges=null;
  check(!c.worldSolidBodyCollision(node.x,node.z,.25,gnd,1.68),`L${level}: destroyed reactor still blocks player`);
  check(c.rayWall(ray,{x:1,y:0,z:0},.5)?.kind!=='node',`L${level}: ghost destroyed reactor ray`);
  const update=c.worldEquipmentStats();
  check(update.nodes===g.nodes.length-1,`L${level}: destroyed reactor not excluded from active registry`);
 }
 rounds++;
}
console.log(`Stage86: ${assertions} assertions / ${rounds} worlds (${rangeStart}-${rangeEnd}) / ${equipment} dynamic physical housings / ${probes} ray+rocket+near-miss probes / ${glScenes} full mesh scenes, delta-reachable ${unreachable}: PASS`);

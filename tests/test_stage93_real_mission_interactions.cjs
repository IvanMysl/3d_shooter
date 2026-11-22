'use strict';
// Full procedural-world acceptance: no target can demand an interaction through
// real metal. This test uses the *actual* hull, ray, terrain, route and mission
// functions, rather than mocked reachability or visual-only decorations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0,goals=0,archives=0,relays=0,targets=0,routePicks=0,glWorlds=0;
const check=(yes,msg)=>{assert.ok(yes,msg);checks++;};
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
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(file),c,{filename:file});
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
const full=new Set((process.env.WEBGL||'1,14,35,70,99').split(',').map(Number));
for(let level=first;level<=last;level++){
 c.glReady=full.has(level);c.save.settings.quality=level%2?0:2;c.game=null;c.buildMap(level);
 if(c.glReady)glWorlds++;
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:0,grounded:true,shield:0,
  hp:100,maxhp:100,armor:100,maxArmor:100,energy:100,maxEnergy:100,bodyArmor:0,bodyArmorMax:100},
  t:0,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],portalReady:false};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const source=c.missionGroundField(c.spawnX,c.spawnZ),n=c.mapSize;
 function accessibleApproach(o){
  const x=Math.floor(o.x),z=Math.floor(o.z),kind=g.mission.caches.includes(o)?'archive':'device';
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz;if(X<1||Z<1||X>=n-1||Z>=n-1||source[Z*n+X]<0)continue;
   const q={x:X+.5,z:Z+.5,feetY:c.floorHeight(X+.5,Z+.5)};
   if(c.missionInteractionClear(q,o,kind)&&!c.worldSolidBodyCollision(q.x,q.z,.23,q.feetY,1.7))return q;
  }
  return null;
 }
 for(const o of [...g.mission.caches,...g.devices]){
  const approach=accessibleApproach(o);
  check(!!approach,`L${level}: ${o.kind||'archive'} has no reachable physical interaction face at (${o.x},${o.z})`);
  const field=c.missionField(o);
  check(field[Math.floor(approach.z)*n+Math.floor(approach.x)]===0,
   `L${level}: mission guidance does not lead to valid contact point`);
  check(!c.worldSolidBodyCollision(approach.x,approach.z,.23,approach.feetY,1.7),
   `L${level}: activation point inside a solid obstacle`);
  goals++;
 }
 // Real graph-based selection must match independently calculated minimal
 // physical distances, not Euclidean distance through a wall.
 const pool=g.mission.type==='sabotage'?g.nodes.filter(q=>!q.dead&&q.type!==2):
  g.mission.type==='recovery'?g.mission.caches.filter(q=>!q.got&&c.missionItemActive(g,q,'recovery')):
  g.mission.type==='relay'?g.devices.filter(q=>q.kind==='relay'&&!q.used&&c.missionItemActive(g,q,'relay')):[];
 if(pool.length>1){
  const chosen=c.missionWaypoint(g),dist=c.missionGroundField(g.p.x,g.p.z);
  const valid=pool.map(q=>({q,cost:c.missionApproachDistance(dist,q)})).filter(q=>q.cost>=0);
  check(valid.length>0,`L${level}: all active mission goals unreachable`);
  const min=Math.min(...valid.map(q=>q.cost));
  check(valid.find(q=>q.q===chosen)?.cost===min,`L${level}: HUD selects a target across a physical shortcut`);
  routePicks++;
 }
 // Actually activate archives in their mandated order from OUTSIDE the steel
 // chassis. (Stage84's historical test teleports the player INSIDE it.)
 if(g.mission.type==='recovery'){
  const order=g.mission.routeOrder?.length?g.mission.routeOrder:g.mission.caches.map(q=>q.id);
  for(const id of order){
   const o=g.mission.caches.find(q=>q.id===id),p=accessibleApproach(o);check(!!p,`L${level}: no usable archive approach`);
   Object.assign(g.p,p);c.updateMission(.017);check(o.got,`L${level}: physically accessible crystal not collected`);
   archives++;
  }
 }
 if(g.mission.type==='relay'){
  const rel=g.devices.filter(d=>d.kind==='relay');
  const order=g.mission.routeOrder?.length?g.mission.routeOrder:rel.map(q=>q.id);
  for(const id of order){
   const o=rel.find(q=>q.id===id),p=accessibleApproach(o);check(!!p,`L${level}: no usable relay approach`);
   Object.assign(g.p,p);
   for(let k=0;k<10&&!o.used;k++)c.updateDevices(.15);
   check(o.used,`L${level}: accessible relay cannot be activated`);relays++;
  }
 }
 const physicalCount=g.nodes.length+g.devices.length+g.mission.caches.length;
 check(c.worldEquipmentStats().bodies===physicalCount,`L${level}: visible steel hull lacks a physical counterpart`);
 targets+=physicalCount;
}
console.log(`Stage93 actual mission contacts: ${checks} PASS / ${last-first+1} levels L${first}-${last} / ${goals} verifiable usable sides / ${archives} collected archives / ${relays} activated relays / ${routePicks} physical-choice missions / ${targets} physical hulls / ${glWorlds} full-mesh scenes`);

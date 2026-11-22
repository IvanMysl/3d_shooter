'use strict';
// Stage84: deterministic objective sites, grounded routes and no accidental
// floating/unreachable devices across ALL 100 existing physical worlds.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;function check(v,msg){assert.ok(v,msg);checks++;}
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])vm.runInContext(src(name),c,{filename:name});
const ev=e=>vm.runInContext(e,c),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
check(/GAME_BUILD='(?:87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js')),'must be V85 successor');
check(/MP_VERSION=(?:40|41|42)\b/.test(src('21b-multiplayer-lobby.js')),'must isolate different mission operation versions');
let positions=0, recovery=0, relays=0, nodes=0, minGap=Infinity,maxGap=0,lowestCount=999,glScenes=0;
const sceneKeys=new Set();
const firstLevel=Math.max(1,Number(process.env.FIRST||1)),lastLevel=Math.min(100,Number(process.env.LAST||100));
for(let level=firstLevel;level<=lastLevel;level++){
 c.glReady=(level===1||level===14||level===35||level===70||level===99);
 c.save.settings.quality=level%2?0:2;
 c.buildMap(level);if(c.glReady)glScenes++;
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:0},
  t:0,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],portalReady:false};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const snapshot=()=>JSON.stringify({nodes:g.nodes.map(p=>[p.x,p.z,p.type]),
  cache:g.mission.caches.map(p=>[p.x,p.z]),devices:g.devices.map(p=>[p.x,p.z,p.kind])});
 const first=snapshot();
 g.nodes=[];c.spawnPowerNodes(level);g.mission=null;g.devices=[];c.startMission(g);c.initDevices(g);
 check(first===snapshot(),`L${level}: nondeterministic objective positioning`);
 check(g.nodes.length>=3,`L${level}: missing reactors`);
 check(g.mission.type===c.missionType(level),`L${level}: changed objective archetype`);
 const expected=level>=3?6:3;
 check(g.devices.length>=expected-1,`L${level}: missing support devices`);
 if(g.mission.type==='recovery')check(g.mission.caches.length===3,`L${level}: not three archives`);
 if(g.mission.type==='relay')check(g.devices.filter(d=>d.kind==='relay').length===2,`L${level}: not two relays`);
 if(g.mission.type==='sabotage')check(g.nodes.filter(n=>n.type!==2).length>=g.mission.required&&g.mission.required===2,
  `L${level}: impossible sabotage`);
 const all=[...g.nodes,...g.mission.caches,...g.devices];
 nodes+=g.nodes.length;recovery+=g.mission.caches.length;relays+=g.devices.filter(d=>d.kind==='relay').length;
 lowestCount=Math.min(lowestCount,all.length);
 const field=c.missionGroundField(c.spawnX,c.spawnZ),fieldKey=p=>Math.floor(p.z)*c.mapSize+Math.floor(p.x);
 for(const o of all){
  const {x,z}=o,k=fieldKey(o),gridX=Math.floor(x),gridZ=Math.floor(z);
  check(c.mapCells[gridZ][gridX]===0,`L${level}: objective embedded in wall`);
  check(!c.collide(x,z,.68),`L${level}: no space to interact with objective`);
  check(c.floorHeightAtCell(gridX,gridZ)<=.06,`L${level}: objective is floating/raised`);
  const hull=(g.nodes.includes(o)||g.devices.includes(o)||g.mission.caches.includes(o));
  check(c.worldSolidBodyCollision(x,z,.27,0,1.75)===hull,
   `L${level}: missing/phantom physical equipment or archive plinth`);
  check(c.missionApproachDistance(field,o)>=6,
   `L${level}: objective lacks a reachable approach around the physical housing`);
  check(Number.isFinite(x)&&Number.isFinite(z),`L${level}: invalid coordinate`);
  positions++;
 }
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const gap=distance(all[i],all[j]);minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);
  check(gap>=3.55,`L${level}: overlapping world devices ${i}/${j}: ${gap}`);
 }
 if(g.mission.type==='recovery'){
  const old=g.mission.done;
  const order=g.mission.routeOrder?.length?g.mission.routeOrder:g.mission.caches.map(q=>q.id);
  for(const [i,id] of order.entries()){
   const item=g.mission.caches.find(q=>q.id===id);
   g.p.x=item.x;g.p.z=item.z;g.p.feetY=c.floorHeight(item.x,item.z);
   c.updateMission(.016);
   check(item.got&&g.mission.done===old+i+1,`L${level}: archive pickup fails`);
  }
 }
 if(g.mission.type==='relay'){
  const count=g.mission.required;
  const relays=g.devices.filter(x=>x.kind==='relay');
  const order=g.mission.routeOrder?.length?g.mission.routeOrder:relays.map(q=>q.id);
  for(const [i,id] of order.entries()){
   const d=relays.find(q=>q.id===id);
   g.p.x=d.x;g.p.z=d.z;g.p.feetY=c.floorHeight(d.x,d.z);
   for(let k=0;k<7&&!d.used;k++)c.updateDevices(.16);
   check(d.used&&g.mission.done===i+1,`L${level}: relay activation fails`);
  }
  check(g.mission.done===count,`L${level}: relay completion counter fails`);
 }
 // Stable mission routes: the guidance field follows the grid, never
 // a straight line through newly added walls or the overhead stair risers.
 const target=all[0];const from={x:c.spawnX,z:c.spawnZ};
 const guide=c.missionRouteTo(from,target,300);
 check(guide.length>1,`L${level}: navigation arrow has no path`);
 for(const pt of guide)check(c.mapCells[Math.floor(pt.z)]?.[Math.floor(pt.x)]===0,
  `L${level}: HUD guidance crosses masonry`);
 for(let i=1;i<guide.length;i++){
  const a=guide[i-1],b=guide[i];
  check(c.playerNavEdge(Math.floor(a.x),Math.floor(a.z),Math.floor(b.x),Math.floor(b.z)),
   `L${level}: guidance edge ${i}: ${a.x},${a.z} -> ${b.x},${b.z} riser/rail`);
 }
 if(process.env.COMPARE_QUALITY==='1'&&c.glReady){
  const original=first;
  c.save.settings.quality=c.save.settings.quality===0?2:0;
  c.buildMap(level);
  g.nodes=[];g.devices=[];g.mission=null;
  c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
  check(original===snapshot(),`L${level}: different geometry/mission sites for quality 0 vs 2`);
 }
 const key=g.mission.type+':'+g.nodes.map(x=>`${x.x},${x.z}`).join(';');sceneKeys.add(key);
}
check(nodes>=3*(lastLevel-firstLevel+1),'mission types were not fully exercised');
check(positions>=6*(lastLevel-firstLevel+1)&&minGap>=3.55&&sceneKeys.size===(lastLevel-firstLevel+1),'objective geography lacks coverage');
console.log(`Stage84: ${checks} assertions / ${lastLevel-firstLevel+1} maps (${firstLevel}-${lastLevel}) / ${positions} physical mission sites / `+
 `${nodes} reactors / ${recovery} archive pickups / ${relays} relays / `+
 `${glScenes} full WebGL-style geometry scenes / minimum device gap ${minGap.toFixed(2)} / ${sceneKeys.size} reproducible profiles: PASS`);

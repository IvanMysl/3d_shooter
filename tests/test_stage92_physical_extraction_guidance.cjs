'use strict';
// Regression: the HUD extraction route used an obstacle-blind mapCells flood
// fill, while mission guidance reused stale fields after reactor destruction.
// Exercise the actual production functions with actual equipment/robot AABBs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=process.env.BASELINE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(ROOT,'src',n),'utf8');
let checks=0;function check(b,msg){assert.ok(b,msg);checks++;}
const N=19,grid=Array.from({length:N},()=>Array(N).fill(0));
for(let z=1;z<N-1;z++)if(z!==8&&z!==13)grid[z][8]=1;
const node={x:8.5,z:8.5,dead:false};
const p={x:4.5,z:8.5,feetY:0,yaw:0},portal={x:13.5,z:8.5};
const g={state:'playing',sector:21,p,portalReady:true,nodes:[node],nodesDestroyed:0,devices:[],enemies:[],mission:{type:'sabotage',caches:[]}};
const c={Math,Number,Set,Map,console,Int8Array,Int16Array,Int32Array,Uint8Array,Float32Array,
 mapSize:N,mapCells:grid,worldSolidGrid:[],heightCells:[],deckCells:[],worldSolidCount:0,
 glReady:false,mpMatch:null,game:g,portal,portalRouteField:null,spawnX:4.5,spawnZ:8.5,
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,
 supportHeight:()=>0,collide:(x,z,r)=>grid[Math.floor(z)]?.[Math.floor(x)]!==0,
 lineClear:()=>true,isBalconySector:()=>false,enemyCrowdAllows:()=>true,
 hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v))};
vm.createContext(c);
// Load the actual Stage111 standing-pose and terrain helpers rather than
// replacing real support with the old flat-field fixture stubs.
const terrainSource=src('03-height-and-collision.js');
c.heightCells=new Float32Array(N*N);
vm.runInContext(terrainSource.slice(terrainSource.indexOf('function worldTerrainFootprint('),terrainSource.indexOf('function makeStairHeights(')),c);
for(const f of ['04a-static-world-solids.js','13a-enemy-world-navigation.js','15-mission-system.js'])
 vm.runInContext(src(f),c,{filename:f});
const src19=src('19-gameplay-update.js'),start=src19.indexOf('function portalFlow(){'),end=src19.indexOf('function navArrow(',start);
check(start>=0&&end>start,'portal route functions must exist in actual gameplay');
vm.runInContext(src19.slice(start,end),c,{filename:'19-gameplay-update.js portal route'});
const ev=text=>vm.runInContext(text,c);
function route(from,to,which){return c[which](from,to,200)}
function assertPhysicalRoute(route,tag){
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],x=Math.floor(a.x),z=Math.floor(a.z),X=Math.floor(b.x),Z=Math.floor(b.z);
  check(Math.abs(x-X)+Math.abs(z-Z)===1,`${tag}: discontinuous route at ${i}`);
  check(c.playerNavEdge(x,z,X,Z),`${tag}: route crosses a REAL blocked edge at ${i}: ${x},${z}->${X},${Z}`);
 }
}
for(const glReady of [false,true]){
 c.glReady=glReady;c.worldSolidGrid=[];
 node.dead=false;g.nodesDestroyed=0;
 ev('enemyNavMask=null; enemyNavEdges=null; missionGuideCache=null;');
 const living=c.portalRoute(p,100);
 check(living.length>5,`gl=${glReady}: extraction path should take a physical detour`);
 assertPhysicalRoute(living,`gl=${glReady}: live extraction`);
 check(living.some(q=>Math.floor(q.x)===8&&Math.floor(q.z)===13),
  `gl=${glReady}: extraction must cross the OPEN side gate, not the reactor`);
 check(!living.some(q=>Math.floor(q.x)===8&&Math.floor(q.z)===8),
  `gl=${glReady}: live reactor must block its own doorway`);
 const oldField=c.missionField(portal),oldLen=living.length;
 check(c.missionField(portal)===oldField,`gl=${glReady}: stable topology must reuse navigation field`);
 node.dead=true;g.nodesDestroyed++;
 check(!c.worldSolidBodyCollision(8.5,8.5,.24,0,1.68),
  `gl=${glReady}: destroyed node loses its collider`);
 const freedField=c.missionField(portal);
 check(freedField!==oldField,`gl=${glReady}: route field must invalidate after destruction`);
 const cleared=c.portalRoute(p,100);
 assertPhysicalRoute(cleared,`gl=${glReady}: cleared extraction`);
 check(cleared.some(q=>Math.floor(q.x)===8&&Math.floor(q.z)===8),
  `gl=${glReady}: direct doorway opens after destruction`);
 check(cleared.length<oldLen,`gl=${glReady}: released doorway shortens real route`);
 // The HUD mission arrow must use the same invalidated field and physical edges.
 node.dead=false;g.nodesDestroyed++;ev('missionGuideCache=null');
 const before=c.missionRouteTo(p,portal,100);
 assertPhysicalRoute(before,`gl=${glReady}: mission route before`);
 node.dead=true;g.nodesDestroyed++;
 const after=c.missionRouteTo(p,portal,100);
 assertPhysicalRoute(after,`gl=${glReady}: mission route after`);
 check(after.length<before.length,`gl=${glReady}: mission guidance must refresh after destruction`);
 // New installed equipment changes the spatial index even if the map stays.
 const original=c.missionField(portal);const extra={x:8.5,z:8.5,used:false,kind:'repair'};
 g.devices.push(extra);
 const updated=c.missionField(portal);
 check(updated!==original,`gl=${glReady}: added solid device changes guidance cache`);
 const blocked=c.portalRoute(p,100);
 assertPhysicalRoute(blocked,`gl=${glReady}: new station`);
 check(!blocked.some(q=>Math.floor(q.x)===8&&Math.floor(q.z)===8),
  `gl=${glReady}: a station closes the doorway as physically required`);
 g.devices=[];
}
// Real stair heights: do not mistake a 1m wall for walkable, but keep
// a sequence of normal 0.22m treads physically accessible.
const height=Array.from({length:N},()=>Array(N).fill(0));
for(let z=1;z<N-1;z++)grid[z][8]=1;
grid[8][8]=grid[13][8]=0;g.nodes=[];g.devices=[];g.nodesDestroyed=0;
// Close the side gate, then the central opening is the only route.
grid[13][8]=1;
const oldAt=c.floorHeightAtCell,oldFloor=c.floorHeight;
c.floorHeightAtCell=(x,z)=>height[z]?.[x]||0;c.floorHeight=(x,z)=>height[Math.floor(z)]?.[Math.floor(x)]||0;
for(const stage of ['cliff','stairs']){
 for(let z=1;z<N-1;z++)for(let x=8;x<N-1;x++)height[z][x]=stage==='cliff'?1.1:0;
 if(stage==='stairs'){
  // A 5-cell staircase from 0 through 1.10m in legal .22m risers.
  for(let z=1;z<N-1;z++)for(let x=8;x<13;x++)height[z][x]=.22*(x-7);
  for(let z=1;z<N-1;z++)for(let x=13;x<N-1;x++)height[z][x]=1.10;
 }
 ev('enemyNavMask=null; enemyNavEdges=null; missionGuideCache=null;');
 const field=c.portalFlow();const path=c.portalRoute(p,100);
 if(stage==='cliff'){
  check(field[8*N+4]===32767,'cliff must not produce a fake ground extraction route');
  check(path.length===1,'blocked exit returns no fictitious path through wall');
 }else{
  // Stair levels increase by .22m: road must remain climbable.
  check(field[8*N+4]<32767,'physical .22m stair sequence remains accessible');
  check(path.length>5,'valid stair path is available');
  assertPhysicalRoute(path,'stair step route');
 }
}
console.log(`Stage92 shared physical extraction + mission guidance: ${checks} PASS (Canvas/WebGL, stale caches, equipment, cliffs/stairs)`);

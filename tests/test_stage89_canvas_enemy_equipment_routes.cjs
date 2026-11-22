'use strict';
// Stage89: direct enemy routes must respect the SAME equipment AABBs that
// actually stop the robot's movement, regardless of renderer and world mesh.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;function check(cond,msg){assert.ok(cond,msg);checks++;}
const N=18,empty=()=>Array.from({length:N},()=>Array(N).fill(0));
const c={Math,Number,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 mapSize:N,mapCells:empty(),glReady:false,game:null,mpMatch:null,
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,
 supportHeight:()=>0,collide:()=>false,lineClear:()=>true,isBalconySector:()=>false,
 enemyCrowdAllows:()=>true,enemyBodyHeight:()=>1.68,
 heightCells:[],deckCells:[],worldMesh:null};
vm.createContext(c);
// Load the production terrain/pose helpers on this test's synthetic grid.
const terrainSource=source('03-height-and-collision.js');
if(!c.heightCells?.length)c.heightCells=new Float32Array(N*N);
vm.runInContext(terrainSource.slice(terrainSource.indexOf('function worldTerrainFootprint('),terrainSource.indexOf('function makeStairHeights(')),c);
for(const name of ['04a-static-world-solids.js','13a-enemy-world-navigation.js'])
 vm.runInContext(source(name),c,{filename:name});
const ev=s=>vm.runInContext(s,c);
ev('resetWorldSolids()');
check(/GAME_BUILD='(?:89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'Stage89 release tag');
check(/MP_VERSION=(?:41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'NPC-only patch preserves multiplayer wire protocol');
const start={x:5.5,z:8.5},target={x:11.5,z:8.5};
const across=(kind,gl,mesh)=>{
 c.glReady=gl;
 ev('resetWorldSolids()');
 if(mesh)ev("registerWorldSolid(1,0,1,1.4,2,1.4,'far-away-post')");
 const o={x:8.5,z:8.5,dead:false,used:false,got:false};
 const g={t:10,nodesDestroyed:0,nodes:kind==='node'?[o]:[],
  devices:kind==='equipment'?[o]:[],mission:{type:kind==='archive'?'recovery':'purge',
   caches:kind==='archive'?[o]:[]},enemies:[],p:target};
 c.game=g;
 const robot={id:1,x:start.x,z:start.z,feetY:0,radius:.48,type:'scout',maxhp:100};
 const r=.26;
 check(ev('worldSolidBodyCollision(8.5,8.5,.26,0,1.68)'),
  `the ${kind} body is physically solid`);
 check(!ev('worldSolidBodyCollision(6.5,8.5,.26,0,1.68)'),
  `the ${kind} does not occupy remote space`);
 check(!c.enemyDirectRoute(robot,target),
  `${kind} / gl=${gl} / mesh=${mesh}: NPC falsely takes straight route THROUGH actual hull`);
 check(!c.enemyNavTile(8,8),`${kind}: equipment centre is not a robot's traversable node`);
 // A route BESIDE the hull is physically clear and must not be rejected by
 // a phantom block from the raycast or collision margin.
 robot.z=6.5;robot.navSeenUntil=0;
 const safe={x:11.5,z:6.5};
 check(c.enemyDirectRoute(robot,safe),`${kind}: empty bypass corridor is clear`);
 check(c.enemyNavEdge(6,6,7,6),`${kind}: unobstructed edge stays navigable`);
 // Reactors disappear; the navigation mask AND direct-route cache must update.
 if(kind==='node'){
  robot.x=start.x;robot.z=start.z;robot.navSeenUntil=0;
  check(!c.enemyDirectRoute(robot,target),'intact reactor blocks direct path');
  o.dead=true;g.nodesDestroyed++;
  c.enemyNavMask=null;c.enemyNavEdges=null;
  check(!ev('worldSolidBodyCollision(8.5,8.5,.26,0,1.68)'),
   'destroyed reactor no longer has a physical body');
  check(c.enemyDirectRoute(robot,target),
   'destroyed reactor opens route immediately without a phantom cached blocker');
  check(c.enemyNavTile(8,8),'destroyed reactor no longer closes its tile');
 }
 return 1;
};
let scenarios=0;
for(const gl of [false,true])for(const mesh of [false,true]){
 if(!gl&&mesh)continue;
 for(const kind of ['node','equipment','archive'])scenarios+=across(kind,gl,mesh);
}
// An unrelated reactor across the map must not make every robot on a low-end
// phone run a full swept solid query on every direct-route candidate.
c.glReady=false;ev('resetWorldSolids()');
c.game={t:1,nodes:[{x:15.5,z:15.5,dead:false}],nodesDestroyed:0,
 devices:[],mission:{type:'purge',caches:[]},p:{x:5.5,z:3.5}};
const narrowBot={id:6,x:2.5,z:3.5,feetY:0,radius:.48,type:'scout',maxhp:100};
ev('var stage89ProbeCount=0; var stage89OriginalPathClear=enemyPathClear; enemyPathClear=function(){stage89ProbeCount++;return stage89OriginalPathClear.apply(this,arguments)}');
check(c.enemyDirectRoute(narrowBot,{x:5.5,z:3.5}),
 'far-away equipment cannot invent a phantom obstruction');
check(ev('stage89ProbeCount')===0,
 'safe direct route on a flat Canvas map uses fast broadphase instead of full sampled collision');
ev('enemyPathClear=stage89OriginalPathClear');
// Isolated pre-existing map walls are still respected even without equipment.
for(const gl of [false,true]){
 c.glReady=gl;ev('resetWorldSolids()');
 c.game={t:1,nodes:[],devices:[],mission:{type:'purge',caches:[]},p:target};
 c.lineClear=()=>false;
 check(!c.enemyDirectRoute({id:2,x:5.5,z:8.5,feetY:0,radius:.48,type:'scout',maxhp:100},target),
  'wall tile blocks direct route in both renderers');
 c.lineClear=()=>true;
}
console.log(`Stage89 physical robot direct routes: ${checks} assertions / ${scenarios} real-hull scenarios across Canvas/WebGL: PASS`);

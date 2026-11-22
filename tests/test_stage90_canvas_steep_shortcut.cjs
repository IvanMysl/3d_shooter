'use strict';
// Stage90 regression: Canvas AI must not take direct shortcuts across a tall
// physical stair riser when no dynamic equipment or WebGL mesh is present.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let assertions=0;
function check(ok,msg){assert.ok(ok,msg);assertions++;}
const N=22,grid=Array.from({length:N},()=>Array(N).fill(0));
let ground=()=>0;
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,
 mapSize:N,mapCells:grid,glReady:false,worldSolidGrid:[],worldSolidCount:0,
 game:{t:1,nodesDestroyed:0,nodes:[],devices:[],mission:{type:'purge',caches:[]},enemies:[]},
 mpMatch:null, deckCells:[], floorHeight:(x,z)=>ground(x,z),
 floorHeightAtCell:(x,z)=>ground(x+.5,z+.5),
 supportHeight:(a,x,z)=>ground(x,z),deckAtCell:()=>0,
 collide:()=>false,lineClear:()=>true,isBalconySector:()=>false,
 enemyCrowdAllows:()=>true};
vm.createContext(c);
// Load the production terrain/pose helpers on this test's synthetic grid.
const terrainSource=source('03-height-and-collision.js');
if(!c.heightCells?.length)c.heightCells=new Float32Array(N*N);
vm.runInContext(terrainSource.slice(terrainSource.indexOf('function worldTerrainFootprint('),terrainSource.indexOf('function makeStairHeights(')),c);
for(const name of ['04a-static-world-solids.js','13a-enemy-world-navigation.js'])
 vm.runInContext(source(name),c,{filename:name});
let calls=0;
vm.runInContext('var originalStage90PathClear=enemyPathClear; enemyPathClear=function(...args){ return originalStage90PathClear(...args) }',c);
const bot=(x=4.5,z=10.5,feetY=0)=>({id:2,x,z,feetY,radius:.48,type:'scout'});
const target=(x=15.5,z=10.5)=>({x,z});
for(const glReady of [false,true])for(const staticCount of [0,2]){
 c.glReady=glReady;c.worldSolidCount=staticCount;
 // A two-tread drop is more than a robot's safe .245m step height,
 // even with no walls, nodes, devices or meshes along the straight line.
 ground=(x,z)=>x>=10&&x<12?1.08:0;
 const e=bot(),p=target();
 check(!c.enemyDirectRoute(e,p),`gl=${glReady}, solids=${staticCount}: cliff falsely marked direct`);
 // Fine-grained, actually walkable .215m steps are not fictitious walls.
 ground=(x,z)=>x<8?0:x<9?.215:x<10?.43:x<11?.645:x<12?.86:.86;
 check(c.enemyDirectRoute(bot(),p),`gl=${glReady}, solids=${staticCount}: legal stairs incorrectly closed`);
 // An unrelated cliff off the line cannot block a fully flat corridor.
 ground=(x,z)=>z>=13&&x>=10?1.08:0;
 check(c.enemyDirectRoute(bot(),p),`gl=${glReady}, solids=${staticCount}: distant cliff blocks route`);
 // Tall ascent and descent each require a real winding path.
 ground=(x,z)=>x>=10&&x<12?1.08:0;
 check(!c.enemyDirectRoute(bot(15.5,10.5,0),target(4.5,10.5)),
  `gl=${glReady}, solids=${staticCount}: reverse cliff falsely marked direct`);
}
// A high WALKABLE deck is not a shortcut from the ground immediately below.
for(const glReady of [false,true]){
 c.glReady=glReady;c.worldSolidCount=0;ground=()=>0;
 check(!c.enemyDirectRoute(bot(4.5,10.5,0),{x:15.5,z:10.5,feetY:2.2}),
  `gl=${glReady}: ground walker must use stairs to reach a player on a deck`);
 const flyer={...bot(4.5,10.5,2.2),airborne:true};
 check(c.enemyDirectRoute(flyer,{x:15.5,z:10.5,feetY:2.2}),
  `gl=${glReady}: flying bot at the actual target altitude has an open 3D route`);
}
// Actual upper floor is not the same as the ground below, even if the
// 2D projection is flat. This must never hit the Canvas fast-path.
c.glReady=false;c.worldSolidCount=0;
ground=()=>0;
vm.runInContext('var routeProbeStage90=0; var stage90Original=enemyPathClear; enemyPathClear=function(...args){routeProbeStage90++; return stage90Original(...args)}',c);
check(!c.enemyDirectRoute(bot(4.5,10.5,2.2),target()),
 'upper-level robot must not descend through an invisible 2.2m step');
check(vm.runInContext('routeProbeStage90',c)>0,
 'elevated robot needs a full 3D route check instead of fast Canvas shortcut');
// Ground-level, really flat route should continue using the fast path.
vm.runInContext('routeProbeStage90=0',c);
check(c.enemyDirectRoute(bot(),target()),'flat ground passable');
check(vm.runInContext('routeProbeStage90',c)===0,
 'flat Canvas route should retain its cheap fast path');
console.log(`Stage90 Canvas height-aware NPC shortcuts: ${assertions} assertions: PASS`);

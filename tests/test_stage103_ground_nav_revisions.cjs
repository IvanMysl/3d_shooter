'use strict';
// Stage102's standard ground cache observes the AABB grid reference but not
// its in-place worldSolidCount, and its swept edges skipped the source centre.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const N=15;let checks=0,renders=[];
const check=(v,m)=>{assert.ok(v,m);checks++;};
const c={Math,Number,console,Map,Set,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 touchOnly:false,mapSize:N,mapCells:Array.from({length:N},()=>Array(N).fill(0)),
 glReady:true,game:null,mpMatch:null,worldSolidGrid:[],worldSolidCount:0,
 hypot:Math.hypot,TAU:Math.PI*2,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 save:{settings:{audio:false}},sound:()=>{},burst:()=>{},box:(...args)=>renders.push(args)};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
function reset(){
 c.mapCells=Array.from({length:N},()=>Array(N).fill(0));
 ev(`heightCells=new Float32Array(${N*N});deckCells=new Float32Array(${N*N});
 resetWorldSolids();enemyNavMask=null;enemyNavEdges=null`);
 c.game={p:{x:10.5,z:5.5,feetY:0},nodes:[],devices:[],nodesDestroyed:0,
  mission:{type:'purge'},enemies:[],t:0};
}
reset();
check(c.enemyNavTile(6,5),'open ground centre caches as free');
check(c.enemyNavEdge(5,5,6,5),'open standard ground edge initially traversable');
// SAME bucket array, only count changes. Stage102 still gives a ghost route.
c.worldSolidBox([],6.25,.05,5.25,6.75,2.4,5.75,[1,1,1]);
check(renders.length===1,'actual visible metal registered');
check(c.worldSolidBodyCollision(6.5,5.5,.26,0,1.68),'steel intersects NPC body');
check(!c.enemyNavTile(6,5),'in-place geometry insertion invalidates ground tile cache');
check(!c.enemyNavEdge(5,5,6,5),'in-place geometry insertion invalidates ground edge cache');
c.rebuildNavigation();
check(ev('navFieldWorldCount')===ev('worldSolidCount'),
 'global ground flow tracks the current physical world revision');
check(ev('navFieldEquipment')===c.worldEquipmentGrid(),
 'global ground flow tracks real dynamic equipment');
// Source centre is a physical obstacle, yet previous edge sampled only
// 25%, 50%, 75% and missed this narrow post at 0%.
reset();
c.worldSolidBox([],5.49,.05,5.49,5.51,2,5.51,[1,1,1]);
check(!c.enemyNavEdge(5,5,6,5),'blocked source centre rejects forward edge');
check(!c.enemyNavEdge(6,5,5,5),'blocked source rejects reverse edge');
// A genuine .215m stair remains bidirectional; a 1m jump doesn't.
reset();ev('heightCells[5*mapSize+6]=.215');
check(c.enemyNavEdge(5,5,6,5),'real 21.5cm stair upwards');
check(c.enemyNavEdge(6,5,5,5),'real 21.5cm stair downwards');
ev('heightCells[5*mapSize+6]=1');
check(!c.enemyNavEdge(5,5,6,5),'high riser is not a ground edge');
console.log(`Stage103 standard ground-mask physical revision: ${checks} PASS`);

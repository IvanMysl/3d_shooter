'use strict';
// A destroyed reactor stops occupying its steel AABB immediately. Every NPC
// navigation cache must then release the same cell and its incident edges.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let assertions=0;
function check(ok,msg){assert.ok(ok,msg);assertions++;}
const N=18,tiles=Array.from({length:N},()=>Array(N).fill(0));
const node={x:8.5,z:8.5,dead:false};
const g={t:1,nodes:[node],nodesDestroyed:0,devices:[],enemies:[],mission:{type:'purge',caches:[]},
 p:{x:10.5,z:8.5}};
const c={Math,Number,Map,Set,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 mapSize:N,mapCells:tiles,game:g,mpMatch:null,glReady:false,navField:null,navClock:0,
 worldSolidGrid:[],worldSolidCount:0,heightCells:[],deckCells:[],
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,
 supportHeight:()=>0,collide:()=>false,lineClear:()=>true,isBalconySector:()=>false,
 enemyCrowdAllows:()=>true,clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),hypot:Math.hypot};
vm.createContext(c);
// Load the production terrain/pose helpers on this test's synthetic grid.
const terrainSource=src('03-height-and-collision.js');
if(!c.heightCells?.length)c.heightCells=new Float32Array(N*N);
vm.runInContext(terrainSource.slice(terrainSource.indexOf('function worldTerrainFootprint('),terrainSource.indexOf('function makeStairHeights(')),c);
for(const name of ['04a-static-world-solids.js','13a-enemy-world-navigation.js','13-enemy-navigation-spawn.js'])
 vm.runInContext(src(name),c,{filename:name});
const ev=s=>vm.runInContext(s,c);
const key=8*N+8;
check(c.worldSolidBodyCollision(8.5,8.5,.25,0,1.68),'live steel must block an actor');
check(c.worldEquipmentGrid()===c.worldEquipmentGrid(),
 'non-recovery missions must reuse their unchanged equipment spatial index');
check(!c.enemyNavTile(8,8),'live reactor tile must block the robot');
check(!c.enemyNavEdge(7,8,8,8),'live reactor closes the incoming edge');
const balcony={entry:{x:6,z:8},axis:'x',side:1};
const roof={roofWaypoints:[{x:7.5,z:8.5,y:0}]};
c.rebuildNavigation();
const beforeField=c.navField;
check(beforeField[key]===32767,'ground flow does not enter a live reactor');
const balconyBefore=c.balconyEntranceField(balcony);
const roofBefore=c.roofEntranceField(roof);
check(balconyBefore[key]===32767,'balcony route cannot cross live reactor');
check(roofBefore[key]===32767,'roof approach cannot cross live reactor');
// Actual gameplay sequence: mark the node dead, increment the authoritative
// destroyed count; no manually resetting private caches or map reconstruction.
node.dead=true;g.nodesDestroyed++;
check(!c.worldSolidBodyCollision(8.5,8.5,.25,0,1.68),
 'reactor collider has disappeared from the physics registry');
check(c.enemyNavTile(8,8),
 'STALE TILE: after destruction robot still perceives an invisible solid');
check(c.enemyNavEdge(7,8,8,8),
 'STALE EDGE: after destruction robot still perceives an invisible barrier');
const balconyAfter=c.balconyEntranceField(balcony);
const roofAfter=c.roofEntranceField(roof);
check(balconyAfter!==balconyBefore&&balconyAfter[key]<32767,
 'STALE BALCONY: entrance path remains blocked by destroyed reactor');
check(roofAfter!==roofBefore&&roofAfter[key]<32767,
 'STALE ROOF: approach path remains blocked by destroyed reactor');
c.rebuildNavigation();
check(c.navField[key]<32767,'new player-directed flow traverses the free tile');
check(c.navField[8*N+7]<32767,'approach to reactor location is reachable');
// A second reactor may still block the next tile: invalidation must not
// accidentally turn all equipment into non-colliding decoration.
const live={x:9.5,z:8.5,dead:false};g.nodes.push(live);
check(!c.enemyNavTile(9,8),'adding a live reactor must block its tile');
check(!c.enemyNavEdge(8,8,9,8),'its new edge remains physically closed');
live.dead=true;g.nodesDestroyed++;
check(c.enemyNavTile(9,8),'second destroyed reactor frees its cell');
check(c.enemyNavEdge(8,8,9,8),'second destroyed reactor frees its edge');
// Switching a live mission between recovery and a non-recovery type must
// correctly rebuild an index once, then reuse it until actual composition
// changes. A removed archive must not remain an invisible obstruction.
const noArchiveIndex=c.worldEquipmentGrid();
const cache={x:6.5,z:6.5,got:false};
g.mission={type:'recovery',caches:[cache]};
const recoveryIndex=c.worldEquipmentGrid();
check(recoveryIndex!==noArchiveIndex,'new objective array invalidates index');
check(recoveryIndex===c.worldEquipmentGrid(),'unchanged recovery objective index is stable');
check(c.worldSolidBodyCollision(6.5,6.5,.25,0,1.68),'archive plinth has steel collision');
check(!c.enemyNavTile(6,6),'archive plinth closes its robot tile');
g.mission={type:'purge',caches:[]};
check(c.worldEquipmentGrid()!==recoveryIndex,'mission removing plinths invalidates index');
check(c.worldEquipmentGrid()===c.worldEquipmentGrid(),
 'empty archive list reuses stable identity across all ordinary calls');
check(!c.worldSolidBodyCollision(6.5,6.5,.25,0,1.68),
 'removed plinth no longer has a collider');
check(c.enemyNavTile(6,6),'mission change removes archive ghost tile');
console.log(`Stage91 reactor physical navigation cache: ${assertions} assertions PASS`);

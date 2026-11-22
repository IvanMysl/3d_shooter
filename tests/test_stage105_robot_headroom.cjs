'use strict';
// A robot must be unable to move, spawn, route, or resume inside a ceiling
// lower than its ACTUALLY rendered full-detail hull. Covers software Canvas
// decks as well as the same WebGL mesh AABB.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const N=17,tiles=()=>Array.from({length:N},()=>Array(N).fill(0));
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 mapSize:N,mapCells:tiles(),glReady:false,touchOnly:false,worldSolidGrid:[],worldSolidCount:0,
 game:null,mpMatch:null,sectorStyle:14,worldMapBoss:false,TAU:Math.PI*2,hypot:Math.hypot,
 clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),save:{settings:{audio:false}},
 sound:()=>{},burst:()=>{},toast:()=>{},input:{},arsenalOpened:false,
 box:()=>{},themes:[{accent:[1,1,1]}]};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
function reset(height=2.20){
 c.mapCells=tiles();c.glReady=false;
 ev(`heightCells=new Float32Array(${N*N});deckCells=new Float32Array(${N*N});
  resetWorldSolids();enemyNavMask=null;groundChassisRevision=null;groundChassisCache.clear();`);
 for(let x=6;x<=8;x++)ev(`deckCells[${5*N+x}]=${height}`);
 ev(`bridgeSpecs=[{x:7.5,z:5.5,y:${height}}]`);
 c.game={state:'playing',nodes:[],devices:[],enemies:[],mission:{type:'purge'},nodesDestroyed:0,t:0,
  p:{x:10.5,z:5.5,feetY:0},idCounter:0};
}
const bot=(type,radius,elite=false,feetY=0)=>({x:5.5,z:5.5,feetY,
 type,boss:type==='boss',radius,elite,maxhp:100,airborne:false});
const brute=()=>bot('brute',.69),boss=()=>bot('boss',1.03),scout=()=>bot('scout',.42),elite=()=>bot('brute',.69*1.13,true);
reset();
// Geometry measurements: robotForge body=2.307 for brute, boss=2.627;
// drawEnemyModel scales them to 1.31 / 1.75 respectively. Elite antenna
// rig extends to 2.573 * 1.31. Headroom must contain rigid visible shapes.
check(c.enemyBodyHeight(brute())>=3.02,'full-detail brute height underestimated');
check(c.enemyBodyHeight(boss())>=4.59,'full-detail boss height underestimated');
check(c.enemyBodyHeight(elite())>=3.37,'elite brute antenna/carapace protrusion underestimated');
check(c.enemyBodyHeight(bot('shooter',.52))>=2.34,'visible ordinary humanoid head underestimated');
check(c.enemyBodyHeight(scout())<2.02,'low scout must fit through actual 2.03m opening');
check(c.worldSolidBodyCollision(6.5,5.5,c.enemyBodyRadius(brute()),0,c.enemyBodyHeight(brute())),
 'Canvas overhead slab must physically obstruct tall brute');
check(c.worldSolidBodyCollision(6.5,5.5,c.enemyBodyRadius(boss()),0,c.enemyBodyHeight(boss())),
 'Canvas overhead slab must physically obstruct boss');
check(!c.worldSolidBodyCollision(6.5,5.5,c.enemyBodyRadius(scout()),0,c.enemyBodyHeight(scout())),
 'short scout should legally fit beneath the same 2.2m catwalk');
check(!c.worldSolidBodyCollision(6.5,5.5,.23,0,1.95),
 '1.95m player should legally fit under 2.03m underside');
check(!c.worldSolidBodyCollision(6.5,5.5,c.enemyBodyRadius(boss()),2.2,c.enemyBodyHeight(boss())),
 'deck that SUPPORTS a robot must not be mistaken for an overhead beam');
// Head clearance must apply to the actual XZ microsteps, not only BFS.
let b=brute(),s=scout(),p=c.game.p;
c.tryMoveEntity(b,2.0,0,.30);c.tryMoveEntity(s,2.0,0,.23);
check(b.x<5.9,'big robot physically crawled under too-low Canvas catwalk');
check(s.x>7.0,'small robot was incorrectly blocked from clear underpass');
check(!c.enemyCanOccupy(brute(),6.5,5.5),'large robot occupancy test bypassed low bridge');
check(c.enemyCanOccupy(scout(),6.5,5.5),'small robot occupancy disallows genuine underpass');
check(!c.enemySpawnSpaceClear(6.5,5.5,.50,c.enemyBodyHeight(brute()),0),
 'spawner must not create tall chassis below overhead metal');
check(c.enemySpawnSpaceClear(6.5,5.5,.25,c.enemyBodyHeight(scout()),0),
 'spawner should keep the short robot route open');
check(!c.enemyPathClear(brute(),p.x,p.z),
 '3D direct route crossed lower-than-body catwalk');
check(!c.enemyFlatShortcutSafe(brute(),p),
 'Canvas flat-ground fast path bypasses overhead head clearance');
check(c.enemyFlatShortcutSafe(scout(),p),
 'scout fast path must remain valid with adequate head clearance');
// Ground and upper flow fields use the SAME clearance semantics.
check(!c.groundChassisEdge(5,5,6,5,c.upperDeckProfile(brute()),new Int8Array(N*N*4)),
 'ground BFS directed brute into overhead low bridge');
// WebGL builds the exact physical deck plate. Both modes must agree.
reset();c.glReady=true;
c.worldSolidBox([],6,2.03,5,7,2.20,6,[.3,.3,.3]);
check(c.worldSolidBodyCollision(6.5,5.5,c.enemyBodyRadius(brute()),0,c.enemyBodyHeight(brute())),
 'WebGL metal deck headroom missing');
check(!c.worldSolidBodyCollision(6.5,5.5,c.enemyBodyRadius(scout()),0,c.enemyBodyHeight(scout())),
 'WebGL underpass incorrectly blocks scout');
// A much taller deck is physically open under a non-elite brute.
reset(4.0);
check(!c.worldSolidBodyCollision(6.5,5.5,c.enemyBodyRadius(brute()),0,c.enemyBodyHeight(brute())),
 '4m-deck high underpass incorrectly obstructs brute');
check(c.worldSolidBodyCollision(6.5,5.5,c.enemyBodyRadius(boss()),0,c.enemyBodyHeight(boss())),
 '4m deck should still obstruct a 4.6m boss');
console.log(`Stage105 real robot headroom: ${checks} PASS`);

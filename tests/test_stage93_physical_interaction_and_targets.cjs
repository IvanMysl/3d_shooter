'use strict';
// Stage93: real line-of-sight for interactions and graph-aware target choice.
// This test intentionally fails on Stage92, which charges devices through
// real rails and chooses physically distant targets by Euclidean distance.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=process.env.BASELINE_ROOT||path.resolve(__dirname,'..');
const source=f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8');
const N=17;
let checks=0;const check=(ok,why)=>{assert.ok(ok,why);checks++;};
const grid=Array.from({length:N},()=>Array(N).fill(0));
const c={Math,console,Number,Set,Map,Int8Array,Int16Array,Int32Array,Float32Array,Uint8Array,
 mapSize:N,mapCells:grid,worldSolidGrid:[],worldSolidCount:0,worldSolidIndexed:0,
 glReady:true,touchOnly:false,mpMatch:null,game:null,spawnX:5.5,spawnZ:7.5,
 heightCells:[],deckCells:[],floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,
 ceilingHeight:()=>4,collide:()=>false, isWall:(x,z)=>grid[Math.floor(z)]?.[Math.floor(x)]===1,
 lineClear:()=>true,hypot:Math.hypot,distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),save:{credits:0,settings:{quality:0}},
 toast:()=>{},sound:()=>{},saveRun:()=>{},burst:()=>{},damagePlayer:()=>{},
 input:{jumpQueued:false}};
vm.createContext(c);
// Load the actual Stage111 standing-pose and terrain helpers rather than
// replacing real support with the old flat-field fixture stubs.
const terrainSource=source('03-height-and-collision.js');
c.heightCells=new Float32Array(N*N);
vm.runInContext(terrainSource.slice(terrainSource.indexOf('function worldTerrainFootprint('),terrainSource.indexOf('function makeStairHeights(')),c);
for(const f of ['04a-static-world-solids.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])vm.runInContext(source(f),c,{filename:f});
const ev=x=>vm.runInContext(x,c);
const player={x:7.1,z:7.5,feetY:0,grounded:true,shield:0,maxhp:100,hp:50,armor:20,maxArmor:100,
 bodyArmor:0,bodyArmorMax:100,energy:20,maxEnergy:100};
const dev={id:1,x:8.1,z:7.5,used:false,kind:'relay',charge:0,phase:0,cooldown:0};
const mission={version:2,type:'relay',routeMode:'free',routeOrder:[],done:0,required:1,caches:[]};
const g={state:'playing',sector:14,p:player,mission,nodes:[],nodesDestroyed:0,devices:[dev],enemies:[],
 t:0,score:0,portalReady:false,spawned:0,target:4};c.game=g;
// Install a 6-cm-thick real WebGL rail; its top is above a human hand.
c.registerWorldSolid(7.46,.15,7.25,7.52,1.28,7.75,'steel-rail');
check(!c.worldSolidBodyCollision(player.x,player.z,.23,0,1.7),'start must not overlap railing');
check(c.worldSolidStats().boxes===1,'rail is a real registered visual/physical mesh');
check(Math.hypot(player.x-dev.x,player.z-dev.z)<1.25,'player within old activation radius');
for(let i=0;i<3;i++)c.updateDevices(.16);
check(dev.charge===0&&!dev.used,'cannot activate a relay THROUGH the real solid rail');
// With the same steel housing but the separator removed, the relay works.
c.resetWorldSolids();
for(let i=0;i<6&&!dev.used;i++)c.updateDevices(.16);
check(dev.used&&mission.done===1,'unobstructed relay activates normally');
// Archive pickup must use the same real collision rules, including order.
const crystal={id:0,x:8.1,z:7.5,got:false};
g.mission={version:2,type:'recovery',routeMode:'free',routeOrder:[],caches:[crystal],done:0,required:1};
g.devices=[];c.registerWorldSolid(7.46,.15,7.25,7.52,1.28,7.75,'steel-rail');
for(let i=0;i<3;i++)c.updateMission(.05);
check(!crystal.got&&g.mission.done===0,'archive cannot be collected through real rail');
c.resetWorldSolids();c.updateMission(.05);
check(crystal.got&&g.mission.done===1,'archive reachable once physical obstruction disappears');
// Portal/mission flow must not choose a neighbour with a rail between its
// face and the mission goal even if that neighbour's CELL itself is free.
g.mission={version:2,type:'relay',routeMode:'free',routeOrder:[],caches:[],done:0,required:1};
dev.used=false;dev.charge=0;const probeDev={...dev,x:8.5};g.devices=[probeDev];
c.resetWorldSolids();c.registerWorldSolid(7.80,.15,7.25,7.86,1.28,7.75,'thin-bar');
const x=7,z=7;
check(c.enemyNavTile(x,z),'neighbour cell remains free');
check(!c.missionInteractionClear({x:7.5,z:7.5,feetY:0},probeDev),'thin rail blocks physical approach');
const field=c.missionField(probeDev);
check(field[z*N+x]!==0,'mission guide must not seed an inaccessible side of steel housing');
// Graph-distance target choice: one target is 3m away through a long maze,
// another is 4m away but has an open direct corridor.
c.resetWorldSolids();g.devices=[];
for(let z=1;z<N-1;z++)if(z!==13)grid[z][8]=1;
player.x=6.5;player.z=5.5;
const nearButBehind={x:9.5,z:5.5,dead:false,type:0},farButAccessible={x:4.5,z:9.5,dead:false,type:1};
g.nodes=[nearButBehind,farButAccessible,{x:12.5,z:14.5,dead:false,type:1}];g.nodesDestroyed=0;
g.mission={type:'sabotage',done:0,required:2,routeMode:'free',caches:[]};
check(Math.hypot(player.x-nearButBehind.x,player.z-nearButBehind.z)<
 Math.hypot(player.x-farButAccessible.x,player.z-farButAccessible.z),
 'Euclidean choice is deliberately the WRONG target');
check(c.missionWaypoint(g)===farButAccessible,
 'HUD must choose the shorter REAL route, not straight-line distance through wall');
const cache=ev('missionWaypointGroundCache?.field');
check(cache&&c.missionWaypoint(g)===farButAccessible,'repeated target choice should reuse graph cache');
check(ev('missionWaypointGroundCache?.field')===cache,'no needless BFS when the operator remains in the same cell');
// Destroying a reactor changes the true route graph even if the node array
// and physical map retain their old identities. Never reuse a stale field.
nearButBehind.dead=true;g.nodesDestroyed++;
c.missionWaypoint(g);
check(ev('missionWaypointGroundCache?.field')!==cache,'reactor destruction invalidates target route field');
console.log(`Stage93 physical interaction + graph-aware targeting: ${checks} PASS (rail, relay, archive, blocked approach, stale route, real detour)`);

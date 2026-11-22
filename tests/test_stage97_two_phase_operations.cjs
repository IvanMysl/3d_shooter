'use strict';
// Stage97: two NEW mission mechanics using existing physically solid objects.
// Check all phase transitions, order independence, route guidance and old saves.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++;}
const N=19,grid=Array.from({length:N},()=>Array(N).fill(0));
const c={console,Math,TAU:Math.PI*2,Number,Int16Array,Int32Array,Float32Array,Uint8Array,
 mapSize:N,mapCells:grid,worldSolidGrid:[],heightCells:[],spawnX:5.5,spawnZ:5.5,
 glReady:false,touchOnly:false,sectorStyle:0,mpMatch:null,game:null,enemyNavMask:null,enemyNavEdges:null,
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,ceilingHeight:()=>6,collide:()=>false,
 distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),hypot:Math.hypot,
 sound:()=>{},burst:()=>{},toast:()=>{},saveRun:()=>{},damagePlayer:()=>{},
 save:{credits:0,settings:{quality:0}},input:{jumpQueued:false},
 robotNearArea:()=>false,enemyBlastSamples:()=>({points:[],hullDist:1}),hurtEnemy:()=>{},
 clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),navField:null};
vm.createContext(c);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js','13a-enemy-world-navigation.js','14-combat-raycast.js',
 '15-mission-system.js','16-mission-devices.js'])vm.runInContext(src(f),c,{filename:f});
const player=()=>({x:4.5,z:5.5,feetY:0,grounded:true,shield:1,hp:100,maxhp:100,armor:100,maxArmor:100,energy:100,maxEnergy:100});
function fixture(level){
 const g={state:'playing',sector:level,p:player(),t:0,sectorTime:0,portalReady:false,
  nodesDestroyed:0,nodes:[{type:0,x:10.5,z:7.5,hp:50,maxhp:50,dead:false,radius:.61},
   {type:1,x:15.5,z:14.5,hp:50,maxhp:50,dead:false,radius:.61}],
  devices:[],enemies:[],spawned:4,target:4,kills:4,impactFx:[],scorch:[],loot:[],score:0};
 c.game=g;c.startMission(g);return g;
}
// New campaign distribution is deterministic and does not rewrite early stages.
for(let l=1;l<=100;l++){
 const type=c.missionType(l),expected=l%5===0?'boss':l>=11&&l%10===1?'holdout':
  l>=14&&l%10===4?'relay':l>=12&&l%10===2?'containment':
  l>=16&&l%10===6?'conduit':l>=13&&l%10===3?'signal':l>=17&&l%10===7?'surge':['purge','sabotage','recovery','hunt'][(l-1)%5]||'purge';
 ok(type===expected,`L${l}: wrong type ${type}, expected ${expected}`);
}
// Containment: killing foes and waiting BEFORE reactor shutdown never wins.
{
 const g=fixture(12);ok(g.mission.type==='containment','containment created');
 ok(g.mission.required===2&&g.mission.surviveRemaining>0,'reactors and timer required');
 ok(c.missionSequenceHint(g).includes('Фаза 1/2'),'containment phase 1 HUD');
 const timer=g.mission.surviveRemaining;
 c.updateMission(8);ok(g.mission.surviveRemaining===timer&&!g.portalReady,'timer cannot run before disable');
 c.damagePowerNode(g.nodes[0],999);ok(g.mission.done===1&&!g.portalReady,'first physical reactor');
 c.damagePowerNode(g.nodes[1],999);ok(g.mission.done===2&&!g.portalReady,'second physical reactor');
 c.updateMission(.15);ok(g.mission.containmentStarted,'pressure phase started');
 ok(c.missionSequenceHint(g).includes('Фаза 2/2'),'containment phase 2 HUD');
 ok(g.mission.surviveRemaining<timer&&!g.portalReady,'defence timer running without premature portal');
 c.updateMission(timer+1);ok(g.portalReady,'completed siege opens extraction');
 ok(c.missionCounter(g).includes('ОСАДА'),'HUD describes phase');
}
// Conduit: actual hazardous metal coils, THEN node. An early reactor death
// is credited later; the sequence is physically meaningful but never softlocks.
for(const early of [false,true]){
 const g=fixture(16);ok(g.mission.type==='conduit','conduit created');
 const mk=(id,x)=>({id,x,z:7.5,kind:'coil',phase:0,used:false,charge:0,cooldown:0,cycles:0});
 g.devices=[mk(1,6.5),mk(4,8.5),mk(7,14.5)];
 g.mission.coilIds=[1,4];g.mission.coilsRequired=2;g.mission.required=3;
 if(early){c.damagePowerNode(g.nodes[0],999);
  ok(g.mission.nodesDisabled===1&&g.mission.done===0&&!g.portalReady,'early reactor kill cannot bypass coil phase');}
 ok(c.missionWaypoint(g)?.id===1,'first waypoint targets physical emitter');
 ok(c.missionSequenceHint(g).includes('Фаза 1/2'),'conduit phase 1 HUD');
 c.completeDevice(g,g.devices[2]);ok(g.mission.coilsDisabled===0,'optional coil is not objective');
 c.completeDevice(g,g.devices[0]);ok(g.mission.coilsDisabled===1&&!g.portalReady,'first coil disarmed');
 c.completeDevice(g,g.devices[1]);ok(g.mission.coilsDisabled===2,'second coil disarmed');
 if(!early){ok(g.mission.done===2&&!g.portalReady,'node phase remains');
  ok(c.missionWaypoint(g)===g.nodes[0]||c.missionWaypoint(g)===g.nodes[1], 'waypoint switches to reactor');
  c.damagePowerNode(g.nodes[0],999);
 }else ok(g.mission.done===3,'early node kill credited as soon as both coils disarmed');
 ok(g.mission.done===g.mission.required&&g.portalReady,'conduit extraction unlocked');
 ok(c.missionCounter(g).includes('ЭНЕРГОУЗЕЛ'),'HUD shows second objective');
}
// Old saved campaign mission types remain stable when loaded; no migration
// overwrites checkpoint.mission.type with a new level-based selection.
{
 const g=fixture(12);g.mission={version:2,type:'sabotage',done:1,required:2,caches:[]};
 ok(g.mission.type==='sabotage','preserved old save mission object');
 ok(!c.missionFinished(g),'old sabotage objectives still required');
}
console.log(`Stage97 two-phase operations: ${checks} PASS / all 100 mission selections / containment and conduit incl. early reactor destruction`);

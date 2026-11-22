'use strict';
// Stage97: two NEW mission mechanics using existing physically solid objects.
// Check all phase transitions, order independence, route guidance and old saves.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++;}
const N=19,grid=Array.from({length:N},()=>Array(N).fill(0));
const c={console,Math,TAU:Math.PI*2,Number,Int16Array,Int32Array,Float32Array,Uint8Array,
 mapSize:N,mapCells:grid,worldSolidGrid:[],heightCells:[],spawnX:5.5,spawnZ:5.5,
 glReady:false,touchOnly:false,mpMatch:null,game:null,enemyNavMask:null,enemyNavEdges:null,
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,ceilingHeight:()=>6,collide:()=>false,
 distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),hypot:Math.hypot,
 sound:()=>{},burst:()=>{},toast:()=>{},saveRun:()=>{},damagePlayer:()=>{},
 save:{credits:0,settings:{quality:0}},input:{jumpQueued:false},
 robotNearArea:()=>false,enemyBlastSamples:()=>({points:[],hullDist:1}),hurtEnemy:()=>{},
 clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),navField:null};
vm.createContext(c);
for(const f of ['04a-static-world-solids.js','13a-enemy-world-navigation.js','14-combat-raycast.js',
 '15-mission-system.js','16-mission-devices.js'])vm.runInContext(src(f),c,{filename:f});
const player=()=>({x:4.5,z:5.5,feetY:0,grounded:true,shield:1,hp:100,maxhp:100,armor:100,maxArmor:100,energy:100,maxEnergy:100});
function fixture(level){
 const g={state:'playing',sector:level,p:player(),t:0,sectorTime:0,portalReady:false,
  nodesDestroyed:0,nodes:[{type:0,x:10.5,z:7.5,hp:50,maxhp:50,dead:false,radius:.61},
   {type:1,x:15.5,z:14.5,hp:50,maxhp:50,dead:false,radius:.61}],
  devices:[],enemies:[],spawned:4,target:4,kills:4,impactFx:[],scorch:[],loot:[],score:0};
 c.game=g;c.startMission(g);return g;
}

for(let l=1;l<=100;l++){
 const expected=l%5===0?'boss':l>=11&&l%10===1?'holdout':l>=14&&l%10===4?'relay':
 l>=12&&l%10===2?'containment':l>=16&&l%10===6?'conduit':l>=13&&l%10===3?'signal':
 l>=17&&l%10===7?'surge':['purge','sabotage','recovery','hunt'][(l-1)%5]||'purge';
 ok(c.missionType(l)===expected,'L'+l+' must preserve canonical type distribution');
}
// Signal: physical power-station scans unlock a REAL commander fight.
// Commander may die first (a violent encounter cannot become a soft-lock).
for(const early of [false,true]){
 const g=fixture(13);ok(g.mission.type==='signal','signal mission instantiated');
 const a={id:1,kind:'battery',x:7.5,z:9.5,used:false,charge:0};
 const b={id:2,kind:'battery',x:11.5,z:9.5,used:false,charge:0};
 g.devices=[a,b];g.mission.signalIds=[1,2];g.mission.signalRequired=2;
 g.mission.required=3;c.missionRefreshCombinedProgress(g.mission);
 ok(c.missionSequenceHint(g).includes('Фаза 1/2'),'scan phase hint');
 if(early){g.mission.commanderKilled=true;c.missionRefreshCombinedProgress(g.mission);
  ok(!g.portalReady&&g.mission.done===0,'early commander cannot skip physical stations');}
 c.completeDevice(g,a);ok(g.mission.signalDone===1&&g.mission.done===1,'first station counts');
 c.completeDevice(g,b);ok(g.mission.signalDone===2&&g.mission.done===(early?3:2),'second station counts');
 ok(c.missionSequenceHint(g).includes('Фаза 2/2'),'commander phase hint');
 if(!early){g.mission.commanderKilled=true;c.missionRefreshCombinedProgress(g.mission);}
 c.maybeFinishMission(g);ok(g.portalReady&&g.mission.done===3,'signal success only after commander and stations');
}
// Surge: repeatable resonance timing with realistic no-softlock: dead nodes
// never respawn; the SAME physical energy station can be re-armed after lapse.
for(const early of [false,true]){
 const g=fixture(17);ok(g.mission.type==='surge','surge mission instantiated');
 const battery={id:1,kind:'battery',x:7.5,z:9.5,used:false,charge:0};
 g.devices=[battery];g.mission.surgeIds=[1];g.mission.surgeRequired=1;
 g.mission.required=3;
 if(early){c.damagePowerNode(g.nodes[0],999);
  ok(g.mission.nodesDisabled===1&&g.mission.done===1&&!g.portalReady,'early reactor persists before charging');}
 ok(c.missionSequenceHint(g).includes('Фаза 1/2'),'surge first phase');
 c.completeDevice(g,battery);ok(g.mission.surgeReady&&g.mission.surgeRemaining>0,'battery creates active window');
 ok(c.missionSequenceHint(g).includes('Фаза 2/2'),'surge second phase');
 const originalRemaining=g.mission.surgeRemaining;
 c.updateMission(2);ok(g.mission.surgeRemaining<originalRemaining,'real timer counts');
 c.updateMission(100);
 ok(!g.mission.surgeReady&&!battery.used&&!g.portalReady,'timer resets physical battery, not reactors');
 ok(g.mission.nodesDisabled===(early?1:0),'expired phase retains destroyed reactor');
 const score=g.score;
 c.completeDevice(g,battery);ok(g.mission.surgeReady&&battery.used,'physical battery can recharge');
 ok(g.score===score,'repeatable window must not farm station score');
 for(const n of g.nodes.filter(n=>!n.dead))c.damagePowerNode(n,n.hp+1);
 ok(g.mission.done===g.mission.required&&g.portalReady,'two real cores plus battery unlock portal');
}
// Destroying BOTH reactors before any recharge cannot bypass the real
// terminal prerequisite, and also cannot strand the mission permanently.
{
 const g=fixture(17),d={id:1,kind:'battery',x:8.5,z:9.5,used:false,charge:0};
 g.devices=[d];g.mission.surgeIds=[1];g.mission.surgeRequired=1;g.mission.required=3;
 for(const n of g.nodes)c.damagePowerNode(n,999);
 ok(g.mission.nodesDisabled===2&&g.mission.done===2&&!g.portalReady,
  'early destruction of both metal cores cannot bypass the battery');
 c.completeDevice(g,d);
 ok(g.mission.done===3&&g.portalReady,'late battery recharging correctly finishes early cores');
}
// A cramped legacy level that cannot place a battery never deadlocks.
{
 const g=fixture(17);g.mission.surgeIds=[];g.mission.surgeRequired=0;
 g.mission.required=2;g.mission.surgeReady=true;c.missionRefreshCombinedProgress(g.mission);
 c.updateMission(80);ok(g.mission.surgeReady,'missing terminal cannot expire a nonexistent recharge window');
 for(const n of g.nodes)c.damagePowerNode(n,999);
 ok(g.portalReady,'no physical battery -> adaptive sabotage fallback');
}
console.log(`Stage98 signal+surge synthetic: ${checks} assertions PASS`);

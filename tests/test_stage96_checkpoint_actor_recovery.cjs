'use strict';
// Stage96 checkpoint regression: exact production restore + world AABBs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++};
const N=28,mapCells=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>
 x===0||z===0||x===N-1||z===N-1?1:0));
const c={Math,Number,Array,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 mapSize:N,mapCells,glReady:true,sectorStyle:0,worldMapBoss:false,
 save:{perms:Array(12).fill(0),settings:{quality:2,audio:false}},
 weapons:Array.from({length:10},()=>({name:'weapon'})),
 spawnX:8.5,spawnZ:8.5,sectorArchitecture:'CHECKPOINT TEST',
 PLAYER_SOLID_HEIGHT:1.95,PERM_MAX_LEVEL:40,DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,
 '$':()=>({style:{},dataset:{},textContent:''}),
 equippedArmorStats:()=>({id:-1,maxDurability:0,reduction:0,wear:1}),
 toast:()=>{},sound:()=>{},input:{jumpQueued:false},
 navField:null,navClock:0,game:null,
};
vm.createContext(c);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js',
  '13a-enemy-world-navigation.js','13-enemy-navigation-spawn.js'])
 vm.runInContext(src(f),c,{filename:f});
const arsenal=src('12-arsenal-and-game.js');
vm.runInContext(arsenal.slice(arsenal.indexOf('const PERM_COMPOUND='),arsenal.indexOf('function newPlayer(')),c);
const checkpoint=src('20-minimap-and-checkpoint.js');
vm.runInContext(checkpoint.slice(checkpoint.indexOf('function restoreLiveCheckpoint('),
 checkpoint.indexOf('// Auto-save during combat')),c);
const player=(x=8.5,z=8.5,feetY=0)=>({x,z,feetY,maxhp:100,hp:92,maxArmor:30,armor:25,
 maxEnergy:100,energy:82,regen:16,damage:1,weapon:0,dashRange:2.52,shieldDuration:3.5,
 abilityCooldowns:{},grounded:true,flying:false,vy:0});
const robot=(id,type,x,z,feetY=0)=>({id,type,x,z,feetY,boss:type==='boss',
 radius:type==='boss'?1.03:type==='brute'?.69:type==='drone'?.48:.42,
 airborne:type==='drone',dead:false,hp:10+id,maxhp:100,
 attack:id*.037,protection:4,elite:id===7});
const init=(enemyList,opts={})=>{
 c.resetWorldSolids();if(opts.static!==false)c.registerWorldSolid(12,0.10,12,14,2.5,14,'solid-steel');
 const g={state:'playing',sector:opts.sector||6,p:player(),t:0,target:10,
  spawned:opts.spawned??enemyList.length,waveDelay:2,enemies:[],bullets:[],tracers:[],projectiles:[],
  burstQueue:[],loot:[],nodes:opts.nodes||[{x:16,z:16,dead:false}],nodesDestroyed:0,
  devices:[],robotDebris:[],portalReady:false,mission:{version:2,type:'hunt',sentinelId:2,caches:[]},
  idCounter:100,upgrades:{},appliedPerms:Array(12).fill(0)};
 c.game=g;
 const ck={version:4,state:'playing',sector:g.sector,equipmentPhysicsVersion:1,
  archivePlinthVersion:1,permanentFormula:'compound-v2',barrierFormula:'compound-v2',
  shieldRechargeModel:'after-duration-5s',permanentLevels:Array(12).fill(0),
  player:player(opts.playerX??8.5,opts.playerZ??8.5,opts.playerY??0),
  live:{enemies:enemyList,nodes:g.nodes,devices:[],mission:g.mission,
   spawned:g.spawned,target:g.target,waveDelay:g.waveDelay,sectorTime:3,t:10,nodesDestroyed:0}};
 c.restoreLiveCheckpoint(ck);return {g,ck};
};
// Actors inside new geometric metal, inside a live reactor, and inside EACH OTHER.
let {g}=init([robot(1,'brute',12.9,12.9),robot(2,'scout',12.9,12.9),
 robot(3,'boss',16,16),robot(4,'drone',19,19,.13)],{playerX:16,playerZ:16});
check(g.enemies.length===4,'valid enemies vanished despite available safe map');
check(g.boss?.id===3,'boss handle lost during checkpoint repair');
check(g.mission.sentinelId===2,'mission commander id changed');
check(!c.worldSolidBodyCollision(g.p.x,g.p.z,.23,g.p.feetY,c.PLAYER_SOLID_HEIGHT),
 'player remains embedded in restored reactor');
for(const e of g.enemies){
 check(!c.collide(e.x,e.z,c.enemyBodyRadius(e)),`robot ${e.id} in wall`);
 check(!c.worldSolidBodyCollision(e.x,e.z,c.enemyBodyRadius(e),e.feetY,c.enemyBodyHeight(e)),
  `robot ${e.id} in physical steel`);
 check(e.hp===10+e.id&&Math.abs(e.attack-e.id*.037)<1e-8,`robot ${e.id} combat data changed`);
}
for(let i=0;i<g.enemies.length;i++)for(let j=0;j<i;j++){
 const a=g.enemies[i],b=g.enemies[j],vertical=a.feetY<b.feetY+c.enemyBodyHeight(b)-.03&&
  b.feetY<a.feetY+c.enemyBodyHeight(a)-.03;
 if(vertical)check(Math.hypot(a.x-b.x,a.z-b.z)>=
  c.enemyCrowdRadius(a)+c.enemyCrowdRadius(b)-.005,'saved NPCs remain overlapped');
}
check(g.enemies.find(e=>e.id===4).x===19,'valid drone was needlessly moved');
check(g.idCounter>=4,'loaded actor IDs not reserved in counter');
// A formerly valid enemy in close MELEE range should not be moved merely
// because the new-spawn safety buffer is intentionally larger than the body.
({g}=init([robot(7,'scout',9.35,8.5)],{nodes:[],static:false}));
check(Math.abs(g.enemies[0].x-9.35)<1e-9,'legal close-range saved enemy relocated');
// A flying legacy frame beneath a steel deck can be lowered rather than
// teleported across the map; save the original HP, attack and identity.
c.resetWorldSolids();
({g}=init([robot(8,'drone',11,11,.8)],{nodes:[],static:false}));
c.registerWorldSolid(10,2.20,10,13,2.4,13,'bridge');
// Fresh restore with the real bridge already registered.
const oldRegister=c.registerWorldSolid;
c.resetWorldSolids();c.registerWorldSolid(10,2.20,10,13,2.4,13,'bridge');
const preserved=g.enemies[0];
g.enemies=[];const drone={...preserved,x:11,z:11,feetY:.8};
const oldRestore=c.restoreLiveCheckpoint;
// Reconstruct the checkpoint with the bridge still in the physical index.
const savedDrone={version:4,permanentFormula:'compound-v2',barrierFormula:'compound-v2',
 shieldRechargeModel:'after-duration-5s',equipmentPhysicsVersion:1,
 permanentLevels:Array(12).fill(0),player:player(),live:{enemies:[drone],nodes:[],devices:[],
 mission:{version:2,type:'purge',caches:[]},spawned:1,target:1}};
c.restoreLiveCheckpoint(savedDrone);
check(g.enemies.length===1&&g.enemies[0].id===8,'legacy drone disappeared');
check(g.enemies[0].feetY<.3,'legacy drone not moved below bridge');
// No physically free tile -> drop impossible actor, retry safely on next wave.
for(let z=0;z<N;z++)for(let x=0;x<N;x++)mapCells[z][x]=1;
mapCells[8][8]=0;
({g}=init([robot(2,'brute',12.5,12.5)],{nodes:[],static:false,spawned:1}));
check(g.enemies.length===0,'impossible enemy persisted in solid wall');
check(g.spawned===0&&g.waveDelay<=.6,'missing wave slot not released for retry');
check(g.mission.sentinelId===0,'missing mission sentinel remained locked');
// Boss waves must reset their single spawn slot if the boss cannot fit.
({g}=init([robot(5,'boss',12.5,12.5)],{nodes:[],static:false,spawned:1,sector:5}));
check(!g.boss&&g.enemies.length===0&&g.spawned===0,'impossible boss softlocked its sector');
// Return to a normal map for the independent player-elevation regression.
for(let z=0;z<N;z++)for(let x=0;x<N;x++)mapCells[z][x]=x===0||z===0||x===N-1||z===N-1?1:0;
mapCells[20][20]=1;
({g}=init([],{nodes:[],static:false,playerX:20.5,playerZ:20.5,playerY:2.2}));
check(g.p.x===c.spawnX&&g.p.z===c.spawnZ&&g.p.feetY===c.floorHeight(c.spawnX,c.spawnZ),
 'blocked checkpoint player kept roof altitude at ground spawn');
console.log(`Stage96 checkpoint body recovery ${checks} assertions PASS`);

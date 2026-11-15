// STAGE 11 — live actors must never be CREATED in another actor's physical volume.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const N=25;
const open=()=>Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>x===0||z===0||x===N-1||z===N-1?1:0));
const game={p:{x:2.5,z:2.5,feetY:0},enemies:[],sector:2,spawned:0,target:10,waveDelay:0,idCounter:0,portalReady:false};
let seed=15;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const math=Object.create(Math);math.random=rand;
const c={console,Math:math,Number,Array,Map,Set,Int8Array,Int16Array,Float32Array,
 mapSize:N,mapCells:open(),game,glReady:false,worldSolidCount:0,navField:null,
 sectorStyle:0,TAU:Math.PI*2,clamp:(x,lo,hi)=>Math.min(hi,Math.max(lo,x)),hypot:Math.hypot,
 rand:(lo,hi)=>lo+rand()*(hi-lo),pick:arr=>arr[0],themes:[{accent:[1,0,1]}],save:{settings:{audio:false}},
 input:{jumpQueued:false},portal:{x:11.5,z:11.5},
 sound:()=>{},toast:()=>{},'$':()=>({style:{}})};
vm.createContext(c);
vm.runInContext(src('03-height-and-collision.js')+src('04a-static-world-solids.js')+
 src('13-enemy-navigation-spawn.js')+src('13a-enemy-world-navigation.js')+
 src('12-arsenal-and-game.js'),c);
// Restrict geometry to the test's explicit tile mask. Other nav functions
// remain real, so the NPC separation radius is the shipping algorithm.
c.floorHeight=()=>0;
c.collide=(x,z,r)=>!Number.isFinite(x)||!Number.isFinite(z)||x<1||z<1||x>=N-1||z>=N-1||
 !!c.mapCells[Math.floor(z)]?.[Math.floor(x)];
c.lineClear=()=>true;
c.worldSolidBodyCollision=()=>false;
let checks=0;function check(condition,message){assert.ok(condition,message);checks++;}
const bot=(x,z,id,extra={})=>({x,z,feetY:0,id,radius:.52,type:'brute',dead:false,...extra});
const reset=()=>{game.enemies=[];game.p={x:2.5,z:2.5,feetY:0};game.sector=2;game.spawned=0;game.target=12;game.waveDelay=0;game.idCounter=0;game.portalReady=false;c.mapCells=open();};
reset();
const enemy=bot(10.5,10.5,1);game.enemies.push(enemy);
check(!c.enemySpawnSpaceClear(10.5,10.5,.50,1.9),'same-position enemy spawn accepted');
check(!c.enemySpawnSpaceClear(11.1,10.5,.50,1.9),'overlapping enemy spawn accepted');
check(c.enemySpawnSpaceClear(12.5,10.5,.50,1.9),'valid distance rejected');
check(c.enemySpawnSpaceClear(10.5,10.5,.50,1.9)===false,'overlap persistence');
enemy.dead=true;
check(c.enemySpawnSpaceClear(10.5,10.5,.50,1.9),'dead enemy should not block spawning');
enemy.dead=false;enemy.feetY=3.2;
check(c.enemySpawnSpaceClear(10.5,10.5,.50,1.9),'overhead enemy blocks a different floor');
enemy.feetY=0;
check(!c.enemySpawnSpaceClear(2.5,2.5,.48,1.9),'cannot spawn within player');
check(!c.enemySpawnSpaceClear(-1,5,.48,1.9),'outside world spawn accepted');
check(!c.enemySpawnSpaceClear(NaN,5,.48,1.9),'NaN spawn accepted');
// The direct random placement and real spawnEnemy() must respect separation.
reset();
for(let k=0;k<14;k++){
 const robot=c.spawnEnemy('scout',false);
 check(robot!==null,`ordinary map failed to place ${k}th robot`);
 for(const other of game.enemies){
  if(other===robot)continue;
  const d=Math.hypot(robot.x-other.x,robot.z-other.z);
  check(d>=c.enemyCrowdRadius(robot)+c.enemyCrowdRadius(other)-1e-6,
    `robot ${robot.id} spawned overlapping robot ${other.id}: ${d}`);
 }
 check(Math.hypot(robot.x-game.p.x,robot.z-game.p.z)>=5.9,'spawn too close to player');
}
// A hostile PRNG can repeatedly pick occupied points. Deterministic fallback
// must find a genuine free tile rather than placing at an unsafe portal.
reset();const forced=Object.create(Math);forced.random=()=>.25;c.Math=forced;
for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++)c.mapCells[z][x]=1;
for(const [x,z] of [[10,10],[11,10],[12,10]])c.mapCells[z][x]=0;
game.enemies=[bot(10.5,10.5,100),bot(11.5,10.5,101)];
const fallback=c.randFloor(6,.48,1.9);
check(fallback!==null,'fallback did not find an available cell');
check(Math.floor(fallback.x)===12,'fallback chose occupied/blocked tile');
check(c.enemySpawnSpaceClear(fallback.x,fallback.z,.48,1.9),'fallback overlap');
// Filling the only free cell must return null instead of teleporting into
// the portal, a wall, an actor or the player.
game.enemies.push(bot(12.5,10.5,102));
check(c.randFloor(6,.48,1.9)===null,'no-free-space map yielded unsafe spawn');
check(c.spawnEnemy('scout',false)===null,'spawnEnemy failed to defer unsafe spawn');
// Wave retries MUST NOT count enemies or make impossible missions unfinishable.
game.spawned=3;game.waveDelay=0;game.target=8;
c.spawnWave(.1);
check(game.spawned===3,'blocked wave incorrectly counted an enemy');
check(game.waveDelay>0,'blocked wave did not schedule retry');
game.sector=5;game.spawned=0;game.waveDelay=0;
c.spawnWave(.1);
check(game.spawned===0,'blocked boss wave counted a phantom boss');
check(game.waveDelay>0,'blocked boss wave did not retry');
// Reopening a tile allows the queued wave to continue normally.
game.sector=2;game.enemies.pop();game.waveDelay=0;
const before=game.enemies.length;c.spawnWave(.1);
check(game.enemies.length===before+1,'queued wave did not resume after room cleared');
check(game.spawned===1,'queued wave failed to increment actual spawning');
console.log(`STAGE11 SPAWN SAFETY: ${checks} assertions; separation, floors, retry, fallback and normal spawning`);

'use strict';
// Stage 15 integration: actual flight AI, world solidity, spawning, weapons,
// navigation and the exact aerial hit proxies. No graphics driver required.
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let count=0;
function check(ok,message){assert.ok(ok,message);count++;}
function near(a,b,eps,message){check(Math.abs(a-b)<=eps,`${message}: ${a} vs ${b}`);}
const N=30,cells=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>
 x===0||z===0||x===N-1||z===N-1?1:0));
const player={x:18,z:15,feetY:0,slowBullets:1,grounded:true};
const game={p:player,state:'playing',enemies:[],bullets:[],nodes:[],t:0,sector:26,
 target:60,spawned:0,idCounter:0,portalReady:false,waveDelay:0,mission:{type:'survive'}};
let fired=0;
const ctx={Math,Number,Array,Int8Array,Int16Array,Float32Array,Map,Set,console,
 game,mapSize:N,mapCells:cells,mapRooms:[],sectorStyle:15,glReady:true,
 TAU:Math.PI*2,hypot:Math.hypot,
 clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),
 navField:null,navClock:0,save:{settings:{audio:false}},
 input:{jumpQueued:false},toast:()=>{},sound:()=>{},burst:()=>{},
 v3:(x,y,z)=>({x,y,z}),rayWall:()=>null,
 themes:Array.from({length:18},()=>({accent:[.35,.7,1]})),
 bossNames:['BOSS'],pick:pool=>pool[pool.length-1],rand:(a,b)=>(a+b)/2,
 distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 damagePlayer:()=>{},maybeFinishMission:()=>{},
 $:()=>({textContent:'',style:{}}),
};
vm.createContext(ctx);
const enemLine=src('12-arsenal-and-game.js').split('\n').find(x=>x.startsWith('const enemies='));
vm.runInContext(enemLine,ctx);
vm.runInContext(src('03-height-and-collision.js')+src('04a-static-world-solids.js')+
 src('13-enemy-navigation-spawn.js')+src('13a-enemy-world-navigation.js'),ctx);
const ai=src('18-ai-and-abilities.js');
vm.runInContext(ai.slice(ai.indexOf('function enemyFire('),ai.indexOf('// Robot animation rig V')),ctx);
const geom=src('14-combat-raycast.js');
vm.runInContext(geom.slice(geom.indexOf('function robotAccessoryVolumes('),
 geom.indexOf('function robotAccessoryRay(')),ctx);
const expression=x=>vm.runInContext(x,ctx);
const reset=()=>{ctx.resetWorldSolids();game.enemies=[];game.bullets=[];game.t=0;};
const tick=(e,dt=.05)=>{game.t+=dt;ctx.updateFlyingRobot(e,player,dt);};

// All four flying classes are real opponents with armor and dynamic 3D feet.
for(const type of ['drone','skyhunter','skyguard','stormray']){
 reset();game.sector=30;game.spawned=0;
 const e=ctx.spawnEnemy(type);
 check(e&&e.type===type&&e.airborne,`${type} not tagged airborne`);
 check(e.feetY>=ctx.floorHeight(e.x,e.z)+.12,`${type} spawned below terrain`);
 check(e.maxhp>40&&e.range>9&&e.speed>0,`${type} combat stats missing`);
 check(!ctx.worldSolidBodyCollision(e.x,e.z,ctx.enemyBodyRadius(e),e.feetY,
  ctx.enemyBodyHeight(e)),`${type} spawned inside geometry`);
 const old=e.feetY;
 for(let i=0;i<15;i++)tick(e);
 check(Number.isFinite(e.feetY)&&e.feetY>old+.10,`${type} never gained height`);
 check(e.feetY<ctx.ceilingHeight()-ctx.enemyBodyHeight(e),`${type} crossed ceiling`);
 const wings=ctx.robotAccessoryVolumes(e);
 check(wings.length===4&&wings.some(w=>w.part==='wing')&&
  wings.some(w=>w.part==='thruster'),`${type} has no shootable wing/thruster hitboxes`);
 if(type==='skyguard')check(e.protection>0,`skyguard lacks shielding`);
}

// Horizontal movement cannot silently snap a flyer onto the ground.
reset();const flyer=ctx.spawnEnemy('skyhunter');
flyer.x=10.5;flyer.z=8.5;flyer.feetY=4.4;
ctx.moveEntity(flyer,2.0,0,ctx.enemyBodyRadius(flyer));
near(flyer.feetY,4.4,1e-9,'moving flyer was snapped to ground');
check(flyer.x>12.2,'flying bot was unable to cross clear air');
// A floor step higher than the flying body cannot be crossed at ground level.
flyer.x=10.5;flyer.z=8.5;flyer.feetY=.13;
expression('heightCells=new Float32Array(mapSize*mapSize);heightCells[8*mapSize+11]=.86');
ctx.moveEntity(flyer,1.1,0,ctx.enemyBodyRadius(flyer));
check(flyer.x<10.90,'low-altitude flyer clipped through raised terrain');
expression('heightCells=new Float32Array(mapSize*mapSize)');

// A real roof and a thin deck are swept obstacles on low-FPS frames.
reset();ctx.registerWorldSolid(9,3.20,9,13,3.38,13,'flying-deck');
const roofBot=ctx.spawnEnemy('skyguard');
roofBot.x=11;roofBot.z=11;roofBot.feetY=.13;
player.x=11.4;player.z=11;player.feetY=8.2;
const ceiling=3.20-ctx.enemyBodyHeight(roofBot);
let roseBeyondDeck=false;
for(let i=0;i<8;i++){
 tick(roofBot,.15);
 check(!ctx.worldSolidBodyCollision(roofBot.x,roofBot.z,ctx.enemyBodyRadius(roofBot),
  roofBot.feetY,ctx.enemyBodyHeight(roofBot)),`flyer intersected deck on frame ${i}`);
 if(roofBot.x>=9.7&&roofBot.x<=12.3&&roofBot.z>=9.7&&roofBot.z<=12.3)
  check(roofBot.feetY<=ceiling+.01,'flyer passed through deck while beneath it');
 if(roofBot.feetY>3.5)roseBeyondDeck=true;
}
for(let i=0;i<240;i++){
 tick(roofBot,.05);
 check(!ctx.worldSolidBodyCollision(roofBot.x,roofBot.z,ctx.enemyBodyRadius(roofBot),
  roofBot.feetY,ctx.enemyBodyHeight(roofBot)),`flyer clipped roof in prolonged simulation ${i}`);
 if(roofBot.feetY>3.5)roseBeyondDeck=true;
}
check(roseBeyondDeck,'airborne robot failed to escape under-platform footprint');

// Descent from *above* must land on the top face, not slip through a thin deck.
reset();ctx.registerWorldSolid(9,3.20,9,13,3.38,13,'thin-deck');
const landing=ctx.spawnEnemy('drone');
landing.x=11;landing.z=11;landing.feetY=6.0;landing.stun=100;
player.x=16;player.z=11;player.feetY=0;
for(let i=0;i<45;i++){
 tick(landing,.10);
 check(landing.feetY>=3.38+.017,'airborne bot descended through solid deck');
 check(!ctx.worldSolidBodyCollision(landing.x,landing.z,ctx.enemyBodyRadius(landing),
  landing.feetY,ctx.enemyBodyHeight(landing)),'descending bot intersected platform');
}
check(landing.feetY<3.6,'descending bot floated permanently above platform');

// In legacy low-roof arenas, heavy flyers cannot poke through the ceiling.
reset();ctx.sectorStyle=0;
const lowRoof=ctx.spawnEnemy('skyguard');
lowRoof.x=8.5;lowRoof.z=10.5;lowRoof.feetY=.13;
player.x=14;player.z=10.5;player.feetY=9;
for(let i=0;i<90;i++){
 tick(lowRoof,.05);
 check(lowRoof.feetY+ctx.enemyBodyHeight(lowRoof)<=ctx.ceilingHeight()-.075,
  'heavy flying robot crossed low arena ceiling');
}
ctx.sectorStyle=15;

// In open sky, ships climb toward a player at platform altitude, not merely
// bob around at the height at which they spawned.
reset();const chase=ctx.spawnEnemy('stormray');
chase.x=8.5;chase.z=7.5;chase.feetY=.13;
player.x=12;player.z=7.5;player.feetY=8;
let maxHeight=chase.feetY;
for(let i=0;i<150;i++){
 tick(chase);
 maxHeight=Math.max(maxHeight,chase.feetY);
 check(chase.feetY<=ctx.ceilingHeight()-ctx.enemyBodyHeight(chase)+1e-8,
  'stormray passed through arena ceiling');
}
check(maxHeight>7.1,`stormray refused to pursue elevated target (${maxHeight})`);

// Projectile components must have constant 3D speed, and center of a burst
// must truly intersect the target height (both upward and downward).
reset();const attacker=ctx.spawnEnemy('skyhunter');
attacker.x=7;attacker.z=12;attacker.feetY=7;
player.x=16;player.z=12;player.feetY=.7;
for(const pattern of [0,9,10]){
 game.bullets=[];ctx.enemyFire(attacker,pattern);
 check(game.bullets.length===(pattern===9?3:pattern===10?2:1),
  `pattern ${pattern} volley count wrong`);
 const b=game.bullets[Math.floor(game.bullets.length/2)];
 const speed=Math.hypot(b.vx,b.vy,b.vz);
 check(Math.abs(speed-3*(pattern===9?1.23:pattern===10?1.14:1))<.00001,
  'aerial shot speed not normalized in 3D');
 if(pattern!==10){
  const flight=Math.hypot(player.x-b.x,player.z-b.z)/Math.hypot(b.vx,b.vz);
  near(b.y+b.vy*flight,player.feetY+1.05,.00001,'bullet missed target height');
 }
}
player.feetY=10;game.bullets=[];ctx.enemyFire(attacker,0);
check(game.bullets[0].vy>0,'flying robot does not aim upward');

// Hard cover and stun must suppress shooting without breaking altitude state.
reset();const sn=ctx.spawnEnemy('skyhunter');
sn.x=10;sn.z=10;sn.feetY=3;player.x=13;player.z=10;player.feetY=2;
game.bullets=[];sn.attack=0;
ctx.rayWall=()=>({t:.15});tick(sn);
check(game.bullets.length===0,'flying robot fired through solid cover');
ctx.rayWall=()=>null;sn.attack=0;tick(sn);
check(game.bullets.length>0,'uncovered flyer failed to fire');
game.bullets=[];sn.stun=.8;sn.attack=0;tick(sn);
check(game.bullets.length===0,'stunned flying robot attacked');

// Pool gating in actual spawnWave: early and late sectors differ.
reset();game.sector=12;game.spawned=0;game.waveDelay=0;
ctx.spawnWave(.5);check(game.enemies.length===1,'stage 12 wave could not spawn');
check(!['skyhunter','skyguard','stormray'].includes(game.enemies[0].type),
 'advanced flyers appeared too early');
reset();game.sector=30;game.spawned=0;game.waveDelay=0;
ctx.spawnWave(.5); // boss sector deliberately: confirm boss-specific mission logic unchanged.
check(game.enemies.length===1&&game.enemies[0].boss,'boss wave overridden by airborne pool');
reset();game.sector=29;game.spawned=0;game.waveDelay=0;
ctx.pick=pool=>pool.includes('stormray')?'stormray':pool[0];
ctx.spawnWave(.5);check(game.enemies.length===1&&game.enemies[0].type==='stormray',
 'late-level stormray not available in wave pool');

// A real Stage 14 checkpoint has a floating drone without `airborne`.
// Restoring it must retain HP/cooldowns, repair an underpass overlap and
// leave the normal/player-save format untouched.
reset();ctx.registerWorldSolid(10,2.2,10,13,2.4,13,'old-bridge');
ctx.save.perms=Array(6).fill(0);
ctx.weapons=[{name:'test'}];ctx.equippedArmorStats=()=>({id:-1,maxDurability:0,reduction:0});
ctx.spawnX=7.5;ctx.spawnZ=7.5;ctx.sectorArchitecture='CHECKPOINT';
ctx.$=()=>({textContent:'',style:{},dataset:{}});
const saved=src('20-minimap-and-checkpoint.js');
vm.runInContext('const DASH_DISTANCE_BASE=2.52,DASH_UPGRADE_STEP=.30;',ctx);
const arsenal=src('12-arsenal-and-game.js');
vm.runInContext(arsenal.slice(arsenal.indexOf('const PERM_COMPOUND='),arsenal.indexOf('function newPlayer(')),ctx);
vm.runInContext(saved.slice(saved.indexOf('function restoreLiveCheckpoint('),
 saved.indexOf('// Auto-save during combat')),ctx);
const legacyDrone={id:42,type:'drone',boss:false,x:11,z:11,feetY:.80,
 radius:.48,hp:42,maxhp:94,attack:.79,dead:false};
const ck={version:3,state:'playing',player:{x:7.5,z:7.5,feetY:0,
 maxArmor:30,armor:30,weapon:0,maxEnergy:100,energy:100},
 live:{enemies:[legacyDrone]}};
ctx.restoreLiveCheckpoint(ck);
const restored=game.enemies[0];
check(restored.airborne&&restored.hp===42&&restored.attack===.79,
 'old saved drone lost flying class, combat state or cooldown');
near(restored.feetY,.13,1e-5,'legacy drone was not released from bridge collision');
check(!ctx.worldSolidBodyCollision(restored.x,restored.z,ctx.enemyBodyRadius(restored),
 restored.feetY,ctx.enemyBodyHeight(restored)),
 'legacy checkpoint restore left a drone inside bridge');

console.log(`STAGE15 FLYING ROBOTS: ${count} real physics, AI, 3D ballistics, spawning and hit proxy assertions passed`);

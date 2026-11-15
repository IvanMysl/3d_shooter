'use strict';
// Stage 13: held jumping, modest sprint drain, save migration, upgrade range.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const read=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;function check(ok,why){assert.ok(ok,why);checks++;}
const eps=(a,b,why)=>check(Math.abs(a-b)<.000001,`${why}: ${a} != ${b}`);
const storage={getItem:()=>null,setItem:()=>{}};
const saveCtx={Math,Number,Array,Map,Set,Date,JSON,console,
 localStorage:storage,sessionStorage:storage};
vm.createContext(saveCtx);
vm.runInContext(read('00-core-save.js').split('const restoreInput=')[0],saveCtx);
const normalize=raw=>vm.runInContext(`normalizePerms(${JSON.stringify(raw)})`,saveCtx);
let result=normalize([5,3,1,8]);
check(result.length===12,'legacy four upgrades were not extended to twelve');
check(result[0]===5&&result[3]===8&&Array.from(result).slice(4).every(v=>v===0),'old purchases changed during migration');
result=normalize([-3,99,NaN,42,20,40]);
check(result[0]===0&&result[1]===40&&result[3]===40,'upgrade level validation broken');
check(result[4]===20&&result[5]===40,'new upgrade levels truncated');
check(vm.runInContext("normalizeCameraMode('second')",saveCtx)==='second','camera setting not persistent');
check(vm.runInContext("normalizeCameraMode('unknown')",saveCtx)==='first','invalid camera mode accepted');
saveCtx.spawnX=6.5;saveCtx.spawnZ=6.5;
saveCtx.equippedArmorStats=()=>({id:-1,maxDurability:0,reduction:0});
saveCtx.armorGrantsFlight=suit=>suit.id>=9||suit.id>=0&&suit.level>=10;
const playerSource=read('12-arsenal-and-game.js');
vm.runInContext(playerSource.slice(playerSource.indexOf('const PERM_COMPOUND='),playerSource.indexOf('function freshGame(')),saveCtx);
let p=saveCtx.newPlayer();
eps(p.maxEnergy,100,'new player baseline energy');
eps(p.dashRange,2.52,'new player baseline dash');
vm.runInContext('save.perms[4]=40;save.perms[5]=40;',saveCtx);
p=saveCtx.newPlayer();
eps(p.maxEnergy,100*Math.pow(1.04,40),'compound capacity at level 40');
eps(p.energy,p.maxEnergy,'energy tank not filled on fresh spawn');
eps(p.dashRange,14.52,'max teleport range level 40');
const hangar=read('22-menus-and-upgrades.js');
vm.runInContext(hangar.slice(hangar.indexOf('const hangarData='),hangar.indexOf('function weaponShopHTML(')),saveCtx);
check(vm.runInContext('hangarData.length',saveCtx)===12,'hangar missing Stage26 EMP and Stage28 repair/shield upgrades');
check(vm.runInContext('PERM_MAX_LEVEL',saveCtx)===40,'permanent upgrades still capped at 8');

// Check the real movement routine used by a level-40 dash; walls remain solid.
const N=32,cells=Array.from({length:N},()=>Array(N).fill(0));
for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(z===0||x===0||z===N-1||x===N-1)cells[z][x]=1;
const physics={Math,Number,Array,Map,Float32Array,console,mapSize:N,mapCells:cells,
 glReady:false,sectorStyle:0,mapRooms:[],worldSolidBodyCollision:()=>false,
 save:{settings:{audio:false}},arsenalOpened:false,
 input:{jumpQueued:false,jumpHeld:false,mx:0,mz:0},sound:()=>{},burst:()=>{},toast:()=>{},
 game:{state:'playing',p:null},clamp:(v,a,b)=>Math.max(a,Math.min(v,b))};
vm.createContext(physics);
vm.runInContext('const DASH_DISTANCE_BASE=2.52,DASH_DISTANCE_MAX=14.52,DASH_DISTANCE_MIN=.5',physics);
vm.runInContext(read('03-height-and-collision.js'),physics);
const ability=read('18-ai-and-abilities.js');
vm.runInContext(ability.slice(ability.indexOf('function useAbility('),ability.indexOf('function enemyFire(')),physics);
const warrior={x:6.5,z:6.5,yaw:Math.PI/2,feetY:0,grounded:true,energy:500,
 dashCost:25,dashRange:14.52,shield:0,maxhp:100,hp:100};
physics.game.p=warrior;cells[6][9]=1;
physics.useAbility('dash');
check(warrior.x>8.3&&warrior.x<8.8,`upgraded dash passed through tile wall: ${warrior.x}`);
check(warrior.energy===475,'upgraded dash cost was changed');
// Independent ability scenarios: advance past the new anti-spam cooldown.
cells[6][9]=0;warrior.x=6.5;warrior.energy=500;warrior.abilityCooldowns.dash=0;
physics.useAbility('dash');
eps(warrior.x,21.02,'unobstructed level-40 dash range');
warrior.x=6.5;warrior.dashRange=2.52;warrior.energy=500;warrior.abilityCooldowns.dash=0;
physics.useAbility('dash');
eps(warrior.x,9.02,'baseline dash range retained');

// Held Space is processed by updateVertical itself on every landing.
warrior.x=6.5;warrior.yaw=0;warrior.feetY=0;warrior.vy=0;warrior.grounded=true;
physics.input.jumpHeld=true;let launches=0;
for(let i=0;i<180;i++){
 const onGround=warrior.grounded;
 physics.updateVertical(warrior,1/60);
 if(onGround&&!warrior.grounded)launches++;
}
check(launches>=3,`holding Space only jumped ${launches} time(s)`);
physics.input.jumpHeld=false;physics.input.jumpQueued=false;
for(let i=0;i<120;i++)physics.updateVertical(warrior,1/60);
check(warrior.grounded&&warrior.feetY===0,'releasing Space did not stop repeated jumps');

// The actual sprint helper must deduct ~1.8 units/sec after regeneration.
const sprintCtx={Math,console,input:{sprint:true,mobileSprint:false,mz:0}};
vm.createContext(sprintCtx);
const source=read('19-gameplay-update.js');
vm.runInContext(source.slice(source.indexOf('const SPRINT_ENERGY_DRAIN='),source.indexOf('function update(')),sprintCtx);
const runner={energy:100,regen:16,sprintTired:false};
check(sprintCtx.sprintMotionState(runner,true,1,0),'full energy should allow sprint');
eps(runner.energy,98.2,'sprint at full capacity cost');
runner.energy=60+16/60;
check(sprintCtx.sprintMotionState(runner,true,1/60,16/60),'running with regen allowed');
eps(runner.energy,59.97,'regen cancellation and small sprint drain');
const stationaryEnergy=runner.energy;
check(!sprintCtx.sprintMotionState(runner,false,1/60,0),'stationary sprint consumed energy');
eps(runner.energy,stationaryEnergy,'stationary energy');
runner.energy=.2;runner.sprintTired=false;
check(!sprintCtx.sprintMotionState(runner,true,.016,0)&&runner.sprintTired,'exhaustion did not block sprint');
runner.energy=7.9;
check(!sprintCtx.sprintMotionState(runner,true,.016,0),'sprint restarted before hysteresis threshold');
runner.energy=8.1;
check(sprintCtx.sprintMotionState(runner,true,.016,0),'sprint never resumed after recharge');
console.log(`STAGE13: ${checks} controls, permanent upgrades, save migration and dash checks passed`);

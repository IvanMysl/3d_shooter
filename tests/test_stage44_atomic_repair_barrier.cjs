'use strict';
// Stage44: test actual production functions, not reimplemented healing formulas.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
let count=0;
function equal(a,b,label){assert.equal(a,b,label);count++;}
function near(a,b,label){assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} vs ${b}`);count++;}
const clamp=(x,low,high)=>Math.max(low,Math.min(high,x));

// Solo F: no cooldown, full intended repair or nothing, same for all 3 pools.
const player={hp:0,maxhp:100,bodyArmor:0,bodyArmorMax:200,armor:0,maxArmor:30,
 energy:49,maxEnergy:100,x:0,z:0,feetY:0};
const solo={Math,Number,clamp,save:{perms:Array(12).fill(0)},
 toast(){},burst(){},sound(){},game:{state:'playing',p:player}};
vm.createContext(solo);
const stats=source('12-arsenal-and-game.js');
vm.runInContext(stats.slice(stats.indexOf('const PERM_COMPOUND='),stats.indexOf('function newPlayer(')),solo);
const abilities=source('18-ai-and-abilities.js');
{const fx=fs.readFileSync(path.join(__dirname,'../src/13-enemy-navigation-spawn.js'),'utf8');vm.runInContext(fx.slice(fx.indexOf('function emitWeaponSound(')),solo);}
vm.runInContext(abilities.slice(abilities.indexOf('function restorePriorityDefense('),abilities.indexOf('function useAbility(')),solo);
equal(solo.restorePriorityDefense(player),false,'solo 49 energy cannot buy full 49 HP repair');
equal(player.hp,0,'failed solo repair does not heal');
equal(player.energy,49,'failed solo repair does not charge');
player.energy=50;
equal(solo.restorePriorityDefense(player),'hp','full price repairs hull immediately');
equal(player.hp,49,'solo full repair restores 49 HP');
equal(player.energy,0,'solo full repair costs 50');
player.hp=99;player.energy=1;
equal(solo.restorePriorityDefense(player),false,'even 1 missing HP needs sufficient exact energy');
equal(player.hp,99,'underpowered one-HP tap does not partially restore');
equal(player.energy,1,'underpowered one-HP tap keeps energy');
player.energy=50/49;
equal(solo.restorePriorityDefense(player),'hp','exact final-remainder cost is accepted');
equal(player.hp,100,'final solo HP becomes full');
near(player.energy,0,'exact final-remainder energy is charged');
player.bodyArmor=0;player.energy=49;
equal(solo.restorePriorityDefense(player),false,'suit cannot be partially restored');
equal(player.bodyArmor,0,'suit remains damaged when energy insufficient');
player.energy=50;
equal(solo.restorePriorityDefense(player),'bodyArmor','full suit action works');
near(player.bodyArmor,14,'full suit action repairs 7%');
player.bodyArmor=200;player.energy=39;
equal(solo.restorePriorityDefense(player),false,'barrier below 40 energy stays damaged');
equal(player.armor,0,'underpowered barrier tap does nothing');
player.energy=40;
equal(solo.restorePriorityDefense(player),'armor','barrier action charges 40 energy');
equal(player.armor,9,'barrier repairs 30% capacity without partial energy');

// PvP F: host-authoritative skill keeps immediate presses, charges full amount.
const mp=source('21g-multiplayer-flight-abilities.js');
const multiplayer={Math,Number,mpMatch:{tick:0,self:0},
 mpCombatEmit(){},mpCombatSyncHud(){}};
vm.createContext(multiplayer);
vm.runInContext(mp.slice(mp.indexOf('const MP6_SKILLS='),mp.indexOf('function mp6Init(')),multiplayer);
vm.runInContext(mp.slice(mp.indexOf('function mp6Skill('),mp.indexOf('function mp6Step(')),multiplayer);
const a={id:0,respawnAt:0,p:{hp:40,maxhp:100,armor:10,maxArmor:30,energy:44.99,
 abilityCooldowns:{heal:0},x:0,z:0,feetY:0,weapon:0}};
equal(multiplayer.mp6Skill(a,'heal'),false,'PvP 44.99 energy does not partially restore 38 HP');
equal(a.p.hp,40,'PvP insufficient charge leaves HP unchanged');
equal(a.p.energy,44.99,'PvP insufficient charge is free');
a.p.energy=45;
equal(multiplayer.mp6Skill(a,'heal'),true,'PvP 45 energy accepts full heal');
equal(a.p.hp,78,'PvP restores exactly 38 HP');
equal(a.p.energy,0,'PvP spends exactly 45 energy');
a.p.energy=45;
equal(multiplayer.mp6Skill(a,'heal'),true,'PvP immediate second tap without cooldown');
equal(a.p.hp,100,'PvP second heal clamps to max HP');
near(a.p.energy,45-22/38*45,'PvP final remainder is billed precisely');
a.p.armor=0;a.p.energy=44;
equal(multiplayer.mp6Skill(a,'heal'),false,'PvP insufficient barrier energy is rejected');
equal(a.p.armor,0,'PvP barrier stays unchanged on failed tap');
a.p.energy=45;
equal(multiplayer.mp6Skill(a,'heal'),true,'PvP full barrier action works');
equal(a.p.armor,22,'PvP barrier action restores its full 22 units');

// Evaluate the actual gameplay tick: 1.5x slower means rate / 1.5, not a
// longer cooldown, altered energy regen, or a change in upgraded armor rates.
const gameplay=source('19-gameplay-update.js');
const begin=gameplay.indexOf('function update(dt){'),end=gameplay.indexOf('function portalNext(');
assert.ok(begin>=0&&end>begin,'production solo update located');
const noop=()=>{};
const sim={Math,Number,clamp,hypot:Math.hypot,
 updateDashDistanceWhileHeld:noop,rebuildNavigation:noop,updateVertical:noop,
 spawnWave:noop,updateEnemies:noop,updateRobotDebris:noop,updatePlayerOrdnance:noop,
 updateBullets:noop,updateDevices:noop,updateMission:noop,shoot:noop,moveEntity:noop,
 key:()=>false,sprintMotionState:()=>false,input:{mx:0,mz:0,fire:false},arsenalOpened:false,
 navClock:100,save:{settings:{}},flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,
 game:{state:'playing',p:{hp:100,maxhp:100,energy:100,maxEnergy:100,regen:0,
  armor:0,maxArmor:50,armorRegen:2.6,armorDelay:0,abilityCooldowns:{},
  heatLock:0,heat:0,recoil:0,shotGlow:0,equipAnim:0,iframes:0,shield:0,
  healRegen:0,cooldown:0,flying:false},t:0,sectorTime:0,combo:0}};
Object.assign(sim,{navFieldDestroyed:0,navFieldWorldCount:0,worldSolidCount:0,
 navFieldEquipment:null,worldEquipmentGrid:()=>null,navFieldMap:null,mapCells:null,
 navFieldHeights:null,heightCells:null,navFieldWorld:null,worldSolidGrid:null});
vm.createContext(sim);vm.runInContext(gameplay.slice(begin,end),sim);
sim.update(.5);
near(sim.game.p.armor,2.6/1.5*.5,'base solo barrier regen slowed exactly 1.5x');
near(sim.game.p.energy,100-(2.6/1.5*.5)*.5,'barrier pays original energy per restored unit');
sim.game.p.armorRegen=12;sim.game.p.armor=0;sim.game.p.energy=100;
sim.update(.5);
near(sim.game.p.armor,12/1.5*.5,'upgraded solo barrier regen slowed by same factor');
sim.game.p.armorDelay=1;sim.game.p.armor=0;
sim.update(.5);
equal(sim.game.p.armor,0,'barrier cannot regenerate while delayed');
sim.game.p.energy=10;sim.game.p.armorDelay=0;
sim.update(.5);
equal(sim.game.p.armor,0,'passive barrier regen retains minimum energy gate');
console.log('STAGE44 ATOMIC REPAIR + BARRIER REGEN: '+count+' assertions passed');
